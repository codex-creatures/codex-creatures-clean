// lib/creatures/creatureType.ts
// A creature's type label comes from its proficiency multipliers (%), not
// from whatever gear it has equipped.
//
// - The highest multiplier sets the main role.
// - Any other multiplier within SECONDARY_SHARE of the highest is added as a
//   secondary role.
// - Two strong attacks together read as "Hybrid"; two strong defences
//   together read as "Tank".
// - If every multiplier is within BALANCED_SHARE of the highest, the creature
//   is "Balanced".

import type { CreatureProficiency } from "./creatureData";

export const SECONDARY_SHARE = 0.65;
export const BALANCED_SHARE = 0.6;

type ProfKey = keyof CreatureProficiency;

export const ROLE_BY_STAT: Record<ProfKey, string> = {
  atk:    "Bruiser",
  rng:    "Marksman",
  mag:    "Spellcaster",
  agil:   "Skirmisher",
  mdef:   "Melee Tank",
  rdef:   "Ranged Tank",
  magdef: "Magic Tank",
};
const ATTACKS: ProfKey[] = ["atk", "rng", "mag"];
const DEFENCES: ProfKey[] = ["mdef", "rdef", "magdef"];

export const ROLE_HINT: Record<string, string> = {
  Bruiser:       "best melee multiplier",
  Marksman:      "best ranged multiplier",
  Spellcaster:   "best magic multiplier",
  Skirmisher:    "best agility multiplier",
  "Melee Tank":  "best melee defence multiplier",
  "Ranged Tank": "best ranged defence multiplier",
  "Magic Tank":  "best magic defence multiplier",
  Hybrid:        "strong in two kinds of attack",
  Tank:          "strong in two kinds of defence",
  Balanced:      "no standout multiplier",
};

export function creatureRoles(p: CreatureProficiency): string[] {
  const entries = (Object.entries(p) as [ProfKey, number][]).sort((a, b) => b[1] - a[1]);
  const top = entries[0][1];
  if (top <= 0) return ["Balanced"];
  const used = entries.filter(([, v]) => v > 0);
  if (used[used.length - 1][1] >= top * BALANCED_SHARE) return ["Balanced"];

  const strong = entries.filter(([, v]) => v >= top * SECONDARY_SHARE).map(([k]) => k);
  const roles: string[] = [];
  const strongAttacks = strong.filter((k) => ATTACKS.includes(k)).length;
  const strongDefences = strong.filter((k) => DEFENCES.includes(k)).length;
  for (const k of strong) {
    if (ATTACKS.includes(k) && strongAttacks >= 2) {
      if (!roles.includes("Hybrid")) roles.push("Hybrid");
    } else if (DEFENCES.includes(k) && strongDefences >= 2) {
      if (!roles.includes("Tank")) roles.push("Tank");
    } else {
      roles.push(ROLE_BY_STAT[k]);
    }
  }
  return roles.slice(0, 2);
}

export function creatureTypeLabel(p: CreatureProficiency): string {
  return creatureRoles(p).join(" · ");
}
