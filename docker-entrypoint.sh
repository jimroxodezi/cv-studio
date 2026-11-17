#!/bin/sh
set -e

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AUTH_SECRET:?AUTH_SECRET is required (openssl rand -base64 48)}"
: "${ENCRYPTION_KEY:?ENCRYPTION_KEY is required (openssl rand -base64 32)}"

if [ -z "${ADMIN_EMAIL:-}" ]; then
  echo "warning: ADMIN_EMAIL is unset, so no one can bootstrap the admin account."
fi

if [ -z "${DEFAULT_LLM_API_KEY:-}" ]; then
  echo "note: no server-side AI key configured; users must add their own in Settings."
fi

echo "Applying database migrations…"
node scripts/migrate.mjs

echo "Starting CV Studio…"
exec node server.js
