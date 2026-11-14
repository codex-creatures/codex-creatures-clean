// lib/sprites/items.ts
// Item icons: PixelLab art (public/sprites/items), 64×64 drawn in the 32px
// space the old code-drawn icons took. Each sprite's grid is a single dot:
// there's no older drawing to fall back on.

import type { Sprite } from "./pixels";
import { withArt } from "./art";
import type { MaterialKey, ToolKey } from "../items/materials";
import { ITEM_CEILINGS, type ItemKey } from "../items/ceilings";
import { ARMOR_KEYS, type ArmorKey } from "../items/armor";

const icon = (file: string): Sprite => withArt(["."], { src: `/sprites/items/${file}.png`, w: 64, h: 64, size: 32 });
const each = <K extends string>(keys: readonly K[], file: (k: K) => string) =>
  Object.fromEntries(keys.map((k) => [k, icon(file(k))])) as Record<K, Sprite>;

// Weapons, Klutz's club included (public/sprites/items/<key>.png).
export const WEAPON_SPRITES = each<ItemKey>(Object.keys(ITEM_CEILINGS) as ItemKey[], (k) => k);
// Armour: a chestpiece, helmet and legs for each set
// (public/sprites/items/armor/<piece>_<key>.png), so a set reads as one set.
export const ARMOR_SPRITES = each<ArmorKey>(ARMOR_KEYS, (k) => `armor/chest_${k}`);
export const HELMET_SPRITES = each<ArmorKey>(ARMOR_KEYS, (k) => `armor/helmet_${k}`);
export const LEGS_SPRITES = each<ArmorKey>(ARMOR_KEYS, (k) => `armor/legs_${k}`);

// Icons for the things that aren't gear (64px PixelLab art in a 32px space,
// like the gear): gold, the two potions, and the rugged backpack.
export const GOLD_SPRITE = icon("gold");
export const POTION_SPRITES: Record<"potion" | "lesser", Sprite> = { potion: icon("potion"), lesser: icon("lesser_potion") };
export const BACKPACK_SPRITE = icon("backpack");
// Building materials.
export const MATERIAL_SPRITES: Partial<Record<MaterialKey, Sprite>> = { planks: icon("materials/planks"), nails: icon("materials/nails"), metal_bars: icon("materials/metal_bars"), essence: icon("materials/essence_stones") }; // (the gem art is the epic essence stone's; Stone has none yet)
// The Labyrinth's tools (the Torch, drawn at 32px, keeps its old id: flare), codexes,
// XP scrolls and schematics.
export const TOOL_SPRITES: Record<ToolKey, Sprite> = {
  flare: withArt(["."], { src: "/sprites/items/tools/flare.png", w: 32, h: 32, size: 32 }),
  clairvoyance: icon("tools/clairvoyance"), revival: icon("tools/revival"),
  // (Stand-ins till the locators have art of their own.)
  merchant_map: icon("schematic"), crystal_ball: icon("tools/clairvoyance"), librarian_locator: icon("codex"),
  gold_key: icon("tools/gold_key"), // (PixelLab's, 2026-11-13: PIXELLAB.md)
  klutz_pack: icon("backpack"), // (a stand-in)
};
export const CODEX_SPRITE = icon("codex");
export const SCROLL_SPRITE = icon("xp_scroll");
export const SCHEMATIC_SPRITE = icon("schematic");
// …and the rarity their glow shows in an inventory: gold and the backpack are
// treasure (legendary); a full potion rare, a lesser one common.
export const GOLD_RARITY = "legendary" as const;
export const BACKPACK_RARITY = "legendary" as const;
export const POTION_RARITY = { potion: "rare", lesser: "common" } as const;
