# Testing

**Analysis Date:** 2026-06-14

## Framework

- **Vitest 4.1.7** — unit test runner with Vite integration
- Config: `vitest.config.ts`
- No React component / E2E test layer present — tests target pure domain logic only.

## Configuration

`vitest.config.ts`:
- `resolve.alias` mirrors the tsconfig `@/*` → `src/*` path alias
- `test.include`: `["src/**/*.test.ts"]`
- **Worker pool forced to `threads`** via CLI flag in the npm scripts. The default `forks` pool fails to initialize the runner on Node 25 (`Cannot read properties of undefined (reading 'config')`); the config-level `pool` option is *not* honored, so the flag must stay on the command line.

## Running Tests

```bash
npm test          # vitest run --pool=threads   (one-shot)
npm run test:watch  # vitest --pool=threads     (watch mode)
```

Other quality gates:
```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```

## Test Structure

- **Co-located** — each test sits beside its module: `time.test.ts` next to `time.ts`.
- All current tests live in `src/lib/`:
  - `src/lib/time.test.ts` — timezone normalization, `localDay`/`previousLocalDay`
  - `src/lib/checkin-reconciliation.test.ts` — day reconciliation
  - `src/lib/checkin-reconciliation.week.test.ts` — weekly reconciliation (split by concern, same module)
  - `src/lib/derived-status.test.ts` — member status derivation
  - `src/lib/period-stats.test.ts` — period statistics

## Conventions

- Style: `describe` / `it` / `expect` from `"vitest"` (explicit imports, no globals).
- One `describe` block per exported function; `it` names state expected behavior in plain English ("falls back to the default for invalid, empty, or missing zones").
- Tests exercise edge cases deliberately — invalid IANA zones, empty/null/undefined inputs, boundary days.
- A module with non-trivial branching may be split across multiple `*.test.ts` files by concern (see the two `checkin-reconciliation` test files).

## Example

From `src/lib/time.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from "./time";

describe("normalizeTimeZone", () => {
  it("keeps valid IANA zones", () => {
    expect(normalizeTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
  });
  it("falls back to the default for invalid, empty, or missing zones", () => {
    expect(normalizeTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
  });
});
```

## Mocking & Fixtures

- No mocking library in use (no `vi.mock`, no MSW). Domain functions are pure and tested with inline literal inputs.
- No fixture/factory files — test data is constructed inline per test.
- No database or Supabase integration tests; the data layer is exercised manually / in production, not in CI.

## Coverage

- **No coverage tooling configured** (no `--coverage`, no `@vitest/coverage-*` dependency).
- Effective coverage is concentrated on the highest-risk pure logic: reconciliation, derived status, period stats, time math.
- **Gaps:** API route handlers (`src/app/api/**`), Supabase client factories, components, enforcement (`enforcement.ts`), money (`money.ts`), and geo (`geo.ts`) have no automated tests. See `CONCERNS.md`.

---

*Testing analysis: 2026-06-14*
