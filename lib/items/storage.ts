// lib/items/storage.ts — how much your chest holds. Weapons, armour and
// consumables each fill a box of BOX_CAP. Loot never goes to waste: a run's
// haul comes home even into a full box (it can go over), but you can't go
// back into the Labyrinth until every box has space again.

import type { Drop } from "../types";

export const BOX_CAP = 50;
export const CAPPED_BOXES = ["weapon", "armor", "consumable"] as const;
export type CappedBox = (typeof CAPPED_BOXES)[number];
export const BOX_NAMES: Record<CappedBox, string> = { weapon: "weapons", armor: "armour", consumable: "consumables" };

// How many of each kind you have at home.
export function boxCounts(inventory: Drop[]): Record<CappedBox, number> {
  const n: Record<CappedBox, number> = { weapon: 0, armor: 0, consumable: 0 };
  for (const d of inventory) {
    if (d.dropType === "item" && (CAPPED_BOXES as readonly string[]).includes(d.itemCategory ?? "")) n[d.itemCategory as CappedBox]++;
  }
  return n;
}

// The boxes with no space left (full or over): these keep you out of the Labyrinth.
export function fullBoxes(inventory: Drop[]): CappedBox[] {
  const n = boxCounts(inventory);
  return CAPPED_BOXES.filter((b) => n[b] >= BOX_CAP);
}
