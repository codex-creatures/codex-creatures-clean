// tests/rivalSim.test.ts: the ranked ladder's simulated rivals (lib/pvp/rivalSim.ts, lib/pvp/rivals.ts).
// - Quick: one seeded rival plays a little, and what it ends with hangs together.
// - The rosters in lib/pvp/rivals.json still load and each rival fields a team in both ranked formats.
// - With WRITE_RIVALS=1 (`npm run pvp:rivals`), the seven rivals are played through and the file is written.
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isCreatureDrop, isItemDrop } from "../lib/types";
import { findCreatureTemplate } from "../lib/creatures/creatureData";
import { RIVALS, rivalFits, rivalTeam, rivalName, AI_SUFFIX, type Rival } from "../lib/pvp/rivals";
import { RIVAL_COUNT, RIVAL_NAMES, TARGET, goHome, newSim, simRun, simScan, simulateRivals } from "../lib/pvp/rivalSim";
import { RANKED_FORMATS } from "../lib/pvp/ranked";
import { teamFits } from "../lib/pvp/duel";

// What every rival must satisfy, written or loaded.
function checkRival(r: Rival) {
  const problems: string[] = [];
  const creatures = r.inventory.filter(isCreatureDrop), items = r.inventory.filter(isItemDrop);
  if (creatures.length < 3) problems.push(`${r.name}: only ${creatures.length} creatures`);
  for (const c of creatures) {
    if (!findCreatureTemplate(c.creatureId, c.name)) problems.push(`${r.name}: unknown species ${c.creatureId}`);
    if (!((c.level ?? 1) >= 1)) problems.push(`${r.name}: ${c.name} at level ${c.level}`);
    const l = r.equipment[c.id] ?? {};
    for (const id of [l.weaponId, l.helmetId, l.chestId, l.legsId]) if (id && !items.some((g) => g.id === id)) problems.push(`${r.name}: ${c.name} wears ${id}, which it hasn't got`);
  }
  for (const f of Object.values(RANKED_FORMATS)) {
    if (!rivalFits(r, f)) { problems.push(`${r.name}: can't field a team for ${f.name}`); continue; }
    const team = rivalTeam(r, f);
    if (!teamFits(team, f)) problems.push(`${r.name}: its ${f.name} team doesn't fit the format`);
    for (const x of team.fighters) if (x.level !== f.level) problems.push(`${r.name}: ${x.name} fights ${f.name} at level ${x.level}`);
  }
  if (!(r.player.level >= 1)) problems.push(`${r.name}: explorer level ${r.player.level}`);
  return problems;
}

describe("a rival plays", () => {
  it("scans, runs the Encampment and gears up, and what it has hangs together", () => {
    const real = Math.random;
    const s = newSim(7, "Test");
    Math.random = s.rng;
    try {
      for (let i = 0; i < 10; i++) simScan(s);
      expect(s.scans).toBe(10);
      expect(s.inventory.filter(isCreatureDrop).length).toBeGreaterThanOrEqual(2); // the starter and the calibration gift
      goHome(s);
      const outs = Array.from({ length: 3 }, () => simRun(s, 0));
      expect(outs.every((o) => ["cleared", "dead", "retreated"].includes(o))).toBe(true);
      goHome(s);
      expect(s.stats.fights).toBeGreaterThan(0);
      expect(s.stats.runs[0]).toBe(3);
      expect(s.player.level).toBeGreaterThanOrEqual(1);
      // Everything worn is owned; every creature's moves are its own.
      const items = s.inventory.filter(isItemDrop);
      for (const [id, l] of Object.entries(s.equipment)) {
        expect(s.inventory.some((d) => d.id === id)).toBe(true);
        for (const g of [l.weaponId, l.helmetId, l.chestId, l.legsId]) if (g) expect(items.some((x) => x.id === g)).toBe(true);
        expect((l.moves ?? []).length).toBeGreaterThan(0);
      }
      // The same seed plays the same game.
      const names = (seed: number) => { const x = newSim(seed, "Test"); Math.random = x.rng; for (let i = 0; i < 10; i++) simScan(x); return x.inventory.map((d) => d.name); };
      expect(names(11)).toEqual(names(11));
      expect(names(11)).not.toEqual(names(12));
    } finally {
      Math.random = real;
    }
  });
});

describe("the rivals in the repo", () => {
  it(`are ${RIVAL_COUNT}, each fielding a team in both ranked formats`, () => {
    expect(RIVALS.length).toBe(RIVAL_COUNT);
    expect(new Set(RIVALS.map((r) => r.id)).size).toBe(RIVAL_COUNT);
    expect(RIVALS.flatMap(checkRival)).toEqual([]);
    for (const r of RIVALS) expect(rivalName(r).endsWith(AI_SUFFIX)).toBe(true);
  });
});

// The writer: `npm run pvp:rivals`. Plays all seven through (minutes) and writes the file.
it.skipIf(!process.env.WRITE_RIVALS)("writes lib/pvp/rivals.json", () => {
  const rivals = simulateRivals((line) => console.log(line), RIVAL_NAMES);
  for (const r of rivals) {
    const cs = r.inventory.filter(isCreatureDrop);
    const top = [...cs].sort((a, b) => (b.level ?? 1) - (a.level ?? 1)).slice(0, 5);
    console.log(`${r.name}: explorer ${r.player.level}, ${r.stats.scans} scans, runs ${JSON.stringify(r.stats.runs)}, clears ${JSON.stringify(r.stats.clears)}, ${Math.round(r.stats.playTime / 60)} min, ${r.stats.gold}g; ${cs.length} creatures: ${top.map((c) => `${c.name} Lv${c.level} ${c.rarity[0]}`).join(", ")}`);
  }
  console.log(`ratings after the warm-up: ${rivals.map((r) => `${r.name} ${r.rating}`).join(", ")}`);
  const problems = rivals.flatMap(checkRival);
  expect(problems).toEqual([]);
  writeFileSync("lib/pvp/rivals.json", JSON.stringify(rivals, null, 1) + "\n");
  expect(rivals.length).toBe(RIVAL_NAMES.length);
  expect(TARGET.totalRuns).toBeGreaterThan(0);
}, 60 * 60 * 1000);
