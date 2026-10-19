import type { Rarity } from "./budgets";
import { RARITY_BUDGETS } from "./budgets";
import {
  ARMOR_CEILINGS,
  ARMOR_PRIMARY_STATS,
  ARMOR_STAT_KEYS,
  ARMOR_SLOTS,
  pieceCeilings,
  type ArmorKey,
  type ArmorSlot,
  type ArmorStatBlock,
} from "./armor";
// LOCKED V1 roll rules (same as weapons)
import { CHUNK_MIN_PCT, CHUNK_MAX_PCT, CHAOS_PCT, WEIGHT_EXPONENT } from "./rollConfig";

function sumStats(s: ArmorStatBlock): number {
  return ARMOR_STAT_KEYS.reduce((acc, k) => acc + s[k], 0);
}

function randIntInclusive(rng: () => number, min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  if (b < a) return a;
  return a + Math.floor(rng() * (b - a + 1));
}

function pickUniform<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeightedStat(
  rng: () => number,
  candidates: readonly (keyof ArmorStatBlock)[],
  weightBy: (k: keyof ArmorStatBlock) => number
): keyof ArmorStatBlock {
  let total = 0;
  const weights = candidates.map((k) => {
    const w = Math.max(0, weightBy(k));
    total += w;
    return w;
  });
  if (total <= 0) return pickUniform(rng, candidates);

  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ceilingsOverride: what to roll within instead of the armour's own ceilings (a piece: pieceCeilings).
export function rollArmorStats(armorKey: ArmorKey, rarity: Rarity, rng: () => number = Math.random, ceilingsOverride?: ArmorStatBlock) {
  const budget = RARITY_BUDGETS[rarity];
  const ceilings = ceilingsOverride ?? ARMOR_CEILINGS[armorKey]?.[rarity];
  if (!ceilings) throw new Error(`Missing armor ceilings for key=${armorKey} rarity=${rarity}`);

  const maxCapacity = ARMOR_STAT_KEYS.reduce((sum, k) => sum + ceilings[k], 0);
  if (maxCapacity < budget) {
    throw new Error(`Armor ceilings for key=${armorKey} rarity=${rarity} sum to ${maxCapacity}, below budget ${budget}`);
  }
  const effectiveBudget = budget;

  const stats: ArmorStatBlock = { mDef: 0, rDef: 0, magDef: 0, agility: 0, hp: 0 };
  let remaining = effectiveBudget;

  const room = (k: keyof ArmorStatBlock) => ceilings[k] - stats[k];
  const availableStats = (): (keyof ArmorStatBlock)[] => ARMOR_STAT_KEYS.filter((k) => room(k) > 0);

  const pickTarget = (): keyof ArmorStatBlock => {
    const candidates = availableStats();
    if (candidates.length === 0) throw new Error("No room left to allocate.");
    if (rng() < CHAOS_PCT) return pickUniform(rng, candidates);
    return pickWeightedStat(rng, candidates, (k) => Math.pow(room(k), WEIGHT_EXPONENT));
  };

  const addToStat = (k: keyof ArmorStatBlock, amt: number) => {
    const add = Math.min(amt, room(k));
    if (add <= 0) return 0;
    stats[k] += add;
    remaining -= add;
    return add;
  };

  // Primary “first hits”
  const primaries = ARMOR_PRIMARY_STATS[armorKey] ?? ["mDef", "hp"];
  for (const k of primaries.slice(0, 2)) {
    if (remaining <= 0) break;
    if (room(k) > 0) addToStat(k, 1);
  }

  // Chunk allocation — fixed range from the TOTAL budget, clamped at the end
  const minChunk = Math.ceil(budget * CHUNK_MIN_PCT);
  const maxChunk = Math.ceil(budget * CHUNK_MAX_PCT);
  while (remaining > 0) {
    const chunk = Math.min(randIntInclusive(rng, minChunk, maxChunk), remaining);

    const target = pickTarget();
    const added = addToStat(target, Math.max(1, chunk));
    if (added === 0) continue;
  }

  // Top-up safety
  while (sumStats(stats) < effectiveBudget) {
    const target = pickTarget();
    if (room(target) <= 0) continue;
    addToStat(target, 1);
  }

  const total = sumStats(stats);
  if (total !== effectiveBudget) {
    throw new Error(`Armor roll invariant failed: total ${total} != budget ${effectiveBudget}`);
  }
  return { armorKey, rarity, budget: effectiveBudget, ceilings, stats };
}

// One piece of armour: a full roll of the budget, within a piece's ceilings.
// (Every slot rolls the same way.)
export function rollArmorPiece(armorKey: ArmorKey, rarity: Rarity, rng: () => number = Math.random): Record<string, number> {
  return { ...rollArmorStats(armorKey, rarity, rng, pieceCeilings(armorKey, rarity)).stats };
}

// A whole set: a helmet, chest and legs, each rolled on its own.
export function rollArmorSet(armorKey: ArmorKey, rarity: Rarity, rng: () => number = Math.random): Record<ArmorSlot, Record<string, number>> {
  return Object.fromEntries(ARMOR_SLOTS.map((slot) => [slot, rollArmorPiece(armorKey, rarity, rng)])) as Record<ArmorSlot, Record<string, number>>;
}
