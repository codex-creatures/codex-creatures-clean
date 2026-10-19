// lib/barcodeRegistry.ts
// LOCAL STAND-IN for the planned GLOBAL barcode database.
//
// The barcode number has no influence on the outcome. The first time any
// barcode is scanned, its outcome is rolled at random and registered here;
// every later scan (by anyone) gets that registered outcome. Item STATS are
// not stored — each player rolls their own when they receive the item.
//
// Stored separately from the player save, so "Reset Player" simulates a new
// player (registry kept) and clearRegistry() is the "Global Reset".
// When the real database exists, swap this module's internals for it.

import type { Rarity, ItemCategory } from "./types";
import type { ItemKey } from "./items/ceilings";
import { RARITY_WEIGHTS } from "./items/budgets";
import { ARMOR_SLOTS, type ArmorKey, type ArmorSlot } from "./items/armor";
import {
  pickRarity,
  pickItemCategory,
  pickWeaponKey,
  pickArmorKey,
  pickCreatureId,
} from "./items/gameHelpers";
import { canFind } from "./creatures/levels";
import { savesLocked } from "./save";

export type BarcodeOutcome =
  | { outcome: "gold"; amount: number }
  | { outcome: "creature"; rarity: Rarity; creatureId: string }
  | {
      outcome: "item";
      itemCategory: ItemCategory;
      rarity: Rarity;
      itemKey?: ItemKey;
      armorKey?: ArmorKey;
      armorSlot?: ArmorSlot;
    };

export type BarcodeEntry = BarcodeOutcome & { registeredAt: string };

export const REGISTRY_KEY = "codex_creatures_registry_v2"; // v2: creatures stored by id

function loadRegistry(): Record<string, BarcodeEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveRegistry(registry: Record<string, BarcodeEntry>) {
  if (savesLocked()) return;
  try {
    window.localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch {}
}

// Consumables are Common (a Lesser Potion) or Uncommon (a codex), at the
// usual odds between those two rarities.
function consumableRarity(): Rarity {
  const c = RARITY_WEIGHTS.common, u = RARITY_WEIGHTS.uncommon;
  return Math.random() * (c + u) < c ? "common" : "uncommon";
}

// A fresh random outcome — 20% creature / 60% item / 20% gold.
// playerLevel: a creature is only ever as rare as that explorer level can
// find (SCAN_UNLOCK); missing = anything.
export function rollBarcodeOutcome(playerLevel = Infinity): BarcodeOutcome {
  const outcomeRoll = Math.floor(Math.random() * 100) + 1;

  if (outcomeRoll > 80) {
    return { outcome: "gold", amount: 50 + Math.floor(Math.random() * 101) };
  }

  if (outcomeRoll <= 20) {
    let rarity = pickRarity("", "random");
    while (!canFind(playerLevel, rarity)) rarity = pickRarity("", "random");
    return { outcome: "creature", rarity, creatureId: pickCreatureId(rarity) };
  }

  const itemCategory = pickItemCategory("", "random");
  const rarity = itemCategory === "consumable" ? consumableRarity() : pickRarity("", "random");
  if (itemCategory === "weapon") {
    return { outcome: "item", itemCategory, rarity, itemKey: pickWeaponKey("", "random") };
  }
  if (itemCategory === "armor") {
    return { outcome: "item", itemCategory, rarity, armorKey: pickArmorKey("", "random"), armorSlot: ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)] };
  }
  return { outcome: "item", itemCategory, rarity };
}

// Look the barcode up; if nobody has scanned it yet, roll and register it.
export function resolveBarcode(code: string): BarcodeEntry {
  const registry = loadRegistry();
  const existing = registry[code];
  if (existing) return existing;

  const entry: BarcodeEntry = { ...rollBarcodeOutcome(), registeredAt: new Date().toISOString() };
  registry[code] = entry;
  saveRegistry(registry);
  return entry;
}

// "Global Reset" — every barcode will roll fresh on its next scan.
export function clearRegistry() {
  try {
    window.localStorage.removeItem(REGISTRY_KEY);
  } catch {}
}
