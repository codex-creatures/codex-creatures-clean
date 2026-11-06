// lib/sprites/walk.ts
// The walkable Labyrinth's art samples (PixelLab, public/sprites/walk; ids in
// public/sprites/PIXELLAB.md), for /lab/walk's Art toggle and its sample
// picker. Samples only, for the user to choose from: not in the game.

// A tileset: room floors and walls, and the tunnel floor (the same wall).
// Every sheet has the layout in lib/dungeon/tileArt.ts (WANG_TILES).
// Or a kit (PixelLab's building kit, cut into its materials: see KitArt),
// drawn in the three-quarter look of docs/ideas/future-dungeon-direction.png.
export type WalkTiles = { name: string; floor: string; tunnel: string; kit?: KitArt };
// A kit's pieces, at KIT_PX a tile: the floor (KIT_PX × KIT_ROW: the view's
// rows are squashed), a north wall (its top, a pale cap band, the brick face
// down to the floor), the cap band alone (south walls), and the narrow side
// walls' tops, for a wall on a floor's east (right) or west (left).
export type KitArt = { floor: string; north: string; cap: string; east: string; west: string };
export const KIT_PX = 32, KIT_ROW = 24, KIT_NORTH = 57, KIT_CAP = 15, KIT_SIDE = 12;
const KIT_A = "/sprites/walk/kit-a-";
export const WALK_TILES: WalkTiles[] = [
  { name: "Kit: mossy dungeon", floor: `${KIT_A}floor.png`, tunnel: `${KIT_A}floor.png`,
    kit: { floor: `${KIT_A}floor.png`, north: `${KIT_A}north.png`, cap: `${KIT_A}cap.png`, east: `${KIT_A}east.png`, west: `${KIT_A}west.png` } },
  { name: "Mossy brick", floor: "/sprites/walk/tiles-a.png", tunnel: "/sprites/walk/tunnel-a.png" },
  { name: "Ivy blocks", floor: "/sprites/walk/tiles-b.png", tunnel: "/sprites/walk/tiles-b.png" },
];

// A hero: a sheet of CELL-pixel frames, a row per facing (FACINGS: south,
// east, north, west), column 0 standing, then `frames` of walk (0: no walk
// yet, standing only). feet: how far down a frame the feet are, in px.
// shrink: drawn this much smaller than the tiles' pixels (the torch-bearing
// samples are chunkier, so a size to try: 🧪).
export type WalkHero = { name: string; sheet: string; cell: number; frames: number; feet: number; shrink?: number };
export const WALK_HEROES: WalkHero[] = [
  { name: "Sturdy adventurer", sheet: "/sprites/walk/hero-c.png", cell: 68, frames: 0, feet: 54, shrink: 0.75 },
  { name: "Stout delver", sheet: "/sprites/walk/hero-d.png", cell: 68, frames: 0, feet: 55, shrink: 0.75 },
  { name: "Cloaked torchbearer", sheet: "/sprites/walk/hero-e.png", cell: 80, frames: 6, feet: 70, shrink: 0.75 },
  { name: "Hooded ranger (old)", sheet: "/sprites/walk/hero-a.png", cell: 48, frames: 6, feet: 40 },
  { name: "Torchbearer (old)", sheet: "/sprites/walk/hero-b.png", cell: 48, frames: 6, feet: 40 },
];

// What the game uses (the Labyrinth's "New"; the user's picks, 2026-11-06):
// the mossy kit, and the cloaked torchbearer.
export const WALK_KIT: KitArt = WALK_TILES[0].kit!;
export const WALK_HERO: WalkHero = WALK_HEROES.find((h) => h.sheet.endsWith("hero-e.png"))!;

// Things standing in the walk's rooms (PixelLab map objects, low top-down;
// ids in PIXELLAB.md), drawn `size` px wide at 16px tiles: a camp's cages,
// shut and opened, and a healing pool (its very faint glow is drawn over it).
export type WalkProp = { src: string; w: number; h: number; size: number };
export const WALK_CAGE: WalkProp = { src: "/sprites/walk/cage.png", w: 48, h: 48, size: 22 };
export const WALK_CAGE_OPEN: WalkProp = { src: "/sprites/walk/cage-open.png", w: 48, h: 48, size: 22 };
export const WALK_POOL: WalkProp = { src: "/sprites/walk/healing-pool.png", w: 64, h: 48, size: 40 };
// The card witch (an old crone with a stick), hobbling about her room (PixelLab character, a sheet like the
// hero's: rows south, east, north, west mirrored; column 0 standing, then 6 of
// walk). tall: her height in the cell, px (she's drawn NPC_PX tall: WalkView).
export const WALK_WITCH = { sheet: "/sprites/walk/witch.png", cell: 67, frames: 6, feet: 65, tall: 60 };
// A campfire (PixelLab map object: logs stacked in a teepee in a ring of
// stones, burning), and the same burnt down to embers; flickering glow and a
// tongue of flame are drawn over it (WalkView).
export const WALK_CAMPFIRE: WalkProp = { src: "/sprites/walk/campfire.png", w: 48, h: 48, size: 24 };
export const WALK_CAMPFIRE_OUT: WalkProp = { src: "/sprites/walk/campfire-out.png", w: 48, h: 48, size: 24 };
// A candle standing on the floor (PixelLab map object, trimmed; the unlit one
// is the same with its flame taken off, a wick left), drawn `size` px wide.
export const WALK_CANDLE: WalkProp = { src: "/sprites/walk/candle.png", w: 15, h: 28, size: 7 };
export const WALK_CANDLE_LIT: WalkProp = { src: "/sprites/walk/candle-lit.png", w: 15, h: 28, size: 7 };

// 🚧 Decor samples (2026-11-06, /lab/newrun's Decor switch only, for the user
// to judge; lib/dungeon/decor.ts places them): PixelLab map objects matched
// to the kit's floor, trimmed, drawn `size` px wide. And worn floor tiles
// (the kit's floor, edited: cracks, chips, moss), mixed in at random.
export const WALK_DECOR: Record<"barrels" | "crates" | "skull" | "nest" | "pots" | "pillar", WalkProp> = {
  barrels: { src: "/sprites/walk/decor/barrels.png", w: 35, h: 26, size: 20 },
  crates: { src: "/sprites/walk/decor/crates.png", w: 34, h: 42, size: 16 },
  skull: { src: "/sprites/walk/decor/bones.png", w: 22, h: 33, size: 11 },
  nest: { src: "/sprites/walk/decor/nest.png", w: 29, h: 28, size: 15 },
  pots: { src: "/sprites/walk/decor/pots.png", w: 26, h: 26, size: 12 },
  pillar: { src: "/sprites/walk/decor/pillar.png", w: 37, h: 33, size: 24 },
};
export const WALK_FLOOR_WORN: string[] = Array.from({ length: 12 }, (_, i) => `/sprites/walk/floor-worn-${i}.png`);
// Worn north wall faces (the kit's, edited: cracks, chips, cobwebs, ivy),
// each two tiles wide (KIT_PX × 2 by KIT_NORTH), and a banner hung on a wall.
export const WALK_WALL_WORN: string[] = Array.from({ length: 3 }, (_, i) => `/sprites/walk/wall-worn-${i}.png`);
export const WALK_BANNER: WalkProp = { src: "/sprites/walk/decor/banner.png", w: 32, h: 43, size: 14 };
