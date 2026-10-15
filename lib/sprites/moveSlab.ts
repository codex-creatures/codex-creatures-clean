// lib/sprites/moveSlab.ts
// A move's button as an old, cracked dungeon floor stone, drawn as pixel
// art, with a design carved across its middle (left to right) for how the
// move hurts:
// - Pierce: an arrowhead sailing through the air, the force of it wrapping
//   round the head and streaming back past the shaft;
// - Force: a palm strike, the open hand thrust forward into a burst of impact;
// - Arcane: a zig-zag bolt ending in a sharp spike with a small oval orb at
//   its tip, sparks flying off it.
// The carving is cut in (a shadowed top edge, a lit lip below) and its
// groove holds a little pigment in the style's colour: red melee, green
// ranged, blue magic. Each move gets its own cracks (seeded by its name), so
// a slab always looks the same.

import { Pen } from "./draw";
import type { CombatClass, DamageType } from "../creatures/creatureData";

export const SLAB_W = 64;
export const SLAB_H = 34;

// Old flagstone: warm grey-brown, mottled.
const STONE = ["#4b463f", "#534e46", "#5b554c", "#46413a"];
const LIT = "#756d60";      // the worn top-left bevel, and the lip under a cut
const SHADE = "#2e2b26";    // the bottom-right bevel
const CRACK = "#221f1b";
const MOSS = "#3c4a2e";
// The pigment in the carving's groove, and the darker cut along its top edge.
const PIGMENT: Record<CombatClass, { fill: string; cut: string }> = {
  melee:  { fill: "#9a3328", cut: "#4a1712" },
  ranged: { fill: "#3a8a46", cut: "#16381c" },
  magic:  { fill: "#3a6cb0", cut: "#16294a" },
};

// A small seeded random number generator (so each move's stone is stable).
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);

// The carved design, as a mask (pixels marked "X"): low enough to leave the
// top for the name, and finishing before the energy circle in the
// bottom-right corner.
function carving(type: DamageType): Pen {
  const p = new Pen(SLAB_W, SLAB_H);
  const X = "X";
  const cy = 21; // the middle line of the design
  if (type === "pierce") {
    p.line(8, cy, 38, cy, 2, X);                                   // shaft
    p.poly([[37, cy - 5], [47, cy], [37, cy + 5], [40, cy]], X);   // the head
    p.line(8, cy, 4, cy - 4, 1.4, X).line(8, cy, 4, cy + 4, 1.4, X);   // fletching
    p.line(12, cy, 8, cy - 4, 1.4, X).line(12, cy, 8, cy + 4, 1.4, X);
    // The force of it: a cone wrapping round the head, streaming back past the shaft.
    p.path([[47, cy - 3], [44, cy - 7], [38, cy - 9], [30, cy - 8], [23, cy - 6]], 1.2, X);
    p.path([[47, cy + 3], [44, cy + 7], [38, cy + 9], [30, cy + 8], [23, cy + 6]], 1.2, X);
  }
  if (type === "force") {
    p.line(3, cy + 4, 22, cy + 4, 5, X);                            // forearm, thrusting right
    p.rect(21, cy - 3, 29, cy + 6, X);                              // the heel of the palm
    // Fingers pointing up, with gaps between them.
    for (const [x, top] of [[21.5, cy - 9], [24.5, cy - 11], [27.5, cy - 10], [30, cy - 7]] as const) p.line(x, cy - 2, x, top, 1.7, X);
    p.line(21, cy + 3, 16, cy - 2, 2, X);                           // thumb
    // The impact: a burst just in front of the palm.
    p.path([[33, cy - 7], [35, cy], [33, cy + 7]], 1.3, X);
    for (const [x, y] of [[42, cy - 9], [45, cy - 3], [45, cy + 4], [42, cy + 10], [38, cy - 12], [38, cy + 12]] as const) p.line(36, cy, x, y, 1.3, X);
    // Motion lines behind the arm.
    p.line(2, cy - 3, 11, cy - 3, 1, X).line(4, cy + 10, 13, cy + 10, 1, X);
  }
  if (type === "arcane") {
    p.path([[3, cy + 6], [13, cy - 2], [18, cy + 4], [28, cy - 5], [32, cy + 2], [39, cy - 3]], 2.4, X); // the bolt
    p.poly([[37, cy - 6], [45, cy - 2], [38, cy + 1]], X);            // the sharp spike
    p.ellipse(47, cy - 1.5, 2.4, 1.7, X);                             // the orb at its tip
    // Sparks flying off it.
    for (const [x0, y0, x1, y1] of [[11, cy - 7, 9, cy - 10], [20, cy + 9, 19, cy + 12], [30, cy - 10, 32, cy - 13], [35, cy + 7, 38, cy + 9], [49, cy - 6, 51, cy - 9], [6, cy - 1, 4, cy - 4], [43, cy + 4, 45, cy + 7]] as const) p.line(x0, y0, x1, y1, 1, X);
  }
  return p;
}

// The slab: rows of CSS colours ("" = no pixel, at chipped corners).
export function moveSlab(name: string, type: DamageType, cls: CombatClass): string[][] {
  const r = rng(hash(name));
  const W = SLAB_W, H = SLAB_H;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(""));

  // Mottled stone: blotches of 4×4 plus a little per-pixel grain.
  const blotch = Array.from({ length: Math.ceil(H / 4) }, () => Array.from({ length: Math.ceil(W / 4) }, () => Math.floor(r() * STONE.length)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = blotch[y >> 2][x >> 2];
    g[y][x] = r() < 0.12 ? STONE[Math.floor(r() * STONE.length)] : STONE[b];
  }

  // Cracks: a couple of wandering lines in from the edges, a fleck of moss in one.
  const cracks = 2 + Math.floor(r() * 2);
  for (let c = 0; c < cracks; c++) {
    const fromLeft = r() < 0.5;
    let x = fromLeft ? (r() < 0.5 ? 0 : W - 1) : Math.floor(r() * W);
    let y = fromLeft ? Math.floor(r() * H) : (r() < 0.5 ? 0 : H - 1);
    const dx = x === 0 ? 1 : x === W - 1 ? -1 : (r() < 0.5 ? -1 : 1);
    const dy = y === 0 ? 1 : y === H - 1 ? -1 : (r() < 0.5 ? -1 : 1);
    const len = 6 + Math.floor(r() * 10);
    for (let i = 0; i < len; i++) {
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      g[y][x] = CRACK;
      if (y + 1 < H && r() < 0.5) g[y + 1][x] = g[y + 1][x] === CRACK ? CRACK : LIT; // a lit edge under the crack
      if (r() < 0.6) x += dx; else y += dy;
      if (r() < 0.2) y += r() < 0.5 ? -dy : dy;
    }
    if (c === 0 && x > 1 && y > 1 && x < W - 1 && y < H - 1) { g[y][x] = MOSS; g[y][x - 1] = MOSS; }
  }

  // The carving: pigment in the groove, a dark cut along its top edge, a lit lip below.
  const mask = carving(type).g;
  const cut = (x: number, y: number) => mask[y]?.[x] === "X";
  const pig = PIGMENT[cls];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cut(x, y)) g[y][x] = !cut(x, y - 1) || !cut(x - 1, y) ? pig.cut : pig.fill;
    else if (cut(x, y - 1) || cut(x - 1, y - 1)) g[y][x] = LIT;
  }

  // Bevel: worn light top and left, dark bottom and right.
  for (let x = 0; x < W; x++) { g[0][x] = LIT; g[H - 1][x] = SHADE; if (r() < 0.5) g[H - 2][x] = SHADE; }
  for (let y = 0; y < H; y++) { g[y][0] = LIT; g[y][W - 1] = SHADE; }
  // Chipped corners and a nick or two out of the edges.
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]] as const) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { g[cy][cx + sx * i] = ""; g[cy + sy * i][cx] = ""; }
    g[cy + sy][cx + sx] = "";
  }
  for (let i = 0; i < 2; i++) {
    const x = 6 + Math.floor(r() * (W - 12));
    const top = r() < 0.5;
    g[top ? 0 : H - 1][x] = ""; g[top ? 0 : H - 1][x + 1] = "";
  }
  return g;
}
