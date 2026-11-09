import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `npm run test:all` runs in mode "full", which switches on the slow sweeps (tests/slow.ts);
// `npm run test:stress`, mode "stress", runs only the stress tests.
export default defineConfig(({ mode }) => ({
  // "@/…" as in tsconfig.json, for the page tests (tests/*.test.tsx) that load components.
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    // Some tests roll hundreds of labyrinth maps or sim whole runs. On a busy
    // PC they can pass Vitest's 5-second default without anything being wrong,
    // and the full run's sweeps can take a minute or more each.
    testTimeout: mode === "full" ? 120_000 : 30_000,
    setupFiles: ["tests/setup.ts"],
    env: { FULL_TESTS: mode === "full" ? "1" : "", STRESS_TESTS: mode === "stress" ? "1" : "" },
  },
}));
