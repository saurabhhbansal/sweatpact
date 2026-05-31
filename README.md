# SweatPact

A mobile-first gym accountability PWA. Commit to a weekly gym goal, challenge
friends with a money stake, and check in via GPS or iOS Shortcut. Miss your
weekly goal and you owe the flat stake to your challenge partners.

**Live:** https://sweatpact.vercel.app

---

## Features

- **GPS check-in** — browser geolocation verified server-side via Haversine.
  Falls back to unverified if outside radius.
- **iOS Shortcut check-in** — background automation via per-user webhook secret.
- **Challenges** — invite friends to a group with a weekly money stake. Flat
  penalty per missed week (not per missed day). Obligations tracked in-app;
  no real money movement.
- **Excused days** — sick day, gym closed, rest day, period day. All exempt from
  the weekly goal count.
- **Weekly goal + streak** — configurable days-per-week goal. Streak counts
  consecutive weeks that hit the goal.
- **Cycle tab** (female users) — dedicated `/cycle` page with period
  predictions, current phase estimate, avg cycle/duration stats, CSS bar-chart
  trends, and a period-day logging calendar.
- **Period sync** — iOS Shortcut pulls menstrual flow from Apple Health daily
  and marks those days as excused automatically.
- **Push notifications** — web-push (VAPID) for challenge invites, check-in
  activity, and rest-day broadcasts. Per-group and per-user toggles.
- **Onboarding wizard** — username → gym setup → schedule → iOS Shortcut.
- **Avatar upload** with in-browser cropping (`react-easy-crop`).
- **Public / private profiles** — private profiles visible only to challenge
  partners.
- **Account deletion** — full cascade, avatar storage cleanup.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS, shadcn/ui primitives |
| Backend | Supabase — Postgres + Auth + Storage + RLS |
| Auth | `@supabase/ssr` with refreshing middleware |
| Push | `web-push` (VAPID), service worker at `public/sw.js` |
| Validation | Zod on all API routes |
| Deployment | Vercel (git-integrated, auto-deploy on push to `main`) |
| Cron | Vercel Cron — `/api/cron/enforce` daily at 19:00 UTC |
| Testing | Vitest (pure logic; `npm run test`) |
| Timezone | `@vvo/tzdb` + `Intl.DateTimeFormat` |
| Icons | `lucide-react` |

Theme: **Monochrome Glass** — pure black background, white ink, no colour
accents.

---

## Project layout

```
src/
  app/
    layout.tsx  page.tsx  globals.css
    login/  signup/  auth/callback/
    onboarding/username/  onboarding/gym/  onboarding/schedule/  onboarding/shortcut/
    dashboard/            # Today view — week dots, streak, obligations
    cycle/                # Period predictions + trends (female only)
    groups/               # Challenge list
    groups/[id]/          # Group detail — members, check-ins, obligations
    notifications/        # In-app notification centre
    settings/             # Profile, schedule, gym, period sync, notifications, account
    shortcut/             # iOS Shortcut setup (pre-filled user_id + secret)
    u/[username]/         # Public profile
    u/me/                 # Redirects → /u/<own-username>
    join/                 # Join group via invite code
    group/                # Legacy redirect
    api/
      checkin/            # POST — GPS/manual check-in (webhook secret or session)
      status/             # POST — log excused day (rest/sick/gym_closed/period_day)
      period-records/     # POST/DELETE — manual period-day logging
      health/period/      # POST — Apple Health period sync (webhook secret)
      notifications/      # GET/PATCH/DELETE — list, mark-read, clear
      profile/            # PATCH — update profile fields
      account/delete/     # DELETE — full account deletion
      username/check/     # GET — username availability
      users/search/       # GET — user search for challenge invites
      push/subscribe/     # POST — register web-push subscription
      gyms/               # GET/POST — list/create saved gyms
      gyms/[id]/          # PATCH/DELETE — update/remove a saved gym
      places/search/      # GET — Google Places gym search
      places/details/     # GET — Google Places gym detail
      groups/create/      # POST
      groups/join/        # POST — join by invite code
      groups/leave/       # POST
      groups/invite/      # POST — return invite code + URL
      groups/settings/    # PATCH — group name, penalty, notifications toggle
      groups/member-penalty/   # PATCH — per-member penalty override
      groups/members/role/     # PATCH — promote/demote member
      groups/remove-member/    # POST — remove a member
      groups/checkins/reverse/ # POST — manager reverses an unverified check-in
      challenges/invite/       # POST — send challenge invite to a user
      challenges/invite-to-group/ # POST — invite to an existing group
      challenges/respond/      # POST — accept/decline a challenge invite
      challenges/cancel/       # POST — cancel a sent invite
      settlements/        # POST — mark obligation settled
      dispute/            # POST — open a dispute
      cron/enforce/       # GET/POST — daily obligation enforcement (CRON_SECRET)
      auth/signout/       # POST
  components/
    ui/                   # button, card, badge, input, label, textarea, dialog, dropdown-menu
    nav.tsx               # MobileNav (conditional Cycle tab) + TopNav
    progress-section.tsx  # Week dots + month calendar + period-day editor
    today-action-card.tsx # Check-in / excuse-day action card
    push-permission.tsx   # Web-push opt-in prompt
    status-badge.tsx      # Pill badge for check-in statuses
    avatar.tsx            # Avatar display
    excuse-button.tsx     # Rest/sick/gym_closed/period_day logging
  lib/
    supabase/{server,browser,admin}.ts
    period-stats.ts       # computePeriodStats(), estimatePhase() — fully tested
    checkin-notify.ts     # notifyGroupCheckin() helper
    checkin-reconciliation.ts  # reconcileUserDay(), reconcileUserWeek()
    push.ts               # sendPushToUser()
    groups.ts             # listUserMemberships(), getMembership()
    stats.ts              # computeProfileStats(), areUsersInSameChallenge()
    geo.ts  time.ts  money.ts  utils.ts  types.ts
  middleware.ts           # Supabase session refresh on every request
supabase/
  migrations/0001_init.sql … 0020_notification_prefs.sql
.devcontainer/
  devcontainer.json       # Node 20 Codespaces image
  post-create.sh          # npm install + write .env.local from Codespaces secrets
public/
  sw.js                   # Service worker for web-push
vercel.json               # Cron schedule (19:00 UTC daily)
vitest.config.ts
```

---

## Database schema (Supabase, migrations 0001–0020)

All user-facing tables have RLS enabled and cascade-delete on `profiles.id`.

| Table | Key columns |
|---|---|
| `profiles` | `id` (= `auth.users.id`), `username`, `gender`, `weekly_goal`, `rest_days[]`, `timezone`, `avatar_url`, `period_sync_enabled`, `notify_unverified_checkin`, `notify_rest_day` |
| `groups` | `id`, `owner_id`, `default_penalty_cents`, `invite_code`, `checkin_notifications` |
| `group_members` | `(group_id, user_id)` PK, `role` (owner/admin/member), `penalty_cents` |
| `checkin_events` | `user_id`, `group_id`, `local_day`, `status`, `source`, `lat/lng/distance_m` |
| `daily_status` | `(user_id, local_day)` PK, `status` — derived by `reconcileUserDay()` |
| `penalty_events` | created by `reconcileUserWeek()` on Sundays when goal missed |
| `obligations` | `from_user`, `to_user`, `amount_cents` (flat weekly stake), `status` |
| `notifications` | `user_id`, `type`, `payload` (jsonb), `read_at` |
| `push_subscriptions` | `endpoint`, `p256dh`, `auth`, `user_id` |
| `profile_secrets` | `user_id`, `webhook_secret` (self-only RLS) |
| `period_records` | `(user_id, local_day)` PK, `flow_level`, `source` (health/manual) |
| `user_gyms` | `user_id`, `name`, `lat`, `lng`, `radius_m` |
| `challenge_invitations` | `from_user`, `to_user`, `group_id`, `status` |
| `settlements` | `obligation_id`, `marked_by`, `amount_cents` |
| `disputes` | `group_id`, `raised_by`, `target_type`, `status` |
| `audit_log` | `user_id`, `kind`, `payload`, `ip`, `user_agent` |

---

## Local setup

### 1. Supabase

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run the migrations in order:
   `supabase/migrations/0001_init.sql` through `0020_notification_prefs.sql`.
3. In **Auth → Providers**, ensure email auth is enabled.
4. From **Settings → API**, note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Web Push (VAPID)

```bash
npx web-push generate-vapid-keys
```

Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT=mailto:you@example.com`.

### 3. Google Maps (optional)

`GOOGLE_MAPS_API_KEY` is needed for the gym search feature (Places API, billing
required). The rest of the app works without it.

### 4. Environment

Copy `.env.example` to `.env.local` and fill in all values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=<long random string>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
GOOGLE_MAPS_API_KEY=
```

### 5. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # Vitest unit tests (period-stats logic)
npm run typecheck  # tsc --noEmit
npm run build      # production build check
```

---

## GitHub Codespaces

Add all 9 env vars as **Codespaces secrets** and allow access to this repo.
When a Codespace is created, `.devcontainer/post-create.sh` installs deps and
writes `.env.local` from the injected secrets automatically. Open the terminal
and run `npm run dev`.

---

## Deployment (Vercel)

The Vercel project is git-integrated with this repo. Every push to `main`
triggers a production deploy automatically.

For a new project setup:
1. Import the repo on Vercel.
2. Set all 9 env vars in **Project → Settings → Environment Variables**.
3. Connect the repo under **Project → Settings → Git**.
4. `vercel.json` schedules `/api/cron/enforce` daily at 19:00 UTC. Vercel
   injects `CRON_SECRET` automatically for authenticated cron requests.

---

## iOS Shortcuts

Two Shortcuts are available from the `/shortcut` page (pre-filled with the
user's `user_id` and `webhook_secret`):

| Shortcut | What it does |
|---|---|
| **Gym check-in** | Sends GPS coordinates to `/api/checkin`. Verified if within gym radius. |
| **Period Sync** | Pulls last 60 days of menstrual flow from Apple Health, sends to `/api/health/period`. Run as a daily automation. |

Both use the same per-user `webhook_secret`. Set up the Period Sync Shortcut as
a **daily silent automation** in iOS Shortcuts → Automations → Time of Day.

---

## Notification system

Notifications are stored in the `notifications` table and surfaced in the
in-app notification centre (`/notifications`). Web-push is also sent where
supported.

**Types:** `challenge_invite_received`, `challenge_accepted`,
`challenge_declined`, `challenge_cancelled`, `settlement_marked`,
`penalty_added`, `group_checkin`, `group_rest_day`.

**Gating logic:**

| Event | Group toggle | User toggle |
|---|---|---|
| Verified check-in | `groups.checkin_notifications` | — |
| Unverified check-in | `groups.checkin_notifications` | `notify_unverified_checkin` |
| Rest day | — | `notify_rest_day` |

---

## Cycle tab

Visible only to female users. Accessible from the nav (4th tab, Droplet icon).
Male users visiting `/cycle` directly are redirected to `/dashboard`.

**Sections:**
- **Next period prediction** — date + days until/overdue + confidence note.
  Requires ≥ 2 logged cycles.
- **Current cycle** — day number + estimated phase (menstrual / follicular /
  ovulation / luteal). Labelled as an estimate.
- **Stats** — avg cycle length, avg period duration, regularity
  (regular/irregular/unknown), last start date.
- **Trends** — CSS/SVG bar charts (no chart library) for cycle length and
  period duration over the last 8 cycles.
- **Calendar** — full month view with flow-level dots. Tap any past non-gym day
  to log or edit a period day.
- **Log today** — quick button to mark today as a period day.

Predictions use `computePeriodStats()` from `src/lib/period-stats.ts`, which
is unit-tested in `src/lib/period-stats.test.ts` (16 cases).

---

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. `src/lib/supabase/admin.ts` is
  the only import point; never used in client components.
- RLS is enabled on every user-facing table.
- `/api/checkin` accepts either a per-user `webhook_secret` (Shortcut) or a
  session cookie (browser). Distance is computed server-side; the client cannot
  forge a verified status.
- `/api/cron/enforce` requires `Authorization: Bearer CRON_SECRET`.
- Every check-in attempt is logged to `audit_log` with IP and User-Agent.
- `profile_secrets` has self-only RLS (users can only read their own secret).

---

## Known limitations

- No real money movement. Settlements are honour-system flags.
- No email-based invites — invite codes only.
- Obligations created before the flat-stake change (May 2026) used per-day
  math; only new Sunday reconciliations use the flat weekly stake.
- Google Maps gym search requires a billing-enabled GCP project.
- Phase estimates on the Cycle tab are approximations, not medical guidance.
- Disputes have lightweight votes but no auto-resolution; owners resolve
  manually.
