// lib/dungeon/tileArt.ts
// Which way the hero and the walkers face as they move in the walked Labyrinth (lib/world/walkSim.ts,
// components/WalkView3D.tsx): four ways and eight, turned smoothly, and the walk cycle's frame.
// (The 2D view drew the dungeon from PixelLab tile sheets with rules that were here, the sheet's tiles,
// the corners, the wall faces and depth: removed with it, 2026-11-24.)

import { ROCK, type Floorplan } from "./floorplan";

// Facing, from a step: the way you're mostly going (straight up or down
// wins a tie, so diagonals in a room look like walking up or down it).
export type Facing = "south" | "east" | "north" | "west";
export const FACINGS: Facing[] = ["south", "east", "north", "west"]; // the rows of a hero sheet
export function facingOf(dx: number, dy: number, was: Facing = "south"): Facing {
  if (dx === 0 && dy === 0) return was;
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? "south" : "north";
  return dx > 0 ? "east" : "west";
}

// Turning as you walk (the user, 2026-11-14: walking diagonally, you flickered between two views every
// frame, as each frame's little step was a bit more one way, then the other). The way you face follows
// your heading smoothed over about FACING_SMOOTH tiles of walking (smoothHeading), and turns from an
// up/down view to a side one (or back) only once that heading is clearly past the diagonal: its bigger
// way FACING_LEAN times the other at least (about 36°). Turning right round is straight away.
export const FACING_SMOOTH = 0.4;  // tiles 🧪
export const FACING_LEAN = 1.35;   // 🧪
const OPPOSITE: Record<Facing, Facing> = { south: "north", north: "south", east: "west", west: "east" };
export function smoothHeading(h: { x: number; y: number }, dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  if (d === 0) return h;
  const a = Math.min(1, d / FACING_SMOOTH);
  return { x: h.x * (1 - a) + (dx / d) * a, y: h.y * (1 - a) + (dy / d) * a };
}
export function turnTo(dx: number, dy: number, was: Facing): Facing {
  const next = facingOf(dx, dy, was);
  if (next === was || next === OPPOSITE[was]) return next;
  return Math.max(Math.abs(dx), Math.abs(dy)) >= Math.min(Math.abs(dx), Math.abs(dy)) * FACING_LEAN ? next : was;
}

// 🧪 Eight ways (the user, 2026-11-14: an 8-direction hero, /lab/hero for now): the nearest of the
// eight to a heading (x right, y down the screen: south), held till the heading is FACING8_HOLD
// radians past the halfway to the next, so it doesn't flicker at a boundary either.
export const FACINGS8 = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"] as const;
export type Facing8 = (typeof FACINGS8)[number];
export const FACING8_HOLD = 0.12; // radians (about 7°) 🧪
export function facing8(dx: number, dy: number, was: Facing8 = "south"): Facing8 {
  if (dx === 0 && dy === 0) return was;
  const sector = (Math.PI * 2) / 8, a = Math.atan2(dx, dy); // 0: south, π/2: east
  const at = FACINGS8.indexOf(was) * sector, off = Math.atan2(Math.sin(a - at), Math.cos(a - at));
  if (Math.abs(off) <= sector / 2 + FACING8_HOLD) return was;
  return FACINGS8[((Math.round(a / sector) % 8) + 8) % 8];
}

// The frame of a walk cycle `frames` long after walking `tiles` tiles, a
// stride every STRIDE tiles; standing still is frame -1 (the standing pose).
export const STRIDE = 1.5; // tiles per walk cycle
export function walkFrame(tiles: number, moving: boolean, frames: number): number {
  return moving ? Math.floor(((tiles % STRIDE) / STRIDE) * frames) % frames : -1;
}

// The wall edges a floorplan's depth is drawn along: side walls (rock with
// walkable to its right, "left" walls, or to its left, "right" walls) and
// south walls (rock with walkable right above). Each as the rock tile.
export type DepthEdges = { left: { x: number; y: number }[]; right: { x: number; y: number }[]; south: { x: number; y: number }[] };
export function depthEdges(fp: Floorplan): DepthEdges {
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < fp.w && y < fp.h && fp.tiles[y * fp.w + x] !== ROCK;
  const out: DepthEdges = { left: [], right: [], south: [] };
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    if (open(x, y)) continue;
    if (open(x + 1, y)) out.left.push({ x, y });
    if (open(x - 1, y)) out.right.push({ x, y });
    if (open(x, y - 1)) out.south.push({ x, y });
  }
  return out;
}
