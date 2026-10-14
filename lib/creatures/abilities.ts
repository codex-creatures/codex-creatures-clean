// lib/creatures/abilities.ts
// Abilities: a rare, passive extra that some Epic and Legendary creatures
// are born with (rolled with the creature, so it shows on its cards too).
//
// Each ability has a pool: the creatures that can ever get it. A creature
// outside every pool never gets one, so finding one with an ability is part
// of collecting. Edit the pools freely; the chance is per rarity.

import type { Rarity } from "../types";
import type { CreatureTemplate } from "./creatureData";

export type AbilityKey = "keen_eye" | "divine_healing";

export const ABILITIES: Record<AbilityKey, { name: string; text: string; pool: string[] }> = {
  keen_eye: {
    name: "Keen Eye",
    text: "Precise hits deal 10% more damage.",
    pool: ["swamp_witch", "sylvaran"], // Elvish
  },
  divine_healing: {
    name: "Divine Healing",
    text: "Restores 15% of its max HP whenever it swaps out of battle.",
    pool: [], // Celestial creatures, once that race exists
  },
};

export const KEEN_EYE_BONUS = 0.1;
export const DIVINE_HEALING = 0.15;

// Chance a creature that's in a pool is born with an ability.
export const ABILITY_CHANCE: Partial<Record<Rarity, number>> = { epic: 0.25, legendary: 0.5 };

export const abilitiesFor = (creatureId: string): AbilityKey[] =>
  (Object.keys(ABILITIES) as AbilityKey[]).filter((k) => ABILITIES[k].pool.includes(creatureId));

export function rollAbility(t: CreatureTemplate, rng: () => number = Math.random): AbilityKey | undefined {
  const options = abilitiesFor(t.id);
  const chance = ABILITY_CHANCE[t.rarity] ?? 0;
  if (options.length === 0 || rng() >= chance) return undefined;
  return options[Math.floor(rng() * options.length)];
}
