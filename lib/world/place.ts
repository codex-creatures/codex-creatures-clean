// lib/world/place.ts
// Where things go in a new walkable run (docs/world-spec.md §5.3, §8 phase 2b-1):
// world version 3. Made once, when the run is made, and saved in it
// (WalkRun.placed); never made again unless the player asks for a damaged run
// to be mended, which gives the same list. Runs from before keep what the old
// rules placed (lib/world/compat/v0.ts).
//
// The passes, in order, every one through the same occupancy rules
// (occupancy.ts), so nothing here keeps its own list of what to avoid:
// 0. what the run already holds: pillars (rock in the layout) and campfires
//    (rolled as the run starts, `fires`), each keeping candles a little away;
// 1. reserve: each room's doors, the spots its things must stand at (its
//    middle, the cages, a waiting boss's stand, a guarded chest's spot), and a
//    path from its doors to each other and to every one of those;
// 2. stamps: none yet (§5.5);
// 3. structure: the pillars, already marked;
// 4. things you use: a room's feature at its middle, a large room's stores,
//    the merchant and the librarian, a camp's cages along its top;
// 5. wall slots: wall torches, as many and where today's rules put them;
// 6. floor lights: a candle now and then, kept away from campfires;
// 7. spawns: every fight room's foes (an ambush's too) and the card witch,
//    never on something placed or a kept spot, and only where you can get to.
// (8, decor, is the lab's only for now; 9, worn floor, is worked out from the seed.)
//
// Each room's pass has its own random numbers (run seed, room, pass), so a
// room's foes never depend on another room, or on what's been beaten.
// Optional things (a candle) try every valid spot, in a random order, before
// they're left out; required things (a room's feature, a cage, a boss) go to
// the nearest valid panel if theirs is taken, and are reported if none is.
// Every search is over a finite list, so none can loop.

import { roomCentre, layoutFloorplan } from "../dungeon/layout";
import { ROCK, type Floorplan, type Pt, type Rect } from "../dungeon/floorplan";
import { SCONCE_EVERY, TUNNEL_SCONCE_CHANCE, SCONCE_LIT_SHARE, CANDLE_CHANCE, CANDLE_NEAR, CANDLE_CLEAR } from "../dungeon/torch";
import { FOE_GAP, DOOR_CLEAR, WANDER_SHARE, LOOK_TIME, WAIT_FROM_TOP, endOf, spawnOf, parentOf } from "../dungeon/foes";
import { CAGE_GAP, waitsHere, type WalkRun } from "../dungeon/walkRun";
import { hasFight, fightContainer, type DungeonId, type Room } from "../dungeon/run";
import type { DungeonMap } from "../dungeon/map";
import { seeded, roomIds, fightsLater, guardedChestSpot } from "./walkWorld";
import { subcellOfPanel } from "./grid";
import { objectDef, type Instance, type FoeStart } from "./objects";
import {
  newOccupancy, markStone, reserve, keepClear, canPlace, take, canStand, navBlocked, isFloor, slotKey, slotFree, takeSlot, panelKey,
  type Occupancy, type Wall,
} from "./occupancy";

export const PLACED_V = 3;          // the world version these rules place for (version.ts)
export const CANDLE_FIRE_GAP = 2;   // panels a candle keeps from a campfire (today's "hidden by the fire" distance)

export type PlaceNote = { id: string; room: string; what: string };
export type PlaceReport = {
  moved: PlaceNote[];      // a required thing put on the nearest valid panel, its own being taken
  omitted: PlaceNote[];    // an optional thing with no valid spot, left out
  problems: PlaceNote[];   // a required thing or path with nowhere to go (the tests fail on any)
};

type Rng = () => number;
type Sub = { sx: number; sy: number };
const anchorOf = (p: Pt): Sub => ({ sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) });
const AROUND: Pt[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
const STEPS: Pt[] = AROUND.slice(0, 4);
const WAYS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);
const inRects = (rs: Rect[], p: Pt) => rs.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);

// A room's pass's random numbers: its own stream from (run seed, room, pass).
export function passRng(seed: number, key: string, pass: number): Rng {
  let h = 2166136261;
  for (const ch of `${seed}|${key}|${pass}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return seeded(((h >>> 0) % 2147483646) + 1);
}

// The feature a room shows at its middle (walkWorld.ts thingsOf shows it), by its kind.
function featureOf(r: Room): { key: string; def: string } | null {
  switch (r.kind) {
    case "chest": case "treasure": return { key: "chest", def: "chest" };
    case "stash": return { key: "sack", def: "sack" };
    case "pool": return { key: "pool", def: "pool" };
    case "cards": return { key: "card-deck", def: "card-deck" };
    case "merchant": return { key: "merchant", def: "merchant" };
    case "librarian": return { key: "librarian", def: "librarian" };
    // (A library has its librarian, or codexes lying about: never both.)
    case "library": return r.librarian ? { key: "librarian", def: "librarian" } : { key: "stores", def: "sack" };
    case "storehouse": return { key: "stores", def: "rickety-chest" };
    default: return null;
  }
}

// Where a camp's cages stand: a row along the top of its room, CAGE_GAP apart.
function cageRow(floors: Rect[], count: number): Pt[] {
  if (count === 0) return [];
  const top = floors.reduce((a, b) => (b.y < a.y ? b : a));
  const mid = top.x + Math.floor(top.w / 2);
  const gap = Math.min(CAGE_GAP, Math.floor((top.w - 2) / Math.max(1, count)));
  return Array.from({ length: count }, (_, i) => ({ x: mid + Math.round((i - (count - 1) / 2) * gap), y: top.y + 1 }));
}
// A waiting boss's stand: the middle of its room's top floor, WAIT_FROM_TOP down.
function standOf(floors: Rect[]): Pt {
  const top = floors.reduce((a, b) => (b.y < a.y ? b : a));
  return { x: top.x + Math.floor(top.w / 2), y: Math.min(top.y + WAIT_FROM_TOP, top.y + top.h - 1) };
}

// A room's floor panels, nearest `from` first (then north to south, west to
// east): the finite list every "somewhere else" search walks.
function byDistance(floors: Rect[], from: Pt): Pt[] {
  const seen = new Set<string>(), out: Pt[] = [];
  for (const r of floors) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (!seen.has(`${x},${y}`)) { seen.add(`${x},${y}`); out.push({ x, y }); }
  }
  const d = (p: Pt) => Math.hypot(p.x - from.x, p.y - from.y);
  return out.sort((a, b) => d(a) - d(b) || a.y - b.y || a.x - b.x);
}

// The panels just inside a room's doors.
function doorsInside(o: Occupancy, floors: Rect[], room: string): Pt[] {
  const out: Pt[] = [];
  for (const d of o.fp.doors) if (d.room === room) for (const s of STEPS) {
    const p = { x: d.x + s.x, y: d.y + s.y };
    if (inRects(floors, p) && isFloor(o, p) && !out.some((q) => q.x === p.x && q.y === p.y)) out.push(p);
  }
  return out;
}

// The shortest way (four ways, panel to panel) through a room's open floor
// from one panel to the nearest of `to`, avoiding `blocked`; null if none.
function pathIn(o: Occupancy, floors: Rect[], from: Pt, to: Pt[], blocked: Set<string>): Pt[] | null {
  const goal = new Set(to.map(panelKey));
  const prev = new Map<string, string | null>([[panelKey(from), null]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (goal.has(panelKey(at))) {
      const out: Pt[] = [];
      for (let k: string | null = panelKey(at); k; k = prev.get(k)!) { const [x, y] = k.split(",").map(Number); out.push({ x, y }); }
      return out.reverse();
    }
    for (const s of STEPS) {
      const n = { x: at.x + s.x, y: at.y + s.y };
      if (prev.has(panelKey(n)) || !inRects(floors, n) || navBlocked(o, n) || blocked.has(panelKey(n))) continue;
      prev.set(panelKey(n), panelKey(at));
      queue.push(n);
    }
  }
  return null;
}

// Every panel of a room you can walk to from its doors, as things stand.
export function reachableIn(o: Occupancy, floors: Rect[], room: string): Set<string> {
  const seen = new Set<string>();
  const queue = doorsInside(o, floors, room).filter((p) => !navBlocked(o, p));
  for (const p of queue) seen.add(panelKey(p));
  while (queue.length) {
    const at = queue.shift()!;
    for (const s of STEPS) {
      const n = { x: at.x + s.x, y: at.y + s.y };
      if (seen.has(panelKey(n)) || !inRects(floors, n) || navBlocked(o, n)) continue;
      seen.add(panelKey(n));
      queue.push(n);
    }
  }
  return seen;
}

// A room's required spots (pass 1): each with what it's kept for, and whether
// what stands there is solid (so paths go up beside it, not onto it).
type Point = { at: Pt; owner: string; room: string; def?: string; solid: boolean };
function pointsOf(layoutRoom: WalkRun["layout"]["rooms"][string], floors: Rect[], id: string, r: Room, dungeon: DungeonId, walk: WalkRun): Point[] {
  const out: Point[] = [];
  const f = featureOf(r);
  if (f) out.push({ at: roomCentre(layoutRoom), owner: `${id}:${f.key}`, room: id, def: f.def, solid: objectDef(f.def).collision === "solid" });
  cageRow(floors, r.cages?.length ?? 0).forEach((at, i) => out.push({ at, owner: `${id}#${i}`, room: id, def: "cage", solid: true }));
  if (waitsHere(r, dungeon)) out.push({ at: standOf(floors), owner: `${id}:foe:0`, room: id, solid: false });
  if ((hasFight(r) || fightsLater(r)) && fightContainer(r, dungeon) !== "sack") out.push({ at: guardedChestSpot(walk.layout, id, r, dungeon), owner: `${id}:loot`, room: id, solid: false });
  return out;
}

// How many foes a room starts with (when the run's made, nothing's beaten):
// a waiting boss, or one for each of its enemies (an ambush's too).
const foeCount = (r: Room, dungeon: DungeonId) => (waitsHere(r, dungeon) ? 1 : hasFight(r) || fightsLater(r) ? r.enemies?.length ?? 0 : 0);

export type Placed = { placed: Instance[]; report: PlaceReport; occupancy: Occupancy };

// Everything placed in a new walkable run, with what had to move or be left
// out, and the occupancy map as it ended (for the tests and a debugging view).
export function placeWalk(walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Placed {
  const layout = walk.layout, fp: Floorplan = layoutFloorplan(layout);
  const o = newOccupancy(fp);
  const placed: Instance[] = [];
  const report: PlaceReport = { moved: [], omitted: [], problems: [] };
  const parents = Object.keys(layout.rooms).sort();
  const floorsOf = (id: string) => fp.rooms[parentOf(id)];

  // 0. What the run holds already: pillars, and campfires (each keeping candles off).
  for (const id of parents) for (const r of fp.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (fp.tiles[y * fp.w + x] === ROCK) markStone(o, { x, y });
  }
  const fire = objectDef("campfire");
  for (const [n, f] of (walk.fires ?? []).entries()) {
    const at = anchorOf(f);
    if (canPlace(o, fire, at, `fire:${n}`)) report.problems.push({ id: `fire:${n}`, room: f.room, what: `a campfire ${canPlace(o, fire, at, `fire:${n}`)}` });
    take(o, fire, at, `campfire:${f.room}`);
    keepClear(o, f, CANDLE_FIRE_GAP, ["light"], `campfire:${f.room}`);
  }

  // 1. Reserve: doors, each room's spots, and the paths to them.
  const pointsBy = new Map<string, Point[]>();
  for (const id of parents) {
    const floors = fp.rooms[id];
    const points = roomIds(layout, map).filter((k) => parentOf(k) === id).flatMap((k) => {
      const r = room(k);
      return r ? pointsOf(layout.rooms[id], floors, k, r, dungeon, walk) : [];
    });
    pointsBy.set(id, points);
    const doors = doorsInside(o, floors, id);
    for (const d of doors) reserve(o, d, "door");
    for (const p of points) reserve(o, p.at, "point", p.owner);
    const blocked = new Set(points.filter((p) => p.solid).map((p) => panelKey(p.at)));
    const keep = (from: Pt, to: Pt[], what: string) => {
      const way = pathIn(o, floors, from, to, blocked);
      if (!way) report.problems.push({ id, room: id, what: `no way ${what}` });
      else for (const q of way) reserve(o, q, "path");
    };
    for (let a = 0; a < doors.length; a++) for (let b = a + 1; b < doors.length; b++) keep(doors[a], [doors[b]], "between its doors");
    for (const p of points) {
      const beside = p.solid ? AROUND.map((s) => ({ x: p.at.x + s.x, y: p.at.y + s.y })) : [p.at];
      if (doors.length) keep(doors[0], beside, `to ${p.owner}`);
    }
  }

  // 4. Things you use, each at the spot kept for it (or the nearest valid panel).
  const required = (id: string, def: string, want: Pt, floors: Rect[], extra: Partial<Instance> = {}) => {
    const d = objectDef(def);
    const spot = byDistance(floors, want).find((p) => !canPlace(o, d, anchorOf(p), id));
    if (!spot) { report.problems.push({ id, room: extra.room ?? "", what: `nowhere for ${def}: ${canPlace(o, d, anchorOf(want), id)}` }); return; }
    if (spot.x !== want.x || spot.y !== want.y) report.moved.push({ id, room: extra.room ?? "", what: `${canPlace(o, d, anchorOf(want), id)}; to ${spot.x},${spot.y}` });
    take(o, d, anchorOf(spot), id);
    placed.push({ id, def, room: extra.room!, ...anchorOf(spot), size: { ...d.footprint }, ...extra });
  };
  for (const id of parents) for (const p of pointsBy.get(id)!) {
    if (!p.def) continue;
    required(p.owner, p.def, p.at, fp.rooms[id], { room: p.room });
  }

  // 5. Wall torches: along each room's top wall, one every SCONCE_EVERY panels;
  // some tunnels have theirs too. Which start lit, rolled room by room.
  const wallAt = (p: Pt, wall: Wall) => (wall === "north" ? { x: p.x, y: p.y - 1 } : wall === "west" ? { x: p.x - 1, y: p.y } : wall === "east" ? { x: p.x + 1, y: p.y } : { x: p.x, y: p.y + 1 });
  const rock = (p: Pt) => p.x < 0 || p.y < 0 || p.x >= fp.w || p.y >= fp.h || fp.tiles[p.y * fp.w + p.x] === ROCK;
  const torch = (id: string, room: string, p: Pt, wall: Wall, lit: boolean) => {
    const key = slotKey(p, wall);
    if (!slotFree(o, key) || !rock(wallAt(p, wall)) || rock(p)) return false;
    takeSlot(o, key, id);
    placed.push({ id, def: wall === "north" ? "sconce" : "sconce-side", room, ...anchorOf(p), wall, ...(lit ? { start: "lit" as const } : {}) });
    return true;
  };
  for (const id of parents) {
    const rng = passRng(walk.seed, id, 5);
    let k = 0;
    const mine: Pt[] = [];
    for (const r of fp.rooms[id]) {
      const spots: number[] = [];
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) if ([-1, 0, 1].every((dx) => rock({ x: x + dx, y: r.y - 1 }))) spots.push(x);
      if (spots.length === 0) continue;
      const n = Math.max(1, Math.round(r.w / SCONCE_EVERY));
      for (let i = 0; i < n; i++) {
        const x = spots[Math.min(spots.length - 1, Math.floor(((i + 0.5) / n) * spots.length))];
        if (mine.some((s) => Math.abs(s.x - x) < 3 && s.y === r.y)) continue;
        if (torch(`${id}:${k}`, id, { x, y: r.y }, "north", id === layout.start || rng() < SCONCE_LIT_SHARE)) { k++; mine.push({ x, y: r.y }); }
      }
    }
  }
  for (const key of Object.keys(fp.tunnels).sort()) {
    if (passRng(walk.seed, key, 5)() >= TUNNEL_SCONCE_CHANCE) continue;
    const ts = fp.tunnels[key];
    const x0 = Math.min(...ts.map((q) => q.x)), x1 = Math.max(...ts.map((q) => q.x));
    const y0 = Math.min(...ts.map((q) => q.y)), y1 = Math.max(...ts.map((q) => q.y));
    const up = y1 - y0 > x1 - x0;
    const from = (up ? y0 : x0) + 2, to = (up ? y1 : x1) - 2;
    if (to < from) continue;
    const n = Math.max(1, Math.round((to - from + 1) / SCONCE_EVERY));
    let m = 0;
    for (let i = 0; i < n; i++) {
      const along = from + Math.floor(((i + 0.5) / n) * (to - from + 1));
      const [p, wall]: [Pt, Wall] = up ? (i % 2 === 0 ? [{ x: x0, y: along }, "west"] : [{ x: x1, y: along }, "east"]) : [{ x: along, y: y0 }, "north"];
      if (torch(`${key}:${m}`, key, p, wall, false)) m++;
    }
  }

  // 6. Candles: now and then a room has one near its middle; every valid spot
  // tried, in a random order, before it's left out.
  const candle = objectDef("candle");
  for (const id of parents) {
    if (id === layout.start || id === layout.boss) continue;
    const rng = passRng(walk.seed, id, 6);
    if (rng() >= CANDLE_CHANCE) continue;
    const mid = roomCentre(layout.rooms[id]), doors = fp.doors.filter((d) => d.room === id);
    const spots: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const d = Math.hypot(x - mid.x, y - mid.y);
      if (d < CANDLE_NEAR[0] || d > CANDLE_NEAR[1] || spots.some((s) => s.x === x && s.y === y)) continue;
      if (doors.some((q) => Math.hypot(q.x - x, q.y - y) < CANDLE_CLEAR)) continue;
      spots.push({ x, y });
    }
    const cid = `candle:${id}`;
    let put = false;
    while (spots.length && !put) {
      const p = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      if (canPlace(o, candle, anchorOf(p), cid)) continue;
      take(o, candle, anchorOf(p), cid);
      placed.push({ id: cid, def: "candle", room: id, ...anchorOf(p), size: { ...candle.footprint } });
      put = true;
    }
    if (!put) report.omitted.push({ id: cid, room: id, what: "no valid spot" });
  }

  // 7. Spawns: every fight room's foes, and the card witch.
  const reach = new Map(parents.map((id) => [id, reachableIn(o, fp.rooms[id], id)]));
  const startsFor = (id: string, count: number, rng: Rng, end?: 0 | 1, rule = "foe"): (Pt & { facing: number; walks: boolean; wait: number })[] => {
    const floors = floorsOf(id), doors = fp.doors.filter((d) => d.room === parentOf(id)), ok = reach.get(parentOf(id))!;
    const spots: Pt[] = [];
    for (const r of floors) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const p = { x, y };
      if (spots.some((s) => s.x === x && s.y === y) || canStand(o, p) || !ok.has(panelKey(p))) continue;
      if (end !== undefined && endOf(floors, x, y) !== end) continue;
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEAR)) continue;
      spots.push(p);
    }
    const out: (Pt & { facing: number; walks: boolean; wait: number })[] = [];
    for (let gap = FOE_GAP; out.length < count && gap >= 0; gap--) {
      const free = spots.filter((s) => out.every((f) => Math.hypot(f.x - s.x, f.y - s.y) >= Math.max(gap, 1)));
      while (out.length < count && free.length > 0) {
        const s = free.splice(Math.floor(rng() * free.length), 1)[0];
        if (out.some((f) => Math.hypot(f.x - s.x, f.y - s.y) < Math.max(gap, 1))) continue;
        const i = out.length;
        out.push({ ...s, facing: WAYS[Math.floor(rng() * 4)], walks: i > 0 && rng() < WANDER_SHARE, wait: between(rng, LOOK_TIME) });
      }
    }
    if (out.length < count) report.problems.push({ id, room: id, what: `room for ${out.length} of ${count} ${rule}s` });
    return out;
  };
  for (const id of roomIds(layout, map)) {
    const r = room(id);
    if (!r) continue;
    const rng = passRng(walk.seed, id, 7);
    if (r.kind === "witch") {
      for (const f of startsFor(id, 1, rng, undefined, "witch")) placed.push({ id: `${id}:witch`, def: "witch", room: id, ...anchorOf(f), facing: f.facing });
      continue;
    }
    const count = foeCount(r, dungeon);
    if (!count) continue;
    if (waitsHere(r, dungeon)) {
      const at = standOf(floorsOf(id)), why = canStand(o, at, `${id}:foe:0`);
      if (why) report.problems.push({ id: `${id}:foe:0`, room: id, what: `a waiting boss ${why}` });
      placed.push({ id: `${id}:foe:0`, def: "foe", room: id, ...anchorOf(at), facing: Math.PI / 2, foe: { waits: true } });
      continue;
    }
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    startsFor(id, count, rng, end).forEach((f, i) => {
      const foe: FoeStart = { ...(f.walks ? { walks: true as const } : {}), wait: f.wait, ...(end !== undefined ? { end } : {}) };
      placed.push({ id: `${id}:foe:${i}`, def: "foe", room: id, ...anchorOf(f), facing: f.facing, foe });
    });
  }
  return { placed, report, occupancy: o };
}
