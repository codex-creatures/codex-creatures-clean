// lib/drops.ts
// Turning an outcome (from a barcode, a dungeon chest, a defeated enemy…)
// into a drop for the player's inventory. Item stats are rolled here with the
// real rollers, so every source gives items exactly like scanning does.

import type { Drop, Rarity, ItemCategory } from "./types";
import type { ItemKey } from "./items/ceilings";
import type { ArmorKey, ArmorSlot } from "./items/armor";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { ITEM_META } from "./items/metadata";
import { ARMOR_META, ARMOR_SLOTS, ARMOR_SLOT_INFO, pieceName } from "./items/armor";
import { CREATURE_BY_ID, LEARNABLE_MOVES, MOVE_BY_NAME, RACE_INFO, RACE_MOVES } from "./creatures/creatureData";
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

// A piece of armour (helmet, chest or legs — a random one if not given).
export const randomArmorSlot = (): ArmorSlot => ARMOR_SLOTS[Math.floor(Math.random() * ARMOR_SLOTS.length)];

export function armorDrop(armorKey: ArmorKey, rarity: Rarity, barcode = "", stats?: Record<string, number>, slot: ArmorSlot = randomArmorSlot()): Drop {
  const meta = ARMOR_META[armorKey];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "armor", armorKey, armorSlot: slot, rarity,
    roll: Math.floor(Math.random() * 100), name: meta ? pieceName(armorKey, slot) : armorKey,
    desc: meta ? `${ARMOR_SLOT_INFO[slot].name} piece. ${meta.desc}` : "",
    stats: stats ?? rollArmorPiece(armorKey, rarity, slot, Math.random), createdAt: now(),
  };
}

// A codex: read it (once) to teach its move to a creature, then it crumbles.
// Race moves (Epic codexes) only to a creature of that race; learnable
// moves (Uncommon codexes, from scans and Labyrinth chests) to anyone.
export function codexDrop(moveName: string, barcode = ""): Drop {
  const move = MOVE_BY_NAME[moveName];
  const race = move?.race ? RACE_INFO[move.race].name : "";
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: move?.race ? "epic" : "uncommon", roll: 0,
    name: `Codex: ${moveName}`, codexMove: moveName,
    desc: `Teaches ${moveName} to ${race ? `one ${race} creature` : "any one creature"}, then crumbles to dust. ${move?.desc ?? ""}`, createdAt: now(),
  };
}

export const randomCodexMove = () => RACE_MOVES[Math.floor(Math.random() * RACE_MOVES.length)].name;
export const randomLearnableMove = () => LEARNABLE_MOVES[Math.floor(Math.random() * LEARNABLE_MOVES.length)].name;

// A potion in your storage: a Lesser Potion (heals 50) is the Common
// consumable from scans; a Healing Potion (heals 100) only comes out of the
// Labyrinth (stored from your bag). Pack one in your bag to take it back in.
const STORED_POTIONS = {
  lesser: { name: "Lesser Potion", heal: 50, rarity: "common" },
  potion: { name: "Healing Potion", heal: 100, rarity: "uncommon" },
} as const;
export function potionDrop(barcode = "", kind: keyof typeof STORED_POTIONS = "lesser"): Drop {
  const p = STORED_POTIONS[kind];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: p.rarity, roll: 0,
    name: p.name, potion: kind, desc: `Restores ${p.heal} HP to one creature. Pack it in your bag to use it in the Labyrinth.`, createdAt: now(),
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
  const { itemCategory, rarity, itemKey, armorKey, armorSlot } = result;
  // Consumables: a Lesser Potion (Common) or a codex of a learnable move (Uncommon).
  if (itemCategory === "consumable") return rarity === "common" ? potionDrop(barcode) : codexDrop(randomLearnableMove(), barcode);
  if (itemCategory === "weapon") return itemKey ? weaponDrop(itemKey, rarity, barcode) : null;
  if (itemCategory === "armor") return armorKey ? armorDrop(armorKey, rarity, barcode, undefined, armorSlot) : null;
  return plainItemDrop(itemCategory, rarity, barcode);
}
