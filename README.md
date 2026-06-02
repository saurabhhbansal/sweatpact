<div align="center">

# SweatPact

**Gym accountability with real stakes.**
Commit to a weekly gym goal, challenge friends with a money pact, and track every check-in — together.

[![Live](https://img.shields.io/badge/Live-sweatpact.vercel.app-black?style=flat-square&logo=vercel)](https://sweatpact.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

</div>

---

## What it does

Miss your weekly gym goal and you owe your challenge partners a flat stake. No real money moves — obligations are tracked in-app on the honour system. Check in via GPS from the browser or automate it silently with an iOS Shortcut.

---

## Features

| Feature | Details |
|---|---|
| **GPS Check-in** | Browser geolocation verified server-side via Haversine distance |
| **iOS Shortcut** | Background automation via per-user webhook secret — set up once, runs forever |
| **Challenges** | Head-to-head versus cards with live standings and split-pie SVG calendar |
| **Obligations** | Flat weekly stake, tracked in-app with settle / dispute flows |
| **Excused Days** | Sick, rest, and period days don't count against your weekly goal |
| **Check-in Strip** | Scrollable day history from signup to today — green / red / grey at a glance |
| **Cycle Tab** | Period predictions, phase estimates, trends, and Apple Health sync (female users) |
| **Cycle Sharing** | Grant specific users read access to your cycle data; revoke anytime |
| **Push Notifications** | VAPID web-push for invites, check-ins, rest days, and cycle-share grants |
| **Onboarding Wizard** | Username → gym → schedule → iOS Shortcut, step by step |
| **Public Profiles** | Shareable check-in history; cycle data shown only to permitted users |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 — App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui · Monochrome glass theme |
| Backend | Supabase — Postgres, Auth, Storage, RLS |
| Push | `web-push` (VAPID) + service worker |
| Validation | Zod on all API routes |
| Testing | Vitest |
| Deployment | Vercel — auto-deploy on push to `main` |
| Cron | Vercel Cron — daily obligation enforcement at 19:00 UTC |

---

## Local setup

### 1 — Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migrations in order from `supabase/migrations/` in the SQL Editor.
3. Enable **Email** auth under **Auth → Providers**.
4. Copy your keys from **Settings → API**.

### 2 — VAPID keys (web push)

```bash
npx web-push generate-vapid-keys
```

### 3 — Environment

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=replace-me-with-a-long-random-string
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:you@example.com
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 4 — Run

```bash
npm install
npm run dev          # http://localhost:3000
npm run test         # Vitest unit tests
npm run typecheck    # tsc --noEmit
```

---

## GitHub Codespaces

Add all 9 env vars as **Codespaces Secrets** for this repo. The `post-create.sh` script writes `.env.local` automatically — just run `npm run dev`.

---

## Deployment

The Vercel project is git-integrated. Push to `main` → production deploy.

For a fresh setup: import the repo on Vercel, add the 9 env vars under **Settings → Environment Variables**, and you're done. `vercel.json` handles the cron schedule.

---

## iOS Shortcuts

Available from the `/shortcut` page (pre-filled with your `user_id` and `webhook_secret`):

| Shortcut | Action |
|---|---|
| **Gym Check-in** | Sends GPS coordinates to `/api/checkin` |
| **Period Sync** | Pulls last 60 days of menstrual flow from Apple Health daily |

Set Period Sync as a **silent daily automation** in iOS Shortcuts → Automations → Time of Day.

---

## Security

- `SUPABASE_SERVICE_ROLE_KEY` is server-only — never reaches the client.
- RLS is enabled on every user-facing table.
- Check-in distance is computed server-side; clients cannot forge a verified status.
- Every check-in attempt is logged to `audit_log` with IP and User-Agent.
- Cycle data is private by default; sharing is explicit and per-username.

---

## Known limitations

- No real money movement — settlements are honour-system flags.
- Invite by code only; no email invites.
- Gym search requires a billing-enabled Google Cloud project.
- Cycle phase estimates are approximations, not medical guidance.
