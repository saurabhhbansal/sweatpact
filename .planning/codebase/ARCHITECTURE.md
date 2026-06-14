# Architecture

**Analysis Date:** 2026-06-14

## Overview

SweatPact is a full-stack Next.js 14 (App Router) PWA for accountability gym groups: members commit to weekly workout goals, check in (via iOS Shortcut or manual), and miss-penalties are enforced financially. The app is server-driven — UI is thin, and domain logic lives in pure TypeScript libraries under `src/lib/` that sit between API route handlers and the Supabase/Postgres data layer.

## Architecture Pattern

**Layered, server-driven monolith on Next.js App Router.**

- **Presentation** — React Server/Client Components in `src/app/(tabs)/**` and `src/components/**`
- **API / transport** — Route Handlers in `src/app/api/**/route.ts` (REST-style, one folder per resource)
- **Domain logic** — Pure modules in `src/lib/` (reconciliation, enforcement, stats, time, money)
- **Data access** — Supabase client factories in `src/lib/supabase/` over Postgres with Row-Level Security

There is no separate ORM or service container. Route handlers validate input (Zod), call domain libs, and use a Supabase client scoped to the right privilege level.

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Pages / UI | `src/app/(tabs)/`, `src/app/onboarding/`, `src/components/` | Rendering, user interaction |
| API routes | `src/app/api/**/route.ts` | Auth check, Zod validation, orchestration |
| Domain | `src/lib/*.ts` | Business rules — check-in reconciliation, penalty enforcement, period stats |
| Data | `src/lib/supabase/*.ts` | Client construction (browser / server / rsc / admin) |
| Database | `supabase/migrations/*.sql` | Schema, RLS policies, constraints |

## Data Flow

**Check-in (core flow):**
1. iOS Shortcut or UI `POST /api/checkin` (`src/app/api/checkin/route.ts`)
2. Handler: rate-limit (`src/lib/rate-limit.ts`), parse body with Zod, authenticate (session cookie or shortcut secret via `src/lib/secure-compare.ts`)
3. Geo-verify against gym location (`src/lib/geo.ts` — `haversineMeters`)
4. Reconcile the user's day and (if closed) the week — `src/lib/checkin-reconciliation.ts`
5. Persist via admin Supabase client (`src/lib/supabase/admin.ts`)
6. Notify group members — `src/lib/checkin-notify.ts` → `src/lib/push.ts` (web-push/VAPID)

**Enforcement (scheduled):**
- Vercel Cron → `POST /api/cron/enforce` (`src/app/api/cron/enforce/route.ts`), bearer-authorized by `CRON_SECRET`
- Runs `src/lib/enforcement.ts` to close periods, compute missed-goal penalties (`src/lib/money.ts`, `src/lib/period-stats.ts`) and record settlements

## Key Abstractions

- **Supabase client factories** (`src/lib/supabase/`): `browser.ts` (client RLS), `server.ts` (server-component/route, cookie-bound RLS), `rsc.ts` (read-only RSC), `admin.ts` (service-role, bypasses RLS — server-only). Choosing the right one is the central privilege decision.
- **Reconciliation engine** (`src/lib/checkin-reconciliation.ts`): idempotent day/week reconciliation that derives status from raw check-in rows; heavily unit-tested.
- **Derived status** (`src/lib/derived-status.ts`): single source of truth for member status (`EXCUSED_STATUSES`, etc.).
- **Time/timezone** (`src/lib/time.ts`): IANA-zone-aware `localDay`/`previousLocalDay` — all period math is timezone-correct.

## Entry Points

- `src/app/layout.tsx` — root layout / app shell
- `src/app/page.tsx` — landing / redirect
- `src/middleware.ts` — refreshes Supabase session cookie on every request (excludes `api/checkin`, `api/cron`, static assets)
- `src/app/api/**/route.ts` — 32 API route handlers
- `src/app/api/cron/enforce/route.ts` — daily scheduled enforcement (19:00 UTC, see `vercel.json`)

## Cross-Cutting Concerns

- **Auth** — Supabase Auth; session cookies refreshed in middleware; routes call `supabase.auth.getUser()`
- **Authorization** — Postgres RLS (primary) + privilege-scoped client selection; admin client reserved for trusted server paths
- **Validation** — Zod schemas at every API boundary
- **Rate limiting** — Postgres-backed `src/lib/rate-limit.ts` on webhook/search endpoints
- **Notifications** — Web Push (VAPID) via `src/lib/push.ts`

## Related Docs

See `STRUCTURE.md` for directory layout, `STACK.md` for tech, `INTEGRATIONS.md` for external services, `CONCERNS.md` for risk areas.

---

*Architecture analysis: 2026-06-14*
