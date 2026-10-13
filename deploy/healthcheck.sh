#!/usr/bin/env bash
# Health check for the ApplyPilot Lite stack, run every 5 minutes by a
# systemd timer. Logs to the journal (journalctl -t applypilot).
#
# Safeguards against restart loops:
#   - acts only after FAILURE_THRESHOLD consecutive failed checks
#   - restarts only the affected service (backend or caddy)
#   - waits COOLDOWN_SECONDS between restart attempts
#   - stops restarting after MAX_RESTARTS_PER_DAY and only logs
#   - never restarts the database automatically
set -uo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/applypilot-lite}"
STATE_DIR="${STATE_DIR:-/home/ec2-user/.local/state/applypilot}"
FAILURE_THRESHOLD="${FAILURE_THRESHOLD:-3}"
COOLDOWN_SECONDS="${COOLDOWN_SECONDS:-1800}"
MAX_RESTARTS_PER_DAY="${MAX_RESTARTS_PER_DAY:-3}"
DISK_LIMIT_PERCENT="${DISK_LIMIT_PERCENT:-85}"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

log() { logger -t applypilot "$*"; echo "$*"; }

read_state() { cat "$STATE_DIR/$1" 2>/dev/null || echo "${2:-0}"; }
write_state() { echo "$2" > "$STATE_DIR/$1"; }

API_DOMAIN="$(grep -E '^API_DOMAIN=' .env | cut -d= -f2-)"
now="$(date +%s)"
today="$(date -u +%F)"

# Disk usage warning (never triggers a restart)
disk_used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if [ "$disk_used" -ge "$DISK_LIMIT_PERCENT" ]; then
  log "WARNING: root disk is ${disk_used}% full"
fi

backend_ok=true
public_ok=true

curl -fsS --max-time 10 http://127.0.0.1:8001/health/db > /dev/null \
  || backend_ok=false
curl -fsS --max-time 10 "https://$API_DOMAIN/health/db" > /dev/null \
  || public_ok=false

if $backend_ok && $public_ok; then
  if [ "$(read_state failures)" -gt 0 ]; then
    log "INFO: health restored"
  fi
  write_state failures 0
  exit 0
fi

failures=$(( $(read_state failures) + 1 ))
write_state failures "$failures"
log "WARNING: health check failed ($failures/$FAILURE_THRESHOLD)" \
  "backend_ok=$backend_ok public_ok=$public_ok"

if [ "$failures" -lt "$FAILURE_THRESHOLD" ]; then
  exit 1
fi

# Database problems need a human; Docker's restart policy covers crashes.
db_health="$(docker inspect -f '{{.State.Health.Status}}' \
  "$("${COMPOSE[@]}" ps -q db)" 2>/dev/null || echo missing)"
if [ "$db_health" != "healthy" ]; then
  log "ERROR: database is '$db_health'; not restarting automatically"
  exit 1
fi

last_restart="$(read_state last_restart)"
if [ $(( now - last_restart )) -lt "$COOLDOWN_SECONDS" ]; then
  log "WARNING: restart skipped; cooldown active"
  exit 1
fi

if [ "$(read_state restart_day "")" != "$today" ]; then
  write_state restart_day "$today"
  write_state restarts_today 0
fi
restarts_today="$(read_state restarts_today)"
if [ "$restarts_today" -ge "$MAX_RESTARTS_PER_DAY" ]; then
  log "ERROR: daily restart limit reached; manual intervention required"
  exit 1
fi

if ! $backend_ok; then
  service=backend
else
  service=caddy
fi

log "ERROR: restarting $service after $failures consecutive failures"
"${COMPOSE[@]}" restart "$service"

write_state last_restart "$now"
write_state restarts_today $(( restarts_today + 1 ))
write_state failures 0
exit 1
