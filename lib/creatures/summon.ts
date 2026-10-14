// lib/creatures/summon.ts
// Creature cards and summoning.
//
// When a barcode gives a creature, you usually get a CARD of it (its rolled
// %s and moves shown on the card); REAL_CREATURE_CHANCE of the time you get
// the creature itself. Three cards of the same creature can be summoned:
// - "choose": pick one of the three; the creature has exactly that card's
//   %s, moves and ability (no new roll);
// - "random": a brand-new roll, for when you like none of them.
// The three cards are used up either way.

import type { CreatureOrItemDrop } from "../types";
import { findCreatureTemplate, type CreatureTemplate } from "./creatureData";
import { rollCreature, type CreatureRoll } from "./creatureRoll";

export const REAL_CREATURE_CHANCE = 0.1;
export const CARDS_TO_SUMMON = 3;

type Rng = () => number;

// A creature or card drop for a species, with its own roll.
export function makeCreatureDrop(
  t: CreatureTemplate, kind: "creature" | "card", barcode: string, roll: CreatureRoll = rollCreature(t),
): CreatureOrItemDrop {
  return {
    id: crypto.randomUUID(),
    barcode,
    dropType: kind,
    creatureId: t.id,
    rarity: t.rarity,
    roll: 0,
    name: t.name,
    desc: t.flavour,
    proficiency: roll.proficiency,
    moves: roll.moves,
    ...(roll.ability ? { ability: roll.ability } : {}),
    createdAt: new Date().toISOString(),
  };
}

// The creature a barcode's creature outcome gives this player.
export function creatureOrCard(t: CreatureTemplate, barcode: string, rng: Rng = Math.random): CreatureOrItemDrop {
  return makeCreatureDrop(t, rng() < REAL_CREATURE_CHANCE ? "creature" : "card", barcode, rollCreature(t, rng));
}

// Returns the summoned creature, or throws if the cards can't be summoned.
// keepId = the card to become the creature ("choose"); null = "random".
export function summonFromCards(cards: CreatureOrItemDrop[], keepId: string | null, rng: Rng = Math.random): CreatureOrItemDrop {
  if (cards.length !== CARDS_TO_SUMMON) throw new Error(`Summoning needs ${CARDS_TO_SUMMON} cards`);
  if (cards.some((c) => c.dropType !== "card")) throw new Error("Only cards can be summoned");
  if (new Set(cards.map((c) => c.creatureId)).size !== 1) throw new Error("All three cards must be the same creature");
  const t = findCreatureTemplate(cards[0].creatureId, cards[0].name);
  if (!t) throw new Error("Unknown creature");

  if (keepId === null) return makeCreatureDrop(t, "creature", cards[0].barcode, rollCreature(t, rng));
  const keep = cards.find((c) => c.id === keepId);
  if (!keep) throw new Error("The chosen card isn't one of the three");
  return makeCreatureDrop(t, "creature", keep.barcode, {
    proficiency: keep.proficiency ?? t.proficiency,
    moves: keep.moves ?? t.skills.map((s) => s.name),
    ability: keep.ability,
  });
}
