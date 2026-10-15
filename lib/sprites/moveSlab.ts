// lib/sprites/moveSlab.ts
// A move's button as an old, cracked stone tablet, drawn as pixel art, in
// its style's stone: red for melee, green for ranged, blue for magic. Each
// move gets its own cracks (seeded by its name), so a tablet always looks the
// same. The name is chiselled into it by the button (components/MoveTile.tsx).
// Also: the little carved icons for how a move hurts (Force, Pierce, Arcane).

import type { CombatClass, DamageType } from "../creatures/creatureData";
import type { Sprite } from "./pixels";

export const SLAB_W = 64;
export const SLAB_H = 30;

// Each style's stone: mottled face shades, the worn lit edge, the shadowed
// edge, cracks — and the colours its name is cut in with.
export const SLAB_STONE: Record<CombatClass, { face: string[]; lit: string; shade: string; crack: string; cut: string; lip: string }> = {
  melee:  { face: ["#7a3329", "#83382d", "#8d3e32", "#712f26"], lit: "#a8594b", shade: "#3d1813", crack: "#2c100c", cut: "#2a0d09", lip: "#c8796a" },
  ranged: { face: ["#36603a", "#3c6a40", "#437446", "#315737"], lit: "#62935f", shade: "#1a301c", crack: "#122214", cut: "#0e2211", lip: "#86b882" },
  magic:  { face: ["#34517d", "#3a5988", "#416292", "#2f4a73"], lit: "#5f82b6", shade: "#182841", crack: "#101c30", cut: "#0c182c", lip: "#86a7d8" },
};

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hash = (text: string) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);

// The tablet: rows of CSS colours ("" = no pixel, at chipped corners).
export function moveSlab(name: string, cls: CombatClass): string[][] {
  const r = rng(hash(name));
  const st = SLAB_STONE[cls];
  const W = SLAB_W, H = SLAB_H;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(""));

  // Mottled stone: blotches of 4×4 plus a little per-pixel grain.
  const blotch = Array.from({ length: Math.ceil(H / 4) }, () => Array.from({ length: Math.ceil(W / 4) }, () => Math.floor(r() * st.face.length)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    g[y][x] = r() < 0.12 ? st.face[Math.floor(r() * st.face.length)] : st.face[blotch[y >> 2][x >> 2]];
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

// How a move hurts, as a little carved icon (drawn pale, to read on any stone).
export const DAMAGE_ICONS: Record<DamageType, Sprite> = {
  // Force: an impact, a fist-sized burst.
  force: [
    "...h...",
    ".h.I.h.",
    "..IhI..",
    "hIhhhIh",
    "..IhI..",
    ".h.I.h.",
    "...h...",
  ],
  // Pierce: an arrowhead.
  pierce: [
    "....I...",
    "....hI..",
    "IIIIhhI.",
    "hhhhhhhh",
    "IIIIhhI.",
    "....hI..",
    "....I...",
  ],
  // Arcane: a bolt with an orb at its tip.
  arcane: [
    "......hh",
    "....Ihhh",
    "...hI.hI",
    "..hhI...",
    ".IhhhI..",
    "...hI...",
    "..hI....",
    ".hI.....",
    "hI......",
  ],
};
