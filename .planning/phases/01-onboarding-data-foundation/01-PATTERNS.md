# Phase 1: Onboarding Data Foundation - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 3 (2 new source files + 1 schema migration); 1 optional test file noted
**Analogs found:** 3 / 3 (all exact or strong role-matches)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0030_onboarding_progress.sql` | migration (table + RLS + backfill + trigger) | batch (one-time backfill) + event-driven (insert trigger) | `0012_user_gyms.sql` (table+RLS+backfill) **and** `0016_profile_secrets.sql` (auto-create row trigger) | exact (composite) |
| `src/app/api/onboarding-progress/route.ts` | route (API handler) | request-response: `GET` read-own + `PATCH` idempotent upsert | `src/app/api/profile/route.ts` (PATCH/Zod/upsert) + `src/app/api/gyms/route.ts` (clean GET own-row) | exact |
| `src/app/api/onboarding-progress/route.test.ts` (optional) | test | n/a | none — no API route has tests (see "No Analog Found") | none |

## Pattern Assignments

### `supabase/migrations/0030_onboarding_progress.sql` (migration; backfill + event-driven trigger)

**Migration number:** `0030` is correct (last is `0029_profile_column_privacy.sql`). All SQL is idempotent (`if not exists`, `drop policy if exists`, `on conflict do nothing`).

#### Table + index + FK (analog `0012_user_gyms.sql` lines 1-11)

`user_gyms` is the exact FK/index template. Copy the `user_id ... references public.profiles(id) on delete cascade` shape and the per-user index. Note: per CONTEXT D-04/discretion, `user_id` must be **unique** (one progress row per user) so the PATCH upsert can target `onConflict: "user_id"`. `profile_secrets` (`0016` line 5) uses `user_id` as the PK directly — that is the cleaner shape for a one-row-per-user table.

```sql
-- from 0012_user_gyms.sql (FK + cascade + index pattern)
user_id uuid not null references public.profiles(id) on delete cascade,
...
create index if not exists user_gyms_user_id_idx on public.user_gyms(user_id);
```

Apply CONTEXT column spec (D-01..D-05 / discretion): `completed_steps jsonb not null default '[]'::jsonb`, `mandatory_done boolean not null default false`, `dismissed boolean not null default false`, `tour_version integer not null default 1`, `last_step_id text`, `completed_at timestamptz`.

#### RLS — all four verbs, owner-only (analog `0012_user_gyms.sql` lines 13-29)

This is the direct template. Copy all four blocks verbatim, renaming `user_gyms` → `onboarding_progress`. Consider adding `to authenticated` as `0016` does (lines 22/26) — stricter, and CLAUDE.md states RLS is the primary authz mechanism.

```sql
alter table public.user_gyms enable row level security;

drop policy if exists "user_gyms_select_own" on public.user_gyms;
create policy "user_gyms_select_own" on public.user_gyms
  for select using (auth.uid() = user_id);

drop policy if exists "user_gyms_insert_own" on public.user_gyms;
create policy "user_gyms_insert_own" on public.user_gyms
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_gyms_update_own" on public.user_gyms;
create policy "user_gyms_update_own" on public.user_gyms
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_gyms_delete_own" on public.user_gyms;
create policy "user_gyms_delete_own" on public.user_gyms
  for delete using (auth.uid() = user_id);
```

#### In-migration backfill (analog `0012_user_gyms.sql` lines 31-39 + `0016` lines 12-16)

The `insert ... select ... where not exists` (or `on conflict do nothing`) idempotent backfill is the pattern. For this phase the backfill is **conditional on `profiles.onboarding_complete`** (D-02): existing complete users get a done-row, others a blank row. `onboarding_complete` exists from `0014_onboarding_complete.sql` (line 1-2, `boolean not null default false`).

```sql
-- 0012 idempotency guard (use on conflict do nothing when user_id is unique/PK, à la 0016 line 16)
insert into public.user_gyms (user_id, name, lat, lng, radius_m)
select id, 'My gym', gym_lat, gym_lng, coalesce(gym_radius_m, 150)
from public.profiles
where ...
  and not exists (select 1 from public.user_gyms g where g.user_id = profiles.id);
```

Phase-specific D-02 backfill (apply CONTEXT, not a copyable analog): one `insert ... select` reading `profiles.onboarding_complete` — `true` → `mandatory_done=true, dismissed=true, completed_at=now()`; `false` → blank row (`completed_steps='[]'::jsonb`). Guard with `on conflict (user_id) do nothing`.

#### Insert trigger — auto-create row per new profile (analog `0016_profile_secrets.sql` lines 34-53)

`0016` is the **only and exact** analog for "create a child row whenever a user/profile is created." `handle_new_user()` already inserts into `profile_secrets` on new-user creation (lines 47-49). Two valid implementations — the planner picks one:

- **Option A (mirror `0016` exactly):** extend/replace `public.handle_new_user()` to also `insert into public.onboarding_progress (user_id) values (new.id) on conflict (user_id) do nothing;` — same `security definer set search_path = public`, same `on conflict do nothing` idempotency. This keeps all "new user" side effects in one function (matches existing architecture).
- **Option B:** a dedicated `after insert on public.profiles` trigger. CONTEXT D-01 says "trigger on `profiles` insert," which favors B; however `handle_new_user()` inserts the profile row itself, so Option A is the lower-risk, codebase-consistent path. Note the existing function targets the `auth.users` insert path (it inserts the profile), so extending it covers the same provisioning moment.

```sql
-- 0016_profile_secrets.sql lines 34-53 — function shape to copy
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $func$
begin
  insert into public.profiles (id, email, name, gender) values (...) on conflict (id) do nothing;
  insert into public.profile_secrets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end
$func$;
```

> Planner caution: do NOT redefine `handle_new_user()` from scratch and drop the `profiles`/`profile_secrets` inserts — `create or replace` replaces the whole body. Preserve existing inserts and add the `onboarding_progress` one.

---

### `src/app/api/onboarding-progress/route.ts` (route; request-response)

**Folder:** `src/app/api/onboarding-progress/route.ts` (kebab-case, matches `user_gyms`→`/api/gyms` convention). **Primary analog:** `src/app/api/profile/route.ts`. **Secondary (GET):** `src/app/api/gyms/route.ts`.

#### Imports + runtime/dynamic exports (analog `profile/route.ts` lines 1-8 / `gyms/route.ts` lines 1-5)

Use the **non-admin** import set (gyms shape) — this route is owner-scoped, RLS suffices, no service-role needed (CONTEXT: "admin client ... not needed here"). Do **not** import `createAdminClient`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

#### GET — read caller's own row (analog `gyms/route.ts` lines 8-22)

Exact template. Return the row mirroring CONTEXT "GET response shape." GET must **defensively handle a missing row** (D-01) — fall back to a default-shaped object rather than 500/404.

```typescript
export async function GET() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await supabase
    .from("user_gyms")
    .select("...")
    .eq("user_id", auth.user.id)
    .order(...);
  return NextResponse.json({ gyms: data ?? [] });   // ← apply same `?? <default>` defensiveness
}
```

#### Zod boundary — strict object, regex step key (analog `profile/route.ts` lines 10-37, 46-52)

Copy the `Body.safeParse(await req.json().catch(() => null))` → `{ error: "validation_failed", issues: parsed.error.flatten() }` 400 pattern verbatim. The existing `username` field (lines 12-15) is the in-repo precedent for a `z.string().regex(...)` key. Per CONTEXT discretion: use `z.object({...}).strict()` (reject unknown fields) and step-key regex `^[a-z0-9_]{1,40}$`.

```typescript
const Body = z.object({
  username: z.string().regex(/^[A-Za-z0-9_]{3,20}$/, "username_format")...,  // regex-key precedent
  ...
});
// ...
const parsed = Body.safeParse(await req.json().catch(() => null));
if (!parsed.success) {
  return NextResponse.json(
    { error: "validation_failed", issues: parsed.error.flatten() },
    { status: 400 }
  );
}
```

Phase-specific PATCH body (CONTEXT D-04): `{ complete_step?: <stepKeyRegex>, last_step_id?: string, mandatory_done?: boolean, dismissed?: boolean, completed_at?: ... }` — single key append, NOT a full-array overwrite.

#### 401 auth guard (analog `profile/route.ts` lines 40-44, identical in `gyms`)

```typescript
const supabase = createClient();
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
```

#### Idempotent upsert keyed on user_id (analog `profile/route.ts` lines 84-89)

The `profile_secrets` upsert is the named pattern for `onConflict: "user_id"`. For the idempotent additive append (D-04): GET-then-merge (read row, dedupe `complete_step` into `completed_steps`, write) using `.upsert({ user_id, ... }, { onConflict: "user_id" })`. Because the trigger guarantees a row exists, an `.update().eq("user_id", ...)` is also valid; upsert is the safer choice against the defensive missing-row case.

```typescript
const { error: secretError } = await supabase
  .from("profile_secrets")
  .upsert(
    { user_id: auth.user.id, webhook_secret: newSecret },
    { onConflict: "user_id" }
  );
```

#### Error handling (analog `profile/route.ts` lines 90-95 / `gyms` lines 61-66)

```typescript
if (error) {
  return NextResponse.json(
    { error: "db_error", detail: error.message },
    { status: 500 }
  );
}
```

Success: `return NextResponse.json({ ok: true, ... })` (both analogs).

---

## Shared Patterns

### Auth guard (every route handler)
**Source:** `src/app/api/profile/route.ts` lines 40-44 (identical in `gyms/route.ts` 10-13, 34-37)
**Apply to:** both `GET` and `PATCH` in the new route.
```typescript
const supabase = createClient();
const { data: auth } = await supabase.auth.getUser();
if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
```

### Zod validation_failed envelope
**Source:** `src/app/api/profile/route.ts` lines 46-52
**Apply to:** PATCH body parsing.
```typescript
const parsed = Body.safeParse(await req.json().catch(() => null));
if (!parsed.success)
  return NextResponse.json({ error: "validation_failed", issues: parsed.error.flatten() }, { status: 400 });
```

### db_error envelope
**Source:** `src/app/api/profile/route.ts` lines 90-95
**Apply to:** every Supabase write in the route.
```typescript
return NextResponse.json({ error: "db_error", detail: error.message }, { status: 500 });
```

### Owner-only RLS, four verbs
**Source:** `supabase/migrations/0012_user_gyms.sql` lines 13-29 (add `to authenticated` per `0016` 22/26)
**Apply to:** the `onboarding_progress` table.

### Idempotent SQL
**Source:** all migrations — `create table if not exists`, `create index if not exists`, `drop policy if exists ... create policy`, `on conflict (...) do nothing` (`0016` 16/45/49).
**Apply to:** entire `0030` migration.

### Conventions honored (CLAUDE.md / codebase docs)
- kebab-case files (`onboarding-progress/route.ts`); `@/` imports only (no relative).
- snake_case DB columns; `runtime = "nodejs"` + `dynamic = "force-dynamic"` on the route.
- Zod at the boundary; financial/state correctness server-authoritative (no client full-array overwrite).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/api/onboarding-progress/route.test.ts` | test | n/a | No API route handler in the repo has tests — Vitest covers only pure `src/lib/*` modules (TESTING.md: "API route handlers ... have no automated tests"). If the planner wants the dedupe/merge tested, extract the merge into a pure `src/lib/*.ts` helper and co-locate a `*.test.ts` (the only testable seam per project conventions). |

## Metadata

**Analog search scope:** `supabase/migrations/`, `src/app/api/**`, `.planning/codebase/`
**Files scanned:** 0012, 0014, 0016 migrations; profile, gyms route handlers; TESTING.md; CONTEXT.md
**Pattern extraction date:** 2026-06-15
