// lib/items/storage.ts — how much your chest holds. Weapons, armour and
// consumables each fill a box of BOX_CAP (codexes live on the bookcase,
// which has its own limit). Loot never goes to waste: a run's haul comes
// home even into a full box (it can go over), but you can't go back into
// the Labyrinth until every box has space again. A scan for a full box is
// kept as a Code Cache at the altar instead, and opens once there's room.
// The weapon and armour boxes are built bigger in stages (BOX_CAPS: 50, 60, 75,
// 85, 100; the user, 2026-11-20), a storage schematic for each (lib/items/plans.ts);
// past 100 is to be bought (not built). `big` is the boxes you've built up, each
// once for every stage (so a box at 75 is in it twice). Saves from before the
// stages had two (75, 100): STORAGE_V marks a save in stages, and storageFromOld
// moves an older one onto them.

import type { Drop } from "../types";

export const BOX_CAP = 50;
export const BOX_CAPS = [BOX_CAP, 60, 75, 85, 100];
export const STORAGE_V = 2;
// An older save's boxes: built once was 75 (stage 2), twice 100 (stage 4).
export function storageFromOld(big: readonly CappedBox[]): CappedBox[] {
  return CAPPED_BOXES.flatMap((b) => { const n = big.filter((x) => x === b).length; return Array<CappedBox>(n >= 2 ? 4 : n === 1 ? 2 : 0).fill(b); });
}
export const CAPPED_BOXES = ["weapon", "armor", "consumable"] as const;
export type CappedBox = (typeof CAPPED_BOXES)[number];
export const BOX_NAMES: Record<CappedBox, string> = { weapon: "weapons", armor: "armour", consumable: "consumables" };

// How many times a box has been built up, and how much it holds.
export const boxTier = (b: CappedBox, big: readonly CappedBox[] = []) => Math.min(BOX_CAPS.length - 1, big.filter((x) => x === b).length);
export const boxCap = (b: CappedBox, big: readonly CappedBox[] = []) => BOX_CAPS[boxTier(b, big)];
// Built up once more (by a storage schematic of this tier: a plan built twice changes nothing).
export const buildBox = (big: readonly CappedBox[], b: CappedBox, tier: number): CappedBox[] =>
  boxTier(b, big) >= tier ? [...big] : [...big.filter((x) => x !== b), ...Array<CappedBox>(tier).fill(b)];

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

// Which of these can come out of Klutz's crate into your Inventory, in order: each with space left in its
// box, and codexes while the bookcase has room (shelfFree, below 0 when it's overfull). The rest stay in
// the crate. Unlike a quest's reward, which always comes home (a box can go over), the crate needs the
// space, as going into the Labyrinth does (the user, 2026-11-17). full: the boxes that held something back;
// shelfFull: a codex was held back.
export function roomFor(inventory: Drop[], drops: Drop[], big: readonly CappedBox[] = [], shelfFree = Infinity): { fit: Drop[]; full: CappedBox[]; shelfFull: boolean } {
  const { fit, full } = fitInBoxes(inventory, drops, big);
  let shelf = Math.max(0, shelfFree), shelfFull = false;
  const out = fit.filter((d) => {
    if (!(d.dropType === "item" && d.codexMove)) return true;
    if (shelf > 0) { shelf--; return true; }
    shelfFull = true; return false;
  });
  return { fit: out, full, shelfFull };
}
