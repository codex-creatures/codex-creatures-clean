// lib/creatures/bosses.ts
// Dungeon bosses as teams of fighters. Their numbers live here as the
// boss's natural "gear" (their proficiencies are 0, so these are exact).
// How they behave and change phase: lib/combat/bossAi.ts.

import { CREATURE_BY_ID } from "./creatureData";
import { buildFighter } from "../combat/loadout";
import type { Fighter } from "../combat/engine";

type Stats = Record<string, number>;
type Part = {
  id: string; name: string; label: string; weapon: Stats; armor: Stats; stance?: Fighter["stance"];
  weaponName: string; armorName: string; // shown where your creatures show their gear
};

// Team order matters (see CYCLOPS in bossAi.ts): body, hand, hand, eye.
export const CYCLOPS_PARTS: Part[] = [
  { id: "cyclops", name: "Cyclops", label: "Boss · Melee Tank", weaponName: "Tree-trunk club", armorName: "Stone-hard hide",
    weapon: { melee: 28, magic: 22 }, armor: { mDef: 38, rDef: 18, magDef: 18, agility: 26 } },
  { id: "cyclops_hand", name: "Left Hand", label: "Boss · Skirmisher", weaponName: "Hooked nails", armorName: "Calloused skin",
    weapon: { melee: 22 }, armor: { mDef: 20, rDef: 14, magDef: 14, agility: 60 } },
  { id: "cyclops_hand", name: "Right Hand", label: "Boss · Skirmisher", weaponName: "Hooked nails", armorName: "Calloused skin",
    weapon: { melee: 22 }, armor: { mDef: 20, rDef: 14, magDef: 14, agility: 60 } },
  { id: "cyclops_eye", name: "Eye", label: "Boss · Floating Caster", weaponName: "Its own glare", armorName: "Glassy lens",
    weapon: { magic: 26 }, armor: { mDef: 36, rDef: 18, magDef: 24, agility: 44 }, stance: "float" },
];

export function cyclopsTeam(): Fighter[] {
  return CYCLOPS_PARTS.map((p) => {
    const f = buildFighter(CREATURE_BY_ID[p.id], p.weapon, p.armor);
    return { ...f, name: p.name, stance: p.stance ?? "neutral" };
  });
}
