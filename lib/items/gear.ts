// lib/items/gear.ts
// A whole loadout rolled at once with the real item rollers: the Labyrinth's
// enemies, and the practice fights, wear one of these.

import type { Rarity } from "./budgets";
import { ITEM_KEYS, type ItemKey } from "./ceilings";
import { ARMOR_KEYS, wornArmor, type ArmorKey, type ArmorSlot } from "./armor";
import { PRIMARY_STATS_BY_ITEMKEY } from "./itemPrimaries";
import { rollItemStats } from "./rollItemStats";
import { rollArmorSet } from "./rollArmorStats";
import type { CombatClass, CreatureTemplate } from "../creatures/creatureData";

export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export type Gear = {
  weaponKey: string;
  weapon: Record<string, number>;
  armorKey: string;
  armor: Record<string, number>;                           // the whole set's stats, summed
  armorPieces?: Record<ArmorSlot, Record<string, number>>; // the helmet, chest and legs it's made of
};

// A whole set of one armour: three pieces rolled on their own, and what they add up to.
export function rollWornSet(key: ArmorKey, rarity: Rarity) {
  const pieces = rollArmorSet(key, rarity);
  const stats = wornArmor(Object.values(pieces).map((stats) => ({ stats }))).stats;
  return { pieces, stats };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weapons a player would give each creature type: ones whose primary stats
// include that damage type.
const FITTED_WEAPONS: Record<CombatClass, ItemKey[]> = {
  melee:  ITEM_KEYS.filter((k) => PRIMARY_STATS_BY_ITEMKEY[k].includes("melee")),
  ranged: ITEM_KEYS.filter((k) => PRIMARY_STATS_BY_ITEMKEY[k].includes("ranged")),
  magic:  ITEM_KEYS.filter((k) => PRIMARY_STATS_BY_ITEMKEY[k].includes("magic")),
};

// Random weapon + armour of the given rarity, rolled with the real rollers.
// Pass a creature to give it a weapon that suits its type ("fitted").
export function rollGear(rarity: Rarity, fitTo?: CreatureTemplate): Gear {
  const weaponKey = pick(fitTo ? FITTED_WEAPONS[fitTo.cls] : ITEM_KEYS);
  const armorKey = pick(ARMOR_KEYS);
  const set = rollWornSet(armorKey, rarity);
  return {
    weaponKey,
    weapon: { ...rollItemStats(weaponKey, rarity).stats },
    armorKey,
    armor: set.stats,
    armorPieces: set.pieces,
  };
}
