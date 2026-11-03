// lib/collector.ts
// The creature collector (the user, 2026-11-03): a third visitor at the
// repaired tavern (lib/tavern.ts VISITOR_ODDS), alongside the merchant and
// the librarian. He deals only in creatures, never cards:
// - he buys a creature for COLLECTOR_PRICES of its rarity;
// - he trades TRADE_UP_COUNT creatures of one rarity (any species) for a
//   card of a random species one rarity up. Legendaries can't be traded up.
// Not for sale or trade: a creature in a team, training in the pit or out on
// a run (the game state works those out: hooks/useGameState.ts).

import type { Rarity } from "./items/budgets";
import { isCreatureDrop, type CreatureOrItemDrop, type Drop } from "./types";
import { CREATURES_BY_RARITY } from "./creatures/creatureData";
import { rollCreature } from "./creatures/creatureRoll";
import { makeCreatureDrop } from "./creatures/summon";

type Rng = () => number;

export const COLLECTOR_PRICES: Record<Rarity, number> = { common: 50, uncommon: 100, rare: 250, epic: 600, legendary: 1500 };
export const TRADE_UP_COUNT = 3;

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
// The rarity a trade-up gives (none above Legendary).
export const rarityAbove = (r: Rarity): Rarity | undefined => ORDER[ORDER.indexOf(r) + 1];

const rarityOf = (d: CreatureOrItemDrop): Rarity => (ORDER.includes(d.rarity as Rarity) ? (d.rarity as Rarity) : "common");
export const creaturePrice = (d: CreatureOrItemDrop): number => COLLECTOR_PRICES[rarityOf(d)];

// The creatures he'll deal in: yours, less the ones that are busy.
export function collectorCreatures(inventory: Drop[], busy: Set<string>): CreatureOrItemDrop[] {
  return inventory.filter((d): d is CreatureOrItemDrop => isCreatureDrop(d) && !busy.has(d.id));
}

// Can these be traded up? Exactly TRADE_UP_COUNT creatures, all one rarity, below Legendary.
export function canTradeUp(creatures: CreatureOrItemDrop[]): boolean {
  if (creatures.length !== TRADE_UP_COUNT || creatures.some((c) => !isCreatureDrop(c))) return false;
  if (new Set(creatures.map((c) => c.id)).size !== TRADE_UP_COUNT) return false;
  const r = rarityOf(creatures[0]);
  return creatures.every((c) => rarityOf(c) === r) && !!rarityAbove(r);
}

// The card he gives for them (a random species of the rarity above, freshly
// rolled), or null if they can't be traded up.
export function tradeUpCard(creatures: CreatureOrItemDrop[], rng: Rng = Math.random): CreatureOrItemDrop | null {
  if (!canTradeUp(creatures)) return null;
  const pool = CREATURES_BY_RARITY[rarityAbove(rarityOf(creatures[0]))!];
  if (!pool?.length) return null;
  const t = pool[Math.floor(rng() * pool.length)];
  return makeCreatureDrop(t, "card", "", rollCreature(t, rng));
}
