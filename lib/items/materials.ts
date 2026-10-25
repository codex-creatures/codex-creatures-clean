// lib/items/materials.ts
// Materials, schematics and the Labyrinth's tools.
//
// - Materials (planks, metal bars, nails, essence stones) are what you build
//   and upgrade things with. At home they're a tally, like gold (Materials:
//   a count of each). In the Labyrinth a find is a stack (a drop with a qty)
//   that takes a bag slot (more of the same joins its stack); it only joins
//   your tally once you bring it home.
// - A schematic is a plan for something you can build at home (the crooked
//   bookcase: BUILDS). Building it uses up the schematic and its materials.
// - Tools are used in the Labyrinth, from your bag:
//   - a flare lights up the dark around you (twice the torch's radius) and lets you
//     look at your map scroll again;
//   - a clairvoyance scroll lets you look at the map and pick any room: you
//     see what's in it (even a mystery) and the rooms around it.
//   Tools stay in your bag between runs.

import type { Drop, Rarity } from "../types";
import { SOUL_STONES, type SoulStoneKey } from "../creatures/soulStones";

export type MaterialKey = "planks" | "metal_bars" | "nails" | "essence_stones";
export const MATERIALS: Record<MaterialKey, { name: string; icon: string; rarity: Rarity; desc: string }> = {
  planks:         { name: "Planks",         icon: "🪵", rarity: "common",   desc: "Rough-sawn wood. For building furniture." },
  nails:          { name: "Nails",          icon: "📌", rarity: "common",   desc: "A fistful of bent iron nails." },
  metal_bars:     { name: "Metal bars",     icon: "🧱", rarity: "uncommon", desc: "Dull iron ingots. For upgrades that need to be strong." },
  essence_stones: { name: "Essence stones", icon: "💎", rarity: "rare",     desc: "Stones that hum like the barcodes do. For magical upgrades." },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

export type ToolKey = "flare" | "clairvoyance" | "revival";
export const TOOLS: Record<ToolKey, { name: string; icon: string; rarity: Rarity; price: number; desc: string }> = {
  flare:        { name: "Flare",               icon: "🧨", rarity: "uncommon", price: 75,
                  desc: "Light it in the Labyrinth: see the rooms around you and look at your map again." },
  clairvoyance: { name: "Clairvoyance Scroll", icon: "🔮", rarity: "epic",     price: 200,
                  desc: "Read it in the Labyrinth: look at your map and pick any room — you see what's in it, and the rooms around it." },
  // Between rooms only (not in a fight): see REVIVE_HP in lib/dungeon/run.ts.
  revival:      { name: "Revival Elixir",      icon: "💖", rarity: "epic",     price: 500,
                  desc: "Between rooms in the Labyrinth: brings a knocked-out creature back with half its HP." },
};

export type SchematicKey = "crooked_bookcase" | "iron_cage" | "weapon_storage" | "armor_storage";
export const SCHEMATICS: Record<SchematicKey, { name: string; rarity: Rarity; cost: Partial<Record<MaterialKey, number>>; desc: string }> = {
  crooked_bookcase: { name: "Crooked Bookcase Schematic", rarity: "epic", cost: { planks: 10, nails: 5 },
                      desc: "Plans for a taller, leaning bookcase: it holds 20 codexes instead of 10." },
  iron_cage:        { name: "Iron Cage Schematic", rarity: "rare", cost: { metal_bars: 10 },
                      desc: "Plans for a bigger cage: it holds 3 creatures instead of 1." },
  // The merchant's storage schematics (STORAGE_PLAN_PRICE): each box 50 → 75 (lib/items/storage.ts).
  weapon_storage:   { name: "Weapon Storage Schematic", rarity: "epic", cost: { planks: 10, nails: 10, essence_stones: 1 },
                      desc: "Plans for a bigger weapon box: it holds 75 weapons instead of 50." },
  armor_storage:    { name: "Armour Storage Schematic", rarity: "epic", cost: { planks: 10, nails: 10, essence_stones: 1 },
                      desc: "Plans for a bigger armour box: it holds 75 pieces instead of 50." },
};
// Which box each storage schematic makes bigger.
export const STORAGE_PLANS = { weapon_storage: "weapon", armor_storage: "armor" } as const;
export type StoragePlan = keyof typeof STORAGE_PLANS;

// The cage: how many creatures it holds at each level. 1: the cell you start
// with; 2: built from the Iron Cage Schematic (a mini boss's chest, until
// you've found one: CAGE_PLAN_CHANCE in lib/dungeon/run.ts).
export const CAGE_LEVELS = [1, 3];
export const cageSize = (level = 1) => CAGE_LEVELS[Math.min(CAGE_LEVELS.length, Math.max(1, level)) - 1];

// The bookcase: how many codexes it holds at each level. 1: the broken shelf
// you start with; 3: the crooked bookcase (BOOKCASE_BUILT), from the tavern's
// schematic. 2 is the crooked bookcase as built before the tavern questline:
// those saves keep their 25. Level 2 or more is the crooked bookcase.
export const BOOKCASE_LEVELS = [10, 25, 20];
export const BOOKCASE_BUILT = 3;
export const bookcaseSize = (level = 1) => BOOKCASE_LEVELS[Math.min(BOOKCASE_LEVELS.length, Math.max(1, level)) - 1];

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export function materialDrop(key: MaterialKey, qty: number): Drop {
  const m = MATERIALS[key];
  return { id: id(), barcode: "", dropType: "item", itemCategory: "material", rarity: m.rarity, roll: 0, name: m.name, material: key, qty, desc: m.desc, createdAt: now() };
}
export function toolDrop(key: ToolKey): Drop {
  const t = TOOLS[key];
  return { id: id(), barcode: "", dropType: "item", itemCategory: "consumable", rarity: t.rarity, roll: 0, name: t.name, tool: key, desc: t.desc, createdAt: now() };
}
export function schematicDrop(key: SchematicKey): Drop {
  const s = SCHEMATICS[key];
  return { id: id(), barcode: "", dropType: "item", itemCategory: "consumable", rarity: s.rarity, roll: 0, name: s.name, schematic: key, desc: s.desc, createdAt: now() };
}

// A scan's (or a find's) material outcome: a handful of materials, more and
// rarer the rarer the roll.
const BUNDLES: Record<Rarity, [MaterialKey, number, number][]> = {
  common:    [["planks", 2, 4], ["nails", 2, 5]],
  uncommon:  [["planks", 4, 7], ["nails", 4, 8], ["metal_bars", 1, 2]],
  rare:      [["planks", 6, 10], ["metal_bars", 2, 3], ["essence_stones", 1, 1]],
  epic:      [["metal_bars", 3, 5], ["essence_stones", 1, 2]],
  legendary: [["metal_bars", 5, 8], ["essence_stones", 2, 4]],
};
export function materialBundle(rarity: Rarity, rng: () => number = Math.random): Drop {
  const [key, min, max] = BUNDLES[rarity][Math.floor(rng() * BUNDLES[rarity].length)];
  return materialDrop(key, min + Math.floor(rng() * (max - min + 1)));
}

// Your materials at home: how many of each.
export type Materials = Partial<Record<MaterialKey, number>>;
export const countMaterial = (materials: Materials, key: MaterialKey): number => materials[key] ?? 0;
export const canAfford = (materials: Materials, cost: Materials) =>
  (Object.entries(cost) as [MaterialKey, number][]).every(([k, n]) => countMaterial(materials, k) >= n);
// Add (or, with negative counts, take away) materials.
export function addMaterials(materials: Materials, more: Materials): Materials {
  const out = { ...materials };
  for (const [k, n] of Object.entries(more) as [MaterialKey, number][]) out[k] = Math.max(0, (out[k] ?? 0) + n);
  return out;
}

// The emoji for a material, tool, schematic or soul stone (undefined for anything else).
export function goodsIcon(d: { material?: MaterialKey; tool?: ToolKey; schematic?: SchematicKey; stone?: SoulStoneKey }): string | undefined {
  return d.material ? MATERIALS[d.material].icon : d.tool ? TOOLS[d.tool].icon : d.schematic ? "📐" : d.stone ? SOUL_STONES[d.stone].icon : undefined;
}
