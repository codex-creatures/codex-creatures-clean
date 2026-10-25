// scripts/sim-races.ts
// Combat V2 sims: the live rules (class triangle) against race rules, with
// the real creatures, gear rollers and battle engine. Run with:
//   npx vite-node scripts/sim-races.ts [scale]
// scale multiplies the number of battles (default 1, a few seconds; 20 is
// about 200,000 duels per ruleset, a few minutes).
// To try other multipliers: RACE_EFFECT=1.3/0.8 npx vite-node scripts/sim-races.ts
// To run only the V2 rulesets: V2_ONLY=1

import { setCombatRules, LIVE_RULES, type CombatRules } from "../lib/combat/engine";
import { runTierList, runTeamBattles, rollGear, duel, gearedFighter, type Gear } from "../lib/balance/simulate";
import { runTeamBattle } from "../lib/combat/teamBattle";
import { CREATURE_TEMPLATES, type CreatureTemplate } from "../lib/creatures/creatureData";
import { SPECIES_RACES, RACES_V2, RACE_V2_NAME } from "../lib/creatures/racesV2";
import { raceVsAll, RACE_EFFECT } from "../lib/combat/raceChart";
import type { Rarity } from "../lib/items/budgets";

const SCALE = Number(process.argv[2] ?? 1);
if (process.env.RACE_EFFECT) {
  const [strong, resisted] = process.env.RACE_EFFECT.split("/").map(Number);
  Object.assign(RACE_EFFECT, { strong, resisted });
}
console.log(`Race multipliers: effective ${RACE_EFFECT.strong}, resisted ${RACE_EFFECT.resisted}`);
const RULESETS: { name: string; rules: CombatRules }[] = [
  ...(process.env.V2_ONLY ? [] : [{ name: "Live (triangle)", rules: LIVE_RULES }]),
  { name: "V2: own race", rules: { triangle: false, races: "own", damageTypes: false } },
  { name: "V2: drafted moves", rules: { triangle: false, races: "drafted", damageTypes: false } },
];

const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
const f1 = (n: number) => n.toFixed(1);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const stdev = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const racesOf = (c: CreatureTemplate) => SPECIES_RACES[c.id] ?? [];

// How much better A's best own race lands on B than B's on A (1 = even).
// The same yardstick under every ruleset, so the live rules show what
// "race doesn't matter" looks like.
const raceEdge = (a: CreatureTemplate, b: CreatureTemplate) => {
  const best = (x: CreatureTemplate, y: CreatureTemplate) => Math.max(...racesOf(x).map((r) => raceVsAll(r, racesOf(y))));
  return best(a, b) / best(b, a);
};

const NEXT: Partial<Record<Rarity, Rarity>> = { common: "uncommon", uncommon: "rare", rare: "epic", epic: "legendary" };

function sameRarityPair(): [CreatureTemplate, CreatureTemplate] {
  const a = pick(CREATURE_TEMPLATES);
  const pool = CREATURE_TEMPLATES.filter((c) => c.rarity === a.rarity && c.id !== a.id);
  return [a, pick(pool)];
}

// Duels between creatures of the same rarity where one side has the race
// edge: how often it wins in equal gear, and how often the other side wins
// with gear a rarity better (a better build beating a bad matchup).
function raceEdgeStudy(n: number) {
  let favWins = 0, favGames = 0, revWins = 0, revGames = 0, evenDecisive = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = sameRarityPair();
    const e = raceEdge(a, b);
    if (Math.abs(e - 1) < 0.01) { evenDecisive++; continue; }
    const [fav, dis] = e > 1 ? [a, b] : [b, a];
    const rarity: Rarity = "rare";
    const r1 = duel(fav, rollGear(rarity, fav), dis, rollGear(rarity, dis));
    if (r1.winner !== "draw") { favGames++; if (r1.winner === "A") favWins++; }
    const r2 = duel(dis, rollGear(NEXT[rarity]!, dis), fav, rollGear(rarity, fav));
    if (r2.winner !== "draw") { revGames++; if (r2.winner === "A") revWins++; }
  }
  return { favWinPct: pct(favWins, favGames), reversalWinPct: pct(revWins, revGames), evenShare: pct(evenDecisive, n) };
}

// 3v3 with full play: does the team's class mix or race mix decide wins?
function compositionStudy(n: number) {
  const byClasses: Record<number, { w: number; n: number }> = {};
  const byRaces: Record<string, { w: number; n: number }> = {};
  let rounds = 0;
  for (let i = 0; i < n; i++) {
    const rarity = pick(["uncommon", "rare", "epic"] as Rarity[]);
    const band = CREATURE_TEMPLATES.filter((c) => c.rarity === rarity || c.rarity === NEXT[rarity]);
    const team = () => { const p = [...band]; return [0, 1, 2].map(() => p.splice(Math.floor(Math.random() * p.length), 1)[0]); };
    const tA = team(), tB = team();
    const gear = (t: CreatureTemplate[]) => t.map((c) => gearedFighter(c, rollGear("rare", c) as Gear));
    const r = runTeamBattle(gear(tA), gear(tB), { swapsA: true, swapsB: true });
    rounds += r.rounds;
    for (const [t, won] of [[tA, r.winner === "A"], [tB, r.winner === "B"]] as const) {
      const classes = new Set(t.map((c) => c.cls)).size;
      const races = new Set(t.flatMap(racesOf)).size;
      const rk = races <= 3 ? "≤3" : races === 4 ? "4" : "5+";
      (byClasses[classes] ??= { w: 0, n: 0 }).n++;
      (byRaces[rk] ??= { w: 0, n: 0 }).n++;
      if (won) { byClasses[classes].w++; byRaces[rk].w++; }
    }
  }
  return {
    avgRounds: rounds / n,
    byClasses: Object.entries(byClasses).map(([k, v]) => `${k} class${k === "1" ? "" : "es"} ${f1(pct(v.w, v.n))}%`).join(", "),
    byRaces: Object.entries(byRaces).map(([k, v]) => `${k} races ${f1(pct(v.w, v.n))}%`).join(", "),
  };
}

for (const { name, rules } of RULESETS) {
  setCombatRules(rules);
  const t0 = Date.now();
  console.log(`\n══ ${name} ══`);

  // 1v1 tier list, fitted rare gear.
  const tl = runTierList({ gearRarity: "rare", gearMode: "fitted", fightsPerPair: Math.round(30 * SCALE) });
  const byRarity = Object.fromEntries(tl.byRarity.map((r) => [r.rarity, r.winPct]));
  const withinRarity = tl.rows.map((r) => r.winPct - byRarity[r.rarity]);
  console.log(`Duels: ${tl.totalFights}, avg rounds ${f1(tl.avgTurns)}, draws ${f1(tl.drawPct)}%, first striker wins ${f1(tl.firstMoverWinPct)}%`);
  console.log(`Creature spread within a rarity (stdev of win %): ${f1(stdev(withinRarity))}`);
  const sorted = [...tl.rows].sort((a, b) => (b.winPct - byRarity[b.rarity]) - (a.winPct - byRarity[a.rarity]));
  const fmt = (r: typeof tl.rows[number]) => `${r.name} ${r.winPct - byRarity[r.rarity] >= 0 ? "+" : ""}${f1(r.winPct - byRarity[r.rarity])}`;
  console.log(`  Above their rarity: ${sorted.slice(0, 4).map(fmt).join(", ")}`);
  console.log(`  Below their rarity: ${sorted.slice(-4).map(fmt).join(", ")}`);

  // By race (each creature counted in each of its races), and single vs dual.
  const rowById = Object.fromEntries(tl.rows.map((r) => [r.id, r.winPct - byRarity[r.rarity]]));
  const raceLine = RACES_V2.map((race) => {
    const xs = CREATURE_TEMPLATES.filter((c) => racesOf(c).includes(race)).map((c) => rowById[c.id]);
    return `${RACE_V2_NAME[race]} ${xs.length ? (mean(xs) >= 0 ? "+" : "") + f1(mean(xs)) : "–"}`;
  });
  console.log(`  By race (vs their rarity): ${raceLine.join(", ")}`);
  const single = CREATURE_TEMPLATES.filter((c) => racesOf(c).length === 1).map((c) => rowById[c.id]);
  const dual = CREATURE_TEMPLATES.filter((c) => racesOf(c).length === 2).map((c) => rowById[c.id]);
  console.log(`  Single race ${f1(mean(single))}, dual race ${f1(mean(dual))}`);

  // Race edge and reversals.
  const re = raceEdgeStudy(Math.round(4000 * SCALE));
  console.log(`Race edge (same-rarity duels, rare gear): favoured side wins ${f1(re.favWinPct)}%; with gear a rarity better, the unfavoured side wins ${f1(re.reversalWinPct)}% (${f1(re.evenShare)}% of pairs had no edge)`);

  // 3v3 team battles.
  const tb = runTeamBattles({ gearRarity: "rare", gearMode: "fitted", battles: Math.round(800 * SCALE), creatureBand: "common-rare" });
  console.log(`3v3 (Common–Rare): avg rounds ${f1(tb.avgRounds)}, draws ${f1(tb.drawPct)}%, swaps/battle ${f1(tb.swapsPerBattle)}, swapping side wins ${f1(tb.swapperWinPct)}%, rarer team wins ${f1(tb.strongerTeamWinPct)}%`);
  const cs = compositionStudy(Math.round(3000 * SCALE));
  console.log(`3v3 team make-up win %: ${cs.byClasses}; ${cs.byRaces}`);
  console.log(`(${f1((Date.now() - t0) / 1000)}s)`);
}
