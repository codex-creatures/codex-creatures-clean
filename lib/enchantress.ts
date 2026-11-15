// lib/enchantress.ts
// The Enchantress (the user, 2026-11-16, decision 47; docs/design/den.md §9):
// a tavern visitor who doesn't play. She rerolls an item's enchantment
// (lib/items/enchantments.ts) to another from the pool that fits it, for
// REROLL_ESSENCE essence stones plus REROLL_GOLD by the item's rarity. She's
// the only way to change one. Only an enchanted item: she rerolls, she
// doesn't add one where there's none.

import type { Rarity } from "./items/budgets";
import { canAfford, type Materials } from "./items/materials";
import { enchantOf, rollEnchant, type EnchantKey } from "./items/enchantments";
import { isItemDrop, type CreatureOrItemDrop, type Drop } from "./types";

export const REROLL_GOLD: Partial<Record<Rarity, number>> = { rare: 1000, epic: 2000, legendary: 5000 };
export const REROLL_ESSENCE = 1;

// What a reroll costs for this item (null: she can't reroll it).
export function rerollCost(d: CreatureOrItemDrop): { gold: number; materials: Materials } | null {
  const gold = REROLL_GOLD[d.rarity];
  return enchantOf(d) && gold ? { gold, materials: { essence: REROLL_ESSENCE } } : null;
}
export function canReroll(d: CreatureOrItemDrop, gold: number, materials: Materials): boolean {
  const cost = rerollCost(d);
  return !!cost && gold >= cost.gold && canAfford(materials, cost.materials);
}

// The items she'll work on: your enchanted weapons and armour (worn ones too).
export const enchantedItems = (inventory: Drop[]): CreatureOrItemDrop[] =>
  inventory.filter((d): d is CreatureOrItemDrop => isItemDrop(d) && !!enchantOf(d));

// The item with a new enchantment: never the one it had.
export function reroll(d: CreatureOrItemDrop, rng: () => number = Math.random): CreatureOrItemDrop {
  const was = enchantOf(d);
  if (!was) return d;
  const next: EnchantKey = rollEnchant(d, rng, was);
  return { ...d, enchant: next };
}
