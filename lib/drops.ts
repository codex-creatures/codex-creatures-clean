// lib/drops.ts
// Turning an outcome (from a barcode, a labyrinth chest, a defeated enemy…)
// into a drop for the player's inventory. Item stats are rolled here with the
// real rollers, so every source gives items exactly like scanning does.

import type { Drop, Rarity, ItemCategory } from "./types";
import type { ItemKey } from "./items/ceilings";
import type { ArmorKey } from "./items/armor";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorStats } from "./items/rollArmorStats";
import { ITEM_META } from "./items/metadata";
import { ARMOR_META } from "./items/armor";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { creatureOrCard } from "./creatures/summon";
import type { BarcodeOutcome } from "./barcodeRegistry";

const now = () => new Date().toISOString();

export function goldDrop(amount: number, barcode = ""): Drop {
  return { id: crypto.randomUUID(), barcode, dropType: "reward", rewardKind: "resource", amount, createdAt: now() };
}

// A weapon or armour item. Pass `stats` to keep stats that were already
// rolled (e.g. an enemy's gear); otherwise they're rolled fresh.
export function weaponDrop(itemKey: ItemKey, rarity: Rarity, barcode = "", stats?: Record<string, number>): Drop {
  const meta = ITEM_META[itemKey];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "weapon", itemKey, rarity,
    roll: Math.floor(Math.random() * 100), name: meta?.name ?? itemKey, desc: meta?.desc ?? "",
    stats: stats ?? rollItemStats(itemKey, rarity, Math.random).stats, createdAt: now(),
  };
}

export function armorDrop(armorKey: ArmorKey, rarity: Rarity, barcode = "", stats?: Record<string, number>): Drop {
  const meta = ARMOR_META[armorKey];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "armor", armorKey, rarity,
    roll: Math.floor(Math.random() * 100), name: meta?.name ?? armorKey, desc: meta?.desc ?? "",
    stats: stats ?? rollArmorStats(armorKey, rarity, Math.random).stats, createdAt: now(),
  };
}

function plainItemDrop(itemCategory: ItemCategory, rarity: Rarity, barcode = ""): Drop {
  return { id: crypto.randomUUID(), barcode, dropType: "item", itemCategory, rarity, roll: 0, name: `${rarity} ${itemCategory}`, createdAt: now() };
}

// The drop a barcode-style outcome gives this player (null if it can't be made).
export function dropFromOutcome(result: BarcodeOutcome, barcode = ""): Drop | null {
  if (result.outcome === "gold") return goldDrop(result.amount, barcode);
  if (result.outcome === "creature") {
    // The outcome fixes WHICH creature; you usually get a card of it.
    const creature = CREATURE_BY_ID[result.creatureId];
    return creature ? creatureOrCard(creature, barcode) : null;
  }
  const { itemCategory, rarity, itemKey, armorKey } = result;
  if (itemCategory === "weapon") return itemKey ? weaponDrop(itemKey, rarity, barcode) : null;
  if (itemCategory === "armor") return armorKey ? armorDrop(armorKey, rarity, barcode) : null;
  return plainItemDrop(itemCategory, rarity, barcode);
}
