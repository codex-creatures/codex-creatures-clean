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
// Armour is on the full-set scale (defence counts at a third: ARMOR_DEFENCE_WEIGHT).
export const CYCLOPS_PARTS: Part[] = [
  { id: "cyclops", name: "Cyclops", label: "Boss · Melee Tank", weaponName: "Tree-trunk club", armorName: "Stone-hard hide",
    weapon: { melee: 28, magic: 22 }, armor: { mDef: 114, rDef: 54, magDef: 54, agility: 78 } },
  { id: "cyclops_hand", name: "Left Hand", label: "Boss · Skirmisher", weaponName: "Hooked nails", armorName: "Calloused skin",
    weapon: { melee: 22 }, armor: { mDef: 60, rDef: 42, magDef: 42, agility: 180 } },
  { id: "cyclops_hand", name: "Right Hand", label: "Boss · Skirmisher", weaponName: "Hooked nails", armorName: "Calloused skin",
    weapon: { melee: 22 }, armor: { mDef: 60, rDef: 42, magDef: 42, agility: 180 } },
  { id: "cyclops_eye", name: "Eye", label: "Boss · Floating Caster", weaponName: "Its own glare", armorName: "Glassy lens",
    weapon: { magic: 26 }, armor: { mDef: 108, rDef: 54, magDef: 72, agility: 132 }, stance: "float" },
];

// level: how strong it is (the Labyrinth's CYCLOPS_LEVEL; missing = REF_LEVEL).
export function cyclopsTeam(level?: number): Fighter[] {
  return CYCLOPS_PARTS.map((p) => {
    const f = buildFighter(CREATURE_BY_ID[p.id], p.weapon, p.armor, undefined, undefined, undefined, undefined, level);
    return { ...f, name: p.name, stance: p.stance ?? "neutral" };
  });
}
