# Phase 1: Onboarding Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 1-onboarding-data-foundation
**Areas discussed:** Row provisioning, PATCH merge shape, Legacy v1.0 reconciliation, shortcut_viewed placement

(Gray area offered but not selected: Step-key validation — defaulted to format regex + Zod strict.)

---

## Row provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy upsert | No row until first write; GET returns default empty progress; PATCH upserts on conflict(user_id). Matches profile_secrets. | |
| DB trigger on profile insert | Trigger auto-creates blank row on profile creation; still needs backfill for existing users. | |
| Backfill migration + trigger | Create rows for all existing profiles now, trigger for future ones. Row always exists. | ✓ |

**User's choice:** Backfill migration + trigger
**Notes:** Combined with the legacy-reconciliation choice — backfill seeds done-rows for `onboarding_complete=true` users, blank rows otherwise; trigger covers new profiles.

---

## PATCH merge shape

| Option | Description | Selected |
|--------|-------------|----------|
| Server appends one key | Client sends a single step key + optional last_step_id/dismissed; server dedupes into completed_steps. Idempotent, race-safe (Pitfall 4). | ✓ |
| Client sends full array | Client PATCHes whole completed_steps array, server overwrites (last-write-wins). Simpler but clobber/race-prone. | |

**User's choice:** Server appends one key

---

## Legacy v1.0 reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| No backfill, derive | Leave legacy users rowless; Phase 3 gate treats missing row + onboarding_complete=true as done. | |
| Backfill done-rows | Migration writes a row per onboarding_complete=true user with mandatory_done=true, dismissed=true, completed_at=now(). | ✓ |

**User's choice:** Backfill done-rows
**Notes:** Consistent with the "backfill + trigger" provisioning choice — one migration seeds everyone.

---

## shortcut_viewed placement (Open Q5)

| Option | Description | Selected |
|--------|-------------|----------|
| completed_steps entry | shortcut_viewed is a semantic key in completed_steps JSONB. No new column. | ✓ |
| profiles column | Dedicated profiles.shortcut_viewed boolean. Queryable but wider migration surface. | |

**User's choice:** completed_steps entry

---

## Claude's Discretion

- Step-key validation: format regex `^[a-z0-9_]{1,40}$` + Zod strict object (reject unknown fields).
- `tour_version` integer default 1; column defaults (`completed_steps '[]'::jsonb`, booleans false, `completed_at`/`last_step_id` nullable).
- `completed_at` persisted as given; the rule that sets it is Phase 2.
- Upsert conflict target `user_id`, mirroring profile_secrets.

## Deferred Ideas

- "Tour complete" definition (Open Q3) — Phase 2 logic; Phase 1 only persists the `completed_at` field.
- Step registry / `TOUR_VERSION` constant — Phase 2.
- Step-key value validation against the real registry — Phase 2 (Phase 1 validates format only).
