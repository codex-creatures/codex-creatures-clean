// lib/creatures/instance.ts
// Turning a creature from your inventory into what it fights as: its species
// template plus its own rolled %s, its moves and its equipped gear.

import type { CreatureOrItemDrop } from "../types";
import { buildFighter } from "../combat/loadout";
import { wornArmor } from "../items/armor";
import type { ItemKey } from "../items/ceilings";
import { defaultMoveNames, resolveMoves, startingMoveCount, STARTING_MOVES, type CreatureProficiency, type CreatureTemplate, type Skill } from "./creatureData";

type Stats = Record<string, number> | undefined;

export function proficiencyOf(drop: CreatureOrItemDrop, t: CreatureTemplate): CreatureProficiency {
  return drop.proficiency ?? t.proficiency;
}

// Combat V2's creatures start with 3 moves, and the rest of their kits need
// codexes (the user, 2026-10-26). One from before that (no moveSet) goes back
// to its starting 3 when the save loads; what it learned from codexes stays.
// Returns whether it changed (then its chosen move slots are cleared too).
export const MOVE_SET = 2;
export function upgradeMoveSet(c: CreatureOrItemDrop, t?: CreatureTemplate): boolean {
  if (c.moveSet === MOVE_SET || !t || startingMoveCount(t) !== STARTING_MOVES) return false;
  c.moves = defaultMoveNames(t);
  c.moveSet = MOVE_SET;
  return true;
}

// Moves chosen in the move slots win; otherwise the creature's starting moves.
export function movesOf(drop: CreatureOrItemDrop, t: CreatureTemplate, chosen?: string[]): Skill[] {
  return resolveMoves(t, chosen ?? drop.moves);
}

// armor: the creature's armour pieces (helmet, chest, legs; missing = empty).
// weaponKey: the weapon's type, for its damage-type affinity.
export function fighterFor(drop: CreatureOrItemDrop, t: CreatureTemplate, weapon?: Stats, armor: (CreatureOrItemDrop | undefined)[] = [], chosenMoves?: string[], weaponKey?: ItemKey) {
  const worn = wornArmor(armor);
  const f = buildFighter(t, weapon, worn.stats, chosenMoves ?? drop.moves, drop.proficiency, worn.set, weaponKey, drop.level ?? 1);
  return drop.soulStone ? { ...f, soulStone: drop.soulStone } : f;
}
