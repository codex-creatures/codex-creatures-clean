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
// - Bosses wait for you (the user, 2026-11-06: the Encampment's chief, the
//   Cyclops): one stands at the top of its room facing the way in, never
//   wandering, and its fight starts only once you've walked up to it
//   (WAIT_REACH, in sight), not as you step in.
// - Seen, the fight doesn't start at once (the user, 2026-11-06): each of
//   the room's foes lights up (ALARM_LIGHT) with a "!" over it, and after a
//   moment (ALARM_PAUSE) they all come at you (chargePath, CHARGE_SPEED).
//   It fades into the fight (FADE_TIME) once they've all reached you, or
//   LATE_GRACE after the first has, or ALARM_MAX after they saw you, whichever
//   is first (fightReady).
// - 🧪 Slipping past unseen: the room's foes stay where they are, its loot
//   stays with them, and it isn't cleared. Mostly it's then behind you (up
//   tunnels are one way); a room you can still reach sideways can still see
//   you, if you go back.
// The numbers are 🧪 (Claude's, for the user to judge in the lab).

import { ROCK, type Floorplan, type Pt, type Rect } from "./floorplan";
import { findPath, type CanStep } from "./walk";
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
export const ALERT_KINDS: RoomKind[] = ["encampment"]; // /lab/walk only (its own copy): the chief's fight starts as you step in
export const WAIT_REACH = 3.5;       // tiles: walk this close to a waiting boss (in sight of it) and it fights you 🧪
export const WAIT_FROM_TOP = 4;      // tiles below its room's top wall a waiting boss stands
export const GUARD_REACH = 2;        // tiles: a chest's guards patrol this close round it (the user, 2026-11-09) 🧪

// facing: radians, 0 = east, π/2 = south (screen y runs down).
// home: the room's floor, where a walker may go. path: tiles still to walk to.
// waits: a boss waiting for you (see the top). end: the end of a big room it
// keeps to, when the room holds two dens (0 or 1: endOf). guard: the chest it
// patrols round, close (GUARD_REACH), instead of wandering its room.
export type Foe = { room: string; index: number; x: number; y: number; facing: number; walks: boolean; path: Pt[]; wait: number; waits?: boolean; end?: 0 | 1; guard?: Pt };

// A big room's second den (the user, 2026-11-06: big and long rooms can hold
// two, one down each end): a room of its own in the run ("<room>~2"),
// standing in its parent's floor. Its foes keep to the far end (1), the
// parent's to the near one (0).
export const spawnOf = (room: string) => `${room}~2`;
export const parentOf = (room: string) => room.split("~")[0];
export const isSpawn = (room: string) => room.includes("~");
// Which end of a room a tile is at: split across the middle of its longer
// side (a dog-leg's box: so its two arms' tips are its ends).
export function endOf(floors: Rect[], x: number, y: number): 0 | 1 {
  const x0 = Math.min(...floors.map((r) => r.x)), x1 = Math.max(...floors.map((r) => r.x + r.w));
  const y0 = Math.min(...floors.map((r) => r.y)), y1 = Math.max(...floors.map((r) => r.y + r.h));
  return x1 - x0 >= y1 - y0 ? (x < (x0 + x1) / 2 ? 0 : 1) : (y >= (y0 + y1) / 2 ? 0 : 1);
}

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);
// The four ways a still foe looks (east, south, west, north).
const WAYS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const inRects = (rs: Rect[], x: number, y: number) => rs.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

// Where foes start: lib/world/place.ts (new runs) and lib/world/compat/v0Placers.ts
// (runs from before phase 2b). The numbers above are the new placer's.

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
  if (foe.waits) return d <= WAIT_REACH && lineOfSight(fp, foe, you);
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

export const ALARM_PAUSE = 0.5;   // seconds of "!" before they come
export const CHARGE_SPEED = 4;    // tiles a second, coming at you
export const ARRIVE = 1.5;        // tiles from you: it's reached you
export const LATE_GRACE = 1;      // seconds after the first reaches you, the fight starts anyway
export const ALARM_MAX = 4;       // …and, whatever else, this long after they saw you
export const FADE_TIME = 0.6;     // seconds fading into the fight
export const ALARM_LIGHT = 2.5;   // tiles a foe that's seen you lights round it

// The way a foe comes at you: the shortest way to you, stopping a tile short; round anything solid
// (`clear`: walkSim's foeClear), or straight over it if that's the only way (so the fight still starts).
// [] if it's next to you already, or can't get to you (it stays where it is).
export function chargePath(fp: Floorplan, from: Pt, you: Pt, clear?: CanStep): Pt[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) }, end = { x: Math.round(you.x), y: Math.round(you.y) };
  const way = (clear && findPath(fp, start, end, clear)) || findPath(fp, start, end);
  return way ? way.slice(0, -1) : [];
}

// Time to fade into the fight? `arrived`: when each foe that's reached you
// did (seconds after they saw you); `count`: how many are coming; `t`: seconds since.
export function fightReady(arrived: number[], count: number, t: number): boolean {
  if (t >= ALARM_MAX || arrived.length >= count) return true;
  return arrived.length > 0 && t - Math.min(...arrived) >= LATE_GRACE;
}

// A foe coming at you, `seconds` later: along its path at CHARGE_SPEED, facing the way it goes.
export function chargeFoe(foe: Foe, seconds: number): Foe {
  let { x, y } = foe;
  let left = CHARGE_SPEED * seconds, facing = foe.facing, i = 0;
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

// A spot round a chest for its guard to walk to: on the room's floor, within
// GUARD_REACH of it, not on it (else where the guard is).
function guardSpot(fp: Floorplan, floors: Rect[], chest: Pt, at: Pt, rng: Rng): Pt {
  const c = { x: Math.round(chest.x), y: Math.round(chest.y) };
  for (let tries = 0; tries < 8; tries++) {
    const q = { x: c.x + Math.round((rng() * 2 - 1) * GUARD_REACH), y: c.y + Math.round((rng() * 2 - 1) * GUARD_REACH) };
    if ((q.x !== c.x || q.y !== c.y) && inRects(floors, q.x, q.y) && fp.tiles[q.y * fp.w + q.x] !== ROCK) return q;
  }
  return { x: Math.round(at.x), y: Math.round(at.y) };
}

// A foe `seconds` later: a still one turns when it's looked long enough; a
// walker walks to a spot in its room, faces the way it's going, pauses there,
// then picks another.
// `clear`: where it may step (round anything solid: walkSim's foeClear).
export function stepFoe(fp: Floorplan, foe: Foe, seconds: number, rng: Rng = Math.random, clear?: CanStep): Foe {
  if (foe.waits) return foe;
  if (!foe.walks || foe.path.length === 0) {
    const wait = foe.wait - seconds;
    if (wait > 0) return { ...foe, wait };
    if (!foe.walks) {
      const others = WAYS.filter((w) => turn(w, foe.facing) > 0.1);
      return { ...foe, facing: others[Math.floor(rng() * others.length)], wait: between(rng, LOOK_TIME) };
    }
    // Somewhere else in its room (its end of it; a guard, round its chest) to walk to.
    const floors = fp.rooms[parentOf(foe.room)];
    let to: Pt = { x: foe.x, y: foe.y };
    if (foe.guard) to = guardSpot(fp, floors, foe.guard, to, rng);
    else for (let tries = 0; tries < 6; tries++) {
      const r = floors[Math.floor(rng() * floors.length)];
      to = { x: r.x + Math.floor(rng() * r.w), y: r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 1)) };
      if (foe.end === undefined || endOf(floors, to.x, to.y) === foe.end) break;
      to = { x: Math.round(foe.x), y: Math.round(foe.y) };
    }
    const from = { x: Math.round(foe.x), y: Math.round(foe.y) };
    const path = findPath(fp, from, to, (p, q) => inRects(floors, q.x, q.y) && (!clear || clear(p, q))) ?? [];
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
