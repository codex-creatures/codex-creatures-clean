// lib/creatures/starter.ts
// A new player's first creature: a random Rare, waiting in the cage. It
// starts at STARTER_LEVEL, so it can actually win the first fights.

import type { Drop } from "../types";
import { CREATURES_BY_RARITY } from "./creatureData";
import { makeCreatureDrop } from "./summon";

export const STARTER_LEVEL = 3;
export function starterCreature(): Drop {
  const pool = CREATURES_BY_RARITY.rare;
  const t = pool[Math.floor(Math.random() * pool.length)];
  return { ...makeCreatureDrop(t, "creature", ""), level: STARTER_LEVEL, xp: 0 };
}
