// lib/items/storage.ts — how much your chest holds. Weapons, armour and
// consumables each fill a box of BOX_CAP (codexes live on the bookcase,
// which has its own limit). Loot never goes to waste: a run's haul comes
// home even into a full box (it can go over), but you can't go back into
// the Labyrinth until every box has space again. A scan for a full box is
// kept as a Code Cache at the altar instead, and opens once there's room.
// The weapon and armour boxes can be built bigger (BIG_BOX_CAP) from the
// merchant's storage schematics; `big` is the boxes you've built up.

import type { Drop } from "../types";

export const BOX_CAP = 50;
export const BIG_BOX_CAP = 75;
export const CAPPED_BOXES = ["weapon", "armor", "consumable"] as const;
export type CappedBox = (typeof CAPPED_BOXES)[number];
export const BOX_NAMES: Record<CappedBox, string> = { weapon: "weapons", armor: "armour", consumable: "consumables" };

// How much one box holds.
export const boxCap = (b: CappedBox, big: readonly CappedBox[] = []) => (big.includes(b) ? BIG_BOX_CAP : BOX_CAP);

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
export function fullBoxes(inventory: Drop[], big: readonly CappedBox[] = []): CappedBox[] {
  const n = boxCounts(inventory);
  return CAPPED_BOXES.filter((b) => n[b] >= boxCap(b, big));
}

// Would this drop go into a box that's already full?
export const forFullBox = (inventory: Drop[], d: Drop, big: readonly CappedBox[] = []) => {
  const b = boxOf(d);
  return !!b && boxCounts(inventory)[b] >= boxCap(b, big);
};

// Which of these (Code Caches being opened, in order) there's room for, and
// the full boxes that hold the rest back.
export function fitInBoxes(inventory: Drop[], drops: Drop[], big: readonly CappedBox[] = []): { fit: Drop[]; full: CappedBox[] } {
  const n = boxCounts(inventory);
  const fit: Drop[] = [];
  const full = new Set<CappedBox>();
  for (const d of drops) {
    const b = boxOf(d);
    if (b && n[b] >= boxCap(b, big)) { full.add(b); continue; }
    if (b) n[b]++;
    fit.push(d);
  }
  return { fit, full: CAPPED_BOXES.filter((b) => full.has(b)) };
}
