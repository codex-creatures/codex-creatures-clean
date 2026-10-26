// lib/sprites/moveSlab.ts
// A move's button as an old, cracked stone tablet, drawn as pixel art, in
// its race's stone (the race colours, lib/creatures/creatureData.ts RACE_INFO;
// grey slate for a Balanced move). Each move gets its own cracks (seeded by
// its name), so a tablet always looks the same. Behind the name, big and in a
// darker shade of the stone, is the icon for its style: an impact (melee), an
// arrow (ranged), a bolt (magic). (Under the old rules the stone was its
// style's and the icon its damage type: Force, Pierce, Arcane.) The name
// itself is drawn on top by the button (components/MoveTile.tsx).

import type { CombatClass, DamageType } from "../creatures/creatureData";
import type { RaceV2 } from "../creatures/racesV2";
import { Pen } from "./draw";

export const SLAB_W = 64;
export const SLAB_H = 30;

// Each stone: mottled face shades, the worn lit edge, the shadowed edge,
// cracks — and the colours its name is cut in with.
// deep: the darker shade the background icon is set in.
export type SlabStone = RaceV2 | "balanced";
type Stone = { face: string[]; lit: string; shade: string; crack: string; cut: string; lip: string; deep: string };
const RED: Stone = { face: ["#7a3329", "#83382d", "#8d3e32", "#712f26"], lit: "#a8594b", shade: "#3d1813", crack: "#2c100c", cut: "#2a0d09", lip: "#c8796a", deep: "#3a120c" };
const GREEN: Stone = { face: ["#36603a", "#3c6a40", "#437446", "#315737"], lit: "#62935f", shade: "#1a301c", crack: "#122214", cut: "#0e2211", lip: "#86b882", deep: "#1c3920" };
const BLUE: Stone = { face: ["#34517d", "#3a5988", "#416292", "#2f4a73"], lit: "#5f82b6", shade: "#182841", crack: "#101c30", cut: "#0c182c", lip: "#86a7d8", deep: "#1a2d4d" };
export const SLAB_STONE: Record<SlabStone, Stone> = {
  geo: RED, beast: GREEN, humanoid: BLUE,
  undead:   { face: ["#6f6c63", "#77746a", "#807c72", "#68655c"], lit: "#a29e92", shade: "#33312c", crack: "#24221f", cut: "#201f1b", lip: "#c3bfb2", deep: "#383631" },
  toxic:    { face: ["#5b3a78", "#634082", "#6c478c", "#54356e"], lit: "#8a67ad", shade: "#2c1a3b", crack: "#1f1229", cut: "#1b0f25", lip: "#ad8ad0", deep: "#2e1a40" },
  underkin: { face: ["#6b4a2c", "#745131", "#7d5836", "#634428"], lit: "#9c7550", shade: "#352313", crack: "#26190d", cut: "#22160b", lip: "#c09a72", deep: "#3a2715" },
  divine:   { face: ["#86691f", "#907224", "#9a7b29", "#7c611c"], lit: "#c3a24c", shade: "#433310", crack: "#31250a", cut: "#2c2108", lip: "#e3c56e", deep: "#4a3a12" },
  balanced: { face: ["#454850", "#4b4e57", "#52555e", "#3f424a"], lit: "#70747f", shade: "#222428", crack: "#17181c", cut: "#141518", lip: "#959aa5", deep: "#25272c" },
};
// The stone each style had under the old rules.
export const STYLE_STONE: Record<CombatClass, SlabStone> = { melee: "geo", ranged: "beast", magic: "humanoid" };
// The icon each style shows (Combat V2): the old damage types' shapes.
export const STYLE_ICON: Record<CombatClass, DamageType> = { melee: "force", ranged: "pierce", magic: "arcane" };
// The big background silhouettes, drawn at the tablet's own size.
function backgroundIcon(type: DamageType): Pen {
  const p = new Pen(SLAB_W, SLAB_H);
  const X = "X", cx = 32, cy = 15;
  if (type === "force") {
    // An impact: an eight-pointed starburst.
    const pts: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 === 0 ? 14 : 6;
      pts.push([cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r]);
    }
    p.poly(pts, X);
  }
  if (type === "pierce") {
    // An arrow, flying left to right.
    p.rect(10, cy - 1, 44, cy + 1, X);                              // shaft
    p.poly([[41, cy - 9], [57, cy], [41, cy + 9], [45, cy]], X);    // head
    p.poly([[8, cy - 1], [14, cy - 1], [8, cy - 8], [3, cy - 8]], X);   // fletching
    p.poly([[8, cy + 1], [14, cy + 1], [8, cy + 8], [3, cy + 8]], X);
  }
  if (type === "arcane") {
    // A lightning bolt, with an orb at its tip.
    p.poly([[27, 1], [41, 1], [34, 11], [43, 11], [27, 26], [31, 15], [22, 15]], X);
    p.ellipse(25, 27, 3.2, 2.2, X);
  }
  return p;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);

// The tablet: rows of CSS colours ("" = no pixel, at chipped corners).
export function moveSlab(name: string, stone: SlabStone, type?: DamageType): string[][] {
  const r = rng(hash(name));
  const st = SLAB_STONE[stone];
  const W = SLAB_W, H = SLAB_H;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(""));

  // Mottled stone: blotches of 4×4 plus a little per-pixel grain.
  const blotch = Array.from({ length: Math.ceil(H / 4) }, () => Array.from({ length: Math.ceil(W / 4) }, () => Math.floor(r() * st.face.length)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    g[y][x] = r() < 0.12 ? st.face[Math.floor(r() * st.face.length)] : st.face[blotch[y >> 2][x >> 2]];
  }

  // The icon (its style, or how it hurts under the old rules), big, in a darker shade, behind the name.
  if (type) {
    const mask = backgroundIcon(type).g;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y][x] === "X") g[y][x] = st.deep;
  }

  // A few hairline cracks, in from the edges.
  const cracks = 2 + Math.floor(r() * 2);
  for (let c = 0; c < cracks; c++) {
    const side = Math.floor(r() * 4);
    let x = side === 0 ? 0 : side === 1 ? W - 1 : Math.floor(r() * W);
    let y = side === 2 ? 0 : side === 3 ? H - 1 : Math.floor(r() * H);
    const dx = side === 0 ? 1 : side === 1 ? -1 : r() < 0.5 ? -1 : 1;
    const dy = side === 2 ? 1 : side === 3 ? -1 : r() < 0.5 ? -1 : 1;
    const len = 5 + Math.floor(r() * 8);
    for (let i = 0; i < len; i++) {
      if (x < 0 || y < 0 || x >= W || y >= H) break;
      g[y][x] = st.crack;
      if (y + 1 < H && r() < 0.4 && g[y + 1][x] !== st.crack) g[y + 1][x] = st.lit;
      if (r() < 0.6) x += dx; else y += dy;
    }
  }

  // Bevel: worn light top and left, dark bottom and right.
  for (let x = 0; x < W; x++) { g[0][x] = st.lit; g[1][x] = r() < 0.5 ? st.lit : g[1][x]; g[H - 1][x] = st.shade; g[H - 2][x] = st.shade; }
  for (let y = 0; y < H; y++) { g[y][0] = st.lit; g[y][W - 1] = st.shade; g[y][W - 2] = r() < 0.5 ? st.shade : g[y][W - 2]; }
  // Chipped corners and a nick or two out of the edges.
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W - 1, 0, -1, 1], [0, H - 1, 1, -1], [W - 1, H - 1, -1, -1]] as const) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { g[cy][cx + sx * i] = ""; g[cy + sy * i][cx] = ""; }
    g[cy + sy][cx + sx] = "";
  }
  for (let i = 0; i < 2; i++) {
    const x = 6 + Math.floor(r() * (W - 12));
    const row = r() < 0.5 ? 0 : H - 1;
    g[row][x] = ""; g[row][x + 1] = "";
  }
  return g;
}
