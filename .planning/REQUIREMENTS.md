# Requirements: SweatPact v1.2

**Defined:** 2026-06-20
**Core Value:** Make showing up have a consequence — if you skip, you owe your partner.

## v1.2 Requirements

### Analytics Foundation

- [ ] **FOUND-01**: PostHog JS SDK initialized in `instrumentation-client.ts` with `capture_pageview: false` and autocapture off; manual `$pageview` fired on route change from a `PostHogPageview` client component in root layout
- [ ] **FOUND-02**: `identify()` called on login with Supabase user ID so all subsequent events are attributed to the correct user
- [ ] **FOUND-03**: Typed event catalog in `src/lib/analytics/events.ts` defines all event names as constants with `category:object_action` naming convention before any events are written
- [ ] **FOUND-04**: PostHog ingestion reverse-proxied through `/ingest` rewrites in `next.config.mjs`; `/ingest` excluded from middleware matcher; PWA service worker bypasses the proxy path
- [ ] **FOUND-05**: Vercel Node.js runtime upgraded to 20.20+ to satisfy `posthog-node@5` peer dependency

### Event Instrumentation

- [ ] **INSTR-01**: Onboarding walkthrough step events tracked server-side on each `complete_step` PATCH — each step ID is captured as a distinct event so funnel drop-off is measurable per step (delivers ANL-01 and ANL-02 deferred from v1.1)
- [ ] **INSTR-02**: Check-in events captured server-side in `api/checkin` route with outcome (verified / unverified / geo-fail) and method (shortcut / manual) as properties
- [ ] **INSTR-03**: Pact lifecycle events captured on existing API routes — challenge created, invite accepted, invite declined, member left
- [ ] **INSTR-04**: Financial events captured server-side — penalty issued and settlement recorded — emitted from `cron/enforce` with `await posthog.shutdown()` to prevent Vercel flush loss
- [ ] **INSTR-05**: Feature usage events captured client-side — tab visits, notification CTR, Shortcut setup viewed — using typed constants from `events.ts`

### Admin Shell

- [x] **ADMIN-01**: Protected `/admin` route group with separate layout (no tab nav, no TourProvider); `requireOwner()` server function revalidates session via `getUser()` and returns 404 for non-owners; owner identified by env-listed Supabase UUID (`ADMIN_USER_IDS`)
- [ ] **ADMIN-02**: Admin layout uses SweatPact brand tokens (same Tailwind color variables) with a data-dense dashboard-appropriate layout distinct from the tab shell

### Dashboard — Financial & Check-in (Supabase-backed)

- [ ] **DASH-01**: Financial overview card shows active pact count, total stakes on the line, total penalties issued, and settlement completion rate (penalties settled ÷ penalties owed) — all queried directly from Supabase, never from PostHog
- [ ] **DASH-02**: Check-in rate over time chart shows weekly check-in success count, geo-fail count, and manual vs Shortcut split as a trend chart; date range selectable (7d / 30d / 90d presets)
- [ ] **DASH-03**: User overview shows total registered users, users who have completed onboarding, users with at least one active pact, and users who checked in this week

### Dashboard — Product Analytics (PostHog-backed)

- [ ] **DASH-04**: Onboarding funnel view shows step-by-step drop-off across all walkthrough steps using PostHog data; cached with `next: { revalidate }` to respect the 120 req/hr PostHog Query API limit
- [ ] **DASH-05**: Feature adoption panel shows relative usage of key features (tabs visited, notification CTR, Shortcut setup rate, manual vs Shortcut check-in ratio) from PostHog event data
- [ ] **DASH-06**: Engagement & retention panel shows DAU/WAU trend, average streak length, and users who have not checked in for 14+ days (churn signal) from PostHog + Supabase

## Future Requirements

### Alerting & Automation

- **ALRT-01**: Owner receives email or push notification when settlement completion rate drops below threshold
- **ALRT-02**: Automated weekly summary report emailed to owner

### Advanced Analytics

- **ADV-01**: Per-pair analytics view showing individual pact health score and consequence-efficacy (check-in rate with stake vs without)
- **ADV-02**: Cohort analysis — users who completed onboarding vs those who skipped, compared on retention
- **ADV-03**: Real-time dashboard with live event stream (requires PostHog live events or Supabase realtime subscription)
- **ADV-04**: Money coachmark anchored to user's own live numbers (TEACH-07 from v1.1 deferred backlog)

## Out of Scope

| Feature | Reason |
|---------|--------|
| PostHog session replay | Privacy surface for a financial app; adds bundle weight; not worth it at < 50 users |
| PostHog autocapture | Uncontrolled event noise; typed `events.ts` catalog is the correct approach |
| Per-user analytics page in the main app | Admin-only dashboard for this milestone; user-facing stats deferred |
| Re-engagement nudges based on analytics (ANL-02) | Infrastructure for the data comes first; nudge delivery is separate feature |
| Multi-admin / role-based admin access | Env allow-list is correct for single owner; DB role column when a second admin is ever needed |
| Analytics for cycle tracking events | Low business relevance; not a financial-accountability metric |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 7 | Pending |
| FOUND-02 | Phase 7 | Pending |
| FOUND-03 | Phase 7 | Pending |
| FOUND-04 | Phase 7 | Pending |
| FOUND-05 | Phase 7 | Pending |
| INSTR-01 | Phase 8 | Pending |
| INSTR-02 | Phase 8 | Pending |
| INSTR-03 | Phase 8 | Pending |
| INSTR-04 | Phase 8 | Pending |
| INSTR-05 | Phase 8 | Pending |
| ADMIN-01 | Phase 9 | Complete |
| ADMIN-02 | Phase 9 | Pending |
| DASH-01 | Phase 9 | Pending |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| DASH-05 | Phase 9 | Pending |
| DASH-06 | Phase 9 | Pending |

**Coverage:**

- v1.2 requirements: 18 total
- Mapped to phases: 18 ✓
- Unmapped: 0

**Phase distribution:**

- Phase 7 (Analytics Foundation): FOUND-01..05 (5)
- Phase 8 (Event Instrumentation): INSTR-01..05 (5)
- Phase 9 (Admin Dashboard): ADMIN-01, ADMIN-02, DASH-01..06 (8)

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 — roadmapped to Phases 7–10, 18/18 requirements mapped*
