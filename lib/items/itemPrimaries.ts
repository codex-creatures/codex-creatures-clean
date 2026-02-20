// lib/items/itemPrimaries.ts
// Primary stats define what a weapon is "for" — used by the sell formula
// to reward rolls that spike in the right places.
// Each weapon has exactly 2 primaries.

import type { StatKey } from "./ceilings";
import type { ItemKey } from "./ceilings";

export const PRIMARY_STATS_BY_ITEMKEY: Record<ItemKey, [StatKey, StatKey]> = {
  // MELEE WEAPONS — primary: melee + hp or agility
  void_scythe:        ["melee", "hp"],       // slow, heavy hitter — needs survivability
  temporal_maul:      ["melee", "hp"],       // pure melee bruiser
  serrated_fanblade:  ["melee", "agility"],  // fast melee — speed matters
  stormlash_whip:     ["melee", "ranged"],   // hybrid reach weapon

  // RANGED WEAPONS — primary: ranged + agility or hp
  soul_storm:         ["ranged", "hp"],      // sustained ranged — needs staying power
  weeping_greatbow:   ["ranged", "hp"],      // sniper — range + survive
  chaos_orb:          ["ranged", "agility"], // mobile caster — speed + range
  lightning_trident:  ["ranged", "melee"],   // hybrid thrower

  // DEFENCE WEAPONS (shields/aegis) — primary: hp + melee or ranged
  chainbound_aegis:   ["hp", "ranged"],      // ranged tank
  ironfang_guard:     ["hp", "melee"],       // melee tank
  basalt_bulwark:     ["hp", "melee"],       // pure wall
  aether_shield:      ["hp", "agility"],     // mobile defender
};
