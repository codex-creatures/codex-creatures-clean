// lib/creatures/rosterV2.ts
// Combat V2's roster (live since 2026-10-26): 7 races × one creature of each
// rarity = 35. The 25 older species plus 10 new ones; the whole roster is
// built in creatureData.ts (CREATURE_TEMPLATES) from the pieces here.
//
// Every creature has an archetype. The archetype says which style(s) it
// fights in, so which styles' core moves it knows: a hybrid (a
// Battlemage, a Spellbow) gets moves in two styles, and its %s back both.

import type { CombatClass, CreatureTemplate, Skill } from "./creatureData";
import { SPECIES_RACES } from "./racesV2";
import { coreFor } from "./raceKitsV2";

export type Archetype =
  | "bruiser" | "bulwark"       // melee
  | "sniper" | "skirmisher"     // ranged
  | "arcanist" | "warden"       // magic
  | "ranger" | "battlemage" | "spellbow"; // hybrids

// The styles each archetype fights in. A hybrid's main style is its class
// (cls); the other is its second style.
export const ARCHETYPE_INFO: Record<Archetype, { name: string; styles: CombatClass[]; shape: string }> = {
  bruiser:    { name: "Bruiser",    styles: ["melee"],           shape: "big melee, some speed, light defences" },
  bulwark:    { name: "Bulwark",    styles: ["melee"],           shape: "melee tank: high HP and defences, slow" },
  sniper:     { name: "Sniper",     styles: ["ranged"],          shape: "big ranged, frail" },
  skirmisher: { name: "Skirmisher", styles: ["ranged"],          shape: "fast ranged: strikes first, hits less" },
  arcanist:   { name: "Arcanist",   styles: ["magic"],           shape: "big magic, frail" },
  warden:     { name: "Warden",     styles: ["magic"],           shape: "magic tank: high HP and defences, steady magic" },
  ranger:     { name: "Ranger",     styles: ["melee", "ranged"], shape: "melee and ranged, both middling" },
  battlemage: { name: "Battlemage", styles: ["melee", "magic"],  shape: "melee and magic, both middling" },
  spellbow:   { name: "Spellbow",   styles: ["ranged", "magic"], shape: "ranged and magic, both middling" },
};

// A draft archetype for every species, by its %s and moves today.
export const SPECIES_ARCHETYPE: Record<string, Archetype> = {
  moss_wolf: "bruiser", amber_wasp: "bruiser", bellow_toad: "ranger", dire_wolf: "bruiser", ironhide: "bulwark",
  cave_bat: "bruiser", rust_beetle: "bulwark", crystalback: "warden", crystal_golem: "battlemage", hollow_matriarch: "ranger",
  dust_sprite: "arcanist", flicker_wisp: "arcanist", veilstalker: "battlemage", the_watcher: "arcanist", void_serpent: "battlemage",
  rattlebones: "bruiser", shambler: "bulwark", dustwraith: "spellbow", mr_shadows: "battlemage", storm_phoenix: "skirmisher",
  thicket_archer: "sniper", leafblade_scout: "ranger", aurelius: "ranger", swamp_witch: "arcanist", sylvaran: "sniper",
  // New
  gleamling: "spellbow", flame_imp: "arcanist", deep_angler: "battlemage", tunnel_wyrm: "bulwark", thunderhead: "battlemage",
  plague_rat: "bruiser", rotgut_fly: "skirmisher", glob: "bulwark", dreadpox: "warden", pale_rider: "battlemage",
  // The user's picks (2026-11-26)
  skinwing: "bruiser", gutsnout: "bruiser", grub_keeper: "bruiser", mole_hag: "battlemage", gloom_gnome: "arcanist",
  cinder_husk: "bruiser", troglodyte_brute: "bruiser", gravewarden: "bulwark", hexed_puppet: "battlemage",
  labyrinth_sprite: "arcanist",
};

// The 10 new species, filling the races' empty rarities. Their %s follow
// today's creatures of the same rarity and archetype. The user designed the
// Flame Imp, Glob and Dreadpox (2026-10-26); the rest are Claude's drafts.
// (skills is filled from the kits below.)
type NewSpecies = Omit<CreatureTemplate, "skills">;
export const NEW_SPECIES_V2: NewSpecies[] = [
  // Divine
  { id: "gleamling",       name: "Gleamling",       rarity: "common",    baseHp: 58,  cls: "magic",  proficiency: { atk: 2, rng: 6, mag: 12, agil: 12, mdef: 1, rdef: 5, magdef: 6, hp: 3 },
    flavour: "A mote of chapel light with moth wings. Small, bright, and much angrier than it looks." },
  // Geo
  { id: "flame_imp",       name: "Flame Imp",       rarity: "uncommon",  baseHp: 72,  cls: "magic",  proficiency: { atk: 4, rng: 3, mag: 20, agil: 18, mdef: 5, rdef: 3, magdef: 10, hp: 5 },
    flavour: "A little devil of red flame with something colder burning inside. Its trident wand spits blue fire." },
  { id: "thunderhead",     name: "Thunderhead",     rarity: "legendary", baseHp: 138, cls: "magic",  proficiency: { atk: 38, rng: 3, mag: 44, agil: 26, mdef: 16, rdef: 18, magdef: 8, hp: 40 },
    flavour: "A storm that learned to walk. Hail falls from its shoulders, and lightning answers when it points." },
  // Underkin
  { id: "deep_angler",     name: "Deep Angler",     rarity: "rare",      baseHp: 88,  cls: "melee",  proficiency: { atk: 22, rng: 3, mag: 16, agil: 14, mdef: 10, rdef: 10, magdef: 5, hp: 30 },
    // (Melee, not ranged: nothing about it shoots. The user, 2026-10-26.)
    flavour: "A blind cave fish on crooked legs. Follow its glowing lure and you'll never find your way out." },
  { id: "tunnel_wyrm",     name: "Tunnel Wyrm",     rarity: "epic",      baseHp: 130, cls: "melee",  proficiency: { atk: 26, rng: 3, mag: 3, agil: 6, mdef: 50, rdef: 24, magdef: 8, hp: 80 },
    flavour: "Eyeless and armoured in plates of stone. The tunnels it leaves behind are the Labyrinth's oldest." },
  // Toxic
  { id: "plague_rat",      name: "Plague Rat",      rarity: "common",    baseHp: 60,  cls: "melee",  proficiency: { atk: 14, rng: 3, mag: 3, agil: 16, mdef: 2, rdef: 5, magdef: 3, hp: 15 },
    flavour: "Mangy, yellow-toothed and never alone for long." },
  { id: "rotgut_fly",      name: "Rotgut Fly",      rarity: "uncommon",  baseHp: 72,  cls: "ranged", proficiency: { atk: 4, rng: 18, mag: 3, agil: 20, mdef: 6, rdef: 3, magdef: 7, hp: 5 },
    flavour: "A bloated fly the size of a dog. It spits what it ate last, and it ate something awful." },
  { id: "glob",            name: "Glob",            rarity: "rare",      baseHp: 118, cls: "melee",  proficiency: { atk: 14, rng: 3, mag: 3, agil: 4, mdef: 20, rdef: 13, magdef: 4, hp: 50 },
    flavour: "A slug of green slime with a mouth that never stops melting. What it swallows, it keeps." },
  { id: "dreadpox",        name: "Dreadpox",        rarity: "epic",      baseHp: 125, cls: "magic",  proficiency: { atk: 6, rng: 3, mag: 30, agil: 10, mdef: 10, rdef: 22, magdef: 38, hp: 60 },
    flavour: "A skeleton in a plague mask, shaking a dreamcatcher hung with feathers. The sickness it catches, it sends back worse." },
  { id: "pale_rider",      name: "The Pale Rider",  rarity: "legendary", baseHp: 140, cls: "melee",  proficiency: { atk: 40, rng: 3, mag: 36, agil: 24, mdef: 18, rdef: 16, magdef: 6, hp: 30 },
    flavour: "A rider on a rotting horse, scythe in one hand and a plague in the other. Where it rides, nothing grows." },
  // The user's picks of 50 drafts (2026-11-26; art/creature-candidates): races, rarities and roles the user's,
  // the %s Claude's draft with the user's edits (given at level 25). A race now has more than one of a rarity.
  { id: "skinwing", name: "Skinwing", rarity: "common", baseHp: 58, cls: "melee", proficiency: { atk: 14, rng: 4, mag: 3, agil: 22, mdef: 5, rdef: 1, magdef: 4, hp: 5 },
    flavour: "A naked bat with skin like wet paper. You hear its shriek long after it's gone." },
  { id: "gutsnout", name: "Gutsnout", rarity: "common", baseHp: 63, cls: "melee", proficiency: { atk: 16, rng: 3, mag: 3, agil: 12, mdef: 6, rdef: 4, magdef: 2, hp: 20 },
    flavour: "All snout and sores. It roots through the Labyrinth's leavings and bites whatever it finds there." },
  { id: "grub_keeper", name: "Grub Keeper", rarity: "common", baseHp: 57, cls: "melee", proficiency: { atk: 12, rng: 6, mag: 4, agil: 6, mdef: 11, rdef: 4, magdef: 7, hp: 13 },
    flavour: "A fat goblin with a sack of squirming grubs. He'll share, whether you want them or not." },
  { id: "mole_hag", name: "Mole Hag", rarity: "uncommon", baseHp: 74, cls: "melee", proficiency: { atk: 14, rng: 3, mag: 14, agil: 10, mdef: 2, rdef: 6, magdef: 10, hp: 10 },
    flavour: "A blind crone with a candle on her head and claws made for digging. She finds you by smell." },
  { id: "gloom_gnome", name: "Gloom Gnome", rarity: "uncommon", baseHp: 92, cls: "magic", proficiency: { atk: 3, rng: 3, mag: 20, agil: 8, mdef: 5, rdef: 5, magdef: 5, hp: 25 },
    flavour: "Older than the tunnels, by his own account. The orb on his staff remembers the way out; he doesn't." },
  { id: "cinder_husk", name: "Cinder Husk", rarity: "rare", baseHp: 84, cls: "melee", proficiency: { atk: 30, rng: 3, mag: 6, agil: 30, mdef: 2, rdef: 6, magdef: 12, hp: 10 },
    flavour: "A skeleton still burning from the inside. It moves before the smoke from its eyes can catch up." },
  { id: "troglodyte_brute", name: "Troglodyte Brute", rarity: "rare", baseHp: 112, cls: "melee", proficiency: { atk: 26, rng: 4, mag: 3, agil: 4, mdef: 16, rdef: 14, magdef: 4, hp: 25 },
    flavour: "Eyeless, stone-shouldered and slow to anger. Slow to stop, too." },
  { id: "gravewarden", name: "Gravewarden", rarity: "rare", baseHp: 115, cls: "melee", proficiency: { atk: 14, rng: 3, mag: 3, agil: 4, mdef: 30, rdef: 26, magdef: 2, hp: 35 },
    flavour: "A knight who never left his post, his own tombstone strapped to his arm." },
  { id: "hexed_puppet", name: "Hexed Puppet", rarity: "epic", baseHp: 110, cls: "magic", proficiency: { atk: 22, rng: 4, mag: 30, agil: 14, mdef: 15, rdef: 18, magdef: 4, hp: 20 },
    flavour: "Someone is still working the strings. Nobody has ever seen who." },
  // The user's Labyrinth Sprite (2026-11-26): Divine, Uncommon, magic, the fastest of its rarity and frail. The %s
  // are Claude's (the Flame Imp's total, with magic and HP traded for agility).
  { id: "labyrinth_sprite", name: "Labyrinth Sprite", rarity: "uncommon", baseHp: 66, cls: "magic", proficiency: { atk: 3, rng: 3, mag: 18, agil: 26, mdef: 2, rdef: 5, magdef: 7, hp: 4 },
    flavour: "A pixie of the deep halls, quick as a candle gutters. It leads the lost further in, laughing." },
];

// A creature's V2 moves (the user, 2026-11-12): the core moves of its main
// style (light, heavy, first; the 3 it starts with), then a hybrid's second
// style's. They're neutral (no race: 2026-11-12). Its fourth slot stays empty until it
// reads a codex.
export function v2Moves(c: { id: string; cls: CombatClass }): Skill[] {
  const [race] = SPECIES_RACES[c.id] ?? [];
  if (!race) return [];
  const second = ARCHETYPE_INFO[SPECIES_ARCHETYPE[c.id] ?? "bruiser"].styles.find((s) => s !== c.cls);
  return [...coreFor(c.cls), ...(second ? coreFor(second) : [])];
}

// Today's creatures that fight in another style in V2 (the user and Claude,
// 2026-10-26, to even out the archetypes). Their main % moves to the new
// style, so the total stays the same; a new hybrid splits it across both.
// Species whose style the user changed on 2026-10-27 (the Cave Goblin, Amber
// Wasp, Dust Sprite, Crystal Golem, Tunnel Wyrm and Thunderhead; Tunnel Wyrm's
// and Thunderhead's are in NEW_SPECIES_V2 above). The ones players already own
// are moved over once when the save loads (upgradeStyle, lib/creatures/instance.ts).
// Their attack %s add up to the same as before.
export const RESTYLED_SPECIES = ["cave_bat", "amber_wasp", "dust_sprite", "crystal_golem", "tunnel_wyrm", "thunderhead"];

export const V2_RESTYLE: Record<string, Pick<CreatureTemplate, "cls" | "proficiency">> = {
  // A melee Ranger now: fangs first, webs second (was ranged).
  hollow_matriarch: { cls: "melee", proficiency: { atk: 40, rng: 24, mag: 3, agil: 30, mdef: 18, rdef: 7, magdef: 22, hp: 25 } },
  // Magic, not ranged (the user).
  the_watcher:      { cls: "magic", proficiency: { atk: 10, rng: 3, mag: 42, agil: 12, mdef: 12, rdef: 6, magdef: 18, hp: 15 } },
  // A Battlemage: fists first, crystal magic second (the user, 2026-10-27; was a magic Warden).
  crystal_golem:    { cls: "melee", proficiency: { atk: 20, rng: 3, mag: 14, agil: 4, mdef: 12, rdef: 27, magdef: 39, hp: 60 } },
  // Melee, not ranged (the user, 2026-10-27).
  cave_bat:         { cls: "melee", proficiency: { atk: 18, rng: 3, mag: 3, agil: 16, mdef: 2, rdef: 6, magdef: 4, hp: 15 } },
  amber_wasp:       { cls: "melee", proficiency: { atk: 22, rng: 3, mag: 3, agil: 22, mdef: 4, rdef: 1, magdef: 4, hp: 10 } },
  // Magic, not ranged (the user, 2026-10-27).
  dust_sprite:      { cls: "magic", proficiency: { atk: 2, rng: 3, mag: 18, agil: 10, mdef: 1, rdef: 5, magdef: 6, hp: 3 } },
  // A Spellbow: it hurls the dust it's made of.
  dustwraith:       { cls: "magic", proficiency: { atk: 6, rng: 6, mag: 14, agil: 32, mdef: 6, rdef: 9, magdef: 3, hp: 3 } },
};

