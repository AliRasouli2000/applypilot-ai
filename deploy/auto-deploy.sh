#!/usr/bin/env bash
# Pull-based deployment for the ApplyPilot Lite backend.
# A systemd timer runs this on the EC2 server every 2 minutes.
#
#   1. Ask GitHub for the newest commit on main whose CI run passed.
#   2. If it hasn't been deployed yet, fast-forward to exactly that commit.
#   3. If backend files changed, rebuild and restart only the backend.
#   4. Check that the new backend is healthy.
#
# No credentials are needed: the repository and its CI results are public.
# Logs: journalctl -u applypilot-autodeploy
set -euo pipefail

REPO="AliRasouli2000/applypilot-ai"
APP_DIR="${APP_DIR:-/home/ec2-user/applypilot-lite}"
STATE_DIR="${STATE_DIR:-/home/ec2-user/.local/state/applypilot}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# Changes in these paths require a new backend image
BACKEND_PATHS=(backend docker-compose.yml)

mkdir -p "$STATE_DIR"
cd "$APP_DIR"

# Only one deployment at a time
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || { echo "Another deployment is already running"; exit 0; }

# Newest successful CI run for a push to main
target=$(
  curl -fsS --max-time 20 \
    "https://api.github.com/repos/$REPO/actions/workflows/ci.yml/runs?branch=main&event=push&status=success&per_page=1" \
    | jq -r '.workflow_runs[0].head_sha // empty'
)

if [ -z "$target" ]; then
  echo "No successful CI run found on main"
  exit 0
fi

# Commit the backend was last deployed from (defaults to the current checkout)
deployed=$(cat "$STATE_DIR/deployed_sha" 2>/dev/null || git rev-parse HEAD)

if [ "$target" = "$deployed" ]; then
  exit 0
fi

# Don't retry a commit that already failed; wait for the next one
if [ "$(cat "$STATE_DIR/failed_sha" 2>/dev/null)" = "$target" ]; then
  exit 0
fi

echo "New commit passed CI: $target (deployed: $deployed)"

git fetch --quiet origin main

if ! git merge-base --is-ancestor "$target" origin/main; then
  echo "ERROR: $target is not on origin/main, refusing to deploy"
  exit 1
fi

if ! git merge-base --is-ancestor "$deployed" "$target"; then
  echo "Skipping $target: it is older than the deployed commit $deployed"
  exit 0
fi

# .env holds production secrets and is git-ignored. Git may overwrite
# ignored files during a merge, so refuse any commit that tracks one.
if git cat-file -e "$target:.env" 2>/dev/null; then
  echo "$target" > "$STATE_DIR/failed_sha"
  echo "ERROR: $target contains a .env file; refusing to deploy"
  exit 1
fi

# Move the server's checkout to exactly the commit that passed CI
git merge --quiet --ff-only "$target"

if git diff --quiet "$deployed" "$target" -- "${BACKEND_PATHS[@]}"; then
  echo "$target" > "$STATE_DIR/deployed_sha"
  echo "No backend changes; checkout updated to $target"
  exit 0
fi

echo "Backend changed; rebuilding the backend container"

# Builds the new image while the old container keeps serving, then swaps.
# --no-deps leaves PostgreSQL and Caddy running untouched.
if ! GIT_SHA="$target" "${COMPOSE[@]}" up -d --build --no-deps backend; then
  echo "$target" > "$STATE_DIR/failed_sha"
  echo "ERROR: build or start failed for $target"
  exit 1
fi

# Wait until the new container reports the new version and reaches the database
for _ in $(seq 1 40); do
  version=$(curl -fsS --max-time 5 http://127.0.0.1:8001/health 2>/dev/null \
    | jq -r '.version' 2>/dev/null || true)

  if [ "$version" = "$target" ] \
    && curl -fsS --max-time 5 http://127.0.0.1:8001/health/db > /dev/null 2>&1; then
    echo "$target" > "$STATE_DIR/deployed_sha"
    rm -f "$STATE_DIR/failed_sha"

    # Remove the old, now-unused image layers to save disk space
    docker image prune -f > /dev/null

    echo "SUCCESS: backend is healthy on $target"
    exit 0
  fi

  sleep 3
done

echo "$target" > "$STATE_DIR/failed_sha"
echo "ERROR: backend did not become healthy on $target." \
  "See: docker compose logs backend"
exit 1
