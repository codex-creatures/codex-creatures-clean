// lib/balance/simulate.ts
// Automated 1v1 battle simulations for balancing.
// Uses the real item rollers, creature data and combat engine — no copies.
//
// Tests 1–2 are 1v1 duels; test 3 is 3v3 with swapping (combat/teamBattle.ts). All use
// the engine's auto-battle (chooseSkill in engine.ts, neutral stance).

import type { Rarity } from "../items/budgets";
import { ITEM_KEYS, type ItemKey } from "../items/ceilings";
import { ARMOR_KEYS } from "../items/armor";
import { PRIMARY_STATS_BY_ITEMKEY } from "../items/itemPrimaries";
import { rollItemStats } from "../items/rollItemStats";
import { rollArmorStats } from "../items/rollArmorStats";
import { CREATURE_TEMPLATES, type CreatureTemplate } from "../creatures/creatureData";
import { runBattle, effectiveAgil, styleFromProficiency, chooseSkill, calcDamage, type CombatStyle, type Fighter } from "../combat/engine";
import { buildFighter } from "../combat/loadout";
import { runTeamBattle } from "../combat/teamBattle";

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
export const MAX_TURNS = 60;

export type Gear = {
  weaponKey: string;
  weapon: Record<string, number>;
  armorKey: string;
  armor: Record<string, number>;
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weapons a player would give each creature type: ones whose primary stats
// include that damage type. Hybrids can use anything.
const FITTED_WEAPONS: Record<CombatStyle, ItemKey[]> = {
  melee:  ITEM_KEYS.filter((k) => PRIMARY_STATS_BY_ITEMKEY[k].includes("melee")),
  ranged: ITEM_KEYS.filter((k) => PRIMARY_STATS_BY_ITEMKEY[k].includes("ranged")),
  hybrid: ITEM_KEYS,
};

// Random weapon + armour of the given rarity, rolled with the real rollers.
// Pass a creature to give it a weapon that suits its type ("fitted").
export function rollGear(rarity: Rarity, fitTo?: CreatureTemplate): Gear {
  const weaponKey = pick(fitTo ? FITTED_WEAPONS[styleFromProficiency(fitTo.proficiency)] : ITEM_KEYS);
  const armorKey = pick(ARMOR_KEYS);
  return {
    weaponKey,
    weapon: { ...rollItemStats(weaponKey, rarity).stats },
    armorKey,
    armor: { ...rollArmorStats(armorKey, rarity).stats },
  };
}

export type DuelResult = {
  winner: "A" | "B" | "draw";
  turns: number;
  firstMover: "A" | "B";
  hits: number;
  minDamageHits: number; // hits that did only 1 damage (defence ate the whole hit)
};

// One duel. Sides are passed to the engine in random order so the engine's
// "ties go to the first fighter" rule doesn't favour side A.
export function duel(
  creatureA: CreatureTemplate, gearA: Gear | null,
  creatureB: CreatureTemplate, gearB: Gear | null,
): DuelResult {
  const fa: Fighter = { ...buildFighter(creatureA, gearA?.weapon, gearA?.armor), name: "A" };
  const fb: Fighter = { ...buildFighter(creatureB, gearB?.weapon, gearB?.armor), name: "B" };
  const aFirstArg = Math.random() < 0.5;
  const [x, y] = aFirstArg ? [fa, fb] : [fb, fa];
  const res = runBattle(x, y, MAX_TURNS);

  // Mirrors the engine's turn-order rule: first argument wins ties.
  const xFirst = effectiveAgil(x) >= effectiveAgil(y);
  const firstMover = (xFirst ? x.name : y.name) as "A" | "B";

  let minDamageHits = 0;
  for (const t of res.turns) if (t.finalDamage <= 1) minDamageHits++;

  return {
    winner: res.winner === "Draw" ? "draw" : (res.winner as "A" | "B"),
    turns: res.totalTurns,
    firstMover,
    hits: res.turns.length,
    minDamageHits,
  };
}

// ── Test 1: creature tier list ────────────────────────────────────
// "mirror": both creatures get the SAME gear each fight → measures the
//           creature itself (base HP, skills, proficiency %).
// "random": each side rolls its own gear → realistic roll/fit variance.
// "fitted": each side rolls its own gear, with a weapon that suits its type
//           (what a player would equip).
export type GearMode = "fitted" | "mirror" | "random" | "none";

export type TierListOptions = {
  gearRarity: Rarity;
  gearMode: GearMode;
  fightsPerPair: number;
};

export type CreatureRow = {
  id: string;
  name: string;
  rarity: Rarity;
  fights: number;
  wins: number;
  draws: number;
  winPct: number;
  drawPct: number;
  winPctWhenFirst: number;
  winPctWhenSecond: number;
};

export type TierListResult = {
  rows: CreatureRow[];                         // sorted by win %
  matrix: Record<string, Record<string, number>>; // [a][b] = a's win % vs b
  byRarity: { rarity: Rarity; winPct: number }[];
  rarityVsRarity: Record<string, Record<string, number>>; // creature-rarity matchup win %
  avgTurns: number;
  drawPct: number;
  turnLimitPct: number;   // fights that hit MAX_TURNS
  minDamageHitPct: number; // share of all hits that did only 1 damage
  firstMoverWinPct: number; // how often the creature that strikes first wins
  totalFights: number;
};

export function runTierList(
  opts: TierListOptions,
  creatures: CreatureTemplate[] = CREATURE_TEMPLATES,
): TierListResult {
  type Acc = { fights: number; wins: number; draws: number; firstF: number; firstW: number; secondF: number; secondW: number };
  const acc: Record<string, Acc> = {};
  const matrix: Record<string, Record<string, number>> = {};
  const rvr: Record<string, Record<string, { w: number; n: number }>> = {};
  for (const c of creatures) {
    acc[c.id] = { fights: 0, wins: 0, draws: 0, firstF: 0, firstW: 0, secondF: 0, secondW: 0 };
    matrix[c.id] = {};
  }

  let totalFights = 0, totalTurns = 0, draws = 0, turnLimit = 0, hits = 0, minHits = 0, decisive = 0, firstWins = 0;

  const record = (c: CreatureTemplate, won: boolean, drew: boolean, wasFirst: boolean) => {
    const a = acc[c.id];
    a.fights++;
    if (won) a.wins++;
    if (drew) a.draws++;
    if (wasFirst) { a.firstF++; if (won) a.firstW++; } else { a.secondF++; if (won) a.secondW++; }
  };

  for (let i = 0; i < creatures.length; i++) {
    for (let j = i + 1; j < creatures.length; j++) {
      const A = creatures[i], B = creatures[j];
      let aWins = 0, decisiveHere = 0;
      for (let f = 0; f < opts.fightsPerPair; f++) {
        let gA: Gear | null = null, gB: Gear | null = null;
        if (opts.gearMode === "mirror") { gA = rollGear(opts.gearRarity); gB = gA; }
        if (opts.gearMode === "random") { gA = rollGear(opts.gearRarity); gB = rollGear(opts.gearRarity); }
        if (opts.gearMode === "fitted") { gA = rollGear(opts.gearRarity, A); gB = rollGear(opts.gearRarity, B); }

        const r = duel(A, gA, B, gB);
        totalFights++;
        totalTurns += r.turns;
        hits += r.hits;
        minHits += r.minDamageHits;
        if (r.turns >= MAX_TURNS && r.winner === "draw") turnLimit++;
        if (r.winner === "draw") draws++;
        else {
          decisive++;
          decisiveHere++;
          if (r.winner === r.firstMover) firstWins++;
          if (r.winner === "A") aWins++;
        }
        record(A, r.winner === "A", r.winner === "draw", r.firstMover === "A");
        record(B, r.winner === "B", r.winner === "draw", r.firstMover === "B");
      }
      const aPct = (aWins / opts.fightsPerPair) * 100;
      const bPct = ((decisiveHere - aWins) / opts.fightsPerPair) * 100;
      matrix[A.id][B.id] = aPct;
      matrix[B.id][A.id] = bPct;

      for (const [x, y, w] of [[A, B, aWins], [B, A, decisiveHere - aWins]] as const) {
        rvr[x.rarity] ??= {};
        rvr[x.rarity][y.rarity] ??= { w: 0, n: 0 };
        rvr[x.rarity][y.rarity].w += w;
        rvr[x.rarity][y.rarity].n += opts.fightsPerPair;
      }
    }
  }

  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
  const rows: CreatureRow[] = creatures.map((c) => {
    const a = acc[c.id];
    return {
      id: c.id, name: c.name, rarity: c.rarity,
      fights: a.fights, wins: a.wins, draws: a.draws,
      winPct: pct(a.wins, a.fights),
      drawPct: pct(a.draws, a.fights),
      winPctWhenFirst: pct(a.firstW, a.firstF),
      winPctWhenSecond: pct(a.secondW, a.secondF),
    };
  }).sort((x, y) => y.winPct - x.winPct);

  const byRarity = RARITIES.map((r) => {
    const rs = rows.filter((row) => row.rarity === r);
    const fights = rs.reduce((s, x) => s + x.fights, 0);
    const wins = rs.reduce((s, x) => s + x.wins, 0);
    return { rarity: r, winPct: pct(wins, fights) };
  });

  const rarityVsRarity: Record<string, Record<string, number>> = {};
  for (const [x, inner] of Object.entries(rvr)) {
    rarityVsRarity[x] = {};
    for (const [y, v] of Object.entries(inner)) rarityVsRarity[x][y] = pct(v.w, v.n);
  }

  return {
    rows, matrix, byRarity, rarityVsRarity,
    avgTurns: totalTurns / totalFights,
    drawPct: pct(draws, totalFights),
    turnLimitPct: pct(turnLimit, totalFights),
    minDamageHitPct: pct(minHits, hits),
    firstMoverWinPct: pct(firstWins, decisive),
    totalFights,
  };
}

// ── Test 2: what is a stat point worth? ───────────────────────────
// Random creature pairs with identical (mirrored) gear; side A gets a bonus
// on one gear stat. Win-rate gain over 50% = how much that stat is worth.
export type StatKeyForValue = "melee" | "ranged" | "agility" | "hp" | "mDef" | "rDef";

export const STAT_VALUE_STATS: { key: StatKeyForValue; label: string; slot: "weapon" | "armor" }[] = [
  { key: "melee",   label: "Attack (melee)", slot: "weapon" },
  { key: "ranged",  label: "Range",          slot: "weapon" },
  { key: "agility", label: "Agility",        slot: "weapon" },
  { key: "hp",      label: "Health",         slot: "weapon" },
  { key: "mDef",    label: "Melee Defence",  slot: "armor" },
  { key: "rDef",    label: "Ranged Defence", slot: "armor" },
];

export type StatValueOptions = { gearRarity: Rarity; bonus: number; battlesPerStat: number };
export type StatValueRow = { key: StatKeyForValue; label: string; winPct: number; gain: number; drawPct: number };

export function runStatValue(
  opts: StatValueOptions,
  creatures: CreatureTemplate[] = CREATURE_TEMPLATES,
): { baselineWinPct: number; rows: StatValueRow[] } {
  function trial(stat: (typeof STAT_VALUE_STATS)[number] | null) {
    let wins = 0, decisive = 0, draws = 0;
    for (let i = 0; i < opts.battlesPerStat; i++) {
      const A = pick(creatures), B = pick(creatures);
      const base = rollGear(opts.gearRarity);
      const gA: Gear = { ...base, weapon: { ...base.weapon }, armor: { ...base.armor } };
      if (stat) gA[stat.slot][stat.key] = (gA[stat.slot][stat.key] ?? 0) + opts.bonus;
      const r = duel(A, gA, B, base);
      if (r.winner === "draw") draws++;
      else { decisive++; if (r.winner === "A") wins++; }
    }
    return { winPct: (wins / opts.battlesPerStat) * 100, drawPct: (draws / opts.battlesPerStat) * 100, decisive };
  }

  const baseline = trial(null);
  const rows = STAT_VALUE_STATS.map((s) => {
    const t = trial(s);
    return { key: s.key, label: s.label, winPct: t.winPct, gain: t.winPct - baseline.winPct, drawPct: t.drawPct };
  }).sort((a, b) => b.gain - a.gain);

  return { baselineWinPct: baseline.winPct, rows };
}

// ── Test 3: 3v3 team battles ──────────────────────────────────────
// Random teams of 3, gear per creature. Measures how often the team with
// rarer creatures wins, and whether swapping (good play) beats not swapping.
export type TeamSimOptions = {
  gearRarity: Rarity;
  gearMode: "fitted" | "random" | "optimized";
  creatureBand?: CreatureBand;
  battles: number;
  teamSize?: number;
};

export type TeamSimResult = {
  battles: number;
  avgRounds: number;
  drawPct: number;
  swapsPerBattle: number;
  minDamageHitPct: number;
  swapperWinPct: number;      // same teams: swapping side vs side that never swaps
  smartWinPct: number;        // same teams: full play vs no swaps + next-in-order replacements
  strongerTeamWinPct: number; // team with higher total creature rarity (ties excluded)
  byRarityGap: { gap: number; winPct: number; battles: number }[];
  creatures: { id: string; name: string; rarity: Rarity; battles: number; winPct: number }[];
};

const RARITY_SCORE: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

function randomTeam(size: number, creatures: CreatureTemplate[]): CreatureTemplate[] {
  const pool = [...creatures];
  const team: CreatureTemplate[] = [];
  while (team.length < size && pool.length) team.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return team;
}

export function runTeamBattles(
  opts: TeamSimOptions,
  creatures: CreatureTemplate[] = creaturesInBand(opts.creatureBand ?? "all"),
): TeamSimResult {
  const size = opts.teamSize ?? 3;
  let rounds = 0, draws = 0, swaps = 0, hits = 0, minHits = 0;
  let swapperWins = 0, swapperGames = 0, smartWins = 0, smartGames = 0, strongerWins = 0, strongerGames = 0;
  const gapAcc: Record<number, { w: number; n: number }> = {};
  const cAcc: Record<string, { w: number; n: number }> = {};

  const refs = opts.gearMode === "optimized" ? referenceOpponents(creatures, opts.gearRarity) : [];
  const equip = (team: CreatureTemplate[]): Fighter[] =>
    team.map((c) => {
      const g = opts.gearMode === "optimized"
        ? optimizedGear(c, opts.gearRarity, refs)
        : rollGear(opts.gearRarity, opts.gearMode === "fitted" ? c : undefined);
      return buildFighter(c, g.weapon, g.armor);
    });

  for (let i = 0; i < opts.battles; i++) {
    const tA = randomTeam(size, creatures), tB = randomTeam(size, creatures);
    const fA = equip(tA), fB = equip(tB);

    // Main battle: both sides play properly.
    const r = runTeamBattle(fA, fB, { swapsA: true, swapsB: true });
    rounds += r.rounds;
    swaps += r.swapsA + r.swapsB;
    hits += r.hits;
    minHits += r.minDamageHits;
    if (r.winner === "draw") draws++;

    const scoreA = tA.reduce((s, c) => s + RARITY_SCORE[c.rarity], 0);
    const scoreB = tB.reduce((s, c) => s + RARITY_SCORE[c.rarity], 0);
    const gap = Math.max(-6, Math.min(6, scoreA - scoreB));
    gapAcc[gap] ??= { w: 0, n: 0 };
    gapAcc[gap].n++;
    if (r.winner === "A") gapAcc[gap].w++;
    if (scoreA !== scoreB) {
      strongerGames++;
      if ((scoreA > scoreB && r.winner === "A") || (scoreB > scoreA && r.winner === "B")) strongerWins++;
    }
    for (const [team, won] of [[tA, r.winner === "A"], [tB, r.winner === "B"]] as const) {
      for (const c of team) {
        cAcc[c.id] ??= { w: 0, n: 0 };
        cAcc[c.id].n++;
        if (won) cAcc[c.id].w++;
      }
    }

    // Skill check: same teams and gear, only one side allowed to swap.
    const s1 = runTeamBattle(fA, fB, { swapsA: true, swapsB: false });
    const s2 = runTeamBattle(fA, fB, { swapsA: false, swapsB: true });
    for (const [res, swapper] of [[s1, "A"], [s2, "B"]] as const) {
      if (res.winner === "draw") continue;
      swapperGames++;
      if (res.winner === swapper) swapperWins++;
    }

    // Full play vs no swaps AND next-in-order replacements — the total value
    // of in-battle decisions.
    const p1 = runTeamBattle(fA, fB, { swapsA: true, swapsB: false, smartReplaceB: false });
    const p2 = runTeamBattle(fA, fB, { swapsA: false, swapsB: true, smartReplaceA: false });
    for (const [res, smart] of [[p1, "A"], [p2, "B"]] as const) {
      if (res.winner === "draw") continue;
      smartGames++;
      if (res.winner === smart) smartWins++;
    }
  }

  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
  return {
    battles: opts.battles,
    avgRounds: rounds / opts.battles,
    drawPct: pct(draws, opts.battles),
    swapsPerBattle: swaps / opts.battles,
    minDamageHitPct: pct(minHits, hits),
    swapperWinPct: pct(swapperWins, swapperGames),
    smartWinPct: pct(smartWins, smartGames),
    strongerTeamWinPct: pct(strongerWins, strongerGames),
    byRarityGap: Object.entries(gapAcc)
      .map(([g, v]) => ({ gap: Number(g), winPct: pct(v.w, v.n), battles: v.n }))
      .sort((a, b) => a.gap - b.gap),
    creatures: creatures
      .filter((c) => cAcc[c.id])
      .map((c) => ({ id: c.id, name: c.name, rarity: c.rarity, battles: cAcc[c.id].n, winPct: pct(cAcc[c.id].w, cAcc[c.id].n) }))
      .sort((a, b) => b.winPct - a.winPct),
  };
}

// ── Creature rarity bands ─────────────────────────────────────────
// Testing within a band avoids Common-vs-Legendary extremes drowning out
// everything else.
export type CreatureBand = "all" | "common-rare" | "rare-legendary";

export const CREATURE_BANDS: Record<CreatureBand, { label: string; rarities: Rarity[] }> = {
  "all":            { label: "All creatures",  rarities: RARITIES },
  "common-rare":    { label: "Common – Rare",  rarities: ["common", "uncommon", "rare"] },
  "rare-legendary": { label: "Rare – Legendary", rarities: ["rare", "epic", "legendary"] },
};

export function creaturesInBand(band: CreatureBand): CreatureTemplate[] {
  return CREATURE_TEMPLATES.filter((c) => CREATURE_BANDS[band].rarities.includes(c.rarity));
}

// ── Optimised gear (what a player would equip) ────────────────────
// The creature looks at several owned items per slot and equips whichever
// makes it win its matchups best against typical opponents. No hand-picked
// stat weights: a great roll in the stats this creature uses wins out.
export const OPTIMIZE_POOL_SIZE = 6;  // items owned per slot to choose from
const REFERENCE_OPPONENTS = 16;

function rollWeapon(rarity: Rarity, keys: readonly ItemKey[] = ITEM_KEYS) {
  const key = pick(keys);
  return { key, stats: { ...rollItemStats(key, rarity).stats } as Record<string, number> };
}

function rollArmor(rarity: Rarity) {
  const key = pick(ARMOR_KEYS);
  return { key, stats: { ...rollArmorStats(key, rarity).stats } as Record<string, number> };
}

function expectedHit(atk: Fighter, def: Fighter): number {
  const s = chooseSkill(atk, def);
  return s ? calcDamage(s, atk, def, false).damage : 0;
}

// Continuous, speed-aware version of the matchup read: >1 means I win.
function powerRatio(me: Fighter, them: Fighter): number {
  const iNeed = them.maxHp / Math.max(1, expectedHit(me, them));
  const theyNeed = me.maxHp / Math.max(1, expectedHit(them, me));
  const meFirst = effectiveAgil(me) >= effectiveAgil(them);
  return (theyNeed + (meFirst ? 0.5 : 0)) / (iNeed + (meFirst ? 0 : 0.5));
}

function loadoutScore(me: Fighter, refs: Fighter[]): number {
  let total = 0;
  for (const r of refs) total += Math.log(Math.max(0.05, Math.min(20, powerRatio(me, r))));
  return total / refs.length;
}

// Typical opponents: random creatures from the pool with fitted gear.
export function referenceOpponents(creatures: CreatureTemplate[], rarity: Rarity, n = REFERENCE_OPPONENTS): Fighter[] {
  return Array.from({ length: n }, () => {
    const c = pick(creatures);
    const g = rollGear(rarity, c);
    return buildFighter(c, g.weapon, g.armor);
  });
}

export function optimizedGear(c: CreatureTemplate, rarity: Rarity, refs: Fighter[], poolSize = OPTIMIZE_POOL_SIZE): Gear {
  const weapons = Array.from({ length: poolSize }, () => rollWeapon(rarity));
  const armors = Array.from({ length: poolSize }, () => rollArmor(rarity));

  let bestW = weapons[0], bestWScore = -Infinity;
  for (const w of weapons) {
    const s = loadoutScore(buildFighter(c, w.stats), refs);
    if (s > bestWScore) { bestW = w; bestWScore = s; }
  }
  let bestA = armors[0], bestAScore = -Infinity;
  for (const a of armors) {
    const s = loadoutScore(buildFighter(c, bestW.stats, a.stats), refs);
    if (s > bestAScore) { bestA = a; bestAScore = s; }
  }
  return { weaponKey: bestW.key, weapon: bestW.stats, armorKey: bestA.key, armor: bestA.stats };
}

// ── Test 4: optimised lower-rarity gear vs stronger gear ──────────
// The SAME three creatures on both sides; only the gear differs:
//   Team A: optimised gear (best of its pool) one rarity lower
//   Team B: ordinary fitted gear (one suitable item) one rarity higher
export type ShowdownOptions = { band: CreatureBand; battles: number };

export type ShowdownRow = { optimized: Rarity; stronger: Rarity; winPct: number; sameRarityWinPct: number };

export function runGearShowdown(opts: ShowdownOptions): ShowdownRow[] {
  const creatures = creaturesInBand(opts.band);
  const rows: ShowdownRow[] = [];

  for (let i = 0; i < RARITIES.length - 1; i++) {
    const low = RARITIES[i], high = RARITIES[i + 1];
    const refsLow = referenceOpponents(creatures, low);
    const refsHigh = referenceOpponents(creatures, high);
    let w = 0, n = 0, ws = 0, ns = 0;

    for (let b = 0; b < opts.battles; b++) {
      const team = randomTeam(3, creatures);
      const shuffled = [...team].sort(() => Math.random() - 0.5);
      const optLow = team.map((c) => { const g = optimizedGear(c, low, refsLow); return buildFighter(c, g.weapon, g.armor); });
      const fitHigh = shuffled.map((c) => { const g = rollGear(high, c); return buildFighter(c, g.weapon, g.armor); });
      const r = runTeamBattle(optLow, fitHigh, { swapsA: true, swapsB: true });
      if (r.winner !== "draw") { n++; if (r.winner === "A") w++; }

      // Control: optimised vs ordinary at the SAME (higher) rarity.
      const optHigh = team.map((c) => { const g = optimizedGear(c, high, refsHigh); return buildFighter(c, g.weapon, g.armor); });
      const r2 = runTeamBattle(optHigh, fitHigh, { swapsA: true, swapsB: true });
      if (r2.winner !== "draw") { ns++; if (r2.winner === "A") ws++; }
    }
    rows.push({ optimized: low, stronger: high, winPct: n ? (w / n) * 100 : 0, sameRarityWinPct: ns ? (ws / ns) * 100 : 0 });
  }
  return rows;
}
