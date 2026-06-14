<!-- GSD:project-start source:PROJECT.md -->

## Project

**SweatPact**

SweatPact is a full-stack Next.js PWA that pairs two people in a gym-accountability challenge with real money on the line. Members commit to a weekly workout goal, verify check-ins by location (iOS Shortcut or manual), and settle up financially based on who actually showed up. A cycle-tracking layer adds a second competitive vector for users who opt in. It's for competitive fitness pairs — friends, partners, gym duos — who want social accountability backed by financial stakes, not just another logging tool.

**Core Value:** Make showing up have a consequence: if you skip, you owe your partner — the head-to-head financial stake is the one thing that must work.

### Constraints

- **Tech stack**: Next.js 14 (App Router), React 18, TypeScript strict, Tailwind + shadcn/Radix — established; new work should match.
- **Data layer**: Supabase Postgres with RLS as the primary authorization mechanism; admin (service-role) client is server-only.
- **Validation**: Zod at every API boundary; financial correctness is server-authoritative (clients cannot forge verified status).
- **Verification**: Check-ins must be geo-verified server-side; timestamps accepted only for local today/yesterday.
- **Platform**: Node.js runtime required for routes using the Supabase admin client (not Edge-compatible).
- **Testing**: Vitest; domain rule changes in `src/lib/*` require updating co-located `*.test.ts`.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.6.2 - All application and library code in `src/`
- TSX - React components with JSX syntax
- JavaScript - Configuration files (Next.js, Tailwind, PostCSS, Vitest config)
- SQL - Postgres database migrations in `supabase/migrations/`

## Runtime

- Node.js (via Next.js runtime)
- Browser (React 18.3.1)
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

- Next.js 14.2.35 - Full-stack React framework with App Router, API routes, SSR/RSC
- React 18.3.1 - UI component library
- Radix UI - Headless component library (react-dialog, react-dropdown-menu)
- Tailwind CSS 3.4.13 - Utility-first CSS framework
- shadcn/ui - Pre-built component system (imported via Radix UI primitives)
- Lucide React 0.468.0 - SVG icon library
- Zod 3.23.8 - TypeScript-first schema validation and data parsing
- Class Variance Authority 0.7.0 - Component class composition
- clsx 2.1.1 - Conditional className utility
- Tailwind Merge 2.5.4 - Smart Tailwind class merging
- Tailwindcss-Animate 1.0.7 - Tailwind animation utilities
- react-easy-crop 5.5.7 - Image cropping component
- @vvo/tzdb 6.198.0 - Timezone database
- web-push 3.6.7 - Web Push Notifications (VAPID)
- Vitest 4.1.7 - Unit test runner with Vite integration
- Configuration: `vitest.config.ts`
- Test files: `src/**/*.test.ts` pattern
- Tailwind CSS 3.4.13 - CSS generation and compilation
- PostCSS 8.4.47 - CSS transformations
- Autoprefixer 10.4.20 - Vendor prefix automation
- ESLint 8.57.1 - Linting with Next.js preset
- TypeScript 5.6.2 - Type checking and compilation

## Key Dependencies

- @supabase/supabase-js 2.45.4 - Supabase client SDK (auth, database, real-time)
- @supabase/ssr 0.5.2 - Supabase server-side rendering helpers for Next.js
- web-push 3.6.7 - VAPID-based Web Push notifications
- zod 3.23.8 - Runtime schema validation (all API routes)

## Configuration

- `.env.local` (development) - Local development configuration
- `.env.example` - Example template with all required variables
- Required env vars:
- `tsconfig.json` - TypeScript configuration (ES2022 target, strict mode, path aliases `@/*`)
- `next.config.mjs` - Next.js config with React strict mode enabled
- `postcss.config.mjs` - PostCSS plugins (Tailwind CSS, Autoprefixer)
- `tailwind.config.ts` - Tailwind theming (dark mode class-based, custom color scheme with CSS variables)
- `.eslintrc.json` - ESLint extends `next/core-web-vitals`
- `vitest.config.ts` - Vitest config with path alias mirror, threads pool, test file pattern

## Platform Requirements

- Node.js (v18+, per Next.js 14 support matrix)
- npm (v9+)
- Supabase account (local or cloud)
- Google Maps API credentials (for gym search feature)
- VAPID keypair generation via `npx web-push generate-vapid-keys`
- Deployment target: Vercel (optimized for Next.js)
- Vercel Cron for scheduled enforcement job (`/api/cron/enforce` at 19:00 UTC daily)
- Supabase cloud project (database, auth, storage)
- Vercel environment variables for all secrets

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- kebab-case for filenames: `check-in-button.tsx`, `checkin-reconciliation.ts`, `period-stats.ts`
- Component files (React): suffixed with `.tsx`
- Utility/logic files: `.ts` extension
- Test files: `*.test.ts` naming convention
- Page routes: `page.tsx` in Next.js app directory structure
- Client components: explicitly marked with `"use client"` directive at top
- camelCase for all function names: `normalizeTimeZone()`, `computePeriodStats()`, `deriveDayStatus()`
- Internal helper functions (not exported) start with lowercase: `partsInZone()`, `addDays()`, `daysBetween()`
- Type predicate functions: `isClosedDay()`, `isValidTimeZone()`, `shouldCountTowardStreak()`
- camelCase for JavaScript variables: `userId`, `statusByDay`, `weeklyGoal`, `currentCycleDay`
- Database field names kept as snake_case in type definitions matching schema: `local_day`, `flow_level`, `user_id`, `group_id`, `occurrence_at`
- Constants in SCREAMING_SNAKE_CASE: `DEFAULT_TIME_ZONE`, `MIN_CYCLE`, `MAX_CYCLE`, `ACTIVE_STATUSES`
- State variables (React hooks): camelCase with descriptive names: `busy`, `pendingUnverified`, `message`, `error`
- Loop counters: short names acceptable (`i`, `n`) but descriptive where context is unclear
- PascalCase for type names: `PeriodRecord`, `CycleSummary`, `Regularity`, `CyclePhase`, `CheckinResponse`
- Type prefixes for clarity: `*Summary` for aggregated data, `*Row` for database rows
- Union types for status/state: explicit string literals in type definitions: `"verified" | "unverified" | "rest_day"`
- Generic type parameters: single uppercase letters or descriptive: `T`, `Row`, `Seed`

## Code Style

- 2-space indentation (inferred from codebase)
- Line length appears flexible (no strict limit enforced)
- Semicolons required at end of statements
- Trailing commas in multiline objects/arrays
- No prettier config file detected; follows Next.js/TypeScript defaults
- ESLint configured with `next/core-web-vitals` preset (`.eslintrc.json`)
- Strict TypeScript mode enabled (`strict: true` in `tsconfig.json`)
- Import sorting: not explicitly enforced by linting, but follows a consistent pattern
- One blank line between top-level definitions
- Function signatures on single line when possible; parameters wrap if too long
- Object literals with readable formatting for options/config objects

## Import Organization

- `@/*` → `src/*` (configured in `tsconfig.json`, mirrored in `vitest.config.ts`)
- Always use `@/` for local imports, never relative paths like `../lib`

## Error Handling

- Try-catch for network operations: `try { await res.json() } catch { return {} }`
- Fallback pattern common for JSON parsing: `.catch(() => ({}))`
- Explicit null checks rather than optional chaining in many cases
- Type-safe error handling with Zod: `const parsed = Body.safeParse(payload)` → check `parsed.success`
- Database errors returned in response: `{ error: "db_error", detail: errorMessage }`
- No custom error classes; error objects contain `error` string + optional `detail` property
- Silent catch blocks for best-effort operations (e.g., push notifications)

## Logging

- Debug comments use `//` inline comments explaining non-obvious logic
- Multi-line comments for complex sections explain the "why"
- Error states logged implicitly through response status codes, not console.log

## Comments

- Explain non-obvious algorithmic choices (e.g., "This is good enough; on DST boundaries...")
- Document business logic around data constraints (cycle length windows, grace periods)
- Mark manual workarounds or defensive code (e.g., "Defensive: if subtracting 24h didn't change...")
- Provide context on timezone handling and YYYY-MM-DD format expectations
- Explain database-level logic (upsert semantics, unique key constraints)
- Minimal usage; prefer inline comments over JSDoc blocks
- Used occasionally for complex functions: `/** Build N consecutive period-day records starting at start (YYYY-MM-DD). */`
- Type definitions inline in type annotations; no separate @param blocks
- Comments on exported functions explain behavior; internal helpers documented inline

## Function Design

- Named parameters preferred when more than 2 args: `deriveDayStatus({ recorded, day, today, isRestDay })`
- Options objects common for configuration: `{ enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }`
- Type definitions for parameter objects kept near function signature
- Functions return domain types: `PeriodStats`, `CycleSummary[]`, `Map<string, number>`
- Null/undefined used to indicate absence: `currentCycleDay: number | null`
- Success/error patterns use response objects: `{ data: T, error: null } | { data: null, error: ErrorString }`
- Early returns used to exit error paths: `if (!candidate) return DEFAULT_TIME_ZONE`

## Module Design

- Named exports preferred: `export function normalizeTimeZone()`
- Type exports separate: `export type PeriodStats = { ... }`
- Barrel files not used; import directly from module path
- Pure utility/logic modules: `src/lib/*.ts` (no side effects, testable)
- React components: `src/components/*.tsx` with `"use client"` at top
- API routes: `src/app/api/*/route.ts` following Next.js conventions
- Page components: `src/app/*/page.tsx`
- Shared type definitions: `src/lib/types.ts`
- Global constants defined at module top: `const MIN_CYCLE = 15`, `const ACTIVE_STATUSES = new Set([...])`
- Environment-derived constants set early: `DEFAULT_TIME_ZONE`, `VAPID_PUBLIC_KEY`

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Overview

## Architecture Pattern

- **Presentation** — React Server/Client Components in `src/app/(tabs)/**` and `src/components/**`
- **API / transport** — Route Handlers in `src/app/api/**/route.ts` (REST-style, one folder per resource)
- **Domain logic** — Pure modules in `src/lib/` (reconciliation, enforcement, stats, time, money)
- **Data access** — Supabase client factories in `src/lib/supabase/` over Postgres with Row-Level Security

## Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Pages / UI | `src/app/(tabs)/`, `src/app/onboarding/`, `src/components/` | Rendering, user interaction |
| API routes | `src/app/api/**/route.ts` | Auth check, Zod validation, orchestration |
| Domain | `src/lib/*.ts` | Business rules — check-in reconciliation, penalty enforcement, period stats |
| Data | `src/lib/supabase/*.ts` | Client construction (browser / server / rsc / admin) |
| Database | `supabase/migrations/*.sql` | Schema, RLS policies, constraints |

## Data Flow

- Vercel Cron → `POST /api/cron/enforce` (`src/app/api/cron/enforce/route.ts`), bearer-authorized by `CRON_SECRET`
- Runs `src/lib/enforcement.ts` to close periods, compute missed-goal penalties (`src/lib/money.ts`, `src/lib/period-stats.ts`) and record settlements

## Key Abstractions

- **Supabase client factories** (`src/lib/supabase/`): `browser.ts` (client RLS), `server.ts` (server-component/route, cookie-bound RLS), `rsc.ts` (read-only RSC), `admin.ts` (service-role, bypasses RLS — server-only). Choosing the right one is the central privilege decision.
- **Reconciliation engine** (`src/lib/checkin-reconciliation.ts`): idempotent day/week reconciliation that derives status from raw check-in rows; heavily unit-tested.
- **Derived status** (`src/lib/derived-status.ts`): single source of truth for member status (`EXCUSED_STATUSES`, etc.).
- **Time/timezone** (`src/lib/time.ts`): IANA-zone-aware `localDay`/`previousLocalDay` — all period math is timezone-correct.

## Entry Points

- `src/app/layout.tsx` — root layout / app shell
- `src/app/page.tsx` — landing / redirect
- `src/middleware.ts` — refreshes Supabase session cookie on every request (excludes `api/checkin`, `api/cron`, static assets)
- `src/app/api/**/route.ts` — 32 API route handlers
- `src/app/api/cron/enforce/route.ts` — daily scheduled enforcement (19:00 UTC, see `vercel.json`)

## Cross-Cutting Concerns

- **Auth** — Supabase Auth; session cookies refreshed in middleware; routes call `supabase.auth.getUser()`
- **Authorization** — Postgres RLS (primary) + privilege-scoped client selection; admin client reserved for trusted server paths
- **Validation** — Zod schemas at every API boundary
- **Rate limiting** — Postgres-backed `src/lib/rate-limit.ts` on webhook/search endpoints
- **Notifications** — Web Push (VAPID) via `src/lib/push.ts`

## Related Docs

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
