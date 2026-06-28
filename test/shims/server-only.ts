// Empty stub for the `server-only` module under Vitest.
//
// Next.js provides `server-only` via a build-time webpack/turbopack alias, so it
// is never installed as a real node_modules package. Vitest has no such alias,
// which makes `import "server-only"` unresolvable in unit tests. This empty
// module is aliased in `vitest.config.ts` so server-only library code (e.g.
// `src/lib/admin-auth.ts`) can be imported and unit-tested directly.
export {};
