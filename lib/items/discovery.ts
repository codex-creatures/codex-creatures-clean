// lib/items/discovery.ts
// "Items discovered" at the altar: every kind of item you can find, not just
// weapons and armour. Each kind has a key: a weapon or armour type (any
// piece of it), a material, a potion, or a codex of a move. Once you've had
// one it stays discovered (the save remembers the keys), even after you've
// used, spent or sold it.

import type { Drop } from "../types";
import { ITEM_KEYS } from "./ceilings";
import { ARMOR_KEYS } from "./armor";
import { MATERIAL_KEYS, type Materials } from "./materials";
import { BASIC_MOVES, STRONG_MOVES, LEARNABLE_MOVES, RACE_MOVES } from "../creatures/creatureData";
import { KIT_RACE_MOVES } from "../creatures/raceKitsV2";

const POTION_KINDS = ["lesser", "potion"] as const;

// Every key there is to discover.
export const DISCOVERABLE_ITEMS: ReadonlySet<string> = new Set([
  ...ITEM_KEYS.map((k) => `w:${k}`),
  ...ARMOR_KEYS.map((k) => `a:${k}`),
  ...MATERIAL_KEYS.map((k) => `m:${k}`),
  ...POTION_KINDS.map((k) => `p:${k}`),
  ...[...BASIC_MOVES, ...STRONG_MOVES, ...LEARNABLE_MOVES, ...RACE_MOVES, ...KIT_RACE_MOVES].map((m) => `c:${m.name}`),
]);
export const TOTAL_DISCOVERABLE_ITEMS = DISCOVERABLE_ITEMS.size;

// The kind of item a drop is (undefined for creatures, cards, gold, tools…).
export function itemDiscoveryKey(d: Drop): string | undefined {
  if (d.dropType !== "item") return undefined;
  const key = d.itemKey ? `w:${d.itemKey}` : d.armorKey ? `a:${d.armorKey}` : d.material ? `m:${d.material}`
    : d.potion ? `p:${d.potion}` : d.codexMove ? `c:${d.codexMove}` : undefined;
  return key && DISCOVERABLE_ITEMS.has(key) ? key : undefined;
}

// Everything discovered: what the save remembers, plus whatever you have now
// (so older saves count what's already in them).
export function discoveredItemKeys(found: string[], inventory: Drop[], materials: Materials): Set<string> {
  const out = new Set(found.filter((k) => DISCOVERABLE_ITEMS.has(k)));
  for (const d of inventory) { const k = itemDiscoveryKey(d); if (k) out.add(k); }
  for (const k of MATERIAL_KEYS) if ((materials[k] ?? 0) > 0) out.add(`m:${k}`);
  return out;
}
