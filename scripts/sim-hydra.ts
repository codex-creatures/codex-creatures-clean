// scripts/sim-hydra.ts
// The Deep Labyrinth's boss: the Hydra against the Warden's pack it
// replaced, fought by the same parties. Run with:
//   npx vite-node scripts/sim-hydra.ts [fights] [ai]
// A party is three creatures rolled like the Deep Labyrinth's own (an Epic
// and two Rares, Lv 16, in Rare gear), at full health with no potions, and
// played by the thinking AI (ai: easy, normal or hard; default normal).
// The Warden's pack plays as it does in the game (the Hard AI); the Hydra by
// its script (lib/combat/bossAi.ts).

import { createBattle, resolveRound, sendInReplacement, type BattleState } from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../lib/combat/thinkingAi";
import { makeEnemy, enemyFighter, wardenPack, WARDEN_LEVEL } from "../lib/dungeon/run";
import { bossTeam } from "../lib/creatures/bosses";
import type { Fighter } from "../lib/combat/engine";

const FIGHTS = Number(process.argv[2] ?? 100);
const AI = (process.argv[3] ?? "normal") as AiLevel;

function party(): Fighter[] {
  const picked: string[] = [];
  return (["epic", "rare", "rare"] as const).map((r) => {
    const e = makeEnemy(r, "rare", picked, Math.random, WARDEN_LEVEL);
    picked.push(e.creatureId);
    return enemyFighter(e);
  });
}

function play(s: BattleState) {
  while (!s.winner) {
    resolveRound(s, { A: chooseAiAction(s, "A", AI), B: chooseAiAction(s, "B", "hard") });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, k === "A" ? AI : "hard"));
  }
  const left = s.sides.A.team.reduce((n, f) => n + Math.max(0, f.hp) / f.maxHp, 0) / s.sides.A.team.length;
  return { won: s.winner === "A", rounds: s.round, left };
}

const results = { warden: [] as ReturnType<typeof play>[], hydra: [] as ReturnType<typeof play>[] };
for (let i = 0; i < FIGHTS; i++) {
  const p = party();
  results.warden.push(play(createBattle(p, wardenPack(Math.random, 2).map(enemyFighter), {})));
  results.hydra.push(play(createBattle(p, bossTeam("hydra", WARDEN_LEVEL), {}, "hydra")));
}
for (const [name, rs] of Object.entries(results)) {
  const wins = rs.filter((r) => r.won);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  console.log(`${name.padEnd(7)} won ${Math.round((wins.length / rs.length) * 100)}% · ${Math.round(avg(rs.map((r) => r.rounds)))} rounds · ` +
    `party HP left when won ${Math.round(avg(wins.map((r) => r.left)) * 100)}%`);
}
