# Coding Conventions

**Analysis Date:** 2026-06-14

## Naming Patterns

**Files:**
- kebab-case for filenames: `check-in-button.tsx`, `checkin-reconciliation.ts`, `period-stats.ts`
- Component files (React): suffixed with `.tsx`
- Utility/logic files: `.ts` extension
- Test files: `*.test.ts` naming convention
- Page routes: `page.tsx` in Next.js app directory structure
- Client components: explicitly marked with `"use client"` directive at top

**Functions:**
- camelCase for all function names: `normalizeTimeZone()`, `computePeriodStats()`, `deriveDayStatus()`
- Internal helper functions (not exported) start with lowercase: `partsInZone()`, `addDays()`, `daysBetween()`
- Type predicate functions: `isClosedDay()`, `isValidTimeZone()`, `shouldCountTowardStreak()`

**Variables:**
- camelCase for JavaScript variables: `userId`, `statusByDay`, `weeklyGoal`, `currentCycleDay`
- Database field names kept as snake_case in type definitions matching schema: `local_day`, `flow_level`, `user_id`, `group_id`, `occurrence_at`
- Constants in SCREAMING_SNAKE_CASE: `DEFAULT_TIME_ZONE`, `MIN_CYCLE`, `MAX_CYCLE`, `ACTIVE_STATUSES`
- State variables (React hooks): camelCase with descriptive names: `busy`, `pendingUnverified`, `message`, `error`
- Loop counters: short names acceptable (`i`, `n`) but descriptive where context is unclear

**Types:**
- PascalCase for type names: `PeriodRecord`, `CycleSummary`, `Regularity`, `CyclePhase`, `CheckinResponse`
- Type prefixes for clarity: `*Summary` for aggregated data, `*Row` for database rows
- Union types for status/state: explicit string literals in type definitions: `"verified" | "unverified" | "rest_day"`
- Generic type parameters: single uppercase letters or descriptive: `T`, `Row`, `Seed`

## Code Style

**Formatting:**
- 2-space indentation (inferred from codebase)
- Line length appears flexible (no strict limit enforced)
- Semicolons required at end of statements
- Trailing commas in multiline objects/arrays
- No prettier config file detected; follows Next.js/TypeScript defaults

**Linting:**
- ESLint configured with `next/core-web-vitals` preset (`.eslintrc.json`)
- Strict TypeScript mode enabled (`strict: true` in `tsconfig.json`)
- Import sorting: not explicitly enforced by linting, but follows a consistent pattern

**Spacing:**
- One blank line between top-level definitions
- Function signatures on single line when possible; parameters wrap if too long
- Object literals with readable formatting for options/config objects

## Import Organization

**Order:**
1. External packages (React, Next.js, third-party): `import { useTransition } from "react"`; `import { NextRequest } from "next/server"`; `import { z } from "zod"`
2. Type imports from external packages: `import type { SupabaseClient } from "@supabase/supabase-js"`
3. Local lib imports: `import { normalizeTimeZone } from "@/lib/time"`
4. Local lib type imports: `import type { CheckinStatus } from "@/lib/types"`
5. Component imports: `import { Button } from "@/components/ui/button"`
6. Supabase-specific imports separate: `import { createAdminClient } from "@/lib/supabase/admin"`

**Path Aliases:**
- `@/*` → `src/*` (configured in `tsconfig.json`, mirrored in `vitest.config.ts`)
- Always use `@/` for local imports, never relative paths like `../lib`

**Sorting within groups:** Alphabetical or grouped by semantic relationship (related functions imported together)

## Error Handling

**Patterns:**
- Try-catch for network operations: `try { await res.json() } catch { return {} }`
- Fallback pattern common for JSON parsing: `.catch(() => ({}))`
- Explicit null checks rather than optional chaining in many cases
- Type-safe error handling with Zod: `const parsed = Body.safeParse(payload)` → check `parsed.success`
- Database errors returned in response: `{ error: "db_error", detail: errorMessage }`
- No custom error classes; error objects contain `error` string + optional `detail` property
- Silent catch blocks for best-effort operations (e.g., push notifications)

## Logging

**Framework:** No dedicated logging library; uses native `console` methods where needed (minimal logging observed)

**Patterns:**
- Debug comments use `//` inline comments explaining non-obvious logic
- Multi-line comments for complex sections explain the "why"
- Error states logged implicitly through response status codes, not console.log

## Comments

**When to Comment:**
- Explain non-obvious algorithmic choices (e.g., "This is good enough; on DST boundaries...")
- Document business logic around data constraints (cycle length windows, grace periods)
- Mark manual workarounds or defensive code (e.g., "Defensive: if subtracting 24h didn't change...")
- Provide context on timezone handling and YYYY-MM-DD format expectations
- Explain database-level logic (upsert semantics, unique key constraints)

**JSDoc/TSDoc:**
- Minimal usage; prefer inline comments over JSDoc blocks
- Used occasionally for complex functions: `/** Build N consecutive period-day records starting at start (YYYY-MM-DD). */`
- Type definitions inline in type annotations; no separate @param blocks
- Comments on exported functions explain behavior; internal helpers documented inline

## Function Design

**Size:** Functions stay focused; most under 50 lines; complex orchestration functions (like `reconcileUserDay`) split concerns explicitly

**Parameters:**
- Named parameters preferred when more than 2 args: `deriveDayStatus({ recorded, day, today, isRestDay })`
- Options objects common for configuration: `{ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }`
- Type definitions for parameter objects kept near function signature

**Return Values:**
- Functions return domain types: `PeriodStats`, `CycleSummary[]`, `Map<string, number>`
- Null/undefined used to indicate absence: `currentCycleDay: number | null`
- Success/error patterns use response objects: `{ data: T, error: null } | { data: null, error: ErrorString }`
- Early returns used to exit error paths: `if (!candidate) return DEFAULT_TIME_ZONE`

## Module Design

**Exports:**
- Named exports preferred: `export function normalizeTimeZone()`
- Type exports separate: `export type PeriodStats = { ... }`
- Barrel files not used; import directly from module path

**Structure:**
- Pure utility/logic modules: `src/lib/*.ts` (no side effects, testable)
- React components: `src/components/*.tsx` with `"use client"` at top
- API routes: `src/app/api/*/route.ts` following Next.js conventions
- Page components: `src/app/*/page.tsx`
- Shared type definitions: `src/lib/types.ts`

**Constants:**
- Global constants defined at module top: `const MIN_CYCLE = 15`, `const ACTIVE_STATUSES = new Set([...])`
- Environment-derived constants set early: `DEFAULT_TIME_ZONE`, `VAPID_PUBLIC_KEY`

---

*Convention analysis: 2026-06-14*
