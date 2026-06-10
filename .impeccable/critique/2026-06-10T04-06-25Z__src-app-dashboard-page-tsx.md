---
target: dashboard
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-06-10T04-06-25Z
slug: src-app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Checkin strip + badge + action card all communicate state. No loading feedback within streak section on revalidation. |
| 2 | Match System / Real World | 2 | "Waiting on another attempt" renders for missed days (day is over — nothing to attempt). ISO date "2026-06-10" is system-internal language. "Unverified but counted" uses jargon new users won't parse. |
| 3 | User Control and Freedom | 2 | No undo after check-in from dashboard. "Change" link for rest-day override is styled as near-invisible `text-white/40 underline` — fails as an affordance. |
| 4 | Consistency and Standards | 3 | Mostly consistent. "You owe" card has a `border-l-2 border-white/40` accent that "Owed to you" does not — unexpected asymmetry. `text-white/62` in today-action-card violates the opacity ladder. |
| 5 | Error Prevention | 3 | Gym-not-configured notice before check-in is excellent proactive guidance. Excuse button prevents accidental check-ins. No confirmation before the one-tap check-in action (real stakes). |
| 6 | Recognition Rather Than Recall | 3 | Most states are visible and labeled. Excuse options live behind a button — acceptable. "Pending" muted badge offers no hint of what to do next. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts. iOS Shortcut automation is an accelerator but requires off-app setup. No bulk actions. Single rigid check-in path on mobile. |
| 8 | Aesthetic and Minimalist Design | 3 | Focused and clean. Streak explanation text ("A week counts when you hit your X-day goal...") is always visible — useful on day 1, noise on day 30. Side-stripe on "You owe" is visual clutter. |
| 9 | Error Recovery | 2 | Error fallback is clean and actionable. "Waiting on another attempt" is the wrong recovery message for missed/rejected states — misidentifies the situation. |
| 10 | Help and Documentation | 1 | No tooltips, no inline explainers for "verified vs unverified," no onboarding within the dashboard. First-time users reading "week streak" with no context explanation of the counting rules will be confused. The streak card body text partially fills this role but isn't discoverable-on-demand. |
| **Total** | | **26/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: No, this doesn't immediately read as AI-generated. The horizontal check-in strip is a distinctive custom component, the VS card is genuine product design, and the monochrome glass system has a consistent identity. The closest AI tell is the streak circle — a large centered number with a label below approaches the hero-metric template pattern — but the circular ring treatment differentiates it enough. The balance grid asymmetry (side-stripe on "You owe") is the most jarring element and reads as accidental rather than intentional.

**Deterministic scan**: The bundled `detect.mjs` CLI failed with `ERR_MODULE_NOT_FOUND` — the `detector/cli/main.mjs` entrypoint is not present in the installed skill version. Automated scan is unavailable for this run.

**Manual scan findings** (replacing automated):
- `src/app/dashboard/page.tsx:234` — `border-l-2 border-white/40 border-y border-r border-y-white/10 border-r-white/10` on the "You owe" card: **BANNED side-stripe border pattern**. The `border-l-2` at 40% opacity creates an asymmetric accent that differs from the adjacent "Owed to you" card.
- `src/components/today-action-card.tsx:70,73` — `text-white/62`: non-standard opacity value not in the allowed set (`/35 /40 /45 /55 /65 /70`). Violates The Opacity Ladder Rule.

**Visual overlays**: Browser automation unavailable. No overlays rendered.

## Overall Impression

The dashboard's core loop — see your streak, see today's status, take today's action — is correctly structured. The design system is coherent and identity-strong. The primary issues are specific and fixable: one banned border pattern, one copy state that lies to the user, a hierarchy where the decorative streak circle outweighs the primary action, and a date format that reads like a database field. Fix those four and this is a strong screen.

## What's Working

1. **The checkin strip is a genuinely distinctive UI.** Horizontal scrolling timeline with per-day color-coded dots, centered on today with no flash on mount — this is purpose-built product design that doesn't look like anything else in the fitness space. The `useLayoutEffect` scroll trick is invisible and correct.

2. **The today action card handles state complexity cleanly.** Six+ states (rest day, pending-no-gym, pending, verified, unverified, period day, excused, fallback) all render as distinct, human-readable messages. Most of the copy is good and the component's optimistic update pattern (`overrideStatus`) means the UI responds immediately without waiting for a server round-trip.

3. **The glass surface system reads at correct depth.** The three-layer stack — void background, content cards, nav shell — creates genuine spatial hierarchy through the opacity ladder. No shadows needed. This holds up.

## Priority Issues

**[P1] Banned side-stripe border on "You owe" card**
- **What**: `border-l-2 border-white/40` on the left balance card (`dashboard/page.tsx:234`) creates a thick left accent border. The card also uses separate `border-y` and `border-r` declarations instead of a unified `border`, producing inconsistent rendering. The adjacent "Owed to you" card has a clean `border border-white/10`.
- **Why it matters**: This is a banned pattern per DESIGN.md ("side-stripe borders prohibited"). It also creates an asymmetry that implies semantic meaning (urgent vs. not urgent) without being designed to do so. Users may expect both cards to look the same. If the intent was to highlight debt, this is the wrong mechanism — it looks like a rendering bug.
- **Fix**: Replace both balance cards with a unified border treatment: `rounded-[1.7rem] border border-white/10 bg-white/[0.04]`. If you want to signal that "You owe" is more urgent, use a red-tinted background when `totalOwes > 0` (`bg-red-500/[0.04] border-red-500/20`) rather than a side stripe.
- **Suggested command**: `/impeccable polish dashboard`

**[P1] Copy failure: "Waiting on another attempt" for missed/rejected states**
- **What**: `today-action-card.tsx:93` — the catch-all `else` branch renders "Waiting on another attempt / Nothing is counted for today yet" for `missed` and `rejected` statuses.
- **Why it matters**: For a `missed` day, the day is over. "Waiting on another attempt" is literally false — there is no attempt coming. It creates anxiety (am I supposed to do something?) and confusion (what is the system waiting for?). Users may refresh repeatedly thinking the status is stuck.
- **Fix**: Split the catch-all. `missed` should say something like "Missed — day's done" with a subdued, matter-of-fact message (e.g., "Nothing counted for today. Your streak handles it."). `rejected` should say "Check-in rejected" with context. The "waiting" copy is only appropriate for a truly indeterminate intermediate state, not a terminal one.
- **Suggested command**: `/impeccable clarify today-action-card`

**[P2] Visual hierarchy: decorative circle outranks the primary action**
- **What**: The streak circle (`h-40 w-40`, `text-5xl`) occupies the most visually dominant position on the page — above the fold, full-width, highest contrast — but carries zero interactive affordance. The check-in button (the primary daily action) lives below it in the third section.
- **Why it matters**: Users opening the app to check in have to visually skip the largest element to reach what they came to do. The hierarchy inverts task priority and user intent. In a competitive product where daily action is the product, the action should have the highest visual weight.
- **Fix**: Two approaches: (1) Compress the streak section — move the number into an inline pill or smaller card, reduce it from h-40 to something that doesn't dominate; or (2) Reorder: put TodayActionCard first when `todayStatus === "pending"`, and relegate the streak to secondary. The strip can stay first as it gives temporal context.
- **Suggested command**: `/impeccable layout dashboard`

**[P2] ISO date renders as `2026-06-10`**
- **What**: `dashboard/page.tsx:223` — `<p className="mt-2 text-xs text-white/45">{today}</p>` renders the raw ISO date string (e.g., "2026-06-10").
- **Why it matters**: ISO format is system-internal language. It's cold, technical, and mismatches the product's competitive/human tone. On the streak card specifically, it reads as a database field, not a human touchpoint.
- **Fix**: Format with `toLocaleDateString`: `new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })` → "Tue, Jun 10". Or remove it entirely — the checkin strip already shows the current date position.
- **Suggested command**: `/impeccable clarify dashboard`

**[P2] Non-standard opacity `text-white/62` in today-action-card**
- **What**: `today-action-card.tsx:70,73` uses `text-white/62` (twice) — not in the allowed set per The Opacity Ladder Rule (`/35 /40 /45 /55 /65 /70`).
- **Why it matters**: Breaks system tonal consistency. The nearest correct values are `/55` or `/65`.
- **Fix**: Change both occurrences to `text-white/65`. (Slightly lighter than /55 is appropriate here since these are supporting messages in the "done" states.)
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Casey (Distracted Mobile User)** — *Selected: primary persona. SweatPact is a mobile-first PWA, used at or en route to the gym.*
- The "Need a valid excuse for today?" text + ExcuseButton is rendered as small `text-xs text-white/50` below the check-in button. On a 375px screen with a thumb at the bottom, this is in a dead zone and easy to mis-tap, triggering an excuse instead of check-in.
- The "Change" link for rest-day override (`underline text-white/40`) is ~12px text. Fails the 44×44pt touch target minimum by a large margin — a thumb attempting to tap it will likely miss or trigger the CheckInButton above it.
- State is preserved on re-open (server-rendered) ✓. But the optimistic update and subsequent server refresh can produce a brief flash of the previous state — minor but noticeable.

**Jordan (Confused First-Timer)** — *Selected: first-time users won't understand the verified/unverified distinction or how the streak counting works.*
- "Pending" badge in muted style tells Jordan nothing. A first-timer who's never checked in will sit on this screen wondering what "Pending" means and what to do. The check-in button is present but there's no visual call-to-action hierarchy that says "this is the thing to do now."
- "Unverified, but counted" — a first-timer who logs a check-in away from their gym will see this and have no idea what "unverified" means, why it happened, or whether they should be worried. The "Managers can reverse it" copy references a concept (managers) that first-timers don't know exists.
- The streak explanation text ("A week counts when you hit your 4-day goal") appears BELOW the large streak circle. Jordan will look at a "0" streak on day 1 and feel bad before reading the explanation. Ordering issue.

**The Competitor** — *Project-specific: an active SweatPact user with an ongoing challenge, checking in daily and watching the score.*
- The dashboard shows their own streak and balance but NOT their opponent's current status. To see whether their challenge partner has checked in today, they must navigate to Challenges → specific group. This is the core competitive loop — knowing whether you're ahead or behind — and it requires two additional taps from the primary screen.
- The balance amounts are aggregated but not attributed. Seeing "$20" without "you owe Jamie $20" means the Competitor still has to tap through to know who has the obligation. Low-stakes for one challenge, annoying for users in multiple.

## Minor Observations

- `tracking-[0.2em]` on "This week" label (`dashboard/page.tsx:189`) — the allowed section-label tracking is `[0.18em]`, not `[0.2em]`. Minor drift.
- The `<PushPermissionPrompt compact />` at the top of the main section will render for every user who hasn't accepted push permissions. For users who have already declined once (browser-level deny), this component should ideally detect that state and not render rather than showing a prompt the user cannot act on.
- The streak section has no skeleton in the loading state — the `loading.tsx` shows a 56px skeleton block for this area, but the actual component renders `text-5xl` immediately on client hydration, which may cause a layout shift. The skeleton height matches but the content is taller.
- `text-white/80` on the current-week count (`dashboard/page.tsx:193`) is not in the allowed opacity set (allowed: /70 max). Should be `/70`.

## Questions to Consider
- The competitive dimension (vs. your challenge partner) is absent from the primary screen. What if today's opponent status — "Jamie hasn't checked in yet" or "Jamie is already in for today" — appeared on the dashboard?
- The streak circle is the largest element on the screen. Does the streak number actually change user behavior day-to-day, or does it create anxiety for users with a 0?
- "Need a valid excuse for today?" — is this copy too passive? It implies excuses are neutral. Does the product want to make excusing yourself feel slightly costly (friction) to reinforce accountability?
