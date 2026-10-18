// lib/sprites/creatures.ts
// Creature sprites, keyed by creature id. Each scannable creature and Klutz
// has PixelLab art (lib/sprites/art.ts, see ART_SIZES), over a grid drawn in
// code that stays as the fallback (lib/sprites/bestiary.ts; Klutz's 44×44
// grid is here). The Cyclops parts are 28-wide drawn pixels (BossStage
// reshapes the body).
// Creatures without one yet show a rune egg instead (see EGG).

import { fine, type Sprite } from "./pixels";
import { BESTIARY } from "./bestiary";
import { withArt } from "./art";

export const CREATURE_SPRITES: Record<string, Sprite> = {
  ...BESTIARY,
  // PixelLab art (69×85, with an 8-frame walk), over a fine-grid fallback (44×44).
  klutz: withArt(fine([
    "............................................",
    "............................................",
    "............................................",
    ".................eNNNNNNNNe.................",
    "...............eENNNNNNNNNNEe...............",
    ".............eEENNNNNNNNNNNNEEe.............",
    ".ff........eEEENNNNNNNNNNNNNNEEEe........ff.",
    ".fEf......eEEEEENNNNNNNNNNNNEEEEEe......fEf.",
    ".fEzEf...eEEEEEEEEEEEEEEEEEEEEEEEEe...fEzEf.",
    "fEzzEf..eEEEEOOOOOEEEEEEEEOOOOOEEEEe..fEzzEf",
    ".eEzzEeeeEEOOhhhhhOOEEEEOOhhhhhOOEEeeeEzzEe.",
    "..eEzEeeeEEOhhkkkkhOEEEEOhkkkkhhOEEeeeEzEe..",
    "...eeEeeeEEOhhkhkkhOEEEEOhkhkkhhOEEeeeEee...",
    ".....eeeeEEOhhkkkkhOEEEEOhkkkkhhOEEeeee.....",
    "........eEEOOhhhhhOOEEEEOOhhhhhOOEEe........",
    "........eEEEEOOOOOEEEEEEEEOOOOOEEEEe........",
    ".........eEEEEEEEEEEEffEEEEEEEEEEEe.........",
    ".........eEEEEEEEEEEfOOfEEEEEEEEEEe.........",
    "..........eEEEfOOOOOOOOOOOOOOfEEEe..........",
    "..........eEEEOhhOOOOOOOOOOhhOEEEe..........",
    "..........eEEEfOhOOzzzzzzOOhOfEEEe..........",
    "...........eEEEEffOOOOOOOOffEEEEe...........",
    "............eeEEEEEffffffEEEEEee............",
    "..............ffeeeeeeeeeeeeff..............",
    ".........lLLLLLLLLLLLLLLLLLLLLLLLLl.........",
    "........llLLLLLLLLLLLLLLLLLLLLLLLLll........",
    ".....eeellLLLLLLLLLLLLLLLLLLLLLLLLlleee.....",
    "...eeeeellLLLLLLLLLLLLLLLLLLLLLLLLlleeeee...",
    "...eEEeellLLLLLLLEEEEEEEEEELLLLLLLlleeEEe...",
    "..eeEEeellLLLLLENNNEEEEEEEEEELLLLLlleeEEee..",
    "..eeEEeellLLLLLENNEEEEEEEEEEELLLLLlleeEEee..",
    "..eeEEeellLLLLEEEEEEEEEEEEEEEELLLLlleeEEee..",
    "..eeeee.llLLLLEEEEEEEEEEEEEEEELLLLll.eeeee..",
    "...ee...llLLLLLEEEEEEffEEEEEELLLLLll...ee...",
    "........llLLLLLEEEEEEEEEEEEEELLLLLll........",
    "........llLLLLLLEEEEEEEEEEEELLLLLLll........",
    "........mmmmmmmmmmmmgGGgmmmmmmmmmmmm........",
    ".........mmmmmmmmmmmggggmmmmmmmmmmm.........",
    "............llLLLLll....llLLLLll............",
    "............llLLLLl......lLLLLll............",
    "...........eEEEEee........eeEEEEe...........",
    ".........eeEEEEEee........eeEEEEEee.........",
    "........eeeEEEEEee........eeEEEEEeee........",
    "........efEfEfEEe..........eEEfEfEfe........",
  ]), {
    src: "/sprites/creatures/klutz.png", w: 69, h: 85, faces: "right",
    walk: { src: "/sprites/creatures/klutz-walk.png", frames: 8, w: 96, h: 96, x: 13, y: 7 },
  }),
  // ── The Cyclops (dungeon 1 boss): body, crawling hand, eye ──
  cyclops: [
    "..........DDvvvvDD..........",
    ".........DvvVVVVvvD.........",
    "........DvVVVVVVVVvD........",
    "........vDDDDDDDDDDv........",
    "........vVhhrrrrhhVv........",
    "........vVhrRkkRrhVv........",
    "........vVhrRkhRrhVv........",
    "........vVhhrrrrhhVv........",
    "........vVVhhhhhhVVv......wW",
    "........DvVVVVVVVVvD.....wWWw",
    "........DvkhkhkhkkvD.....wWWw",
    ".........DvvvvvvvvD.....wWWw.",
    ".....DDvvvvvvvvvvvvvvDD.wWWw.",
    "....DvVVvvvvvvvvvvvvVVvDwWw..",
    "...DvVVv.DvvVVVVvvD.vVVvwWw..",
    "...vVVv..vvVVVVVVvv..vVVwWw..",
    "...vVVv..vvvVVVVvvv..vVVWw...",
    "...vVVv..DvvvvvvvvD..vVVWw...",
    "...vVvD..lLLLLLLLLl..DvVVv...",
    "...DvvD..llLllllLll..DvvD....",
    "....DD...lmlmlmlmlm...DD.....",
    "..........vvv..vvv..........",
    "..........vVv..vVv..........",
    "..........vVv..vVv..........",
    ".........DvvD..DvvD.........",
    "........DDDDD..DDDDD........",
  ],
  cyclops_hand: [
    "......xxxx......",
    "......rRRr......",
    ".....vVVVVv.....",
    "....vVVVVVVv....",
    "...vVVVVVVVVv...",
    "...vVVVVVVVVvvv.",
    "...vVvVvVvVv.vVv",
    "...v.v.v.v.v..vD",
    "..Dv.v.v.v.vD..h",
    "..h..h.h.h..h...",
  ],
  cyclops_eye: [
    ".....hhhhhh.....",
    "...hhhhhhhhhh...",
    "..hhrhhhhhhhhh..",
    ".hhhhrhRRRRhhhh.",
    ".hhhhhRRRRRRhhh.",
    "hhhhhRRkkkkRRhhh",
    "hrhhhRRkhkkRRhhh",
    "hhrhhRRkkkkRRhIh",
    "hhhhhRRkkkkRRhIh",
    ".hhhhhRRRRRRhIh.",
    ".hhrhhhRRRRhhIh.",
    "..hhhhhhhhhhII..",
    "...IhhhhhhhII...",
    ".....IIxxII.....",
    ".......xx.......",
    "......xx........",
    ".......x........",
  ],
};

// PixelLab art for the scannable roster (public/sprites/creatures/<id>.png),
// facing left like the grids; each creature's grid stays as its fallback.
// [width, height] of each image.
const ART_SIZES: Record<string, [number, number]> = {
  // The Cyclops (dungeon 1 boss), redrawn as the Baby Cyclops' parent: body, a hand, the eye.
  cyclops: [119, 118],
  cyclops_hand: [87, 80],
  cyclops_eye: [54, 88],
  moss_wolf: [82, 65],
  amber_wasp: [62, 55],
  monkey_mage: [63, 73],
  dire_wolf: [112, 111],
  ironhide: [122, 87],
  cave_bat: [58, 50],
  rust_beetle: [81, 68],
  crystalback: [85, 72],
  crystal_golem: [121, 117],
  hollow_matriarch: [124, 106],
  dust_sprite: [54, 50],
  flicker_wisp: [55, 38],
  veilstalker: [85, 83],
  the_watcher: [68, 81],
  void_serpent: [110, 96],
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
const FACING_RIGHT = new Set(["void_serpent"]);
// Those that float rather than stand: drawn hanging in the air, bobbing.
const FLOATERS = new Set(["flicker_wisp", "dust_sprite", "the_watcher", "dustwraith", "cave_bat", "amber_wasp", "storm_phoenix"]);
for (const [id, [w, h]] of Object.entries(ART_SIZES)) {
  if (CREATURE_SPRITES[id]) withArt(CREATURE_SPRITES[id], { src: `/sprites/creatures/${id}.png`, w, h, ...(FLOATERS.has(id) ? { floats: true } : {}), ...(FACING_RIGHT.has(id) ? { faces: "right" as const } : {}) });
}


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

// The first quest's thief (PixelLab art; no grid of its own, so the egg is its fallback).
CREATURE_SPRITES.baby_cyclops = withArt([...EGG], { src: "/sprites/creatures/baby_cyclops.png", w: 66, h: 83, faces: "right" });
