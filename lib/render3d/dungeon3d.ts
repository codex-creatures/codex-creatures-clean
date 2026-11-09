// lib/render3d/dungeon3d.ts
// 🧪 The 3D prototype's world-to-geometry rules (components/WalkView3D.tsx, /lab/three): which
// tiles get a floor, which get a wall block, and how bright each shows from what you've seen.
// Pure, so it's tested (tests/dungeon3d.test.ts) without a GPU. Nothing in the game uses it.
//
// One world unit (a panel, world-spec §2) is one unit in 3D: x east, z south (the floorplan's y),
// y up. A tile's centre is at its whole-number (x, z), as positions in the sim are.

import { ROCK, type Floorplan, type Pt } from "../dungeon/floorplan";

// 🧪 How tall a wall block stands (u). The kit's north face is 72 rows for 48 across; at the
// default pitch its rows show as tall as its columns are wide (square pixels) at about this height.
export const WALL_HEIGHT = 2.25;
// 🧪 The camera's pitch above the horizon (radians). asin(0.75): a tile of floor shows 0.75 as
// deep as it's wide, the depth the kit's floor art (48 × 36) was drawn for, so its pixels show square.
export const DEFAULT_PITCH = Math.asin(0.75);

const walkable = (fp: Floorplan, x: number, y: number) => x >= 0 && y >= 0 && x < fp.w && y < fp.h && fp.tiles[y * fp.w + x] !== ROCK;

// The floor to lay (every tile you can stand on), and the wall blocks: rock touching floor,
// diagonals included (so corners close). Rock deeper in is left out: it's never seen.
export function dungeonCells(fp: Floorplan): { floor: Pt[]; walls: Pt[] } {
  const floor: Pt[] = [], walls: Pt[] = [];
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    if (walkable(fp, x, y)) { floor.push({ x, y }); continue; }
    let touches = false;
    for (let dy = -1; dy <= 1 && !touches; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walkable(fp, x + dx, y + dy)) { touches = true; break; }
    if (touches) walls.push({ x, y });
  }
  return { floor, walls };
}

// How bright each tile shows, before the lights: 1 where you've seen it, 0 where you never have
// (it stays black). A wall block shows if any floor beside it has been seen. The lights then do
// the rest: what's lit now is bright, what you only remember falls to the dim ambient.
export function shadeOf(fp: Floorplan, known: Uint8Array): Float32Array {
  const s = new Float32Array(fp.w * fp.h);
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    const i = y * fp.w + x;
    if (walkable(fp, x, y)) { s[i] = known[i] ? 1 : 0; continue; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && walkable(fp, nx, ny) && known[ny * fp.w + nx]) s[i] = 1;
    }
  }
  return s;
}

// A sprite stands upright in the world (so walls in front hide it, and it never leans into the
// wall behind); seen from above at `pitch` it shows shorter, so it's drawn this much taller to
// keep its art's proportions on screen.
export const uprightStretch = (pitch: number) => 1 / Math.cos(pitch);
