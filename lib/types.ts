// lib/types.ts
// Single source of truth for all shared game types.
// Import Rarity from here everywhere — never redefine it locally.

export type { Rarity } from "./items/budgets";

export type ItemCategory = "weapon" | "armor" | "material" | "consumable";
export type RewardKind = "resource";

export type CreatureOrItemDrop = {
  id: string;
  barcode: string;
  dropType: "creature" | "item" | "card"; // card: a creature card (3 of a kind summon a creature)
  rarity: import("./items/budgets").Rarity;
  roll: number;
  name: string;
  itemCategory?: ItemCategory;
  itemKey?: import("./items/ceilings").ItemKey;
  armorKey?: import("./items/armor").ArmorKey;
  creatureId?: string; // stable id from lib/creatures/creatureData.ts
  // Creatures and cards: this individual's rolled %s and starting moves.
  // Missing on older creatures → the species' standard values.
  proficiency?: import("./creatures/creatureData").CreatureProficiency;
  moves?: string[];
  stats?: {
    melee?: number;
    ranged?: number;
    mDef?: number;
    rDef?: number;
    agility?: number;
    hp?: number;
  };
  desc?: string;
  createdAt: string;
};

export type RewardDrop = {
  id: string;
  barcode: string;
  dropType: "reward";
  rewardKind: RewardKind;
  amount: number;
  createdAt: string;
};

export type Drop = CreatureOrItemDrop | RewardDrop;

// ── Type guards ──────────────────────────────────────────
export function isRewardDrop(d: Drop): d is RewardDrop {
  return d.dropType === "reward";
}

export function isCreatureOrItemDrop(d: Drop): d is CreatureOrItemDrop {
  return d.dropType === "creature" || d.dropType === "item" || d.dropType === "card";
}

export function isCardDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "card" } {
  return d.dropType === "card";
}

export function isCreatureDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "creature" } {
  return d.dropType === "creature";
}

export function isItemDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "item" } {
  return d.dropType === "item";
}

export function isSellableItem(d: Drop): d is CreatureOrItemDrop & { dropType: "item" } {
  return isItemDrop(d) && (d.itemCategory === "weapon" || d.itemCategory === "armor");
}