// lib/barcodeRegistry.ts
// The barcode registry: what each barcode holds.
//
// The barcode number has no influence on the outcome. The first time any
// barcode is scanned, its outcome is rolled at random and registered; every
// later scan (by anyone) gets that registered outcome. Item STATS are not
// stored — each player rolls their own when they receive the item.
//
// Two registries, one set of rules (REGISTRY_RULES):
// - Online builds use the GLOBAL registry (docs/design.md §12): the roll is
//   made on the server, by the database function in supabase/migrations,
//   from a copy of REGISTRY_RULES (lib/online/registry.ts asks it).
// - A copy without online (the offline Windows build, tests) keeps a LOCAL
//   one in this browser (REGISTRY_KEY). "Reset player" keeps it, to simulate
//   a friend; clearRegistry() is the "Global Reset".

import type { Rarity, ItemCategory } from "./types";
import type { ItemKey } from "./items/ceilings";
import { ITEM_KEYS } from "./items/ceilings";
import { RARITY_WEIGHTS } from "./items/budgets";
import { ARMOR_KEYS, ARMOR_SLOTS, type ArmorKey, type ArmorSlot } from "./items/armor";
import { CREATURES_BY_RARITY } from "./creatures/creatureData";
import { canFind } from "./creatures/levels";
import { SOUL_STONE_KEYS, type SoulStoneKey } from "./creatures/soulStones";
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

// A barcode looked up: what it holds, and whether this scan was the first ever.
export type Lookup = { entry: BarcodeEntry; first: boolean };

export const REGISTRY_KEY = "codex_creatures_registry_v3"; // v3: started again for Combat V2 (v2: creatures stored by id)

// What a fresh barcode gives, out of 100. Weapons and armour share 40, armour
// twice as often (it comes in three pieces, so you need more of it).
// 40% creature at 1% legendary: about one legendary per 250 scans.
// A soul stone (1%, the user 2026-10-25, taken from armour) only for the
// first to scan the barcode.
export type DropOdds = Record<"creature" | ItemCategory | "gold" | "soul_stone", number>;
export const SCAN_ODDS: DropOdds = { creature: 40, weapon: 13, armor: 26, consumable: 7, material: 6, gold: 7, soul_stone: 1 };
// A Labyrinth chest keeps the original table (its creatures come as cards).
export const CHEST_ODDS: DropOdds = { creature: 20, weapon: 12, armor: 24, consumable: 12, material: 12, gold: 20, soul_stone: 0 };

// Everything a barcode's roll needs, as plain data. The server rolls from a
// copy of this (supabase/migrations: the latest registry_rules), so after
// changing any of it run `npm run registry:rules` and apply the new
// migration; a test fails until the copy matches.
// Consumables are Common (a Lesser Potion or a basic codex), Uncommon (a
// learnable codex) or Rare (a Healing Potion or a strong codex), at the usual
// odds between those three rarities.
export type RegistryRules = {
  odds: Record<string, number>;
  rarity: Record<string, number>;
  consumableRarity: Record<string, number>;
  gold: { min: number; max: number };
  creatures: Record<string, string[]>;
  weapons: string[];
  armors: string[];
  armorSlots: string[];
  soulStones: string[];
};

export const REGISTRY_RULES: RegistryRules = {
  odds: SCAN_ODDS,
  rarity: { ...RARITY_WEIGHTS },
  consumableRarity: { common: RARITY_WEIGHTS.common, uncommon: RARITY_WEIGHTS.uncommon, rare: RARITY_WEIGHTS.rare },
  gold: { min: 50, max: 150 },
  creatures: Object.fromEntries(Object.keys(RARITY_WEIGHTS).map((r) => [r, CREATURES_BY_RARITY[r].map((c) => c.id)])),
  weapons: [...ITEM_KEYS],
  armors: [...ARMOR_KEYS],
  armorSlots: [...ARMOR_SLOTS],
  soulStones: [...SOUL_STONE_KEYS],
};

// A key, at the weights given.
function pickWeighted(weights: Record<string, number>, rng: () => number): string {
  const entries = Object.entries(weights);
  let roll = rng() * entries.reduce((n, [, w]) => n + w, 0);
  for (const [k, w] of entries) {
    if ((roll -= w) < 0) return k;
  }
  return entries[entries.length - 1][0];
}
const pickAny = <T>(list: readonly T[], rng: () => number): T => list[Math.floor(rng() * list.length)];

// One roll from the rules. The server's registry_roll does the same steps.
export function rollFromRules(rules: RegistryRules, rng: () => number = Math.random): BarcodeOutcome {
  const pick = pickWeighted(rules.odds, rng);

  if (pick === "gold") return { outcome: "gold", amount: rules.gold.min + Math.floor(rng() * (rules.gold.max - rules.gold.min + 1)) };
  if (pick === "soul_stone") return { outcome: "soul_stone", stone: pickAny(rules.soulStones, rng) as SoulStoneKey };

  if (pick === "creature") {
    const rarity = pickWeighted(rules.rarity, rng) as Rarity;
    return { outcome: "creature", rarity, creatureId: pickAny(rules.creatures[rarity], rng) };
  }

  const itemCategory = pick as ItemCategory;
  if (itemCategory === "consumable") return { outcome: "item", itemCategory, rarity: pickWeighted(rules.consumableRarity, rng) as Rarity };
  const rarity = pickWeighted(rules.rarity, rng) as Rarity;
  if (itemCategory === "weapon") return { outcome: "item", itemCategory, rarity, itemKey: pickAny(rules.weapons, rng) as ItemKey };
  if (itemCategory === "armor") {
    return { outcome: "item", itemCategory, rarity, armorKey: pickAny(rules.armors, rng) as ArmorKey, armorSlot: pickAny(rules.armorSlots, rng) as ArmorSlot };
  }
  return { outcome: "item", itemCategory, rarity };
}

// A fresh random outcome, at SCAN_ODDS (or the odds given). Any rarity can
// come up: your explorer level only limits barcodes someone already found.
export const rollBarcodeOutcome = (odds: DropOdds = SCAN_ODDS): BarcodeOutcome => rollFromRules({ ...REGISTRY_RULES, odds });

const goldOutcome = (): BarcodeOutcome => rollFromRules({ ...REGISTRY_RULES, odds: { gold: 1 } });

// A barcode someone else scanned first: its soul stone was theirs, so you get gold.
export const claimedOutcome = (entry: BarcodeOutcome): BarcodeOutcome => (entry.outcome === "soul_stone" ? goldOutcome() : entry);

// Someone else's find too rare for your explorer level: it stays sealed
// until you can find that rarity. Being first beats the cap: a barcode
// nobody had scanned is yours whatever it is.
export const tooRare = ({ entry, first }: Lookup, playerLevel: number) =>
  !first && entry.outcome === "creature" && !canFind(playerLevel, entry.rarity);

// ── The local registry ──────────────────────────────────────────────

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

// Look the barcode up; if nobody has scanned it yet, roll and register it.
export function lookupLocal(code: string): Lookup {
  const registry = loadRegistry();
  const existing = registry[code];
  if (existing) return { entry: existing, first: false };

  const entry: BarcodeEntry = { ...rollBarcodeOutcome(), registeredAt: new Date().toISOString() };
  registry[code] = entry;
  saveRegistry(registry);
  return { entry, first: true };
}
export const resolveBarcode = (code: string): BarcodeEntry => lookupLocal(code).entry;

// Your first scan of a barcode, in the local registry: what it holds, whether
// it's sealed (tooRare), and whether you were the first ever to scan it.
export function scanBarcode(code: string, playerLevel: number): { entry: BarcodeEntry; sealed: boolean; first: boolean } {
  const found = lookupLocal(code);
  return { ...found, sealed: tooRare(found, playerLevel) };
}

// "Global Reset" — every barcode will roll fresh on its next scan.
export function clearRegistry() {
  try {
    window.localStorage.removeItem(REGISTRY_KEY);
  } catch {}
}
