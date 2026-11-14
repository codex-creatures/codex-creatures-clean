// lib/sprites/walk.ts
// The walkable Labyrinth's art samples (PixelLab, public/sprites/walk; ids in
// public/sprites/PIXELLAB.md), for /lab/walk's Art toggle and its sample
// picker. Samples only, for the user to choose from: not in the game.

// A tileset: room floors and walls, and the tunnel floor (the same wall).
// Every sheet has the layout in lib/dungeon/tileArt.ts (WANG_TILES).
// Or a kit (PixelLab's building kit, cut into its materials: see KitArt),
// drawn in the three-quarter look of docs/ideas/future-dungeon-direction.png.
export type WalkTiles = { name: string; floor: string; tunnel: string; kit?: KitArt };
// A kit's pieces, at size.px art pixels a tile: the floor (px × row: the
// view's rows are squashed), a north wall (its top, a pale cap band, the face
// down to the floor: north tall), the cap band alone (south walls: cap tall),
// and the narrow side walls' tops (side wide), for a wall on a floor's east
// (right) or west (left). corners (optional): a room's corner pieces, so a side
// wall's top turns into the back wall's cap and the south band as one L: nw
// and ne (side × north) stand in the rock beside a north wall's ends, sw and se
// (side × cap) where the south band meets a side wall. Without them a corner
// is the pieces butted together. edges (optional): the floor's edge by a
// wall, shading into the wall's stone, as overlays drawn over a floor tile
// (n: a wall above it; w: a wall to its left; flipped for one below or to the
// right, and drawn together where a floor has walls on two sides or more).
export type KitSize = { px: number; row: number; north: number; cap: number; side: number };
export type KitArt = { floor: string; north: string; cap: string; east: string; west: string; size: KitSize;
  corners?: { nw: string; ne: string; sw: string; se: string };
  edges?: { n: string; w: string };
  worn?: { floors: string[]; walls: string[] };
  lights?: KitLights };
// The lights drawn in the kit's style (PixelLab, round 3: PIXELLAB.md), at its art size: a wall torch
// (its head, where the flame burns, `head` px down its middle) and a floor candle cluster (its three
// wicks, px from its top left). Unlit pictures: the flames are drawn over them in code (scene.ts).
export type KitLights = { torch: string; torchSize: [number, number]; head: number; candles: string; candleSize: [number, number]; wicks: [number, number][] };
export const KIT_LIGHTS: KitLights = { torch: "/sprites/walk/wall-torch.png", torchSize: [24, 48], head: 4,
  candles: "/sprites/walk/candles.png", candleSize: [32, 40], wicks: [[19, 6], [9.5, 11], [16, 20]] };
// Floor life (the user, 2026-11-14): the puddle (laid flat; its water is the bluest pixels), the rat (drawn
// from above, head down the picture) and the mouse hole (on the wall's foot), with their art sizes.
export const FLOOR_LIFE = { puddle: "/sprites/walk/floor-life/puddle.png", puddleSize: [64, 48], rat: "/sprites/walk/floor-life/rat.png", ratSize: [48, 36],
  hole: "/sprites/walk/floor-life/mouse-hole-cut.png", holeSize: [24, 24] } as const;
// The first kit's sizes, and the art density of you and the things in the walk (objects.ts), which
// stays at KIT_PX a unit whatever kit the walls are drawn with.
export const KIT_PX = 32, KIT_ROW = 24, KIT_NORTH = 57, KIT_CAP = 15, KIT_SIDE = 12;
const KIT_A = "/sprites/walk/kit-a-", KIT_E = "/sprites/walk/kit-e-", KIT_F = "/sprites/walk/kit-f-";
export const WALK_TILES: WalkTiles[] = [
  // Kit F (2026-11-09, to try): kit E with its wall tops' stone toned down (the user: the cap trim stood
  // out too much), and the floor shading into the walls at its edges (PixelLab inpaints: PIXELLAB.md).
  { name: "Kit: dark fieldstone, soft edges", floor: `${KIT_F}floor.png`, tunnel: `${KIT_F}floor.png`,
    kit: { floor: `${KIT_F}floor.png`, north: `${KIT_F}north.png`, cap: `${KIT_F}cap.png`, east: `${KIT_F}east.png`, west: `${KIT_F}west.png`,
      size: { px: 48, row: 36, north: 87, cap: 15, side: 20 },
      corners: { nw: `${KIT_F}nw.png`, ne: `${KIT_F}ne.png`, sw: `${KIT_F}sw.png`, se: `${KIT_F}se.png` },
      edges: { n: `${KIT_F}edge-n.png`, w: `${KIT_F}edge-w.png` }, lights: KIT_LIGHTS } },
  // Kit E (the user's pick, 2026-11-09): dark crumbling fieldstone, 48 a tile, a mossy cobbled floor,
  // and corner pieces cut from its own walls (PIXELLAB.md).
  { name: "Kit: dark fieldstone", floor: `${KIT_E}floor.png`, tunnel: `${KIT_E}floor.png`,
    kit: { floor: `${KIT_E}floor.png`, north: `${KIT_E}north.png`, cap: `${KIT_E}cap.png`, east: `${KIT_E}east.png`, west: `${KIT_E}west.png`,
      size: { px: 48, row: 36, north: 87, cap: 15, side: 20 },
      corners: { nw: `${KIT_E}nw.png`, ne: `${KIT_E}ne.png`, sw: `${KIT_E}sw.png`, se: `${KIT_E}se.png` }, lights: KIT_LIGHTS } },
  { name: "Kit: mossy dungeon", floor: `${KIT_A}floor.png`, tunnel: `${KIT_A}floor.png`,
    kit: { floor: `${KIT_A}floor.png`, north: `${KIT_A}north.png`, cap: `${KIT_A}cap.png`, east: `${KIT_A}east.png`, west: `${KIT_A}west.png`,
      size: { px: KIT_PX, row: KIT_ROW, north: KIT_NORTH, cap: KIT_CAP, side: KIT_SIDE },
      worn: { floors: Array.from({ length: 12 }, (_, i) => `/sprites/walk/floor-worn-${i}.png`), walls: Array.from({ length: 3 }, (_, i) => `/sprites/walk/wall-worn-${i}.png`) } } },
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

// What the game uses (the Labyrinth's "New"; the user's picks): kit F, kit E's dark fieldstone
// softened (2026-11-09, to try: kit E, WALK_TILES[1], is the one to go back to), and the cloaked torchbearer.
export const WALK_KIT: KitArt = WALK_TILES[0].kit!;
export const WALK_HERO: WalkHero = WALK_HEROES.find((h) => h.sheet.endsWith("hero-e.png"))!;
// The 3D walk's hero since 2026-11-14 (the user: "wandering with your torch held out in front"): the
// same cloaked torchbearer redrawn in all eight directions (PixelLab character 67704aec, PIXELLAB.md),
// a still a way (FACINGS8), cell × cell px, feet that far down; drawn at KIT_PX a unit as the old one.
// No walk yet: the 3D view bobs it a little as you walk (WALK_BOB). The 2D view keeps WALK_HERO.
export const WALK_HERO8 = { dir: "/sprites/walk/hero-8", cell: 96, feet: 69 } as const;
export const WALK_BOB = 0.05; // u up at the top of each step 🧪

// Things standing in the walk's rooms (PixelLab map objects, low top-down;
// ids in PIXELLAB.md), drawn `size` px wide at 16px tiles: a camp's cages,
// shut and opened, and a healing pool (its very faint glow is drawn over it).
export type WalkProp = { src: string; w: number; h: number; size: number };
export const WALK_CAGE: WalkProp = { src: "/sprites/walk/cage.png", w: 48, h: 48, size: 22 };
export const WALK_CAGE_OPEN: WalkProp = { src: "/sprites/walk/cage-open.png", w: 48, h: 48, size: 22 };
export const WALK_POOL: WalkProp = { src: "/sprites/walk/healing-pool.png", w: 64, h: 48, size: 40 };
// A library's broken bookcases and its locator lectern (decision 39): the Den's battered bookcase and lectern art.
export const WALK_BOOKCASE: WalkProp = { src: "/sprites/den/bookcase-2.png", w: 76, h: 86, size: 30 };
export const WALK_LECTERN: WalkProp = { src: "/sprites/den/lectern.png", w: 48, h: 56, size: 20 };
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
