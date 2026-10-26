// lib/creatures/racesV2.ts
// Combat V2 races (live since 2026-10-26). Seven races
// replace the class triangle: a move's race against the target's race(s)
// decides how well it lands (the chart and maths: lib/combat/raceChart.ts).
// Creatures can have one or two races.
//
// Everything here is a first draft for the sims: who belongs to which race,
// and which race each of today's moves counts as.

export type RaceV2 = "undead" | "divine" | "beast" | "underkin" | "geo" | "humanoid" | "toxic";

export const RACES_V2: RaceV2[] = ["undead", "divine", "beast", "underkin", "geo", "humanoid", "toxic"];

export const RACE_V2_NAME: Record<RaceV2, string> = {
  undead: "Undead", divine: "Divine", beast: "Beast", underkin: "Underkin",
  geo: "Geo", humanoid: "Humanoid", toxic: "Toxic",
};

// Every species' race(s), by what it is and how it looks. Klutz and the
// boss parts have none for now: they take and deal neutral damage. (Except
// the Baby Cyclops, the first quest's thief: a giant's whelp, Humanoid, so
// the guided first fight can teach races.)
export const SPECIES_RACES: Record<string, RaceV2[]> = {
  // Old Beast
  moss_wolf:        ["beast"],
  amber_wasp:       ["beast"],
  bellow_toad:      ["beast", "toxic"], // poison glands, always spitting
  dire_wolf:        ["beast"],
  ironhide:         ["beast"],
  // Old Underkin
  cave_bat:         ["underkin"],
  rust_beetle:      ["underkin"],
  crystalback:      ["geo", "beast"],
  crystal_golem:    ["geo"],
  hollow_matriarch: ["underkin", "beast"],  // a cave spider (the user, 2026-10-26)
  // Old Etherial
  dust_sprite:      ["geo"],                // a wind spirit
  flicker_wisp:     ["divine"],
  veilstalker:      ["divine", "underkin"], // half out of phase (was Undead: that left Undead two Rares)
  the_watcher:      ["divine"],
  void_serpent:     ["divine", "beast"],
  // Old Undead
  rattlebones:      ["undead"],
  shambler:         ["undead", "toxic"], // rotting
  dustwraith:       ["undead", "geo"],      // a whirlwind with a grudge
  mr_shadows:       ["undead"],
  storm_phoenix:    ["undead", "beast"],    // the Skull Raven
  // Old Elvish
  thicket_archer:   ["humanoid"],
  leafblade_scout:  ["humanoid"],
  aurelius:         ["humanoid", "beast"],  // a centaur
  swamp_witch:      ["humanoid", "toxic"],
  sylvaran:         ["humanoid"],
  // New in Combat V2 (lib/creatures/rosterV2.ts)
  gleamling:        ["divine"],
  flame_imp:        ["geo", "divine"],
  thunderhead:      ["geo"],
  deep_angler:      ["underkin"],
  tunnel_wyrm:      ["underkin", "geo"],    // armoured in stone
  plague_rat:       ["toxic", "beast"],
  rotgut_fly:       ["toxic"],
  glob:             ["toxic"],
  dreadpox:         ["toxic", "undead"], // the user's: Undead and Toxic
  pale_rider:       ["undead", "humanoid"],   // the user: a rider, not a plague (so Toxic has no Legendary)
  // The first quest's thief (lib/quest.ts)
  baby_cyclops:     ["humanoid"],
  // Retired (still owned by some players)
  monkey_mage:      ["beast"],
  mantis_warden:    ["beast"],
  forest_slime:     ["toxic"],
  stone_toad:       ["beast", "geo"],
  thornmaw:         ["geo", "beast"],       // a walking carnivorous plant
  ironjaw_hound:    ["beast"],
  ashen_drifter:    ["geo"],
};

// A draft race for each of today's moves (the "drafted" sim mode). Moves
// not listed (the bosses') are neutral.
export const MOVE_RACES: Record<string, RaceV2> = {
  // Melee
  "Flick": "humanoid", "Jab": "humanoid", "Slash": "beast", "Hexblade": "undead", "Heavy Blow": "beast",
  "Impale": "humanoid", "Crush": "geo", "Soul Rend": "undead", "Devastator": "beast",
  // Ranged
  "Pebble Shot": "underkin", "Stone Throw": "underkin", "Bolt": "humanoid", "Hex Arrow": "undead",
  "Piercing Shot": "humanoid", "Boulder Toss": "geo", "Cursed Volley": "undead", "Annihilator": "divine",
  // Magic
  "Spark": "geo", "Frost Shard": "geo", "Hex": "toxic", "Firebolt": "geo", "Ice Lance": "geo",
  "Fireball": "geo", "Soul Drain": "undead", "Starfall": "divine",
  // Learnable
  "Cripple": "beast", "Crippling Shot": "humanoid", "Hobble Hex": "toxic", "Dash Lash": "beast",
  "Quick Bolt": "humanoid", "Quickcast": "divine", "Precise Slice": "humanoid", "Precise Shot": "humanoid",
  "Seeker Spark": "geo",
  // Race moves
  "Pounce": "beast", "Rabid Bite": "toxic", "Mirage": "divine", "Corpsify": "undead", "Barrage": "humanoid",
};
