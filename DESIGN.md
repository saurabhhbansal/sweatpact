---
name: SweatPact
description: Gym accountability with real stakes. Compete, verify, settle up.
colors:
  void: "#000000"
  ink: "#ffffff"
  card-surface: "#0f0f0f"
  muted-surface: "#1a1a1a"
  border-standard: "#2e2e2e"
  muted-fg: "#999999"
  earned-green: "#10b981"
  earned-green-dim: "#34d399"
  owed-red: "#ef4444"
  owed-red-dim: "#f87171"
  destructive: "#dc2828"
  success: "#22c55e"
  warning: "#f59e0b"
typography:
  title:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
  section-label:
    fontFamily: "system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  pill: "9999px"
  section: "2rem"
  item: "1.4rem"
  input: "1rem"
spacing:
  card-padding: "20px"
  section-gap: "24px"
  row-gap: "12px"
  inline-gap: "8px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "rgba(255,255,255,0.9)"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "rgba(255,255,255,0.7)"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "40px"
  badge-success:
    backgroundColor: "rgba(16,185,129,0.1)"
    textColor: "{colors.earned-green-dim}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  badge-destructive:
    backgroundColor: "rgba(239,68,68,0.1)"
    textColor: "{colors.owed-red-dim}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card:
    backgroundColor: "rgba(255,255,255,0.04)"
    rounded: "{rounded.section}"
    padding: "{spacing.card-padding}"
  input:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "44px"
---

# Design System: SweatPact

## 1. Overview

**Creative North Star: "The Pact"**

SweatPact runs at negative space. A pure black field — not dark gray, not midnight blue, absolute `#000000` — says that the data breaking the silence carries weight. White appears only where consequence lives: your score, their score, the verdict. The system does not decorate. Two people made an agreement; the interface records whether it was kept.

Color arrives at exactly two moments. Earned Green (`#10b981` emerald) means you showed up and banked a day. Owed Red (`#ef4444`) means someone defaulted and a debt accrued. Everything else is achromatic. This is not minimalism for aesthetics — it is clarity that raises the stakes of the moments that do use color.

Glass surfaces create the only other dimension. Containers float at 4% white opacity on a black void, blur the layer behind them with `backdrop-blur-xl`, and lift to 6% on hover. This depth is structural, not decorative: it orients the user's eye without pulling focus from the status data that actually matters. The system is closest in spirit to Whoop's data seriousness, Strava's score-as-identity philosophy, and the social-pressure tension of a Snapchat streak — but it owns all three instead of copying any one.

**Key Characteristics:**
- Absolute black canvas (`#000000`), no tints, no near-blacks
- White ink on void: pure achromatic hierarchy
- Earned Green / Owed Red — the only chromatic signals, both semantic
- Glass surfaces via opacity layering and backdrop-blur, zero box-shadows
- Rounded-full pills for all interactive controls; 2rem curves for container shells
- System font throughout — no display type, no typographic decoration
- 280ms ease-out-expo transitions; stagger on lists; full reduced-motion support

## 2. Colors: The Achromatic Contract

The palette is a binary: void and ink. Color exists only as status evidence.

### Primary
- **Void** (`#000000`): Body background. Pure, absolute black — not near-black, not dark gray. The silence between verdicts.
- **Ink** (`#ffffff`): Primary text, primary actions, active states. Full white, no tint.

### Secondary
- **Earned Green** (`#10b981`, emerald-500): Verified check-ins — solid fill `rgba(16,185,129,0.9)`. The only way to earn this color is to show up.
- **Earned Green Dim** (`#34d399`, emerald-400): Unverified check-ins — dashed border only, no fill. Same hue, diminished confidence.
- **Owed Red** (`#ef4444`, red-500): Missed days, failed commitments — `rgba(239,68,68,0.15)` fill plus `rgba(239,68,68,0.7)` border.
- **Owed Red Dim** (`#f87171`, red-400): Text color within owed-red contexts.

### Tertiary
- **Destructive** (`#dc2828`): Irreversible actions (delete account, reject). Heavier and more saturated than Owed Red. Used only for danger-zone UI, never for check-in status.
- **Warning** (`#f59e0b`): Amber — currently unused in status UI; reserved for system-level alerts.

### Neutral
- **Card Surface** (`#0f0f0f`): Glass card background at rest — equivalent to `bg-white/[0.04]` over void.
- **Muted Surface** (`#1a1a1a`): Input backgrounds, secondary surfaces — `bg-white/[0.08]` equivalent.
- **Border Standard** (`#2e2e2e`): Default container borders — `border-white/18` equivalent.
- **Muted Foreground** (`#999999`): Secondary text at 60% white.
- **Subdued Foreground** (`rgba(255,255,255,0.45)`): Section labels, inactive nav items, tertiary captions.

### Named Rules

**The Pact Rule.** Color appears only at consequence. Emerald = fulfilled. Red = defaulted. Every other surface is achromatic. If you find yourself reaching for a third hue, you are decorating, not communicating. Prohibited.

**The Opacity Ladder Rule.** Glass surfaces follow exactly four steps: `bg-white/[0.04]` (rest), `bg-white/[0.06]` (hover), `bg-white/[0.08]` (active / unread / nav shell), `bg-white/[0.14]` (secondary button hover only). No intermediate values. Border opacity uses only: `/10`, `/15`, `/18`, `/20`, `/25`. Text opacity uses only: `/35`, `/40`, `/45`, `/55`, `/65`, `/70`. Non-standard opacities break the system's tonal consistency.

## 3. Typography

**Body Font:** system-ui, -apple-system, sans-serif (no custom typeface loaded)
**Label Font:** same stack — no pairing, one family throughout

**Character:** Single system sans carries all hierarchy. No display pairing, no typographic decoration. The score is the communication; the type is the substrate. Following the product register: one well-tuned sans is right here.

### Hierarchy

- **Title** (semibold 600, 16px, line-height 1.3): Card headings, section titles, dialog headers. Never on data values.
- **Body** (regular 400, 14px, line-height 1.5): Row labels, descriptions, form fields. Max 65ch on prose; data columns run at content width.
- **Label** (medium 500, 12px, line-height 1.4): Status text within components, supporting descriptions, badge content.
- **Micro** (medium 500, 11px, letter-spacing 0.08em, line-height 1.4): Badge text, nav item labels, smallest metadata. Tracking compensates for optical crowding at 11px.
- **Section Label** (regular 400, 12px, uppercase, letter-spacing 0.18em, `text-white/45`): One label per section hierarchy level, icon-prefixed. Use sparingly — one per visual grouping, not above every sub-element.

### Named Rules

**The One Voice Rule.** System font only. No Google Fonts, no display typefaces, no monospace decoration. The interface is a score sheet, not an editorial. Type that draws attention to itself competes with the data it labels.

**The Tracking Rule.** Letter-spacing is used at exactly two levels: `0.08em` on micro (11px) labels, `0.18em` on section labels (all-caps). Nowhere else. Tracking for atmosphere is prohibited.

## 4. Elevation

SweatPact has no shadow vocabulary. Depth is conveyed entirely through two mechanisms: tonal layering (the opacity ladder) and `backdrop-blur` (glass depth).

Glass surfaces at different opacity steps read at different "altitudes" against the pure black background. The nav shell and modals blur at `backdrop-blur-2xl` (40px); content cards at `backdrop-blur-xl` (24px). This creates three legible layers — void / content / navigation — without a single `box-shadow` declaration.

### Named Rules

**The No-Shadow Rule.** Box shadows are prohibited system-wide. Any perceived depth must be achievable through the opacity ladder and backdrop-blur. If you need a shadow to distinguish two elements, restructure the layout so they occupy different opacity layers instead.

**The Glass Ceiling Rule.** Backdrop-blur exists only on persistent shells (top nav, bottom nav) and modal overlays. Content cards use `backdrop-blur-xl` (24px). Do not add blur to inline content elements like list rows, status badges, or form fields — blur loses meaning when it appears everywhere.

## 5. Components

### Buttons

The button shape is always `rounded-full`. There are no pill-with-radius or rectangular buttons. All variants scale to the same 40px height (default), 36px (sm), 48px (lg).

- **Primary:** `bg-white text-black` — full white fill, black text. Used for primary confirmation actions (submit, update, accept challenge). Hover: `bg-white/90`. Active: `scale(0.98)`.
- **Outline:** `border border-white/25 text-white bg-transparent` — used for secondary confirmation. Hover: `bg-white/[0.06]`.
- **Secondary:** `bg-white/[0.08] border border-white/18 text-white` — for paired actions alongside a primary.
- **Ghost:** `text-white/70 bg-transparent` — for icon buttons, inline text actions, cancel links. Hover: `bg-white/[0.06] text-white`.
- **Destructive:** `border-[1.5px] border-white bg-transparent text-white` — visually identical to an outlined button until context (delete zone) makes the danger clear.
- **Focus ring:** `ring-2 ring-white/80 ring-offset-2 ring-offset-black` on all variants.

### Inputs / Fields

- **Shape:** `rounded-[1rem]` (16px), `h-11` (44px)
- **Rest:** `bg-white/[0.06] border border-white/20 text-white`
- **Placeholder:** `text-white/35` — meets 4.5:1 against the surface
- **Focus:** border shifts to `border-white` (full white), no ring — the border IS the focus indicator
- **Disabled:** `opacity-50 cursor-not-allowed`
- **Error:** border-destructive (`border-red-500/50`) with error text in `text-red-400`

### Badges / Status Chips

All badges are `rounded-full`, `text-[11px] font-medium tracking-[0.08em]`, `px-2.5 py-1`.

- **Success (Verified):** `border-emerald-500/50 bg-emerald-500/10 text-emerald-400` — solid emerald, opaque fill
- **Warning (Unverified):** `border-emerald-400/50 bg-emerald-400/10 text-emerald-300 border-dashed` — same hue, dashed border signals reduced confidence
- **Destructive (Missed):** `border-red-500/50 bg-red-500/10 text-red-400`
- **Muted:** `border-white/10 bg-white/[0.04] text-white/55` — neutral, no semantic weight

### Cards / Containers

Four nested container levels, each distinguished by corner radius and context:

- **Section shell** (`rounded-[2rem]`, 20px padding, `bg-white/[0.04] border border-white/10 backdrop-blur-xl`): Top-level page sections. The primary content container.
- **List item / row** (`rounded-[1.4rem]`, 12-14px padding, same glass surface): Interactive rows within sections — settings rows, notification items, gym entries.
- **Compact container** (`rounded-[1rem]`, 12px padding): Inputs, message bubbles, small inset content.
- **Pill** (`rounded-full`): Stakes labels, status chips, nav items, all buttons.

**Nesting rule:** Section shells may contain list items. List items may not contain section shells. No nested cards of the same visual level.

### Navigation

**Top bar** (`h-14`, `rounded-[1.8rem]`, `bg-white/[0.08] border border-white/18 backdrop-blur-2xl`, `sticky top-0 z-40`): Logo left, notification bell + user menu right. The bell shows a white `rounded-full` count badge on unread.

**Bottom nav** (`rounded-[1.9rem]`, same glass as top bar, `fixed bottom-0 pb-3`): 3–4 item grid. Each item: `rounded-[1.4rem]`, `min-h-[4.3rem]`, inactive `text-white/45`, active `text-white font-semibold` + 2px white top indicator line. No colored active states — active is white, inactive is subdued white.

### Check-in Strip (Signature)

The horizontal scrolling day timeline is the product's primary data surface. Each day cell is `rounded-full`, `h-[2.4rem] w-9`. Status is conveyed by fill:

- **Verified:** `bg-emerald-500/90 text-black` — solid fill, black day number
- **Unverified:** `border-dashed border-emerald-400 text-emerald-300` — no fill, dashed ring, green number
- **Missed/Rejected:** `border border-red-500/70 bg-red-500/15 text-red-300` — faint red fill, red border
- **Rest/Sick:** `border border-white/15 bg-white/[0.06] text-white/55` — neutral glass
- **Future:** `border border-white/[0.06] text-white/20` — almost invisible
- **Today:** adds `ring-2 ring-white ring-offset-2 ring-offset-black` — white ring marks the present moment

The strip scrolls horizontally to today on mount using `useLayoutEffect` (no visible flash). It is hidden until the scroll is set, then revealed — never shows account-start first.

### VS Card (Signature)

The head-to-head challenge card (`rounded-[2rem]`, `bg-white/[0.04] border border-white/10`, hover `border-white/20 bg-white/[0.07]`) presents two avatars with a center VS pill (`rounded-full border border-white/15 bg-white/[0.06] text-white/60 text-[10px] font-bold tracking-[0.16em] uppercase`). The footer shows a stake pill (`rounded-full border border-white/15 bg-white/[0.04] text-white/70`) and an "Open ›" affordance (`text-xs uppercase tracking-[0.14em] text-white/45`).

## 6. Do's and Don'ts

### Do:
- **Do** use `bg-white/[0.04]` for default glass surfaces, `[0.06]` for hover, `[0.08]` for active, selected, and nav shells.
- **Do** keep border opacity in the set: `/10`, `/15`, `/18`, `/20`, `/25`. Keep text opacity in: `/35`, `/40`, `/45`, `/55`, `/65`, `/70`.
- **Do** use `rounded-[2rem]` for section containers, `rounded-full` for pills and buttons, `rounded-[1.4rem]` for list items, `rounded-[1rem]` for inputs and compact containers.
- **Do** use `bg-emerald-500/90` fill for verified; dashed `border-emerald-400` ring (no fill) for unverified; `bg-red-500/15 border-red-500/70` for missed. These three states must be visually unambiguous at a glance.
- **Do** use icon + label on all section headers. The icon is 12×12px, the label is `text-xs uppercase tracking-[0.18em] text-white/45`.
- **Do** add `active:scale-[0.98]` to all interactive buttons. The micro-compression confirms the tap without animation overhead.
- **Do** stagger list entrance animations using `--stagger` CSS variable (50–60ms per item). Respect `prefers-reduced-motion: reduce`.
- **Do** use `backdrop-blur-xl` on content cards, `backdrop-blur-2xl` on nav shells and modals.

### Don't:
- **Don't** use non-standard Tailwind opacity values (`/8`, `/12`, `/42`, `/46`, `/58`, `/74`). The opacity ladder exists for a reason; departures break tonal consistency.
- **Don't** add box shadows anywhere. If you need to separate elements visually, use the opacity ladder. The No-Shadow Rule is absolute.
- **Don't** use a third hue for anything other than semantic status. No blue accents, no purple gradients, no amber highlights outside system alerts. Violating The Pact Rule dilutes the earned meaning of green and red.
- **Don't** use `rounded-2xl` (Tailwind's 24px alias). Section containers are `rounded-[2rem]` (32px). The distinction is intentional — use the explicit value.
- **Don't** design like MyFitnessPal: no chart-heavy data density, no clinical metric grids, no logging-as-homework UX. SweatPact is a competition, not a journal.
- **Don't** design like a standard SaaS dashboard: no gray sidebar nav, no metric cards in uniform grids, no corporate productivity chrome. The interface has personality.
- **Don't** design like Nike Run Club: no brand-forward logo treatment, no marketing-hero layout within the app UI. The product is the competition, not the brand.
- **Don't** use display fonts or decorative typefaces in UI labels, buttons, or data. The One Voice Rule prohibits it.
- **Don't** add glassmorphism decoratively — no blur on inline content elements like rows, chips, or field labels. Glass belongs only on persistent shells and modal overlays.
- **Don't** omit the `prefers-reduced-motion` media query from any animation. SweatPact's reduced-motion handler globally disables `.animate-fade-up`, `.animate-fade-up-item`, and `.animate-skeleton`; honor the same rule for any new motion added.
