// lib/items/materials.ts
// Materials, schematics and the Labyrinth's tools.
//
// - Materials (planks, metal bars, nails, essence stones) are what you build
//   and upgrade things with. They stack: your storage holds one entry per
//   material, with a count (qty). In the Labyrinth they go in your pouch and
//   take no bag slot, like gold.
// - A schematic is a plan for something you can build at home (the crooked
//   bookcase: BUILDS). Building it uses up the schematic and its materials.
// - Tools are used in the Labyrinth, from your bag:
//   - a flare lights up the dark around you (the torch's radius) and lets you
//     look at your map scroll again;
//   - a clairvoyance scroll lets you look at the map and pick any room: you
//     see what's in it (even a mystery) and the rooms around it.
//   Tools stay in your bag between runs.

import type { Drop, Rarity } from "../types";

export type MaterialKey = "planks" | "metal_bars" | "nails" | "essence_stones";
export const MATERIALS: Record<MaterialKey, { name: string; icon: string; rarity: Rarity; desc: string }> = {
  planks:         { name: "Planks",         icon: "🪵", rarity: "common",   desc: "Rough-sawn wood. For building furniture." },
  nails:          { name: "Nails",          icon: "📌", rarity: "common",   desc: "A fistful of bent iron nails." },
  metal_bars:     { name: "Metal bars",     icon: "🧱", rarity: "uncommon", desc: "Dull iron ingots. For upgrades that need to be strong." },
  essence_stones: { name: "Essence stones", icon: "💎", rarity: "rare",     desc: "Stones that hum like the barcodes do. For magical upgrades." },
};
export const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];

export type ToolKey = "flare" | "clairvoyance";
export const TOOLS: Record<ToolKey, { name: string; icon: string; rarity: Rarity; price: number; desc: string }> = {
  flare:        { name: "Flare",               icon: "🧨", rarity: "uncommon", price: 75,
                  desc: "Light it in the Labyrinth: see the rooms around you and look at your map again." },
  clairvoyance: { name: "Clairvoyance Scroll", icon: "🔮", rarity: "epic",     price: 200,
                  desc: "Read it in the Labyrinth: look at your map and pick any room — you see what's in it, and the rooms around it." },
};

export type SchematicKey = "crooked_bookcase";
export const SCHEMATICS: Record<SchematicKey, { name: string; rarity: Rarity; cost: Partial<Record<MaterialKey, number>>; desc: string }> = {
  crooked_bookcase: { name: "Crooked Bookcase Schematic", rarity: "epic", cost: { planks: 20, nails: 10 },
                      desc: "Plans for a taller, leaning bookcase: it holds 25 codexes instead of 10." },
};

// The bookcase: how many codexes it holds at each level (1: the broken
// shelf you start with; 2: the crooked bookcase).
export const BOOKCASE_LEVELS = [10, 25];
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

// How much of a material you have (its stack in your storage).
export function countMaterial(inventory: Drop[], key: MaterialKey): number {
  return inventory.reduce((n, d) => n + (d.dropType === "item" && d.material === key ? d.qty ?? 1 : 0), 0);
}
export const canAfford = (inventory: Drop[], cost: Partial<Record<MaterialKey, number>>) =>
  (Object.entries(cost) as [MaterialKey, number][]).every(([k, n]) => countMaterial(inventory, k) >= n);

// The emoji for a material, tool or schematic (undefined for anything else).
export function goodsIcon(d: { material?: MaterialKey; tool?: ToolKey; schematic?: SchematicKey }): string | undefined {
  return d.material ? MATERIALS[d.material].icon : d.tool ? TOOLS[d.tool].icon : d.schematic ? "📐" : undefined;
}
