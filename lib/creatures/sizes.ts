// lib/creatures/sizes.ts
// How big each creature is, 1 to 5 (the user's sorting, 2026-11-26; 2026-11-27: the Troglodyte Brute up to 5,
// the Glob, wide and low, down to 2). Looks only:
// no stats or rules read it. It sets how tall a creature stands where it's seen
// whole: wandering the Labyrinth and in the Pit's creature window. Cards keep
// their picture filling the card. (Every creature's art is cropped to its body,
// so its height on screen is the creature's own.)
//   1 tiny (a wisp) · 2 small · 3 person-sized · 4 big beast · 5 huge, or a rider on a mount

export type CreatureSize = 1 | 2 | 3 | 4 | 5;

export const DEFAULT_SIZE: CreatureSize = 3; // one with no size yet stands person-sized

// Each size's height as a share of size 5's (🧪 first guesses, to tune by eye).
export const SIZE_HEIGHT: Record<CreatureSize, number> = { 1: 0.25, 2: 0.42, 3: 0.62, 4: 0.8, 5: 1 };

const BY_SIZE: Record<CreatureSize, string[]> = {
  1: ["dust_sprite", "gleamling", "flicker_wisp", "labyrinth_sprite", "cyclops_hand"],
  2: ["cave_bat", "gutsnout", "moss_wolf", "plague_rat", "rattlebones", "skinwing", "thicket_archer", "amber_wasp",
    "flame_imp", "gloom_gnome", "mole_hag", "rotgut_fly", "rust_beetle", "klutz", "cyclops_eye", "glob"],
  3: ["grub_keeper", "leafblade_scout", "shambler", "bellow_toad", "cinder_husk", "deep_angler", "veilstalker",
    "dreadpox", "mr_shadows", "swamp_witch", "the_watcher", "hollow_matriarch", "storm_phoenix", "sylvaran",
    "hydra_fang", "hydra_hex", "hydra_spitter"],
  4: ["baby_cyclops", "crystalback", "dustwraith", "gravewarden", "hexed_puppet", "tunnel_wyrm",
    "thunderhead", "void_serpent", "dire_wolf"],
  5: ["aurelius", "crystal_golem", "ironhide", "pale_rider", "cyclops", "minotaur", "troglodyte_brute"],
};

export const CREATURE_SIZE: Record<string, CreatureSize> = Object.fromEntries(
  (Object.entries(BY_SIZE) as [string, string[]][]).flatMap(([s, ids]) => ids.map((id) => [id, Number(s) as CreatureSize])),
);

export const sizeOf = (creatureId: string): CreatureSize => CREATURE_SIZE[creatureId] ?? DEFAULT_SIZE;
// Its height as a share of the biggest's.
export const sizeHeight = (creatureId: string) => SIZE_HEIGHT[sizeOf(creatureId)];
// …and a size smaller (a size 1 stays 1): in a boss's lair, so the boss towers (the user, 2026-11-26).
export const smallerHeight = (creatureId: string) => SIZE_HEIGHT[Math.max(1, sizeOf(creatureId) - 1) as CreatureSize];
