// lib/sprites/pixels.ts
// Pixel-art sprites drawn as text grids, in the same chunky style as the
// dungeon. Each character is one pixel (see PALETTE; "." is empty). The
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
  b: "#5b6276", B: "#8a92a6", n: "#3a3f4c",            // stone
  l: "#8b5a2b", L: "#b98150", m: "#5c3a1a",            // leather
  a: "#e88a1a", A: "#ffc04d",                          // amber
  y: "#ffe14d",                                        // lightning
  h: "#f6f2e8",                                        // white
  k: "#101010",                                        // black (pupils)
  z: "#e37aa0",                                        // pink
  i: "#9b8a74", I: "#c9b89c", j: "#6b5d4c",            // dust / sand
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
