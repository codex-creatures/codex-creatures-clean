// src/lib/economy/sell.ts
import { PRIMARY_STATS_BY_ITEMKEY } from "@/lib/items/itemPrimaries";

// If you already have these types, import them instead.
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type ItemCategory = "weapon" | "armor" | "material" | "consumable";

// Shape assumption: you said items have rarity, itemCategory, stats, caps by rarity.
// Adjust these fields to match your real Drop/Item type.
export type StatMap = Record<string, number>;

export type ItemDrop = {
  id: string;
  kind: "item"; // or whatever your discriminator is
  itemKey: string;
  name?: string;
  rarity: Rarity;
  itemCategory: ItemCategory;
  stats: StatMap; // e.g. { attack: 20, speed: 5 }
};

const BASE_SELL_VALUE_BY_RARITY: Record<Rarity, number> = {
  common: 100,
  uncommon: 200,
  rare: 500,
  epic: 1500,
  legendary: 5000,
};

// util
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Compute efficiency per your spec:
 * 1) primaryShare = sum(primaryStatValues) / sum(allStatValues)
 * 2) bestPrimaryFill = max(primaryStatValue / primaryStatCap)
 * efficiency = clamp01(0.60*primaryShare + 0.40*bestPrimaryFill)
 *
 * All-rounder neutral behavior:
 * - if no primaries defined for itemKey -> use bestFill over ALL stats (not punished)
 */
export function computeSellEfficiency(args: {
  drop: ItemDrop;
  getStatCapForDrop: (drop: ItemDrop, statKey: string) => number; // you already have this helper
}): number {
  const { drop, getStatCapForDrop } = args;

  const entries = Object.entries(drop.stats ?? {}).filter(
    ([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0
  );

  if (entries.length === 0) return 0; // nothing rolled -> worthless

  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total <= 0) return 0;

  const primaries = PRIMARY_STATS_BY_ITEMKEY[drop.itemKey];

  // --- All-rounder path (neutral): no primaries defined
  if (!primaries) {
    // bestFill across all stats
    let bestFill = 0;
    for (const [statKey, value] of entries) {
      const cap = getStatCapForDrop(drop, statKey);
      if (cap > 0) bestFill = Math.max(bestFill, value / cap);
    }
    return clamp01(bestFill); // neutral: solely fill quality
  }

  const [p1, p2] = primaries;

  const primarySum =
    (drop.stats[p1] ?? 0) +
    (drop.stats[p2] ?? 0);

  const primaryShare = primarySum / total;

  const p1Cap = getStatCapForDrop(drop, p1);
  const p2Cap = getStatCapForDrop(drop, p2);

  const p1Fill = p1Cap > 0 ? (drop.stats[p1] ?? 0) / p1Cap : 0;
  const p2Fill = p2Cap > 0 ? (drop.stats[p2] ?? 0) / p2Cap : 0;

  const bestPrimaryFill = Math.max(p1Fill, p2Fill);

  const efficiency = 0.60 * primaryShare + 0.40 * bestPrimaryFill;
  return clamp01(efficiency);
}

export function computeSellGold(args: {
  drop: ItemDrop;
  getStatCapForDrop: (drop: ItemDrop, statKey: string) => number;
}): number {
  const base = BASE_SELL_VALUE_BY_RARITY[args.drop.rarity] ?? 0;
  const eff = computeSellEfficiency(args);
  return Math.round(base * eff);
}
