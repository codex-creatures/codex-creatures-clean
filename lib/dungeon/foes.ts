// lib/dungeon/foes.ts
// Foes in the walkable Labyrinth, and being seen (the user, 2026-11-05: a
// fight starts when a room's foes see you). Pure rules, no drawing (previewed
// in app/lab/walk); not used by the game yet.
//
// - A fight room's foes (walkRooms.ts: the live room roll) stand in it as
//   markers, one each, spread out and away from its doors, so none is on top
//   of you as you walk in.
// - Some stand still, facing one way and turning now and then; the rest
//   (WANDER_SHARE) walk about their room, pausing at each spot.
// - Each sees along a line of sight (rock blocks it: walls, a dog-leg's
//   corner), within SIGHT_RANGE and a cone SIGHT_CONE wide the way it faces,
//   or SIGHT_NEAR whichever way it faces. Floors, doors and tunnels don't
//   block it, so a foe may see you coming down a tunnel.
// - If ANY of a room's foes sees you, ALL of that room's foes fight you
//   together (spottedBy says which room).
// - The chief's camp (ALERT_KINDS): he's waiting for you, and the fight
//   starts as you step in.
// - 🧪 Slipping past unseen: the room's foes stay where they are, its loot
//   stays with them, and it isn't cleared. Mostly it's then behind you (up
//   tunnels are one way); a room you can still reach sideways can still see
//   you, if you go back.
// The numbers are 🧪 (Claude's, for the user to judge in the lab).

import { ROCK, type Floorplan, type Pt, type Rect } from "./floorplan";
import { findPath } from "./walk";
import type { RoomKind } from "./run";

type Rng = () => number;

export const SIGHT_RANGE = 7;        // tiles
export const SIGHT_CONE = 90;        // degrees across
export const SIGHT_NEAR = 1.5;       // tiles: this close, they notice you whichever way they face
export const LOOK_TIME: [number, number] = [2, 5];  // seconds a still foe looks one way before turning
export const WANDER_SHARE = 0.5;     // of a room's foes walk about (the first always stands still)
export const FOE_SPEED = 1.5;        // tiles a second
export const PAUSE_TIME: [number, number] = [1, 3]; // seconds a walker stops at each spot
export const FOE_GAP = 3;            // tiles apart, at least, where they start
export const DOOR_CLEAR = 4;         // tiles from any of the room's doors, where they start
export const ALERT_KINDS: RoomKind[] = ["encampment"]; // rooms whose foes see you as you step in

// facing: radians, 0 = east, π/2 = south (screen y runs down).
// home: the room's floor, where a walker may go. path: tiles still to walk to.
export type Foe = { room: string; index: number; x: number; y: number; facing: number; walks: boolean; path: Pt[]; wait: number };

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);
// The four ways a still foe looks (east, south, west, north).
const WAYS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const inRects = (rs: Rect[], x: number, y: number) => rs.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

// Where `count` foes start in a room: on its floor (not the top row, under
// the wall's face), DOOR_CLEAR from its doors, FOE_GAP apart (closer if the
// room's too small for that).
export function placeFoes(fp: Floorplan, room: string, count: number, rng: Rng = Math.random): Foe[] {
  const floors = fp.rooms[room];
  const doors = fp.doors.filter((d) => d.room === room);
  const spots: Pt[] = [];
  for (const r of floors) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (spots.some((s) => s.x === x && s.y === y)) continue; // (a dog-leg's arms overlap)
    if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEAR)) continue;
    spots.push({ x, y });
  }
  const foes: Foe[] = [];
  for (let gap = FOE_GAP; foes.length < count && gap >= 0; gap--) {
    const free = spots.filter((s) => foes.every((f) => Math.hypot(f.x - s.x, f.y - s.y) >= Math.max(gap, 1)));
    while (foes.length < count && free.length > 0) {
      const s = free.splice(Math.floor(rng() * free.length), 1)[0];
      if (foes.some((f) => Math.hypot(f.x - s.x, f.y - s.y) < Math.max(gap, 1))) continue;
      const i = foes.length;
      foes.push({ room, index: i, ...s, facing: WAYS[Math.floor(rng() * 4)], walks: i > 0 && rng() < WANDER_SHARE, path: [], wait: between(rng, LOOK_TIME) });
    }
  }
  return foes;
}

// Can you see from one spot to another? Along the straight line between
// their middles, every tile it passes over walkable. (Steps of a quarter
// tile, which can't jump a wall: walls are a tile thick at least.)
export function lineOfSight(fp: Floorplan, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d * 4);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / Math.max(n, 1)), y = Math.round(a.y + ((b.y - a.y) * i) / Math.max(n, 1));
    if (x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK) return false;
  }
  return true;
}

// The gap between two angles, 0 to π.
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// Does this foe see you?
export function sees(fp: Floorplan, foe: Foe, you: Pt): boolean {
  const d = Math.hypot(you.x - foe.x, you.y - foe.y);
  if (d > SIGHT_RANGE) return false;
  if (d > SIGHT_NEAR && turn(Math.atan2(you.y - foe.y, you.x - foe.x), foe.facing) > (SIGHT_CONE * Math.PI) / 360) return false;
  return lineOfSight(fp, foe, you);
}

// The room whose foes have seen you (the first that has), or null. Only the
// rooms in `awake` (open, not yet beaten) look.
export function spottedBy(fp: Floorplan, foes: Foe[], you: Pt, awake: (room: string) => boolean): string | null {
  for (const f of foes) if (awake(f.room) && sees(fp, f, you)) return f.room;
  return null;
}

// A foe `seconds` later: a still one turns when it's looked long enough; a
// walker walks to a spot in its room, faces the way it's going, pauses there,
// then picks another.
export function stepFoe(fp: Floorplan, foe: Foe, seconds: number, rng: Rng = Math.random): Foe {
  if (!foe.walks || foe.path.length === 0) {
    const wait = foe.wait - seconds;
    if (wait > 0) return { ...foe, wait };
    if (!foe.walks) {
      const others = WAYS.filter((w) => turn(w, foe.facing) > 0.1);
      return { ...foe, facing: others[Math.floor(rng() * others.length)], wait: between(rng, LOOK_TIME) };
    }
    // Somewhere else in its room to walk to.
    const floors = fp.rooms[foe.room];
    const r = floors[Math.floor(rng() * floors.length)];
    const to = { x: r.x + Math.floor(rng() * r.w), y: r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 1)) };
    const from = { x: Math.round(foe.x), y: Math.round(foe.y) };
    const path = findPath(fp, from, to, (_, q) => inRects(floors, q.x, q.y)) ?? [];
    return { ...foe, path, wait: between(rng, PAUSE_TIME) };
  }
  let { x, y } = foe;
  let left = FOE_SPEED * seconds, facing = foe.facing, i = 0;
  while (i < foe.path.length && left > 0) {
    const p = foe.path[i], d = Math.hypot(p.x - x, p.y - y);
    if (d > 0) facing = Math.atan2(p.y - y, p.x - x);
    if (d <= left) { x = p.x; y = p.y; left -= d; i++; continue; }
    x += ((p.x - x) / d) * left;
    y += ((p.y - y) / d) * left;
    left = 0;
  }
  return { ...foe, x, y, facing, path: foe.path.slice(i) };
}

// What a foe can see, to draw: points round the edge of its cone, each ray
// stopped by the first rock (from the foe's middle, in tiles). rays: how many.
export function visionCone(fp: Floorplan, foe: Foe, rays = 16): Pt[] {
  const half = (SIGHT_CONE * Math.PI) / 360;
  const pts: Pt[] = [{ x: foe.x, y: foe.y }];
  for (let i = 0; i <= rays; i++) {
    const a = foe.facing - half + (2 * half * i) / rays;
    let reach = 0;
    for (let d = 0.25; d <= SIGHT_RANGE; d += 0.25) {
      const tx = Math.round(foe.x + Math.cos(a) * d), ty = Math.round(foe.y + Math.sin(a) * d);
      if (tx < 0 || ty < 0 || tx >= fp.w || ty >= fp.h || fp.tiles[ty * fp.w + tx] === ROCK) break;
      reach = d;
    }
    pts.push({ x: foe.x + Math.cos(a) * reach, y: foe.y + Math.sin(a) * reach });
  }
  return pts;
}
