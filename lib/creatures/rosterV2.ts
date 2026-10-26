// lib/creatures/rosterV2.ts
// Combat V2's roster (live since 2026-10-26): 7 races × one creature of each
// rarity = 35. The 25 older species plus 10 new ones; the whole roster is
// built in creatureData.ts (CREATURE_TEMPLATES) from the pieces here.
//
// Every creature has an archetype. The archetype says which style(s) it
// fights in, so which race kits it draws its moves from: a hybrid (a
// Battlemage, a Spellbow) gets moves in two styles, and its %s back both.

import type { CombatClass, CreatureTemplate, Skill } from "./creatureData";
import { SPECIES_RACES } from "./racesV2";
import { kitFor, kitMoveFor } from "./raceKitsV2";

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
  moss_wolf: "bruiser", amber_wasp: "skirmisher", bellow_toad: "ranger", dire_wolf: "bruiser", ironhide: "bulwark",
  cave_bat: "skirmisher", rust_beetle: "bulwark", crystalback: "warden", crystal_golem: "warden", hollow_matriarch: "ranger",
  dust_sprite: "sniper", flicker_wisp: "arcanist", veilstalker: "battlemage", the_watcher: "arcanist", void_serpent: "battlemage",
  rattlebones: "bruiser", shambler: "bulwark", dustwraith: "spellbow", mr_shadows: "battlemage", storm_phoenix: "skirmisher",
  thicket_archer: "sniper", leafblade_scout: "ranger", aurelius: "ranger", swamp_witch: "arcanist", sylvaran: "sniper",
  // New
  gleamling: "spellbow", flame_imp: "arcanist", deep_angler: "battlemage", tunnel_wyrm: "warden", thunderhead: "spellbow",
  plague_rat: "bruiser", rotgut_fly: "skirmisher", glob: "bulwark", dreadpox: "warden", pale_rider: "battlemage",
};

// The 10 new species, filling the races' empty rarities. Their %s follow
// today's creatures of the same rarity and archetype. The user designed the
// Flame Imp, Glob and Dreadpox (2026-10-26); the rest are Claude's drafts.
// (skills is filled from the kits below.)
type NewSpecies = Omit<CreatureTemplate, "skills">;
export const NEW_SPECIES_V2: NewSpecies[] = [
  // Divine
  { id: "gleamling",       name: "Gleamling",       rarity: "common",    baseHp: 58,  cls: "magic",  proficiency: { atk: 2, rng: 6, mag: 12, agil: 12, mdef: 2, rdef: 4, magdef: 6 },
    flavour: "A mote of chapel light with moth wings. Small, bright, and much angrier than it looks." },
  // Geo
  { id: "flame_imp",       name: "Flame Imp",       rarity: "uncommon",  baseHp: 72,  cls: "magic",  proficiency: { atk: 4, rng: 0, mag: 20, agil: 18, mdef: 4, rdef: 6, magdef: 8 },
    flavour: "A little devil of red flame with something colder burning inside. Its trident wand spits blue fire." },
  { id: "thunderhead",     name: "Thunderhead",     rarity: "legendary", baseHp: 138, cls: "ranged", proficiency: { atk: 8, rng: 38, mag: 36, agil: 26, mdef: 16, rdef: 22, magdef: 24 },
    flavour: "A storm that learned to walk. Hail falls from its shoulders, and lightning answers when it points." },
  // Underkin
  { id: "deep_angler",     name: "Deep Angler",     rarity: "rare",      baseHp: 88,  cls: "melee",  proficiency: { atk: 22, rng: 0, mag: 16, agil: 14, mdef: 8, rdef: 10, magdef: 10 },
    // (Melee, not ranged: nothing about it shoots. The user, 2026-10-26.)
    flavour: "A blind cave fish on crooked legs. Follow its glowing lure and you'll never find your way out." },
  { id: "tunnel_wyrm",     name: "Tunnel Wyrm",     rarity: "epic",      baseHp: 130, cls: "magic",  proficiency: { atk: 6, rng: 0, mag: 20, agil: 6, mdef: 34, rdef: 24, magdef: 24 },
    flavour: "Eyeless and armoured in plates of stone. The tunnels it leaves behind are the Labyrinth's oldest." },
  // Toxic
  { id: "plague_rat",      name: "Plague Rat",      rarity: "common",    baseHp: 60,  cls: "melee",  proficiency: { atk: 14, rng: 0, mag: 0, agil: 16, mdef: 4, rdef: 4, magdef: 4 },
    flavour: "Mangy, yellow-toothed and never alone for long." },
  { id: "rotgut_fly",      name: "Rotgut Fly",      rarity: "uncommon",  baseHp: 72,  cls: "ranged", proficiency: { atk: 4, rng: 18, mag: 0, agil: 20, mdef: 4, rdef: 6, magdef: 6 },
    flavour: "A bloated fly the size of a dog. It spits what it ate last, and it ate something awful." },
  { id: "glob",            name: "Glob",            rarity: "rare",      baseHp: 102, cls: "melee",  proficiency: { atk: 14, rng: 0, mag: 0, agil: 4, mdef: 26, rdef: 20, magdef: 22 },
    flavour: "A slug of green slime with a mouth that never stops melting. What it swallows, it keeps." },
  { id: "dreadpox",        name: "Dreadpox",        rarity: "epic",      baseHp: 125, cls: "magic",  proficiency: { atk: 6, rng: 0, mag: 30, agil: 10, mdef: 22, rdef: 20, magdef: 28 },
    flavour: "A skeleton in a plague mask, shaking a dreamcatcher hung with feathers. The sickness it catches, it sends back worse." },
  { id: "pale_rider",      name: "The Pale Rider",  rarity: "legendary", baseHp: 140, cls: "melee",  proficiency: { atk: 40, rng: 0, mag: 36, agil: 24, mdef: 22, rdef: 20, magdef: 24 },
    flavour: "A rider on a rotting horse, scythe in one hand and a plague in the other. Where it rides, nothing grows." },
];

// A creature's V2 moves. The first 4 are its starting moves (the user,
// 2026-10-26), all in its main style: the Balanced light move, its race's
// medium move, a fourth, and its race's quick (priority) move. The fourth:
// a second race's medium move; else, for a hybrid, its race's medium move
// in its second style; else its race's heavy move.
// The rest of its kits follow, so they can be picked into slots.
export function v2Moves(c: { id: string; cls: CombatClass }): Skill[] {
  const [r1, r2] = SPECIES_RACES[c.id] ?? [];
  if (!r1) return [];
  const styles = ARCHETYPE_INFO[SPECIES_ARCHETYPE[c.id] ?? "bruiser"].styles;
  const main = c.cls;
  const second = styles.find((s) => s !== main);
  const fourth = r2 ? kitMoveFor(r2, main, "medium") : second ? kitMoveFor(r1, second, "medium") : kitMoveFor(r1, main, "heavy");
  const start: Skill[] = [kitMoveFor(r1, main, "light"), kitMoveFor(r1, main, "medium"), fourth, kitMoveFor(r1, main, "quick")];
  const rest = [r1, r2].filter(Boolean).flatMap((r) => [main, ...(second ? [second] : [])].flatMap((s) => kitFor(r!, s)));
  return [...new Map([...start, ...rest].map((m) => [m.name, m])).values()];
}

// Today's creatures that fight in another style in V2 (the user and Claude,
// 2026-10-26, to even out the archetypes). Their main % moves to the new
// style, so the total stays the same; a new hybrid splits it across both.
export const V2_RESTYLE: Record<string, Pick<CreatureTemplate, "cls" | "proficiency">> = {
  // A melee Ranger now: fangs first, webs second (was ranged).
  hollow_matriarch: { cls: "melee", proficiency: { atk: 40, rng: 24, mag: 0, agil: 30, mdef: 24, rdef: 22, magdef: 23 } },
  // Magic, not ranged (the user).
  the_watcher:      { cls: "magic", proficiency: { atk: 10, rng: 0, mag: 42, agil: 12, mdef: 10, rdef: 16, magdef: 20 } },
  // A Warden: crystal magic, not fists.
  crystal_golem:    { cls: "magic", proficiency: { atk: 6, rng: 0, mag: 28, agil: 4, mdef: 32, rdef: 20, magdef: 26 } },
  // A Spellbow: it hurls the dust it's made of.
  dustwraith:       { cls: "magic", proficiency: { atk: 6, rng: 6, mag: 14, agil: 32, mdef: 4, rdef: 8, magdef: 6 } },
};

