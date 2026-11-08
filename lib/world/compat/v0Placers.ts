// lib/world/compat/v0Placers.ts
// Frozen copies of the placers the game used before phase 2b (docs/world-
// spec.md §7): wall torches, candles, foes, a waiting boss and a camp's cages,
// with their numbers written in, so nothing that changes in the live rules
// can change what an old run converts to. Only the converter (v0.ts) uses
// them in the game; the lab's old walk preview and the tests that pin the old
// rules use them too. New runs are placed by lib/world/place.ts.
// Don't change these: a run saved before phase 2b depends on them as they are.

import { ROCK, type Floorplan, type Pt, type Rect } from "../../dungeon/floorplan";
import type { Sconce, Candle } from "../../dungeon/torch";
import type { Foe } from "../../dungeon/foes";

type Rng = () => number;

const solid = (fp: Floorplan, x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
const parentOf = (room: string) => room.split("~")[0];

// --- Wall torches (torch.ts, before 2b) ----------------------------------------

const SCONCE_EVERY = 8, TUNNEL_SCONCE_CHANCE = 0.4, SCONCE_LIT_SHARE = 0.2;

export function placeSconces(fp: Floorplan, start: string, rng: Rng = Math.random, tunnels = false): Sconce[] {
  const out: Sconce[] = [];
  for (const [room, rects] of Object.entries(fp.rooms)) {
    let k = 0;
    for (const r of rects) {
      const spots: number[] = [];
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (solid(fp, x, r.y - 1) && solid(fp, x - 1, r.y - 1) && solid(fp, x + 1, r.y - 1)) spots.push(x);
      if (spots.length === 0) continue;
      const n = Math.max(1, Math.round(r.w / SCONCE_EVERY));
      for (let i = 0; i < n; i++) {
        const x = spots[Math.min(spots.length - 1, Math.floor(((i + 0.5) / n) * spots.length))];
        if (out.some((s) => s.room === room && Math.abs(s.x - x) < 3 && s.y === r.y)) continue;
        out.push({ id: `${room}:${k++}`, room, x, y: r.y, lit: room === start || rng() < SCONCE_LIT_SHARE });
      }
    }
  }
  if (tunnels) for (const key of Object.keys(fp.tunnels).sort()) if (rng() < TUNNEL_SCONCE_CHANCE) out.push(...tunnelSconces(fp, key));
  return out;
}

function tunnelSconces(fp: Floorplan, key: string): Sconce[] {
  const ts = fp.tunnels[key];
  const x0 = Math.min(...ts.map((q) => q.x)), x1 = Math.max(...ts.map((q) => q.x));
  const y0 = Math.min(...ts.map((q) => q.y)), y1 = Math.max(...ts.map((q) => q.y));
  const up = y1 - y0 > x1 - x0;
  const from = (up ? y0 : x0) + 2, to = (up ? y1 : x1) - 2;
  if (to < from) return [];
  const n = Math.max(1, Math.round((to - from + 1) / SCONCE_EVERY));
  const out: Sconce[] = [];
  for (let i = 0; i < n; i++) {
    const along = from + Math.floor(((i + 0.5) / n) * (to - from + 1));
    const s: Sconce = up
      ? (i % 2 === 0 ? { id: "", room: key, x: x0, y: along, lit: false, wall: "left" } : { id: "", room: key, x: x1, y: along, lit: false, wall: "right" })
      : { id: "", room: key, x: along, y: y0, lit: false, wall: "top" };
    const wx = s.wall === "left" ? s.x - 1 : s.wall === "right" ? s.x + 1 : s.x, wy = s.wall === "top" ? s.y - 1 : s.y;
    if (solid(fp, wx, wy) && !solid(fp, s.x, s.y)) out.push({ ...s, id: `${key}:${out.length}` });
  }
  return out;
}

// --- Candles (torch.ts, before 2b) ---------------------------------------------

const CANDLE_CHANCE = 0.35, CANDLE_NEAR = [2, 5], CANDLE_CLEAR = 3;

export function placeCandles(fp: Floorplan, centres: Record<string, Pt>, skip: string[], rng: Rng = Math.random): Candle[] {
  const out: Candle[] = [];
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id) || rng() >= CANDLE_CHANCE) continue;
    const mid = centres[id], doors = fp.doors.filter((d) => d.room === id);
    const spots: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const d = Math.hypot(x - mid.x, y - mid.y);
      if (d < CANDLE_NEAR[0] || d > CANDLE_NEAR[1] || fp.tiles[y * fp.w + x] === ROCK || spots.some((s) => s.x === x && s.y === y)) continue;
      if (doors.some((q) => Math.hypot(q.x - x, q.y - y) < CANDLE_CLEAR)) continue;
      spots.push({ x, y });
    }
    if (spots.length > 0) out.push({ id: `candle:${id}`, room: id, ...spots[Math.floor(rng() * spots.length)], lit: false });
  }
  return out;
}

// --- Foes (foes.ts, before 2b) -------------------------------------------------

const FOE_GAP = 3, DOOR_CLEAR = 4, WANDER_SHARE = 0.5, WAIT_FROM_TOP = 4;
const LOOK_TIME: [number, number] = [2, 5];
const WAYS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);

function endOf(floors: Rect[], x: number, y: number): 0 | 1 {
  const x0 = Math.min(...floors.map((r) => r.x)), x1 = Math.max(...floors.map((r) => r.x + r.w));
  const y0 = Math.min(...floors.map((r) => r.y)), y1 = Math.max(...floors.map((r) => r.y + r.h));
  return x1 - x0 >= y1 - y0 ? (x < (x0 + x1) / 2 ? 0 : 1) : (y >= (y0 + y1) / 2 ? 0 : 1);
}

export function placeFoes(fp: Floorplan, room: string, count: number, rng: Rng = Math.random, end?: 0 | 1): Foe[] {
  const floors = fp.rooms[parentOf(room)];
  const doors = fp.doors.filter((d) => d.room === parentOf(room));
  const spots: Pt[] = [];
  for (const r of floors) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (spots.some((s) => s.x === x && s.y === y)) continue;
    if (fp.tiles[y * fp.w + x] === ROCK) continue;
    if (end !== undefined && endOf(floors, x, y) !== end) continue;
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
      foes.push({ room, index: i, ...s, facing: WAYS[Math.floor(rng() * 4)], walks: i > 0 && rng() < WANDER_SHARE, path: [], wait: between(rng, LOOK_TIME), ...(end !== undefined ? { end } : {}) });
    }
  }
  return foes;
}

export function placeWaiter(fp: Floorplan, room: string): Foe {
  const top = fp.rooms[room].reduce((a, b) => (b.y < a.y ? b : a));
  const y = Math.min(top.y + WAIT_FROM_TOP, top.y + top.h - 1);
  return { room, index: 0, x: top.x + Math.floor(top.w / 2), y, facing: Math.PI / 2, walks: false, path: [], wait: Infinity, waits: true };
}

// --- A camp's cages (walkRun.ts, before 2b) ------------------------------------

const CAGE_GAP = 4;

export function cageSpots(fp: Floorplan, room: string, count: number): Pt[] {
  const floors = fp.rooms[room];
  if (!floors || count === 0) return [];
  const top = floors.reduce((a, b) => (b.y < a.y ? b : a));
  const mid = top.x + Math.floor(top.w / 2);
  const gap = Math.min(CAGE_GAP, Math.floor((top.w - 2) / Math.max(1, count)));
  return Array.from({ length: count }, (_, i) => ({ x: mid + Math.round((i - (count - 1) / 2) * gap), y: top.y + 1 }));
}
