// lib/items/itemPrimaries.ts

export type StatKey = string;
export type ItemKey = string;

// Each item has exactly 2 primaries.
// If an itemKey is missing from this map, it will be treated as an all-rounder (neutral).
export const PRIMARY_STATS_BY_ITEMKEY: Record<ItemKey, [StatKey, StatKey]> = {
  // TODO: Fill these with your real item keys + two primary stats
  // Example:
  // "VOID_SCYTHE": ["melee", "hp"],
};
