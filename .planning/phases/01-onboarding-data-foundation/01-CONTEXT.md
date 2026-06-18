# Phase 1: Onboarding Data Foundation - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Walkthrough progress is durably persisted per user, server-side, with an idempotent, validated read/write path that survives interruption and works across devices.

**Delivers:** migration `0030_onboarding_progress` (table + RLS + backfill + trigger) and `GET/PATCH /api/onboarding-progress` (Zod-validated).

**Locked skeleton (from research, not re-litigated):**
- Dedicated `onboarding_progress` table — NOT a JSONB column on `profiles`.
- Columns: `mandatory_done`, `tour_version`, `last_step_id`, `completed_steps` (JSONB array of semantic string keys), `dismissed`, `completed_at`.
- Owner-only RLS (`auth.uid() = user_id`), all four verbs.
- `GET/PATCH /api/onboarding-progress`, Zod at the boundary, idempotent additive append.
- Semantic string step keys (not indices).

**Not this phase:** step registry / `TOUR_VERSION` constant (Phase 2), completion probes (Phase 2), TourProvider wiring (Phase 3), any coachmark UI (Phase 4+). The "tour complete" definition (Open Q3) is Phase 2 logic — Phase 1 only persists `completed_at`.

</domain>

<decisions>
## Implementation Decisions

### Row provisioning
- **D-01:** Backfill migration **+** trigger. The migration inserts a row for every existing profile; a trigger on `profiles` insert creates a row for each new profile. A row therefore always exists — GET should not normally hit the empty case (but still handle a missing row defensively).

### Legacy v1.0 reconciliation
- **D-02:** Backfill writes **done-rows** for existing users with `profiles.onboarding_complete = true`: `mandatory_done = true`, `dismissed = true`, `completed_at = now()` — so shipped users are never re-tutorialized. Users with `onboarding_complete = false` get a blank row (`mandatory_done = false`, `dismissed = false`, `completed_at = null`, `completed_steps = '[]'`).
- **D-03:** The new `onboarding_progress` table is the source of truth for tour state going forward; `profiles.onboarding_complete` is only read at backfill time to seed it.

### PATCH merge shape
- **D-04:** Client sends a **single** semantic step key to append (e.g. `{ complete_step: "gym" }`), plus optional `last_step_id`, `mandatory_done`, `dismissed`. Server reads the row, dedupes the key into `completed_steps`, and writes. Replaying the same key is a no-op (true idempotent additive append — addresses Pitfall 4 write races). NOT a client-sent full-array overwrite.

### shortcut_viewed placement (Open Q5)
- **D-05:** `shortcut_viewed` is a semantic key inside `completed_steps` JSONB — **no** dedicated `profiles` column, no extra migration surface. Phase 2 completion probe reads it from there.

### Claude's Discretion (locked defaults unless planner finds reason otherwise)
- Step-key validation: format regex `^[a-z0-9_]{1,40}$`, Zod **strict** object (reject unknown/extra fields) → satisfies success criterion 3 without coupling Phase 1 to the Phase 2 step registry.
- `tour_version`: integer, default `1`.
- Column defaults: `completed_steps default '[]'::jsonb`, `mandatory_done default false`, `dismissed default false`, `completed_at` nullable, `last_step_id` nullable text.
- `completed_at` is persisted as given by the caller; the rule that *sets* it ("tour complete" definition, Open Q3) is Phase 2 logic.
- Upsert conflict target on `user_id` (unique), mirroring the `profile_secrets` upsert pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §"Progress & Persistence" — PROG-01 (server-side persisted, resume + cross-device), PROG-04 (replay handles `tour_version` changes without breaking on stale targets).
- `.planning/ROADMAP.md` §"Phase 1: Onboarding Data Foundation" — goal + 4 success criteria.

### Research (data-layer decisions originate here)
- `.planning/research/SUMMARY.md` — dedicated table vs JSONB rationale, write-path (GET/PATCH, Zod, idempotent append), Pitfall 4 (write races) & Pitfall 6 (tour-version drift), Open Questions 3 & 5.
- `.planning/research/PITFALLS.md` — Pitfall 4 / Pitfall 6 detail.

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md` — naming, layering, Vitest expectations.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0012_user_gyms.sql` — closest RLS template: own-row policies (`auth.uid() = user_id`) for select/insert/update/delete, idempotent (`if not exists`, `drop policy if exists`), plus an in-migration backfill `insert ... select` — direct analog for the `onboarding_progress` backfill.
- `src/app/api/profile/route.ts` — API route template: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `createClient()` server client, `auth.getUser()` 401 guard, Zod `Body.safeParse` → `{ error: "validation_failed", issues }` 400.
- `profile_secrets` upsert (`.upsert({...}, { onConflict: "user_id" })`, seen in `profile/route.ts`) — pattern for PATCH upsert keyed on `user_id`.

### Established Patterns
- Next migration number = **`0030`** (last is `0029_profile_column_privacy.sql`).
- `profiles.onboarding_complete` boolean already exists (added in `0014_onboarding_complete.sql`, defaults false; v1.0 real-username users set true) — read it for the D-02 backfill seed.
- All user-facing tables enable RLS; admin client is server-only and not needed here (owner-scoped RLS suffices).

### Integration Points
- New table FK: `user_id uuid references public.profiles(id) on delete cascade` (matches `user_gyms`).
- New route folder: `src/app/api/onboarding-progress/route.ts` — consumed in Phase 3 by the `(tabs)` layout server fetch (hydrates TourProvider on first paint).

</code_context>

<specifics>
## Specific Ideas

- PATCH contract example: `{ complete_step: "gym", last_step_id: "gym" }` → server appends `"gym"` to `completed_steps` if absent, sets `last_step_id`. Re-sending the same body changes nothing.
- GET response shape mirrors the row: `{ mandatory_done, tour_version, last_step_id, completed_steps, dismissed, completed_at }`.

</specifics>

<deferred>
## Deferred Ideas

- "Tour complete" definition — first live challenge vs all-four-taught (Open Q3). Schema field (`completed_at`) lands here; the rule that sets it is **Phase 2**.
- Step registry / `TOUR_VERSION` constant — **Phase 2**. Phase 1 stores `tour_version` as an opaque integer.
- Step-key *value* validation against the real registry — **Phase 2**; Phase 1 validates format only.

None of the above is scope creep — all are downstream phases already on the roadmap.

</deferred>

---

*Phase: 1-onboarding-data-foundation*
*Context gathered: 2026-06-15*
