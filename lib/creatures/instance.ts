// lib/creatures/instance.ts
// Turning a creature from your inventory into what it fights as: its species
// template plus its own rolled %s, its moves and its equipped gear.

import type { CreatureOrItemDrop } from "../types";
import { buildFighter } from "../combat/loadout";
import { resolveMoves, type CreatureProficiency, type CreatureTemplate, type Skill } from "./creatureData";

type Stats = Record<string, number> | undefined;

export function proficiencyOf(drop: CreatureOrItemDrop, t: CreatureTemplate): CreatureProficiency {
  return drop.proficiency ?? t.proficiency;
}

// Moves chosen in the move slots win; otherwise the creature's starting moves.
export function movesOf(drop: CreatureOrItemDrop, t: CreatureTemplate, chosen?: string[]): Skill[] {
  return resolveMoves(t, chosen ?? drop.moves);
}

export function fighterFor(drop: CreatureOrItemDrop, t: CreatureTemplate, weapon?: Stats, armor?: Stats, chosenMoves?: string[]) {
  return buildFighter(t, weapon, armor, chosenMoves ?? drop.moves, drop.proficiency);
}
