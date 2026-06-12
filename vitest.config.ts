import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" → "src/*" path alias from tsconfig.json.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Note: the worker pool is forced to "threads" via the CLI flag in the
    // npm "test" script — the default "forks" pool fails to initialise the
    // runner on Node 25 ("Cannot read properties of undefined (reading
    // 'config')"), and the config-level `pool` option is not honoured here.
  },
});
