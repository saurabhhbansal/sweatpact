# Pitfalls Research

**Domain:** Interactive in-app onboarding / coachmark walkthrough added to a Next.js 14 App Router PWA (React 18, Tailwind + Radix/shadcn, Supabase + RLS, installable PWA)
**Researched:** 2026-06-14
**Confidence:** HIGH for codebase-grounded pitfalls (anchoring, z-index/Radix, safe-area, RSC streaming, redirect gate, persistence); MEDIUM for general coachmark-UX pitfalls (cross-checked against tour-library write-ups)

> Scope note: These are mistakes specific to *adding a contextual coachmark tour to SweatPact as it exists today*, not generic onboarding advice. Every pitfall is tied to a concrete fact in the current codebase (the `(tabs)` shell, the z-index stack, the redirect-everywhere onboarding gate, server-persisted `onboarding_complete`) or to a known failure mode of spotlight tours in App Router PWAs.

## Critical Pitfalls

### Pitfall 1: Anchoring coachmarks to elements that aren't mounted yet (RSC streaming + Suspense + async data)

**What goes wrong:**
A coachmark targets an element by CSS selector / id (e.g. the check-in button, the "You owe" ledger card, the gym section) and reads `getBoundingClientRect()` on mount. But in SweatPact the anchor targets live inside Suspense-streamed and `force-dynamic` server content. The `(tabs)/layout.tsx` streams `TopBar`/`BottomBar` behind `<Suspense>` with prop-less nav fallbacks; the dashboard awaits a `Promise.all` of five Supabase queries before its markup exists; the cycle tab only renders for `gender === "female"` after a client fetch in `nav.tsx`. The tour fires before the target paints, so the spotlight lands at `{0,0}`, on the Suspense fallback, or on nothing — an empty highlight in the corner.

**Why it happens:**
Developers test on a warm cache where streaming is instant, so the target appears "synchronously." The race only shows on cold loads, slow networks, or the very first navigation — exactly a new user's first session, which is the only audience this feature has.

**How to avoid:**
- Anchor via **React refs threaded through context**, not global `document.querySelector` selectors. A ref resolves to the real node only once React has committed it, so the tour can wait on it.
- Have each step **wait for its target** (e.g. `ResizeObserver`/`IntersectionObserver` or a ref-presence check with a timeout) before showing; never compute position eagerly on tour start.
- Make the spotlight a function of a *live* rect (observe resize/scroll), not a one-shot measurement.
- If a target genuinely may not exist (cycle tab for male users; ledger card only when debts exist — see dashboard's `totalOwes === 0 && totalOwed === 0` branch), the step must be declared **conditional/skippable**, not assumed present.

**Warning signs:**
Spotlight appears top-left or off-screen; highlight covers the skeleton/`loading.tsx` shell instead of content; works locally but QA on a throttled phone reports "the circle points at nothing."

**Phase to address:**
The coachmark engine/primitive phase (foundations). Ref-based anchoring + target-ready gating must be designed in before any step content is written.

---

### Pitfall 2: Coachmarks anchored to a route's content surviving (or dying) across navigation

**What goes wrong:**
The walkthrough spans tabs — gym lives in settings, the stakes/money story lives on dashboard and `/groups`, the Shortcut step lives on `/shortcut`. When a step says "now tap Challenges" and the user navigates, the previous step's target unmounts. If the tour controller lives *inside* a page (not the persistent layout), it unmounts on navigation and the tour silently dies. If it lives in the layout but keeps pointing at the old route's selector, the spotlight strands on a node that no longer exists, or jumps to a coincidentally-matching selector on the new page.

**Why it happens:**
App Router unmounts page subtrees on navigation but keeps `layout.tsx` mounted (the codebase already relies on this — the nav indicator "glides between tabs" precisely because the nav is in the layout). A tour built as a page-level component doesn't get that persistence for free, and selector-based targeting has no notion of "which route am I on."

**How to avoid:**
- Mount the **tour controller in a persistent shell** (the `(tabs)` layout or root), not inside any single page — mirror exactly how `MobileNav`/`TopNav` are hoisted.
- Bind each step to **both a route and a target**: the step only activates when `usePathname()` matches its expected route AND its ref/target is present. On mismatch, show a "go to X" affordance rather than a stranded spotlight.
- Re-acquire the anchor after navigation (refs re-register on the new page's mount); don't cache a detached DOM node across a route change.
- Drive cross-tab progression by the user's *real* navigation (they tap the real Challenges tab), not by `router.push` inside the tour — this is the whole "let them do real actions" premise.

**Warning signs:**
Tour vanishes after the first tab switch; spotlight points at the wrong element after navigating; "resume" lands you mid-tour but on the wrong screen.

**Phase to address:**
Tour orchestration / cross-screen flow phase. The step model (route + target + condition) is a design decision, not a late patch.

---

### Pitfall 3: z-index and portal conflicts with the existing fixed chrome and Radix dialogs

**What goes wrong:**
SweatPact has a specific, occupied z-stack: `TopNav` is `z-40`, `MobileNav` is `z-50`, Radix `DialogOverlay`/`DialogContent` are `z-50`, `dropdown-menu` portals over that, and the `InstallGate` is `z-[100]` covering everything. A naive spotlight overlay (`fixed inset-0`) will either (a) sit *under* the `z-50` nav so the highlighted check-in button is dimmed but the bottom nav stays bright and tappable, breaking the "focus the user here" illusion; or (b) sit *above* everything including the gym-picker `Dialog` it's trying to teach, so the user can't actually interact with the thing the coachmark points at; or (c) collide with the `z-[100]` install gate so the tour renders behind the install wall on a non-installed browser.

**Why it happens:**
The tour overlay and Radix both use `createPortal` to `document.body` and both fight for the top of the stacking context. Pick one number and something is always wrong, because the requirement is contradictory: the overlay must be *above* the page but *below* the interactive target and any dialog the target opens.

**How to avoid:**
- Treat the spotlight as a **"cutout" overlay, not a blanket**: dim everything via an SVG mask / box-shadow ring around the target's rect, and set `pointer-events: none` on the dim layer while leaving the cutout region click-through to the real element. Do not put an opaque modal between the user and the control they must press.
- Establish an explicit z-index **above the nav (`z-50`) but reconcile with dialogs**: when a step's action opens a Radix `Dialog` (gym picker, schedule), either raise the dialog above the coachmark or pause/hide the coachmark for the dialog's lifetime, then resume. Decide this per step.
- Never show the tour while `InstallGate` is visible (`gateVisible` / not standalone) — gate the tour on `display-mode: standalone` just like the rest of the PWA chrome.
- Reuse the existing `modal={false}` lesson: the codebase already disables Radix scroll-lock on the profile dropdown "to prevent pointer-events:none on <body> when navigating away." A tour that opens dialogs mid-navigation can re-introduce the exact `pointer-events:none` body lock — verify the body is interactive after every step transition.

**Warning signs:**
The highlighted button is visibly dimmed but unclickable; the bottom nav glows through the overlay; opening the gym dialog hides the coachmark permanently; body becomes unscrollable / unclickable after a step that opened then closed a dialog.

**Phase to address:**
Coachmark engine phase (overlay/spotlight rendering). z-index reconciliation with nav + Radix + install gate is a foundational constraint, not polish.

---

### Pitfall 4: Spotlight overlay trapping focus / accessibility regressions

**What goes wrong:**
A spotlight that dims the page with a real modal traps keyboard focus inside the tooltip, hides the rest of the app from screen readers (`aria-hidden` on the root), or — worse — leaves the highlighted control reachable by mouse but not by keyboard/SR because the dim layer eats events. Conversely, an overlay with no focus management lets Tab wander into the dimmed-but-still-focusable background, so a keyboard user tabs into invisible controls. Either way the tour, meant to *teach*, makes the app *less* usable than before.

**Why it happens:**
Spotlight overlays are usually built mouse-first on a phone-shaped viewport; focus order and SR semantics are an afterthought. Radix gives the app good a11y defaults for dialogs, but a hand-rolled spotlight overlay inherits none of that.

**How to avoid:**
- The coachmark tooltip should be an **`aria-live`/labelled region** announced when it appears; describe the target, don't just visually ring it.
- Keep the **real target focusable and operable** (it's the point — the user does the real action). Don't `aria-hidden` or `inert` the target.
- Honor `prefers-reduced-motion` — globals.css already branches on it for `animate-fade-up`; the spotlight move/pulse must respect the same media query.
- Maintain a visible focus ring on the active control; the app's focus-visible rings (`focus-visible:ring-2 ring-white`) must not be obscured by the dim layer.
- Provide a keyboard path: advance/skip/dismiss reachable by keyboard, Esc dismisses.

**Warning signs:**
Tab key moves focus to off-screen/dimmed elements; VoiceOver reads nothing when a coachmark appears; the only way to advance is a mouse tap on a small tooltip button.

**Phase to address:**
Coachmark engine phase, with an explicit a11y verification gate before content phases ship.

---

### Pitfall 5: A tour that blocks the user, can't be skipped, or teaches instead of letting them act

**What goes wrong:**
The walkthrough becomes a gauntlet: forced "Next… Next… Next" through screens the user can't dismiss, or a passive narrated tour ("this is the dashboard, this is the streak ring") that never lets them *do* the real action. This directly violates the milestone goal — "using the real app immediately and never stuck in a tutorial" — and replicates the very front-loaded flow v1.1 is replacing. For a stakes product where the core value is "showing up has a consequence," a tour that delays the first real challenge kills activation.

**Why it happens:**
It's easier to build a linear slideshow than a state machine that watches for real user actions. "Skip" gets deferred as a nice-to-have. Teaching copy is easier to write than wiring a coachmark to a real in-context action (set gym, start a challenge).

**How to avoid:**
- **Skippable anytime** is a first-class requirement (it's in the milestone). A persistent, obvious "Skip tour" / "Skip this step" — not buried. Skipping must not strand the user mid-flow or leave `onboarding_complete` false forever.
- Each teaching point should advance by the user **completing a real action** (gym saved, challenge created), not by clicking "Next." Tie step completion to the existing success signals: `user_gyms` count > 0, `weekly_goal`/`rest_days` set, a real challenge row created, `webhook_secret` shortcut configured.
- Never block the core loop: the user must be able to check in / start a challenge even if they ignore the tour entirely.
- Keep mandatory surface minimal (bare identity only — the milestone's "minimal mandatory start"); everything else is opt-in coachmarks.

**Warning signs:**
Usability testers say "let me just use it"; analytics show high tour-start but low first-challenge-created; the only path past a step is a "Next" button; skipping the tour breaks the app or re-prompts forever.

**Phase to address:**
UX/flow design phase (mandatory-start + step model). Skip and act-don't-teach are acceptance criteria, not enhancements.

---

### Pitfall 6: Tour-version drift — replaying after the UI changed leaves steps pointing at stale targets

**What goes wrong:**
The milestone requires replay-from-settings and resume-after-interruption, with progress persisted server-side. Months later a tab is renamed, the ledger card is restructured, or the gym moves from settings to a dialog. A user replays the tour (or resumes a stale persisted position) and the engine drives them to selectors/refs that no longer exist or now mean something else. The spotlight strands; "resume" lands on a step that was deleted; a returning user gets a broken tour that's worse than no tour.

**Why it happens:**
Persisted progress stores *step indices or ids* that assume a fixed step set. The UI is a moving target (the codebase is explicitly brownfield/mature and changing). Nobody versions the tour definition, so old persisted state silently mis-maps onto a new step list.

**How to avoid:**
- **Version the tour definition** (e.g. `tour_version`). Persist `{version, completed_step_keys}`, not a raw index. On load, if the persisted version is older, reconcile: skip steps whose target is absent, never replay a step whose key no longer exists.
- Key steps by **stable semantic keys** ("set_gym", "start_challenge", "understand_money", "shortcut"), not positional index — so reordering/inserting steps doesn't corrupt saved progress.
- Every step must **degrade gracefully when its target is missing** (already required by Pitfall 1) — that same guard makes version drift non-fatal.
- "Skip completed setup" (a milestone requirement) is the same mechanism: derive completion from real state (`user_gyms`, `weekly_goal`, `webhook_secret`) at replay time, not from a stale stored flag.

**Warning signs:**
Replaying the tour after a UI change shows an empty spotlight; "resume" jumps to a nonexistent screen; a user who already set their gym is taught to set it again.

**Phase to address:**
Persistence + resume/replay phase. Versioning and semantic step keys are schema decisions made when the progress table is designed.

---

### Pitfall 7: Mobile/PWA viewport + safe-area issues for the spotlight and tooltip

**What goes wrong:**
The spotlight rect and tooltip are computed against `100vh` and naive coordinates, but SweatPact is an installed PWA with notch/home-indicator insets. The fixed `TopNav` uses `paddingTop: max(env(safe-area-inset-top), 12px)` and the `MobileNav` uses `paddingBottom: max(env(safe-area-inset-bottom), 20px)`. A coachmark tooltip placed at the bottom can render *under* the home indicator or behind the fixed bottom nav; a top tooltip can hide under the notch. Using `vh` instead of `dvh` (the app deliberately uses `100dvh` math in the dashboard) makes the spotlight jump when the iOS URL bar collapses. Scroll position isn't accounted for, so a target below the fold gets a spotlight at the wrong Y.

**Why it happens:**
Spotlight math is written desktop-first with `window.innerHeight` and `position: fixed`, ignoring `env(safe-area-inset-*)`, `dvh`, dynamic toolbar resize, and the fact that two fixed bars (z-40 top, z-50 bottom) already occupy the edges.

**How to avoid:**
- Compute tooltip placement against **`100dvh` and `env(safe-area-inset-*)`**, matching the app's existing conventions; reserve the top 3.5rem+inset and bottom nav+inset as no-go zones for tooltips.
- If a target is below the fold, **scroll it into view first** (and re-measure after scroll settles) before spotlighting.
- Recompute on `resize`/`scroll`/`orientationchange` and on iOS dynamic-toolbar changes (the app already has a `RefreshOnFocus`; the tour needs live re-measure, not one-shot).
- Test in **standalone mode on a notched device**, not just desktop Chrome devtools — the install gate means real users are always standalone.

**Warning signs:**
Tooltip clipped by the notch or home indicator; spotlight ring offset vertically after scrolling; highlight jumps when the iOS address bar shows/hides; tooltip hidden behind the bottom nav pill.

**Phase to address:**
Coachmark engine phase (positioning), verified on-device during content phases.

---

### Pitfall 8: Persistence race conditions when marking steps done (server-side progress)

**What goes wrong:**
Progress is persisted server-side. Marking a step complete is a write; SweatPact's known concern is "no cross-table transactional guarantees" and "no background job queue — heavy work runs inline." If completing the gym step both saves the gym AND marks the tour step done as two separate writes, a partial failure (gym saved, step-flag write fails — exactly the orphan pattern flagged in CONCERNS.md) leaves the user re-prompted to do something they already did. Rapid step advances (double-tap, fast navigation) can fire overlapping PATCHes that clobber each other (last-write-wins on a JSON blob), losing completed-step keys. Optimistic client state that advances before the server confirms can desync on a failed write, so a refresh resurrects a finished step.

**Why it happens:**
Tour progress feels trivial ("just a flag") so it skips the rigor applied to financial writes. The existing onboarding even sets `onboarding_complete: true` as a fire-and-forget PATCH in `/onboarding/shortcut/client.tsx`. Coachmark progress is more granular (per-step) and more prone to concurrent updates.

**How to avoid:**
- Store progress as a **set of completed step keys** updated with an idempotent, additive operation (append-if-absent), not a read-modify-write of a whole blob that races. Prefer a small dedicated column/table with a unique constraint per `(user, step_key)` so a duplicate completion is a no-op, not a clobber.
- **Derive "done" from real state where possible** rather than a separate flag: a step is complete if `user_gyms.count > 0` / `weekly_goal` set / `webhook_secret` configured. This sidesteps the orphan problem entirely — there's nothing to get out of sync.
- Make the completion write **idempotent and safe to retry**; don't optimistically mark done before the server acknowledges for anything that gates the mandatory flow.
- Validate the progress PATCH with Zod (the app's standard; CONCERNS.md notes `/api/profile` PATCH currently lacks it — don't extend that gap).

**Warning signs:**
A user is re-shown a step they finished; refreshing mid-tour loses progress or re-completes a step; concurrent taps drop a completed key; "resume" disagrees with what the user actually did.

**Phase to address:**
Persistence + resume/replay phase. Schema (per-step rows vs blob) and "derive from real state" are the core decisions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Anchor coachmarks with `document.querySelector('#id')` instead of refs | Fast to wire; no plumbing | Breaks on streamed/conditional targets, route changes, and any markup refactor (Pitfalls 1, 2, 6) | Never for SweatPact — its targets are streamed and route-spanning |
| Store tour progress as one JSON blob PATCHed read-modify-write | One column, trivial API | Concurrent-update clobber; orphan/desync per CONCERNS.md (Pitfall 8) | Only if single-step writes are serialized and idempotent |
| Persist step *index* rather than semantic key | Simplest model | Corrupts on any reorder/insert; version drift (Pitfall 6) | Never — UI is brownfield and changing |
| Opaque full-screen modal overlay for the spotlight | Easy to build, guaranteed "focus" | User can't touch the real control; defeats act-don't-teach; z-fights nav/dialogs (Pitfalls 3, 5) | Never — use a click-through cutout |
| Hardcode `z-[60]` and move on | Looks fine on the screen you tested | Collides with Radix dialogs / install gate elsewhere (Pitfall 3) | Only after reconciling the full z-stack |
| Fire-and-forget "mark complete" PATCH (mirrors existing onboarding) | Matches current code | Silent failure re-prompts the user; no retry | Only for non-gating, derive-from-state steps |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Radix Dialog (gym/schedule pickers the tour opens) | Coachmark overlay sits above the dialog, or Radix scroll-lock leaves `pointer-events:none` on `<body>` after the step | Pause/hide coachmark for the dialog's lifetime or raise the dialog above it; verify `<body>` is interactive after each step (the app already uses `modal={false}` on the dropdown for this exact reason) |
| Next.js App Router navigation | Tour controller mounted in a page → unmounts on navigation; selector matches wrong page's node | Mount controller in the persistent `(tabs)` layout; bind steps to `pathname` + ref |
| RSC streaming / Suspense / `force-dynamic` | Tour measures target before streamed content paints | Ref-presence/observer gating; never measure on tour start |
| PWA standalone + `InstallGate` (`z-[100]`) | Tour renders behind the install wall on non-installed browsers | Gate the tour on `display-mode: standalone`; never run while `InstallGate` is visible |
| Supabase `/api/profile` PATCH for progress | Unvalidated write (existing gap in CONCERNS.md) | Zod-validate; idempotent additive update; derive completion from real tables |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-measuring target on every `scroll`/`resize` without throttle | Jank/scroll lag while a coachmark is active | `requestAnimationFrame`-throttle measurement; use `ResizeObserver`/`IntersectionObserver` instead of polling | Immediately on low-end phones |
| Mounting the whole tour engine for users who've finished it | Extra JS + observers on every dashboard load for everyone | Lazy-load the tour module; only mount when there's an active/replayed tour | At scale, on cold loads (the app already worries about cold-load paint) |
| Per-step network round-trip to mark progress inline | Step transitions feel laggy; ties into "no job queue" inline-work concern | Optimistic-but-idempotent local advance with background confirm; or derive from already-fetched state | When network is slow — i.e. a new user's first session |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting a client-sent "step complete" / "onboarding done" flag without server check | User (or a bug) marks setup complete without doing it; mandatory-start bypassed | Server-authoritatively derive completion from real rows (`user_gyms`, `weekly_goal`, `webhook_secret`); RLS-scope the progress table to the owner |
| Progress table without RLS | One user reading/altering another's onboarding state | RLS on the new table like every other user-facing table (project standard) |
| Coachmark copy rendering user-provided text unescaped (e.g. gym name in a tooltip) | XSS via injected content (CONCERNS.md already flags missing sanitization on user text) | Render as text, never `dangerouslySetInnerHTML`; sanitize any echoed user data |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tour teaches ("this is the streak ring") instead of letting the user act | Boredom, drop-off, no real activation | Each step = a real in-context action (set gym, start challenge) |
| No obvious skip / can't dismiss | Feels trapped; re-creates the front-loaded flow v1.1 is killing | Persistent, obvious skip per-step and whole-tour |
| Re-teaching already-completed setup | Returning/partially-onboarded users insulted, distrust the app | Skip steps whose real state shows done (derive at runtime) |
| Spotlight lands on empty space (cold load / missing target) | Looks broken, undermines a stakes product's credibility | Target-ready gating + graceful step skip |
| Tooltip clipped by notch/home-indicator/bottom nav | Copy unreadable; action button unreachable | Safe-area-aware placement; reserve fixed-bar zones |
| Forcing `router.push` between steps instead of real navigation | Disorienting teleports; resume lands wrong | Advance on the user's own taps on real nav |

## "Looks Done But Isn't" Checklist

- [ ] **Anchoring:** Works on a *cold, throttled* load and on the *first* navigation, not just warm cache — verify the spotlight hits streamed/`force-dynamic` content, not the `loading.tsx` skeleton.
- [ ] **Cross-tab flow:** Tour survives every tab switch and re-acquires its target on the new route; resume lands on the correct screen.
- [ ] **z-index:** Spotlight is above the page but the highlighted control is still tappable; Radix dialogs the tour opens appear correctly; tour never shows behind the `z-[100]` install gate; `<body>` is interactive after every step.
- [ ] **a11y:** Keyboard can advance/skip/dismiss; SR announces the coachmark; focus stays on the real target; `prefers-reduced-motion` respected.
- [ ] **Skip:** Skipping anywhere leaves the app fully usable and doesn't re-prompt forever.
- [ ] **Replay/version:** Replaying after a UI change degrades gracefully (no empty spotlights); persisted progress uses semantic keys + version, not indices.
- [ ] **Safe-area:** Verified standalone on a notched device — top and bottom tooltips clear the insets and the fixed bars.
- [ ] **Persistence:** Marking a step done is idempotent, retry-safe, RLS-scoped, and (ideally) derived from real state; a partial write can't orphan progress.
- [ ] **Skip-completed:** A user who already set gym/schedule/shortcut is not re-taught those steps.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Selector anchoring breaks on streamed/route-changed targets | MEDIUM | Refactor to ref+context anchoring and target-ready gating; touches every step definition |
| Persisted progress corrupted by version drift / index keys | MEDIUM–HIGH | Migrate stored progress to versioned semantic keys; write a reconciliation that derives completion from real state for existing users |
| z-index / Radix `pointer-events:none` body lock | LOW–MEDIUM | Centralize the tour z-index token; pause coachmark during dialogs; assert body interactivity after step transitions |
| Concurrent progress writes clobbering keys | MEDIUM | Move from JSON-blob read-modify-write to per-step rows with a unique constraint (idempotent append) |
| Tour teaches instead of acts (low activation) | HIGH | Redesign step model around real actions — this is a flow-design redo, not a tweak; cheapest if caught in the UX phase |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Unmounted/streamed anchor targets | Coachmark engine (foundations) | Cold-load + throttled-network test: spotlight hits real content, not skeleton |
| 2. Cross-route persistence of the tour | Tour orchestration / cross-screen flow | Walk the full gym→challenge→money→shortcut path across tabs; tour never dies or mis-points |
| 3. z-index / Radix / install-gate conflicts | Coachmark engine (overlay) | Highlighted control tappable; dialogs render; body interactive after each step; nothing behind install gate |
| 4. Focus trap / a11y regression | Coachmark engine (a11y gate) | Keyboard + screen-reader pass; reduced-motion honored |
| 5. Blocking / unskippable / teach-not-act | UX & flow design (mandatory-start + step model) | Skip works everywhere; steps complete via real actions; core loop usable with tour ignored |
| 6. Tour-version drift on replay | Persistence + resume/replay | Replay after a deliberate UI change → graceful skip, no empty spotlight |
| 7. PWA safe-area / viewport positioning | Coachmark engine (positioning) | On-device standalone test on a notched phone, scrolled and unscrolled |
| 8. Progress write races / orphans | Persistence + resume/replay | Concurrent/double-tap completion test; partial-failure test; derive-from-state check |

## Sources

- SweatPact codebase (HIGH confidence): `src/app/(tabs)/layout.tsx` (Suspense-streamed nav, fixed-bar safe-area math), `src/components/nav.tsx` (`z-40`/`z-50`, `modal={false}` scroll-lock workaround, conditional cycle tab, safe-area insets), `src/components/ui/dialog.tsx` (Radix portal at `z-50`), `src/components/install-gate.tsx` (`z-[100]`, standalone detection), `src/app/(tabs)/dashboard/page.tsx` (`force-dynamic`, awaited `Promise.all`, conditional ledger card, `100dvh` math), `src/app/onboarding/**` + redirect-everywhere `onboarding_complete` gate, `src/lib/supabase/rsc.ts` (profile fields).
- `.planning/codebase/CONCERNS.md` (HIGH): no cross-table transactions / orphan writes, no job queue (inline work), unvalidated `/api/profile` PATCH, missing input sanitization, untyped complex client state.
- React product-tour engineering write-ups (MEDIUM): RevereCRE "Product Tours with React" / react-spotlight-tour — refs-over-selectors, wait-for-mount, don't-omit-steps. https://eng.reverecre.com/blog/product-tours-with-react , https://github.com/RevereCRE/react-spotlight-tour
- Sentry Engineering, "Building a Product Tour in React" (MEDIUM) — anchoring/positioning failure modes. https://sentry.engineering/blog/building-a-product-tour-in-react/
- Adobe Spectrum "Coach mark" + Material/Appsilon coachmark guidance (MEDIUM) — UX: skippable, contextual, act-don't-teach. https://spectrum.adobe.com/page/coach-mark/

---
*Pitfalls research for: interactive coachmark onboarding in a Next.js App Router PWA (SweatPact v1.1)*
*Researched: 2026-06-14*
