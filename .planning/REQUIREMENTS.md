# Requirements: SweatPact

**Defined:** 2026-06-14
**Core Value:** Make showing up have a consequence — if you skip, you owe your partner.

> **Baseline snapshot.** This file documents the *currently shipped* app as the
> project baseline. Every requirement below is already implemented and live
> (status: Complete). New scope is added via `/gsd-new-milestone`.

## v1 Requirements (Shipped Baseline)

### Authentication

- [x] **AUTH-01**: User can sign in via email magic-link (Supabase Auth)
- [x] **AUTH-02**: User session persists and refreshes across requests
- [x] **AUTH-03**: User gets a per-user webhook secret for iOS Shortcut access
- [x] **AUTH-04**: User can delete their account

### Onboarding & Profile

- [x] **PROF-01**: User completes onboarding (username, gym, schedule, shortcut)
- [x] **PROF-02**: User can pick a username with availability check
- [x] **PROF-03**: User can set display name, bio, and avatar (cropped, stored)
- [x] **PROF-04**: User can view other users' profiles

### Check-ins

- [x] **CHK-01**: User can check in via iOS Shortcut webhook (GPS + secret)
- [x] **CHK-02**: User can check in manually from the UI
- [x] **CHK-03**: Check-ins are geo-verified server-side against the gym location
- [x] **CHK-04**: Day/week status is reconciled idempotently from raw check-in rows
- [x] **CHK-05**: All period math is timezone-aware (IANA local day)
- [x] **CHK-06**: Every check-in attempt is audit-logged (IP + User-Agent)

### Groups & Challenges

- [x] **GRP-01**: User can create, join, and leave groups
- [x] **GRP-02**: User can invite members and manage group settings
- [x] **GRP-03**: Manager can set member roles and remove members
- [x] **GRP-04**: Per-member penalty can be configured
- [x] **GRP-05**: User can run a 1v1 head-to-head challenge (invite/respond/cancel)
- [x] **GRP-06**: Admin can reverse a check-in (correction path)

### Enforcement & Money

- [x] **ENF-01**: Daily cron closes periods and computes missed-goal penalties
- [x] **ENF-02**: Weekly stakes / obligations are tracked and settled
- [x] **ENF-03**: User can raise a dispute; manager can uphold or void it
- [x] **ENF-04**: User can view period records and settlements

### Cycle Tracking

- [x] **CYC-01**: User can sync period data from Apple Health via webhook
- [x] **CYC-02**: Cycle stats / period prediction with rest-day handling

### Notifications

- [x] **NTF-01**: User receives Web Push for check-ins, invites, and reminders
- [x] **NTF-02**: Push subscriptions are managed with expired-endpoint cleanup
- [x] **NTF-03**: In-app notification log with user preferences

### Platform & Security

- [x] **PLT-01**: Gym/location search via Google Places (server-proxied key)
- [x] **PLT-02**: Postgres RLS enforced on all user-facing tables
- [x] **PLT-03**: Privilege-scoped Supabase clients (browser/server/rsc/admin)
- [x] **PLT-04**: Zod validation at every API boundary
- [x] **PLT-05**: Postgres-backed rate limiting on webhook/search endpoints
- [x] **PLT-06**: Installable PWA (manifest, icons, service worker)

## v2 Requirements

(None tracked yet — add via `/gsd-new-milestone`.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Generic fitness/calorie logging | Anti-reference; SweatPact is stakes-and-competition, not a tracker |
| Brand-athlete / logo-heavy aesthetic | Conflicts with sharp, consequence-first product identity |
| Corporate SaaS dashboard UX | Zero personality; against design principles |

## Traceability

Baseline snapshot — all v1 requirements are shipped, not mapped to forward phases.
Traceability for new work is populated when a milestone roadmap is created.

**Coverage:**
- v1 requirements: 30 total
- Status: all Complete (shipped baseline)
- Mapped to forward phases: n/a (baseline)

---
*Requirements defined: 2026-06-14*
*Last updated: 2026-06-14 after initialization (baseline snapshot)*
