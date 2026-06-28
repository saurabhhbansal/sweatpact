# Feature Research

**Domain:** Product analytics instrumentation + owner-only admin dashboard for a peer financial-stakes gym accountability app (SweatPact v1.2)
**Researched:** 2026-06-20
**Confidence:** MEDIUM (PostHog conventions/integration are MEDIUM, verified against official PostHog docs; metric benchmarks and stakes-app economics are LOW, single-source web aggregations — directionally useful, not authoritative)

> Note: a prior FEATURES.md in this slot covered the v1.1 onboarding milestone. This file replaces it for the v1.2 Analytics & Admin Dashboard milestone.

## Scope Framing

This research answers two coupled questions: **what events to instrument** (so the data exists) and **what dashboard views matter** (so the data is useful). It is scoped to a *peer financial-stakes accountability product*, not generic SaaS. The single most important framing: SweatPact's core value is "if you skip, you owe your partner." Analytics must make the **stake-and-settlement loop** observable above all else — most apps measure engagement; this one must measure whether the financial consequence actually fires and whether it changes behavior.

It does NOT re-research existing app features (check-ins, pacts, settlement, onboarding, push, cycle, groups) — those are the *subjects* being instrumented, not the work.

## Feature Landscape

### Table Stakes (Users Expect These)

The "user" of this milestone is the product owner viewing `/admin`. These are the events and views without which the dashboard is incomplete or misleading.

#### A. Event Instrumentation (ANL-01, ANL-02)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PostHog client init + `identify()` on auth | Every event is useless if not tied to a stable user; anonymous-only data can't compute retention/funnels | LOW | `posthog-js` via `PostHogProvider` in `(tabs)` layout; call `identify(userId)` after `supabase.auth.getUser()`. Use a **reverse proxy** (`next.config.mjs` rewrites) so ad-blockers don't drop events. |
| Onboarding walkthrough step events (ANL-02) | ANL-02 explicitly requires step-by-step drop-off with REQ-IDs; existing `onboarding_progress` table already holds the data model | LOW | One event per coachmark step + skip/dismiss/complete. Carry `tour_version` and `step_id` as properties. Mirroring from the `onboarding_progress` PATCH server-side is more reliable than client-only. |
| Check-in events (success + geo-fail) | Check-in is the core action; the funnel and the financial loop both start here | MEDIUM | **Must be server-side** (`posthog-node`) from `/api/checkin` so geo-fails and Shortcut-vs-manual are captured even when no browser is open. Properties: `method` (shortcut/manual), `is_geo_verified`, `distance_m`. |
| Pact lifecycle events | Created / accepted / declined / cancelled / completed — the funnel that precedes any money | MEDIUM | Server-side from the relevant routes. Attach a `pact_id` group (PostHog group analytics). |
| Financial/settlement events | Penalty computed, settlement recorded, dispute raised/resolved — the consequence loop, the core value | MEDIUM | **Server-authoritative only** (`posthog-node` from cron + dispute routes). Clients must never emit these (matches existing "clients cannot forge verified status" constraint). |
| Consistent event taxonomy | Without a naming convention data becomes unqueryable within weeks | LOW | See "Event Naming Schema" below. Define a fixed event-name + property constants module in `src/lib/analytics/`. |

#### B. Admin Dashboard Views (ADMIN-01…06)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Owner-only access gate (ADMIN-01) | Dashboard exposes aggregate financial + user data; must not leak | MEDIUM | Owner check at route/layout level + RLS posture. Reuse privilege-scoped admin client server-side only. Separate `/admin` layout — PROJECT.md says SweatPact-branded, **not** corporate-SaaS gray. |
| Onboarding funnel viz (ADMIN-02) | Direct requirement; reveals where new users abandon before first stake | MEDIUM | PostHog funnel insight (signup → username → gym set → first pact → first check-in). Embed PostHog or query own `onboarding_progress` for step counts. |
| Check-in rate over time (ADMIN-03) | The heartbeat metric; weekly trend + geo-fail rate surfaces Shortcut breakage | MEDIUM | Time-series of check-ins/week, split success vs geo-fail. Own Postgres (`check_in` rows) is the source of truth here, not PostHog. |
| Financial & pact overview (ADMIN-04) | The core-value scoreboard: active pacts, avg stake, penalties, settlement rate | MEDIUM | **Query own Postgres**, not PostHog — money must come from the authoritative ledger, not the event stream. See "Financial Metrics" below. |
| Feature adoption stats (ADMIN-05) | Tab usage, notification CTR, Shortcut-vs-manual ratio — guides where to invest | LOW–MEDIUM | PostHog is the natural home (event counts / breakdowns). |
| Engagement & retention (ADMIN-06) | DAU/WAU, streak lengths, churn — is the habit forming? | MEDIUM | PostHog retention/stickiness insights; streaks from own data. |

### Differentiators (Competitive Advantage — analytics that fit *this* product, not generic SaaS)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Stake-loop integrity metric** | "% of owed penalties that actually settled" — measures whether the *one thing that must work* works. No SaaS dashboard has this. | MEDIUM | Settlement completion rate = settled / (penalties owed). Surfaces orphaned/partial financial ops (a known CONCERNS.md risk). |
| **Consequence efficacy / behavior lift** | Compare check-in rate of users *with* an active stake vs without (StickK's 78%-vs-35% claim is the whole product thesis) | MEDIUM | Cohort split in PostHog on a `has_active_stake` person property. Directly validates Core Value. |
| **Pair health metric** | Track the *pair*, not just the user — a 1v1 product churns when either partner drops. "Pacts where both partners checked in this week." | MEDIUM | PostHog **group analytics** keyed on `pact_id`/`group_id`. This is the differentiator vs treating each user independently. |
| **Geo-fail / Shortcut breakage alarm** | iOS Shortcut is fragile; a geo-fail spike = silent product outage that suppresses check-ins (and unfairly triggers penalties) | LOW | Capturable from check-in events; just a threshold view. High operational value. |
| **Penalty fairness / dispute rate** | Disputes-per-settlement trending up = the verification model is misfiring; protects trust in the money loop | LOW | From existing dispute routes. |
| **Activation = "first real stake"** | Define activation as *first pact with money on the line*, not signup. Matches PROJECT.md: "first session ends with a real stake." | LOW | One well-chosen activation event reframes the whole funnel. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Reading money figures **from the PostHog event stream** | "We already send events, just sum them" | Events get dropped (ad-blockers, network), duplicated, or arrive out of order — never trust an analytics pipe for a financial ledger | Query own Postgres for all $ figures; PostHog only for behavioral/funnel data |
| Rebuilding funnels/retention/cohorts as **custom SQL widgets** | "Get it all on one branded page" | This is exactly what PostHog does well for free; re-implementing cohort retention by hand is high-effort and bug-prone | Build custom widgets only for the **financial ledger**; embed/link PostHog for funnels/retention/cohorts |
| `posthog.capture(\`checkin_${method}\`)` dynamic event names | Feels convenient | Creates thousands of unique event names; breaks all aggregation | Fixed name + property: `capture('checkin_create', { method })` |
| Client-side capture of financial events | Simpler, no server wiring | Clients can forge/suppress them — violates the server-authoritative constraint | `posthog-node` from API routes / cron only |
| Autocapture-everything, sort it out later | "Capture all, decide later" | Noisy, PII-risky, balloons event volume/cost, no taxonomy | Curated manual events for the ~6 product moments; autocapture optional for pageviews only |
| Corporate-SaaS metric-card grid dashboard | It's the default look | Explicitly Out-of-Scope in PROJECT.md ("zero personality, against design principles") | SweatPact-branded, consequence-first layout; lead with the money scoreboard |
| Real-time live dashboard | "Cool to watch" | Owner-only internal tool; real-time adds infra cost for zero decision value | Daily/periodic aggregation; the cron already runs daily |
| Per-user PII dumped into analytics props | "More data is better" | Privacy/compliance risk; bloats events | Send stable IDs + non-PII attributes only; let `identify()` join the rest |

## Event Naming Schema (PostHog `category:object_action`)

Follows PostHog's official convention: **lowercase, snake_case, present-tense verbs from a fixed allowed list, event names as fixed string constants (never interpolated).** Define these as constants in `src/lib/analytics/events.ts`.

**Allowed verbs:** `view, click, submit, create, accept, decline, cancel, complete, skip, dismiss, fail, settle, dispute, send, invite`.

| Category | Example events | Side | Key properties |
|----------|----------------|------|----------------|
| `onboarding` | `onboarding:step_view`, `:step_complete`, `:step_skip`, `:walkthrough_complete`, `:walkthrough_dismiss` | server (mirror PATCH) | `step_id`, `tour_version`, `entry_path` (self/invited) |
| `pact` | `pact:invite_send`, `:invite_accept`, `:invite_decline`, `:create`, `:cancel`, `:complete` | server | `pact_id`, `stake_amount`, `weekly_goal` |
| `checkin` | `checkin:create`, `checkin:fail` | server | `method` (shortcut/manual), `is_geo_verified`, `distance_m`, `local_day` |
| `money` | `money:penalty_create`, `:settlement_settle`, `:dispute_raise`, `:dispute_resolve` | server (cron/routes) | `pact_id`, `amount`, `resolution` (uphold/void) |
| `feature` | `feature:tab_view`, `:notification_click`, `:shortcut_setup_complete` | client | `tab_name`, `notification_type` |

**Properties convention:** `object_adjective` (`stake_amount`, `member_count`); boolean `is_`/`has_` prefixes (`is_geo_verified`, `has_active_stake`). Set `has_active_stake` as a **person property** so cohorts can split on it.

## Financial Metrics (specific to a peer financial-stakes product, NOT generic SaaS)

Generic SaaS tracks MRR/ARR/LTV/CAC. SweatPact takes no revenue cut in the core loop — money flows *between partners*. The metrics that matter are whether the consequence loop fires and is fair. **All sourced from the own Postgres ledger, never the event stream.**

| Metric | Definition | Why it matters here |
|--------|------------|---------------------|
| **Active pacts** | Pacts currently live with a stake | The denominator for everything; product liveness |
| **Total $ at stake** | Sum of stake on active pacts | The "skin in the game" the thesis rests on (StickK headline: $69M+ staked) |
| **Average stake size** | Mean stake per active pact | Are people raising the price of failure (engagement) or playing it safe? |
| **Penalties levied / week** | Count + $ of missed-goal penalties computed by cron | Is the consequence actually firing? |
| **Settlement completion rate** | settled / (penalties owed) | **The integrity metric.** <100% = orphaned financial ops (a flagged CONCERNS.md risk). The one number the owner must watch. |
| **Forfeit / skip rate** | % of weeks a member misses goal and owes | Behavioral health; inverse of goal-success rate (StickK: 78% success w/ stakes) |
| **Dispute rate** | disputes / settlements; uphold-vs-void split | Verification fairness; trust in the money loop |
| **Consequence efficacy** | check-in rate with active stake vs without | Validates Core Value directly (PostHog cohort) |

## Engagement & Retention Metrics (how to read them for *this* domain)

| Metric | Domain benchmark (LOW-confidence, web) | SweatPact lens |
|--------|----------------------------------------|----------------|
| Stickiness (DAU/MAU) | ~37% all-industry avg; 20–30% "good" for fitness | A pact creates a *weekly* obligation cadence — WAU/MAU may matter more than DAU/MAU here |
| Retention D1/D7/D30 | ~30–35% / ~15–20% / ~8–12% for fitness | Strongest churn signal: <3 workouts in first 14 days → 3–4× churn. Watch the first-2-weeks check-in count. |
| Activation | 26% D1 → 10% D28 for fitness | Redefine as "first real stake," not signup — activation should *lead* retention here |
| North Star | weekly-cohort retention tied to habit formation | Candidate NSM: **% of active pairs where both partners hit goal this week** (pair-level habit) |
| Seasonality | fitness has the biggest seasonal swing (Jan spike) | Compare cohort-over-cohort within the same quarter; annual numbers hide the swing |

## PostHog vs. Custom Dashboard — When Custom Adds Value

PostHog's free tier already gives funnels, retention, stickiness (DAU/MAU), cohorts, trends, and HogQL/SQL. **Re-implementing those by hand is the anti-feature.** The custom `/admin` dashboard earns its keep only where PostHog is the wrong tool.

| Use PostHog (free, built-in) | Build Custom in `/admin` |
|------------------------------|--------------------------|
| Onboarding funnel (ADMIN-02) | Financial & pact overview (ADMIN-04) — money must come from the Postgres ledger |
| Retention / DAU-WAU / churn (ADMIN-06) | Settlement integrity / dispute views |
| Feature adoption breakdowns (ADMIN-05) | Anything mixing $ ledger + behavioral context on one branded screen |
| Cohort splits (consequence efficacy) | Check-in rate + geo-fail trend (ADMIN-03), if branded alongside money |

**Decision rule:** PostHog owns *behavioral* questions (who did what, in what order, did they return). The custom dashboard owns *financial truth* and the SweatPact-branded operator view. Pragmatic v1.2 path: build custom widgets for ADMIN-04 (and optionally ADMIN-03) from Postgres; satisfy ADMIN-02/05/06 by **embedding PostHog insights or linking to a PostHog dashboard** rather than rebuilding cohort math. Custom-rebuilding retention/funnels is overkill.

## Feature Dependencies

```
PostHog client init + identify()
    └──requires──> Reverse proxy (next.config rewrites)   [for reliable client events]

Server-side capture (posthog-node)
    └──requires──> nothing new; wired into existing API routes + cron

Onboarding funnel viz (ADMIN-02)
    └──requires──> onboarding step events (ANL-02)
                       └──requires──> identify() (to dedupe users in funnel)

Financial overview (ADMIN-04)
    └──requires──> own Postgres ledger queries (NOT money events)
    └──enhanced-by──> money:* events (trend/timing context only)

Consequence-efficacy cohort
    └──requires──> has_active_stake person property + checkin events

All ADMIN-* views
    └──requires──> Owner-only gate (ADMIN-01)   [build first]

Pair-health metric ──requires──> PostHog group analytics (pact_id/group_id groups)
```

### Dependency Notes

- **ADMIN-01 (owner gate) must come first:** every dashboard view depends on it; do not expose any aggregate before the gate exists.
- **`identify()` before funnels:** PostHog can't compute a clean funnel/retention without stable identity; this is the foundational instrumentation task.
- **Financial views depend on Postgres, not events:** wiring `money:*` events does *not* unblock ADMIN-04 — it needs ledger queries. Events add only timing/trend context.
- **Server-side capture conflicts with client-only capture for money:** never emit financial events from the browser.

## MVP Definition

### Launch With (v1.2)

- [ ] PostHog init + `identify()` + reverse proxy — foundational; nothing works without identity.
- [ ] Server-side capture (`posthog-node`) for checkin, pact, money events — the loop that defines the product.
- [ ] Onboarding step events (ANL-02) — explicit requirement with REQ-IDs.
- [ ] Event taxonomy constants module — prevents data rot from day one.
- [ ] Owner-only `/admin` gate (ADMIN-01) — security prerequisite for everything else.
- [ ] Financial & pact overview from Postgres (ADMIN-04) incl. **settlement completion rate** — the core-value scoreboard.
- [ ] Check-in rate + geo-fail trend (ADMIN-03) — heartbeat + outage detector.
- [ ] Onboarding funnel (ADMIN-02) — embed/link PostHog rather than rebuild.

### Add After Validation (v1.x)

- [ ] Engagement & retention views (ADMIN-06) — once enough cohort data accumulates to be non-noisy.
- [ ] Feature adoption stats (ADMIN-05) — once tab/notification events have run a few weeks.
- [ ] Consequence-efficacy cohort (stake vs no-stake) — needs `has_active_stake` history.
- [ ] Pair-health (group analytics) view — higher instrumentation cost; add when 1v1 churn becomes a question.

### Future Consideration (v2+)

- [ ] Alerting on geo-fail spikes / settlement-rate drops — operational maturity, not launch-critical.
- [ ] Self-serve per-pair analytics surfaced to end users — different product surface; defer until owner view is proven.

## Feature Prioritization Matrix

| Feature | Owner Value | Implementation Cost | Priority |
|---------|-------------|---------------------|----------|
| PostHog init + identify + proxy | HIGH | LOW | P1 |
| Server-side financial/checkin/pact events | HIGH | MEDIUM | P1 |
| Owner-only gate (ADMIN-01) | HIGH | MEDIUM | P1 |
| Financial overview + settlement rate (ADMIN-04) | HIGH | MEDIUM | P1 |
| Check-in rate + geo-fail (ADMIN-03) | HIGH | MEDIUM | P1 |
| Onboarding events + funnel (ANL-02/ADMIN-02) | MEDIUM | LOW–MEDIUM | P1 |
| Event taxonomy module | HIGH | LOW | P1 |
| Retention/engagement (ADMIN-06) | MEDIUM | MEDIUM | P2 |
| Feature adoption (ADMIN-05) | MEDIUM | LOW | P2 |
| Consequence-efficacy cohort | HIGH | MEDIUM | P2 |
| Pair-health group analytics | MEDIUM | MEDIUM | P3 |
| Alerting | MEDIUM | MEDIUM | P3 |

**Priority key:** P1 must-have for this milestone · P2 add when possible · P3 future.

## Competitor Feature Analysis

| Feature | StickK | Beeminder | SweatPact Approach |
|---------|--------|-----------|--------------------|
| Stake verification | Human referee | Auto-charge on derailed data | Server geo-verification (already built) — instrument geo-fail rate as a first-class metric |
| Headline metric | $ at stake, contracts created, 78% success | Pledge escalation / derail count | Settlement completion rate + consequence efficacy (stake vs no-stake) |
| Social structure | Referee + anti-charity | Solo + Beeminder as counterparty | **1v1 pair** — needs pair-health (group) analytics no competitor surfaces |
| Forfeit destination | charity/anti-charity/friend/StickK | Beeminder keeps it | Partner-to-partner — track inter-pair flow, not platform revenue |

## Open Questions (for requirements/design)

- **Where the "settlement completion rate" denominator lives:** confirm the schema makes "penalties owed" cleanly queryable so the integrity metric is computable (ties to the orphaned-records CONCERNS.md risk).
- **PostHog plan / event volume:** confirm free-tier event ceiling vs expected volume once server-side capture is on (every check-in + cron settlement emits).
- **Embed vs rebuild for ADMIN-02/05/06:** decide early whether PostHog insights are embedded (iframe/shared insight) or linked, to scope the custom dashboard correctly.
- **Owner identification mechanism:** how "owner" is determined for ADMIN-01 (env-listed user id vs a role column) — affects the gate implementation.

## Sources

- [PostHog — Product analytics best practices](https://posthog.com/docs/product-analytics/best-practices) (MEDIUM, official — naming/taxonomy)
- [PostHog — Next.js integration](https://posthog.com/docs/libraries/next-js) and [Next.js reverse proxy](https://posthog.com/docs/advanced/proxy/nextjs) (MEDIUM, official)
- [PostHog — Custom dashboards](https://posthog.com/dashboards) / [Vision Labs — custom dashboard with PostHog endpoints](https://visionlabs.com/academy/posthog/endpoints/) (MEDIUM/LOW)
- [Adapty — North Star Metric guide](https://adapty.io/blog/north-star-metric/), [Reforge — North Star Metrics](https://www.reforge.com/blog/north-star-metrics) (LOW)
- [Adapty — DAU/WAU/MAU](https://adapty.io/blog/dau-wau-mau-active-users/), [Business of Apps — Health & Fitness benchmarks](https://www.businessofapps.com/data/health-fitness-app-benchmarks/), [RetentionCheck — fitness churn](https://retentioncheck.com/churn-benchmarks/fitness-apps), [SportFitnessApps — behavior metrics](https://sportfitnessapps.com/blog/top-7-user-behavior-metrics-for-fitness-apps/) (LOW, single-source benchmarks)
- [StickK FAQ — Commitment Contracts/Stakes](https://www.stickk.com/faq/stakes/Commitment+Contracts), [Beeminder — competitors](https://blog.beeminder.com/competitors/), [Beeminder vs StickK](https://help.beeminder.com/article/49-why-should-i-use-beeminder-over-stickk) (LOW)

---
*Feature research for: analytics instrumentation + financial-stakes admin dashboard (SweatPact v1.2)*
*Researched: 2026-06-20*
