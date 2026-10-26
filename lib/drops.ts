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
import { ARMOR_META, ARMOR_SLOTS, ARMOR_SLOT_INFO, ARMOR_V2, pieceName } from "./items/armor";
import { BASIC_MOVES, STRONG_MOVES, CLASS_INFO, CREATURE_BY_ID, KIT_BASIC_CODEXES, KIT_STRONG_CODEXES, LEARNABLE_MOVES, MOVE_BY_NAME, RACE_INFO, RACE_MOVES, type Skill } from "./creatures/creatureData";
import { KIT_MOVE_RACE, KIT_RACE_MOVES } from "./creatures/raceKitsV2";
import { creatureOrCard } from "./creatures/summon";
import type { BarcodeOutcome } from "./barcodeRegistry";
import { SCROLL_XP } from "./creatures/levels";
import { materialBundle } from "./items/materials";
import { SOUL_STONES, SOUL_STONE_REPLACE_COST, type SoulStoneKey } from "./creatures/soulStones";

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
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "armor", armorKey, armorSlot: slot, armorV: ARMOR_V2, rarity,
    roll: Math.floor(Math.random() * 100), name: meta ? pieceName(armorKey, slot) : armorKey,
    desc: meta ? `${ARMOR_SLOT_INFO[slot].name} piece. ${meta.desc}` : "",
    stats: stats ?? rollArmorPiece(armorKey, rarity, Math.random), createdAt: now(),
  };
}

// A codex: read it (once) to teach its move to a creature, then it crumbles.
// Race moves (Epic codexes) only to a creature of that race; learnable
// moves (Uncommon codexes, from scans and Labyrinth chests) to anyone; basic
// moves (Common codexes) and strong moves (Rare codexes), both from scans, to
// a creature of the move's class. Race-kit moves (Combat V2: Common if
// light, Rare if heavy) to a creature with that move in its kits: its race, in its style.
export function codexDrop(moveName: string, barcode = ""): Drop {
  const move = MOVE_BY_NAME[moveName];
  const kitRace = KIT_MOVE_RACE[moveName];
  const basic = BASIC_MOVES.some((m) => m.name === moveName) || KIT_BASIC_CODEXES.some((m) => m.name === moveName);
  const strong = STRONG_MOVES.some((m) => m.name === moveName) || KIT_STRONG_CODEXES.some((m) => m.name === moveName);
  const who = move?.race ? `one ${RACE_INFO[move.race].name} creature`
    : kitRace && move ? `one ${RACE_INFO[kitRace].name} ${CLASS_INFO[move.type].name} creature`
    : (basic || strong) && move ? `one ${CLASS_INFO[move.type].name} creature` : "any one creature";
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: move?.race ? "epic" : basic ? "common" : strong ? "rare" : "uncommon", roll: 0,
    name: `Codex: ${moveName}`, codexMove: moveName,
    desc: `Teaches ${moveName} to ${who}, then crumbles to dust. ${move?.desc ?? ""}`, createdAt: now(),
  };
}

// Race codexes (librarians, chests, the Cyclops): the older race moves and the race kits'.
export const RACE_CODEX_MOVES: Skill[] = [...RACE_MOVES, ...KIT_RACE_MOVES];
export const randomCodexMove = () => RACE_CODEX_MOVES[Math.floor(Math.random() * RACE_CODEX_MOVES.length)].name;
export const randomLearnableMove = () => LEARNABLE_MOVES[Math.floor(Math.random() * LEARNABLE_MOVES.length)].name;
const SCAN_BASIC_CODEXES = [...BASIC_MOVES, ...KIT_BASIC_CODEXES];
const SCAN_STRONG_CODEXES = [...STRONG_MOVES, ...KIT_STRONG_CODEXES];
export const randomBasicMove = () => SCAN_BASIC_CODEXES[Math.floor(Math.random() * SCAN_BASIC_CODEXES.length)].name;
export const randomStrongMove = () => SCAN_STRONG_CODEXES[Math.floor(Math.random() * SCAN_STRONG_CODEXES.length)].name;

// A Common consumable from a scan is a basic codex this often, otherwise a
// Lesser Potion; a Rare one is a strong codex this often, otherwise a Healing Potion.
export const BASIC_CODEX_SHARE = 0.5;
export const STRONG_CODEX_SHARE = 0.5;

// A potion in your storage: a Lesser Potion (heals 50) is a Common
// consumable from scans; a Healing Potion (heals 100) a Rare one, and it
// also comes out of the Labyrinth (stored from your bag). Pack one in your
// bag to take it back in.
const STORED_POTIONS = {
  lesser: { name: "Lesser Potion", heal: 50, rarity: "common" },
  potion: { name: "Healing Potion", heal: 100, rarity: "rare" },
} as const;
export function potionDrop(barcode = "", kind: keyof typeof STORED_POTIONS = "lesser"): Drop {
  const p = STORED_POTIONS[kind];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: p.rarity, roll: 0,
    name: p.name, potion: kind, desc: `Restores ${p.heal} HP to one creature. Pack it in your bag to use it in the Labyrinth.`, createdAt: now(),
  };
}

// An XP scroll: read it on a creature (or Klutz) for SCROLL_XP, then it's gone.
export function scrollDrop(barcode = ""): Drop {
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: "rare", roll: 0,
    name: "Tattered XP Scroll", scroll: "xp", desc: `Read it to give one creature, or Klutz, ${SCROLL_XP} XP.`, createdAt: now(),
  };
}

// A loose soul stone: set it in a creature from its window (lib/creatures/soulStones.ts).
export function soulStoneDrop(stone: SoulStoneKey, barcode = ""): Drop {
  const s = SOUL_STONES[stone];
  return {
    id: crypto.randomUUID(), barcode, dropType: "item", itemCategory: "consumable", rarity: "legendary", roll: 0,
    name: `Soul Stone: ${s.name}`, stone,
    desc: `${s.text} Set it in any creature from its window: free into an empty slot, ${SOUL_STONE_REPLACE_COST.toLocaleString()} gold to replace a stone (the old one is destroyed).`, createdAt: now(),
  };
}

function plainItemDrop(itemCategory: ItemCategory, rarity: Rarity, barcode = ""): Drop {
  return { id: crypto.randomUUID(), barcode, dropType: "item", itemCategory, rarity, roll: 0, name: `${rarity} ${itemCategory}`, createdAt: now() };
}

// The drop a barcode-style outcome gives this player (null if it can't be made).
export function dropFromOutcome(result: BarcodeOutcome, barcode = ""): Drop | null {
  if (result.outcome === "gold") return goldDrop(result.amount, barcode);
  if (result.outcome === "soul_stone") return soulStoneDrop(result.stone, barcode);
  if (result.outcome === "creature") {
    // The outcome fixes WHICH creature; you usually get a card of it.
    const creature = CREATURE_BY_ID[result.creatureId];
    return creature ? creatureOrCard(creature, barcode) : null;
  }
  const { itemCategory, rarity, itemKey, armorKey, armorSlot } = result;
  // Consumables: a Lesser Potion or a basic codex (Common), a codex of a
  // learnable move (Uncommon), or a Healing Potion or a strong codex (Rare).
  if (itemCategory === "consumable") {
    if (rarity === "common") return Math.random() < BASIC_CODEX_SHARE ? codexDrop(randomBasicMove(), barcode) : potionDrop(barcode);
    if (rarity === "rare") return Math.random() < STRONG_CODEX_SHARE ? codexDrop(randomStrongMove(), barcode) : potionDrop(barcode, "potion");
    return codexDrop(randomLearnableMove(), barcode);
  }
  if (itemCategory === "weapon") return itemKey ? weaponDrop(itemKey, rarity, barcode) : null;
  if (itemCategory === "armor") return armorKey ? armorDrop(armorKey, rarity, barcode, undefined, armorSlot) : null;
  if (itemCategory === "material") return { ...materialBundle(rarity), barcode };
  return plainItemDrop(itemCategory, rarity, barcode);
}
