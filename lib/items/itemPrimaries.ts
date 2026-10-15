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

  // RANGED WEAPONS — primary: ranged + hp or melee
  weeping_greatbow:   ["ranged", "hp"],      // sniper — range + survive
  lightning_trident:  ["ranged", "melee"],   // hybrid thrower
  thunderhead_crossbow: ["ranged", "hp"],    // sustained ranged — needs staying power

  // MAGIC WEAPONS — primary: magic + hp or agility
  soul_storm:         ["magic", "hp"],       // sustained caster — needs staying power
  chaos_orb:          ["magic", "agility"],  // mobile caster — speed + magic
  frostspire_staff:   ["magic", "hp"],       // heavy caster

  // DEFENCE WEAPONS (shields/aegis) — primary: hp + melee or ranged
  chainbound_aegis:   ["hp", "ranged"],      // ranged tank
  ironfang_guard:     ["hp", "melee"],       // melee tank
  basalt_bulwark:     ["hp", "melee"],       // pure wall
  aether_shield:      ["hp", "magic"],       // magic-lean defender

  // STORY
  klutz_club:         ["melee", "hp"],       // Klutz's old club: a bit of everything
};
