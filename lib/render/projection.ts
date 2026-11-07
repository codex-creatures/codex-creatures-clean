// lib/render/projection.ts
// The one projection (docs/world-spec.md §4): how world units
// (lib/world/units.ts) become pixels on the walk screen. The renderer
// (components/WalkView.tsx), the scene builder and, later, the art templates
// and checks all read it; nothing else turns world sizes into pixels.
//
// The camera is fixed: an oblique, orthographic view from the south, no
// perspective, no rotation (the user, 2026-11-07). On screen:
//   screenX = (x − camX) · T
//   screenY = (y − camY) · T · D − z · T · H
// T is pixels per unit across, D how tall a unit of floor depth looks, H how
// tall a unit of height looks. The camera following you (walk.ts cameraAt,
// which keeps it inside the floorplan), culling and taps are the same two
// lines turned round, here.
//
// Set to the game as it stood on 2026-11-07 (milestone 1, §4.3): the screen
// mustn't change. Each expression keeps the order of operations the walk
// screen had, so every pixel lands where it did.

import { cameraAt } from "../dungeon/walk";
import type { Floorplan, Pt } from "../dungeon/floorplan";

export const WALK_ACROSS = 15; // cells across the screen (the user's pick, 2026-11-06): T is the view's width ÷ this
export const DEPTH = 1;        // D: a cell of floor is square on screen (§4.6: ¾ is for phase 3 to decide)
export const HEIGHT = 1;       // H: a unit of height shows as tall as a unit across
export const FEET_U = 0.25;    // units: where a standing thing's feet are drawn, down from its cell's middle

// The sizes written before units (FOE_PX, each prop's `size`…) were in pixels
// at 16px a cell: a "scale" of T ÷ this. Legacy only (lib/world/objects.ts).
export const LEGACY_PX_PER_U = 16;
export const legacyU = (px: number) => px / LEGACY_PX_PER_U;

// A piece of art's pixel density. Square pixels: perU art pixels a unit, both
// ways. Legacy art (the kit) has rows squashed into a square cell: rowsPerU
// art rows a unit down, so its pixels show perU ÷ rowsPerU taller than wide
// (the kit's 4⁄3: its pixelAspect, §4.2).
export type ArtDensity = { perU: number; rowsPerU?: number };

// The view this frame: the camera's spot (in units) and the sums onto the
// screen. jitter: the screen shake, in px (0 when still).
export type View = {
  T: number;                    // px a unit across
  scale: number;                // T at 16px a cell (legacy sizes)
  cam: Pt;                      // the top-left of the screen, in units
  w: number; h: number;         // the screen, px
  x0: number; x1: number; y0: number; y1: number; // the cells in view, a cell's margin round (culling)
  sx: (x: number) => number;    // a cell's left edge on screen (whole px)
  sy: (y: number) => number;    // …its top edge
  midX: (x: number) => number;  // a cell's middle
  midY: (y: number) => number;
  footX: (x: number) => number; // where a thing standing in the cell has its feet
  footY: (y: number) => number;
};

export function walkView(plan: Floorplan, focus: Pt, w: number, h: number, jitter: Pt = { x: 0, y: 0 }): View {
  const T = w / WALK_ACROSS, scale = T / LEGACY_PX_PER_U;
  const cam = cameraAt(plan, focus, { w: w / T, h: h / (T * DEPTH) });
  const jx = jitter.x, jy = jitter.y;
  return {
    T, scale, cam, w, h,
    x0: Math.floor(cam.x) - 1, x1: Math.ceil(cam.x + w / T) + 1, y0: Math.floor(cam.y) - 1, y1: Math.ceil(cam.y + h / (T * DEPTH)) + 1,
    sx: (x) => Math.round((x - cam.x) * T + jx),
    sy: (y) => Math.round((y - cam.y) * T * DEPTH + jy),
    midX: (x) => (x - cam.x + 0.5) * T + jx,
    midY: (y) => (y - cam.y + 0.5) * T * DEPTH + jy,
    footX: (x) => (x - cam.x + 0.5) * T + jx,
    footY: (y) => (y - cam.y + 0.5) * T * DEPTH + FEET_U * T + jy,
  };
}

// A length in units, on screen, across.
export const across = (v: View, u: number) => u * v.T;

// A legacy size (px at 16px a cell) on screen.
export const legacyPx = (v: View, px: number) => px * v.scale;

// One art pixel on screen, across and down.
export const artPxAcross = (v: View, art: ArtDensity) => v.T / art.perU;
export const artPxDown = (v: View, art: ArtDensity) => (v.T * DEPTH) / (art.rowsPerU ?? art.perU);

// A tap (px from the view's top-left) to the cell it's on.
export const tapCell = (v: View, px: number, py: number): Pt => ({ x: Math.floor(v.cam.x + px / v.T), y: Math.floor(v.cam.y + py / (v.T * DEPTH)) });

// A definition's picture on screen at its legacy draw size (lib/world/objects.ts
// LegacyDraw): its width, or its height with the art's width; wd × h2 px.
export function legacySize(v: View, legacy: { width?: number; height?: number }, art: { w: number; h: number }) {
  const wd = legacy.width !== undefined ? across(v, legacy.width) : (across(v, legacy.height!) * art.w) / art.h;
  return { wd, h2: (wd * art.h) / art.w };
}
