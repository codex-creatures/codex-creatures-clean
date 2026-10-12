// lib/balance/simulate.ts
// Automated 1v1 battle simulations for balancing.
// Uses the real item rollers, creature data and combat engine — no copies.
//
// NOTE: real battles are 3v3 with swapping; these are single 1v1 duels using
// the engine's auto-battle (chooseSkill in engine.ts, neutral stance).

import type { Rarity } from "../items/budgets";
import { ITEM_KEYS } from "../items/ceilings";
import { ARMOR_KEYS } from "../items/armor";
import { rollItemStats } from "../items/rollItemStats";
import { rollArmorStats } from "../items/rollArmorStats";
import { CREATURE_TEMPLATES, type CreatureTemplate } from "../creatures/creatureData";
import { runBattle, effectiveAgil, type Fighter } from "../combat/engine";
import { buildFighter } from "../combat/loadout";

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

// Random weapon + armour of the given rarity, rolled with the real rollers.
export function rollGear(rarity: Rarity): Gear {
  const weaponKey = pick(ITEM_KEYS);
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
export type GearMode = "mirror" | "random" | "none";

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
