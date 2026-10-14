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
  mDef: number;
  rDef: number;
  agility: number;
  hp: number;
};

export const ARMOR_STAT_KEYS: (keyof ArmorStatBlock)[] = ["mDef", "rDef", "agility", "hp"];

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
    desc: "True anti-ranged tank. Massive RDef + HP, low agility.",
  },
  polished_chainbolster: {
    name: "Polished Chainbolster",
    desc: "All-rounder armour. Consistent, never extreme.",
  },
  juggernaut_platemail: {
    name: "Juggernaut Platemail",
    desc: "Hybrid defence wall. High MDef + RDef with decent HP, low agility.",
  },
};

export const ARMOR_CEILINGS: Record<ArmorKey, Record<Rarity, ArmorStatBlock>> = {
  frontiers_mail: {
    common: { mDef: 70, rDef: 35, agility: 35, hp: 60 },
    uncommon: { mDef: 90, rDef: 40, agility: 40, hp: 80 },
    rare: { mDef: 110, rDef: 45, agility: 45, hp: 100 },
    epic: { mDef: 130, rDef: 50, agility: 50, hp: 120 },
    legendary: { mDef: 160, rDef: 60, agility: 60, hp: 150 },
  },
  arrowward_mantle: {
    common: { mDef: 35, rDef: 70, agility: 35, hp: 60 },
    uncommon: { mDef: 40, rDef: 90, agility: 40, hp: 80 },
    rare: { mDef: 45, rDef: 110, agility: 45, hp: 100 },
    epic: { mDef: 50, rDef: 130, agility: 50, hp: 120 },
    legendary: { mDef: 60, rDef: 160, agility: 60, hp: 150 },
  },
  dragonscale_tunic: {
    common: { mDef: 35, rDef: 35, agility: 70, hp: 60 },
    uncommon: { mDef: 40, rDef: 40, agility: 90, hp: 80 },
    rare: { mDef: 45, rDef: 45, agility: 110, hp: 100 },
    epic: { mDef: 50, rDef: 50, agility: 130, hp: 120 },
    legendary: { mDef: 60, rDef: 60, agility: 160, hp: 150 },
  },
  colossal_shellarmor: {
    common: { mDef: 80, rDef: 35, agility: 20, hp: 80 },
    uncommon: { mDef: 100, rDef: 40, agility: 22, hp: 105 },
    rare: { mDef: 120, rDef: 45, agility: 25, hp: 130 },
    epic: { mDef: 145, rDef: 50, agility: 28, hp: 160 },
    legendary: { mDef: 180, rDef: 60, agility: 32, hp: 200 },
  },
  arcane_nullifier: {
    common: { mDef: 35, rDef: 80, agility: 20, hp: 80 },
    uncommon: { mDef: 40, rDef: 100, agility: 22, hp: 105 },
    rare: { mDef: 45, rDef: 120, agility: 25, hp: 130 },
    epic: { mDef: 50, rDef: 145, agility: 28, hp: 160 },
    legendary: { mDef: 60, rDef: 180, agility: 32, hp: 200 },
  },
  polished_chainbolster: {
    common: { mDef: 55, rDef: 55, agility: 55, hp: 55 },
    uncommon: { mDef: 70, rDef: 70, agility: 70, hp: 70 },
    rare: { mDef: 85, rDef: 85, agility: 85, hp: 85 },
    epic: { mDef: 100, rDef: 100, agility: 100, hp: 100 },
    legendary: { mDef: 120, rDef: 120, agility: 120, hp: 120 },
  },
  juggernaut_platemail: {
    common: { mDef: 65, rDef: 65, agility: 30, hp: 60 },
    uncommon: { mDef: 85, rDef: 85, agility: 35, hp: 80 },
    rare: { mDef: 105, rDef: 105, agility: 40, hp: 100 },
    epic: { mDef: 125, rDef: 125, agility: 45, hp: 120 },
    legendary: { mDef: 155, rDef: 155, agility: 55, hp: 150 },
  },
};

// Primaries pulled from your sheet
export const ARMOR_PRIMARY_STATS: Record<ArmorKey, readonly (keyof ArmorStatBlock)[]> = {
  frontiers_mail: ["mDef", "hp"],
  arrowward_mantle: ["rDef", "hp"],
  dragonscale_tunic: ["agility", "hp"],
  colossal_shellarmor: ["mDef", "hp"],
  arcane_nullifier: ["rDef", "hp"],
  polished_chainbolster: ["mDef", "rDef"],
  juggernaut_platemail: ["mDef", "rDef"],
};

// ── Armour pieces ─────────────────────────────────────────────────
// Armour comes in three pieces: helmet, chest and legs. The ceilings above
// are for a whole set; each piece gets a share of every stat, so a full set
// of one rarity is worth about one old single armour. The chest carries most
// of the defence, the helmet leans to health and the legs to agility.
export type ArmorSlot = "helmet" | "chest" | "legs";
export const ARMOR_SLOTS: ArmorSlot[] = ["helmet", "chest", "legs"];

export const ARMOR_SLOT_INFO: Record<ArmorSlot, { name: string; piece: string }> = {
  helmet: { name: "Helmet", piece: "Helm" },
  chest:  { name: "Chest",  piece: "Chestpiece" },
  legs:   { name: "Legs",   piece: "Greaves" },
};

export const PIECE_SHARE: Record<ArmorSlot, ArmorStatBlock> = {
  helmet: { mDef: 0.2, rDef: 0.2, agility: 0.2, hp: 0.4 },
  chest:  { mDef: 0.6, rDef: 0.6, agility: 0.3, hp: 0.4 },
  legs:   { mDef: 0.2, rDef: 0.2, agility: 0.5, hp: 0.2 },
};

// How much of a set's worth a piece is (for selling).
export const PIECE_VALUE: Record<ArmorSlot, number> = { helmet: 0.25, chest: 0.5, legs: 0.25 };

// A piece's share of a whole set's stats (or ceilings).
export function pieceStats(set: Record<string, number>, slot: ArmorSlot): Record<string, number> {
  const share = PIECE_SHARE[slot] as Record<string, number>;
  return Object.fromEntries(Object.entries(set).map(([k, v]) => [k, Math.round(v * (share[k] ?? 1 / 3))]));
}

export const pieceName = (key: ArmorKey, slot: ArmorSlot) => `${ARMOR_META[key].name} ${ARMOR_SLOT_INFO[slot].piece}`;

// ── Set bonuses ───────────────────────────────────────────────────
// Wear all three pieces of one armour (any rarities) and you get its set
// mechanic. (Applied in lib/combat/battle.ts; Second Wind in the dungeon.)
export const SET_BONUS: Record<ArmorKey, { name: string; text: string }> = {
  colossal_shellarmor:   { name: "Hard Shell",  text: "The first hit it takes each fight does half damage." },
  dragonscale_tunic:     { name: "Quickscale",  text: "Its first attack each fight goes before everyone else's." },
  arcane_nullifier:      { name: "Nullify",     text: "Reflects 25% of ranged damage it takes back at the attacker." },
  arrowward_mantle:      { name: "Deflect",     text: "25% of ranged attacks against it miss." },
  polished_chainbolster: { name: "Steadfast",   text: "It can't be crippled." },
  juggernaut_platemail:  { name: "Unstoppable", text: "Once per fight, a blow that would knock it out leaves it on 1 HP." },
  frontiers_mail:        { name: "Second Wind", text: "Heals 15% of its max HP after every fight it wins in the dungeon." },
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
