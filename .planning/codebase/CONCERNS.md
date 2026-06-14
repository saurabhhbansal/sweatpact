# Codebase Concerns

**Analysis Date:** 2026-06-14

## Tech Debt

**Type Safety Gaps with `as any`:**
- Issue: Multiple files use `as any` casts instead of proper TypeScript types, bypassing compiler safety
- Files: `src/app/(tabs)/dashboard/page.tsx`, `src/app/(tabs)/groups/page.tsx`, `src/app/(tabs)/notifications/client.tsx`
- Impact: Runtime errors go undetected at compile time; refactoring becomes riskier; code intent unclear
- Fix approach: Create precise types for notification payloads, group data structures, and profile fields. Define discriminated unions for notification types to replace the generic `payload: any` pattern

**Untyped Client-Side State in Complex Components:**
- Issue: Large client components (`src/app/(tabs)/groups/[id]/client.tsx` at 751 lines, `src/app/(tabs)/shortcut/client.tsx` at 623 lines) manage multiple state booleans and string unions without discriminated unions
- Files: `src/app/(tabs)/groups/[id]/client.tsx` (multiple `useState` for dialog states), `src/app/(tabs)/cycle/client.tsx` at 535 lines
- Impact: Easy to create invalid state combinations (e.g., multiple dialogs open simultaneously); harder to reason about control flow
- Fix approach: Replace multiple `useState` calls with a single state machine using `useReducer` or a state union type

**Raw `.json()` Error Handling with Silent Fallbacks:**
- Issue: Multiple fetch operations use `.catch(() => ({}))` to swallow JSON parse errors without logging
- Files: `src/app/(tabs)/groups/[id]/client.tsx` (line 62), `src/app/(tabs)/notifications/client.tsx`
- Impact: When API returns non-JSON responses (e.g., network proxies, errors), error context is lost; debugging becomes harder
- Fix approach: Create a wrapper function that safely parses JSON with explicit error logging for different failure modes

## Database Query Safety

**Database Queries Without Explicit Limits:**
- Issue: Several queries fetch large result sets with `.select()` and no `.limit()` on potentially large tables
- Files: `src/lib/enforcement.ts` (line 28 fetches up to 10,000 profiles), `src/app/(tabs)/groups/[id]/page.tsx` (lines 64-100 query multiple tables with aggressive joins)
- Impact: On growth, enforcement cron could become slow; user group pages could timeout if groups have many members/obligations
- Fix approach: Add pagination or explicit limits to long-running queries; monitor query execution times in staging

**Missing Error Handling on Bulk Operations:**
- Issue: Batch delete operations in penalty clearing don't verify deletions succeeded
- Files: `src/lib/checkin-reconciliation.ts` (lines 120-142) deletes disputes and penalties in sequence but only checks the last error
- Impact: If a partial deletion fails midway, data consistency may be compromised; financial records could be inaccurate
- Fix approach: Wrap bulk deletes in a transaction; verify row counts before and after

## Security Considerations

**Webhook Secret Rotation Without Validation:**
- Issue: Secret rotation endpoint doesn't validate that the new secret was actually persisted before responding success
- Files: `src/app/(tabs)/shortcut/client.tsx` (line 71-77), no corresponding verification in `/api/profile` endpoint
- Impact: Client may show "Rotated!" but old secret still in use; Shortcut would silently fail; user confusion
- Fix approach: Return new secret in response; client should verify it matches what was sent

**CORS and API Surface Exposure:**
- Issue: Webhook endpoint at `/api/checkin` accepts both authenticated user requests AND secret-based requests; CORS headers not visible
- Files: `src/app/api/checkin/route.ts` (lines 71-93)
- Impact: If CORS misconfigured, cross-origin attacks could trigger checkins; rate limit is per-IP but not per-user for webhook calls
- Fix approach: Document CORS policy explicitly; consider separating webhook and UI checkin endpoints with different rate limits

**Timezone Data Dependency:**
- Issue: Timezone validation relies on `@vvo/tzdb` library without validating malformed user input
- Files: `src/lib/time.ts` (normalizeTimeZone function)
- Impact: Invalid timezone strings from database could cause silent fallbacks; user checkins assigned wrong local day
- Fix approach: Add explicit validation and fallback; log when normalization happens

## Performance Bottlenecks

**Enforcement Cron Scans All Profiles Without Pagination:**
- Problem: Daily cron job loads 10,000+ profiles into memory, processes each sequentially
- Files: `src/lib/enforcement.ts` (line 25-31)
- Cause: Single batch query with no cursor-based pagination; as userbase grows, cron window narrows
- Improvement path: Implement cursor-based pagination (fetch 100 at a time); parallelize independent user reconciliations with Promise.all

**Weekly Goal Verification Query on Every Status Page Load:**
- Problem: Dashboard page queries full profile object to extract `weekly_goal` field despite needing only one number
- Files: `src/app/(tabs)/dashboard/page.tsx` (lines for weekly_goal extraction)
- Cause: Overly broad `.select("*")` instead of `.select("weekly_goal, rest_days, timezone")`
- Improvement path: Scope API selections to only required fields; cache profile in React Server Component

**Group Page Parallel Queries Without Timeout:**
- Problem: Group detail page awaits 6 parallel Supabase queries with no timeout; slow queries block the entire page
- Files: `src/app/(tabs)/groups/[id]/page.tsx` (lines 64-101 Promise.all)
- Cause: No query timeout mechanism; one slow table read blocks all others
- Improvement path: Add query timeouts; implement graceful degradation (show partial data while loading)

## Fragile Areas

**Checkin Reconciliation Logic:**
- Files: `src/lib/checkin-reconciliation.ts` (479 lines)
- Why fragile: Complex precedence rules for status derivation; state mutations spread across multiple async functions; penalty side effects handled in separate transaction
- Safe modification: All changes require updating corresponding test cases in `src/lib/checkin-reconciliation.test.ts`; test coverage exists but adding new status types is error-prone
- Test coverage: Good coverage for status precedence, but missing edge case tests for concurrent penalty clearing

**Period Cycle Calculation Logic:**
- Files: `src/lib/period-stats.ts` (273 lines)
- Why fragile: Date math relies on UTC string parsing with custom split logic; off-by-one errors possible in cycle detection
- Safe modification: Changes require running full test suite; cycleLength window constants (15-90 days) are magic numbers
- Test coverage: Period-specific unit tests exist (`src/lib/period-stats.test.ts`) but integration tests missing

**Authorization Checks Across API Routes:**
- Files: `src/app/api/challenges/respond/route.ts` (lines 40-46), `src/app/api/groups/` endpoints
- Why fragile: Each route reimplements ownership/membership checks; no shared authorization middleware
- Safe modification: Centralize auth checks in a reusable function; audit all routes for consistent checks
- Test coverage: No automated authorization tests; manual testing required after auth changes

## Scaling Limits

**Database Connections at Concurrency:**
- Current capacity: Supabase default limits (likely 100-300 concurrent connections for Postgres)
- Limit: During enforcement cron or spike traffic, connection pool exhaustion possible
- Scaling path: Implement connection pooling via PgBouncer; add monitoring for pool utilization

**Webhook Rate Limiting Based on IP Only:**
- Current capacity: 20 requests per 60 seconds per IP
- Limit: If multiple users behind same NAT/proxy, legitimate requests get rate-limited
- Scaling path: Add user-id based rate limiting for authenticated webhook calls; implement exponential backoff

**Enforcement Cron Processing Time:**
- Current: Processes 10,000 profiles sequentially; with complex reconciliation, likely 5-10 minutes
- Limit: If user count grows to 50,000+, cron may exceed its scheduled window
- Scaling path: Implement batch processing with checkpoints; consider moving to background job queue

## Dependencies at Risk

**@supabase/ssr Version Mismatch Risk:**
- Risk: Package uses `@supabase/ssr` (0.5.2) with `@supabase/supabase-js` (2.45.4); version alignment required
- Impact: Breaking changes in Supabase JS client could require immediate updates; no version pinning strategy visible
- Migration plan: Keep supabase packages in sync; add automated dependency update workflow; test all routes after updates

**Zod Validation Not Enforced Everywhere:**
- Risk: Some API routes use Zod (`src/app/api/checkin/route.ts`), others don't (`src/app/api/profile` for PATCH)
- Impact: Inconsistent validation; future requests could send unexpected fields, causing silent bugs
- Migration plan: Audit all `POST/PATCH/PUT` routes; ensure all have Zod schemas; add ESLint rule to prevent unvalidated routes

**Next.js 14 Edge Runtime Constraints:**
- Risk: API routes marked `export const runtime = "nodejs"` are incompatible with Vercel Edge Functions
- Impact: Deployment flexibility limited; can't use Edge for lower latency
- Migration plan: Identify which routes truly need Node.js runtime (e.g., those using Supabase admin client); consider Edge-compatible alternatives

## Missing Critical Features

**No Transactional Guarantees Across Multiple Tables:**
- Problem: Multi-step operations (checkin → penalty → obligation creation) can partially fail, leaving data inconsistent
- Blocks: Complex financial workflows; dispute resolution; undo operations
- Example: In `src/lib/checkin-reconciliation.ts`, if obligation insert fails after penalty is created, the penalty persists orphaned

**No Undo/Audit Trail for Financial Actions:**
- Problem: Once a penalty is applied, only manual database edits can reverse it
- Blocks: User disputes about applied penalties; accountability for admins
- Current workaround: Disputes table exists but lacks automation for status-driven penalty reversal

**No Background Job Queue:**
- Problem: Heavy operations (push notifications, period sync) run inline during HTTP requests
- Blocks: Timeout protection; failure retry logic; distributed processing
- Current: Relies on Vercel Cron for one-off tasks; new requirements (batch email, webhooks) will queue up on main thread

## Test Coverage Gaps

**API Authorization Tests:**
- What's not tested: Authorization checks in API routes (ownership, membership, role-based access)
- Files: `src/app/api/challenges/respond/route.ts`, `src/app/api/groups/*`, `src/app/api/dispute/resolve/route.ts`
- Risk: Role-based access control regressions undetected; users could gain access to other users' data
- Priority: High — authorization bugs are security issues

**Integration Tests for Penalty Workflows:**
- What's not tested: End-to-end flows (checkin → missed day → penalty creation → dispute → resolution)
- Files: `src/lib/checkin-reconciliation.ts`, `src/app/api/disputes/`, `src/app/api/cron/enforce/`
- Risk: Edge cases in penalty timing or calculation slip through; financial correctness unverified
- Priority: High — penalties directly affect user balances

**Client-Side State Transitions:**
- What's not tested: Dialog state management, form validation, error recovery in React components
- Files: `src/app/(tabs)/groups/[id]/client.tsx`, `src/app/(tabs)/notifications/client.tsx`
- Risk: UI gets into invalid states (multiple dialogs open, stale data); user experience broken
- Priority: Medium — affects usability but not core logic

**Period Cycle Edge Cases:**
- What's not tested: Cycle detection with gaps >1 day, retroactive logging, irregular cycles
- Files: `src/lib/period-stats.ts`
- Risk: Women tracking period data get incorrect cycle predictions or phase estimates
- Priority: High — impacts user trust in feature

## Code Quality Issues

**Inconsistent Error Logging:**
- Issue: Some functions log errors with context, others silently fail
- Files: `src/lib/enforcement.ts` logs with context (line 72-75), but most client code silently catches errors
- Impact: Production debugging difficult; silent failures mask bugs

**Missing Input Sanitization on User-Provided Data:**
- Issue: Group descriptions, period notes, and other text fields not sanitized before display
- Files: Group pages render `description` directly; period records show user notes
- Impact: Potential XSS if data is displayed in `dangerously` mode (not observed here, but fragile)

**Console Errors in Production:**
- Issue: `console.error` calls in cron handlers will appear in logs but not trigger alerts
- Files: `src/app/api/cron/enforce/route.ts` (line 34, 38), `src/lib/enforcement.ts` (line 72)
- Impact: Cron failures may go unnoticed; no alerting mechanism visible

---

*Concerns audit: 2026-06-14*
