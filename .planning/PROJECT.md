# SweatPact

## What This Is

SweatPact is a full-stack Next.js PWA that pairs two people in a gym-accountability challenge with real money on the line. Members commit to a weekly workout goal, verify check-ins by location (iOS Shortcut or manual), and settle up financially based on who actually showed up. A cycle-tracking layer adds a second competitive vector for users who opt in. It's for competitive fitness pairs — friends, partners, gym duos — who want social accountability backed by financial stakes, not just another logging tool.

v1.1 adds a contextual coachmark walkthrough that teaches new users the four core product moments (gym setup, stakes challenge, money model, iOS Shortcut) through real in-context actions — so the first session ends with a real stake on the line, not a tutorial checklist.

## Core Value

Make showing up have a consequence: if you skip, you owe your partner — the head-to-head financial stake is the one thing that must work.

## Current Milestone: v1.2 Analytics & Admin Dashboard

**Goal:** Instrument SweatPact with comprehensive event tracking and surface all business/product metrics in a protected `/admin` dashboard.

**Target features:**
- Event instrumentation via PostHog (onboarding funnel, check-ins, pact lifecycle, financial events, feature usage)
- Onboarding funnel visualization (step-by-step drop-off — ANL-01 from deferred backlog)
- Check-in rate over time (weekly trend, success/geo-fail rates)
- Financial & pact overview (active pacts, avg stake, penalties, settlement rate)
- Feature adoption stats (tab usage, notification CTR, Shortcut vs manual ratio)
- Engagement & retention metrics (DAU/WAU, streak lengths, churn)
- Protected `/admin` route — owner-only, SweatPact-branded, separate layout

## Current State (v1.1)

**Shipped:** 2026-06-19
**Codebase:** ~32 API routes, 30+ SQL migrations, unit-tested domain libs
**Onboarding:** Username-only entry gate + 5-step coachmark walkthrough (react-joyride v3.1) across /dashboard, /groups, /notifications, /shortcut
**Tech stack:** Next.js 14 App Router, React 18, TypeScript strict, Tailwind + shadcn/Radix, Supabase Postgres (RLS), Vercel

## Requirements

### Validated

**Authentication & Identity**
- ✓ Email magic-link sign-in via Supabase Auth — v1.0
- ✓ Session refresh on every request via middleware — v1.0
- ✓ Per-user `webhook_secret` for iOS Shortcut API access — v1.0
- ✓ Account deletion — v1.0

**Onboarding & Profile**
- ✓ Username selection with availability check — v1.0
- ✓ Profile with display name, bio, avatar (browser-side crop + Supabase Storage) — v1.0
- ✓ View other users' profiles — v1.0
- ✓ New user completes a minimal mandatory start (username only) and lands directly in the real app (ONB-01) — v1.1
- ✓ `(tabs)` redirect gate no longer forces the full setup wizard — username-only gate (ONB-02) — v1.1
- ✓ Walkthrough supports both entry paths — self-starter and invited (ONB-03) — v1.1
- ✓ User can skip the walkthrough at any step without being blocked or nagged (ONB-04) — v1.1

**Coachmark Walkthrough Engine**
- ✓ Contextual coachmarks spotlight live UI elements, anchor-gated (MutationObserver) (TOUR-01) — v1.1
- ✓ Click-through overlay coexists with nav stack, Radix dialogs, install gate (TOUR-02) — v1.1
- ✓ Coachmarks position correctly within PWA safe-area insets (TOUR-03) — v1.1
- ✓ Accessible: keyboard advance/skip/dismiss, focus handling, reduced-motion (TOUR-04) — v1.1
- ✓ Cross-route navigate-then-reveal walkthrough (pathname guard + MutationObserver) (TOUR-05) — v1.1

**Teaching Steps**
- ✓ Gym setup taught and completed in-context (GymSurface, Google Places) (TEACH-01) — v1.1
- ✓ Stakes challenge taught in-context for both paths (TEACH-02) — v1.1
- ✓ Money model taught anchored to real UI on /groups (TEACH-03) — v1.1
- ✓ iOS Shortcut taught with manual check-in fallback (TEACH-04) — v1.1
- ✓ Practice check-in: zero /api/checkin calls, never a real check-in (TEACH-05) — v1.1
- ✓ Walkthrough complete = all four teaching points presented/done (TEACH-06) — v1.1

**Setup-as-Action Surfaces**
- ✓ GymSurface / ScheduleSurface / ShortcutSurface reusable, onComplete-driven (SETUP-01) — v1.1
- ✓ Weekly schedule/goal settable in-context during walkthrough (SETUP-02) — v1.1

**Progress & Persistence**
- ✓ Walkthrough progress persisted server-side in `onboarding_progress` (PROG-01) — v1.1
- ✓ Already-done steps auto-skip from real app state (gymCount + restDays from layout RSC) (PROG-02) — v1.1
- ✓ Replay from Settings via `replay: true` PatchBody signal (PROG-03) — v1.1
- ✓ Replay handles tour_version drift gracefully (PROG-04) — v1.1

**Onboarding UX**
- ✓ 4-item GettingStartedChecklist tracks teaching progress, hides on complete (UX-01) — v1.1
- ✓ "Start your first pact" empty-state CTA on dashboard when no challenges (UX-02) — v1.1
- ✓ "Your pact is live." brand-voiced completion overlay, shown-once (UX-03) — v1.1
- ✓ Brand-voiced, consequence-first copy across all five coachmark steps (UX-04) — v1.1

**Check-ins**
- ✓ Check in via iOS Shortcut webhook (GPS + secret auth) — v1.0
- ✓ Manual check-in from UI — v1.0
- ✓ Server-side geo-verification against gym location (Haversine) — v1.0
- ✓ Idempotent day/week reconciliation deriving status from raw rows — v1.0
- ✓ Timezone-aware (IANA) local-day math for all period logic — v1.0
- ✓ Audit trail (IP + User-Agent) on every check-in attempt — v1.0

**Groups & Challenges**
- ✓ Create / join / leave groups; invite members — v1.0
- ✓ Group settings, member roles, remove member — v1.0
- ✓ Per-member penalty config — v1.0
- ✓ 1v1 head-to-head challenges (invite, respond, cancel) — v1.0
- ✓ Reverse check-ins (admin/correction path) — v1.0

**Enforcement & Money**
- ✓ Daily Vercel Cron enforcement (19:00 UTC) closing periods — v1.0
- ✓ Missed-goal penalty computation and settlement records — v1.0
- ✓ Weekly stakes / obligation tracking — v1.0
- ✓ Dispute raise + manager resolution (uphold/void) — v1.0
- ✓ Period records and settlement views — v1.0

**Cycle Tracking**
- ✓ Apple Health period-sync webhook → `cycle_events` — v1.0
- ✓ Period prediction / cycle stats with rest-day handling — v1.0

**Notifications**
- ✓ Web Push (VAPID) for check-ins, invites, period/rest-day reminders — v1.0
- ✓ Push subscription management + expired-endpoint cleanup — v1.0
- ✓ In-app notification log with preferences — v1.0

**Platform & Security**
- ✓ Gym/location search via Google Places (server-proxied key) — v1.0
- ✓ Postgres RLS on all user-facing tables — v1.0
- ✓ Privilege-scoped Supabase clients (browser / server / rsc / admin) — v1.0
- ✓ Zod validation at API boundaries — v1.0
- ✓ Postgres-backed rate limiting on webhook/search endpoints — v1.0
- ✓ PWA shell (manifest, icons, service worker) — v1.0

### Active

**Analytics Instrumentation**
- [ ] **ANL-01**: User actions tracked via PostHog across all key product moments
- [ ] **ANL-02**: Onboarding walkthrough step-by-step drop-off tracked with REQ-IDs

**Admin Dashboard**
- [ ] **ADMIN-01**: Protected `/admin` route with owner-only access gate
- [ ] **ADMIN-02**: Dashboard shows onboarding funnel visualization
- [ ] **ADMIN-03**: Dashboard shows check-in rate over time
- [ ] **ADMIN-04**: Dashboard shows financial & pact overview
- [ ] **ADMIN-05**: Dashboard shows feature adoption stats
- [ ] **ADMIN-06**: Dashboard shows engagement & retention metrics

### Out of Scope

- Generic fitness logging / calorie tracking — anti-reference; SweatPact is a stakes-and-competition product
- Logo-heavy / brand-athlete aesthetic (Nike Run Club, Under Armour) — conflicts with consequence-first identity
- Corporate SaaS dashboard UX (gray sidebar, metric-card grids) — zero personality, against design principles
- Demo / sandbox / fake-stakes mode (beyond the single labeled practice check-in) — contradicts brand
- Front-loaded multi-screen setup wizard — replaced by v1.1
- Gamified completion badges for finishing the tutorial — the real money scoreboard is the reward
- Blocking modal that traps the user until the tour completes — skip is a hard requirement

## Context

- **Stage:** Mature, deployed brownfield app (32 API routes, ~30 SQL migrations, unit-tested domain libs). Codebase map lives in `.planning/codebase/`.
- **Architecture:** Layered server-driven monolith — thin UI, domain logic in pure `src/lib/` modules, Supabase/Postgres data layer with RLS.
- **Deployment:** Vercel auto-deploy on push to `main`; Vercel Cron for enforcement; Supabase cloud (DB, auth, storage).
- **Onboarding (v1.1):** `onboarding_progress` table (tour_version, completed_steps, dismissed, last_step_id); TourProvider context hydrated server-side; CoachmarkRenderer via next/dynamic ssr:false in (tabs) layout.
- **Known risk areas** (from `.planning/codebase/CONCERNS.md`):
  - No cross-table transactional guarantees — multi-step financial ops can partially fail and orphan records.
  - Enforcement cron scans up to 10k profiles sequentially with no pagination — a scaling ceiling.
  - Authorization re-implemented per route with no shared middleware and no automated auth tests.
  - `as any` casts and untyped complex client state in several large components (including CoachmarkRenderer — library boundary).
  - No background job queue; heavy work (push, period sync) runs inline in request handlers.

## Constraints

- **Tech stack**: Next.js 14 (App Router), React 18, TypeScript strict, Tailwind + shadcn/Radix — established; new work should match.
- **Data layer**: Supabase Postgres with RLS as the primary authorization mechanism; admin (service-role) client is server-only.
- **Validation**: Zod at every API boundary; financial correctness is server-authoritative (clients cannot forge verified status).
- **Verification**: Check-ins must be geo-verified server-side; timestamps accepted only for local today/yesterday.
- **Platform**: Node.js runtime required for routes using the Supabase admin client (not Edge-compatible).
- **Testing**: Vitest; domain rule changes in `src/lib/*` require updating co-located `*.test.ts`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Server-driven monolith, domain logic in `src/lib/` | Keep financial/business rules pure and unit-testable, UI thin | ✓ Good |
| Postgres RLS as primary authorization | Defense-in-depth at the data layer regardless of route bugs | ✓ Good |
| Privilege-scoped Supabase client factories | Make the privilege choice explicit per call site; reserve admin for trusted paths | ✓ Good |
| Email magic-link auth (passwordless) | Lower friction, no password storage | ✓ Good |
| iOS Shortcut + per-user webhook secret for check-ins | Frictionless location check-in without a native app | ✓ Good |
| Daily Vercel Cron for enforcement | Simple scheduled settlement without a job queue | ⚠️ Revisit — sequential 10k-profile scan limits scaling |
| `onboarding_progress` as runtime tour source of truth | Isolated from profiles.onboarding_complete; prevents stale flag collisions | ✓ Good |
| PATCH accepts single `complete_step` key (not full array) | Server-authoritative dedupe-append; clients cannot forge completed states | ✓ Good |
| Username-only mandatory start, optional setup deferred into walkthrough | User in real app immediately; no friction wall before value delivery | ✓ Good |
| react-joyride v3.1 for coachmark engine | Mature library; D-04 Radix-dialog anchoring resolved via pause/hide | ✓ Good |
| Practice check-in: zero fetch, zero /api/checkin (grep gate) | Financial safety at source level; CoachmarkRenderer handles only PATCH complete_step | ✓ Good |
| `deriveCurrentStep()` as pure .ts (not inlined in context) | ONB-04 resume/dismiss unit-coverable by Vitest | ✓ Good |
| Real gymCount + restDays probe from layout RSC (no extra client fetch) | D-07 freeze: TourValue stays frozen; server data flows in at layout level | ✓ Good |
| Legacy /onboarding/{gym,schedule,shortcut} wizard deleted at v1.1 | Clean exit from old flow; shared surfaces in src/components/onboarding/ serve both paths | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-20 — v1.2 Analytics & Admin Dashboard milestone started*
