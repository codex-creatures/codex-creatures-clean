// lib/items/storage.ts — how much your chest holds. Weapons, armour and
// consumables each fill a box of BOX_CAP (codexes live on the bookcase,
// which has its own limit). Loot never goes to waste: a run's haul comes
// home even into a full box (it can go over), but you can't go back into
// the Labyrinth until every box has space again. A scan for a full box is
// kept as a Code Cache at the altar instead, and opens once there's room.

import type { Drop } from "../types";

export const BOX_CAP = 50;
export const CAPPED_BOXES = ["weapon", "armor", "consumable"] as const;
export type CappedBox = (typeof CAPPED_BOXES)[number];
export const BOX_NAMES: Record<CappedBox, string> = { weapon: "weapons", armor: "armour", consumable: "consumables" };

// Which box a drop goes in, if any (creatures, cards, gold and materials don't).
export function boxOf(d: Drop): CappedBox | undefined {
  if (d.dropType !== "item" || d.codexMove) return undefined;
  return (CAPPED_BOXES as readonly string[]).includes(d.itemCategory ?? "") ? d.itemCategory as CappedBox : undefined;
}

// How many of each kind you have at home.
export function boxCounts(inventory: Drop[]): Record<CappedBox, number> {
  const n: Record<CappedBox, number> = { weapon: 0, armor: 0, consumable: 0 };
  for (const d of inventory) { const b = boxOf(d); if (b) n[b]++; }
  return n;
}

// The boxes with no space left (full or over): these keep you out of the Labyrinth.
export function fullBoxes(inventory: Drop[]): CappedBox[] {
  const n = boxCounts(inventory);
  return CAPPED_BOXES.filter((b) => n[b] >= BOX_CAP);
}

// Would this drop go into a box that's already full?
export const forFullBox = (inventory: Drop[], d: Drop) => { const b = boxOf(d); return !!b && boxCounts(inventory)[b] >= BOX_CAP; };

// Which of these (Code Caches being opened, in order) there's room for, and
// the full boxes that hold the rest back.
export function fitInBoxes(inventory: Drop[], drops: Drop[]): { fit: Drop[]; full: CappedBox[] } {
  const n = boxCounts(inventory);
  const fit: Drop[] = [];
  const full = new Set<CappedBox>();
  for (const d of drops) {
    const b = boxOf(d);
    if (b && n[b] >= BOX_CAP) { full.add(b); continue; }
    if (b) n[b]++;
    fit.push(d);
  }
  return { fit, full: CAPPED_BOXES.filter((b) => full.has(b)) };
}
