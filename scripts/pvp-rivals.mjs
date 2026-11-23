// scripts/pvp-rivals.mjs (npm run pvp:rivals)
// Plays the ranked ladder's seven simulated rivals through the game and
// writes their rosters to lib/pvp/rivals.json (lib/pvp/rivalSim.ts). Run it
// after a balance change that should reach them; it takes some minutes.
// (The playing is done by tests/rivalSim.test.ts, which can read the game's TypeScript.)

import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "tests/rivalSim.test.ts", "-t", "writes"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, WRITE_RIVALS: "1" },
});
process.exit(r.status ?? 1);
