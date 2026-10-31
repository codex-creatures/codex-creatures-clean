// tests/registryRules.test.ts
// The global registry rolls on the server from a copy of REGISTRY_RULES
// (lib/barcodeRegistry.ts), kept as the latest registry_rules migration.
// This fails when the game's odds, species or items change and the copy
// hasn't: run `npm run registry:rules` (which writes a new migration), then
// apply it to the Supabase project.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY_RULES } from "../lib/barcodeRegistry";

const DIR = join(__dirname, "..", "supabase", "migrations");
const RULES_SQL = /insert into public\.registry_rules \(id, rules\) values \(1, '([^']*)'::jsonb\)/;

function latestRules(): { file: string; rules: unknown } | null {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const file of files) {
    const m = readFileSync(join(DIR, file), "utf8").match(RULES_SQL);
    if (m) return { file, rules: JSON.parse(m[1]) };
  }
  return null;
}

// e.g. 20261031183000: the form Supabase names migrations by (UTC).
const stamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);

function migration(): string {
  const json = JSON.stringify(REGISTRY_RULES);
  return `-- The rules the global registry rolls new barcodes by: a copy of REGISTRY_RULES
-- (lib/barcodeRegistry.ts), written by \`npm run registry:rules\`. Don't edit by hand.
insert into public.registry_rules (id, rules) values (1, '${json}'::jsonb)
  on conflict (id) do update set rules = excluded.rules, updated_at = now();
`;
}

describe("the server's copy of the registry rules", () => {
  it("can be written as SQL", () => {
    expect(JSON.stringify(REGISTRY_RULES)).not.toContain("'");
  });

  it("every rarity has creatures, and every list has something in it", () => {
    for (const r of Object.keys(REGISTRY_RULES.rarity)) expect(REGISTRY_RULES.creatures[r]?.length, r).toBeGreaterThan(0);
    for (const list of [REGISTRY_RULES.weapons, REGISTRY_RULES.armors, REGISTRY_RULES.armorSlots, REGISTRY_RULES.soulStones]) expect(list.length).toBeGreaterThan(0);
  });

  it("matches the game's", () => {
    if (process.env.WRITE_REGISTRY_RULES) {
      const file = `${stamp()}_registry_rules.sql`;
      writeFileSync(join(DIR, file), migration());
      console.log(`Wrote supabase/migrations/${file}: apply it to the Supabase project.`);
      return;
    }
    const latest = latestRules();
    expect(latest, "No registry_rules migration: run npm run registry:rules").not.toBeNull();
    expect(latest!.rules, `${latest!.file} is out of date: run npm run registry:rules, then apply the new migration`)
      .toEqual(JSON.parse(JSON.stringify(REGISTRY_RULES)));
  });
});
