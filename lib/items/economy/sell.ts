// lib/items/economy/sell.ts
//
// SELL VALUE FORMULA
// ─────────────────────────────────────────────
// efficiency = 0.6 * primaryShare + 0.4 * bestPrimaryFill^1.3
//
// primaryShare   = (primary1 + primary2) / totalStats
//   → Did the budget land in the right stats?
//
// bestPrimaryFill = max(primary1/cap1, primary2/cap2)
//   → Did it spike high in a primary? (power curve rewards near-caps)
//
// sellGold = floor(rarityBase * efficiency)
//
// Result:
//   Flat spreads → low value
//   One-stat spike in primary → high value
//   Near-cap primary → very high value
//   Primaries ignored → near floor

import type { Rarity } from "../budgets";
import type { ItemKey } from "../ceilings";
import type { ArmorKey } from "../armor";
import { PRIMARY_STATS_BY_ITEMKEY } from "../itemPrimaries";
import { ARMOR_PRIMARY_STATS, PIECE_VALUE, type ArmorSlot } from "../armor";

// Base gold values per rarity — these are the MAX possible (perfect primary spike)
// Actual values land well below max due to the efficiency curve
const RARITY_BASE: Record<Rarity, number> = {
  common:    100,
  uncommon:  200,
  rare:      500,
  epic:      1500,
  legendary: 5000,
};

type SellableDrop = {
  dropType: "item";
  rarity: Rarity;
  itemCategory: "weapon" | "armor";
  itemKey?: ItemKey;
  armorKey?: ArmorKey;
  armorSlot?: ArmorSlot;
  stats?: Record<string, number>;
};

type ComputeSellGoldArgs = {
  drop: SellableDrop;
  getStatCapForDrop: (drop: SellableDrop, statKey: string) => number;
};

export function computeSellGold({ drop, getStatCapForDrop }: ComputeSellGoldArgs): number {
  if (!drop.stats) return 0;

  const stats = drop.stats;
  const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);
  if (totalStats === 0) return 0;

  // Resolve primaries
  let primary1Key: string;
  let primary2Key: string;

  if (drop.itemCategory === "weapon" && drop.itemKey) {
    const primaries = PRIMARY_STATS_BY_ITEMKEY[drop.itemKey];
    if (!primaries) return Math.floor(RARITY_BASE[drop.rarity] * 0.1); // unknown item — floor value
    [primary1Key, primary2Key] = primaries;
  } else if (drop.itemCategory === "armor" && drop.armorKey) {
    const primaries = ARMOR_PRIMARY_STATS[drop.armorKey];
    if (!primaries) return Math.floor(RARITY_BASE[drop.rarity] * 0.1);
    [primary1Key, primary2Key] = primaries as [string, string];
  } else {
    return 0;
  }

  const p1Val = stats[primary1Key] ?? 0;
  const p2Val = stats[primary2Key] ?? 0;
  const p1Cap = getStatCapForDrop(drop, primary1Key);
  const p2Cap = getStatCapForDrop(drop, primary2Key);

  // primaryShare: how much of the budget went into primaries
  const primaryShare = (p1Val + p2Val) / totalStats;

  // bestPrimaryFill: how close the best primary is to its cap
  const fill1 = p1Cap > 0 ? p1Val / p1Cap : 0;
  const fill2 = p2Cap > 0 ? p2Val / p2Cap : 0;
  const bestPrimaryFill = Math.max(fill1, fill2);

  // Power curve — rewards near-cap rolls more heavily
  const poweredFill = Math.pow(bestPrimaryFill, 1.3);

  // Weighted combination
  const efficiency = 0.6 * primaryShare + 0.4 * poweredFill;

  // Clamp to [0, 1] just in case
  const clampedEfficiency = Math.max(0, Math.min(1, efficiency));

  // An armour piece is worth its share of a whole set.
  const share = drop.itemCategory === "armor" && drop.armorSlot ? PIECE_VALUE[drop.armorSlot] : 1;
  return Math.max(1, Math.floor(RARITY_BASE[drop.rarity] * clampedEfficiency * share));
}
