// lib/world/creatures.ts
// Creatures' sizes in the world (docs/world-spec.md §2): a size class sets a
// creature's footprint and its height range, from its intended physical
// proportions, not its sprite (the user, 2026-11-07). One that doesn't fit a
// class gets its own size (SPECIES_SIZE's { w, d, height }).
//
// Set by the user (2026-11-08, world-spec §3 "Sizes"), in subcells. Read by
// nothing in play yet (nothing walks bigger than a panel in phase 2b): the walk screen still draws every foe
// FOE_U tall (lib/world/objects.ts, a legacy draw size), so nothing moves;
// these take over when creature art is redone to the standard.

import type { SizeClass } from "./objects";

export type CreatureSize = { w: number; d: number; height: number }; // subcells, subcells, u

export const SIZE_CLASSES: Record<SizeClass, { footprint: { w: number; d: number }; height: [number, number] }> = {
  tiny: { footprint: { w: 1, d: 1 }, height: [0.4, 0.8] },
  small: { footprint: { w: 2, d: 2 }, height: [0.8, 1.2] },
  medium: { footprint: { w: 3, d: 3 }, height: [1.2, 1.8] },
  large: { footprint: { w: 5, d: 5 }, height: [1.8, 3] },
  huge: { footprint: { w: 8, d: 8 }, height: [3, 5] },
};

// Each species' class (or own size). Missing: small.
export const SPECIES_SIZE: Record<string, SizeClass | CreatureSize> = {
  dust_sprite: "tiny", flicker_wisp: "tiny", gleamling: "tiny", rotgut_fly: "tiny", amber_wasp: "tiny", plague_rat: "tiny", glob: "tiny",
  moss_wolf: "small", bellow_toad: "small", cave_bat: "small", rust_beetle: "small", flame_imp: "small", crystalback: "small", deep_angler: "small", klutz: "small",
  dire_wolf: "medium", veilstalker: "medium", the_watcher: "medium", dreadpox: "medium", shambler: "medium", dustwraith: "medium", mr_shadows: "medium",
  thicket_archer: "medium", leafblade_scout: "medium", swamp_witch: "medium", sylvaran: "medium", rattlebones: "medium", ironhide: "medium",
  crystal_golem: "large", hollow_matriarch: "large", void_serpent: "large", tunnel_wyrm: "large", thunderhead: "large", pale_rider: "large", storm_phoenix: "large", aurelius: "large",
  baby_cyclops: "medium",
  cyclops: "huge", hydra_spitter: "huge", hydra_hex: "huge", hydra_fang: "huge", // (the hydra: one beast, each head its own fighter)
};

// A species' footprint and height: its own size, or its class's (the middle of the range).
export function creatureSize(species: string): CreatureSize {
  const s = SPECIES_SIZE[species] ?? "small";
  if (typeof s !== "string") return s;
  const c = SIZE_CLASSES[s];
  return { ...c.footprint, height: (c.height[0] + c.height[1]) / 2 };
}
export const sizeClassOf = (species: string): SizeClass | null => {
  const s = SPECIES_SIZE[species] ?? "small";
  return typeof s === "string" ? s : null;
};
