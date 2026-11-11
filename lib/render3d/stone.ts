// lib/render3d/stone.ts
// 🧪 The Stone experiment's rules (world/rendering.md §4.8, /lab/three ?geo=stone): how a flat
// texture is laid on the carved rock, and the light, from the game's own light reach. Pure, so
// it's tested (tests/stone3d.test.ts) without a GPU. Nothing in the game uses it.
//
// Textures are drawn flat and square (a picture of the stone as you'd see it face on, nothing
// foreshortened), at `density` art pixels a world unit. How they're laid on the geometry is the
// renderer's job, from the camera: so the same art serves any camera, and changing the camera
// never means redrawing the art.
//
// Light never comes from Three.js lights. It's a grid of values a subcell apart, lit only where
// the sim says light reaches now (`lightNow`, lib/dungeon/torch.ts), and only along a clear line
// through the floorplan: so it can't pass through rock, and what's lit on screen is what's lit in
// the game, by construction. The renderer then shades each surface by which way it faces.

import { ROCK, type Floorplan } from "../dungeon/floorplan";
import { shadeOf } from "./dungeon3d";

// ── Laying textures on the rock ──

// "screen": the art's pixels show square on screen. A floor seen at `pitch` shows sin(pitch) as
// deep as it is, and a wall face cos(pitch) as tall, so the texture is laid that much tighter
// along those ways (more of it per unit); seen from the camera, one art pixel is one square.
// "world": the art's pixels are square on the surface itself (as a 3D game lays them), so the
// camera squashes them: floors to 0.87 their height, wall faces to half (at 60°).
export type TexelMode = "screen" | "world";
export type Surface = "up" | "face";
// Texels a world unit along a surface's two ways: across (x, or z on a side face) and up it (z on
// a floor or rock top, y on a face).
export function texelsPerU(surface: Surface, density: number, pitch: number, mode: TexelMode): [number, number] {
  if (mode === "world") return [density, density];
  return [density, density * (surface === "up" ? Math.sin(pitch) : Math.cos(pitch))];
}

// ── Pixels on screen ──

// How the picture is drawn: at the screen's own pixels ("device"); at `density` canvas pixels a
// unit, `across` units across, blown up to fill the screen ("art": one canvas pixel to each art
// pixel, but blown up by an uneven amount, e.g. 2.4 screen pixels, so some show wider than
// others); or blown up a whole number of screen pixels ("whole": every art pixel the same size,
// and the units across come out near `across` instead of on it). `dpr` is the canvas pixels to
// each CSS pixel (Three.js's pixel ratio); `scale`, screen pixels to each canvas pixel.
export type PixelMode = "device" | "art" | "whole";
export function pixelScale(mode: PixelMode, density: number, across: number, cssWidth: number, deviceRatio: number): { dpr: number; across: number; scale: number } {
  if (mode === "device") return { dpr: deviceRatio, across, scale: 1 };
  if (mode === "art") { const dpr = (density * across) / cssWidth; return { dpr, across, scale: deviceRatio / dpr }; }
  const k = Math.max(1, Math.round((deviceRatio * cssWidth) / (density * across)));
  return { dpr: deviceRatio / k, across: (cssWidth * deviceRatio) / k / density, scale: k };
}

// ── Light ──

export const SUB = 3;          // light samples a tile each way (the world's subcells, space.md §1)
export const WINDOW = 64;      // 🧪 tiles each way the light grid covers round the camera (19 across, on a tall phone, shows about 44 deep)
export const CORE = 0.4;       // 🧪 share of a light's reach that's fully lit before it falls off (the lit core §4.7 asks for)
export const FALLOFF = 1.3;    // 🧪 the falloff's curve past the core (1: straight)
export const FADE = 1.5;       // 🧪 tiles over which what you've seen fades into the unexplored black

// A light: where (tile units, the sim's), how far it reaches (tiles), how bright (0–1).
export type Light3D = { x: number; y: number; r: number; power: number };
// The light grid round the camera: `size` tiles each way from tile (x0, y0), SUB samples a tile.
// Sample (i, j) sits at x0 − 0.5 + (i + 0.5) / SUB. `torch` is your torch's light alone (lit by
// which way a surface faces it); `other` is every other light's.
export type LightField = { x0: number; y0: number; size: number; torch: Float32Array; other: Float32Array };

const solid = (fp: Floorplan, x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;

// Is there a clear line from the light to (bx, by)? Nothing solid on the way, before the tile the
// point is in (that one may be rock: a lit wall). As the sim's own test (torch.ts `reaches`), but
// to a point inside a tile; and the light's own spot isn't tested, so a light on a wall still shines out.
function clearLine(fp: Floorplan, a: { x: number; y: number }, bx: number, by: number): boolean {
  const tx = Math.round(bx), ty = Math.round(by);
  const n = Math.ceil(Math.hypot(bx - a.x, by - a.y) * 4);
  for (let i = 1; i < n; i++) {
    const x = Math.round(a.x + ((bx - a.x) * i) / n), y = Math.round(a.y + ((by - a.y) * i) / n);
    if (x === tx && y === ty) return true;
    if (solid(fp, x, y)) return false;
  }
  return true;
}

// How bright one light is at distance d: full in its core, then falling off to 0 at its reach.
export function lightCurve(d: number, r: number): number {
  const t = d / r;
  if (t >= 1) return 0;
  if (t <= CORE) return 1;
  return Math.pow(1 - (t - CORE) / (1 - CORE), FALLOFF);
}

// The light grid round tile (cx, cy). Each light adds to it (lights together are brighter, never
// past 1), only on tiles the sim lit this frame (`othersOn`: where the other lights may fall, if not
// those), and only along a clear line. (`into`: last frame's grid, reused, so a frame makes no garbage.)
export function lightField(fp: Floorplan, lightNow: Uint8Array, torch: Light3D | null, lights: Light3D[], cx: number, cy: number, size = WINDOW, into?: LightField, othersOn = lightNow): LightField {
  const x0 = Math.round(cx) - size / 2, y0 = Math.round(cy) - size / 2, n = size * SUB;
  const out: LightField = into && into.size === size
    ? Object.assign(into, { x0, y0 }) : { x0, y0, size, torch: new Float32Array(n * n), other: new Float32Array(n * n) };
  if (into === out) { out.torch.fill(0); out.other.fill(0); }
  const add = (l: Light3D, into: Float32Array, on: Uint8Array) => {
    const i0 = Math.max(0, Math.floor((l.x - l.r - x0 + 0.5) * SUB)), i1 = Math.min(n - 1, Math.ceil((l.x + l.r - x0 + 0.5) * SUB));
    const j0 = Math.max(0, Math.floor((l.y - l.r - y0 + 0.5) * SUB)), j1 = Math.min(n - 1, Math.ceil((l.y + l.r - y0 + 0.5) * SUB));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = x0 - 0.5 + (i + 0.5) / SUB, y = y0 - 0.5 + (j + 0.5) / SUB;
      const tx = Math.round(x), ty = Math.round(y);
      if (tx < 0 || ty < 0 || tx >= fp.w || ty >= fp.h || !on[ty * fp.w + tx]) continue;
      const v = l.power * lightCurve(Math.hypot(x - l.x, y - l.y), l.r);
      if (v <= 0 || !clearLine(fp, l, x, y)) continue;
      const k = j * n + i;
      into[k] = 1 - (1 - into[k]) * (1 - v);
    }
  };
  if (torch) add(torch, out.torch, lightNow);
  for (const l of lights) add(l, out.other, othersOn);
  return out;
}

// The light at a point (nearest sample), both kinds together: for sprites standing there.
export function lightAt(f: LightField, x: number, y: number): number {
  const n = f.size * SUB, i = Math.floor((x - f.x0 + 0.5) * SUB), j = Math.floor((y - f.y0 + 0.5) * SUB);
  if (i < 0 || j < 0 || i >= n || j >= n) return 0;
  const k = j * n + i;
  return 1 - (1 - f.torch[k]) * (1 - f.other[k]);
}

// The colour a sprite or a 3D thing standing at (x, y) is tinted, worked out as the rock's shader
// does for the floor under it, so a thing never looks brighter, darker or a different warmth than
// the floor it stands on: the two kinds of light added and scaled by `gain` (not capped at 1: the
// floor isn't), coloured `warm` by your torch's share and `flame` by the others', over `remember`;
// then dimmed by `fade` (what you've seen, 0–1 a tile, a room cut off behind you already dimmed in
// it: seenField), as the floor is. (`w`: the floorplan's width, for `fade`; without it, no fade.)
export type Rgb = readonly [number, number, number];
export type Shading = { remember: number; gain: number; warm: Rgb; flame: Rgb };
export function shadeAt(f: LightField | null, fade: ArrayLike<number> | null, w: number, x: number, y: number, s: Shading): [number, number, number] {
  let torch = 0, other = 0;
  if (f) {
    const n = f.size * SUB, i = Math.floor((x - f.x0 + 0.5) * SUB), j = Math.floor((y - f.y0 + 0.5) * SUB);
    if (i >= 0 && j >= 0 && i < n && j < n) { torch = f.torch[j * n + i]; other = f.other[j * n + i]; }
  }
  const lit = (torch + other) * s.gain, share = torch / Math.max(torch + other, 0.0001);
  const k = Math.round(y) * w + Math.round(x), dim = fade && k >= 0 && k < fade.length ? fade[k] : 1;
  return [0, 1, 2].map((c) => (s.remember + lit * (s.flame[c] + (s.warm[c] - s.flame[c]) * share)) * dim) as [number, number, number];
}

// ── What you've seen, and the fade into the unexplored ──

// How unfound places show (the lab's switch): carved but black, as solid rock, or shown.
export type Unseen = "rock" | "black" | "shown";

// For each tile: `shown` (1: drawn; 0: black, as the 2D view and shadeOf), and `fade` (0–1): how
// much of it shows, falling to nothing over `fade` tiles towards a black tile. The fade only ever
// dims tiles that show; a black tile stays black, so nothing about a place you haven't found
// (floor or rock) is given away. With `unseen` "rock", floor you haven't found counts as rock
// (it's drawn as rock), so it shows beside floor you have, as rock would.
export function seenField(fp: Floorplan, known: Uint8Array, unseen: Unseen, fade = FADE): { shown: Uint8Array; fade: Float32Array } {
  const N = fp.w * fp.h;
  if (unseen === "shown") return { shown: new Uint8Array(N).fill(1), fade: new Float32Array(N).fill(1) };
  const asSeen = unseen === "rock" ? { ...fp, tiles: fp.tiles.map((t, i) => (t !== ROCK && !known[i] ? ROCK : t)) } : fp;
  const s = shadeOf(asSeen, known);
  const shown = Uint8Array.from(s, (v) => (v > 0 ? 1 : 0));
  if (fade <= 0) return { shown, fade: Float32Array.from(shown) };
  // Distance (tiles, centre to centre) to the nearest black tile, past the plan's edge included:
  // a two-pass chamfer (1 straight, 1.4 diagonal), then a ramp from half a tile out.
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = shown[i] ? Infinity : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= fp.w || y >= fp.h ? 0 : d[y * fp.w + x]);
  const D = Math.SQRT2;
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    const i = y * fp.w + x;
    if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
  }
  for (let y = fp.h - 1; y >= 0; y--) for (let x = fp.w - 1; x >= 0; x--) {
    const i = y * fp.w + x;
    if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
  }
  return { shown, fade: Float32Array.from(d, (v) => Math.max(0, Math.min(1, (v - 0.5) / fade))) };
}
