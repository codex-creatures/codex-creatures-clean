// lib/items/gameHelpers.ts
// Pure helper functions shared across hooks and components.
// No React imports — these are plain TS utilities.

import type { Rarity } from "./budgets";
import { RARITY_WEIGHTS } from "./budgets";
import type { ItemKey } from "./ceilings";
import { ITEM_CEILINGS } from "./ceilings";
import type { ArmorKey } from "./armor";
import { ARMOR_CEILINGS, ARMOR_KEYS, pieceCeilings } from "./armor";
import type { ItemCategory, Drop } from "../types";
import { isItemDrop } from "../types";
import { ITEM_KEYS } from "./ceilings";
import { CREATURE_TEMPLATES, CREATURES_BY_RARITY } from "../creatures/creatureData";

// ── Rarity colours ───────────────────────────────────────
export const RARITY_COLORS: Record<Rarity, { text: string; border: string; glow: string }> = {
  common:    { text: "#9CA3AF", border: "rgba(156,163,175,0.35)", glow: "rgba(156,163,175,0.12)" },
  uncommon:  { text: "#22C55E", border: "rgba(34,197,94,0.35)",   glow: "rgba(34,197,94,0.15)"  },
  rare:      { text: "#4EA1FF", border: "rgba(78,161,255,0.45)",  glow: "rgba(78,161,255,0.18)" },
  epic:      { text: "#BB86FF", border: "rgba(184,107,255,0.45)", glow: "rgba(184,107,255,0.18)"},
  legendary: { text: "#FFCC4D", border: "rgba(255,204,77,0.55)",  glow: "rgba(255,204,77,0.22)" },
};

// A rarity's glow behind a thing in an inventory (stronger than .glow).
export const rarityGlow = (r: Rarity) => `${RARITY_COLORS[r].text}5c`;

// ── Deterministic hashing ────────────────────────────────
export function deterministicRoll(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) + 1;
}

// ── Rarity picking (single correct system) ───────────────
// All drops — creatures AND items — use this function.
// Uses RARITY_WEIGHTS so all 5 rarities including uncommon are reachable.
export function pickRarity(seed: string, rollMode: "random" | "deterministic"): Rarity {
  const entries = Object.entries(RARITY_WEIGHTS) as Array<[Rarity, number]>;
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  const r =
    rollMode === "deterministic"
      ? (deterministicRoll(`${seed}:rarity`) % total) + 1
      : Math.floor(Math.random() * total) + 1;
  let cumulative = 0;
  for (const [rarity, weight] of entries) {
    cumulative += weight;
    if (r <= cumulative) return rarity;
  }
  return "common";
}

// ── Item category picking ────────────────────────────────
export function pickItemCategory(
  code: string,
  rollMode: "random" | "deterministic"
): ItemCategory {
  // Armour counts twice: it comes in three pieces, so you need more of it.
  const categories: ItemCategory[] = ["weapon", "armor", "armor", "material", "consumable"];
  if (rollMode === "deterministic") {
    return categories[deterministicRoll(`${code}:itemCategory`) % categories.length];
  }
  return categories[Math.floor(Math.random() * categories.length)];
}

// ── Weapon / armor key picking ───────────────────────────
export function pickWeaponKey(
  code: string,
  rollMode: "random" | "deterministic"
): ItemKey {
  if (rollMode === "deterministic") {
    return ITEM_KEYS[deterministicRoll(`${code}:itemKey`) % ITEM_KEYS.length];
  }
  return ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
}

export function pickArmorKey(
  code: string,
  rollMode: "random" | "deterministic"
): ArmorKey {
  if (rollMode === "deterministic") {
    return ARMOR_KEYS[deterministicRoll(`${code}:armorKey`) % ARMOR_KEYS.length];
  }
  return ARMOR_KEYS[Math.floor(Math.random() * ARMOR_KEYS.length)];
}

// ── Stat cap lookup ──────────────────────────────────────
export function getStatCapForDrop(d: Drop, stat: string): number | null {
  if (!isItemDrop(d)) return null;
  if (d.itemCategory === "weapon") {
    const ceilings = ITEM_CEILINGS[d.itemKey as ItemKey];
    if (!ceilings) return null;
    const rc = ceilings[d.rarity as Rarity];
    return rc ? (rc as any)[stat] ?? null : null;
  }
  if (d.itemCategory === "armor") {
    const ceilings = ARMOR_CEILINGS[d.armorKey as ArmorKey];
    if (!ceilings) return null;
    const rc = ceilings[d.rarity as Rarity];
    if (!rc) return null;
    // A piece rolls within its armour's ceilings, with a share of the HP.
    const caps = d.armorSlot ? (pieceCeilings(d.armorKey as ArmorKey, d.rarity as Rarity) as Record<string, number>) : (rc as Record<string, number>);
    return caps[stat] ?? null;
  }
  return null;
}

// ── Creatures (roster lives in lib/creatures/creatureData.ts) ──
export const TOTAL_CREATURES = CREATURE_TEMPLATES.length;
export const TOTAL_WEAPONS   = ITEM_KEYS.length;
export const TOTAL_ARMOR     = Object.keys(ARMOR_CEILINGS).length;
export const TOTAL_ITEMS     = TOTAL_WEAPONS + TOTAL_ARMOR;

// Random creature of the given rarity — returns its stable id.
export function pickCreatureId(rarity: Rarity): string {
  const pool = CREATURES_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)].id;
}