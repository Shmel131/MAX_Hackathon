#!/bin/sh
set -e

mkdir -p /app/data

if [ "$SEED_ON_START" = "true" ]; then
  echo "[askvuz-backend] seeding demo data..."
  node dist/db/seed.js || true
fi

echo "[askvuz-backend] starting server..."
exec node dist/index.js
