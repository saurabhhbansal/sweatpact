# External Integrations

**Analysis Date:** 2026-06-14

## APIs & External Services

**Google Maps:**
- Google Places API (Autocomplete) - Gym/location search functionality
  - SDK/Client: Built-in REST API via `fetch()`
  - Implementation: `src/app/api/places/search/route.ts` proxies requests server-side
  - Auth: `GOOGLE_MAPS_API_KEY` environment variable (server-only, never exposed to client)
  - Rate limiting: 20 requests per user per 60 seconds via Postgres `check_rate_limit()` function
  - Endpoint: `https://maps.googleapis.com/maps/api/place/autocomplete/json`

**Vercel Cron:**
- Scheduled task service for obligation enforcement
  - Configuration: `vercel.json` with schedule `0 19 * * *` (19:00 UTC daily)
  - Endpoint: `src/app/api/cron/enforce/route.ts`
  - Auth: Bearer token via `CRON_SECRET` header (set by Vercel automatically)

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser) or `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` 2.45.4
  - Migrations: `supabase/migrations/` (29 migrations as of 2026-06-14)
  - Tables: profiles, groups, group_members, checkin_events, challenge_invitations, obligations, push_subscriptions, cycle_events, notifications, and others (see migrations)
  - RLS (Row Level Security): Enabled on all user-facing tables
  - Rate limiting: Postgres `check_rate_limit()` function for API endpoints

**File Storage:**
- Supabase Storage
  - Used for: User avatars (profile pictures)
  - Implementation: Upload via `src/app/(tabs)/u/[username]/avatar-upload.tsx`, image cropping in browser

**Caching:**
- None configured (Next.js server-side caching via RSC)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (Email magic-link)
  - Implementation: Email-based passwordless authentication
  - Callback: `src/app/auth/callback/route.ts` exchanges auth code for session
  - Session: Stored in secure cookies via `@supabase/ssr` middleware
  - Middleware: `src/middleware.ts` uses `createServerClient` for cookie management
  - Secrets: User webhook_secret generated and stored in `profiles.webhook_secret` for iOS Shortcut API access

## Monitoring & Observability

**Error Tracking:**
- Console logging for API errors (e.g., Google Places API failures)
- Implementation: `console.error()` calls in API routes (`src/app/api/places/search/route.ts`, `src/app/api/cron/enforce/route.ts`)

**Logs:**
- Application logs to stdout (server-side via Next.js runtime)
- Supabase logs (built-in to Supabase project dashboard)
- Audit logging: IP and User-Agent captured in `checkin_events` for every check-in attempt
- Vercel deployment logs for cron jobs

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js optimized)
- Git integration: Auto-deploy on push to `main` branch
- Configuration: `vercel.json` for cron schedule

**CI Pipeline:**
- No dedicated CI service configured
- Pre-deployment checks: ESLint, TypeScript typecheck, Vitest can be run locally before push

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (server-only)
- `NEXT_PUBLIC_SITE_URL` - Application base URL
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Web Push public key (browser)
- `VAPID_PRIVATE_KEY` - Web Push private key (server-only)
- `VAPID_SUBJECT` - Web Push contact email
- `GOOGLE_MAPS_API_KEY` - Google Places API key (server-only)
- `CRON_SECRET` - Bearer token for Vercel Cron (server-only)

**Secrets location:**
- Development: `.env.local` (gitignored, never committed)
- Production: Vercel project Settings → Environment Variables
- Never committed to git: Service role key, VAPID private key, Google Maps API key, CRON_SECRET

## Webhooks & Callbacks

**Incoming:**
- iOS Shortcut webhook: `src/app/api/checkin/route.ts`
  - Authentication: Per-user `webhook_secret` from `profiles` table (HMAC validation)
  - Payload: GPS coordinates, timestamp, optional pre-verified status
  - Response: JSON with check-in result and distance validation

- Apple Health sync webhook (Period Sync Shortcut): `src/app/api/health/period/route.ts`
  - Authentication: Per-user `webhook_secret`
  - Payload: Menstrual flow data from Apple Health
  - Processing: Stored as `cycle_events` for period prediction

- Auth callback: `src/app/auth/callback/route.ts`
  - Trigger: Supabase email magic-link redirect
  - Processing: Exchange auth code for session, redirect to dashboard or next param

- Cron callback: `src/app/api/cron/enforce/route.ts`
  - Trigger: Vercel Cron at 19:00 UTC daily
  - Auth: Bearer token in Authorization header (`CRON_SECRET`)
  - Processing: Daily enforcement of gym obligations, period reminders

**Outgoing:**
- Web Push Notifications (VAPID): `src/lib/push.ts`
  - Implementation: `web-push` library with VAPID details
  - Recipients: All active subscriptions for a user from `push_subscriptions` table
  - Events: Check-in confirmations, challenge invites, period reminders, rest day notifications
  - Subscription management: Browser via Service Worker registration, stored in `push_subscriptions` table
  - Cleanup: Expired endpoints (404/410) auto-removed on send failure

## Database Schema Highlights

**Key tables** (see `supabase/migrations/` for full schema):
- `profiles` - User accounts, timezone, daily penalty, wallet balance, webhook_secret
- `groups` - Group entities with owner and default penalty
- `group_members` - Group membership (one group per user enforced by UNIQUE constraint)
- `checkin_events` - All check-in attempts with GPS, distance, status (verified/unverified), source (shortcut/manual/admin)
- `challenge_invitations` - Head-to-head challenges between users
- `obligations` - Weekly stakes and settlement tracking
- `push_subscriptions` - Web Push endpoints and encryption keys
- `cycle_events` - Period and Apple Health flow data
- `notifications` - In-app notification log with user preferences
- `rate_limits` - Fixed-window rate limiting (managed by Postgres `check_rate_limit()` function)

## Security Measures

**API Key Protection:**
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) marked server-only in comments, never imported in client components
- Google Maps API key proxy: All requests go through `src/app/api/places/search/route.ts`, key never reaches browser
- CRON_SECRET: Only accepted from Vercel's Authorization header or authorized query params

**Authentication & Authorization:**
- RLS enforced on every user-facing table
- Per-user webhook_secret for iOS Shortcut API access (derived from `profiles.webhook_secret`)
- Session validation: All authenticated routes check `supabase.auth.getUser()`

**Data Validation:**
- Zod schema validation on all API routes (e.g., `src/app/api/checkin/route.ts` validates GPS coordinates, timestamp)
- Check-in timestamps validated server-side to only accept today or yesterday in user's local timezone
- Distance computation server-side using Haversine formula; clients cannot forge verified status

**Audit Trail:**
- All check-in attempts logged to `checkin_events` with IP and User-Agent
- Rate limiting prevents abuse of search and check-in endpoints

---

*Integration audit: 2026-06-14*
