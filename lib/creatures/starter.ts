// lib/creatures/starter.ts
// A new player's first creature: a random Rare, waiting in the cage. It
// starts at STARTER_LEVEL, so it can actually win the first fights, and it
// always knows a quick attack (its race kit's, or its class's haste move), so
// early on it can finish off a hurt creature before it hits back. It always
// has a soul stone too, one from its species' pool (the user, 2026-10-25).

import type { Drop } from "../types";
import { CREATURES_BY_RARITY, MOVE_BY_NAME, MOVE_SLOTS, type CombatClass, type CreatureTemplate } from "./creatureData";
import { makeCreatureDrop } from "./summon";
import { stonesFor } from "./soulStones";

export const STARTER_LEVEL = 3;
export const QUICK_ATTACK: Record<CombatClass, string> = { melee: "Dash Lash", ranged: "Quick Bolt", magic: "Quickcast" };

// Its moves with a quick attack in: kept if it rolled one, otherwise it takes
// the place of its last species move (a rare rolled move stays).
export function withQuickAttack(t: CreatureTemplate, moves: string[]): string[] {
  if (moves.some((n) => ["dash", "quick"].includes(MOVE_BY_NAME[n]?.effect?.kind ?? ""))) return moves;
  const quick = QUICK_ATTACK[t.cls];
  if (moves.length < MOVE_SLOTS) return [...moves, quick];
  const own = t.skills.map((s) => s.name);
  const i = moves.map((n) => own.includes(n)).lastIndexOf(true);
  return moves.map((n, j) => (j === (i < 0 ? moves.length - 1 : i) ? quick : n));
}

export function starterCreature(): Drop {
  const pool = CREATURES_BY_RARITY.rare;
  const t = pool[Math.floor(Math.random() * pool.length)];
  const d = makeCreatureDrop(t, "creature", "");
  const stones = stonesFor(t.id);
  const soulStone = d.soulStone ?? (stones.length ? stones[Math.floor(Math.random() * stones.length)] : null);
  return { ...d, moves: withQuickAttack(t, d.moves ?? []), level: STARTER_LEVEL, xp: 0, soulStone };
}
