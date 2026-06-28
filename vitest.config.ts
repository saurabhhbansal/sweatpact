import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" → "src/*" path alias from tsconfig.json.
      "@": path.resolve(__dirname, "src"),
      // Next.js supplies `server-only` via a build-time alias, so it is not a
      // real installed package. Stub it here so server-only library modules can
      // be imported and unit-tested under Vitest.
      "server-only": path.resolve(__dirname, "test/shims/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Note: the worker pool is forced to "threads" via the CLI flag in the
    // npm "test" script — the default "forks" pool fails to initialise the
    // runner on Node 25 ("Cannot read properties of undefined (reading
    // 'config')"), and the config-level `pool` option is not honoured here.
  },
});
