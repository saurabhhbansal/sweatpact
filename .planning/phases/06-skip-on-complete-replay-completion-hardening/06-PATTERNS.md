# Phase 6: Skip-on-Complete, Replay & Completion Hardening - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 7 (modify) + 4 directories (delete) + 1 file (delete)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/onboarding/completion.ts` | utility | transform | self (already pure probes) | self-reference |
| `src/lib/onboarding/steps.ts` | config | transform | self (STEPS registry) | self-reference |
| `src/lib/onboarding/current-step.ts` | utility | transform | self (deriveCurrentStep) | self-reference |
| `src/app/api/onboarding-progress/route.ts` | route | request-response | self (PATCH handler) | self-reference |
| `src/app/(tabs)/settings/client.tsx` | component | request-response | `ChangePasswordButton` inside same file | exact |
| `src/app/(tabs)/groups/page.tsx` | page (RSC) | CRUD | self + `src/app/(tabs)/settings/page.tsx` | exact |
| `src/components/pact-live-overlay.tsx` (new) | component | event-driven | `src/components/notifications-overlay.tsx` | role-match |
| Delete: `src/app/onboarding/gym/`, `schedule/`, `shortcut/`, `step-indicator.tsx` | — | — | — | n/a |

---

## Pattern Assignments

### `src/lib/onboarding/current-step.ts` (utility, transform)

**Change:** Replace neutral probe stubs `{ gymCount: 0, restDays: [] }` in `TourProvider` with real values fetched server-side.

**Current signature** (lines 21-25):
```typescript
export function deriveCurrentStep(
  completedSteps: string[],
  dismissed: boolean,
  probe: { gymCount: number; restDays: number[] }
): string | null
```

**Current call-site in `TourProvider`** (lines 54-61 of `src/components/tour-provider.tsx`):
```typescript
const currentStepId = useMemo(
  () =>
    deriveCurrentStep(progress.completed_steps, progress.dismissed, {
      gymCount: 0,   // Phase 6: replace with real value
      restDays: [],  // Phase 6: replace with real value
    }),
  [progress.completed_steps, progress.dismissed]
);
```

**What Phase 6 must do:** Pass real `gymCount` and `restDays` as props into `TourProvider` from the tabs layout RSC. The `TourProvider` signature expands to accept these; `useMemo` deps add them.

**Analog — layout RSC already fetches profile** (`src/app/(tabs)/layout.tsx` lines 59-68):
```typescript
const profile = await getViewerProfile();
if (!profile) redirect("/login");
if (isAutoUsername(profile.username)) redirect("/onboarding/username");
const initialProgress = await getOnboardingProgress();
// Phase 6 adds:
// const { data: userGyms } = await supa.from("user_gyms").select("id").eq("user_id", profile.id);
// gymCount = userGyms?.length ?? 0
// restDays = profile.rest_days ?? []
```

**Probe data stays out of `completion.ts`** — that module is pure and stateless (lines 1-50 of completion.ts, no Supabase import). Do not add fetching there.

---

### `src/lib/onboarding/steps.ts` (config, transform)

**Change:** TOUR_VERSION bump if any step id or order changes; otherwise no change. Read the bump rule before touching.

**Bump rule** (lines 1-12):
```typescript
/**
 * Bump rule: increment whenever the ordered SET or IDENTITY of `STEPS` changes
 * (a step added, removed, reordered, or its `id` renamed) — NOT for cosmetic
 * title edits.
 */
export const TOUR_VERSION = 1;
```

**Step shape** (lines 37-50):
```typescript
export type OnboardingStep = {
  id: string;
  title: string;
  surface?: SurfaceId;
  probe?: ProbeId;
  route?: string;
};
```

**Current STEPS array** (lines 62-68) — frozen `as const`, must remain so:
```typescript
export const STEPS: readonly OnboardingStep[] = Object.freeze([
  { id: "schedule", title: "Set your weekly goal", surface: "schedule", probe: "schedule", route: "/dashboard" },
  { id: "gym", title: "Add your gym", surface: "gym", probe: "gym", route: "/dashboard" },
  { id: "challenge", title: "Start a stakes challenge", route: "/groups" },
  { id: "money", title: "How the money works", route: "/groups" },
  { id: "shortcut_viewed", title: "iOS Shortcut", surface: "shortcut", probe: "shortcut", route: "/shortcut" },
] as const);
```

---

### `src/app/api/onboarding-progress/route.ts` (route, request-response)

**Change:** Extend `PatchBody` Zod schema in `src/lib/onboarding-progress.ts` to accept a `replay: true` signal. The PATCH handler applies it by setting `dismissed: false` without touching `completed_steps`.

**Current `PatchBody` in `src/lib/onboarding-progress.ts`** (lines 17-29):
```typescript
export const PatchBody = z
  .object({
    complete_step: z.string().regex(STEP_KEY_REGEX, "step_key_format").optional(),
    last_step_id: z.string().regex(STEP_KEY_REGEX, "step_key_format").nullable().optional(),
    mandatory_done: z.boolean().optional(),
    dismissed: z.boolean().optional(),
    completed_at: z.string().datetime().nullable().optional(),
  })
  .strict();
```

**Minimal extension pattern** — add one optional boolean field; `.strict()` stays; existing callers sending none of the new field are unaffected:
```typescript
replay: z.literal(true).optional(),
```

**Handler merge logic** (`src/app/api/onboarding-progress/route.ts` lines 70-73) — `mergeProgress` will need to handle `replay: true` → set `dismissed: false` in the merged row. Either extend `mergeProgress` in `onboarding-progress.ts` or apply it inline after the merge call.

**Auth pattern to copy** (lines 16-23 of route.ts — every route handler follows this):
```typescript
const supabase = createClient();
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

**Validation pattern** (lines 47-53):
```typescript
const parsed = PatchBody.safeParse(await req.json().catch(() => null));
if (!parsed.success) {
  return NextResponse.json(
    { error: "validation_failed", issues: parsed.error.flatten() },
    { status: 400 }
  );
}
```

---

### `src/app/(tabs)/settings/client.tsx` (component, request-response)

**Change:** Add a "Replay app tour" ghost button in the Gyms section (after `<GymsSection>` or after the iOS Shortcuts section — contextually near onboarding-related content).

**Pattern to copy — inline action button** (lines 208-219, `ChangePasswordButton`'s trigger):
```typescript
<button
  type="button"
  onClick={() => setOpen(true)}
  className="flex w-full items-center justify-between rounded-[1.4rem] glass-card px-4 py-3.5 text-sm transition hover:bg-white/[0.06]"
>
  <div>
    <p className="font-medium text-white">Change password</p>
    <p className="mt-0.5 text-xs text-white/50">Update your account password.</p>
  </div>
  <span className="text-white/35">›</span>
</button>
```

**Pattern for fetch-and-refresh action** (lines 305-326, `NotifyToggle.toggle()`):
```typescript
async function toggle(next: boolean) {
  if (busy) return;
  const prev = enabled;
  setEnabled(next);
  setBusy(true);
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ [field]: next }),
  });
  setBusy(false);
  if (!res.ok) {
    setEnabled(prev);
    return;
  }
  startTransition(() => router.refresh());
}
```

**Replay button adaptation** — no optimistic state needed (replay reactivates server state; TourProvider re-derives currentStepId on next render after the PATCH response). Use `useTransition` + `router.refresh()` to get a fresh `initialProgress` from the layout RSC, which then flows into `TourProvider`.

**Imports already in file** (lines 1-16 — no new imports needed beyond what exists):
```typescript
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// ... Button, Link, icons already imported
```

---

### `src/app/(tabs)/groups/page.tsx` (page RSC, CRUD)

**Change:** Derive `hasActiveChallenge` flag from already-fetched data and pass it to a new `PactLiveOverlay` client component.

**`activeMemberships` already computed** (lines 134-136):
```typescript
const activeMemberships = memberships.filter(
  (m) => (membersByGroup.get(m.group_id)?.size ?? 0) >= 2
);
```

**`hasActiveChallenge` derivation** — derived inline from `activeMemberships.length > 0`; no extra DB query needed.

**`data-pending-count` DOM attr pattern** (line 143) — the established RSC-to-client data channel in this codebase. Phase 6 uses a prop on a client component instead (cleaner for a boolean flag), but documents this as the established pattern:
```typescript
data-pending-count={pendingCount}
// consumed in coachmark-renderer.tsx line 74:
const el = document.querySelector("[data-pending-count]");
const n = Number(el.getAttribute("data-pending-count"));
```

**Render pattern for conditional client component at bottom of RSC** (lines 138-233) — pass flag as prop:
```typescript
return (
  <>
    <main ...>
      {/* existing content */}
    </main>
    {/* Phase 6 addition — client component, renders null until first active challenge */}
    <PactLiveOverlay hasActiveChallenge={activeMemberships.length > 0} />
  </>
);
```

---

### `src/components/pact-live-overlay.tsx` (new component, event-driven)

**No existing file — new component.** Closest analog: `src/components/notifications-overlay.tsx`.

**Analog — portal + fixed full-screen overlay** (lines 83-101 of notifications-overlay.tsx):
```typescript
return createPortal(
  <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-xl">
    <div
      className="flex items-center justify-between border-b border-white/10 bg-black/60 px-4 pb-4 backdrop-blur-xl"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
```

**Analog — mount guard pattern** (lines 37-49 of notifications-overlay.tsx):
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
// ...
if (!open || !mounted) return null;
return createPortal(...)
```

**"seen" persistence:** use `complete_step: "pact_live_seen"` via PATCH to `/api/onboarding-progress`. This reuses the existing endpoint and persists across devices. The `pact_live_seen` key satisfies `STEP_KEY_REGEX` (`/^[a-z0-9_]{1,40}$/`), is not in `TEACHING_KEYS` (so it never gates tour completion), and `isTourComplete()` is unaffected.

**Seen-check on mount:** `completed_steps` is available in `TourProvider` context via `useTour()` — but `PactLiveOverlay` is not inside `TourProvider` (it's in the groups page, which IS inside TourProvider via the tabs layout). So `useTour()` is available. Check `progress.completed_steps` via a new `useTour()` hook read — or pass `completedSteps` as a prop from the RSC. Simpler: accept `completedSteps` as a prop from the RSC (already fetched in layout; pass from groups page RSC or read from `TourProvider` context). Claude decides: using `useTour()` context is cleaner (no extra prop drilling from the RSC).

**Z-index:** coachmark is `z-[110]` (Phase 4). Overlay must be `z-[120]` or higher so "pact is live" is above the coachmark if both are simultaneously active.

**Imports pattern** (notifications-overlay.tsx lines 1-8):
```typescript
"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
```

**Body scroll-lock pattern** (notifications-overlay.tsx lines 52-55):
```typescript
const previous = document.body.style.overflow;
document.body.style.overflow = "hidden";
// cleanup:
document.body.style.overflow = previous;
```

---

### Deleted files — coupling points to clean up

**`src/app/onboarding/username/client.tsx` line 72** — redirects to `/onboarding/schedule` after username save. Phase 6 must change this to redirect to the first tab (e.g., `/dashboard`) since the schedule wizard page is being deleted.

**`src/components/tour/coachmark-renderer.tsx` lines 13-14** — imports `GymSurface` and `ScheduleSurface`. These surface components themselves are NOT deleted (they live in `src/components/onboarding/`); only the wizard pages are deleted. No import change needed in the renderer.

**Nothing else imports the deleted paths** — grep confirmed only the wizard page clients and `username/client.tsx` reference them.

---

## Shared Patterns

### Auth — all route handlers
**Source:** `src/app/api/onboarding-progress/route.ts` lines 16-23
```typescript
const supabase = createClient();
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

### Error handling — all route handlers
**Source:** `src/app/api/onboarding-progress/route.ts` lines 28-33
```typescript
if (error) {
  return NextResponse.json(
    { error: "db_error", detail: error.message },
    { status: 500 }
  );
}
```

### Fetch + refresh pattern (client components calling PATCH endpoints)
**Source:** `src/app/(tabs)/settings/client.tsx` lines 315-326 (`NotifyToggle.toggle`)
```typescript
setBusy(true);
const res = await fetch("/api/onboarding-progress", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ replay: true }),
});
setBusy(false);
if (!res.ok) { /* revert */ return; }
startTransition(() => router.refresh());
```

### Full-screen overlay shell (new PactLiveOverlay)
**Source:** `src/components/notifications-overlay.tsx` lines 83-101
- `fixed inset-0 z-[120]` (above coachmark z-110)
- `bg-black/90 backdrop-blur-xl`
- `createPortal(..., document.body)`
- Mount guard: `useState(false)` + `useEffect(() => setMounted(true), [])`

### Glass card row (settings-style list items)
**Source:** `src/app/(tabs)/settings/client.tsx` lines 208-219
- `rounded-[1.4rem] glass-card px-4 py-3.5 text-sm`
- Ghost variant: omit background, add `text-white/60` or `opacity-70`

---

## No Analog Found

None. All new files have sufficient analogs in the codebase.

---

## Coupling Inventory (critical for planner)

| Coupling Point | File | Line | What Phase 6 Must Do |
|---|---|---|---|
| Neutral probe stubs | `src/components/tour-provider.tsx` | 56-59 | Replace `gymCount: 0, restDays: []` with real props |
| Layout RSC data fetch | `src/app/(tabs)/layout.tsx` | 68 | Add `user_gyms` count + `profile.rest_days` fetch |
| TourProvider prop signature | `src/components/tour-provider.tsx` | 37-43 | Add `gymCount` and `restDays` props |
| useMemo deps | `src/components/tour-provider.tsx` | 62 | Add `gymCount`, `restDays` to deps array |
| PatchBody schema | `src/lib/onboarding-progress.ts` | 17-29 | Add `replay: z.literal(true).optional()` |
| mergeProgress fn | `src/lib/onboarding-progress.ts` | 72-89 | Handle `replay: true` → `dismissed: false` |
| Username wizard redirect | `src/app/onboarding/username/client.tsx` | 72 | Change `/onboarding/schedule` → `/dashboard` |
| Groups RSC return | `src/app/(tabs)/groups/page.tsx` | 138 | Add `<PactLiveOverlay>` below `<main>` |

## Metadata

**Analog search scope:** `src/app/`, `src/lib/`, `src/components/`
**Files read:** 13
**Pattern extraction date:** 2026-06-18
