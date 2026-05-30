# Gym Accountability MVP

A web app where you commit to going to the gym. Miss a day, owe your group money.
iOS Shortcut + manual fallback. Backend is the source of truth; obligations are
tracked in-app (no real money movement).

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind + shadcn-style UI primitives**
- **Supabase Postgres + Auth** with row-level security
- **Vercel Cron** running every 15 minutes hits `/api/cron/enforce`
- **Zod** for server-side validation
- **Server-side Haversine** to verify gym proximity

## Product rules (decisions baked in)

- 1 group per user, enforced by `unique(user_id)` on `group_members`.
- Verified vs. unverified vs. missed are first-class statuses.
- Unverified check-ins are not silently rejected — they land in the group feed
  and are disputable.
- Penalties split evenly across other group members (any cents remainder lands
  on the first recipients so totals match exactly).
- Money is tracked in cents (`integer`). No floats.
- Daily enforcement is **idempotent**: PK on `daily_status (user_id, local_day)`
  and unique on `penalty_events (user_id, local_day, reason)` block double-runs.
- "Today" means the user's local day, computed via `Intl.DateTimeFormat` in the
  user's IANA timezone. Cutoff is per-user `HH:MM` local clock.

## Project layout

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    login/, signup/, auth/callback/
    dashboard/, group/, history/, settings/, shortcut/, join/
    api/
      checkin/        # POST: shortcut + manual check-in
      status/         # GET: today's status + obligations
      dispute/        # POST: open a dispute
      settlements/    # POST: mark obligation settled
      profile/        # PATCH: update profile / rotate secret
      groups/
        create/, join/, leave/, invite/
      cron/enforce/   # GET/POST (Bearer CRON_SECRET): daily enforcement
      auth/signout/
  components/
    ui/               # button, card, badge, input, label, textarea
    nav.tsx, status-badge.tsx, check-in-button.tsx
  lib/
    supabase/{server,browser,admin}.ts
    geo.ts, time.ts, money.ts, utils.ts, types.ts, enforcement.ts
  middleware.ts
supabase/
  migrations/0001_init.sql
vercel.json           # cron schedule
```

## Setup

### 1. Supabase

1. Create a project at https://supabase.com/.
2. In **SQL editor**, paste and run `supabase/migrations/0001_init.sql`. This
   creates all tables, RLS policies, the `handle_new_user` trigger, and the
   `same_group_as_me()` helper.
3. In **Auth → Providers**, ensure email auth is enabled. (Optional: turn off
   email confirmation in dev so signup logs you in immediately.)
4. Grab from **Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### 2. Environment

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=<long random string>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Codespaces secrets

Before opening this repo in GitHub Codespaces, add these as Codespaces secrets
and allow access for this repository:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
GOOGLE_MAPS_API_KEY
```

The required values come from the actual server/client code: Supabase auth and
database access, cron enforcement, invite/signout URLs, Web Push, and Google
Places gym search. When a Codespace is created, `.devcontainer/devcontainer.json`
passes these secrets into the container and `post-create.sh` writes `.env.local`
from them if the file does not already exist.

### 4. Run

```
npm install
npm run dev
```

App runs at http://localhost:3000.

### 5. Deploy on Vercel

1. Push the repo, import on Vercel.
2. Set the same env vars in **Project → Settings → Environment Variables**.
3. The included `vercel.json` schedules the enforcement cron every 15 minutes.
   Vercel automatically authenticates cron requests with `CRON_SECRET` if you
   set that variable; the route also accepts `?secret=` for manual pings.

## How to test it end-to-end

1. **Sign up** at `/signup`. You'll get a profile row automatically (trigger).
2. **Settings** → set your gym lat/lng (use the "Use my current location"
   button while standing at your gym, or enter coordinates), set radius (~150m
   is a good default), penalty, cutoff time, timezone.
3. **Group** → create a group. Copy the invite code.
4. From a second account, hit `/join?code=<code>` (or paste the code on the
   Group screen) to join.
5. **Dashboard** → tap **Check in now**. The browser asks for location.
   - In radius → status `verified`, badge green.
   - Outside radius → confirm "Submit unverified" → status `unverified`,
     visible to group, disputable.
6. **iOS Shortcut** (`/shortcut`) → follow the steps. Test by hitting
   `/api/checkin` from any HTTP client with `{user_id, secret, latitude,
   longitude}`.
7. **Trigger enforcement manually** (you don't have to wait for cron):
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/enforce
   ```
   Any user whose local cutoff has passed for "yesterday" without a check-in
   gets a `penalty_event`, a wallet debit, and `obligations` rows split among
   group members.
8. **Settle / dispute** → open the Group screen and use the per-obligation
   buttons.

## API surface

| Method | Path                        | Auth                                         | Notes |
|--------|-----------------------------|----------------------------------------------|-------|
| POST   | /api/checkin                | per-user `secret` **or** session cookie       | Shortcut + manual. Returns `{verified, distance_m}`. |
| GET    | /api/status                 | session                                      | Today's status, streak, wallet, obligations, group. |
| POST   | /api/dispute                | session                                      | `{target_type, target_id, reason}`. |
| POST   | /api/settlements            | session (must be `from_user` or `to_user`)   | `{obligation_id, amount_cents?, note?}`. |
| PATCH  | /api/profile                | session                                      | Update settings; `rotate_secret: true` regenerates webhook secret. |
| POST   | /api/groups/create          | session, must not already be in a group      | |
| POST   | /api/groups/join            | session, must not already be in a group      | |
| POST   | /api/groups/leave           | session                                      | Owner of a multi-member group must transfer first (MVP limit). |
| POST   | /api/groups/invite          | session                                      | Returns the invite code + URL. |
| POST   | /api/auth/signout           | session                                      | |
| GET/POST | /api/cron/enforce         | `Authorization: Bearer CRON_SECRET`          | Idempotent; safe to run repeatedly. |

## Date / timezone semantics

- A user's **local day** is `Intl.DateTimeFormat("en-CA", { timeZone })` of an
  instant — gives `YYYY-MM-DD`. We store it in `checkin_events.local_day` and
  `daily_status.local_day` so cross-day queries are simple `=` comparisons.
- The **cutoff** is a clock time (HH:MM) in the user's timezone. The cron job
  fires every 15 minutes; for each user it checks "is the current local time
  past my cutoff?" — if yes, it locks in the **previous local day's** result
  (so you keep the entirety of "today" to earn a check-in).

## Security

- Service-role key is server-only; never imported from a client component.
  `src/lib/supabase/admin.ts` is the gate.
- RLS is on for every user-facing table. The `same_group_as_me()` helper lets
  group members see each others' check-ins / obligations / disputes without
  exposing rows from other groups.
- `/api/checkin` validates the per-user `webhook_secret` for Shortcut traffic.
  For the dashboard button it falls back to the session cookie.
- `/api/cron/enforce` requires `Bearer CRON_SECRET`.
- Every check-in attempt logs IP + UA + an `audit_log` row.
- Distance is computed server-side; the client cannot lie its way to verified.

## Known MVP limits / documented assumptions

- No real money movement. Settlements are honor-system flags.
- No email-based invites. Invites are codes + a `/join?code=` URL.
- One group per user is hard-enforced by a `unique(user_id)` on
  `group_members`. To switch groups you must leave first.
- Penalty split is even. No weighted splits, no carry-over for missed days
  while not in a group (those penalties create no obligations, just a wallet
  debit).
- Disputes have lightweight votes (`dispute_votes`) but no auto-resolution.
  Owner can resolve manually.
- An owner can't leave a group while it has other members; they must remove
  members first or transfer ownership (out of scope).
- Streak counts consecutive non-missed days from `daily_status`. A day with no
  enforcement row yet (e.g. before today's cutoff) doesn't break the streak.

## What was built

- Auth (signup/login/email-callback/signout) with Supabase SSR cookies via
  `@supabase/ssr` and a refreshing middleware.
- Profile + group model with hard one-group-per-user.
- Three-state check-in (`verified` / `unverified` / `missed`) with
  Haversine verification, audit logging, and IP/UA capture.
- Idempotent daily enforcement that creates `penalty_events`, debits the
  wallet, and splits obligations across the group.
- Obligations / settlements / disputes ledger with RLS.
- Mobile-first dashboard, group, history, settings, shortcut, and join
  pages with a bottom nav.
- iOS Shortcut docs page rendered with the user's actual `user_id` + secret
  pre-filled for copy-paste.
- Vercel Cron config that pings the enforcement route every 15 minutes.
