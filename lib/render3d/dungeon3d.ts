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

// ── 🧪 The grey geometry experiment (world/rendering.md §4.8 "Next experiment") ──
// The dungeon carved out of solid rock: every tile has a height (0 where it's open, the wall's
// height where it's rock), and one mesh is built from the heights: a top on every tile and a
// face wherever two neighbours differ, facing the lower one. North walls' faces look at the
// camera; south walls' faces look away from it, so the camera never draws them.
//
// The heights are presentation only: what rock *shows*. What rock *is* (it blocks walking, sight
// and light) is the floorplan's tiles, which the sim reads (lib/world/walkSim.ts) and this never
// changes. So a wall can be lowered, cut away or hidden here (the low south rim is one) and it
// still blocks exactly as before.

// 🧪 How many rows of rock south of open floor the "low" south rim covers: at 60° a full-height
// wall hides about 0.58 × its height of floor behind it (1.3 u for 2.25 u), so one row isn't enough.
export const SOUTH_BAND = 2;
// 🧪 How high the low south rim stands (u): a lip that says where the room ends, hiding nothing.
export const SOUTH_LIP = 0.25;
// 🧪 How far round the plan the rock goes on (u), so the edge of the world is never seen.
export const ROCK_MARGIN = 24;

// Each tile's height. `open` says which tiles are carved (the lab: walkable and seen, so rock
// never gives away a place you haven't found). With `southLow`, rock just south of open floor
// drops to the lip, unless it's also a north wall (open floor south of it): that keeps its face.
export function rockHeights(fp: Floorplan, open: (i: number) => boolean, wall: number, southLow: boolean): Float32Array {
  const h = new Float32Array(fp.w * fp.h);
  const isOpen = (x: number, y: number) => x >= 0 && y >= 0 && x < fp.w && y < fp.h && open(y * fp.w + x);
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    if (isOpen(x, y)) continue;
    let low = false;
    if (southLow && !isOpen(x, y + 1)) for (let d = 1; d <= SOUTH_BAND; d++) if (isOpen(x, y - d)) low = true;
    h[y * fp.w + x] = low ? SOUTH_LIP : wall;
  }
  return h;
}

// Which way a quad faces: up, or the way its normal points (+z is south).
export type Facing = "up" | "north" | "south" | "east" | "west";
// `tile`: for each quad, the tile it belongs to (a top's first tile; a face's higher, rocky side),
// or -1 past the plan's edge, so a quad can be coloured by what's known of its tile.
export type CarvedMesh = { position: Float32Array; normal: Float32Array; tile: Int32Array; quads: Record<Facing, number> };

// The mesh of a height grid (w × h, rock beyond it to `margin`). Floors get a quad a tile (so
// they can be told apart); rock tops are merged along each row, to keep the triangles down, but
// not across a change in `split` (a value a tile, 0 past the edge: e.g. seen or not).
export function carvedMesh(heights: Float32Array, w: number, h: number, wall: number, margin = ROCK_MARGIN, split?: Uint8Array): CarvedMesh {
  const idx = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  const at = (x: number, y: number) => { const i = idx(x, y); return i < 0 ? wall : heights[i]; };
  const sp = (x: number, y: number) => { const i = idx(x, y); return i < 0 || !split ? 0 : split[i]; };
  const quads: Record<Facing, number> = { up: 0, north: 0, south: 0, east: 0, west: 0 };
  // Two passes over the grid: count the quads, then write them into arrays made to fit.
  let pos = new Float32Array(0), nor = new Float32Array(0), til = new Int32Array(0), k = 0, counting = true;
  // A quad from four corners (a, b, c, d) in order round it, wound so its front faces (nx, ny, nz).
  // (Rebuilt as you explore, so it has to be quick: hence two passes and no growing arrays.)
  const quad = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, nx: number, ny: number, nz: number, f: Facing, ti: number) => {
    quads[f]++;
    if (counting) return;
    til[k / 18] = ti;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    const front = (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz >= 0;
    pos.set(front ? [ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz] : [ax, ay, az, dx, dy, dz, cx, cy, cz, ax, ay, az, cx, cy, cz, bx, by, bz], k);
    for (let i = 0; i < 18; i += 3) { nor[k + i] = nx; nor[k + i + 1] = ny; nor[k + i + 2] = nz; }
    k += 18;
  };
  for (const pass of [0, 1]) {
    if (pass) {
      const n = Object.values(quads).reduce((a, b) => a + b, 0) * 18;
      pos = new Float32Array(n); nor = new Float32Array(n); til = new Int32Array(n / 18); counting = false;
      for (const f of Object.keys(quads) as Facing[]) quads[f] = 0;
    }
    for (let y = -margin; y < h + margin; y++) {
      for (let x = -margin; x < w + margin;) {
        const t = at(x, y);
        let end = x + 1;
        if (t > 0) while (end < w + margin && at(end, y) === t && sp(end, y) === sp(x, y)) end++;
        quad(x - 0.5, t, y - 0.5, end - 0.5, t, y - 0.5, end - 0.5, t, y + 0.5, x - 0.5, t, y + 0.5, 0, 1, 0, "up", idx(x, y));
        x = end;
      }
      for (let x = -margin; x < w + margin; x++) {
        const t = at(x, y), east = at(x + 1, y), south = at(x, y + 1);
        // Between this tile and the one east of it (at x + 0.5), facing the lower.
        if (x + 1 < w + margin && t !== east) {
          const lo = Math.min(t, east), hi = Math.max(t, east), X = x + 0.5, n = t < east ? -1 : 1;
          quad(X, lo, y - 0.5, X, lo, y + 0.5, X, hi, y + 0.5, X, hi, y - 0.5, n, 0, 0, n < 0 ? "west" : "east", t > east ? idx(x, y) : idx(x + 1, y));
        }
        // Between this tile and the one south of it (at y + 0.5).
        if (y + 1 < h + margin && t !== south) {
          const lo = Math.min(t, south), hi = Math.max(t, south), Z = y + 0.5, n = t < south ? -1 : 1;
          quad(x - 0.5, lo, Z, x + 0.5, lo, Z, x + 0.5, hi, Z, x - 0.5, hi, Z, 0, 0, n, n < 0 ? "north" : "south", t > south ? idx(x, y) : idx(x, y + 1));
        }
      }
    }
  }
  return { position: pos, normal: nor, tile: til, quads };
}
