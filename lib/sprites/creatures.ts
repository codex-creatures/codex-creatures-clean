// lib/sprites/creatures.ts
// Creature sprites, keyed by creature id. Each scannable creature, Klutz and
// the bosses have PixelLab art (lib/sprites/art.ts, see ART_SIZES); their
// grid is a single dot, as there's no older drawing to fall back on.
// Creatures without art show a rune egg instead (see EGG).

import type { Sprite } from "./pixels";
import { withArt, artFor } from "./art";

export const CREATURE_SPRITES: Record<string, Sprite> = {};

// PixelLab art for the roster (public/sprites/creatures/<id>.png), facing
// left unless listed in FACING_RIGHT. [width, height] of each image.
const ART_SIZES: Record<string, [number, number]> = {
  // The Cyclops (dungeon 1 boss), redrawn as the Baby Cyclops' parent: body, a hand, the eye.
  cyclops: [119, 118],
  cyclops_hand: [87, 80],
  cyclops_eye: [54, 88],
  moss_wolf: [82, 65],
  amber_wasp: [62, 55],
  bellow_toad: [90, 68],
  dire_wolf: [112, 111],
  ironhide: [122, 87],
  cave_bat: [60, 63], // the Cave Goblin (was the Cave Bat; the id stays for old saves)
  rust_beetle: [81, 68],
  crystalback: [85, 72],
  crystal_golem: [121, 117],
  hollow_matriarch: [124, 106],
  dust_sprite: [54, 50],
  flicker_wisp: [55, 38],
  veilstalker: [85, 83],
  the_watcher: [68, 81],
  void_serpent: [110, 96],
  // Combat V2's new species (lib/creatures/rosterV2.ts).
  flame_imp: [72, 73],
  glob: [78, 63],
  dreadpox: [83, 92],
  gleamling: [52, 58],
  plague_rat: [64, 59],
  rotgut_fly: [62, 62],
  deep_angler: [75, 71],
  tunnel_wyrm: [107, 108],
  thunderhead: [107, 106],
  pale_rider: [105, 123],
  rattlebones: [70, 84],
  shambler: [73, 88],
  dustwraith: [84, 86],
  mr_shadows: [89, 95],
  storm_phoenix: [105, 113],
  thicket_archer: [81, 76],
  leafblade_scout: [73, 81],
  aurelius: [124, 118],
  swamp_witch: [86, 89],
  sylvaran: [71, 94],
};
// Those drawn facing right (the rest face left).
const FACING_RIGHT = new Set(["leafblade_scout", "mr_shadows"]);
// Those that float rather than stand: drawn hanging in the air, bobbing.
const FLOATERS = new Set(["flicker_wisp", "dust_sprite", "the_watcher", "dustwraith", "amber_wasp", "storm_phoenix", "gleamling", "rotgut_fly"]);


// Shown for creatures that don't have their own sprite yet.
export const EGG: Sprite = [
  "......................",
  "......................",
  "......................",
  "......................",
  "........iiiiii........",
  ".......iIIIIIIi.......",
  "......iIIIIIIIIi......",
  ".....iIIIIgIIIIIi.....",
  ".....iIIIggIIIIIi.....",
  "....iIIIIgIgIIIIIi....",
  "....iIIIIgIIgIIIIi....",
  "....iIIIIgggIIIIIi....",
  "....iIIIIIIIIIIIIi....",
  "....iiIIIIIIIIIIii....",
  ".....iiIIIIIIIIii.....",
  "......jiiiiiiiij......",
  ".......jjjjjjjj.......",
];

// Each one's art.
for (const [id, [w, h]] of Object.entries(ART_SIZES)) {
  CREATURE_SPRITES[id] = withArt(["."], { src: `/sprites/creatures/${id}.png`, w, h, ...(FLOATERS.has(id) ? { floats: true } : {}), ...(FACING_RIGHT.has(id) ? { faces: "right" as const } : {}) });
}

// Klutz (69×85, with an 8-frame walk), drawn walking right.
CREATURE_SPRITES.klutz = withArt(["."], {
  src: "/sprites/creatures/klutz.png", w: 69, h: 85, faces: "right",
  walk: { src: "/sprites/creatures/klutz-walk.png", frames: 8, w: 96, h: 96, x: 13, y: 7 },
});

// The first quest's thief.
CREATURE_SPRITES.baby_cyclops = withArt(["."], { src: "/sprites/creatures/baby_cyclops.png", w: 66, h: 83 });

// 🧪 The Hydra's heads (the Deep Labyrinth's boss) borrow the Void Serpent's art
// (BossStage tints them apart) until they have PixelLab art of their own.
for (const id of ["hydra_fang", "hydra_spitter", "hydra_hex"]) CREATURE_SPRITES[id] = CREATURE_SPRITES.void_serpent;

// Seen from behind, for your side of a fight (public/sprites/creatures/back,
// trimmed). Only the user's approved ones; the rest show their usual art,
// mirrored. They're drawn looking away towards the foe, so count as facing right.
const BACK_SIZES: Record<string, [number, number]> = {
  amber_wasp: [55, 54],
  cave_bat: [54, 61],
  crystal_golem: [118, 115],
  deep_angler: [73, 69],
  dire_wolf: [107, 109],
  dreadpox: [82, 89],
  dust_sprite: [48, 50],
  flame_imp: [69, 73],
  glob: [75, 62],
  ironhide: [119, 85],
  mr_shadows: [84, 94],
  swamp_witch: [85, 89],
  thicket_archer: [74, 76],
  thunderhead: [104, 105],
};
export const BACK_SPRITES: Record<string, Sprite> = {};
for (const [id, [w, h]] of Object.entries(BACK_SIZES)) {
  const front = CREATURE_SPRITES[id];
  BACK_SPRITES[id] = withArt([...(front ?? EGG)], { src: `/sprites/creatures/back/${id}.png`, w, h, faces: "right", ...(front && artFor(front)?.floats ? { floats: true } : {}) });
}

// The sprite a creature shows in a fight: from behind on your side when it has one.
export const fightSprite = (id: string, yours: boolean): Sprite | undefined =>
  (yours ? BACK_SPRITES[id] : undefined) ?? CREATURE_SPRITES[id];
