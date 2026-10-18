// lib/dungeon/chamber.ts
// A dungeon room, drawn as pixel art in code (like the Den in
// lib/den/scene.ts): you stand at the front of a damp stone chamber looking
// in. The back wall has one tunnel for every way on — the left-most tunnel
// heads furthest west — and tapping a tunnel walks you down it.
//
// - The static room (wet stone, moss, puddles, tunnel mouths) is built once.
// - Each frame re-lights it with two flickering wall torches, then draws the
//   moving bits: flames, water dripping from the ceiling and rippling the
//   puddles, mist creeping over the floor, and now and then a pair of eyes
//   in an unknown tunnel. A healing pool glows on its own.
// - Every pixel remembers which tunnel it belongs to, so clicks are
//   pixel-accurate.
// - It's drawn on the fine grid: the room is laid out in LW×LH units, and
//   rendered at RES× that, each fine pixel sampling its own spot — smoother
//   edges, thinner mortar, finer grain.

import { hash, vnoise } from "../den/scene";

const LW = 256, LH = 176;   // layout units
const RES = 2;              // fine pixels per unit
export const CW = LW * RES; // the canvas, in fine pixels
export const CH = LH * RES;

// One-point perspective: the back wall is a rectangle, the side walls,
// ceiling and floor are trapezoids running out to the edges of the picture.
// A large room (a den full of creatures) has its back wall further off: a
// smaller back wall, so a deeper, wider-looking room with more floor.
// (The back wall is always centred: BX1 = LW - BX0.)
export type ChamberSize = "normal" | "large";
const GEOMETRY: Record<ChamberSize, { BX0: number; BX1: number; BY0: number; BY1: number }> = {
  normal: { BX0: 44, BX1: 212, BY0: 26, BY1: 112 }, // back wall: left, right, top, floor line
  large:  { BX0: 72, BX1: 184, BY0: 34, BY1: 98 },
};

// What's down a tunnel, as far as you know.
export type TunnelLook = "unknown" | "known" | "boss";

export type ChamberSpec = {
  tunnels: TunnelLook[];       // west to east
  pool?: "glow" | "still";     // a healing pool in the floor (still = used up)
  seed: number;                // so every room looks a little different
  size?: ChamberSize;          // (default normal)
};

export type Chamber = {
  // (extras: false leaves out the drips and the eyes: a still, for painting over)
  render: (t: number, hover: number, open: boolean, extras?: boolean) => ImageData;
  // Just the moving parts, on a see-through background, to lay over a
  // painted room (public/sprites/rooms): the pool, drips, mist, eyes in the
  // dark and the hovered tunnel.
  overlay: (t: number, hover: number, open: boolean) => ImageData;
  idAt: (x: number, y: number) => number;   // 0 = nothing, else tunnel index + 1
  tunnels: { x: number; top: number }[];    // where each tunnel is (for labels)
};

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const pal = (...h: string[]) => h.map(hex);
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const STONES   = pal("#3a4449", "#414c50", "#353f44", "#46514f", "#3d4845", "#4a5357");
const MORTAR   = hex("#161b1e");
const FLAGS    = pal("#353b3f", "#3c4347", "#31373a", "#41484a", "#383f3d");
const FLAG_GAP = hex("#15191b");
const MOSS     = pal("#2f4f27", "#3c6230", "#27431f", "#4a7238");
const ROCK     = pal("#1d2225", "#22282b", "#1a1f21");
const WATER    = hex("#1a2a33");
const POOL     = pal("#2fc4b8", "#3fd9cc", "#27aaa3", "#5ff0e0");
const POOL_DIM = hex("#163a3a");
const DRIP     = hex("#a9dcec");
const MIST: RGB = [0.62, 0.68, 0.72];
const AMBIENT: RGB = [0.22, 0.26, 0.32];
const TORCH: RGB = [1.0, 0.6, 0.28];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => b / 16);

// Stone blocks: a = along the surface, z = height (wall units).
function stone(a: number, z: number, seed: number, bw = 20, bh = 9): RGB {
  const row = Math.floor(z / bh);
  const off = (row & 1) * (bw / 2);
  const col = Math.floor((a + off) / bw);
  const ia = a + off - col * bw, iz = z - row * bh;
  if (ia < 0.6 || iz < 0.6) return MORTAR;
  let k = iz >= bh - 1 ? 1.14 : iz < 1.3 ? 0.84 : ia < 1.2 ? 1.06 : 1;
  k *= 0.9 + hash(Math.floor(a * RES), Math.floor(z * RES) + seed * 31) * 0.16;
  return mul(STONES[Math.floor(hash(col * 7 + seed, row) * STONES.length)], k);
}

// Moss creeping up from the floor, and dark wet streaks running down.
function damp(c: RGB, a: number, z: number, seed: number): { c: RGB; wet: boolean } {
  const m = vnoise(a / 8 + seed, z / 6) + (z < 14 ? (14 - z) / 14 * 0.5 : 0);
  if (m > 0.85) return { c: MOSS[Math.floor(hash(Math.floor(a), Math.floor(z) + seed) * MOSS.length)], wet: false };
  const streak = vnoise(a / 3 + seed * 5, z / 40);
  if (streak > 0.68) return { c: mul(c, 0.62), wet: true };
  return { c, wet: false };
}

export function createChamber(spec: ChamberSpec): Chamber {
  const { BX0, BX1, BY0, BY1 } = GEOMETRY[spec.size ?? "normal"];
  const WALL_H = BY1 - BY0;
  const n = CW * CH;
  const seed = spec.seed % 997;
  const albedo = new Float32Array(n * 3);
  const depth = new Float32Array(n);   // 0 = back wall … 1 = right in front of you
  const kind = new Uint8Array(n);      // 0 lit surface, 1 wet (glints), 2 water, 3 glowing pool, 4 tunnel dark, 5 tunnel rim
  const shade = new Float32Array(n);   // inside a tunnel: how far down it (1 = the mouth, 0 = deep)
  const ids = new Uint8Array(n);

  const put = (i: number, c: RGB, d: number, k = 0) => {
    albedo[i * 3] = c[0]; albedo[i * 3 + 1] = c[1]; albedo[i * 3 + 2] = c[2];
    depth[i] = d; kind[i] = k;
  };

  // ── Tunnels in the back wall ──
  const count = spec.tunnels.length;
  const slot = (BX1 - BX0) / Math.max(1, count);
  const far = WALL_H / 86;  // tunnels are smaller further off (a large room)
  const hw = Math.min(17 * far, slot / 2 - 4);
  const spring = BY1 - 32 * far; // where the straight sides turn into the arch
  const tunnels = spec.tunnels.map((_, i) => ({ x: BX0 + slot * (i + 0.5), top: spring - hw }));
  // How far inside tunnel i's arch (scaled by `grow`) a point is: <1 inside.
  const archIn = (x: number, y: number, i: number, grow = 0) => {
    const dx = x - tunnels[i].x, w = hw + grow;
    if (y > BY1 + grow * 0.2) return 9;
    if (y >= spring) return Math.abs(dx) / w;
    return Math.hypot(dx, y - spring) / w;
  };

  for (let fy = 0; fy < CH; fy++) {
    for (let fx = 0; fx < CW; fx++) {
      const i = fy * CW + fx;
      const x = (fx + 0.5) / RES, y = (fy + 0.5) / RES; // this fine pixel's spot, in layout units
      const leftTop = (x / BX0) * BY0, rightTop = ((LW - x) / BX0) * BY0;
      const leftBot = LH - (x / BX0) * (LH - BY1), rightBot = LH - ((LW - x) / BX0) * (LH - BY1);

      if (x >= BX0 && x < BX1 && y >= BY0 && y < BY1) {
        // Back wall.
        const a = x - BX0, z = BY1 - y;
        const { c, wet } = damp(stone(a, z, seed), a, z, seed);
        put(i, c, 0, wet ? 1 : 0);
      } else if (y < BY0 && y < leftTop && y < rightTop) {
        // Ceiling: rough rock.
        const k = 0.8 + vnoise(x / 6 + seed, y / 4) * 0.4;
        put(i, mul(ROCK[Math.floor(hash(x >> 2, y >> 2) * ROCK.length)], k), 1 - y / BY0);
      } else if (x < BX0 && y >= leftTop && y < leftBot) {
        // Left wall.
        const d = (BX0 - x) / BX0;
        const a = (40 * d) / (1 - 0.6 * d), z = (1 - (y - leftTop) / (leftBot - leftTop)) * WALL_H;
        const { c, wet } = damp(stone(a * 1.4, z, seed + 3, 22, 10), a * 1.4, z, seed + 3);
        put(i, c, d, wet ? 1 : 0);
      } else if (x >= BX1 && y >= rightTop && y < rightBot) {
        // Right wall.
        const d = (x - BX1) / (LW - BX1);
        const a = (40 * d) / (1 - 0.6 * d), z = (1 - (y - rightTop) / (rightBot - rightTop)) * WALL_H;
        const { c, wet } = damp(stone(a * 1.4, z, seed + 7, 22, 10), a * 1.4, z, seed + 7);
        put(i, c, d, wet ? 1 : 0);
      } else if (y >= BY1) {
        // Floor: flagstones in perspective, with puddles.
        const f = (y - BY1) / (LH - BY1);
        const D = 1 / (0.28 + 0.72 * f);           // distance into the room
        const half = (BX1 - BX0) / 2 + f * BX0;
        const u = (x - LW / 2) / half;             // -1 … 1 across
        const row = Math.floor(D * 4);
        const col = Math.floor(u * 4 + (row & 1) * 0.5);
        const fu = u * 4 + (row & 1) * 0.5 - col, fv = D * 4 - row;
        const gap = fu < 0.035 * (1 + f) / 1.6 || fv < 0.05 / D;
        let c = gap ? FLAG_GAP : mul(FLAGS[Math.floor(hash(col + seed, row) * FLAGS.length)], 0.88 + hash(fx, fy) * 0.14);
        let k = 0;
        if (vnoise(u * 3 + seed, D * 1.6) > 0.6) { c = mix(c, WATER, 0.85); k = 2; }
        put(i, c, f, k);
      } else {
        put(i, ROCK[0], 0.5);
      }

      // Stalactites hanging from where the ceiling meets the back wall.
      if (x >= BX0 && x < BX1 && y >= BY0 && y < BY0 + 12) {
        const col = Math.floor((x - BX0) / 5);
        const len = hash(col + seed, 77) > 0.45 ? 3 + hash(col, seed) * 9 : 0;
        const w = 2.5 * (1 - (y - BY0) / Math.max(1, len));
        if (y - BY0 < len && Math.abs(x - (BX0 + col * 5 + 2.5)) < w) put(i, mul(ROCK[1], 1.2 - (y - BY0) / 14), 0, 1);
      }

      // Tunnel mouths: a rim of big stones, then darkness going down.
      for (let t = 0; t < count; t++) {
        const inner = archIn(x, y, t);
        if (inner < 1) {
          const tx = tunnels[t].x, vy = spring + 4;
          const s = Math.max(Math.abs(x - tx) / hw, (vy - y) / (vy - tunnels[t].top), y > vy ? (y - vy) / (BY1 - vy) : 0);
          const ring = Math.floor(Math.log(Math.max(0.05, s)) * 5);
          const c = mul(STONES[(((ring + t) % STONES.length) + STONES.length) % STONES.length], 0.55 + (ring & 1) * 0.12);
          put(i, c, 0, 4);
          shade[i] = Math.min(1, s);
          ids[i] = t + 1;
        } else if (archIn(x, y, t, 4) < 1) {
          const ang = Math.floor(Math.atan2(y - spring, x - tunnels[t].x) * 4 + (y > spring ? Math.floor((BY1 - y) / 8) : 0));
          put(i, mul(STONES[((ang % STONES.length) + STONES.length) % STONES.length], 1.15 + hash(ang, t) * 0.15), 0, 5);
          ids[i] = t + 1;
        }
      }

      // The healing pool.
      if (spec.pool && y >= BY1) {
        const e = Math.hypot((x - LW / 2) / 46, (y - 146) / 13);
        if (e < 1) {
          put(i, spec.pool === "glow" ? POOL[Math.floor(hash(fx >> 2, fy >> 1) * 3)] : mix(POOL_DIM, WATER, hash(fx, fy) * 0.4), (y - BY1) / (LH - BY1), spec.pool === "glow" ? 3 : 2);
        } else if (e < 1.14) {
          put(i, mul(STONES[Math.floor(hash(Math.floor(Math.atan2(y - 146, x - LW / 2) * 9), 5) * STONES.length)], 1.2), (y - BY1) / (LH - BY1), 1);
        }
      }
    }
  }

  // Wall torches, one either side.
  const torches = [{ x: 18, y: 62, d: 0.6 }, { x: LW - 18, y: 62, d: 0.6 }];

  // Drips: where they fall from, and where they land.
  const drips = Array.from({ length: 6 }, (_, k) => {
    const x = Math.round(BX0 + 8 + hash(k, seed + 1) * (BX1 - BX0 - 16));
    return { x, y0: BY0 + 6, y1: Math.round(BY1 + 6 + hash(k, seed + 2) * 50), period: 2.4 + hash(k, seed + 3) * 3.5, phase: hash(k, seed + 4) * 6 };
  });

  // Water dripping from the ceiling, rippling where it lands; and something
  // watching from the dark. (Drawn with the given painter, see render/overlay.)
  type Paint = (x: number, y: number, c: string | RGB, alpha?: number, size?: number) => void;
  function drawDrips(t: number, px: Paint) {
    for (const dr of drips) {
      const p = (t + dr.phase) % dr.period; // seconds into this drip's cycle
      const fall = 0.55;
      if (p < 0.35) {
        px(dr.x, dr.y0, DRIP, p / 0.35, 1); // the drop gathering
      } else if (p < 0.35 + fall) {
        const k = (p - 0.35) / fall;
        const y = dr.y0 + (dr.y1 - dr.y0) * k * k;
        px(dr.x, y, DRIP, 1, 1); px(dr.x, y - 0.5, DRIP, 0.8, 1); px(dr.x, y - 1, DRIP, 0.4, 1);
      } else if (p < 0.35 + fall + 0.8) {
        const k = (p - 0.35 - fall) / 0.8;
        const rad = 1 + k * 7, scale = 0.6 + (dr.y1 - BY1) / (LH - BY1);
        for (let a = 0; a < 40; a++) {
          const ang = (a / 40) * Math.PI * 2;
          px(dr.x + Math.cos(ang) * rad * scale, dr.y1 + Math.sin(ang) * rad * 0.3 * scale, DRIP, (1 - k) * 0.7, 1);
        }
      }
    }
  }
  function drawEyes(t: number, px: Paint) {
    spec.tunnels.forEach((look, q) => {
      if (look !== "unknown") return;
      const cyc = (t + q * 3.7 + seed) % 11;
      if (cyc > 1.6 || (cyc > 0.7 && cyc < 0.82)) return;
      const ex = tunnels[q].x + (hash(q, seed) - 0.5) * hw * 0.6, ey = spring + 2 + hash(seed, q) * 6;
      px(ex - 2, ey, "#ffd84a"); px(ex + 2, ey, "#ffd84a");
    });
  }

  const poolGlow = spec.pool === "glow"; // lights the floor around it
  let out: ImageData | null = null;

  function render(t: number, hover: number, open: boolean, extras = true): ImageData {
    out ??= new ImageData(CW, CH);
    const d = out.data;
    const flick = torches.map((_, k) => 0.84 + 0.09 * Math.sin(t * 9 + k * 2.1) + 0.07 * Math.sin(t * 23 + k * 5) + (Math.random() - 0.5) * 0.05);
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.4);

    for (let fy = 0; fy < CH; fy++) {
      for (let fx = 0; fx < CW; fx++) {
        const i = fy * CW + fx, o = i * 4;
        const x = (fx + 0.5) / RES, y = (fy + 0.5) / RES;
        let r = albedo[i * 3], g = albedo[i * 3 + 1], b = albedo[i * 3 + 2];
        const k = kind[i], dep = depth[i];
        const bay = BAYER[(fy & 3) * 4 + (fx & 3)];

        if (k === 3) {
          // Glowing pool: lit from within, with slow ripples.
          const wave = 0.85 + 0.15 * Math.sin(t * 2 + Math.hypot(x - LW / 2, (y - 146) * 3.4) * 0.35);
          d[o] = r * 255 * wave; d[o + 1] = g * 255 * wave; d[o + 2] = b * 255 * wave; d[o + 3] = 255;
          continue;
        }

        // Torchlight (plus a healing pool's glow), stepped with ordered dithering.
        let lr = AMBIENT[0], lg = AMBIENT[1], lb = AMBIENT[2], shine = 0;
        for (let q = 0; q < torches.length; q++) {
          const L = torches[q];
          const dx = (x - L.x) / 70, dy = (y - L.y) / 70, dd = (dep - L.d) * 1.1;
          const fall = (1.7 * flick[q]) / (1 + (dx * dx + dy * dy + dd * dd) * 2.4);
          lr += TORCH[0] * fall; lg += TORCH[1] * fall; lb += TORCH[2] * fall;
          shine += fall * fall;
        }
        if (poolGlow && y > BY1 - 30) { const p = 1 / (1 + Math.hypot((x - LW / 2) / 50, (y - 146) / 22) ** 2 * 2); lr += 0.15 * p; lg += 0.55 * p; lb += 0.5 * p; }

        if (k === 4) {
          // Deeper into a tunnel, darker; a lair glows red at the end.
          const s = shade[i];
          const fade = s * s;
          lr *= fade; lg *= fade; lb *= fade;
          const tt = ids[i] - 1;
          if (spec.tunnels[tt] === "boss") {
            const glow = (1 - s) * (1 - s) * (0.7 + 0.3 * Math.sin(t * 1.8));
            r = r * fade + 0.75 * glow; g = g * fade + 0.08 * glow; b = b * fade + 0.05 * glow;
            lr = Math.max(lr, 1); lg = Math.max(lg, 1); lb = Math.max(lb, 1);
          }
        }
        if (k === 5 && open) { lr += 0.12 * breathe; lg += 0.1 * breathe; lb += 0.06 * breathe; }

        const step = (Lv: number) => Math.floor(Lv * 6 + bay) / 6;
        let R = r * step(lr), G = g * step(lg), B = b * step(lb);

        // Wet stone and puddles catch the light.
        if (k === 1 || k === 2) {
          const shimmer = k === 2 ? 0.6 + 0.4 * Math.sin(t * 3 + x * 0.7 + y * 1.9) : 1;
          const glint = Math.min(1, shine * (k === 2 ? 0.9 : 0.5)) * shimmer;
          R += glint * 0.55; G += glint * 0.45; B += glint * 0.35;
          if (k === 2) { R += 0.02; G += 0.035; B += 0.05; }
        }

        // Mist creeping over the floor.
        if (y > BY1 - 14) {
          const m = vnoise((x + t * 7) / 26, y / 6 + t * 0.15) - 0.42;
          const a = Math.max(0, Math.min(0.32, m * 1.4)) * Math.min(1, (y - BY1 + 14) / 20);
          R = R + (MIST[0] * 0.5 - R) * a; G = G + (MIST[1] * 0.5 - G) * a; B = B + (MIST[2] * 0.5 - B) * a;
        }

        // Darker towards the edges of your vision.
        const vx = (x - LW / 2) / (LW / 2), vy = (y - LH * 0.55) / (LH * 0.6);
        const vig = Math.max(0.25, 1 - 0.55 * (vx * vx + vy * vy));
        d[o] = Math.min(255, R * vig * 255); d[o + 1] = Math.min(255, G * vig * 255); d[o + 2] = Math.min(255, B * vig * 255); d[o + 3] = 255;
      }
    }

    // Paint at a layout spot: a square of `size` fine pixels (default one layout unit).
    const px = (x: number, y: number, c: string | RGB, alpha = 1, size = RES) => {
      const col = typeof c === "string" ? hex(c) : c;
      const x0 = Math.round(x * RES), y0 = Math.round(y * RES);
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const X = x0 + dx, Y = y0 + dy;
        if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
        const o = (Y * CW + X) * 4;
        d[o] = d[o] + (col[0] * 255 - d[o]) * alpha; d[o + 1] = d[o + 1] + (col[1] * 255 - d[o + 1]) * alpha; d[o + 2] = d[o + 2] + (col[2] * 255 - d[o + 2]) * alpha;
      }
    };

    // Torches: an iron bracket and a flame.
    torches.forEach((tc, q) => {
      for (let k = 0; k < 7; k++) px(tc.x, tc.y + k, k < 2 ? "#5a5e68" : "#2c2e34");
      px(tc.x - 1, tc.y, "#5a5e68"); px(tc.x + 1, tc.y, "#5a5e68");
      const hgt = 5 + Math.floor((Math.sin(t * 11 + q * 2) + 1) * 1.5 + Math.random() * 1.5);
      for (let k = 0; k < hgt; k++) {
        const sway = k > hgt / 2 ? Math.round(Math.sin(t * 7 + q + k) * 0.8) : 0;
        const c = k < 2 ? "#fff3b0" : k < hgt - 2 ? "#ffb347" : "#e2582a";
        const w = k < hgt - 2 ? 1 : 0;
        for (let s = -w; s <= w; s++) px(tc.x + s + sway, tc.y - 1 - k, s === 0 ? c : "#ff8a2a");
      }
    });

    if (extras) { drawDrips(t, px); drawEyes(t, px); }

    // Hover: the tunnel brightens and is outlined in gold.
    if (hover && open) {
      const glow = 0.75 + 0.25 * Math.sin(t * 6);
      for (let y = 1; y < CH - 1; y++) {
        for (let x = 1; x < CW - 1; x++) {
          const i = y * CW + x, o = i * 4;
          if (ids[i] === hover) {
            d[o] = Math.min(255, d[o] * 1.3 + 14); d[o + 1] = Math.min(255, d[o + 1] * 1.3 + 12); d[o + 2] = Math.min(255, d[o + 2] * 1.2 + 8);
          } else if (ids[i - 1] === hover || ids[i + 1] === hover || ids[i - CW] === hover || ids[i + CW] === hover) {
            d[o] = 255 * glow; d[o + 1] = 214 * glow; d[o + 2] = 110 * glow;
          }
        }
      }
    }
    return out;
  }

  // (Made on first use: there's no ImageData while the page renders on the server.)
  let top: ImageData | null = null;
  function overlay(t: number, hover: number, open: boolean): ImageData {
    top ??= new ImageData(CW, CH);
    const td = top.data;
    td.fill(0);
    // Paint at a layout spot, over whatever's there (alpha builds up).
    const px = (x: number, y: number, c: string | RGB, alpha = 1, size = RES) => {
      const col = typeof c === "string" ? hex(c) : c;
      const x0 = Math.round(x * RES), y0 = Math.round(y * RES);
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const X = x0 + dx, Y = y0 + dy;
        if (X < 0 || Y < 0 || X >= CW || Y >= CH) continue;
        const o = (Y * CW + X) * 4, a0 = td[o + 3] / 255, a = alpha + a0 * (1 - alpha);
        for (let ch = 0; ch < 3; ch++) td[o + ch] = a ? (col[ch] * 255 * alpha + td[o + ch] * a0 * (1 - alpha)) / a : 0;
        td[o + 3] = a * 255;
      }
    };

    for (let fy = 0; fy < CH; fy++) {
      for (let fx = 0; fx < CW; fx++) {
        const i = fy * CW + fx, o = i * 4;
        const x = (fx + 0.5) / RES, y = (fy + 0.5) / RES;
        // The healing pool, glowing and rippling (or still, used up).
        if (kind[i] === 3 || (spec.pool && kind[i] === 2 && Math.hypot((x - LW / 2) / 46, (y - 146) / 13) < 1.14)) {
          const wave = kind[i] === 3 ? 0.85 + 0.15 * Math.sin(t * 2 + Math.hypot(x - LW / 2, (y - 146) * 3.4) * 0.35) : 0.8;
          td[o] = albedo[i * 3] * 255 * wave; td[o + 1] = albedo[i * 3 + 1] * 255 * wave; td[o + 2] = albedo[i * 3 + 2] * 255 * wave; td[o + 3] = 255;
          continue;
        }
        // Mist creeping over the floor.
        if (y > BY1 - 14) {
          const m = vnoise((x + t * 7) / 26, y / 6 + t * 0.15) - 0.42;
          const a = Math.max(0, Math.min(0.32, m * 1.4)) * Math.min(1, (y - BY1 + 14) / 20);
          if (a > 0.01) { td[o] = MIST[0] * 160; td[o + 1] = MIST[1] * 160; td[o + 2] = MIST[2] * 160; td[o + 3] = a * 255; }
        }
      }
    }
    drawDrips(t, px);
    drawEyes(t, px);
    // Hover: the tunnel warms and is outlined in gold.
    if (hover && open) {
      const glow = 0.75 + 0.25 * Math.sin(t * 6);
      for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
        const i = y * CW + x, o = i * 4;
        if (ids[i] === hover) { td[o] = 255; td[o + 1] = 200; td[o + 2] = 120; td[o + 3] = 40; }
        else if (ids[i - 1] === hover || ids[i + 1] === hover || ids[i - CW] === hover || ids[i + CW] === hover) { td[o] = 255 * glow; td[o + 1] = 214 * glow; td[o + 2] = 110 * glow; td[o + 3] = 255; }
      }
    }
    return top;
  }

  return {
    render,
    overlay,
    tunnels,
    idAt: (x, y) => {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= CW || y >= CH) return 0;
      return ids[y * CW + x];
    },
  };
}
