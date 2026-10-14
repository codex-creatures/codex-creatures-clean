// lib/sprites/draw.ts
// A tiny pixel-art toolkit for drawing sprites on the fine grid in code:
// filled ellipses, polygons and thick lines, each with optional shading
// (light from the top left), and mirroring for symmetrical creatures.
// The renderer adds the dark outline, so shapes are drawn without one.
//
// Colours are PALETTE letters (lib/sprites/pixels.ts). A fill can be a
// letter, or a Tone — [light, mid, dark] — shaded across the shape.

import { fine, type Sprite } from "./pixels";

export const SIZE = 44;

export type Tone = readonly [light: string, mid: string, dark: string];
type Fill = string | Tone;

// Shade a point of a shape: u, v in -1…1 across it (0 = middle).
function toneAt(fill: Fill, u: number, v: number): string {
  if (typeof fill === "string") return fill;
  const lit = -u * 0.55 - v * 0.85; // light comes from the top left
  return lit > 0.42 ? fill[0] : lit < -0.48 ? fill[2] : fill[1];
}

export class Pen {
  g: string[][];
  constructor(public w = SIZE, public h = SIZE) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill("."));
  }

  dot(x: number, y: number, c: string) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
    return this;
  }
  at(x: number, y: number) { return this.g[y]?.[x] ?? "."; }

  // Every pixel whose centre is inside the shape (tested by `inside`), shaded
  // across its bounding box.
  private fillShape(x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, fill: Fill) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!inside(px, py)) continue;
      const u = ((px - x0) / Math.max(0.01, x1 - x0)) * 2 - 1, v = ((py - y0) / Math.max(0.01, y1 - y0)) * 2 - 1;
      this.dot(x, y, toneAt(fill, u, v));
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, fill: Fill) {
    return this.fillShape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, fill);
  }
  circle(cx: number, cy: number, r: number, fill: Fill) { return this.ellipse(cx, cy, r, r, fill); }
  rect(x0: number, y0: number, x1: number, y1: number, fill: Fill) {
    return this.fillShape(x0, y0, x1, y1, (x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1, fill);
  }
  // A filled polygon (points in order).
  poly(pts: [number, number][], fill: Fill) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return this.fillShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), inside, fill);
  }
  // A thick line with round ends.
  line(x0: number, y0: number, x1: number, y1: number, width: number, fill: Fill) {
    const r = width / 2;
    const dist = (x: number, y: number) => {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2));
      return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
    };
    return this.fillShape(Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r, (x, y) => dist(x, y) <= r, fill);
  }
  // A curve through points (a chain of thick lines).
  path(pts: [number, number][], width: number, fill: Fill) {
    for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], width, fill);
    return this;
  }

  // Copy the left half onto the right, mirrored (for front-facing creatures).
  mirror() {
    for (const row of this.g) for (let x = 0; x < this.w / 2; x++) row[this.w - 1 - x] = row[x];
    return this;
  }
  // Swap one colour for another (e.g. to recolour a part).
  swap(from: string, to: string) {
    for (const row of this.g) for (let x = 0; x < row.length; x++) if (row[x] === from) row[x] = to;
    return this;
  }

  sprite(): Sprite { return fine(this.g.map((r) => r.join(""))); }
}

export const draw = (f: (p: Pen) => void): Sprite => { const p = new Pen(); f(p); return p.sprite(); };

// Common tones.
export const T = {
  green:  ["N", "E", "e"] as Tone,  leaf:   ["E", "e", "f"] as Tone,
  grey:   ["S", "s", "t"] as Tone,  stone:  ["B", "b", "n"] as Tone,
  fur:    ["L", "l", "m"] as Tone,  sand:   ["I", "i", "j"] as Tone,
  bone:   ["h", "I", "i"] as Tone,  gold:   ["G", "g", "a"] as Tone,
  purple: ["P", "p", "q"] as Tone,  cyan:   ["C", "c", "u"] as Tone,
  red:    ["R", "r", "x"] as Tone,  amber:  ["A", "a", "l"] as Tone,
  wood:   ["W", "w", "d"] as Tone,  hide:   ["V", "v", "D"] as Tone,
  dark:   ["b", "n", "k"] as Tone,  void:   ["p", "q", "J"] as Tone,
};
