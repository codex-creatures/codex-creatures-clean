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
  armorSlot?: import("./items/armor").ArmorSlot; // armour: helmet, chest or legs
  armorV?: number; // armour on the full-roll scale (ARMOR_V2); missing = older, upgraded on load (lib/save.ts)
  creatureId?: string; // stable id from lib/creatures/creatureData.ts
  // Creatures and cards: this individual's rolled %s and starting moves.
  // Missing on older creatures → the species' standard values.
  proficiency?: import("./creatures/creatureData").CreatureProficiency;
  moves?: string[];
  learned?: string[];   // creatures: race moves learned from codexes
  level?: number;       // creatures: level (lib/creatures/levels.ts); missing = 1
  xp?: number;          // …and XP towards the next one
  soulStone?: import("./creatures/soulStones").SoulStoneKey | null; // creatures/cards: its soul stone (Rare+); null: rolled none; missing: not rolled yet (an old save)
  codexMove?: string;   // a codex (consumable item): the move it teaches
  scroll?: "xp";        // an XP scroll (consumable item; SCROLL_XP in lib/creatures/levels.ts)
  potion?: "potion" | "lesser"; // a potion (consumable item; see POTIONS in lib/dungeon/run.ts)
  // lib/items/materials.ts:
  material?: import("./items/materials").MaterialKey; // a material: a stack of qty
  qty?: number;
  tool?: import("./items/materials").ToolKey;          // a Labyrinth tool (flare, clairvoyance scroll)
  schematic?: import("./items/materials").SchematicKey; // plans for something to build at home
  stats?: {
    melee?: number;
    ranged?: number;
    magic?: number;
    mDef?: number;
    rDef?: number;
    magDef?: number;
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