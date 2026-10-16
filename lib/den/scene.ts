// lib/den/scene.ts
// The Den (home screen), drawn as pixel art in code: a large, gloomy cavern
// seen isometrically: two rough rock walls whose ragged tops fade into the
// dark, and a floor whose far edges dissolve into shadow. Clickable objects
// stand around it (see OBJ / ANCHORS).
//
// - The static room (rock, moss, objects) is built once, and so is the
//   lighting: each pixel keeps its light and which torch lights it most.
// - Each frame applies the light (flickering torches, pulsing altar), then
//   draws the animated bits (flames, embers, crystal, pool ripples, the caged
//   creature behind its bars) and the hover outline.
// - Every pixel remembers which object it belongs to, so clicks are
//   pixel-accurate.
// - It's drawn on the fine grid: laid out in W×H units (labels, taps), and
//   rendered at RES× that, each fine pixel sampling its own spot.

import { fineGrid, PALETTE, type Sprite } from "../sprites/pixels";
import type { LoadedArt, Pixels } from "../sprites/art";

export const W = 560;  // layout units
export const H = 448;
export const RES = 2;  // fine pixels per unit: the canvas is W*RES × H*RES
const FW = W * RES, FH = H * RES;

// Isometric layout: 1 floor unit = 32px wide / 16px tall diamond.
const NU = 18;        // floor units along the right wall (v = 0)
const NV = 15;        // floor units along the left wall (u = 0)
const TW = 16;        // half tile width
const TH = 8;         // half tile height
const CX = 16 + NV * TW; // screen x of the back corner
const Y0 = 168;       // screen y of the back corner at floor level
const WALL_H = 150;   // tallest the rock walls get (px)

// ── Clickable objects ─────────────────────────────────────────────
export const OBJ = {
  none: 0, pit: 1, chest: 2, altar: 3, merchant: 4, quests: 5, bag: 6, arch: 7, scroll: 8, cage: 9, pool: 10, tavern: 11, klutz: 12, bookcase: 13, crate: 14,
} as const;
export type ObjId = (typeof OBJ)[keyof typeof OBJ];

// Where things stand (floor units), in groups:
// - the middle: the Scanning Altar, with the Pit and the Healing Pool either side;
// - the storage corner (right wall, at the back): chest, crates, shelves, bookcase;
// - further along the right wall: the merchant, then the tavern;
// - the left wall: the archway, the bindle in its corner, the quest board and lectern;
// - the front left: the cage, with Klutz's crate beside it.
const AL = { u: 7.5, v: 6.5 };              // scanning altar (the centrepiece)
const PIT = { u0: 10.0, v0: 7.2, u1: 13.6, v1: 10.8, depth: 18 };
const POOL = { u: 5.6, v: 10.6, ru: 2.0, rv: 1.3 };
// The cage: a cell hollowed out of the left wall, iron bars down its front.
const CAGE = { v0: 10.0, v1: 13.6, h: 70, arch: 16 }; // along the left wall (v); how tall the opening is; how much of that is the arch
const CRATE = { u0: 0.35, v0: 9.15, u1: 1.15, v1: 9.9, h: 14 }; // Klutz's crate, beside the cell
const ARCH_V = 3.2;                          // archway on the left wall
const BOARD_V = 6.6;                         // quest board on the left wall
const LECTERN = { u: 1.15, v: 7.45 };        // the Bestiary's lectern, in front of the board
const SHELF = { u0: 6.2, u1: 7.8, h: 46 };   // the bookcase, standing against the right wall
const MERCHANT_U = 10.2;                     // the merchant's stall (right wall)
const TAVERN = { a0: 13.6, a1: 16.0, h: 74 }; // tavern opening on the right wall (along u)

// Where each object's label sits (floor units + height in px).
// below = the label hangs under the point instead of above it.
export const ANCHORS: Record<Exclude<ObjId, 0>, { u: number; v: number; z: number; below?: boolean }> = {
  1: { u: PIT.u1, v: PIT.v1, z: 0, below: true },   // pit (its front corner)
  2: { u: 3.0, v: 0.6, z: 30 },                    // chest
  3: { u: AL.u + 0.5, v: AL.v + 0.5, z: 0, below: true }, // altar
  4: { u: MERCHANT_U + 0.75, v: 0.6, z: 40 },      // merchant
  5: { u: 0, v: BOARD_V + 0.75, z: 96 },           // quest board
  6: { u: 0.35, v: 0.65, z: 54 },                  // the bag in the corner by the archway
  7: { u: 0, v: ARCH_V, z: 88 },                   // archway
  8: { u: LECTERN.u, v: LECTERN.v, z: 0, below: true }, // the scroll on its lectern
  9: { u: 0, v: (CAGE.v0 + CAGE.v1) / 2, z: CAGE.h + 8 }, // the cell in the wall
  10: { u: POOL.u + 1.2, v: POOL.v + 1.0, z: 0, below: true }, // pool
  11: { u: (TAVERN.a0 + TAVERN.a1) / 2, v: 0, z: TAVERN.h + 10 }, // tavern
  12: { u: 8.6, v: 3.2, z: 26 },                   // Klutz (he moves: see klutzAt)
  13: { u: (SHELF.u0 + SHELF.u1) / 2, v: 0.4, z: SHELF.h + 6 }, // the bookcase
  14: { u: CRATE.u1, v: CRATE.v1, z: 0, below: true }, // Klutz's crate (label under it)
};

// Klutz's stroll round the Den: a loop of open floor (clear of the pit,
// pool, altar and furniture), pausing at each stop.
const KLUTZ_PATH: [number, number][] = [
  [8.6, 3.2], [12.6, 3.6], [15.6, 5.8], [15.4, 11.0], [11.8, 12.8], [8.6, 12.6], [8.4, 8.6], [4.0, 7.6], [4.6, 4.6],
];
const KLUTZ_SPEED = 0.55;  // floor units a second
const KLUTZ_PAUSE = 2.5;   // seconds at each stop
export type KlutzMode = "home" | "pool" | "away";

export function project(u: number, v: number, z: number): [number, number] {
  return [CX + (u - v) * TW, Y0 + (u + v) * TH - z];
}

// ── Helpers ───────────────────────────────────────────────────────
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

// A sprite to stamp into the scene: its size, and each pixel's colour (null: see-through).
type Pic = { w: number; h: number; at: (x: number, y: number) => RGB | null };
const picFromGrid = (g: string[]): Pic => ({
  w: Math.max(...g.map((r) => r.length)), h: g.length,
  at: (x, y) => { const ch = g[y]?.[x]; return ch && ch !== "." && PALETTE[ch] ? hex(PALETTE[ch]) : null; },
});
const picFromPixels = ({ w, h, data }: Pixels): Pic => ({
  w, h,
  at: (x, y) => { const o = (y * w + x) * 4; return data[o + 3] > 127 ? [data[o] / 255, data[o + 1] / 255, data[o + 2] / 255] : null; },
});
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

const pal = (...h: string[]) => h.map(hex);
const ROCK        = pal("#3f4452", "#474c5b", "#3a3e4b", "#4d5262", "#424757", "#4a4f5e");
const CAP_STONES  = pal("#6a7184", "#737a8d", "#62697b");
const CRACK       = hex("#1b1d24");
const FLAG        = pal("#6f604f", "#786856", "#675948", "#7f6e5a", "#62554a");
const DIRT        = pal("#4a4038", "#524638", "#43392f", "#584b3d");
const FLOOR_MORT  = hex("#2c2620");
const MOSS        = pal("#33592a", "#41702f", "#284a21", "#4f8238");
const SAND        = pal("#a88a58", "#9c7f52", "#b39463", "#93774b");
const WOOD        = pal("#6e4423", "#7a4b27", "#62391e");
const WOOD_DARK   = hex("#40260f");
const IRON        = hex("#34363d");
const IRON_LIGHT  = hex("#5a5e68");
const GOLD        = hex("#e8b84a");
const WATER       = hex("#16323a");
const VOID        = hex("#050609");

// ── Surface textures ─────────────────────────────────────────────
// Rough cave rock: big irregular blocks with wandering cracks.
// a = distance along the surface (px), z = height (px).
function rock(a: number, z: number, seed: number): RGB {
  const wa = a + 7 * vnoise(z / 10 + seed, seed * 3);
  const wz = z + 5 * vnoise(a / 12 + seed * 7, seed);
  const row = Math.floor(wz / 14);
  const off = hash(row, seed) * 20;
  const col = Math.floor((wa + off) / (18 + hash(row, seed + 1) * 10));
  const ia = (wa + off) % (18 + hash(row, seed + 1) * 10), iz = wz - row * 14;
  if (ia < 0.8 || iz < 0.8) return CRACK;
  let c = ROCK[Math.floor(hash(col * 7 + seed, row) * ROCK.length)];
  let k = iz > 11 ? 1.12 : iz < 2.5 ? 0.85 : 1;
  k *= 0.9 + vnoise(a / 3, z / 3 + seed) * 0.2;
  c = mul(c, k);
  return c;
}

function mossy(c: RGB, a: number, z: number, seed: number, top: number): RGB {
  const n = vnoise(a / 10 + seed * 13, z / 8)
    + (z < 18 ? ((18 - z) / 18) * 0.5 : 0);
  const h = hash(Math.floor(a) + seed, Math.floor(z));
  if (n > 0.82 || (n > 0.74 && h > 0.55)) return MOSS[Math.floor(h * MOSS.length)];
  // Roots and ivy hanging from the dark above.
  const ci = Math.floor(a / 11);
  if (hash(ci, seed + 5) < 0.22) {
    const len = 14 + hash(ci, seed + 9) * 60;
    if (z > top - len) {
      const vx = ci * 11 + 5 + Math.round(Math.sin(z * 0.3 + ci) * 1.5);
      const d = Math.abs(a - vx);
      if (d < 1) return hex("#22381b");
      if (d < 3 && hash(Math.floor(a), Math.floor(z / 3) + ci) > 0.6) return MOSS[(ci + Math.floor(z)) % 4];
    }
  }
  // Damp streaks running down the rock.
  if (hash(Math.floor(a / 4), seed + 21) < 0.06 && z < top - 10) return mul(c, 0.78);
  return c;
}

// How tall the wall stands here (its ragged top), at a px along it.
const wallTop = (a: number, seed: number) =>
  WALL_H - 20 - 34 * vnoise(a / 16, seed) - 14 * vnoise(a / 5, seed + 4) - (hash(Math.floor(a / 3), seed) < 0.08 ? 10 : 0);

// The floor: worn flagstones in the middle of the cavern, rough dirt and
// rock towards the walls, wet patches near the pool.
function floorTex(u: number, v: number): RGB {
  const fu = u * 16, fv = v * 16;
  const centre = 1 - clamp01((Math.hypot(u - 6.2, v - 5.4) - 3.2) / 3.5) ;
  const flag = centre + (vnoise(u * 0.8, v * 0.8) - 0.5) * 0.7 > 0.45;
  if (flag) {
    const row = Math.floor(fv / 16);
    const off = (row & 1) * 8;
    const col = Math.floor((fu + off) / 16);
    const iu = fu + off - col * 16, iv = fv - row * 16;
    if (iu < 0.7 || iv < 0.7) {
      return vnoise(fu / 12, fv / 12) > 0.6 ? MOSS[Math.floor(hash(Math.floor(fu), Math.floor(fv)) * 4)] : FLOOR_MORT;
    }
    let k = iu < 2 || iv < 2 ? 1.08 : iu > 14.5 || iv > 14.5 ? 0.86 : 1;
    k *= 0.9 + hash(Math.floor(fu * 2), Math.floor(fv * 2)) * 0.14;
    return mul(FLAG[Math.floor(hash(col, row + 99) * FLAG.length)], k);
  }
  const n = vnoise(fu / 6, fv / 6);
  if (n > 0.78) return mul(ROCK[Math.floor(hash(Math.floor(fu / 4), Math.floor(fv / 4)) * ROCK.length)], 0.95); // pebbles
  if (vnoise(fu / 14 + 9, fv / 14) > 0.76) return MOSS[Math.floor(hash(Math.floor(fu), Math.floor(fv)) * 4)];
  return mul(DIRT[Math.floor(hash(Math.floor(fu / 3), Math.floor(fv / 3)) * DIRT.length)], 0.9 + n * 0.2);
}

function planks(a: number, z: number, seed: number): RGB {
  const row = Math.floor(z / 4);
  if (z - row * 4 < 0.6) return WOOD_DARK;
  const grain = 0.9 + hash(Math.floor(a / 3) + row * 17, seed) * 0.2;
  return mul(WOOD[(row + seed) % WOOD.length], grain);
}

// ── The scene ────────────────────────────────────────────────────
type Light = { u: number; v: number; z: number; color: RGB; power: number; radius: number; seed: number; pulse?: boolean; steady?: boolean };

const TORCHES: { u: number; v: number; z: number }[] = [
  { u: 0.12, v: 1.4, z: 78 }, { u: 0.12, v: 5.2, z: 76 }, { u: 0.12, v: 9.4, z: 74 },
  { u: 1.3, v: 0.12, z: 78 }, { u: 8.6, v: 0.12, z: 76 }, { u: 12.6, v: 0.12, z: 74 }, { u: 16.8, v: 0.12, z: 72 },
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => b / 16);

export type DenScene = {
  render: (t: number, hover: ObjId) => ImageData;
  idAt: (x: number, y: number) => ObjId;
  setCaged: (sprite: Sprite | null) => void; // the creature shown inside the cage
  // His drawn art once loaded, else his grid sprite.
  setKlutz: (mode: KlutzMode, sprite: Sprite | null, art?: LoadedArt | null) => void;
  klutzAt: () => [number, number] | null;     // where his label goes (layout units), if he's here
};

// Where Klutz is along his stroll at time t: floor position and which way he faces.
function strollAt(t: number): { u: number; v: number; left: boolean; walking: boolean } {
  const legs = KLUTZ_PATH.map((p, i) => {
    const q = KLUTZ_PATH[(i + 1) % KLUTZ_PATH.length];
    return { from: p, to: q, time: Math.hypot(q[0] - p[0], q[1] - p[1]) / KLUTZ_SPEED };
  });
  const loop = legs.reduce((s, l) => s + l.time + KLUTZ_PAUSE, 0);
  let x = t % loop;
  for (const l of legs) {
    // Screen x goes with u − v: facing left when that shrinks.
    const left = (l.to[0] - l.to[1]) < (l.from[0] - l.from[1]);
    if (x < KLUTZ_PAUSE) return { u: l.from[0], v: l.from[1], left, walking: false };
    x -= KLUTZ_PAUSE;
    if (x < l.time) {
      const k = x / l.time;
      return { u: l.from[0] + (l.to[0] - l.from[0]) * k, v: l.from[1] + (l.to[1] - l.from[1]) * k, left, walking: true };
    }
    x -= l.time;
  }
  return { u: KLUTZ_PATH[0][0], v: KLUTZ_PATH[0][1], left: false, walking: false };
}

// backpack: you've found the rugged backpack (otherwise a bindle by the archway).
export function createDen(opts: { backpack?: boolean } = {}): DenScene {
  const n = FW * FH;
  const albedo = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3).fill(NaN);
  const ids = new Uint8Array(n);
  const emissive = new Uint8Array(n); // 1 = glows (not lit), 2 = glows + pulses
  const shadow = new Float32Array(n).fill(1); // fades the room's far edges into the dark

  // (fx, fy): a fine pixel.
  function put(fx: number, fy: number, c: RGB, u: number, v: number, z: number, id: number = 0, glow = 0) {
    if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) return;
    const i = fy * FW + fx;
    albedo[i * 3] = c[0]; albedo[i * 3 + 1] = c[1]; albedo[i * 3 + 2] = c[2];
    pos[i * 3] = u; pos[i * 3 + 1] = v; pos[i * 3 + 2] = z;
    ids[i] = id;
    emissive[i] = glow;
  }

  // Inverse projections: which point on a plane does the spot (x, y) show?
  // (x, y in layout units: a fine pixel's centre.)
  const onZ = (x: number, y: number, z0: number) => {
    const dx = (x - CX) / TW, dy = (y + z0 - Y0) / TH;
    return { u: (dy + dx) / 2, v: (dy - dx) / 2 };
  };
  const onU = (x: number, y: number, u0: number) => {
    const v = u0 - (x - CX) / TW;
    return { v, z: Y0 + (u0 + v) * TH - y };
  };
  const onV = (x: number, y: number, v0: number) => {
    const u = v0 + (x - CX) / TW;
    return { u, z: Y0 + (u + v0) * TH - y };
  };
  const spot = (f: number) => (f + 0.5) / RES; // a fine pixel's centre, in layout units

  const inPit = (u: number, v: number) => u >= PIT.u0 && u < PIT.u1 && v >= PIT.v0 && v < PIT.v1;
  const poolD = (u: number, v: number) => Math.hypot((u - POOL.u) / POOL.ru, (v - POOL.v) / POOL.rv)
    + (vnoise(u * 2.2, v * 2.2) - 0.5) * 0.25; // < 1 = water
  // The far edges of the floor (and the ends of the walls) sink into the dark.
  const edgeFade = (u: number, v: number) => clamp01((NU - u) / 2.2) * clamp01((NV - v) / 2.2);

  // Wall features (in wall coordinates: a = px along the wall from the back corner).
  function leftWallFeature(a: number, z: number): { c: RGB; id: number } | null {
    // Archway into the Labyrinth: rough-cut, framed in old dressed stone.
    const ac = ARCH_V * 16, r = 15, spring = 46;
    const da = a - ac;
    const top = spring + Math.sqrt(Math.max(0, r * r - da * da));
    if (Math.abs(da) < r && z < top) {
      const depth = Math.min(1, z / 70);
      const fog = z < 10 ? 0.07 * (10 - z) / 10 : 0;
      return { c: mix(hex("#0b0d15"), hex("#040509"), depth).map((x, k) => x + (k === 2 ? fog * 1.6 : fog)) as RGB, id: OBJ.arch };
    }
    const outer = Math.sqrt(da * da + Math.max(0, z - spring) ** 2);
    if ((z >= spring && outer < r + 6) || (z < spring && Math.abs(da) < r + 5)) {
      const ang = Math.atan2(z - spring, da);
      const block = z >= spring ? Math.floor((ang / Math.PI) * 7) : Math.floor(z / 9) + 20;
      const edge = z >= spring ? Math.abs(((ang / Math.PI) * 7) % 1) < 0.08 : z % 9 < 1;
      if (edge) return { c: CRACK, id: OBJ.arch };
      return { c: mul(CAP_STONES[block % 3], 0.85 + hash(Math.floor(a), Math.floor(z)) * 0.1), id: OBJ.arch };
    }
    // The cage: a cell hollowed out of the rock — a low arched opening framed
    // in rough dressed stone, dark inside, straw on its floor, a shackle on
    // the back wall. (Its bars, and whoever is inside, are drawn each frame.)
    const ca = a - CAGE.v0 * 16, cw = (CAGE.v1 - CAGE.v0) * 16, half = cw / 2;
    const off = (ca - half) / half; // −1…1 across the opening
    const cellTop = CAGE.h - CAGE.arch + CAGE.arch * Math.sqrt(Math.max(0, 1 - off * off));
    if (ca >= 0 && ca < cw && z < cellTop) {
      const depth = 0.18 + 0.22 * (1 - Math.abs(off)) * clamp01(1 - z / CAGE.h); // darkest at the edges and up top
      if (z < 4) return { c: mul((Math.floor(a * 1.7 + z * 3) % 3 === 0 ? hex("#8a7440") : hex("#5e4e2a")), 0.55), id: OBJ.cage }; // straw
      for (const sx of [0.28, 0.72]) {                                                              // two shackles on chains
        const ring = Math.hypot(ca - cw * sx, z - 30);
        if (ring > 1.4 && ring < 2.6) return { c: mul(IRON_LIGHT, 0.7), id: OBJ.cage };
        if (Math.abs(ca - cw * sx) < 0.6 && z > 32 && z < 42) return { c: mul(IRON, 0.8), id: OBJ.cage };
      }
      return { c: mul(rock(a + 300, z, 7), depth), id: OBJ.cage };
    }
    const outerTop = cellTop + 6;
    if (ca >= -5 && ca < cw + 5 && z < outerTop) {
      // The frame: blocks of dressed stone round the opening.
      const side = ca < 0 || ca >= cw;
      const block = side ? Math.floor(z / 8) + (ca < 0 ? 40 : 60) : Math.floor(ca / 7) + 80;
      const edge = side ? z % 8 < 1 : Math.floor(ca) % 7 === 0;
      if (edge) return { c: CRACK, id: OBJ.cage };
      return { c: mul(CAP_STONES[block % 3], 0.8 + hash(Math.floor(a), Math.floor(z)) * 0.1), id: OBJ.cage };
    }
    // Quest board
    const qa = a - BOARD_V * 16, qz = z - 46;
    if (qa >= 0 && qa < 26 && qz >= 0 && qz < 32) {
      if (qa < 2 || qa >= 24 || qz < 2 || qz >= 30) return { c: WOOD_DARK, id: OBJ.quests };
      const notes = [[4, 16, 7, 9], [14, 18, 7, 8], [7, 4, 9, 8], [17, 5, 5, 7]];
      for (const [nx, nz, nw, nh] of notes) {
        if (qa >= nx && qa < nx + nw && qz >= nz && qz < nz + nh) {
          if (Math.floor(qa) === nx + Math.floor(nw / 2) && Math.floor(qz) === nz + nh - 1) return { c: hex("#c0392b"), id: OBJ.quests };
          const line = Math.floor(qz - nz) % 2 === 0 && qa > nx + 0.5 && qa < nx + nw - 1 && qz < nz + nh - 2 && (qz - nz) % 1 < 0.6;
          return { c: line ? hex("#9c8f74") : hex("#d8ccb0"), id: OBJ.quests };
        }
      }
      return { c: planks(qa, qz, 2), id: OBJ.quests };
    }
    return null;
  }

  function rightWallFeature(a: number, z: number): { c: RGB; id: number } | null {
    // The tavern: a tall opening into the dark, framed in timber and
    // half boarded up — it isn't built yet.
    const ta = a - TAVERN.a0 * 16, tw = (TAVERN.a1 - TAVERN.a0) * 16;
    if (ta >= -4 && ta < tw + 4 && z < TAVERN.h + 6) {
      const inside = ta >= 0 && ta < tw && z < TAVERN.h;
      if (!inside) return { c: planks(z, ta + 40, 1), id: OBJ.tavern }; // frame
      const board = [18, 34, 52].some((bz) => z >= bz && z < bz + 6) && Math.abs((ta - tw / 2) / tw) < 0.47 + (z % 7) * 0.003;
      if (board) return { c: mul(planks(ta, z, 2), 0.85), id: OBJ.tavern };
      const depth = clamp01(z / 60);
      return { c: mix(hex("#0d0b0a"), hex("#050404"), depth), id: OBJ.tavern };
    }
    // Merchant's hanging sign
    const sa = a - (MERCHANT_U + 0.2) * 16, sz = z - 64;
    if (sa >= 0 && sa < 18 && sz >= 0 && sz < 12) {
      if (sa < 1 || sa >= 17 || sz < 1 || sz >= 11) return { c: WOOD_DARK, id: OBJ.merchant };
      const cx = sa - 9, cz = sz - 6;
      if (cx * cx + cz * cz < 10) return { c: (cx + cz) < 0 ? hex("#fff0a0") : GOLD, id: OBJ.merchant };
      return { c: planks(sa, sz, 1), id: OBJ.merchant };
    }
    if (sz >= 12 && sz < 16 && (Math.abs(sa - 3) < 0.6 || Math.abs(sa - 14) < 0.6)) return { c: IRON, id: OBJ.merchant };
    return null;
  }

  // ── Static pass: room surfaces ──
  for (let fy = 0; fy < FH; fy++) {
    for (let fx = 0; fx < FW; fx++) {
      const x = spot(fx), y = spot(fy);
      // Floor (with the pit and the pool)
      const f = onZ(x, y, 0);
      if (f.u >= 0 && f.v >= 0 && f.u < NU && f.v < NV) {
        const fade = edgeFade(f.u, f.v);
        // The very edge breaks up into darkness.
        if (fade < 0.35 * hash(Math.floor(f.u * 9), Math.floor(f.v * 9))) continue;
        const i = fy * FW + fx;
        if (inPit(f.u, f.v)) {
          const s = onZ(x, y, -PIT.depth);
          if (inPit(s.u, s.v)) {
            const h = hash(Math.floor(s.u * 32), Math.floor(s.v * 32));
            put(fx, fy, mul(SAND[Math.floor(h * 4)], 0.9 + h * 0.15), s.u, s.v, -PIT.depth, OBJ.pit);
          } else {
            const wu = onU(x, y, PIT.u0), wv = onV(x, y, PIT.v0);
            if (wu.v >= PIT.v0 && wu.v < PIT.v1 && wu.z <= 0 && wu.z > -PIT.depth) put(fx, fy, mul(rock(wu.v * 16, wu.z + PIT.depth, 3), 0.62), PIT.u0, wu.v, wu.z, OBJ.pit);
            else put(fx, fy, mul(rock(wv.u * 16, wv.z + PIT.depth, 4), 0.5), wv.u, PIT.v0, wv.z, OBJ.pit);
          }
          shadow[i] = fade;
          continue;
        }
        const nearPit = f.u >= PIT.u0 - 0.25 && f.u < PIT.u1 + 0.25 && f.v >= PIT.v0 - 0.25 && f.v < PIT.v1 + 0.25;
        if (nearPit) {
          const k = 0.9 + hash(Math.floor(f.u * 10), Math.floor(f.v * 10)) * 0.15;
          put(fx, fy, mul(CAP_STONES[Math.floor(hash(Math.floor(f.u * 4), Math.floor(f.v * 4)) * 3)], k * 0.85), f.u, f.v, 0, OBJ.pit);
          shadow[i] = fade;
          continue;
        }
        const pd = poolD(f.u, f.v);
        if (pd < 1) {
          // Murky water, a little darker towards the middle.
          const deep = clamp01(1 - pd);
          put(fx, fy, mul(WATER, 1.15 - deep * 0.45), f.u, f.v, -1, OBJ.pool);
          shadow[i] = fade;
          continue;
        }
        if (pd < 1.28) {
          // A soggy rim of wet stones and moss.
          const h = hash(Math.floor(f.u * 12), Math.floor(f.v * 12));
          const c = h > 0.55 ? MOSS[Math.floor(h * 8) % 4] : mul(ROCK[Math.floor(h * ROCK.length)], 0.8);
          put(fx, fy, c, f.u, f.v, 0, OBJ.pool);
          shadow[i] = fade;
          continue;
        }
        let c = floorTex(f.u, f.v);
        if (pd < 1.9 && vnoise(f.u * 3, f.v * 3) > 0.55) c = mul(c, 0.7); // puddles
        put(fx, fy, c, f.u, f.v, 0);
        shadow[i] = fade;
        continue;
      }

      // Right wall (v = 0) and left wall (u = 0), inner faces, with ragged tops.
      const rw = onV(x, y, 0);
      if (rw.u >= 0 && rw.u < NU && rw.z >= 0 && x >= CX) {
        const top = wallTop(rw.u * 16, 1);
        if (rw.z < top) {
          const feat = rightWallFeature(rw.u * 16, rw.z);
          if (feat) put(fx, fy, feat.c, rw.u, 0.02, rw.z, feat.id);
          else put(fx, fy, mul(mossy(rock(rw.u * 16, rw.z, 1), rw.u * 16, rw.z, 1, top), 0.84), rw.u, 0, rw.z);
          shadow[fy * FW + fx] = clamp01((NU - rw.u) / 2.2) * clamp01((top - rw.z) / 40);
          continue;
        }
      }
      const lw = onU(x, y, 0);
      if (lw.v >= 0 && lw.v < NV && lw.z >= 0 && x < CX) {
        const top = wallTop(lw.v * 16, 2);
        if (lw.z < top) {
          const feat = leftWallFeature(lw.v * 16, lw.z);
          if (feat) put(fx, fy, feat.c, 0.02, lw.v, lw.z, feat.id);
          else put(fx, fy, mossy(rock(lw.v * 16, lw.z, 2), lw.v * 16, lw.z, 2, top), 0, lw.v, lw.z);
          shadow[fy * FW + fx] = clamp01((NV - lw.v) / 2.2) * clamp01((top - lw.z) / 40);
          continue;
        }
      }
    }
  }

  // ── Objects (boxes) ──
  type Face = (a: number, b: number) => { c: RGB; glow?: number } | RGB;
  function box(id: number, u0: number, v0: number, z0: number, u1: number, v1: number, z1: number,
    faces: { top: Face; right: Face; left: Face }) {
    const corners = [project(u0, v0, z1), project(u1, v0, z0), project(u0, v1, z0), project(u1, v1, z0), project(u1, v1, z1)];
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    const unpack = (r: ReturnType<Face>) => (Array.isArray(r) ? { c: r, glow: 0 } : { c: r.c, glow: r.glow ?? 0 });
    for (let fy = Math.floor(Math.min(...ys) * RES) - 2; fy <= Math.ceil(Math.max(...ys) * RES) + 2; fy++) {
      for (let fx = Math.floor(Math.min(...xs) * RES) - 2; fx <= Math.ceil(Math.max(...xs) * RES) + 2; fx++) {
        const x = spot(fx), y = spot(fy);
        const t = onZ(x, y, z1);
        if (t.u >= u0 && t.u < u1 && t.v >= v0 && t.v < v1) {
          const r = unpack(faces.top((t.u - u0) * 16, (t.v - v0) * 16));
          put(fx, fy, r.c, t.u, t.v, z1, id, r.glow); continue;
        }
        const fu = onU(x, y, u1);
        if (fu.v >= v0 && fu.v < v1 && fu.z >= z0 && fu.z < z1) {
          const r = unpack(faces.right((fu.v - v0) * 16, fu.z - z0));
          put(fx, fy, r.glow ? r.c : mul(r.c, 0.78), u1, fu.v, fu.z, id, r.glow); continue;
        }
        const fv = onV(x, y, v1);
        if (fv.u >= u0 && fv.u < u1 && fv.z >= z0 && fv.z < z1) {
          const r = unpack(faces.left((fv.u - u0) * 16, fv.z - z0));
          put(fx, fy, r.glow ? r.c : mul(r.c, 0.92), fv.u, v1, fv.z, id, r.glow);
        }
      }
    }
  }

  // Back to front so nearer objects cover farther ones.
  // Storage corner (right wall): a shelf of sacks and potions.
  const shelf: Face = (a, b) => (b < 1 ? mul(WOOD[0], 1.15) : WOOD_DARK);
  box(OBJ.chest, 4.2, 0, 28, 5.8, 0.4, 31, { top: (a) => planks(a, 2, 0), right: shelf, left: shelf });
  box(OBJ.chest, 4.2, 0, 52, 5.8, 0.4, 55, { top: (a) => planks(a, 2, 1), right: shelf, left: shelf });
  const sack: Face = (a, b) => (b > 8 && b < 10 ? hex("#3d2a17") : mul(hex("#9a7448"), 0.9 + hash(Math.floor(a), Math.floor(b)) * 0.15));
  box(OBJ.chest, 4.35, 0.05, 55, 4.95, 0.35, 67, { top: () => hex("#8a6640"), right: sack, left: sack });
  const potion = (col: string): Face => (a, b) => (b > 6 ? hex("#cfc6b0") : { c: mul(hex(col), b < 2 ? 0.7 : 1), glow: 1 });
  box(OBJ.chest, 5.1, 0.1, 55, 5.28, 0.28, 63, { top: () => hex("#cfc6b0"), right: potion("#e04848"), left: potion("#e04848") });
  box(OBJ.chest, 5.38, 0.1, 55, 5.56, 0.28, 62, { top: () => hex("#cfc6b0"), right: potion("#4878e0"), left: potion("#4878e0") });
  box(OBJ.chest, 4.4, 0.08, 31, 4.62, 0.3, 38, { top: () => hex("#cfc6b0"), right: potion("#48c060"), left: potion("#48c060") });
  box(OBJ.chest, 4.9, 0.06, 31, 5.5, 0.34, 35, { top: () => hex("#d8cba8"), right: () => hex("#c2b28c"), left: () => hex("#b5a47e") });

  if (!opts.backpack) {
    // A bindle in the back corner: a walking stick leaning against the left
    // wall (drawn as short steps that creep towards the wall as it rises),
    // with a cloth bundle tied on the top, resting on the stones.
    const stick: Face = (a, b) => planks(a, b, 3);
    for (let k = 0; k < 9; k++) {
      const u0 = 0.86 - k * 0.075;
      box(OBJ.bag, u0, 0.62, k * 5, u0 + 0.1, 0.72, k * 5 + 5, { top: () => WOOD_DARK, right: stick, left: stick });
    }
    const cloth: Face = (a, b) => ((Math.floor(a / 3) + Math.floor(b / 3)) % 2 ? hex("#8e2b2b") : hex("#d8cba8"));
    box(OBJ.bag, 0.06, 0.4, 33, 0.52, 0.94, 46, { top: cloth, right: cloth, left: cloth });
    box(OBJ.bag, 0.12, 0.6, 46, 0.3, 0.74, 50, { top: () => hex("#c9b07a"), right: () => hex("#a8894f"), left: () => hex("#b89a62") }); // the knot
    // …and a little sack slumped beside it.
    box(OBJ.bag, 0.1, 1.0, 0, 0.6, 1.42, 10, { top: () => hex("#8a6640"), right: (a, b) => mul(hex("#9a7448"), 0.9 + hash(Math.floor(a), Math.floor(b)) * 0.15), left: () => hex("#7a5a38") });
  } else {
  // A rugged backpack on the floor in the back corner, ready for the next run:
  // leather body with a front pocket, a flap with a buckle, a bedroll on top.
  const LEATHER = hex("#6b4a2b"), LEATHER_D = hex("#4a3019"), STRAP = hex("#2e1e10");
  const leather: Face = (a, b) => {
    if (Math.abs(a - 3) < 0.9 || Math.abs(a - 12) < 0.9) return STRAP;           // straps
    if (Math.floor(b) % 5 === 0 && Math.floor(a) % 2 === 0) return LEATHER_D;     // stitching
    return mul(LEATHER, 0.92 + hash(Math.floor(a), Math.floor(b) + 7) * 0.14);
  };
  box(OBJ.bag, 0.200, 0.250, 0, 0.888, 0.875, 20, { top: () => LEATHER_D, right: leather, left: leather });
  box(OBJ.bag, 0.888, 0.350, 4, 1.000, 0.775, 14, {                                   // front pocket
    top: () => LEATHER_D, right: (a, b) => (b > 6 ? LEATHER_D : Math.abs(a - 2.7) < 0.7 && b > 4 ? GOLD : mul(LEATHER, 1.05)), left: () => LEATHER_D,
  });
  box(OBJ.bag, 0.163, 0.213, 20, 0.925, 0.912, 24, {                                  // the flap
    top: (a, b) => (Math.abs(b - 4) < 1 && a > 6 ? IRON_LIGHT : LEATHER_D),
    right: (a) => (Math.abs(a - 4.5) < 1 ? GOLD : LEATHER_D), left: () => LEATHER_D,
  });
  const wool: Face = (a, b) => (Math.floor(a) % 4 === 0 ? hex("#4b5a3e") : mul(hex("#6f7d5a"), 0.92 + hash(Math.floor(a), Math.floor(b)) * 0.12));
  box(OBJ.bag, 0.125, 0.375, 24, 0.975, 0.713, 30, { top: wool, right: (a, b) => (Math.hypot(a - 2.2, b - 2.5) < 1.5 ? hex("#3a4630") : wool(a, b)), left: wool }); // bedroll
  }

  // The bookcase: a tall case of shelves against the right wall, codexes on them.
  const SPINES = ["#7b3fc4", "#2f6fb0", "#8e2b2b", "#2f7a3a", "#b07a2a", "#5a3a8a", "#2a7a7a"];
  const bookFront: Face = (a, b) => {
    const wdt = (SHELF.u1 - SHELF.u0) * 16;
    if (a < 1.5 || a > wdt - 1.5 || b < 2 || b > SHELF.h - 2) return planks(b, a, 5);   // the frame
    const row = Math.floor((b - 2) / 11), inRow = (b - 2) % 11;
    if (inRow < 1.5) return WOOD_DARK;                                                    // a shelf
    const bookW = 2.2, k = Math.floor((a - 1.5) / bookW) + row * 5;
    const tall = 6 + Math.floor(hash(k, row) * 3.5);
    if (inRow > tall + 1.5 || hash(k + 3, row) < 0.12) return mul(WOOD_DARK, 0.6);      // gaps above the books
    const spine = hex(SPINES[Math.floor(hash(k, row + 7) * SPINES.length)]);
    if ((a - 1.5) % bookW < 0.35) return mul(spine, 0.55);                              // between books
    return Math.abs(inRow - tall + 0.5) < 0.6 ? GOLD : spine;                            // gold tops
  };
  box(OBJ.bookcase, SHELF.u0, 0.05, 0, SHELF.u1, 0.75, SHELF.h, {
    top: (a, b) => planks(a, b, 5), right: (a, b) => planks(b, a, 6), left: bookFront,
  });

  // Crates beside the chest.
  const crate: Face = (a, b) => (a < 1.2 || a > 13.8 || b < 1.2 || b > 12 || Math.abs(a - b) < 0.9 ? WOOD_DARK : planks(a, b, 1));
  box(OBJ.chest, 3.25, 0.15, 0, 4.05, 0.95, 13, { top: crate, right: crate, left: crate });
  box(OBJ.chest, 3.35, 0.25, 13, 3.95, 0.85, 23, { top: crate, right: crate, left: crate });

  // Chest (right wall, in the storage corner)
  const chestSide: Face = (a, b) => {
    if (a < 1.5 || a > 13) return IRON;
    if (b > 6 && b < 8) return IRON;
    if (Math.abs(a - 7.5) < 2 && b > 3 && b < 8) return Math.abs(a - 7.5) < 0.8 && b > 4 && b < 6 ? hex("#2a1a0a") : GOLD;
    return planks(a, b, 0);
  };
  box(OBJ.chest, 2.0, 0.2, 0, 3.0, 1.15, 12, {
    top: (a, b) => (a < 1.5 || a > 14.5 || Math.abs(b - 7.5) < 1 ? IRON : planks(a, b, 1)),
    right: (a, b) => (a < 1.5 || a > 13.5 || (b > 6 && b < 8) ? IRON : planks(a, b, 2)),
    left: chestSide,
  });

  // Merchant stall (right wall, beside the tavern)
  const counter: Face = (a, b) => (b > 11 ? hex("#7e2626") : b > 10 ? GOLD : planks(a, b, 2));
  const MU = MERCHANT_U;
  box(OBJ.merchant, MU, 0.12, 0, MU + 1.5, 1.0, 13, { top: (a, b) => ((Math.floor(a / 4) + Math.floor(b / 4)) % 2 ? hex("#932f2f") : hex("#7e2626")), right: counter, left: counter });
  box(OBJ.merchant, MU + 0.15, 0.3, 13, MU + 0.35, 0.5, 20, { top: () => hex("#cfc6b0"), right: potion("#b060e0"), left: potion("#b060e0") });
  box(OBJ.merchant, MU + 0.55, 0.25, 13, MU + 0.95, 0.65, 16, { top: () => ({ c: hex("#ffe27a"), glow: 1 }), right: () => GOLD, left: () => mul(GOLD, 0.85) });
  box(OBJ.merchant, MU + 1.1, 0.35, 13, MU + 1.28, 0.53, 19, { top: () => hex("#cfc6b0"), right: potion("#e0a030"), left: potion("#e0a030") });

  // Scanning altar (the centrepiece, in front of the back corner)
  const altarStone: Face = (a, b) => (b > 15 ? mul(CAP_STONES[1], 1.1) : rock(a + 30, b, 11));
  box(OBJ.altar, AL.u - 0.5, AL.v - 0.5, 0, AL.u + 0.5, AL.v + 0.5, 18, {
    top: (a, b) => {
      const d = Math.hypot(a - 8, b - 8);
      if (d < 1.8 || (d > 4.4 && d < 5.8)) return { c: hex("#6ff2ff"), glow: 2 };
      return mul(CAP_STONES[0], 1.1);
    },
    right: altarStone,
    left: (a, b) => (Math.abs(a - 8) < 1 && b > 4 && b < 13 ? { c: hex("#3fc6e0"), glow: 2 } : altarStone(a, b)),
  });

  // Lectern with an open scroll (in front of the quest board).
  const post: Face = (a, b) => planks(a, b, 3);
  const LU = LECTERN.u - 0.15, LV = LECTERN.v - 0.15;
  box(OBJ.scroll, LU, LV, 0, LU + 0.3, LV + 0.3, 14, { top: () => WOOD_DARK, right: post, left: post });
  box(OBJ.scroll, LU - 0.25, LV - 0.2, 14, LU + 0.55, LV + 0.5, 17, { top: (a) => planks(a, 3, 2), right: () => WOOD_DARK, left: () => WOOD_DARK });
  const parchment: Face = (a, b) => {
    if (b < 1.5 || b > 14.5) return hex("#c9b07a"); // rolled ends
    const line = a > 2 && a < 13 && Math.floor(a) % 3 === 0 && b > 3 && b < 13 && Math.abs(b - 8) > 0.8;
    return line ? hex("#7a6448") : { c: hex("#f2e4bf"), glow: 0.4 };
  };
  box(OBJ.scroll, LU - 0.2, LV - 0.15, 17, LU + 0.5, LV + 0.45, 18, { top: parchment, right: () => hex("#c9b07a"), left: () => hex("#d8c290") });

  // Klutz's crate: rough planks with iron bands, where he dumps the gear he finds.
  const crateSide: Face = (a, b) => (b < 1.2 || b > CRATE.h - 1.5 || Math.abs(b - CRATE.h / 2) < 0.8 ? IRON : planks(a, b, 3));
  box(OBJ.crate, CRATE.u0, CRATE.v0, 0, CRATE.u1, CRATE.v1, CRATE.h, {
    top: (a, b) => (a < 1 || b < 1 || a > 12.5 || b > 12.5 ? IRON_LIGHT : mul(planks(a, b, 4), 0.9)), right: crateSide, left: crateSide,
  });


  // ── Lights ──
  const lights: Light[] = [
    ...TORCHES.map((t, i) => ({ ...t, color: hex("#ff9a44"), power: 1.35, radius: 2.3, seed: i * 1.7 })),
    { u: AL.u, v: AL.v, z: 34, color: hex("#5fe0ff"), power: 0.9, radius: 1.7, seed: 9, pulse: true },
    { u: POOL.u, v: POOL.v, z: 6, color: hex("#3fa0a0"), power: 0.35, radius: 1.8, seed: 11, steady: true },
  ];
  const AMBIENT: RGB = [0.13, 0.145, 0.22];

  // Light baked once: the total at full strength, plus the strongest light
  // on each pixel (only that one flickers, which is close enough and cheap).
  const lit = new Float32Array(n * 3);
  const domIdx = new Uint8Array(n).fill(255);
  const domFall = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = pos[i * 3];
    if (Number.isNaN(u)) continue;
    const v = pos[i * 3 + 1], z = pos[i * 3 + 2] / 16;
    let best = 0, bestK = 255;
    for (let k = 0; k < lights.length; k++) {
      const l = lights[k];
      const du = u - l.u, dv = v - l.v, dz = z - l.z / 16;
      const fall = l.power / (1 + (du * du + dv * dv + dz * dz) / (l.radius * l.radius));
      lit[i * 3] += l.color[0] * fall; lit[i * 3 + 1] += l.color[1] * fall; lit[i * 3 + 2] += l.color[2] * fall;
      if (fall > best) { best = fall; bestK = k; }
    }
    domIdx[i] = bestK; domFall[i] = best;
  }

  // Embers drifting up from the torches.
  type Ember = { x: number; y: number; vx: number; life: number };
  let embers: Ember[] = [];
  let lastT = 0;
  let caged: string[] | null = null; // the caged creature, on the fine grid
  let klutz: Pic | null = null;
  let klutzWalk: { frames: Pic[]; x: number; y: number } | null = null; // his walk, lined up with his still
  let klutzMode: KlutzMode = "away";
  let klutzLabel: [number, number] | null = null;

  const out = new ImageData(FW, FH);
  const frameIds = new Uint8Array(n);

  function render(t: number, hover: ObjId): ImageData {
    const d = out.data;
    const flick = lights.map((l) =>
      l.steady ? 1
        : l.pulse ? 0.75 + 0.25 * Math.sin(t * 2.2)
        : 0.84 + 0.09 * Math.sin(t * 9 + l.seed) + 0.07 * Math.sin(t * 23 + l.seed * 3) + (Math.random() - 0.5) * 0.04
    );
    const altarPulse = 0.8 + 0.2 * Math.sin(t * 2.2);

    for (let fy = 0; fy < FH; fy++) {
      for (let fx = 0; fx < FW; fx++) {
        const i = fy * FW + fx, o = i * 4;
        const u = pos[i * 3];
        const bay = BAYER[(fy & 3) * 4 + (fx & 3)];
        if (Number.isNaN(u)) {
          // The dark beyond: a faint cold haze low down.
          const y = spot(fy);
          const k = Math.floor(clamp01((y - 120) / 400) * 0.6 * 4 + bay) / 4;
          d[o] = (VOID[0] + k * 0.03) * 255; d[o + 1] = (VOID[1] + k * 0.035) * 255; d[o + 2] = (VOID[2] + k * 0.06) * 255; d[o + 3] = 255;
          continue;
        }
        const r = albedo[i * 3], g = albedo[i * 3 + 1], bl = albedo[i * 3 + 2];
        if (emissive[i]) {
          const k = emissive[i] === 2 ? altarPulse : 1;
          d[o] = Math.min(255, r * 255 * k); d[o + 1] = Math.min(255, g * 255 * k); d[o + 2] = Math.min(255, bl * 255 * k); d[o + 3] = 255;
          continue;
        }
        const dk = domIdx[i];
        const extra = dk === 255 ? 0 : (flick[dk] - 1) * domFall[i];
        const col = dk === 255 ? AMBIENT : lights[dk].color;
        const s = shadow[i];
        const lr = (AMBIENT[0] + lit[i * 3] + col[0] * extra) * s;
        const lg = (AMBIENT[1] + lit[i * 3 + 1] + col[1] * extra) * s;
        const lb = (AMBIENT[2] + lit[i * 3 + 2] + col[2] * extra) * s;
        // Ordered dithering on the light gives the stepped pixel-art glow.
        const q = (L: number) => Math.floor(L * 6 + bay) / 6;
        d[o] = Math.min(255, r * q(lr) * 255);
        d[o + 1] = Math.min(255, g * q(lg) * 255);
        d[o + 2] = Math.min(255, bl * q(lb) * 255);
        d[o + 3] = 255;
      }
    }

    frameIds.set(ids);
    // Paint a layout unit (RES×RES fine pixels).
    const px = (x: number, y: number, c: string | RGB, id = 0) => {
      const col = typeof c === "string" ? hex(c) : c;
      const x0 = Math.round(x) * RES, y0 = Math.round(y) * RES;
      for (let dy = 0; dy < RES; dy++) for (let dx = 0; dx < RES; dx++) {
        const X = x0 + dx, Y = y0 + dy;
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        const o = (Y * FW + X) * 4;
        d[o] = col[0] * 255; d[o + 1] = col[1] * 255; d[o + 2] = col[2] * 255;
        if (id) frameIds[Y * FW + X] = id;
      }
    };
    // Paint one fine pixel.
    const fpx = (X: number, Y: number, col: RGB, id = 0) => {
      X = Math.round(X); Y = Math.round(Y);
      if (X < 0 || Y < 0 || X >= FW || Y >= FH) return;
      const o = (Y * FW + X) * 4;
      d[o] = col[0] * 255; d[o + 1] = col[1] * 255; d[o + 2] = col[2] * 255;
      if (id) frameIds[Y * FW + X] = id;
    };

    // Torches: iron bracket + animated flame.
    TORCHES.forEach((tc, i) => {
      const [tx, ty] = project(tc.u, tc.v, tc.z);
      for (let k = 0; k < 6; k++) px(tx, ty + k, k < 2 ? "#5a5e68" : "#2c2e34");
      px(tx - 1, ty, "#5a5e68"); px(tx + 1, ty, "#5a5e68");
      const hgt = 5 + Math.floor((Math.sin(t * 11 + i * 2) + 1) * 1.5 + Math.random() * 1.5);
      for (let k = 0; k < hgt; k++) {
        const wdt = k < 2 ? 1 : k < hgt - 2 ? 1 : 0;
        const sway = k > hgt / 2 ? Math.round(Math.sin(t * 7 + i + k) * 0.8) : 0;
        const c = k < 2 ? "#fff3b0" : k < hgt - 2 ? "#ffb347" : "#e2582a";
        for (let w = -wdt; w <= wdt; w++) px(tx + w + sway, ty - 1 - k, w === 0 ? c : "#ff8a2a");
      }
      if (Math.random() < 0.25) embers.push({ x: tx + (Math.random() - 0.5) * 3, y: ty - 6, vx: (Math.random() - 0.5) * 0.3, life: 1 });
    });

    // Embers
    const dt = lastT ? Math.min(0.2, t - lastT) : 0.08;
    lastT = t;
    embers = embers.filter((e) => (e.life -= dt * 0.9) > 0);
    for (const e of embers) {
      e.y -= dt * 14; e.x += e.vx + Math.sin(e.y * 0.3) * 0.15;
      px(e.x, e.y, e.life > 0.5 ? "#ffcf6b" : "#d9541f");
    }

    // Floating crystal above the altar.
    const [cx, cy] = project(AL.u, AL.v, 34 + Math.sin(t * 2) * 2.5);
    const shape = [1, 2, 3, 3, 3, 2, 2, 1, 1, 0];
    shape.forEach((w, k) => {
      for (let s = -w; s <= w; s++) {
        const c = s < 0 ? "#b8fbff" : s === 0 ? "#6ff2ff" : "#2fa8d0";
        px(cx + s, cy - 5 + k, k === 1 && s === -1 ? "#ffffff" : c, OBJ.altar);
      }
    });

    // Pool: slow ripples glinting on the murky water, and the odd drip.
    for (let k = 0; k < 7; k++) {
      const ph = t * 0.6 + k * 1.7;
      const a = hash(k, Math.floor(ph)) * Math.PI * 2, rr = 0.25 + hash(k + 9, Math.floor(ph)) * 0.55;
      const grow = ph % 1;
      const [rx, ry] = project(POOL.u + Math.cos(a) * rr * POOL.ru, POOL.v + Math.sin(a) * rr * POOL.rv, -1);
      if (grow > 0.85) continue;
      const rad = 1 + grow * 4;
      for (let s = 0; s < 10; s++) {
        const an = (s / 10) * Math.PI * 2;
        fpx(rx * RES + Math.cos(an) * rad * 2, ry * RES + Math.sin(an) * rad, mix(hex("#2c5a62"), hex("#7fb8b8"), 1 - grow), OBJ.pool);
      }
    }

    // The cell: whoever is inside (set back in the dark), then the bars.
    const mid = (CAGE.v0 + CAGE.v1) / 2;
    const [bx, by] = project(0, mid, 3);
    if (caged) {
      const h = caged.length, w = Math.max(...caged.map((r) => r.length));
      const bob = Math.round(Math.sin(t * 1.5) * 1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = caged[y][x];
        if (ch === "." || !PALETTE[ch]) continue;
        fpx(bx * RES - w / 2 + x, by * RES - h + y + bob, mul(hex(PALETTE[ch]), 0.62), OBJ.cage);
      }
    }
    // Iron bars down the front of the opening, set into a top and bottom rail.
    const BAR_U = 0.06;
    const bar = (v: number) => {
      const off = (v - mid) / ((CAGE.v1 - CAGE.v0) / 2);
      const top = CAGE.h - CAGE.arch + CAGE.arch * Math.sqrt(Math.max(0, 1 - off * off)) - 1; // up into the arch
      const [x0, y0] = project(BAR_U, v, 1), [, y1] = project(BAR_U, v, top);
      for (let y = y1 * RES; y <= y0 * RES; y++) {
        fpx(x0 * RES, y, IRON_LIGHT, OBJ.cage); fpx(x0 * RES + 1, y, IRON, OBJ.cage);
      }
    };
    for (let v = CAGE.v0 + 0.25; v < CAGE.v1 - 0.1; v += 0.3) bar(v);
    for (const z of [2, CAGE.h - CAGE.arch - 2]) {
      for (let v = CAGE.v0; v <= CAGE.v1; v += 0.02) {
        const [x, y] = project(BAR_U, v, z);
        fpx(x * RES, y * RES, IRON_LIGHT, OBJ.cage); fpx(x * RES, y * RES + 1, IRON, OBJ.cage); fpx(x * RES, y * RES + 2, IRON, OBJ.cage);
      }
    }

    // Klutz: strolling about, or soaking in the pool up to his chin.
    klutzLabel = null;
    if (klutz && klutzMode !== "away") {
      const { w, h } = klutz;
      const at = klutzMode === "pool" ? { u: POOL.u + 0.3, v: POOL.v - 0.2, left: false, walking: false } : strollAt(t);
      const [kx, ky] = project(at.u, at.v, klutzMode === "pool" ? -1 : 0);
      const stepping = at.walking && klutzWalk && klutzMode !== "pool";
      const bob = stepping ? 0 : at.walking ? Math.round(Math.abs(Math.sin(t * 8)) * 2) : Math.round(Math.sin(t * 1.3));
      const rows = klutzMode === "pool" ? Math.floor(h * 0.52) : h; // in the pool, only his head shows
      const top = ky * RES - (klutzMode === "pool" ? rows : h) - bob;
      // Walking: a frame of his walk, placed so his still would sit where it always does.
      const walk = stepping ? klutzWalk : null;
      const pic = walk ? walk.frames[Math.floor(t * 9) % walk.frames.length] : klutz;
      const ox = walk ? (at.left ? pic.w - walk.x - w : walk.x) : 0, oy = walk ? walk.y : 0;
      const left0 = kx * RES - w / 2 - ox, top0 = top - oy;
      for (let y = 0; y < (walk ? pic.h : rows); y++) for (let x = 0; x < pic.w; x++) {
        const col = pic.at(at.left ? pic.w - 1 - x : x, y);
        if (col) fpx(left0 + x, top0 + y, mul(col, 0.85), OBJ.klutz);
      }
      if (klutzMode === "pool") {
        for (let s2 = 0; s2 < 14; s2++) {
          const an = (s2 / 14) * Math.PI * 2, rad = 10 + Math.sin(t * 2) * 1.5;
          fpx(kx * RES + Math.cos(an) * rad * 2, ky * RES + Math.sin(an) * rad, hex("#5f9a9a"), OBJ.klutz);
        }
      }
      klutzLabel = [kx, top / RES - 2];
    }

    // Hover: brighten the object and outline it in gold.
    if (hover) {
      const glow = 0.75 + 0.25 * Math.sin(t * 6);
      for (let y = 1; y < FH - 1; y++) {
        for (let x = 1; x < FW - 1; x++) {
          const i = y * FW + x, o = i * 4;
          if (frameIds[i] === hover) {
            d[o] = Math.min(255, d[o] * 1.35 + 14); d[o + 1] = Math.min(255, d[o + 1] * 1.35 + 12); d[o + 2] = Math.min(255, d[o + 2] * 1.3 + 8);
          } else if (frameIds[i - 1] === hover || frameIds[i + 1] === hover || frameIds[i - FW] === hover || frameIds[i + FW] === hover) {
            d[o] = 255 * glow; d[o + 1] = 214 * glow; d[o + 2] = 110 * glow;
          }
        }
      }
    }
    return out;
  }

  return {
    render,
    idAt: (x, y) => { // layout units
      const fx = Math.floor(x * RES), fy = Math.floor(y * RES);
      if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) return OBJ.none;
      return frameIds[fy * FW + fx] as ObjId;
    },
    setCaged: (sprite) => { caged = sprite ? fineGrid(sprite) : null; },
    setKlutz: (mode, sprite, art) => {
      klutzMode = mode;
      klutz = art ? picFromPixels(art.still) : sprite ? picFromGrid(fineGrid(sprite)) : null;
      klutzWalk = art?.walk ? { frames: art.walk.frames.map(picFromPixels), x: art.walk.x, y: art.walk.y } : null;
    },
    klutzAt: () => klutzLabel,
  };
}
