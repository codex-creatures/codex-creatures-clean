// lib/creatures/creatureType.ts
// A creature's type label comes from its proficiency multipliers (%), not
// from whatever gear it has equipped.
//
// - The highest multiplier sets the main role.
// - Any other multiplier within SECONDARY_SHARE of the highest is added as a
//   secondary role.
// - Melee + Ranged together read as "Hybrid"; Melee Def + Ranged Def together
//   read as "Tank".
// - If every multiplier is within BALANCED_SHARE of the highest, the creature
//   is "Balanced".

import type { CreatureProficiency } from "./creatureData";

export const SECONDARY_SHARE = 0.65;
export const BALANCED_SHARE = 0.6;

type ProfKey = keyof CreatureProficiency;

export const ROLE_BY_STAT: Record<ProfKey, string> = {
  atk:  "Bruiser",
  rng:  "Marksman",
  agil: "Skirmisher",
  mdef: "Melee Tank",
  rdef: "Ranged Tank",
};

export const ROLE_HINT: Record<string, string> = {
  Bruiser:       "best melee multiplier",
  Marksman:      "best ranged multiplier",
  Skirmisher:    "best agility multiplier",
  "Melee Tank":  "best melee defence multiplier",
  "Ranged Tank": "best ranged defence multiplier",
  Hybrid:        "strong in both melee and ranged",
  Tank:          "strong in both defences",
  Balanced:      "no standout multiplier",
};

export function creatureRoles(p: CreatureProficiency): string[] {
  const entries = (Object.entries(p) as [ProfKey, number][]).sort((a, b) => b[1] - a[1]);
  const top = entries[0][1];
  if (top <= 0) return ["Balanced"];
  if (entries[entries.length - 1][1] >= top * BALANCED_SHARE) return ["Balanced"];

  const strong = entries.filter(([, v]) => v >= top * SECONDARY_SHARE).map(([k]) => k);
  const roles: string[] = [];
  for (const k of strong) {
    if ((k === "atk" || k === "rng") && strong.includes("atk") && strong.includes("rng")) {
      if (!roles.includes("Hybrid")) roles.push("Hybrid");
    } else if ((k === "mdef" || k === "rdef") && strong.includes("mdef") && strong.includes("rdef")) {
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
