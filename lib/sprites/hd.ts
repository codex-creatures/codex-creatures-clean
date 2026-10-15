// lib/sprites/hd.ts
// The detailed ("HD") pixel painter, for creatures and items in the richer
// style: each part is painted as a rounded form lit from the top left, its
// colour picked from a ramp (darkest → lightest) with ordered dithering
// between the steps, so shading reads like hand-placed pixels. Parts get a
// darker inner outline where they overlap, the whole sprite a dark outer
// outline, and anything "emissive" (eyes, magic) glows without shading.
//
// A sprite is a grid of CSS colours (null = empty). Draw parts back to front.

export type HDSprite = { w: number; h: number; px: (string | null)[][] };
export type Ramp = readonly string[]; // darkest → lightest (4–6 steps work well)

type Pt = [number, number];

// Light from the top left, a little in front.
const L = (() => { const v = [-0.55, -0.7, 0.45]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
// 4×4 Bayer matrix, for dithering between ramp steps.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export const OUTLINE = "#120d14";

// A seeded random number generator (textures stay the same each time).
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

type PartOpts = {
  round?: number;     // how rounded the form is (px to reach full height; bigger = softer)
  bias?: number;      // brighten (+) or darken (−) the whole part, in ramp steps
  flat?: boolean;     // no shading: the middle of the ramp (or `emissive`)
  emissive?: string;  // a glowing colour (no shading, no inner outline)
  outline?: boolean;  // inner outline where it sits over other parts (default true)
  spots?: { color: string; density: number; seed?: number }; // texture flecks
};

export class Painter {
  w: number; h: number;
  px: (string | null)[][];
  part: number[][];           // which part each pixel belongs to (0 = none)
  dark: Record<number, string> = {}; // each part's outline colour
  emissive = new Set<number>();
  private next = 1;

  constructor(w = 64, h = 64) {
    this.w = w; this.h = h;
    this.px = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
    this.part = Array.from({ length: h }, () => Array<number>(w).fill(0));
  }

  // Paint a part from a mask (pixel centres inside the shape).
  fill(inside: (x: number, y: number) => boolean, ramp: Ramp, o: PartOpts = {}) {
    const { w, h } = this;
    const mask: boolean[][] = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => inside(x + 0.5, y + 0.5)));
    // Distance to the shape's edge (chamfer), for a height field.
    const INF = 1e9;
    const d: number[][] = mask.map((row) => row.map((m) => (m ? INF : 0)));
    for (let pass = 0; pass < 2; pass++) {
      const ys = pass ? [...Array(h).keys()].reverse() : [...Array(h).keys()];
      const xs = pass ? [...Array(w).keys()].reverse() : [...Array(w).keys()];
      const s = pass ? 1 : -1;
      for (const y of ys) for (const x of xs) {
        if (!mask[y][x]) continue;
        const a = d[y + s]?.[x] ?? 0, b = d[y]?.[x + s] ?? 0, c = d[y + s]?.[x + s] ?? 0, e = d[y + s]?.[x - s] ?? 0;
        d[y][x] = Math.min(d[y][x], a + 1, b + 1, c + 1.4, e + 1.4);
      }
    }
    const R = o.round ?? 5;
    const height = (x: number, y: number) => {
      const v = d[y]?.[x] ?? 0;
      const t = Math.min(1, v / R);
      return Math.sqrt(1 - (1 - t) * (1 - t)); // a rounded profile
    };
    const id = this.next++;
    this.dark[id] = ramp[0];
    if (o.emissive) this.emissive.add(id);
    const rand = rng(o.spots?.seed ?? id * 977);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y][x]) continue;
      let color: string;
      if (o.emissive) color = o.emissive;
      else if (o.flat) color = ramp[Math.floor(ramp.length / 2)];
      else {
        // Normal from the height field's slope.
        const nx = (height(x - 1, y) - height(x + 1, y)) * R * 0.5;
        const ny = (height(x, y - 1) - height(x, y + 1)) * R * 0.5;
        const nz = 1;
        const m = Math.hypot(nx, ny, nz);
        const lit = (nx * L[0] + ny * L[1] + nz * L[2]) / m; // 0…1 mostly
        const t = Math.max(0, Math.min(0.999, (lit - 0.15) / 0.85 + (o.bias ?? 0) / ramp.length));
        const f = t * (ramp.length - 1);
        const i = Math.floor(f);
        const step = f - i > BAYER[(y % 4) * 4 + (x % 4)] ? i + 1 : i;
        color = ramp[Math.min(ramp.length - 1, step)];
      }
      if (o.spots && !o.emissive && rand() < o.spots.density) color = o.spots.color;
      this.px[y][x] = color;
      this.part[y][x] = id;
    }
    // Inner outline: this part's edge where it lies over another part.
    if (o.outline !== false && !o.emissive) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (this.part[y][x] !== id) continue;
        const over = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const p = this.part[y + dy]?.[x + dx];
          return p !== undefined && p !== 0 && p !== id && !this.emissive.has(p);
        });
        if (over) this.px[y][x] = ramp[0];
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: PartOpts = {}) {
    return this.fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, ramp, { round: Math.min(rx, ry) * 0.9, ...o });
  }
  circle(cx: number, cy: number, r: number, ramp: Ramp, o: PartOpts = {}) { return this.ellipse(cx, cy, r, r, ramp, o); }
  poly(pts: Pt[], ramp: Ramp, o: PartOpts = {}) {
    const inside = (x: number, y: number) => {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    return this.fill(inside, ramp, o);
  }
  // A thick stroke through points, tapering from w0 to w1 (a limb, a tail, a horn).
  limb(pts: Pt[], w0: number, w1: number, ramp: Ramp, o: PartOpts = {}) {
    const segs = pts.slice(1).map((p, i) => [pts[i], p] as const);
    const total = segs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0) || 1;
    const inside = (x: number, y: number) => {
      let along = 0;
      for (const [a, b] of segs) {
        const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, l = Math.sqrt(l2);
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
        const r = (w0 + (w1 - w0) * ((along + t * l) / total)) / 2;
        if (Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)) <= r) return true;
        along += l;
      }
      return false;
    };
    return this.fill(inside, ramp, { round: Math.max(w0, w1) * 0.45, ...o });
  }
  dot(x: number, y: number, color: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[Math.floor(y)][Math.floor(x)] = color;
    return this;
  }
  // A glowing eye: a bright iris, a slit or dot pupil, a hot highlight.
  eye(cx: number, cy: number, r: number, iris: string, glow: string, pupil = "#1a0d06", slit = false) {
    this.ellipse(cx, cy, r, r * 0.8, [iris], { emissive: iris });
    for (let y = -1; y <= 1; y++) this.dot(cx + (slit ? 0 : 0), cy + y * (slit ? 1 : 0), pupil);
    if (!slit) this.dot(cx, cy, pupil).dot(cx + 0.6, cy, pupil);
    this.dot(cx - r * 0.45, cy - r * 0.35, glow);
    return this;
  }

  // The finished sprite, with a dark outline round everything (`thick` px).
  sprite(thick = 1): HDSprite {
    const { w, h } = this;
    let cur = this.px.map((row) => [...row]);
    for (let pass = 0; pass < thick; pass++) {
      const next = cur.map((row) => [...row]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (cur[y][x]) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cur[y + dy]?.[x + dx])) next[y][x] = OUTLINE;
      }
      cur = next;
    }
    return { w, h, px: cur };
  }
}

export const paint = (f: (p: Painter) => void, w = 64, h = 64, outline = 1): HDSprite => { const p = new Painter(w, h); f(p); return p.sprite(outline); };

// Mirror a sprite left↔right (creatures face left; yours face right in battle).
export const mirrorHD = (s: HDSprite): HDSprite => ({ ...s, px: s.px.map((r) => [...r].reverse()) });
