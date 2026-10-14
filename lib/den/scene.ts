// lib/den/scene.ts
// The Den (home screen), drawn as pixel art in code: an isometric "cube"
// room (two stone walls + flagstone floor on a floating block) with
// clickable objects. Everything is rendered at a low resolution into a pixel
// buffer and scaled up sharp by the browser.
//
// - The static room (stone, moss, objects) is built once.
// - Each frame re-lights it (flickering torches, pulsing altar), then draws
//   the animated bits (flames, embers, floating crystal) and the hover outline.
// - Every pixel remembers which object it belongs to, so clicks are
//   pixel-accurate.

export const W = 256;
export const H = 288;

// Isometric layout: 1 floor unit = 32px wide / 16px tall diamond.
const N = 7;          // room is N × N floor units
const TW = 16;        // half tile width
const TH = 8;         // half tile height
const CX = 128;       // screen x of the back corner
const Y0 = 150;       // screen y of the back corner at floor level
const WALL_H = 120;   // wall height (px)
const WALL_T = 0.4;   // wall thickness (units)
const SLAB = 12;      // floor block thickness (px)
const AL = 1.2;       // altar centre (u = v)

// ── Clickable objects ─────────────────────────────────────────────
export const OBJ = {
  none: 0, pit: 1, chest: 2, altar: 3, merchant: 4, quests: 5, bag: 6, arch: 7,
} as const;
export type ObjId = (typeof OBJ)[keyof typeof OBJ];

// Where each object's label sits (floor units + height in px).
// below = the label hangs under the point instead of above it.
export const ANCHORS: Record<Exclude<ObjId, 0>, { u: number; v: number; z: number; below?: boolean }> = {
  1: { u: 4.75, v: 4.75, z: 0, below: true }, // pit
  2: { u: 0.7, v: 5.8, z: 22 },    // chest
  3: { u: 1.2, v: 1.2, z: 46 },    // altar
  4: { u: 5.95, v: 0.55, z: 34 },  // merchant
  5: { u: 0, v: 5.9, z: 84 },      // quest board
  6: { u: 2.9, v: 0, z: 74 },      // bag shelf
  7: { u: 0, v: 3.0, z: 66 },      // archway
};

export function project(u: number, v: number, z: number): [number, number] {
  return [CX + (u - v) * TW, Y0 + (u + v) * TH - z];
}

// ── Helpers ───────────────────────────────────────────────────────
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

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
const WALL_STONES = pal("#4a5163", "#535b6e", "#434958", "#5b6276", "#4e5466", "#575d6b");
const CAP_STONES  = pal("#6a7184", "#737a8d", "#62697b");
const MORTAR      = hex("#22252d");
const FLOOR       = pal("#7d6a55", "#86735c", "#73614f", "#8f7c64", "#6e5d4c");
const FLOOR_MORT  = hex("#3a3129");
const MOSS        = pal("#3e6b2c", "#4f8235", "#2f5523", "#5f9440");
const SAND        = pal("#b4955f", "#a8895a", "#bfa06a", "#9e8052");
const WOOD        = pal("#7a4a26", "#86532b", "#6d4122");
const WOOD_DARK   = hex("#4a2c16");
const IRON        = hex("#3b3d44");
const GOLD        = hex("#e8b84a");
const VOID        = hex("#07080c");

// ── Surface textures ─────────────────────────────────────────────
// a = distance along the surface (px), z = height (px).
function stone(a: number, z: number, seed: number, stones = WALL_STONES): RGB {
  const row = Math.floor(z / 8);
  const off = (row & 1) * 11;
  const col = Math.floor((a + off) / 22);
  const ia = a + off - col * 22, iz = z - row * 8;
  if (ia < 1 || iz < 1) return MORTAR;
  let c = stones[Math.floor(hash(col * 7 + seed, row) * stones.length)];
  let k = 1;
  if (iz >= 7) k = 1.14; else if (iz < 2) k = 0.86;
  if (ia < 2) k *= 1.07;
  k *= 0.93 + hash(Math.floor(a), Math.floor(z) + seed * 31) * 0.14;
  c = mul(c, k);
  return c;
}

function mossy(c: RGB, a: number, z: number, seed: number, height: number): RGB {
  const n = vnoise(a / 9 + seed * 13, z / 7)
    + (z < 16 ? ((16 - z) / 16) * 0.45 : 0)
    + (z > height - 22 ? ((z - (height - 22)) / 22) * 0.3 : 0);
  const h = hash(Math.floor(a) + seed, Math.floor(z));
  if (n > 0.8 || (n > 0.72 && h > 0.5)) return MOSS[Math.floor(h * MOSS.length)];
  // hanging ivy
  const ci = Math.floor(a / 9);
  const hv = hash(ci, seed + 5);
  if (hv < 0.28) {
    const len = 18 + hash(ci, seed + 9) * 55;
    if (z > height - len) {
      const vx = ci * 9 + 4 + Math.round(Math.sin(z * 0.35 + ci) * 1.5);
      const d = Math.abs(a - vx);
      if (d < 1) return hex("#2c4a20");
      if (d < 3 && hash(Math.floor(a), Math.floor(z / 3) + ci) > 0.55) return MOSS[(ci + Math.floor(z)) % 4];
    }
  }
  return c;
}

function floorTex(u: number, v: number): RGB {
  const fu = u * 16, fv = v * 16;
  const row = Math.floor(fv / 16);
  const off = (row & 1) * 8;
  const col = Math.floor((fu + off) / 16);
  const iu = fu + off - col * 16, iv = fv - row * 16;
  if (iu < 1 || iv < 1) {
    return vnoise(fu / 12, fv / 12) > 0.62 ? MOSS[Math.floor(hash(Math.floor(fu), Math.floor(fv)) * 4)] : FLOOR_MORT;
  }
  let k = 1;
  if (iu < 2 || iv < 2) k = 1.1; else if (iu > 14.5 || iv > 14.5) k = 0.85;
  k *= 0.92 + hash(Math.floor(fu * 2), Math.floor(fv * 2)) * 0.14;
  return mul(FLOOR[Math.floor(hash(col, row + 99) * FLOOR.length)], k);
}

function planks(a: number, z: number, seed: number): RGB {
  const row = Math.floor(z / 4);
  if (z - row * 4 < 1) return WOOD_DARK;
  const grain = 0.9 + hash(Math.floor(a / 3) + row * 17, seed) * 0.2;
  return mul(WOOD[(row + seed) % WOOD.length], grain);
}

// ── The scene ────────────────────────────────────────────────────
type Light = { u: number; v: number; z: number; color: RGB; power: number; radius: number; seed: number; pulse?: boolean };

const TORCHES: { u: number; v: number; z: number }[] = [
  { u: 0.12, v: 1.1, z: 74 }, { u: 0.12, v: 4.7, z: 74 },
  { u: 1.1, v: 0.12, z: 74 }, { u: 4.7, v: 0.12, z: 74 },
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => b / 16);

export type DenScene = {
  render: (t: number, hover: ObjId) => ImageData;
  idAt: (x: number, y: number) => ObjId;
};

export function createDen(): DenScene {
  const n = W * H;
  const albedo = new Float32Array(n * 3);
  const pos = new Float32Array(n * 3).fill(NaN);
  const ids = new Uint8Array(n);
  const emissive = new Uint8Array(n); // 1 = glows (not lit), 2 = glows + pulses

  function put(x: number, y: number, c: RGB, u: number, v: number, z: number, id: number = 0, glow = 0) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    albedo[i * 3] = c[0]; albedo[i * 3 + 1] = c[1]; albedo[i * 3 + 2] = c[2];
    pos[i * 3] = u; pos[i * 3 + 1] = v; pos[i * 3 + 2] = z;
    ids[i] = id;
    emissive[i] = glow;
  }

  // Inverse projections: which point on a plane does pixel (x, y) show?
  const onZ = (x: number, y: number, z0: number) => {
    const dx = (x + 0.5 - CX) / TW, dy = (y + 0.5 + z0 - Y0) / TH;
    return { u: (dy + dx) / 2, v: (dy - dx) / 2 };
  };
  const onU = (x: number, y: number, u0: number) => {
    const v = u0 - (x + 0.5 - CX) / TW;
    return { v, z: Y0 + (u0 + v) * TH - (y + 0.5) };
  };
  const onV = (x: number, y: number, v0: number) => {
    const u = v0 + (x + 0.5 - CX) / TW;
    return { u, z: Y0 + (u + v0) * TH - (y + 0.5) };
  };

  // Fight pit, sunk into the middle of the floor.
  const P0 = 2.3, P1 = 4.7, PD = 16;
  const inPit = (u: number, v: number) => u >= P0 && u < P1 && v >= P0 && v < P1;

  // Wall features (in wall coordinates: a = px along the wall from the back corner).
  function leftWallFeature(a: number, z: number): { c: RGB; id: number } | null {
    // Archway
    const ac = 3.0 * 16, r = 13;
    const da = a - ac;
    const top = 42 + Math.sqrt(Math.max(0, r * r - da * da));
    if (Math.abs(da) < r && z < top) {
      const depth = Math.min(1, z / 60);
      const fog = z < 8 ? 0.06 * (8 - z) / 8 : 0;
      return { c: mix(hex("#0c0e16"), hex("#05060a"), depth).map((x, k) => x + (k === 2 ? fog * 1.6 : fog)) as RGB, id: OBJ.arch };
    }
    const outer = Math.sqrt(da * da + Math.max(0, z - 42) ** 2);
    if ((z >= 42 && outer < r + 6) || (z < 42 && Math.abs(da) < r + 5)) {
      const ang = Math.atan2(z - 42, da);
      const block = z >= 42 ? Math.floor((ang / Math.PI) * 7) : Math.floor(z / 9) + 20;
      const edge = z >= 42 ? Math.abs(((ang / Math.PI) * 7) % 1) < 0.08 : z % 9 < 1;
      if (edge) return { c: MORTAR, id: OBJ.arch };
      return { c: mul(CAP_STONES[block % 3], 0.95 + hash(Math.floor(a), Math.floor(z)) * 0.1), id: OBJ.arch };
    }
    // Quest board
    const qa = a - 5.2 * 16, qz = z - 40;
    if (qa >= 0 && qa < 24 && qz >= 0 && qz < 30) {
      if (qa < 2 || qa >= 22 || qz < 2 || qz >= 28) return { c: WOOD_DARK, id: OBJ.quests };
      const notes = [[4, 15, 7, 9], [13, 17, 7, 8], [7, 4, 9, 8]];
      for (const [nx, nz, nw, nh] of notes) {
        if (qa >= nx && qa < nx + nw && qz >= nz && qz < nz + nh) {
          if (qa === nx + Math.floor(nw / 2) && qz === nz + nh - 1) return { c: hex("#c0392b"), id: OBJ.quests };
          const line = (qz - nz) % 2 === 0 && qa > nx && qa < nx + nw - 1 && qz < nz + nh - 2;
          return { c: line ? hex("#9c8f74") : hex("#e8dcc0"), id: OBJ.quests };
        }
      }
      return { c: planks(qa, qz, 2), id: OBJ.quests };
    }
    return null;
  }

  function rightWallFeature(a: number, z: number): { c: RGB; id: number } | null {
    // Merchant's hanging sign
    const sa = a - 5.45 * 16, sz = z - 64;
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
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Floor (and the pit)
      const f = onZ(x, y, 0);
      if (f.u >= 0 && f.v >= 0 && f.u < N && f.v < N) {
        if (inPit(f.u, f.v)) {
          const s = onZ(x, y, -PD);
          if (inPit(s.u, s.v)) {
            const h = hash(Math.floor(s.u * 32), Math.floor(s.v * 32));
            put(x, y, mul(SAND[Math.floor(h * 4)], 0.9 + h * 0.15), s.u, s.v, -PD, OBJ.pit);
          } else {
            const wu = onU(x, y, P0), wv = onV(x, y, P0);
            if (wu.v >= P0 && wu.v < P1 && wu.z <= 0 && wu.z > -PD) put(x, y, mul(stone(wu.v * 16, wu.z + PD, 3), 0.62), P0, wu.v, wu.z, OBJ.pit);
            else put(x, y, mul(stone(wv.u * 16, wv.z + PD, 4), 0.5), wv.u, P0, wv.z, OBJ.pit);
          }
          continue;
        }
        const nearPit = f.u >= P0 - 0.2 && f.u < P1 + 0.2 && f.v >= P0 - 0.2 && f.v < P1 + 0.2;
        if (nearPit) {
          const k = 0.95 + hash(Math.floor(f.u * 10), Math.floor(f.v * 10)) * 0.15;
          put(x, y, mul(CAP_STONES[Math.floor(hash(Math.floor(f.u * 4), Math.floor(f.v * 4)) * 3)], k), f.u, f.v, 0, OBJ.pit);
          continue;
        }
        put(x, y, floorTex(f.u, f.v), f.u, f.v, 0);
        continue;
      }

      // Wall tops (the cut edge of the cube)
      const cap = onZ(x, y, WALL_H);
      if (cap.u >= -WALL_T && cap.v >= -WALL_T && cap.u < N && cap.v < N && (cap.u < 0 || cap.v < 0)) {
        const c = stone(cap.u * 16 + 40, cap.v * 16 + 40, 9, CAP_STONES);
        put(x, y, mul(c, 1.08), cap.u, cap.v, WALL_H);
        continue;
      }

      // Right wall (v = 0) and left wall (u = 0), inner faces
      const rw = onV(x, y, 0);
      if (rw.u >= 0 && rw.u < N && rw.z >= 0 && rw.z < WALL_H && x >= CX) {
        const feat = rightWallFeature(rw.u * 16, rw.z);
        if (feat) put(x, y, feat.c, rw.u, 0.02, rw.z, feat.id);
        else put(x, y, mul(mossy(stone(rw.u * 16, rw.z, 1), rw.u * 16, rw.z, 1, WALL_H), 0.82), rw.u, 0, rw.z);
        continue;
      }
      const lw = onU(x, y, 0);
      if (lw.v >= 0 && lw.v < N && lw.z >= 0 && lw.z < WALL_H && x < CX) {
        const feat = leftWallFeature(lw.v * 16, lw.z);
        if (feat) put(x, y, feat.c, 0.02, lw.v, lw.z, feat.id);
        else put(x, y, mossy(stone(lw.v * 16, lw.z, 2), lw.v * 16, lw.z, 2, WALL_H), 0, lw.v, lw.z);
        continue;
      }

      // Wall ends and floor block sides (outside of the cube)
      const endR = onU(x, y, N);
      if (endR.v >= -WALL_T && endR.v < 0 && endR.z >= -SLAB && endR.z < WALL_H) {
        put(x, y, mul(stone(endR.v * 16 + 20, endR.z + SLAB, 5, CAP_STONES), 0.7), N, endR.v, endR.z);
        continue;
      }
      const endL = onV(x, y, N);
      if (endL.u >= -WALL_T && endL.u < 0 && endL.z >= -SLAB && endL.z < WALL_H) {
        put(x, y, mul(stone(endL.u * 16 + 20, endL.z + SLAB, 6, CAP_STONES), 0.6), endL.u, N, endL.z);
        continue;
      }
      const slabR = onU(x, y, N);
      if (slabR.v >= 0 && slabR.v < N && slabR.z >= -SLAB && slabR.z < 0) {
        put(x, y, mul(stone(slabR.v * 16, slabR.z + SLAB, 7), slabR.z > -2 ? 0.8 : 0.55), N, slabR.v, slabR.z);
        continue;
      }
      const slabL = onV(x, y, N);
      if (slabL.u >= 0 && slabL.u < N && slabL.z >= -SLAB && slabL.z < 0) {
        put(x, y, mul(stone(slabL.u * 16, slabL.z + SLAB, 8), slabL.z > -2 ? 0.7 : 0.45), slabL.u, N, slabL.z);
        continue;
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
    for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y++) {
      for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x++) {
        const t = onZ(x, y, z1);
        if (t.u >= u0 && t.u < u1 && t.v >= v0 && t.v < v1) {
          const r = unpack(faces.top((t.u - u0) * 16, (t.v - v0) * 16));
          put(x, y, r.c, t.u, t.v, z1, id, r.glow); continue;
        }
        const fu = onU(x, y, u1);
        if (fu.v >= v0 && fu.v < v1 && fu.z >= z0 && fu.z < z1) {
          const r = unpack(faces.right((fu.v - v0) * 16, fu.z - z0));
          put(x, y, r.glow ? r.c : mul(r.c, 0.78), u1, fu.v, fu.z, id, r.glow); continue;
        }
        const fv = onV(x, y, v1);
        if (fv.u >= u0 && fv.u < u1 && fv.z >= z0 && fv.z < z1) {
          const r = unpack(faces.left((fv.u - u0) * 16, fv.z - z0));
          put(x, y, r.glow ? r.c : mul(r.c, 0.92), fv.u, v1, fv.z, id, r.glow);
        }
      }
    }
  }

  // Back to front so nearer objects cover farther ones.
  // Bag shelf (right wall)
  const shelf: Face = (a, b) => (b < 1 ? mul(WOOD[0], 1.15) : WOOD_DARK);
  box(OBJ.bag, 2.2, 0, 26, 3.7, 0.4, 29, { top: (a) => planks(a, 2, 0), right: shelf, left: shelf });
  box(OBJ.bag, 2.2, 0, 50, 3.7, 0.4, 53, { top: (a) => planks(a, 2, 1), right: shelf, left: shelf });
  const sack: Face = (a, b) => (b > 8 && b < 10 ? hex("#3d2a17") : mul(hex("#9a7448"), 0.9 + hash(Math.floor(a), Math.floor(b)) * 0.15));
  box(OBJ.bag, 2.35, 0.05, 53, 2.95, 0.35, 65, { top: () => hex("#8a6640"), right: sack, left: sack });
  const potion = (col: string): Face => (a, b) => (b > 6 ? hex("#cfc6b0") : { c: mul(hex(col), b < 2 ? 0.7 : 1), glow: 1 });
  box(OBJ.bag, 3.1, 0.1, 53, 3.28, 0.28, 61, { top: () => hex("#cfc6b0"), right: potion("#e04848"), left: potion("#e04848") });
  box(OBJ.bag, 3.38, 0.1, 53, 3.56, 0.28, 60, { top: () => hex("#cfc6b0"), right: potion("#4878e0"), left: potion("#4878e0") });
  box(OBJ.bag, 2.4, 0.08, 29, 2.62, 0.3, 36, { top: () => hex("#cfc6b0"), right: potion("#48c060"), left: potion("#48c060") });
  box(OBJ.bag, 2.9, 0.06, 29, 3.5, 0.34, 33, { top: () => hex("#d8cba8"), right: () => hex("#c2b28c"), left: () => hex("#b5a47e") });

  // Merchant stall (against the right wall)
  const counter: Face = (a, b) => (b > 11 ? hex("#8e2b2b") : b > 10 ? GOLD : planks(a, b, 2));
  box(OBJ.merchant, 5.2, 0.12, 0, 6.7, 1.0, 13, { top: (a, b) => ((Math.floor(a / 4) + Math.floor(b / 4)) % 2 ? hex("#a33636") : hex("#8e2b2b")), right: counter, left: counter });
  box(OBJ.merchant, 5.35, 0.3, 13, 5.55, 0.5, 20, { top: () => hex("#cfc6b0"), right: potion("#b060e0"), left: potion("#b060e0") });
  box(OBJ.merchant, 5.75, 0.25, 13, 6.15, 0.65, 16, { top: () => ({ c: hex("#ffe27a"), glow: 1 }), right: () => GOLD, left: () => mul(GOLD, 0.85) });
  box(OBJ.merchant, 6.3, 0.35, 13, 6.48, 0.53, 19, { top: () => hex("#cfc6b0"), right: potion("#e0a030"), left: potion("#e0a030") });

  // Chest (against the left wall)
  const chestSide: Face = (a, b) => {
    if (a < 1.5 || a > 13) return IRON;
    if (b > 6 && b < 8) return IRON;
    if (Math.abs(a - 7.5) < 2 && b > 3 && b < 8) return Math.abs(a - 7.5) < 0.8 && b > 4 && b < 6 ? hex("#2a1a0a") : GOLD;
    return planks(a, b, 0);
  };
  box(OBJ.chest, 0.2, 5.25, 0, 1.15, 6.25, 12, {
    top: (a, b) => (b < 1.5 || b > 14.5 || Math.abs(a - 7.5) < 1 ? IRON : planks(b, a, 1)),
    right: chestSide,
    left: (a, b) => (a < 1.5 || a > 13.5 || (b > 6 && b < 8) ? IRON : planks(a, b, 2)),
  });

  // Scanning altar (a shrine in the back corner, between the torches)
  const altarStone: Face = (a, b) => (b > 13 ? mul(CAP_STONES[1], 1.1) : stone(a + 30, b, 11, CAP_STONES));
  box(OBJ.altar, AL - 0.4, AL - 0.4, 0, AL + 0.4, AL + 0.4, 16, {
    top: (a, b) => {
      const d = Math.hypot(a - 6.4, b - 6.4);
      if (d < 1.5 || (d > 3.6 && d < 4.8)) return { c: hex("#6ff2ff"), glow: 2 };
      return mul(CAP_STONES[0], 1.1);
    },
    right: altarStone,
    left: (a, b) => (Math.abs(a - 6.4) < 1 && b > 4 && b < 11 ? { c: hex("#3fc6e0"), glow: 2 } : altarStone(a, b)),
  });

  // ── Lights ──
  const lights: Light[] = [
    ...TORCHES.map((t, i) => ({ ...t, color: hex("#ffa04a"), power: 1.5, radius: 2.4, seed: i * 1.7 })),
    { u: AL, v: AL, z: 30, color: hex("#5fe0ff"), power: 0.9, radius: 1.5, seed: 9, pulse: true },
  ];
  const AMBIENT: RGB = [0.24, 0.26, 0.36];

  // Embers drifting up from the torches.
  type Ember = { x: number; y: number; vx: number; life: number };
  let embers: Ember[] = [];
  let lastT = 0;

  const out = new ImageData(W, H);
  const frameIds = new Uint8Array(n);

  function render(t: number, hover: ObjId): ImageData {
    const d = out.data;
    const flick = lights.map((l) =>
      l.pulse
        ? 0.75 + 0.25 * Math.sin(t * 2.2)
        : 0.86 + 0.08 * Math.sin(t * 9 + l.seed) + 0.06 * Math.sin(t * 23 + l.seed * 3) + (Math.random() - 0.5) * 0.04
    );
    const altarPulse = 0.8 + 0.2 * Math.sin(t * 2.2);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, o = i * 4;
        const u = pos[i * 3];
        if (Number.isNaN(u)) {
          // Background: dark void with a faint glow under the room.
          const g = Math.max(0, 1 - Math.hypot((x - CX) / 150, (y - 200) / 110));
          const b = BAYER[(y & 3) * 4 + (x & 3)];
          const k = Math.floor((g * 0.5) * 4 + b) / 4;
          d[o] = (VOID[0] + k * 0.05) * 255; d[o + 1] = (VOID[1] + k * 0.05) * 255; d[o + 2] = (VOID[2] + k * 0.09) * 255; d[o + 3] = 255;
          continue;
        }
        const r = albedo[i * 3], g = albedo[i * 3 + 1], bl = albedo[i * 3 + 2];
        if (emissive[i]) {
          const k = emissive[i] === 2 ? altarPulse : 1;
          d[o] = Math.min(255, r * 255 * k); d[o + 1] = Math.min(255, g * 255 * k); d[o + 2] = Math.min(255, bl * 255 * k); d[o + 3] = 255;
          continue;
        }
        const v = pos[i * 3 + 1], z = pos[i * 3 + 2] / 16;
        let lr = AMBIENT[0], lg = AMBIENT[1], lb = AMBIENT[2];
        for (let k = 0; k < lights.length; k++) {
          const l = lights[k];
          const du = u - l.u, dv = v - l.v, dz = z - l.z / 16;
          const fall = (l.power * flick[k]) / (1 + (du * du + dv * dv + dz * dz) / (l.radius * l.radius));
          lr += l.color[0] * fall; lg += l.color[1] * fall; lb += l.color[2] * fall;
        }
        // Ordered dithering on the light gives the stepped pixel-art glow.
        const bay = BAYER[(y & 3) * 4 + (x & 3)];
        const q = (L: number) => Math.floor(L * 6 + bay) / 6;
        d[o] = Math.min(255, r * q(lr) * 255);
        d[o + 1] = Math.min(255, g * q(lg) * 255);
        d[o + 2] = Math.min(255, bl * q(lb) * 255);
        d[o + 3] = 255;
      }
    }

    frameIds.set(ids);
    const px = (x: number, y: number, c: string | RGB, id = 0) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const col = typeof c === "string" ? hex(c) : c;
      const o = (y * W + x) * 4;
      d[o] = col[0] * 255; d[o + 1] = col[1] * 255; d[o + 2] = col[2] * 255;
      if (id) frameIds[y * W + x] = id;
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
    const [cx, cy] = project(AL, AL, 30 + Math.sin(t * 2) * 2.5);
    const shape = [1, 2, 3, 3, 3, 2, 2, 1, 1, 0];
    shape.forEach((w, k) => {
      for (let s = -w; s <= w; s++) {
        const c = s < 0 ? "#b8fbff" : s === 0 ? "#6ff2ff" : "#2fa8d0";
        px(cx + s, cy - 5 + k, k === 1 && s === -1 ? "#ffffff" : c, OBJ.altar);
      }
    });

    // Hover: brighten the object and outline it in gold.
    if (hover) {
      const glow = 0.75 + 0.25 * Math.sin(t * 6);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x, o = i * 4;
          if (frameIds[i] === hover) {
            d[o] = Math.min(255, d[o] * 1.25 + 12); d[o + 1] = Math.min(255, d[o + 1] * 1.25 + 10); d[o + 2] = Math.min(255, d[o + 2] * 1.2 + 6);
          } else if (frameIds[i - 1] === hover || frameIds[i + 1] === hover || frameIds[i - W] === hover || frameIds[i + W] === hover) {
            d[o] = 255 * glow; d[o + 1] = 214 * glow; d[o + 2] = 110 * glow;
          }
        }
      }
    }
    return out;
  }

  return {
    render,
    idAt: (x, y) => {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= W || y >= H) return OBJ.none;
      return frameIds[y * W + x] as ObjId;
    },
  };
}
