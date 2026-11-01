// lib/scanReveal.ts
// The unveiling when a Code Cache opens at the altar (components/ScanReveal.tsx):
// the cache shakes, cracks open in a flash of its find's rarity, and the find
// pops out with its buttons. Rarer finds shake a beat longer and open bigger.

import type { Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { lootEntry, merchantOffer } from "./dungeon/run";

// How long the cache shakes before it cracks, by what's inside (ms).
export const SHAKE_MS: Record<Rarity, number> = { common: 600, uncommon: 650, rare: 850, epic: 1050, legendary: 1300 };
export const GOLD_SHAKE_MS = 500;

// How big the crack is: a puff of light; light rays (rare); rays, falling gold
// and a jolt (epic and legendary).
export type RevealTier = "puff" | "rays" | "shower";
export function revealTier(rarity: Rarity | undefined): RevealTier {
  return rarity === "epic" || rarity === "legendary" ? "shower" : rarity === "rare" ? "rays" : "puff";
}

// What a find sells for at the altar: the merchant's price (lib/dungeon/run.ts
// merchantOffer): gear for what the Inventory pays (gearValue), potions,
// codexes, scrolls and tools for half what they cost. Materials go straight
// to your tally, so they aren't sold here; nor is what he won't buy.
export function findPrice(d: Drop, gearValue: (d: Drop) => number): number {
  if (d.dropType !== "item" || d.material) return 0;
  return merchantOffer(lootEntry(d.id), d, gearValue);
}

// What you can do with it: a creature or creature card let go, gold just
// taken, anything with a price sold. Anything else is kept.
export type RevealChoice = "sell" | "release" | "keep" | "gold";
export function revealChoice(d: Drop, price: number): RevealChoice {
  if (d.dropType === "reward") return "gold";
  if (d.dropType === "creature" || d.dropType === "card") return "release";
  return price > 0 ? "sell" : "keep";
}

export function shakeMs(d: Drop): number {
  return d.dropType === "reward" ? GOLD_SHAKE_MS : SHAKE_MS[d.rarity] ?? SHAKE_MS.common;
}
