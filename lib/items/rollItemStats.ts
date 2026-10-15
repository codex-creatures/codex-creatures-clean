import type { Rarity } from "./budgets";
import { RARITY_BUDGETS } from "./budgets";
import { ITEM_CEILINGS, STAT_KEYS, type ItemKey, type StatBlock } from "./ceilings";
import { PRIMARY_STATS_BY_ITEMKEY } from "./itemPrimaries";
import { CHUNK_MIN_PCT, CHUNK_MAX_PCT, CHAOS_PCT, WEIGHT_EXPONENT } from "./rollConfig";

function sumStats(s: StatBlock): number {
  return STAT_KEYS.reduce((acc, k) => acc + s[k], 0);
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
  candidates: readonly (keyof StatBlock)[],
  weightBy: (k: keyof StatBlock) => number
): keyof StatBlock {
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

export function rollItemStats(item: ItemKey, rarity: Rarity, rng: () => number = Math.random) {
  const budget = RARITY_BUDGETS[rarity];
  const ceilings = ITEM_CEILINGS[item]?.[rarity];

  if (!ceilings) throw new Error(`Missing ceilings for item=${item} rarity=${rarity}`);

  // Ceilings that can't hold the full budget are a config error — fail loudly.
  const maxCapacity = STAT_KEYS.reduce((sum, k) => sum + ceilings[k], 0);
  if (maxCapacity < budget) {
    throw new Error(`Ceilings for item=${item} rarity=${rarity} sum to ${maxCapacity}, below budget ${budget}`);
  }
  const effectiveBudget = budget;

  const stats: StatBlock = { melee: 0, ranged: 0, magic: 0, agility: 0, hp: 0 };
  let remaining = effectiveBudget;

  const room = (k: keyof StatBlock) => ceilings[k] - stats[k];

  const availableStats = (): (keyof StatBlock)[] =>
    STAT_KEYS.filter((k) => room(k) > 0);

  const pickTarget = (): keyof StatBlock => {
    const candidates = availableStats();
    if (candidates.length === 0) {
      throw new Error(
        `No remaining room to allocate for item=${item} rarity=${rarity}. Check ceilings vs budget.`
      );
    }

    if (rng() < CHAOS_PCT) return pickUniform(rng, candidates);

    // 80% weighted by room^0.6
    return pickWeightedStat(rng, candidates, (k) => Math.pow(room(k), WEIGHT_EXPONENT));
  };

  const addToStat = (k: keyof StatBlock, amt: number) => {
    const add = Math.min(amt, room(k));
    if (add <= 0) return 0;
    stats[k] += add;
    remaining -= add;
    return add;
  };

  // Primary “first hits” (+1 each if ceiling allows)
  const primaries = PRIMARY_STATS_BY_ITEMKEY[item] ?? ["melee", "agility"];
  for (const k of primaries.slice(0, 2)) {
    if (remaining <= 0) break;
    if (room(k) > 0) addToStat(k, 1);
  }

  // Chunk allocation loop — chunk range is fixed from the TOTAL budget
  // (Legendary 150 → 8–30), then clamped to what's left near the end.
  const minChunk = Math.ceil(budget * CHUNK_MIN_PCT);
  const maxChunk = Math.ceil(budget * CHUNK_MAX_PCT);
  while (remaining > 0) {
    const chunk = Math.min(randIntInclusive(rng, minChunk, maxChunk), remaining);

    const target = pickTarget();
    const added = addToStat(target, Math.max(1, chunk)); // ensure progress
    if (added === 0) continue;
  }

  // Top-up safety (should be unnecessary, but keeps invariant even if something weird happens)
  while (sumStats(stats) < effectiveBudget) {
    const target = pickTarget();
    if (room(target) <= 0) continue;
    addToStat(target, 1);
  }

  // Invariant: total equals budget
  const total = sumStats(stats);
  if (total !== effectiveBudget) {
    throw new Error(`Roll invariant failed: total ${total} != budget ${effectiveBudget}`);
  }

  // Invariant: primaries never 0 (if ceilings allow)
  for (const k of primaries.slice(0, 2)) {
    if (ceilings[k] > 0 && stats[k] === 0) {
      throw new Error(`Primary stat ${String(k)} rolled 0 for item=${item} rarity=${rarity}`);
    }
  }

  return {
    item,
    rarity,
    budget: effectiveBudget,
    ceilings,
    stats,
  };
}
