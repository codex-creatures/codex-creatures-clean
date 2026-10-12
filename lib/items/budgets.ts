// lib/items/budgets.ts
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_BUDGETS = {
  common: 60,
  uncommon: 80,
  rare: 100,
  epic: 120,
  legendary: 150,
} as const;
// used for rolling rarity
export const RARITY_WEIGHTS = {
  common: 40,
  uncommon: 30,
  rare: 20,
  epic: 9,
  legendary: 1,
} as const;

