// lib/dungeon/decor.ts
// Things lying about the walkable Labyrinth's rooms, so they're less alike
// (🚧 the user, 2026-11-06: "upgrades to the art, things that make the rooms
// less repetitive and more engaging"; samples, shown in /lab/newrun only
// until the user has picked). Pure rules, no drawing (components/WalkView.tsx).
//
// - Each room gets a few bits of decor (DECOR_PER, at most DECOR_MOST), more
//   in bigger rooms, picked from its kind's theme (THEMES: bones and nests in
//   creature dens, barrels and crates in storehouses and by merchants…; two
//   of a kind at most, one nest: KIND_MOST), and
//   a big room now and then a fallen pillar near its middle.
// - Barrels, crates and the pillar are solid, so they only go against a wall
//   (a floor tile beside rock), never by a door; bones, nests and pots lie
//   anywhere on the floor, and are walked over.
// - Never on a room's middle (its chest, pool or stash), its fire or candle,
//   or the top row (under the wall's face); a tile apart from each other.
// - Where it all goes comes from the run's seed, so nothing new is saved.
// - Floors: now and then a tile is a worn one (cracks, chips, moss: FLOOR_WORN
//   of them), picked by the tile's place and the seed (floorVariant).

import { FLOOR, ROCK, type Floorplan, type Pt } from "./floorplan";
import type { RoomKind } from "./run";

type Rng = () => number;

export type DecorKind = "barrels" | "crates" | "skull" | "nest" | "pots" | "pillar";
export const SOLID_DECOR: DecorKind[] = ["barrels", "crates", "pillar"];
export type Decor = { kind: DecorKind; room: string; x: number; y: number; solid: boolean };

export const DECOR_PER = 28;       // floor tiles per bit of decor 🧪
export const DECOR_MOST = 8;       // …and at most this many in a room 🧪
export const KIND_MOST: Partial<Record<DecorKind, number>> = { nest: 1 }; // of one kind in a room (the rest: 2) 🧪
export const PILLAR_FLOOR = 150;   // floor tiles a room needs for a fallen pillar 🧪
export const PILLAR_CHANCE = 0.5;  // …and how often it has one 🧪
export const DECOR_CLEAR = 2.5;    // tiles from the room's middle, at least
export const DOOR_CLEAR = 3;       // tiles from a door, at least
export const FLOOR_WORN = 0.25;    // of floor tiles are worn ones 🧪

// What suits each kind of room (the rest: a bit of everything).
export const THEMES: Partial<Record<RoomKind, DecorKind[]>> = {
  easy: ["skull", "nest", "pots"],
  hard: ["skull", "skull", "nest"],
  miniboss: ["skull", "skull", "pots"],
  storehouse: ["barrels", "crates", "crates", "barrels"],
  merchant: ["barrels", "crates"],
  encampment: ["barrels", "crates", "skull"],
  library: ["crates", "pots"],
  librarian: ["crates", "pots"],
  chest: ["pots", "crates"],
  stash: ["pots", "barrels"],
};
const ANY: DecorKind[] = ["skull", "pots", "barrels", "crates", "nest"];

// A room's decor. kinds: what each room is; avoid: spots kept clear (its
// middle, fire, candle); skip: rooms with none (the entrance, the boss's).
export function placeDecor(fp: Floorplan, kinds: Record<string, RoomKind>, centres: Record<string, Pt>, avoid: Pt[], skip: string[], rng: Rng = Math.random): Decor[] {
  const out: Decor[] = [];
  const rock = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id)) continue;
    const mid = centres[id], doors = fp.doors.filter((d) => d.room === id);
    const floor: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!floor.some((q) => q.x === x && q.y === y)) floor.push({ x, y });
    }
    const free = (q: Pt) => Math.hypot(q.x - mid.x, q.y - mid.y) >= DECOR_CLEAR
      && doors.every((d) => Math.hypot(d.x - q.x, d.y - q.y) >= DOOR_CLEAR)
      && avoid.every((a) => Math.hypot(a.x - q.x, a.y - q.y) >= 1.5)
      && out.every((o) => Math.hypot(o.x - q.x, o.y - q.y) >= 2);
    const byWall = (q: Pt) => rock(q.x - 1, q.y) || rock(q.x + 1, q.y) || rock(q.x, q.y + 1);
    const put = (kind: DecorKind, spots: Pt[]) => {
      const ok = spots.filter(free);
      if (ok.length === 0) return;
      const q = ok[Math.floor(rng() * ok.length)];
      out.push({ kind, room: id, ...q, solid: SOLID_DECOR.includes(kind) });
    };
    // A big room's fallen pillar, a little off its middle.
    if (floor.length >= PILLAR_FLOOR && rng() < PILLAR_CHANCE) {
      put("pillar", floor.filter((q) => { const d = Math.hypot(q.x - mid.x, q.y - mid.y); return d >= 3 && d <= 6 && !byWall(q); }));
    }
    const theme = THEMES[kinds[id]] ?? ANY;
    const count = Math.min(DECOR_MOST, Math.max(1, Math.round(floor.length / DECOR_PER)));
    for (let i = 0; i < count; i++) {
      const left = theme.filter((k) => out.filter((o) => o.room === id && o.kind === k).length < (KIND_MOST[k] ?? 2));
      if (left.length === 0) break;
      const kind = left[Math.floor(rng() * left.length)];
      put(kind, SOLID_DECOR.includes(kind) ? floor.filter(byWall) : floor);
    }
  }
  return out;
}

// Which floor tile to draw at (x, y): 0 the plain one, 1–count a worn one.
export function floorVariant(x: number, y: number, seed: number, count: number): number {
  if (count <= 0) return 0;
  let h = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  const r = ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  return r < FLOOR_WORN ? 1 + Math.floor((r / FLOOR_WORN) * count) : 0;
}

// Walls: now and then a stretch of a room's top wall is a worn one (cracks,
// chips, cobwebs, ivy: WALL_WORN of them, wallVariant), and some rooms have
// a banner hanging on it (BANNER_CHANCE), two tiles wide, never over a door
// or a wall torch. x, y: the banner's left tile (the floor's top row).
export const WALL_WORN = 0.3;      // of a wall's tiles 🧪
export const BANNER_CHANCE = 0.35; // of rooms 🧪
export const wallVariant = (x: number, y: number, seed: number, count: number) => {
  if (count <= 0) return 0;
  let h = (x * 2654435761) ^ (y * 40503) ^ (seed * 97);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  const r = ((h ^ (h >>> 12)) >>> 0) / 4294967296;
  return r < WALL_WORN ? 1 + Math.floor((r / WALL_WORN) * count) : 0;
};
export function placeBanners(fp: Floorplan, taken: Pt[], skip: string[], rng: Rng = Math.random): Pt[] {
  const out: Pt[] = [];
  const rock = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
  const floor = (x: number, y: number) => !rock(x, y) && fp.tiles[y * fp.w + x] === FLOOR;
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id) || rng() >= BANNER_CHANCE) continue;
    const top = fp.rooms[id].reduce((a, b) => (b.y < a.y ? b : a));
    const spots: Pt[] = [];
    for (let x = top.x + 1; x + 1 < top.x + top.w - 1; x++) {
      const y = top.y;
      if (![x, x + 1].every((q) => floor(q, y) && rock(q, y - 1))) continue;
      if (taken.some((t) => t.y === y && Math.abs(t.x - x - 0.5) < 2)) continue;
      spots.push({ x, y });
    }
    if (spots.length > 0) out.push(spots[Math.floor(rng() * spots.length)]);
  }
  return out;
}
