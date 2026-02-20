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
