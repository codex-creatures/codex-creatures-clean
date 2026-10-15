import type { Rarity } from "./budgets";
import type { DamageType } from "../creatures/creatureData";

export type StatKey = "melee" | "ranged" | "magic" | "agility" | "hp";
export type StatBlock = Record<StatKey, number>;

export type ItemKey =
  | "void_scythe"
  | "temporal_maul"
  | "serrated_fanblade"
  | "stormlash_whip"
  | "soul_storm"
  | "weeping_greatbow"
  | "chaos_orb"
  | "lightning_trident"
  | "thunderhead_crossbow"
  | "frostspire_staff"
  | "chainbound_aegis"
  | "ironfang_guard"
  | "basalt_bulwark"
  | "aether_shield";

export type ItemCeilings = Record<Rarity, StatBlock>;

export const ITEM_CEILINGS: Record<ItemKey, ItemCeilings> = {
  // MELEE WEAPONS
  void_scythe: {
    common: { melee: 45, ranged: 20, magic: 10, agility: 30, hp: 55 },
    uncommon: { melee: 60, ranged: 20, magic: 10, agility: 30, hp: 70 },
    rare: { melee: 75, ranged: 25, magic: 12, agility: 35, hp: 85 },
    epic: { melee: 90, ranged: 30, magic: 15, agility: 40, hp: 105 },
    legendary: { melee: 110, ranged: 35, magic: 18, agility: 45, hp: 130 },
  },
  temporal_maul: {
    common: { melee: 55, ranged: 20, magic: 10, agility: 25, hp: 30 },
    uncommon: { melee: 75, ranged: 20, magic: 10, agility: 25, hp: 40 },
    rare: { melee: 95, ranged: 25, magic: 12, agility: 30, hp: 50 },
    epic: { melee: 115, ranged: 30, magic: 15, agility: 35, hp: 60 },
    legendary: { melee: 140, ranged: 35, magic: 18, agility: 40, hp: 75 },
  },
  serrated_fanblade: {
    common: { melee: 40, ranged: 20, magic: 10, agility: 45, hp: 35 },
    uncommon: { melee: 55, ranged: 20, magic: 10, agility: 60, hp: 35 },
    rare: { melee: 70, ranged: 25, magic: 12, agility: 75, hp: 40 },
    epic: { melee: 85, ranged: 30, magic: 15, agility: 95, hp: 45 },
    legendary: { melee: 105, ranged: 35, magic: 18, agility: 115, hp: 55 },
  },
  stormlash_whip: {
    common: { melee: 50, ranged: 30, magic: 10, agility: 35, hp: 45 },
    uncommon: { melee: 65, ranged: 45, magic: 10, agility: 35, hp: 45 },
    rare: { melee: 80, ranged: 60, magic: 12, agility: 40, hp: 55 },
    epic: { melee: 100, ranged: 75, magic: 15, agility: 45, hp: 65 },
    legendary: { melee: 125, ranged: 90, magic: 18, agility: 50, hp: 80 },
  },

  // RANGED WEAPONS
  weeping_greatbow: {
    common: { melee: 20, ranged: 55, magic: 10, agility: 25, hp: 40 },
    uncommon: { melee: 20, ranged: 75, magic: 10, agility: 25, hp: 40 },
    rare: { melee: 25, ranged: 95, magic: 12, agility: 30, hp: 50 },
    epic: { melee: 30, ranged: 115, magic: 15, agility: 35, hp: 60 },
    legendary: { melee: 35, ranged: 140, magic: 18, agility: 40, hp: 75 },
  },
  lightning_trident: {
    common: { melee: 30, ranged: 50, magic: 10, agility: 35, hp: 45 },
    uncommon: { melee: 45, ranged: 65, magic: 10, agility: 35, hp: 45 },
    rare: { melee: 60, ranged: 80, magic: 12, agility: 40, hp: 55 },
    epic: { melee: 75, ranged: 100, magic: 15, agility: 45, hp: 65 },
    legendary: { melee: 90, ranged: 125, magic: 18, agility: 50, hp: 80 },
  },
  thunderhead_crossbow: {
    common: { melee: 20, ranged: 45, magic: 10, agility: 30, hp: 55 },
    uncommon: { melee: 20, ranged: 60, magic: 10, agility: 30, hp: 70 },
    rare: { melee: 25, ranged: 75, magic: 12, agility: 35, hp: 85 },
    epic: { melee: 30, ranged: 95, magic: 15, agility: 40, hp: 105 },
    legendary: { melee: 35, ranged: 115, magic: 18, agility: 45, hp: 130 },
  },

  // MAGIC WEAPONS
  soul_storm: {
    common: { melee: 20, ranged: 10, magic: 45, agility: 30, hp: 55 },
    uncommon: { melee: 20, ranged: 10, magic: 60, agility: 30, hp: 70 },
    rare: { melee: 25, ranged: 12, magic: 75, agility: 35, hp: 85 },
    epic: { melee: 30, ranged: 15, magic: 95, agility: 40, hp: 105 },
    legendary: { melee: 35, ranged: 18, magic: 115, agility: 45, hp: 130 },
  },
  chaos_orb: {
    common: { melee: 20, ranged: 10, magic: 45, agility: 55, hp: 35 },
    uncommon: { melee: 20, ranged: 10, magic: 60, agility: 55, hp: 35 },
    rare: { melee: 25, ranged: 12, magic: 75, agility: 70, hp: 40 },
    epic: { melee: 30, ranged: 15, magic: 95, agility: 85, hp: 45 },
    legendary: { melee: 35, ranged: 18, magic: 115, agility: 105, hp: 55 },
  },
  frostspire_staff: {
    common: { melee: 20, ranged: 10, magic: 55, agility: 25, hp: 40 },
    uncommon: { melee: 20, ranged: 10, magic: 75, agility: 25, hp: 40 },
    rare: { melee: 25, ranged: 12, magic: 95, agility: 30, hp: 50 },
    epic: { melee: 30, ranged: 15, magic: 115, agility: 35, hp: 60 },
    legendary: { melee: 35, ranged: 18, magic: 140, agility: 40, hp: 75 },
  },

  // DEFENCE WEAPONS
  chainbound_aegis: {
    common: { melee: 25, ranged: 45, magic: 10, agility: 25, hp: 85 },
    uncommon: { melee: 25, ranged: 45, magic: 10, agility: 25, hp: 110 },
    rare: { melee: 30, ranged: 55, magic: 12, agility: 30, hp: 135 },
    epic: { melee: 35, ranged: 65, magic: 15, agility: 35, hp: 165 },
    legendary: { melee: 40, ranged: 75, magic: 18, agility: 40, hp: 200 },
  },
  ironfang_guard: {
    common: { melee: 45, ranged: 25, magic: 10, agility: 25, hp: 75 },
    uncommon: { melee: 45, ranged: 25, magic: 10, agility: 25, hp: 100 },
    rare: { melee: 55, ranged: 30, magic: 12, agility: 30, hp: 125 },
    epic: { melee: 65, ranged: 35, magic: 15, agility: 35, hp: 155 },
    legendary: { melee: 75, ranged: 40, magic: 18, agility: 40, hp: 190 },
  },
  basalt_bulwark: {
    common: { melee: 30, ranged: 20, magic: 10, agility: 20, hp: 100 },
    uncommon: { melee: 30, ranged: 20, magic: 10, agility: 20, hp: 130 },
    rare: { melee: 35, ranged: 25, magic: 12, agility: 25, hp: 160 },
    epic: { melee: 40, ranged: 30, magic: 15, agility: 30, hp: 190 },
    legendary: { melee: 50, ranged: 35, magic: 18, agility: 35, hp: 230 },
  },
  aether_shield: {
    common: { melee: 25, ranged: 20, magic: 45, agility: 55, hp: 70 },
    uncommon: { melee: 25, ranged: 20, magic: 45, agility: 55, hp: 90 },
    rare: { melee: 30, ranged: 25, magic: 55, agility: 70, hp: 110 },
    epic: { melee: 35, ranged: 30, magic: 65, agility: 85, hp: 135 },
    legendary: { melee: 40, ranged: 35, magic: 75, agility: 105, hp: 165 },
  },
};
export const ITEM_KEYS = Object.keys(ITEM_CEILINGS) as ItemKey[];
export const STAT_KEYS: StatKey[] = ["melee", "ranged", "magic", "agility", "hp"];

// Each weapon is strong in one damage type: moves of that type do extra
// damage with it (AFFINITY_BONUS in lib/combat/engine.ts).
export const WEAPON_AFFINITY: Record<ItemKey, DamageType> = {
  void_scythe: "arcane", temporal_maul: "force", serrated_fanblade: "pierce", stormlash_whip: "force",
  weeping_greatbow: "pierce", lightning_trident: "arcane", thunderhead_crossbow: "force",
  soul_storm: "arcane", chaos_orb: "force", frostspire_staff: "pierce",
  chainbound_aegis: "force", ironfang_guard: "pierce", basalt_bulwark: "force", aether_shield: "arcane",
};