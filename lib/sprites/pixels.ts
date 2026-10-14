// lib/sprites/pixels.ts
// Pixel-art sprites drawn as text grids, in the same chunky style as the
// Den. Each character is one pixel (see PALETTE; "." is empty). The
// renderer adds a dark outline around every sprite, so grids only draw the
// shapes themselves.

export const PALETTE: Record<string, string> = {
  o: "#15110d",                                       // outline (added automatically)
  w: "#7a4a26", W: "#a8703c", d: "#4a2c16",            // wood
  s: "#8e98ab", S: "#d8dee9", t: "#555d6e",            // steel
  g: "#d9a441", G: "#ffe08a",                          // gold
  p: "#7b3fc4", P: "#b58cff", q: "#46207a",            // void purple
  c: "#3fb6e8", C: "#b8f0ff", u: "#1f6f99",            // aether cyan
  r: "#b83a2e", R: "#ff7a62", x: "#6e1f18",            // red
  e: "#4c9a3e", E: "#8fd16e", f: "#2d5e26",            // green
  N: "#c2ec9c", O: "#1e3b19",                          // green highlight / deep shadow
  b: "#5b6276", B: "#8a92a6", n: "#3a3f4c",            // stone
  l: "#8b5a2b", L: "#b98150", m: "#5c3a1a",            // leather
  a: "#e88a1a", A: "#ffc04d",                          // amber
  y: "#ffe14d",                                        // lightning
  h: "#f6f2e8",                                        // white
  k: "#101010",                                        // black (pupils)
  z: "#e37aa0",                                        // pink
  i: "#9b8a74", I: "#c9b89c", j: "#6b5d4c",            // dust / sand
  v: "#9a8a5e", V: "#c4b27e", D: "#5e5236",            // cyclops hide
};

export type Sprite = string[];

// The grid with its outline: every empty pixel touching a filled one
// (including diagonally) becomes "o". The grid grows by 1px on each side.
export function outlined(sprite: Sprite): string[][] {
  const h = sprite.length + 2, w = Math.max(...sprite.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => sprite[y - 1]?.[x - 1] ?? ".";
  const out: string[][] = [];
  for (let y = 0; y < h; y++) {
    const row: string[] = [];
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      if (c !== ".") { row.push(c); continue; }
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && at(x + dx, y + dy) !== "." && at(x + dx, y + dy) !== "o") { edge = true; break; }
      }
      row.push(edge ? "o" : ".");
    }
    out.push(row);
  }
  return out;
}

// Horizontal runs of one colour: [x, y, length, colour] (for drawing as few rects as possible).
export function runs(grid: string[][]): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== "." && PALETTE[c]) out.push([x, y, n, PALETTE[c]]);
      x += n;
    }
  });
  return out;
}

// ── The fine grid ─────────────────────────────────────────────────
// Sprites are shown on a grid twice as fine as they're drawn: every pixel
// becomes 2×2 ("1 pixel into 4"), smoothed with Scale2x so stair-step
// diagonals and curves come out cleaner, and the outline is one fine pixel.
// A sprite drawn natively on the fine grid (fine()) is used as it is.
const FINE = new WeakSet<Sprite>();
export function fine(sprite: Sprite): Sprite {
  FINE.add(sprite);
  return sprite;
}

// Scale2x (AdvMAME2x): each pixel becomes four; a corner takes its
// neighbours' colour where two of them agree and the other two don't.
export function scale2x(sprite: Sprite): Sprite {
  const h = sprite.length, w = Math.max(...sprite.map((r) => r.length));
  const at = (x: number, y: number) => (x < 0 || y < 0 || y >= h ? "." : sprite[y][x] ?? ".");
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let top = "", bottom = "";
    for (let x = 0; x < w; x++) {
      const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
      top    += (c === a && c !== d && a !== b ? a : p) + (a === b && a !== c && b !== d ? b : p);
      bottom += (d === c && d !== b && c !== a ? c : p) + (b === d && b !== a && d !== c ? d : p);
    }
    out.push(top, bottom);
  }
  return out;
}

// Each colour's lighter and darker tone (same family in PALETTE).
const LIGHTER: Record<string, string> = { e: "E", E: "N", s: "S", w: "W", l: "L", b: "B", i: "I", v: "V", p: "P", c: "C", r: "R", a: "A", g: "G", t: "s", n: "b", m: "l", d: "w", f: "e", D: "v", j: "i", u: "c", q: "p", x: "r" };
const DARKER: Record<string, string> = { N: "E", E: "e", e: "f", S: "s", s: "t", W: "w", w: "d", L: "l", l: "m", B: "b", b: "n", I: "i", i: "j", V: "v", v: "D", P: "p", p: "q", C: "c", c: "u", R: "r", r: "x", A: "a", G: "g" };

// A light rim along the top of every shape and a dark one along the bottom
// (one fine pixel each), so upscaled sprites get some depth.
export function shade(sprite: Sprite): Sprite {
  const at = (x: number, y: number) => sprite[y]?.[x] ?? ".";
  return sprite.map((row, y) => [...row].map((c, x) => {
    if (c === "." || c === "k" || c === "h") return c;
    if (at(x, y - 1) === ".") return LIGHTER[c] ?? c;
    if (at(x, y + 1) === ".") return DARKER[c] ?? c;
    return c;
  }).join(""));
}

export const fineGrid = (sprite: Sprite): Sprite => (FINE.has(sprite) ? sprite : shade(scale2x(sprite)));

// A sprite's width in drawn (coarse) pixels — for picking a display scale.
export const spriteWidth = (sprite: Sprite): number => {
  const w = Math.max(...sprite.map((r) => r.length));
  return FINE.has(sprite) ? w / 2 : w;
};
