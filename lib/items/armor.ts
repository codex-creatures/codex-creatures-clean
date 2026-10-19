import type { Rarity } from "./budgets";

export type ArmorKey =
  | "frontiers_mail"
  | "arrowward_mantle"
  | "dragonscale_tunic"
  | "colossal_shellarmor"
  | "arcane_nullifier"
  | "polished_chainbolster"
  | "juggernaut_platemail";

export type ArmorStatBlock = {
  mDef: number;   // melee defence
  rDef: number;   // ranged defence
  magDef: number; // magic defence
  agility: number;
  hp: number;
};

export const ARMOR_STAT_KEYS: (keyof ArmorStatBlock)[] = ["mDef", "rDef", "magDef", "agility", "hp"];

export const ARMOR_KEYS: ArmorKey[] = [
  "frontiers_mail",
  "arrowward_mantle",
  "dragonscale_tunic",
  "colossal_shellarmor",
  "arcane_nullifier",
  "polished_chainbolster",
  "juggernaut_platemail",
];

export const ARMOR_META: Record<ArmorKey, { name: string; desc: string }> = {
  frontiers_mail: {
    name: "Frontier’s Mail",
    desc: "Balanced anti-melee armour. Solid MDef + HP with no extreme spikes.",
  },
  arrowward_mantle: {
    name: "Arrowward Mantle",
    desc: "Balanced anti-ranged armour. Strong RDef + HP for stopping projectiles.",
  },
  dragonscale_tunic: {
    name: "Dragonscale Tunic",
    desc: "Light armour with survivability. High agility + HP ceiling profile.",
  },
  colossal_shellarmor: {
    name: "Colossal Shellarmor",
    desc: "True frontliner plate. Massive MDef + HP, low agility.",
  },
  arcane_nullifier: {
    name: "Arcane Nullifier",
    desc: "True anti-magic tank. Massive Magic Def + HP, low agility.",
  },
  polished_chainbolster: {
    name: "Polished Chainbolster",
    desc: "All-rounder armour. Consistent against every style, never extreme.",
  },
  juggernaut_platemail: {
    name: "Juggernaut Platemail",
    desc: "Defence wall. High defence against every style with decent HP, low agility.",
  },
};

export const ARMOR_CEILINGS: Record<ArmorKey, Record<Rarity, ArmorStatBlock>> = {
  frontiers_mail: {
    common: { mDef: 70, rDef: 35, magDef: 35, agility: 35, hp: 60 },
    uncommon: { mDef: 90, rDef: 40, magDef: 40, agility: 40, hp: 80 },
    rare: { mDef: 110, rDef: 45, magDef: 45, agility: 45, hp: 100 },
    epic: { mDef: 130, rDef: 50, magDef: 50, agility: 50, hp: 120 },
    legendary: { mDef: 160, rDef: 60, magDef: 60, agility: 60, hp: 150 },
  },
  arrowward_mantle: {
    common: { mDef: 26, rDef: 70, magDef: 41, agility: 35, hp: 60 },
    uncommon: { mDef: 30, rDef: 90, magDef: 47, agility: 40, hp: 80 },
    rare: { mDef: 34, rDef: 110, magDef: 53, agility: 45, hp: 100 },
    epic: { mDef: 38, rDef: 130, magDef: 59, agility: 50, hp: 120 },
    legendary: { mDef: 45, rDef: 160, magDef: 70, agility: 60, hp: 150 },
  },
  dragonscale_tunic: {
    common: { mDef: 26, rDef: 35, magDef: 41, agility: 70, hp: 60 },
    uncommon: { mDef: 30, rDef: 40, magDef: 47, agility: 90, hp: 80 },
    rare: { mDef: 34, rDef: 45, magDef: 53, agility: 110, hp: 100 },
    epic: { mDef: 38, rDef: 50, magDef: 59, agility: 130, hp: 120 },
    legendary: { mDef: 45, rDef: 60, magDef: 70, agility: 160, hp: 150 },
  },
  colossal_shellarmor: {
    common: { mDef: 80, rDef: 35, magDef: 30, agility: 20, hp: 80 },
    uncommon: { mDef: 100, rDef: 40, magDef: 35, agility: 22, hp: 105 },
    rare: { mDef: 120, rDef: 45, magDef: 40, agility: 25, hp: 130 },
    epic: { mDef: 145, rDef: 50, magDef: 45, agility: 28, hp: 160 },
    legendary: { mDef: 180, rDef: 60, magDef: 55, agility: 32, hp: 200 },
  },
  arcane_nullifier: {
    common: { mDef: 35, rDef: 49, magDef: 80, agility: 20, hp: 80 },
    uncommon: { mDef: 40, rDef: 56, magDef: 100, agility: 22, hp: 105 },
    rare: { mDef: 45, rDef: 63, magDef: 120, agility: 25, hp: 130 },
    epic: { mDef: 50, rDef: 70, magDef: 145, agility: 28, hp: 160 },
    legendary: { mDef: 60, rDef: 84, magDef: 180, agility: 32, hp: 200 },
  },
  polished_chainbolster: {
    common: { mDef: 55, rDef: 55, magDef: 55, agility: 55, hp: 55 },
    uncommon: { mDef: 70, rDef: 70, magDef: 70, agility: 70, hp: 70 },
    rare: { mDef: 85, rDef: 85, magDef: 85, agility: 85, hp: 85 },
    epic: { mDef: 100, rDef: 100, magDef: 100, agility: 100, hp: 100 },
    legendary: { mDef: 120, rDef: 120, magDef: 120, agility: 120, hp: 120 },
  },
  juggernaut_platemail: {
    common: { mDef: 55, rDef: 55, magDef: 55, agility: 30, hp: 60 },
    uncommon: { mDef: 71, rDef: 71, magDef: 71, agility: 35, hp: 80 },
    rare: { mDef: 88, rDef: 88, magDef: 88, agility: 40, hp: 100 },
    epic: { mDef: 105, rDef: 105, magDef: 105, agility: 45, hp: 120 },
    legendary: { mDef: 130, rDef: 130, magDef: 130, agility: 55, hp: 150 },
  },
};

// Primaries pulled from your sheet
export const ARMOR_PRIMARY_STATS: Record<ArmorKey, readonly (keyof ArmorStatBlock)[]> = {
  frontiers_mail: ["mDef", "hp"],
  arrowward_mantle: ["rDef", "hp"],
  dragonscale_tunic: ["agility", "hp"],
  colossal_shellarmor: ["mDef", "hp"],
  arcane_nullifier: ["magDef", "hp"],
  polished_chainbolster: ["mDef", "rDef"],
  juggernaut_platemail: ["mDef", "rDef"],
};

// ── Armour pieces ─────────────────────────────────────────────────
// Armour comes in three pieces: helmet, chest and legs. Every piece rolls the
// whole budget (60–150, like a weapon) with its armour's ceilings, so the slot
// doesn't change what it can roll. Two things keep a full set about as strong
// as before, when a piece was a third of one roll:
// - defence counts at a third in the damage maths (ARMOR_DEFENCE_WEIGHT,
//   lib/combat/engine.ts), so 30 melee defence blocks what 10 used to;
// - a piece can roll only a share of its armour's HP ceiling
//   (PIECE_HP_SHARE). HP counts in full, so this decides how much bulk
//   armour adds (a full set: about twice the old HP at ⅓).
export const PIECE_HP_SHARE = 1 / 3;
export type ArmorSlot = "helmet" | "chest" | "legs";
export const ARMOR_SLOTS: ArmorSlot[] = ["helmet", "chest", "legs"];

export const ARMOR_SLOT_INFO: Record<ArmorSlot, { name: string; piece: string }> = {
  helmet: { name: "Helmet", piece: "Helm" },
  chest:  { name: "Chest",  piece: "Chestpiece" },
  legs:   { name: "Legs",   piece: "Greaves" },
};

// How much of a set's worth a piece is (for selling).
export const PIECE_VALUE: Record<ArmorSlot, number> = { helmet: 1 / 3, chest: 1 / 3, legs: 1 / 3 };

// What one piece can roll: its armour's ceilings, with a share of the HP.
export function pieceCeilings(key: ArmorKey, rarity: Rarity): ArmorStatBlock {
  const c = ARMOR_CEILINGS[key][rarity];
  return { ...c, hp: Math.max(1, Math.round(c.hp * PIECE_HP_SHARE)) };
}

// Pieces from before every piece rolled in full were a share of one roll
// (the old split, by slot). Their defence is multiplied up so it blocks what
// it did; their HP and agility count as they always did. ARMOR_V2 marks a
// piece (or an enemy's armour) that's already on the new scale.
export const ARMOR_V2 = 2;
export const OLD_DEFENCE_SCALE = 3;
export function upgradeOldArmorStats(stats: Record<string, number>): Record<string, number> {
  const out = { ...stats };
  for (const k of ["mDef", "rDef", "magDef"]) if (typeof out[k] === "number") out[k] = out[k] * OLD_DEFENCE_SCALE;
  return out;
}

export const pieceName = (key: ArmorKey, slot: ArmorSlot) => `${ARMOR_META[key].name} ${ARMOR_SLOT_INFO[slot].piece}`;

// ── Set bonuses ───────────────────────────────────────────────────
// Wear all three pieces of one armour (any rarities) and you get its set
// mechanic. (Applied in lib/combat/battle.ts; Second Wind in the dungeon.)
export const SET_BONUS: Record<ArmorKey, { name: string; text: string }> = {
  colossal_shellarmor:   { name: "Hard Shell",  text: "The first hit it takes each fight does half damage." },
  dragonscale_tunic:     { name: "Quickscale",  text: "Its first attack each fight goes before everyone else's." },
  arcane_nullifier:      { name: "Nullify",     text: "Reflects 25% of magic damage it takes back at the attacker." },
  arrowward_mantle:      { name: "Deflect",     text: "25% of ranged attacks against it miss." },
  polished_chainbolster: { name: "Steadfast",   text: "It can't be crippled." },
  juggernaut_platemail:  { name: "Unstoppable", text: "Once per fight, a blow that would knock it out leaves it on 1 HP." },
  frontiers_mail:        { name: "Second Wind", text: "Heals 15% of its max HP after every fight it wins in the labyrinth." },
};
export const NULLIFY_REFLECT = 0.25;
export const DEFLECT_CHANCE = 0.25;
export const SECOND_WIND_HEAL = 0.15;

type Piece = { armorKey?: ArmorKey; armorSlot?: ArmorSlot; stats?: Record<string, number> } | undefined;

// What a creature's armour adds up to: the pieces' stats summed, and the set
// whose mechanic it gets (only with all three pieces of the same armour).
export function wornArmor(pieces: Piece[]): { stats: Record<string, number>; set?: ArmorKey } {
  const stats: Record<string, number> = {};
  for (const p of pieces) for (const [k, v] of Object.entries(p?.stats ?? {})) stats[k] = (stats[k] ?? 0) + v;
  const keys = pieces.map((p) => p?.armorKey);
  const slots = new Set(pieces.map((p) => p?.armorSlot));
  const full = pieces.length === 3 && keys[0] && keys.every((k) => k === keys[0]) && ARMOR_SLOTS.every((s) => slots.has(s));
  return { stats, set: full ? keys[0] : undefined };
}
