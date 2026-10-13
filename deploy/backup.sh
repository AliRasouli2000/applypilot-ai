#!/usr/bin/env bash
# Dumps the PostgreSQL database to a compressed, verified backup file
# and removes backups older than RETENTION_DAYS.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ec2-user/applypilot-lite}"
BACKUP_DIR="${BACKUP_DIR:-/home/ec2-user/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Backups contain user data: owner-only access
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$APP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/applypilot-$timestamp.dump"

docker compose exec -T db \
  pg_dump -U applypilot -d applypilot_docker_db --format=custom \
  > "$backup_file.partial"

# Fail if the archive is unreadable
docker compose exec -T db pg_restore --list < "$backup_file.partial" > /dev/null

mv "$backup_file.partial" "$backup_file"

find "$BACKUP_DIR" -name 'applypilot-*.dump' -type f \
  -mtime +"$RETENTION_DAYS" -delete

echo "Backup written: $backup_file ($(du -h "$backup_file" | cut -f1))"
