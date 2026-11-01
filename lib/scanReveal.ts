// lib/scanReveal.ts
// The unveiling when a Code Cache opens at the altar (components/ScanReveal.tsx):
// the cache shakes, cracks open in a flash of its find's rarity, and the find
// pops out with its buttons. Rarer finds shake a beat longer and open bigger.

import type { Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { lootEntry, merchantOffer } from "./dungeon/run";

// How long the cache shakes before it cracks, by what's inside (ms).
export const SHAKE_MS: Record<Rarity, number> = { common: 900, uncommon: 1000, rare: 1300, epic: 1600, legendary: 2000 };
export const GOLD_SHAKE_MS = 750;

// 1st, 2nd, 3rd, 4th… 11th, 12th, 13th… 21st.
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

// The line under the find saying who got here first: the first ever to scan
// the barcode, how many players found it before you (online), or a rescan.
export function findLine(found: "first" | "looted" | undefined, place?: number): string | null {
  if (found === "first" || place === 1) return "✨ First to find this Code Cache!";
  if (found === "looted") return "You've already looted this Code Cache";
  return place ? `You're the ${ordinal(place)} to find this Code Cache` : null;
}

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
