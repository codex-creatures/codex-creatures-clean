// lib/creatures/bosses.ts
// Dungeon bosses as teams of fighters. Their numbers live here as the
// boss's natural "gear" (their proficiencies are 0, so these are exact).
// How they behave and change phase: lib/combat/bossAi.ts.

import { CREATURE_BY_ID } from "./creatureData";
import { buildFighter } from "../combat/loadout";
import type { Fighter } from "../combat/engine";
import type { BossKind } from "../combat/bossAi";

type Stats = Record<string, number>;
type Part = {
  id: string; name: string; label: string; weapon: Stats; armor: Stats; stance?: Fighter["stance"];
  weaponName: string; armorName: string; // shown where your creatures show their gear
  weakTo?: Fighter["cls"]; // its weak spot (Fighter.weakTo)
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

// The Hydra (the Deep Labyrinth's boss; see HYDRA in bossAi.ts): its three
// heads, left to right. Every head has the same defences, and each takes
// WEAK_SPOT damage from the style that beat its own in the old triangle
// (magic beats melee, melee beats ranged, ranged beats magic); nothing is
// resisted (the user, 2026-10-30). 🧪 Claude's numbers, set against the
// Warden's pack they replaced (scripts/sim-hydra.ts).
export const HYDRA_PARTS: Part[] = [
  { id: "hydra_fang", name: "Fang Head", label: "Boss · Melee", weaponName: "Hooked fangs", armorName: "Scaled neck",
    weapon: { melee: 40 }, armor: { mDef: 70, rDef: 70, magDef: 70, agility: 85 }, weakTo: "magic" },
  { id: "hydra_spitter", name: "Spitter Head", label: "Boss · Ranged", weaponName: "Acid glands", armorName: "Scaled neck",
    weapon: { ranged: 38 }, armor: { mDef: 70, rDef: 70, magDef: 70, agility: 95 }, weakTo: "melee" },
  { id: "hydra_hex", name: "Hex Head", label: "Boss · Magic", weaponName: "Glowing eyes", armorName: "Scaled neck",
    weapon: { magic: 38 }, armor: { mDef: 70, rDef: 70, magDef: 70, agility: 80 }, weakTo: "ranged" },
];

// The parts of each boss, in team order.
export const BOSS_PARTS_OF: Record<BossKind, Part[]> = { cyclops: CYCLOPS_PARTS, hydra: HYDRA_PARTS };

// level: how strong it is (the Labyrinth's CYCLOPS_LEVEL; missing = REF_LEVEL).
export function cyclopsTeam(level?: number): Fighter[] {
  return bossTeam("cyclops", level);
}

export function bossTeam(kind: BossKind, level?: number): Fighter[] {
  return BOSS_PARTS_OF[kind].map((p) => {
    const f = buildFighter(CREATURE_BY_ID[p.id], p.weapon, p.armor, undefined, undefined, undefined, undefined, level);
    return { ...f, name: p.name, stance: p.stance ?? "neutral", ...(p.weakTo ? { weakTo: p.weakTo } : {}) };
  });
}
