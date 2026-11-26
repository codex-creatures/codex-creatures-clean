// lib/world/creatures.ts
// Creatures' sizes in the world (docs/world-spec.md §2): a size class sets a
// creature's footprint and its height range, from its intended physical
// proportions, not its sprite (the user, 2026-11-07). One that doesn't fit a
// class gets its own size (SPECIES_SIZE's { w, d, height }).
//
// Set by the user (2026-11-08, world-spec §3 "Sizes"), in subcells. Read by
// the placer only (footprints and spawn room). From world version 19 a species' class follows its look
// size instead (lib/creatures/sizes.ts, the user, 2026-11-26: "this new decision should override the
// previous"); SPECIES_SIZE is kept as it was for runs made before (v4–v18).

import type { SizeClass } from "./objects";
import { CREATURE_SIZE, type CreatureSize as LookSize } from "../creatures/sizes";

// (v19) The world version from which a species' class is its look size's.
export const LOOK_SIZES_V = 19;

export type CreatureSize = { w: number; d: number; height: number }; // subcells, subcells, u

export const SIZE_CLASSES: Record<SizeClass, { footprint: { w: number; d: number }; height: [number, number] }> = {
  tiny: { footprint: { w: 1, d: 1 }, height: [0.4, 0.8] },
  small: { footprint: { w: 2, d: 2 }, height: [0.8, 1.2] },
  medium: { footprint: { w: 3, d: 3 }, height: [1.2, 1.8] },
  large: { footprint: { w: 5, d: 5 }, height: [1.8, 3] },
  huge: { footprint: { w: 8, d: 8 }, height: [3, 5] },
};

// Each species' class (or own size) up to world version 18. Missing: small.
export const SPECIES_SIZE: Record<string, SizeClass | CreatureSize> = {
  dust_sprite: "tiny", flicker_wisp: "tiny", gleamling: "tiny", rotgut_fly: "tiny", amber_wasp: "tiny", plague_rat: "tiny", glob: "tiny",
  moss_wolf: "small", bellow_toad: "small", cave_bat: "small", rust_beetle: "small", flame_imp: "small", crystalback: "small", deep_angler: "small", klutz: "small",
  dire_wolf: "medium", veilstalker: "medium", the_watcher: "medium", dreadpox: "medium", shambler: "medium", dustwraith: "medium", mr_shadows: "medium",
  thicket_archer: "medium", leafblade_scout: "medium", swamp_witch: "medium", sylvaran: "medium", rattlebones: "medium", ironhide: "medium",
  crystal_golem: "large", hollow_matriarch: "large", void_serpent: "large", tunnel_wyrm: "large", thunderhead: "large", pale_rider: "large", storm_phoenix: "large", aurelius: "large",
  skinwing: "small", gutsnout: "small", grub_keeper: "small", mole_hag: "small", gloom_gnome: "tiny", hexed_puppet: "small", labyrinth_sprite: "tiny",
  cinder_husk: "medium", troglodyte_brute: "medium", gravewarden: "medium",
  baby_cyclops: "medium",
  cyclops: "huge", hydra: "huge", hydra_spitter: "huge", hydra_hex: "huge", hydra_fang: "huge", // (the hydra: one beast, each head its own fighter)
  minotaur: "huge",
};

// (v19) Each look size's class. A big beast (4) takes a medium's room, a tunnel's width: as large, a
// chief's fixed stand had no room for it in some rooms (the placer's sweep, 2026-11-26). Size 5 is large, as
// the old large ones were; the bosses stay huge whatever their look size (the Hydra's heads are the whole beast).
export const LOOK_CLASS: Record<LookSize, SizeClass> = { 1: "tiny", 2: "small", 3: "medium", 4: "medium", 5: "large" };
const HUGE = new Set(["cyclops", "hydra", "hydra_spitter", "hydra_hex", "hydra_fang", "minotaur"]);

// A species' class (or own size) in a run of world version v (the newest when not given).
function classOf(species: string, v = LOOK_SIZES_V): SizeClass | CreatureSize {
  if (v < LOOK_SIZES_V) return SPECIES_SIZE[species] ?? "small";
  if (HUGE.has(species)) return "huge";
  const look = CREATURE_SIZE[species];
  return look ? LOOK_CLASS[look] : SPECIES_SIZE[species] ?? "small";
}

// A species' footprint and height: its own size, or its class's (the middle of the range).
export function creatureSize(species: string, v?: number): CreatureSize {
  const s = classOf(species, v);
  if (typeof s !== "string") return s;
  const c = SIZE_CLASSES[s];
  return { ...c.footprint, height: (c.height[0] + c.height[1]) / 2 };
}
export const sizeClassOf = (species: string, v?: number): SizeClass | null => {
  const s = classOf(species, v);
  return typeof s === "string" ? s : null;
};
