// lib/render3d/tiles.ts
// Tile variants (the user, 2026-11-15: "additional texture added to the current art"): instead of a
// picture laid over the floor or a wall, some of the dungeon's own tiles are drawn as a variant of
// themselves, PixelLab's edits of kit F's: the floor with moss in its cracks, the wall with a mouse hole
// at its foot, and the wall with a cobweb in a room's top corner. Each variant differs from the plain
// tile only where it adds something, so it meets its neighbours with no seam.
//
// The game's Stone shader (components/WalkView3D.tsx) lays the art in repeats across the world, not
// tile by tile: a floor or wall picture repeats every 1 u across, starting at whole x (so its middle
// sits on the line between two tiles), and the floor's every 36 / FLOOR_UP u down. So a variant is
// picked by the repeat ("cell") the pixel is in, from two grids worked out here:
// - face: a north wall face's cell (floor(x)) in front of floor row y: FACE codes;
// - moss: a floor cell (floor(x), the n-th repeat down from the top), 1 for moss.
// Pure, from the floor life (decor.ts placeFloorLife) and the seed, so nothing is saved.

import type { Floorplan, Pt } from "../dungeon/floorplan";
import type { RatHole, CobWeb } from "../dungeon/decor";

type Rng = () => number;

// What a wall face's cell shows (the face grid's values).
export const FACE = { plain: 0, hole: 1, webA: 2, webB: 3, webC: 4, webD: 5 } as const;
// The variants' pictures (kit F's: the game's walls).
export const TILE_ART = {
  moss: "/sprites/walk/kit-f-floor-moss.png", hole: "/sprites/walk/kit-f-north-hole.png",
  webA: "/sprites/walk/kit-f-north-web-a.png", webB: "/sprites/walk/kit-f-north-web-b.png",
  webC: "/sprites/walk/kit-f-north-web-c.png", webD: "/sprites/walk/kit-f-north-web-d.png",
};
// Floor repeats: the floor picture's 36 rows at FLOOR_UP texels a unit (stone.ts texelsPerU "up" at the
// game's 48 a unit and 60° pitch: 48 × sin 60°).
export const FLOOR_ROWS = 36;
export const FLOOR_UP = 48 * Math.sin(Math.PI / 3);
// Moss: this share of the floor cells round a puddle (their middles within MOSS_NEAR tiles of it), and
// this share of the rest. 🧪
export const MOSS_BY_PUDDLE = 0.5, MOSS_NEAR = 1.6, MOSS_ANY = 0.03;

// The floor cell (column, row down) a point (x, y in tiles) lies in, and a cell's middle.
export const floorCell = (x: number, y: number): Pt => ({ x: Math.floor(x), y: Math.ceil((y * FLOOR_UP) / FLOOR_ROWS) });
const cellMiddle = (c: Pt): Pt => ({ x: c.x + 0.5, y: ((c.y - 0.5) * FLOOR_ROWS) / FLOOR_UP });
// How many floor rows of cells a plan needs.
export const mossRows = (plan: Floorplan) => Math.ceil((plan.h * FLOOR_UP) / FLOOR_ROWS) + 2;

export function tileVariants(plan: Floorplan, life: { puddles: Pt[]; holes: RatHole[]; webs: CobWeb[] }, rng: Rng): { face: Uint8Array; moss: Uint8Array; mossRows: number } {
  const face = new Uint8Array(plan.w * plan.h), rows = mossRows(plan), moss = new Uint8Array(plan.w * rows);
  const setFace = (x: number, y: number, v: number) => { if (x >= 0 && x < plan.w && y >= 0 && y < plan.h) face[y * plan.w + x] = v; };
  // A hole's picture sits in the middle of its cell: the hole at x + ½ (the rat runs to there).
  for (const h of life.holes) setFace(h.x, h.y, FACE.hole);
  // A web hangs from a room's corner: the line half a tile left (or right) of its corner tile, which is
  // the middle of the cell left of it (or its own): the web's first 24 px there, its last 8 in the next.
  for (const w of life.webs) {
    if (w.side === "left") { setFace(w.x - 1, w.y, FACE.webA); setFace(w.x, w.y, FACE.webB); }
    else { setFace(w.x, w.y, FACE.webC); setFace(w.x - 1, w.y, FACE.webD); }
  }
  for (let r = 0; r < rows; r++) for (let x = 0; x < plan.w; x++) {
    const m = cellMiddle({ x, y: r });
    const near = life.puddles.some((p) => Math.hypot(p.x - m.x, p.y - m.y) < MOSS_NEAR);
    if (rng() < (near ? MOSS_BY_PUDDLE : MOSS_ANY)) moss[r * plan.w + x] = 1;
  }
  return { face, moss, mossRows: rows };
}
