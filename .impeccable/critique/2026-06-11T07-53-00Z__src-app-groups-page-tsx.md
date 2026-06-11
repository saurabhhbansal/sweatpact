---
target: src/app/groups/page.tsx
total_score: 20
p0_count: 2
p1_count: 2
timestamp: 2026-06-11T07-53-00Z
slug: src-app-groups-page-tsx
---
## Design Health Score

**Target**: `src/app/groups/page.tsx` — "Your active bets" (the challenges list)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Daily check-in status shown per card, but running financial balance is invisible on the list |
| 2 | Match System / Real World | 3 | "Your active bets", "VS", stake pill — clear sporting language throughout |
| 3 | User Control and Freedom | 2 | No way to leave/archive a challenge, no filtering of the growing list |
| 4 | Consistency and Standards | 3 | Mostly consistent with the system; section header missing icon per DESIGN.md rule |
| 5 | Error Prevention | 2 | UserSearch navigates to any user including those you're already challenging; no duplicate-challenge guard |
| 6 | Recognition Rather Than Recall | 2 | All cards look identical in visual weight; balance, start date, urgency require drilling into detail |
| 7 | Flexibility and Efficiency | 1 | One rigid path — tap to open; no swipe actions, no quick check-in from list |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, but search section above challenge list inverts the page's primary purpose |
| 9 | Error Recovery | 2 | Network errors on UserSearch silently empty results with no retry affordance |
| 10 | Help and Documentation | 1 | Empty state is the only guidance; stake mechanics unexplained; no urgency cues |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Mostly clean. The glassmorphic card system is intentional and coherent with the brief, not wallpaper decoration. The symmetrical VS card layout is purposeful. The main AI-tell is the **eyebrow "Challenges" section label** above the h1 — the tracked-uppercase kicker pattern. However, DESIGN.md explicitly defines this as the "Section Label" type ("one label per section hierarchy level, icon-prefixed"), making it a deliberate system choice — just missing the mandatory icon. The layout follows "search → list → nav" which is a formulaic scaffold, though it's the correct scaffold for this use case.

**Deterministic scan**: Unavailable — `detect.mjs` missing `cli/main.mjs`, crashed with ERR_MODULE_NOT_FOUND. Manual source review substituted.

**Visual overlays**: Not applicable — dev server not running.

## Overall Impression

The card system is sharp and on-brand. The problem is that the list is **information-sparse in a high-stakes context**. A user who owes their friend $45 right now sees the same visual as a user who's winning by $30 — neither amount, neither urgency level, neither state is communicated. The page shows you *that* challenges exist; it doesn't tell you *what's at stake right now*. The core product promise — "real money, real pressure" — is completely absent from the summary view.

## What's Working

1. **VS card layout conveys competition at a glance.** The symmetric two-avatar layout with centered VS pill maps directly to the head-to-head mechanic. It feels like a matchup, not a list item.

2. **Interaction feedback is precise.** `hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.99]` plus chevron nudge — the card feels alive on interaction.

3. **Stagger entrance correctly clamped.** `Math.min(100 + index * 60, 400)ms` prevents animation sprawl on long lists.

## Priority Issues

### [P1] The financial balance is missing from the most-visited screen

- **What**: Challenge cards show `$X/day stake` but no running balance. The consequence is hidden.
- **Why**: PRODUCT.md — "Every number shown has consequence." The stake/day is a setting. The running balance is the consequence.
- **Fix**: Add live balance to card footer: `+$12 ahead` in emerald or `-$30 owed` in red.
- **Suggested command**: `/impeccable polish`

### [P1] Search section above challenge list — wrong hierarchy for daily users

- **What**: line 104-113 — "Challenge someone new" is first visible element after heading.
- **Why**: Checking active challenges is the daily task; starting a new challenge is monthly. Rare action is above daily action.
- **Fix**: Move challenge list above search section. Challenge list is the primary daily view.
- **Suggested command**: `/impeccable layout`

### [P2] Pending-today cards are visually identical regardless of urgency

- **What**: ChallengeVersusCard renders identically whether `me.status` is "pending" (haven't checked in) or "verified" (already checked in).
- **Why**: A pending check-in with 2 hours left creates financial urgency. Both states look the same.
- **Fix**: When `me.status === "pending"`, add a subtle owed-red ring (`ring-1 ring-red-500/20`) or more prominent status label.
- **Suggested command**: `/impeccable polish`

### [P2] UserSearch silently swallows network errors

- **What**: `src/components/user-search.tsx:36-44` — `catch` does `setResults([])` with no error state.
- **Why**: On spotty gym WiFi, users see "No users found" when it's actually a network failure.
- **Fix**: Track `setError` and render "Search failed — check your connection." in `text-red-400`.
- **Suggested command**: `/impeccable harden`

### [P3] Section header label missing required icon

- **What**: line 100 — `<p className="text-xs uppercase tracking-[0.18em] text-white/45">Challenges</p>` — no icon prefix.
- **Why**: DESIGN.md specifies "icon + label on all section headers."
- **Fix**: Add `<Swords className="h-3 w-3" />` or equivalent before "Challenges".
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Casey (Distracted Mobile User)**:
- Search box requires keyboard — friction for a daily check-in glance user. She wants to see the list immediately.
- Pending invite banner (`py-3`) is thin; risk of misfires when tapping nearby challenge cards.

**Jordan (Confused First-Timer)**:
- Search box says "Challenge someone new" but result link says "View →" — disconnect between the implied action and the actual action.
- "$X stake" pill unexplained. Per day? Per week? Per challenge?

**Riley (Stress Tester)**:
- 0-member group (opponent never confirmed): `others[0]` is undefined, title falls back to "Challenge" — no visual explanation.
- No end state for completed challenges — they accumulate forever.
- `stakeCents = 0` renders "$0.00 stake" — functional but semantically odd.

## Minor Observations

- `tracking-[0.16em]` on "Challenge someone new" label (line 109) — should be `0.18em` per design system.
- `bg-card/55` on UserSearch results list — inconsistent with `bg-white/[0.04]` pattern used elsewhere.
- Page h1 at `text-3xl` (30px) is outside the defined typography scale — no explicit page-title size in DESIGN.md.

## Questions to Consider

1. What if the card footer showed the live balance in earned-green/owed-red? Would that make opening the app daily feel more charged?
2. Should starting a new challenge live on a dedicated "New Pact" screen rather than atop the active challenges list?
3. What does an ended challenge look like? If challenges accumulate, the list becomes a graveyard.
