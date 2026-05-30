#!/usr/bin/env bash
# Runs once after the Codespace container is created.
set -e

echo "==> Installing dependencies (npm ci)…"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# Codespaces injects your saved Codespaces secrets as environment variables.
# Next.js dev only reads NEXT_PUBLIC_* / server vars from process.env or
# .env*.local, so mirror the injected secrets into .env.local if it's missing.
if [ ! -f .env.local ]; then
  echo "==> Generating .env.local from Codespaces secrets…"
  {
    [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]      && echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
    [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] && echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]     && echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
    [ -n "$CRON_SECRET" ]                   && echo "CRON_SECRET=$CRON_SECRET"
    [ -n "$NEXT_PUBLIC_SITE_URL" ]          && echo "NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL"
    [ -n "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ]  && echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY"
    [ -n "$VAPID_PRIVATE_KEY" ]             && echo "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY"
    [ -n "$VAPID_SUBJECT" ]                 && echo "VAPID_SUBJECT=$VAPID_SUBJECT"
    [ -n "$GOOGLE_MAPS_API_KEY" ]           && echo "GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY"
  } > .env.local
  echo "==> .env.local written ($(wc -l < .env.local) vars). Edit it if any are missing."
else
  echo "==> .env.local already exists — leaving it untouched."
fi

echo "==> Done. Run 'npm run dev' to start the app on port 3000."
