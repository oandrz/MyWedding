#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/weddingAws}"
BRANCH="${BRANCH:-phase/0-scaffold}"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin "$BRANCH"

echo "==> Building and deploying..."
cd go-server
$COMPOSE build
$COMPOSE up -d

# Run migration on first deploy (safe to re-run — uses IF NOT EXISTS)
if [ "${MIGRATE:-}" = "1" ]; then
  echo "==> Running database migration..."
  $COMPOSE exec -T postgres \
    psql -U wedding_user -d wedding_invitation_db \
    -f /docker-entrypoint-initdb.d/001_init.sql
fi

echo "==> Waiting for app to start..."
sleep 5

if curl -sf http://127.0.0.1:5000/api/health > /dev/null 2>&1; then
  echo "==> Deploy successful! Health check passed."
else
  echo "==> WARNING: Health check failed. Check logs:"
  echo "    $COMPOSE logs app"
  exit 1
fi
