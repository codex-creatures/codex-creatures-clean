import type { ItemKey } from "./ceilings";

export type ItemMeta = {
  name: string;
  category: string;
  desc: string;
};

export const ITEM_META: Record<ItemKey, ItemMeta> = {
  // MELEE WEAPONS
  void_scythe: {
    name: "Void Scythe",
    category: "Melee - Bruiser",
    desc: "Bruiser melee weapon. High melee and HP, moderate agility.",
  },
  temporal_maul: {
    name: "Temporal Maul",
    category: "Melee - Heavy",
    desc: "Heavy melee weapon. Massive melee damage, low agility and HP.",
  },
  serrated_fanblade: {
    name: "Serrated Fan-Blade",
    category: "Melee - Agile",
    desc: "Agile melee weapon. High agility and melee, lower HP.",
  },
  stormlash_whip: {
    name: "Stormlash Whip",
    category: "Melee - Hybrid",
    desc: "Hybrid melee weapon. Balanced melee and ranged capabilities.",
  },

  // RANGED WEAPONS
  soul_storm: {
    name: "Soul Storm",
    category: "Ranged - Bruiser",
    desc: "Bruiser ranged weapon. High ranged and HP, moderate agility.",
  },
  weeping_greatbow: {
    name: "Weeping Great-Bow",
    category: "Ranged - Heavy",
    desc: "Heavy ranged weapon. Massive ranged damage, low agility.",
  },
  chaos_orb: {
    name: "Chaos Orb",
    category: "Ranged - Agile",
    desc: "Agile ranged weapon. High agility and ranged, lower HP.",
  },
  lightning_trident: {
    name: "Lightning Trident",
    category: "Ranged - Hybrid",
    desc: "Hybrid ranged weapon. Balanced melee and ranged capabilities.",
  },

  // DEFENCE WEAPONS
  chainbound_aegis: {
    name: "Chainbound Aegis",
    category: "Defence - Ranged Lean",
    desc: "Defensive weapon with ranged focus. High HP, moderate ranged.",
  },
  ironfang_guard: {
    name: "Ironfang Guard",
    category: "Defence - Melee Lean",
    desc: "Defensive weapon with melee focus. High HP, moderate melee.",
  },
  basalt_bulwark: {
    name: "Basalt Bulwark",
    category: "Defence - True Tank",
    desc: "True tank weapon. Massive HP, minimal offensive stats.",
  },
  aether_shield: {
    name: "Aether Shield",
    category: "Defence - Agile Tank",
    desc: "Agile tank weapon. High HP and agility, low offensive stats.",
  },
};