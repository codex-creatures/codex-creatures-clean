// lib/sprites/walk.ts
// The walkable Labyrinth's art samples (PixelLab, public/sprites/walk; ids in
// public/sprites/PIXELLAB.md), for /lab/walk's Art toggle and its sample
// picker. Samples only, for the user to choose from: not in the game.

// A tileset: room floors and walls, the tunnel floor (the same wall), and
// the door arch drawn where a tunnel leaves a room's top wall. Every sheet
// has the layout in lib/dungeon/tileArt.ts (WANG_TILES).
export type WalkTiles = { name: string; floor: string; tunnel: string; door: string };
export const WALK_TILES: WalkTiles[] = [
  { name: "Mossy brick", floor: "/sprites/walk/tiles-a.png", tunnel: "/sprites/walk/tunnel-a.png", door: "/sprites/walk/door-a.png" },
  { name: "Ivy blocks", floor: "/sprites/walk/tiles-b.png", tunnel: "/sprites/walk/tiles-b.png", door: "/sprites/walk/door-a.png" },
];
export const DOOR_SIZE = 48; // px, the door arch (3 tiles: a tunnel's width)

// A hero: a sheet of CELL-pixel frames, a row per facing (FACINGS: south,
// east, north, west), column 0 standing, then the walk. feet: how far down a
// frame the feet are, in px.
export type WalkHero = { name: string; sheet: string; cell: number; frames: number; feet: number };
export const WALK_HEROES: WalkHero[] = [
  { name: "Hooded ranger", sheet: "/sprites/walk/hero-a.png", cell: 48, frames: 6, feet: 40 },
  { name: "Torchbearer", sheet: "/sprites/walk/hero-b.png", cell: 48, frames: 6, feet: 40 },
];
