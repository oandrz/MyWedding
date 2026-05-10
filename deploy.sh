#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/weddingAws}"
BRANCH="${BRANCH:-main}"
COMPOSE="docker compose --env-file .env.production -f docker-compose.prod.yml"

# Load CLOUDFRONT_DISTRIBUTION_ID from .env.production if not already set in the shell
if [ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ] && [ -f "$APP_DIR/go-server/.env.production" ]; then
  CLOUDFRONT_DISTRIBUTION_ID=$(grep -E '^CLOUDFRONT_DISTRIBUTION_ID=' "$APP_DIR/go-server/.env.production" | cut -d'=' -f2-)
fi

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin "$BRANCH"

echo "==> Building and deploying..."
cd go-server
$COMPOSE build
$COMPOSE up -d --force-recreate

# Run migration on first deploy (safe to re-run — uses IF NOT EXISTS)
if [ "${MIGRATE:-}" = "1" ]; then
  echo "==> Running database migrations..."
    for f in migrations/*.sql; do
      [ -e "$f" ] || continue
      echo "Running $f..."
      # Pipes the local file content directly into the container's psql
      cat "$f" | $COMPOSE exec -T postgres psql -U wedding_user -d wedding_invitation_db
    done
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

# Invalidate CloudFront cache so users get the new version immediately
if [ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "==> Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text
  echo "==> CloudFront invalidation submitted."
else
  echo "==> Skipping CloudFront invalidation (CLOUDFRONT_DISTRIBUTION_ID not set)."
fi
