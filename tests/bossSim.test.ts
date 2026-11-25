// tests/bossSim.test.ts: boss win rates without and with the creatures' HP %, to tune the bosses' own
// (BOSS_HP_PCT, lib/creatures/creatureData.ts). Slow (about 1 s a fight) and only run when asked:
//   SIM_BOSS=minotaur SIM_N=60 SIM_M=1,1.2,1.4 npx vitest run tests/bossSim.test.ts
// "before" takes the creatures' HP % back off; each ×m multiplies the boss's HP on top of its own HP %.
// One boss at a time: three at once ran the laptop out of memory (2026-11-25).
import { it } from "vitest";
import { createBattle, resolveRound, sendInReplacement } from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement } from "../lib/combat/thinkingAi";
import { bossTeam } from "../lib/creatures/bosses";
type BossKind = Parameters<typeof bossTeam>[0];
import { makeEnemy, enemyFighter, bossLevel } from "../lib/dungeon/run";
import type { Rarity } from "../lib/types";

const N = Number(process.env.SIM_N ?? 120);
const CASES: { kind: BossKind; dungeon: 1 | 2 | 3 | 4; size: number; rarity: Rarity[]; gear: Rarity }[] = [
  { kind: "cyclops", dungeon: 1, size: 3, rarity: ["rare"], gear: "rare" },
  { kind: "hydra", dungeon: 2, size: 3, rarity: ["epic", "rare"], gear: "epic" },
  { kind: "minotaur", dungeon: 4, size: 5, rarity: ["epic"], gear: "epic" },
];

function rate(c: (typeof CASES)[number], hpPct: boolean, bossMult: number) {
  let wins = 0;
  const L = bossLevel(c.dungeon);
  for (let i = 0; i < N; i++) {
    const A = Array.from({ length: c.size }, (_, j) => {
      const f = enemyFighter(makeEnemy(c.rarity[j % c.rarity.length], c.gear, [], Math.random, L));
      if (!hpPct) { const hp = Math.round(f.maxHp / (1 + (f.proficiency.hp ?? 0) / 100)); f.hp = hp; f.maxHp = hp; }
      return f;
    });
    const B = bossTeam(c.kind, L).map((f) => { const hp = Math.round(f.maxHp * bossMult); return { ...f, hp, maxHp: hp }; });
    const s = createBattle(A, B, {}, c.kind);
    let rounds = 0;
    while (!s.winner && rounds++ < 400) {
      resolveRound(s, { A: chooseAiAction(s, "A", "hard"), B: { kind: "pass" } });
      for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "hard"));
    }
    if (s.winner === "A") wins++;
  }
  return Math.round((100 * wins) / N);
}

const ONLY = process.env.SIM_BOSS;
it.skipIf(!!ONLY)("boss sims run only when asked (SIM_BOSS)", () => {});
const MULTS = (process.env.SIM_M ?? "1,1.15,1.3").split(",").map(Number);
for (const c of CASES) if (ONLY === c.kind || ONLY === "all") it("boss sim " + c.kind, () => {
  const t0 = Date.now();
  const before = rate(c, false, 1);
  const row = MULTS.map((m) => `×${m}: ${rate(c, true, m)}%`);
  console.log(`SIM ${c.kind} L${bossLevel(c.dungeon)} n=${N}: before ${before}% | with HP % ${row.join("  ")} (${Math.round((Date.now() - t0) / 1000)}s)`);
}, 3600000);
