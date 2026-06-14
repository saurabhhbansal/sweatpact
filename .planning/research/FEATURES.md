# Feature Research

**Domain:** Interactive in-app onboarding / first-run walkthrough for SweatPact (gym-accountability stakes PWA)
**Researched:** 2026-06-14
**Confidence:** HIGH (well-aligned, consistent guidance across multiple onboarding-platform vendors and UX research sources; MEDIUM where SweatPact-specific because no direct competitor onboarding teardown exists)

## Scope Framing

This research covers ONLY the v1.1 guided-onboarding feature: how best-in-class first-run experiences work and what makes them feel light. It does NOT re-research SweatPact's existing app features (auth, GPS check-ins, challenges, money, Shortcut) — those are the *subjects* the tour teaches, not the tour itself.

SweatPact's four teaching targets ("aha moments") are the spine of every recommendation below:
1. **Set gym** — prerequisite for any check-in to verify (the first real blocker).
2. **Start a stakes challenge** — the product's core value (head-to-head money on the line). This is the primary aha moment: *"I have a real pact with a real person and real money at risk."*
3. **The money model** — earned / owed / penalties / settlement. Conceptual, not a setup action.
4. **iOS Shortcut integration** — the frictionless check-in mechanism (optional, platform-specific).

Critical strategic finding from the research: **the activation event and the aha moment must be one and the same action.** For SweatPact, activation ≈ *first live stakes challenge created/accepted*. Everything in the tour should funnel toward that, and secondary setup (gym, Shortcut) should be completed *because the challenge requires it*, not as standalone busywork.

## The Pattern Decision (which onboarding model to use)

The question implicitly asks us to choose between four archetypes. Research verdict, mapped to SweatPact:

| Pattern | What it is | Fit for SweatPact | Verdict |
|---------|-----------|-------------------|---------|
| **Coachmark / spotlight tour** | Sequenced tooltips anchored to live UI, dimmed background spotlight | Strong for *teaching where things live* on the real `(tabs)` UI; matches the milestone brief | **USE — as the teaching layer**, but contextual/just-in-time, never all-at-once |
| **Getting-started checklist** | Persistent list of setup tasks, each links to a real action, tracks % complete | Strong for *resumability, deferred optional setup, and "skip already-done"* — naturally models "gym ☐ / challenge ☐ / Shortcut ☐" | **USE — as the spine / progress model** |
| **Empty-state teaching** | The blank screen itself instructs + provides the primary CTA | Strong, low-cost, never feels like a "tutorial" — the dashboard with no challenge IS the prompt to start one | **USE — as the entry point and fallback** |
| **Interactive sandbox / demo data** | Fake data to play with before committing | Wrong for a *money* product — fake stakes undermine the "real consequence" brand and create a throwaway state | **AVOID** (see anti-features) |

**Recommended composite:** A **checklist-backed, empty-state-anchored, contextual-coachmark** walkthrough. The checklist is the resumable state machine; empty states are where teaching naturally surfaces; coachmarks fire just-in-time on the relevant screen. This is exactly the "tour + checklist as soft bumper" model the research repeatedly endorses ([Appcues](https://www.appcues.com/blog/product-tours-walkthroughs-ultimate-guide), [Userpilot](https://userpilot.com/blog/interactive-walkthroughs-improve-onboarding/)).

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = the tour fails its job or actively annoys.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Minimal mandatory start (bare identity only)** | Friction before value is the #1 drop-off driver; users hit with forms before seeing the app "feel like filling out a job application" | LOW | Username only (availability check already exists). Everything else deferred. Gets user into real `(tabs)` UI immediately. |
| **Always-visible, one-tap Skip / Dismiss** | ~70% skip tours that feel imposed; forcing the tour breeds resentment and is the fastest way to feel "corporate/cumbersome" | LOW | Skip must be obvious on every step, not buried. Skipping must NOT lose progress (resume later). |
| **Contextual / just-in-time coachmarks (one at a time)** | Showing all coach marks at once overwhelms; completion drops ~60% past 3–4 simultaneous choices; tooltips dismissed in <3s when irrelevant | MEDIUM | Anchor each coachmark to the live element on the screen it concerns. Fire when the user is on that screen, not in a pre-canned slideshow. Depends on stable anchor targets in `(tabs)` UI. |
| **Outcome-framed copy, not feature-framed** | "Users don't want to learn your product — they want to use it." Feature-tours teach mechanics; users care about results | LOW | "Put $X on this week" not "This is the challenge tab." Lean into brand voice ("stakes, not stats"). |
| **Server-persisted progress (resume after interruption)** | Users abandon mid-flow across sessions/devices; a PWA reload must not restart the tour | MEDIUM | Persist step/checklist state per user (Postgres + RLS, matches existing stack). Resume exactly where left off. This is the milestone's explicit requirement. |
| **Skip already-completed steps** | A returning/partially-set-up user re-shown done steps feels broken and patronizing | MEDIUM | Tour state must read *actual* app state (gym set? challenge exists? Shortcut secret used?) and auto-check those, not just its own flags. Derive completion from real data, not a duplicate flag, to avoid drift. |
| **Step-by-step real actions (not passive tooltips)** | Walkthroughs that prompt the action reach the aha moment far more than tooltips that only describe | MEDIUM | Each setup coachmark ends in the user *doing the real thing* (picking a gym via existing Places search, creating a real challenge). No "Got it" dead-ends. |
| **Clear progress indicator** | Zeigarnik / endowed-progress effect: visible "2 of 4" or % drives completion; platforms see up to ~50% higher completion with progress UI | LOW | A 4-item checklist (gym, challenge, money-understood, Shortcut) with checkmarks. Pre-check anything already true to seed endowed progress. |
| **Replay from settings** | Users expect to revisit; a one-shot tour that can never be seen again generates support load | LOW | "Replay walkthrough" entry in settings/profile. Re-runs the checklist; already-done steps show complete. |
| **Graceful platform handling for iOS Shortcut step** | Shortcut is iOS-only; showing it as a hard requirement on Android/desktop breaks the flow | LOW–MEDIUM | Make Shortcut step optional/conditional. Offer manual check-in as the universal path so non-iOS users still complete activation. |

### Differentiators (Competitive Advantage)

These make SweatPact's onboarding *notably* good and reinforce the brand.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Activation = first real stakes challenge (the tour's single north star)** | Collapses "onboarding" into "do the one thing that is the whole product." The aha moment IS the activation event — research's strongest predictor of retention | MEDIUM | Sequence everything to funnel toward creating/accepting a live 1v1 challenge with real money. Gym + Shortcut are completed *as prerequisites surfaced by* this goal, not as separate chores. |
| **Setup-as-side-effect ("just-in-time prerequisites")** | Instead of "set up gym, then schedule, then Shortcut, then challenge," the challenge flow *asks for* gym/goal at the moment they're needed — deferred optional setup completed in-context | MEDIUM–HIGH | When user starts a challenge with no gym, the coachmark routes them to the existing gym picker inline, then returns them to the challenge. Reuses existing flows; the *orchestration* is the new work. |
| **Brand-voiced consequence framing in coachmarks** | "Light, not cumbersome" is largely a *copy + tone* problem. Sharp, competitive, consequence-first microcopy makes the tour feel like part of the product, not a manual | LOW | e.g. money-model coachmark: "Miss a day, your partner gets paid. Here's the scoreboard." Tone is the cheapest differentiator and directly addresses the "don't feel like a corporate tutorial" mandate. |
| **Money-model taught via the user's own live numbers** | The one purely-conceptual teaching point (earned/owed/penalties/settlement) lands far harder when anchored to the user's real challenge stake than to abstract explanation | MEDIUM | After the challenge is created, a coachmark on the real settlement/stakes UI explains the four terms against the actual $ at risk. "Show, don't tell" applied to a concept. |
| **Self-healing "skip already done" via derived state** | Because completion is read from real app state, a user who set their gym in a previous session, or whose partner created the challenge, is never re-prompted — the tour always reflects reality | MEDIUM | Stronger than typical checklist apps that track their own flags and drift. Leverages SweatPact's server-authoritative model. |
| **Empty-state CTAs that double as tour entry points** | The dashboard with no active challenge shows "Start your first pact" — teaching with zero modal overhead; explorers and tour-takers converge on the same action | LOW–MEDIUM | Cheapest, least-intrusive teaching surface. Works even if the user dismissed the coachmark tour. |
| **Celebratory completion moment on first challenge live** | A small, on-brand "pact is live, money's on the line" confirmation marks the aha moment and the tour's end — satisfaction spike that reinforces the core loop | LOW | Keep it sharp/competitive, not confetti-cute. Marks tour complete server-side. |

### Anti-Features (Commonly Requested, Often Problematic)

These are the patterns that make onboarding cumbersome and drive the documented drop-off. Each is an explicit "do not build."

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Front-loaded multi-step setup wizard before app access** | "Get everything configured up front" feels tidy | This is the *exact thing v1.1 is replacing*. Friction-before-value is the top drop-off cause; users abandon before seeing any payoff | Minimal mandatory start + deferred in-context setup |
| **Linear all-screens slideshow / carousel tour at first launch** | "Show them everything the app does" | Decision/cognitive overload; ~70% skip imposed tours; 76% of tooltips dismissed in <3s; teaches mechanics nobody retains | Contextual, one-coachmark-at-a-time, fired just-in-time on the relevant screen |
| **"Maybe later" / soft-dismiss everywhere** | Seems polite, gives users an out | "Maybe later" is the most expensive button in SaaS onboarding — it trains users to ignore prompts and creates a permanent limbo state | One clear Skip that *defers cleanly* with a single obvious resume path (checklist + settings), not repeated nagging |
| **Demo / sandbox / fake-stakes mode** | "Let them try risk-free first" | Fatal for a *real-money consequence* product — fake stakes contradict the entire "consequence-first" brand and create a throwaway, low-trust state | Real first challenge, optionally with a small/self-set stake; the stakes are the point |
| **Blocking modal that traps the user until tour completes** | "Make sure they learn it" | Forced tours breed resentment and spike month-2 support tickets from users who rage-clicked through without absorbing anything | Non-blocking coachmarks over the live UI; user can act or skip at any step |
| **Gamified badges / streaks / points for finishing the tour** | "Gamification boosts completion" | Cutesy badge gamification clashes hard with the sharp, competitive, money-on-the-line identity; rewards finishing a *tutorial* instead of the real behavior | Use the *real* scoreboard/stakes as the reward; the money model IS the gamification |
| **Re-explaining steps the user already completed** | Simpler to always run the full sequence | Patronizing; makes returning/partially-onboarded users feel the product is broken | Derive completion from real state; auto-skip and show as done |
| **Tooltips that only say "Got it" with no action** | Cheap to build, "covers" the feature | Passive tooltips don't drive activation; teach mechanics with no behavior change; inflate perceived tour length for zero value | Every teaching step ties to a real action or is folded into an empty-state CTA |
| **Long tours (>4–5 meaningful steps)** | "More teaching is better" | Completion collapses past 3–4 choices; working-memory overload kills motivation | Cap at the four teaching points; bundle/skip aggressively |

## Feature Dependencies

```
Minimal mandatory start (username)
    └──enables──> Entry into live (tabs) UI
                      └──hosts──> Contextual coachmarks (need stable anchor targets)

Server-persisted progress  ──underpins──>  Resume after interruption
                           ──underpins──>  Replay from settings
                           ──underpins──>  Skip already-completed steps

Skip already-completed steps  ──requires──>  Derived completion from real app state
                                              (gym set? challenge exists? shortcut used?)

Activation = first stakes challenge  ──requires──>  Gym set (geo-verification prerequisite)
                                     ──surfaces──>   Money-model teaching (needs a live stake to anchor to)
                                     ──optionally requires──> iOS Shortcut (else manual check-in fallback)

Setup-as-side-effect orchestration  ──depends on──>  Existing gym picker / schedule / Shortcut flows (reuse, don't rebuild)

Empty-state CTAs  ──reinforces/back-up for──>  Contextual coachmark tour (independent fallback path)
```

### Dependency Notes

- **Activation requires gym set:** A challenge whose check-ins can't geo-verify is hollow. The tour must ensure gym is set before (or as part of) the first challenge — this is the natural "just-in-time prerequisite" hook.
- **Money-model teaching depends on a live challenge:** Teaching earned/owed/penalties/settlement is dramatically more effective anchored to the user's real stake, so this teaching point should fire *after* challenge creation, not before. This fixes the tour ordering: identity → gym → challenge → money → (Shortcut/manual check-in).
- **Skip-already-done requires derived state, not duplicate flags:** Reading real app state (vs. a separate onboarding flag) is the dependency that makes self-healing skip possible and prevents drift — but it couples the tour to current data shapes, so anchor/selector stability is a real maintenance dependency.
- **iOS Shortcut conflicts with platform universality:** Shortcut is iOS-only; it must be a conditional/optional branch with manual check-in as the universal fallback so non-iOS users still reach activation.
- **Coachmarks depend on stable UI anchors:** Just-in-time coachmarks bind to live `(tabs)` elements; UI refactors can silently break anchors. Tour steps need resilient targeting (stable test ids/data attributes) — a known cost of contextual tours.

## MVP Definition

### Launch With (v1.1)

The minimum that replaces the front-loaded flow and lands the four teaching points without feeling like a tutorial.

- [ ] **Minimal mandatory start (username only)** — kills friction-before-value; the core thesis of the milestone.
- [ ] **Server-persisted tour/checklist progress** — required for resume + replay + skip-done; everything else builds on it.
- [ ] **Skip-already-completed via derived real state** — prevents the patronizing-loop failure mode.
- [ ] **Contextual one-at-a-time coachmarks on the four teaching points** — gym, start-a-challenge, money model, Shortcut; outcome-framed, brand-voiced.
- [ ] **Every setup step ties to a real action** — gym picker, real challenge creation, real Shortcut setup; no passive "Got it" tooltips.
- [ ] **Always-available single Skip that defers cleanly** — no "maybe later" nag loop.
- [ ] **4-item progress checklist + replay-from-settings entry** — the resumable spine and the re-entry point.
- [ ] **Empty-state CTA on the dashboard ("start your first pact")** — low-cost teaching + fallback for users who skip the coachmarks.
- [ ] **iOS Shortcut as conditional/optional step with manual check-in fallback** — keeps non-iOS users able to activate.

### Add After Validation (v1.x)

- [ ] **Celebratory "pact is live" completion moment** — add once core flow converts; sharpen tone with real usage.
- [ ] **Money-model coachmark anchored to the user's own live $ figures** — add after confirming the basic money explanation lands; higher polish.
- [ ] **Per-step drop-off analytics** — instrument which coachmark loses people (trigger for iterating copy/order).

### Future Consideration (v2+)

- [ ] **Adaptive ordering by user role/goal (e.g., partner-invited vs. self-starter)** — defer until there's data showing distinct entry paths matter.
- [ ] **Re-engagement nudges for users who started but never created a challenge** — defer; needs notification-tie-in and risks feeling naggy if rushed.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Minimal mandatory start (username only) | HIGH | LOW | P1 |
| Server-persisted progress (resume/replay) | HIGH | MEDIUM | P1 |
| Skip-already-completed via derived state | HIGH | MEDIUM | P1 |
| Contextual coachmarks (one-at-a-time, 4 points) | HIGH | MEDIUM | P1 |
| Setup steps tied to real actions | HIGH | MEDIUM | P1 |
| Always-available clean Skip | HIGH | LOW | P1 |
| Progress checklist + replay-from-settings | MEDIUM | LOW | P1 |
| Empty-state CTA fallback | MEDIUM | LOW–MEDIUM | P1 |
| iOS Shortcut conditional step + manual fallback | MEDIUM | MEDIUM | P1 |
| Setup-as-side-effect just-in-time orchestration | HIGH | HIGH | P2 |
| Money model anchored to user's own live numbers | HIGH | MEDIUM | P2 |
| Brand-voiced consequence microcopy | MEDIUM | LOW | P2 |
| Celebratory completion moment | LOW–MEDIUM | LOW | P2 |
| Per-step drop-off analytics | MEDIUM | MEDIUM | P3 |
| Adaptive ordering by entry path | MEDIUM | HIGH | P3 |

## Competitor / Pattern Analysis

No direct competitor onboarding teardown exists for "real-money gym pacts," so this maps the dominant *patterns* to SweatPact rather than named rivals.

| Aspect | Heavy/SaaS-default pattern | Light/best-in-class pattern | SweatPact approach |
|--------|---------------------------|-----------------------------|--------------------|
| First screen | Multi-field setup wizard | Bare identity, then real app | Username only, into live `(tabs)` |
| Teaching delivery | All-at-once carousel tour | Just-in-time single coachmarks | Contextual coachmarks on the relevant screen |
| Setup steps | Done up front, separately | Deferred, in-context, as real actions | Gym/goal/Shortcut surfaced as challenge prerequisites |
| Skip | "Maybe later" nag loop | One clean deferrable Skip | Skip + checklist + replay-from-settings |
| Reward | Tour-completion badges | The real outcome/value | The live stakes scoreboard itself |
| Concept teaching (money) | Abstract upfront explainer | Anchored to user's real data | Money model taught against the user's live stake |
| Resumability | One-shot, never returns | Persisted, resumable, replayable | Server-persisted, derived-state, replayable |

## Open Questions (for requirements/design)

- **Exact step order vs. invite-first paths:** If a *partner* creates the challenge and invites the new user, the "start a challenge" aha is experienced as *accept* a challenge. The tour likely needs two entry variants (self-starter vs. invited) — confirm whether v1.1 handles both or defers invited-path polish to v1.x.
- **Where the money-model teaching fires:** Recommended after challenge creation (anchored to real stake), but if a user is invited and accepts, confirm the settlement/stakes UI is populated enough at that moment to anchor the coachmark.
- **Anchor stability strategy:** Contextual coachmarks need durable selectors on `(tabs)` elements. Confirm a convention (stable data attributes) before building, since the existing codebase noted "untyped complex client state in several large components."
- **Definition of "tour complete":** Is completion = all four taught, or = first challenge live? Recommend the latter (activation-aligned), with money/Shortcut teaching allowed to complete asynchronously.

## Sources

- [Appcues — Product tour ultimate guide](https://www.appcues.com/blog/product-tours-walkthroughs-ultimate-guide) (HIGH)
- [Appcues — Aha moment examples](https://www.appcues.com/blog/aha-moment-examples) (HIGH)
- [Appcues — Ultimate guide to product onboarding](https://www.appcues.com/blog/the-ultimate-guide-to-product-onboarding) (HIGH)
- [Userpilot — Interactive walkthroughs improve onboarding](https://userpilot.com/blog/interactive-walkthroughs-improve-onboarding/) (HIGH)
- [Userpilot — Interactive walkthrough vs product tour](https://userpilot.com/blog/interactive-walkthrough-vs-product-tour/) (MEDIUM)
- [Userpilot — Progress bar psychology](https://userpilot.com/blog/progress-bar-psychology/) (HIGH)
- [Userpilot — Onboarding gamification examples](https://userpilot.com/blog/onboarding-gamification/) (MEDIUM)
- [NN/g — Instructional overlays and coach marks for mobile apps](https://www.nngroup.com/articles/mobile-instructional-overlay/) (HIGH)
- [Product Onboarding — Why product tours get skipped](https://productonboarding.com/articles/why-product-tours-get-skipped) (MEDIUM)
- [DNSK — "Maybe later" is the most expensive button](https://dnsk.work/blog/how-one-button-teaches-users-to-ignore-you/) (MEDIUM)
- [Chameleon — Effective product tour metrics](https://www.chameleon.io/blog/effective-product-tour-metrics) (MEDIUM)
- [reloadux — Why users drop off during onboarding](https://reloadux.com/blog/why-users-drop-off-during-onboarding-and-how-to-fix-it/) (MEDIUM)
- [UserGuiding — Onboarding checklists best practices](https://userguiding.com/blog/onboarding-checklists) (MEDIUM)
- [Wikipedia — Zeigarnik effect](https://en.wikipedia.org/wiki/Zeigarnik_effect) (HIGH, for the psychology principle)

---
*Feature research for: interactive onboarding / first-run walkthrough (SweatPact v1.1)*
*Researched: 2026-06-14*
