# Phase 4: Coachmark Engine (single-route) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 04-coachmark-engine-single-route
**Areas discussed:** Library choice, Coachmark card design

---

## Library choice

| Option | Description | Selected |
|--------|-------------|----------|
| react-joyride v3.1 | MIT, React 18/19 ready, custom tooltip components, Floating UI positioning, portal isolation. Research recommendation. | ✓ |
| Onborda/NextStep | App Router-native, cleaner cross-route integration, less mature, tooltip customization more limited. | |
| Custom/headless (Floating UI) | Zero library dependency, full control over spotlight + positioning. More Phase 4 implementation work. | |

**User's choice:** react-joyride v3.1

**Notes:** Research SUMMARY.md pre-validated this option; user confirmed without needing the spike. Onborda was noted as potentially better for Phase 5 cross-route work, but user chose the more mature option.

---

### Library — Tooltip component approach

| Option | Description | Selected |
|--------|-------------|----------|
| Fully custom React component | Pass CoachmarkCard to joyride's `tooltipComponent` prop. Joyride handles positioning; we own all UI. | ✓ |
| joyride built-in tooltip styled with CSS | Use joyride's default tooltip structure, customize via styles/floaterProps. Less flexible. | |

**User's choice:** Fully custom React component via `tooltipComponent` prop.

---

### Library — Radix dialog handling

| Option | Description | Selected |
|--------|-------------|----------|
| Pause / hide the coachmark | Coachmark disappears while any Radix dialog is open, re-appears after it closes. Simple detection via MutationObserver. | ✓ |
| Keep coachmark visible above the dialog | Portal-within-portal. Required if a Phase 4 step targets content inside a dialog. Complex. | |

**User's choice:** Pause / hide the coachmark (pause-resume).

**Notes:** Resolves one of the two spike requirements from the ROADMAP. Portal-within-portal deferred beyond Phase 5.

---

## Coachmark card design

### Card content

| Option | Description | Selected |
|--------|-------------|----------|
| Title + body text + Next/Skip buttons | Step title, 1-2 sentence body, "Next →" advance button, "Skip tour" dismiss link. | ✓ |
| Body text + buttons only (no title) | Minimal, saves vertical space on mobile. | |
| Title + body + embedded action + buttons | Phase 5 card format; build toward it even if actions aren't wired yet. | |

**User's choice:** Title + body text + Next/Skip buttons.

---

### Dismiss placement

| Option | Description | Selected |
|--------|-------------|----------|
| "Skip tour" text link below the Next button | Secondary text link, visually de-emphasized. Advance is the primary action. | ✓ |
| X button in card header / top-right corner | Standard modal-dismiss pattern. More discoverable but competes with title. | |

**User's choice:** "Skip tour" text link below the Next button.

---

### Step progress indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Dot indicators (5 dots, current filled) | Horizontal dots, current step highlighted. Light and non-textual. | ✓ |
| No step indicator | Cleaner, less cognitive overhead. | |

**User's choice:** Dot indicators (5 dots, current filled).

---

### Card visual style

| Option | Description | Selected |
|--------|-------------|----------|
| Brand dark card | Dark background, white text, accent-colored Next button. Sharp, consequence-first identity. | ✓ |
| Light/white card with shadow | Standard shadcn tooltip aesthetic. May get lost against light backgrounds. | |
| You decide | Claude picks based on DESIGN.md and existing components. | |

**User's choice:** Brand dark card.

---

## Claude's Discretion

- Spotlight cutout style (box-shadow ring vs SVG mask vs clip-path)
- Proof-of-concept anchor: which route/element gets `data-tour` in Phase 4
- "Next →" button label (exact wording)
- Card width, arrow/pointer design
- `#tour-root` portal div placement

## Deferred Ideas

- Cross-route navigate-then-reveal → Phase 5
- Coachmark teaching copy and content → Phase 5
- Embedded action surfaces inside card (gym picker, etc.) → Phase 5
- Portal-within-portal (coachmark inside Radix dialog) → deferred beyond Phase 5
- Replay Settings entry → Phase 6
- Auto-skip from real app state → Phase 6
