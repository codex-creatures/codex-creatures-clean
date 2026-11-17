// lib/creatures/ascendStats.ts
// What an ascended creature gains (the user, 2026-11-18): each step up a
// rarity at the Soul Altar (lib/creatures/ascend.ts) adds that rarity's
// budget to its species' level-15 values, so it grows towards the next
// rarity's ceiling as it levels (levels.ts adds this bonus before scaling by
// level, so it's small at Lv 5 and full at Lv 15 and on).
//
// - The budgets are the gaps between the rarities' average species (as they
//   were on 2026-11-18): ASCEND_STATS in %s, ASCEND_HP in base HP.
// - The %s follow the species' own shape (a stat it has none of stays at
//   none), shared out so the total is exact. No randomness: its birth roll
//   is the only variance, and two Epic Moss Wolves differ only by theirs.
// - Nothing here is ever saved: a creature keeps only how many steps it has
//   climbed (`ascended`), and its stats are worked out from that each time.

import type { Rarity } from "../items/budgets";
import type { CreatureProficiency, CreatureTemplate } from "./creatureData";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
// Keyed by the rarity a step reaches.
export const ASCEND_STATS: Record<Rarity, number> = { common: 0, uncommon: 16, rare: 24, epic: 25, legendary: 59 };
export const ASCEND_HP: Record<Rarity, number> = { common: 0, uncommon: 15, rare: 19, epic: 23, legendary: 23 };

const KEYS: (keyof CreatureProficiency)[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];

// How many steps a species can climb (to Legendary at most).
export const maxSteps = (t: Pick<CreatureTemplate, "rarity">) => RARITY_ORDER.length - 1 - Math.max(0, RARITY_ORDER.indexOf(t.rarity));
// Steps, kept within what the species can climb (missing or bad: none).
export const stepsOf = (t: Pick<CreatureTemplate, "rarity">, steps: number | undefined) =>
  Math.max(0, Math.min(maxSteps(t), Math.floor(Number.isFinite(steps) ? steps! : 0)));
// The rarity it is after its steps.
export const rarityAfter = (t: Pick<CreatureTemplate, "rarity">, steps: number | undefined): Rarity =>
  RARITY_ORDER[Math.max(0, RARITY_ORDER.indexOf(t.rarity)) + stepsOf(t, steps)];

// The budgets of the steps it has climbed.
function budgets(t: CreatureTemplate, steps: number | undefined) {
  const from = Math.max(0, RARITY_ORDER.indexOf(t.rarity)), n = stepsOf(t, steps);
  const reached = RARITY_ORDER.slice(from + 1, from + 1 + n);
  return { stats: reached.reduce((s, r) => s + ASCEND_STATS[r], 0), hp: reached.reduce((s, r) => s + ASCEND_HP[r], 0) };
}

// Its extra base HP (on top of the species' baseHp).
export const ascendHp = (t: CreatureTemplate, steps: number | undefined) => budgets(t, steps).hp;

// Its extra level-15 %s: the budget along the species' shape, by largest
// remainder so the parts add up to the budget exactly (ties: the stat listed first).
export function ascendBonus(t: CreatureTemplate, steps: number | undefined): CreatureProficiency {
  const out = Object.fromEntries(KEYS.map((k) => [k, 0])) as CreatureProficiency;
  const budget = budgets(t, steps).stats;
  const total = KEYS.reduce((s, k) => s + Math.max(0, t.proficiency[k] ?? 0), 0);
  if (budget <= 0 || total <= 0) return out;
  const exact = KEYS.map((k) => (budget * Math.max(0, t.proficiency[k] ?? 0)) / total);
  KEYS.forEach((k, i) => (out[k] = Math.floor(exact[i])));
  let left = budget - KEYS.reduce((s, k) => s + out[k], 0);
  const order = KEYS.map((k, i) => ({ k, i, r: exact[i] - Math.floor(exact[i]) }))
    .filter((x) => (t.proficiency[x.k] ?? 0) > 0)
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const x of order) { if (left <= 0) break; out[x.k]++; left--; }
  return out;
}
