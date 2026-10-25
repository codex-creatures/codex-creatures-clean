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
  pickWeaponKey,
  pickArmorKey,
  pickCreatureId,
} from "./items/gameHelpers";
import { canFind } from "./creatures/levels";
import { randomSoulStone, type SoulStoneKey } from "./creatures/soulStones";
import { savesLocked } from "./save";

export type BarcodeOutcome =
  | { outcome: "gold"; amount: number }
  | { outcome: "soul_stone"; stone: SoulStoneKey } // only for whoever scans it first: later finders get gold (claimedOutcome)
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

export const REGISTRY_KEY = "codex_creatures_registry_v3"; // v3: started again for Combat V2 (v2: creatures stored by id)

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

// Consumables are Common (a Lesser Potion or a basic codex), Uncommon (a
// learnable codex) or Rare (a Healing Potion or a strong codex), at the usual
// odds between those three rarities.
function consumableRarity(): Rarity {
  const c = RARITY_WEIGHTS.common, u = RARITY_WEIGHTS.uncommon, r = RARITY_WEIGHTS.rare;
  const roll = Math.random() * (c + u + r);
  return roll < c ? "common" : roll < c + u ? "uncommon" : "rare";
}

// What a fresh barcode gives, out of 100. Weapons and armour share 40, armour
// twice as often (it comes in three pieces, so you need more of it).
// 40% creature at 1% legendary: about one legendary per 250 scans.
// A soul stone (1%, the user 2026-10-25, taken from armour) only for the
// first to scan the barcode.
export type DropOdds = Record<"creature" | ItemCategory | "gold" | "soul_stone", number>;
export const SCAN_ODDS: DropOdds = { creature: 40, weapon: 13, armor: 26, consumable: 7, material: 6, gold: 7, soul_stone: 1 };
// A Labyrinth chest keeps the original table (its creatures come as cards).
export const CHEST_ODDS: DropOdds = { creature: 20, weapon: 12, armor: 24, consumable: 12, material: 12, gold: 20, soul_stone: 0 };

function pickOutcome(odds: DropOdds): keyof DropOdds {
  const entries = Object.entries(odds) as [keyof DropOdds, number][];
  let roll = Math.random() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of entries) {
    if ((roll -= w) < 0) return k;
  }
  return "gold";
}

const goldOutcome = (): BarcodeOutcome => ({ outcome: "gold", amount: 50 + Math.floor(Math.random() * 101) });

// A barcode someone else scanned first: its soul stone was theirs, so you get gold.
export const claimedOutcome = (entry: BarcodeOutcome): BarcodeOutcome => (entry.outcome === "soul_stone" ? goldOutcome() : entry);

// A fresh random outcome, at SCAN_ODDS (or the odds given). Any rarity can
// come up: your explorer level only limits barcodes someone already found.
export function rollBarcodeOutcome(odds: DropOdds = SCAN_ODDS): BarcodeOutcome {
  const pick = pickOutcome(odds);

  if (pick === "gold") return goldOutcome();
  if (pick === "soul_stone") return { outcome: "soul_stone", stone: randomSoulStone() };

  if (pick === "creature") {
    const rarity = pickRarity("", "random");
    return { outcome: "creature", rarity, creatureId: pickCreatureId(rarity) };
  }

  const itemCategory: ItemCategory = pick;
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

// Your first scan of a barcode (first: nobody had scanned it before you). If nobody had found it before, it's yours
// whatever it is (being first is its own reward). If it was already
// registered and holds a creature too rare for your explorer level, it's
// sealed: you can come back for it once you can find that rarity.
export function scanBarcode(code: string, playerLevel: number): { entry: BarcodeEntry; sealed: boolean; first: boolean } {
  const known = code in loadRegistry();
  const entry = resolveBarcode(code);
  return { entry, sealed: known && entry.outcome === "creature" && !canFind(playerLevel, entry.rarity), first: !known };
}

// "Global Reset" — every barcode will roll fresh on its next scan.
export function clearRegistry() {
  try {
    window.localStorage.removeItem(REGISTRY_KEY);
  } catch {}
}
