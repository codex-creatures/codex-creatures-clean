// lib/sprites/walk.ts
// The walkable Labyrinth's art samples (PixelLab, public/sprites/walk; ids in
// public/sprites/PIXELLAB.md), for /lab/walk's Art toggle and its sample
// picker. Samples only, for the user to choose from: not in the game.

// A tileset: room floors and walls, and the tunnel floor (the same wall).
// Every sheet has the layout in lib/dungeon/tileArt.ts (WANG_TILES).
export type WalkTiles = { name: string; floor: string; tunnel: string };
export const WALK_TILES: WalkTiles[] = [
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
  { name: "Cloaked torchbearer", sheet: "/sprites/walk/hero-e.png", cell: 68, frames: 0, feet: 54, shrink: 0.75 },
  { name: "Hooded ranger (old)", sheet: "/sprites/walk/hero-a.png", cell: 48, frames: 6, feet: 40 },
  { name: "Torchbearer (old)", sheet: "/sprites/walk/hero-b.png", cell: 48, frames: 6, feet: 40 },
];
