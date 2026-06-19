# Phase 5: Cross-Route Walkthrough & Teaching Content - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 05-cross-route-walkthrough-teaching-content
**Areas discussed:** Embedded setup surfaces, Practice check-in mechanics, Cross-route navigation, Invited-path variant (ONB-03)

---

## Embedded Setup Surfaces

**Q1: How should setup surfaces appear during the walkthrough?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline inside the card | Card expands to contain gym search / schedule picker directly; surface onComplete fires advance() | ✓ |
| Radix Dialog from the card | Card shows "Set up now →" button; surface opens in a Radix Dialog; coachmark pauses while dialog is open (Phase 4 D-04) | |
| Full-screen page redirect | Card CTA navigates to /onboarding/gym or /onboarding/schedule; user leaves tour context | |

**User's choice:** Inline inside the card

---

**Q2: How to handle card height with gym search results?**

| Option | Description | Selected |
|--------|-------------|----------|
| Let the card scroll internally | Fixed max-height (80vh), overflow-y: auto on surface slot | ✓ |
| Card expands to full natural height | No height limit; could push card off-screen on mobile | |
| Compact input only, popover results | Search input in card, results in anchored popover below | |

**User's choice:** Let the card scroll internally

---

**Q3: What does the Next → button do when a surface is embedded?**

| Option | Description | Selected |
|--------|-------------|----------|
| Surface onComplete advances (Skip tour still available) | No standalone Next → when surface embedded; surface's Continue/Skip calls advance(); Skip tour text link remains | ✓ |
| Both — surface onComplete AND standalone Next → | Two paths to advance; risks confusion | |
| You decide | Claude picks | |

**User's choice:** Surface's onComplete is the only advance trigger; Skip tour remains

---

## Practice Check-in Mechanics

**Q1: What does "never registers as a real check-in" mean at implementation level?**

| Option | Description | Selected |
|--------|-------------|----------|
| Pure UI simulation — no API call | Brief animation then advance('shortcut_viewed') fires; zero contact with /api/checkin | ✓ |
| New /api/checkin/practice endpoint | Dedicated endpoint, skips DB writes, returns 200 with practice:true | |
| Flag on existing /api/checkin | practice: true flag on existing financial-critical endpoint | |

**User's choice:** Pure UI simulation — no API call

---

**Q2: Does the shortcut step embed the full ShortcutSurface?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full ShortcutSurface embedded | Consistent with gym/schedule; shows real QR code and webhook URL; onComplete = advance('shortcut_viewed') | ✓ |
| Simplified card — shortcut info only | Pure teaching card, no surface component embedded | |

**User's choice:** Full ShortcutSurface embedded

---

## Cross-Route Navigation

**Q1: Who owns navigate-then-reveal logic?**

| Option | Description | Selected |
|--------|-------------|----------|
| CoachmarkRenderer owns it — STEPS gets a 'route' field | Each step gets route?: string; renderer reads next step's route, calls router.push() if pathname differs; TourProvider stays frozen | ✓ |
| TourProvider gets a navigate callback prop | Layout passes navigate function into TourProvider; advance() calls it; leaks routing into TourProvider | |
| You decide | Claude picks mechanism | |

**User's choice:** CoachmarkRenderer owns it; STEPS registry gets `route` field

---

**Q2: Route mapping for the 5 steps?**

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard for schedule+gym; Groups for challenge+money; Shortcut tab for shortcut_viewed | Natural home for each teaching point; challenge/money live in the groups context | ✓ |
| All on dashboard | No cross-route navigation; challenge/money/shortcut would need dashboard anchors | |
| Different mapping | User specifies custom assignment | |

**User's choice:** schedule→/dashboard, gym→/dashboard, challenge→/groups, money→/groups, shortcut_viewed→/shortcut

---

## Invited-Path Variant (ONB-03)

**Q1: How does the walkthrough detect the invited variant?**

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime check on /groups page | pendingCount > 0 triggers invited variant; same step ID 'challenge', no registry fork | ✓ |
| entryPath prop on TourProvider | Layout server-fetches invite state, passes 'invited'/'self-starter' to TourProvider; extends frozen TourValue | |
| Two step IDs in the registry | challenge_accept and challenge_start as separate STEPS; TOUR_VERSION bump required | |

**User's choice:** Runtime pendingCount check — no registry fork

---

**Q2: Where does the invited variant route the challenge step?**

| Option | Description | Selected |
|--------|-------------|----------|
| Challenge step navigates to /notifications | pendingCount > 0 → route becomes /notifications; accept flow already lives there | ✓ |
| Challenge step stays on /groups, accept CTA added there | New UI on /groups page for pending invite accept | |
| You decide | Claude picks based on existing accept flow location | |

**User's choice:** Invited users → /notifications (where accept/decline already exists)

---

## Claude's Discretion

- `data-tour` anchor placement on each route (which specific element — must be unconditionally mounted)
- `data-pending-count` DOM attribute vs. client-side fetch for invited-path detection
- Getting started checklist position on dashboard (above/below daily strip)
- Teaching copy for challenge and money steps (brand-voiced, outcome-framed, consequence-first)
- "Start your first pact" empty-state copy and placement on dashboard

## Deferred Ideas

- Auto-skip from real app state at tour start — Phase 6
- Replay from Settings — Phase 6
- "Pact is live" completion moment — Phase 6
- Portal-within-portal — deferred beyond Phase 5
- Per-step drop-off analytics — v1.x/v2
- Money coachmark anchored to user's own live numbers — v2 polish
