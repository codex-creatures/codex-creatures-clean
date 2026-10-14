// lib/combat/loadout.ts
// Turns a creature + its equipped items into a combat Fighter.
// Shared by the main game (creature screen) and the simulator, so what the
// player sees is exactly what battles use.

import { resolveMoves, type CreatureProficiency, type CreatureTemplate } from "../creatures/creatureData";
import { effectiveStats, type CombatItem, type Fighter } from "./engine";
import type { ArmorKey } from "../items/armor";

const EMPTY: CombatItem = { atk: 0, rng: 0, agil: 0, mdef: 0, rdef: 0, hp: 0 };

// Item stat names → combat stat names. Missing stats count as 0, so an empty
// slot (no item) is simply all zeros.
export function itemToCombatStats(stats?: Record<string, number>): CombatItem {
  if (!stats) return EMPTY;
  return {
    atk:  stats.melee   ?? 0,
    rng:  stats.ranged  ?? 0,
    agil: stats.agility ?? 0,
    mdef: stats.mDef    ?? 0,
    rdef: stats.rDef    ?? 0,
    hp:   stats.hp      ?? 0,
  };
}

export function buildFighter(
  creature: CreatureTemplate,
  weaponStats?: Record<string, number>,
  armorStats?: Record<string, number>,
  moveNames?: string[], // the creature's 4 move slots (defaults if omitted)
  proficiency?: CreatureProficiency, // this individual's rolled %s (species values if omitted)
  armorSet?: ArmorKey,               // a full armour set (its mechanic applies)
): Fighter {
  const weapon = itemToCombatStats(weaponStats);
  const armor  = itemToCombatStats(armorStats);
  const totalHp = creature.baseHp + weapon.hp + armor.hp;
  return {
    name: creature.name,
    hp: totalHp,
    maxHp: totalHp,
    energy: 100,
    proficiency: proficiency ?? creature.proficiency,
    skills: resolveMoves(creature, moveNames),
    weapon,
    armor,
    stance: "neutral",
    elemental: null,
    ...(armorSet ? { armorSet } : {}),
  };
}

// Final combat numbers after creature proficiency % is applied.
export function combatSummary(f: Fighter) {
  const s = effectiveStats(f);
  return { hp: f.maxHp, ...s };
}
