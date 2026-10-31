// scripts/registry-rules.mjs (npm run registry:rules)
// Writes a new migration with the game's current registry rules (the odds,
// species and items new barcodes are rolled from), for the server's copy.
// Run it after changing any of them, then apply the migration to Supabase.
// (The writing is done by tests/registryRules.test.ts, which can read the
// game's TypeScript.)

import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["vitest", "run", "tests/registryRules.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, WRITE_REGISTRY_RULES: "1" },
});
process.exit(r.status ?? 1);
