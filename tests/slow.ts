import { it } from "vitest";

// Big statistical sweeps (thousands of maps or rolls) that take most of the suite's time.
// `npm test` skips them while working; `npm run test:all` runs them, before every commit or push.
export const slowIt = it.skipIf(!process.env.FULL_TESTS);
