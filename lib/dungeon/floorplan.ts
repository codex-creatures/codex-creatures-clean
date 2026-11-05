// lib/dungeon/floorplan.ts
// The Labyrinth as a place you walk round (the user's sketch,
// docs/ideas/labyrinth-v2.png): the scroll map's rooms (map.ts) laid out on a
// grid of tiles as rectangles, and each of its corridors dug as a tunnel
// between two doors. Only the shape for now, nothing in the rooms yet
// (previewed in app/lab/floorplan).
//
// The one promise: the tunnels join exactly the rooms the scroll links, no
// more and no fewer. Every tunnel keeps GAP tiles of rock from every other
// room and tunnel, so nothing touches by accident; checkFloorplan proves it.
//
// - Rooms sit where the scroll puts them (scaled up by SCALE), sized by kind
//   (ROOM_SIZE, LARGE_SIZE, LAIR_SIZE…). One that would crowd a neighbour
//   shrinks, down to MIN_SIZE.
// - Each corridor gets a door in each of its rooms' walls, facing the other
//   room, and a short straight stub out of it. A room's doors go round its
//   walls in the same order as its corridors leave it (else two tunnels
//   would have to cross), DOOR_SPACING apart. Then it's dug round the rooms and the
//   other tunnels the cheap way, with TURN_COST to keep it straight-ish and
//   DRIFT_COST to keep it near the scroll's straight line between the two
//   rooms. The scroll's corridors never cross (a planar map, map.ts), so
//   tunnels that hug them don't fence each other in.
// - A corridor that can't get through: the doors are placed again, with the
//   stuck ones dug first (up to ATTEMPTS times).
// - rollLabyrinth rolls the scroll and its floorplan together, and rolls a new
//   scroll if a plan ever fails checkFloorplan (about 1 map in 100 for the
//   Hydra and the Abyss), so a broken plan never reaches a player.

import { MAP_H, MAP_W, linkKey, rollMap, DEFAULT_SPEC, type DungeonMap, type MapNode, type MapSpec } from "./map";
import type { DungeonId } from "./run";

export const SCALE = 1.5;          // tiles per unit of the scroll map
export const GAP = 2;              // rock kept between any two separate spaces
export const PAD = 6;              // rock round the edge (tunnels may use it)
export const ROOM_SIZE = { w: [7, 11], h: [6, 9] };
export const LARGE_SIZE = { w: [14, 18], h: [11, 14] };
export const LAIR_SIZE = { w: [15, 15], h: [10, 10] };
export const ENTRANCE_SIZE = { w: [9, 9], h: [7, 7] };
export const MIN_SIZE = { w: 6, h: 5 };
export const ROOM_SEP = 2 * GAP + 3; // between two rooms' floors: room for a tunnel to pass
export const DOOR_SPACING = GAP + 1; // wall tiles from one door to the next
export const TURN_COST = 8;        // a bend costs as much as this many steps
export const DRIFT_FREE = 6;       // a tunnel may wander this far off the straight line for nothing…
export const DRIFT_COST = 0.5;     // …then each step costs this much more per tile further off
export const SEARCH_LIMIT = 600_000; // tiles (× headings) tried before a tunnel gives up
export const ATTEMPTS = 12;
export const MAP_REROLLS = 10;

// What each tile is. Rock next to a floor, tunnel or door is drawn as wall.
export const ROCK = 0, FLOOR = 1, TUNNEL = 2, DOOR = 3;

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number }; // a room's floor, top-left tile
export type Door = Pt & { room: string; link: string };
export type Floorplan = {
  w: number;
  h: number;
  tiles: Uint8Array;               // row by row, w × h
  rooms: Record<string, Rect>;
  doors: Door[];
  tunnels: Record<string, Pt[]>;   // by linkKey: the tiles between its two doors
  failed: string[];                // corridors that couldn't be dug (should be none)
};

type Rng = () => number;
const between = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// Up, right, down, left.
const DIRS: Pt[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

function sizeOf(map: DungeonMap, n: MapNode, rng: Rng) {
  const s = n.id === map.boss ? LAIR_SIZE : n.id === map.start ? ENTRANCE_SIZE : n.large ? LARGE_SIZE : ROOM_SIZE;
  return { w: between(rng, s.w), h: between(rng, s.h) };
}

// Tiles of empty floor between two rooms, on whichever axis they're furthest apart.
const apart = (a: Rect, b: Rect) =>
  Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));

// Rooms at their scroll spots, the lair and large ones first; the rest shrink to fit.
function placeRooms(map: DungeonMap, rng: Rng, W: number, H: number): Record<string, Rect> | null {
  const order = Object.values(map.nodes).sort((a, b) =>
    Number(b.id === map.boss) - Number(a.id === map.boss) || Number(!!b.large) - Number(!!a.large));
  const rooms: Record<string, Rect> = {};
  for (const n of order) {
    let { w, h } = sizeOf(map, n, rng);
    const at = (): Rect => {
      const x = Math.round(n.x * SCALE) + PAD - Math.floor(w / 2);
      const y = Math.round(n.y * SCALE) + PAD - Math.floor(h / 2);
      return { x: Math.min(Math.max(x, PAD), W - PAD - w), y: Math.min(Math.max(y, PAD), H - PAD - h), w, h };
    };
    let r = at();
    while (Object.values(rooms).some((o) => apart(r, o) < ROOM_SEP)) {
      if (w <= MIN_SIZE.w && h <= MIN_SIZE.h) return null;
      if (w - MIN_SIZE.w >= h - MIN_SIZE.h) w--; else h--;
      r = at();
    }
    rooms[n.id] = r;
  }
  return rooms;
}

// Who's on each tile while digging: -1 rock, else a room's or a corridor's number.
class Claims {
  owner: Int32Array;
  constructor(public w: number, public h: number) { this.owner = new Int32Array(w * h).fill(-1); }
  inside = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h;
  at = (x: number, y: number) => (this.inside(x, y) ? this.owner[y * this.w + x] : -1);
  set = (x: number, y: number, who: number) => { this.owner[y * this.w + x] = who; };
  // Nothing but rock (or `mine`) within GAP tiles, and not off the edge.
  clear(x: number, y: number, mine: number[]) {
    if (x < GAP || y < GAP || x >= this.w - GAP || y >= this.h - GAP) return false;
    for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) {
      const o = this.owner[(y + dy) * this.w + x + dx];
      if (o !== -1 && !mine.includes(o)) return false;
    }
    return true;
  }
}

type Plan = { door: Pt; out: number; stub: Pt[] };

// The spots in a room's wall a door can go (not the corners, nor beside
// them), clockwise from the top left, with the way out of each.
function doorSpots(r: Rect): { door: Pt; out: number }[] {
  const spots: { door: Pt; out: number }[] = [];
  for (let x = r.x + 1; x <= r.x + r.w - 2; x++) spots.push({ door: { x, y: r.y - 1 }, out: 0 });
  for (let y = r.y + 1; y <= r.y + r.h - 2; y++) spots.push({ door: { x: r.x + r.w, y }, out: 1 });
  for (let x = r.x + r.w - 2; x >= r.x + 1; x--) spots.push({ door: { x, y: r.y + r.h }, out: 2 });
  for (let y = r.y + r.h - 2; y >= r.y + 1; y--) spots.push({ door: { x: r.x - 1, y }, out: 3 });
  return spots;
}

// A room's doors, one per corridor (`who`, heading for `to`): each as near
// as it can be to facing its far room, in the same order round the walls as
// the corridors leave, DOOR_SPACING apart, each with a clear stub out.
function placeDoors(claims: Claims, r: Rect, roomWho: number, ways: { who: number; to: Pt }[]): Map<number, Plan> | null {
  const spots = doorSpots(r);
  const N = spots.length;
  if (ways.length * DOOR_SPACING > N) return null;
  const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
  const turn = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const angle = (p: Pt) => turn(Math.atan2(p.y - cy, p.x - cx));
  const gapTo = (a: number, b: number) => Math.min(Math.abs(a - b), 2 * Math.PI - Math.abs(a - b));
  // The spot nearest facing each far room.
  const want = ways.map((w) => {
    const a = angle(w.to);
    let best = 0;
    for (let i = 1; i < N; i++) if (gapTo(angle(spots[i].door), a) < gapTo(angle(spots[best].door), a)) best = i;
    return { ...w, ideal: best, a };
  }).sort((p, q) => p.ideal - q.ideal || p.a - q.a);
  // Round the walls from just after the widest gap between them, so the
  // order is a line, not a ring.
  let start = 0, widest = -1;
  want.forEach((w, i) => {
    const prev = want[(i - 1 + want.length) % want.length];
    const gap = (w.ideal - prev.ideal + N) % N || (want.length === 1 ? N : 0);
    if (gap > widest) { widest = gap; start = i; }
  });
  const line = [...want.slice(start), ...want.slice(0, start)];
  const at = line.map((w) => w.ideal);
  for (let i = 1; i < at.length; i++) while (at[i] < at[i - 1]) at[i] += N;
  // Spread them out, keeping their order, then pull back any that ran round into the first.
  for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1] + DOOR_SPACING);
  at[at.length - 1] = Math.min(at[at.length - 1], at[0] + N - DOOR_SPACING);
  for (let i = at.length - 2; i >= 0; i--) at[i] = Math.min(at[i], at[i + 1] - DOOR_SPACING);
  const plans = new Map<number, Plan>();
  for (let i = 0; i < line.length; i++) {
    const { door, out } = spots[((at[i] % N) + N) % N];
    const d = DIRS[out];
    const stub = Array.from({ length: GAP + 1 }, (_, k) => ({ x: door.x + d.x * (k + 1), y: door.y + d.y * (k + 1) }));
    if (!stub.every((p) => claims.at(p.x, p.y) === -1 && claims.clear(p.x, p.y, [roomWho, line[i].who]))) return null;
    for (const p of stub) claims.set(p.x, p.y, line[i].who);
    plans.set(line[i].who, { door, out, stub });
  }
  return plans;
}

// Digs tunnels: the cheapest way from one stub's end to the other's, through
// clear rock (A* over tile and heading). A bend costs TURN_COST, straying off
// the straight line DRIFT_COST. It looks within REACH tiles of the two ends
// first, then the whole map. (Its arrays are kept between tunnels: a big map
// has a lot of tiles.)
export const REACH = 40;
class Digger {
  cost: Float64Array;
  prev: Int32Array;
  seen: Int32Array;       // which dig last set cost/prev for a state
  clearSeen: Int32Array;  // which dig last worked out a tile's clearance…
  clearOk: Uint8Array;    // …and whether it was clear
  round = 0;
  constructor(public claims: Claims) {
    const n = claims.w * claims.h;
    this.cost = new Float64Array(n * 4);
    this.prev = new Int32Array(n * 4);
    this.seen = new Int32Array(n * 4);
    this.clearSeen = new Int32Array(n);
    this.clearOk = new Uint8Array(n);
  }

  dig(from: Pt, out: number, to: Pt, who: number, line: [Pt, Pt]): Pt[] | null {
    const box = {
      x0: Math.min(from.x, to.x) - REACH, x1: Math.max(from.x, to.x) + REACH,
      y0: Math.min(from.y, to.y) - REACH, y1: Math.max(from.y, to.y) + REACH,
    };
    return this.search(from, out, to, who, line, box) ?? this.search(from, out, to, who, line, null);
  }

  search(from: Pt, out: number, to: Pt, who: number, line: [Pt, Pt], box: { x0: number; x1: number; y0: number; y1: number } | null): Pt[] | null {
    const { claims, cost, prev, seen, clearSeen, clearOk } = this;
    const w = claims.w;
    const round = ++this.round;
    const mine = [who];
    const clear = (x: number, y: number) => {
      const t = y * w + x;
      if (clearSeen[t] !== round) { clearSeen[t] = round; clearOk[t] = claims.at(x, y) === -1 && claims.clear(x, y, mine) ? 1 : 0; }
      return clearOk[t] === 1;
    };
    const costOf = (st: number) => (seen[st] === round ? cost[st] : Infinity);
    // A binary heap of [estimate, state].
    const heap: [number, number][] = [];
    const push = (f: number, st: number) => {
      heap.push([f, st]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const guess = (x: number, y: number) => Math.abs(x - to.x) + Math.abs(y - to.y);
    // How far past DRIFT_FREE a tile is from the straight line between the two rooms.
    const [a, b] = line;
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const off = (x: number, y: number) => {
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / len2));
      return Math.max(0, Math.hypot(x - a.x - t * (b.x - a.x), y - a.y - t * (b.y - a.y)) - DRIFT_FREE);
    };
    const s0 = (from.y * w + from.x) * 4 + out;
    seen[s0] = round; cost[s0] = 0; prev[s0] = -1;
    push(guess(from.x, from.y), s0);
    let tried = 0;
    while (heap.length > 0) {
      const [f, st] = pop();
      const tile = st >> 2, dir = st & 3, x = tile % w, y = (tile / w) | 0;
      if (f - guess(x, y) > cost[st]) continue; // a stale entry
      if (++tried > SEARCH_LIMIT) return null;
      if (x === to.x && y === to.y) {
        const path: Pt[] = [];
        for (let t = st; t !== -1; t = prev[t]) path.push({ x: (t >> 2) % w, y: ((t >> 2) / w) | 0 });
        return path.reverse();
      }
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (dir + 2) % 4) continue; // no doubling back
        const nx = x + DIRS[nd].x, ny = y + DIRS[nd].y;
        const goal = nx === to.x && ny === to.y;
        if (!goal && box && (nx < box.x0 || nx > box.x1 || ny < box.y0 || ny > box.y1)) continue;
        if (!goal && !clear(nx, ny)) continue;
        const ns = (ny * w + nx) * 4 + nd;
        const c = cost[st] + 1 + (nd === dir ? 0 : TURN_COST) + DRIFT_COST * off(nx, ny);
        if (c >= costOf(ns)) continue;
        seen[ns] = round; cost[ns] = c; prev[ns] = st;
        push(c + guess(nx, ny), ns);
      }
    }
    return null;
  }
}

// The scroll's corridors, each once, nearest rooms first.
function corridors(map: DungeonMap): [string, string][] {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const a of Object.values(map.nodes)) for (const b of a.links) {
    const k = linkKey(a.id, b);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push([a.id, b]);
  }
  const len = ([a, b]: [string, string]) => Math.hypot(map.nodes[a].x - map.nodes[b].x, map.nodes[a].y - map.nodes[b].y);
  return out.sort((p, q) => len(p) - len(q));
}

function attempt(map: DungeonMap, rng: Rng, first: string[]): Floorplan | null {
  const W = Math.ceil(MAP_W * SCALE) + 2 * PAD;
  const H = Math.ceil((map.h ?? MAP_H) * SCALE) + 2 * PAD;
  const rooms = placeRooms(map, rng, W, H);
  if (!rooms) return null;
  const ids = Object.keys(rooms);
  const claims = new Claims(W, H);
  // Each room claims its floor and its wall.
  ids.forEach((id, i) => {
    const r = rooms[id];
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) claims.set(x, y, i);
  });
  // The stuck ones from last time first, then nearest first.
  const links = corridors(map).sort((p, q) => Number(first.includes(linkKey(...q))) - Number(first.includes(linkKey(...p))));
  const centre = (id: string) => ({ x: rooms[id].x + rooms[id].w / 2, y: rooms[id].y + rooms[id].h / 2 });
  // Doors and stubs for every corridor before any digging, so each keeps its way in.
  const whoOf = new Map(links.map(([a, b], i) => [linkKey(a, b), ids.length + i]));
  const doorsOf = new Map<string, Map<number, Plan>>();
  for (const id of ids) {
    const ways = map.nodes[id].links.map((b) => ({ who: whoOf.get(linkKey(id, b))!, to: centre(b) }));
    const placed = placeDoors(claims, rooms[id], ids.indexOf(id), ways);
    if (!placed) return null;
    doorsOf.set(id, placed);
  }
  const plans = links.map(([a, b]) => {
    const who = whoOf.get(linkKey(a, b))!;
    return { key: linkKey(a, b), who, ends: [[a, doorsOf.get(a)!.get(who)!], [b, doorsOf.get(b)!.get(who)!]] as [string, Plan][] };
  });
  const tunnels: Record<string, Pt[]> = {};
  const failed: string[] = [];
  const digger = new Digger(claims);
  for (const { key, who, ends: [[a, pa], [b, pb]] } of plans) {
    // One stuck: the rest wait for the next try (with this one dug first).
    if (failed.length > 0) { failed.push(key); continue; }
    const path = digger.dig(pa.stub[GAP], pa.out, pb.stub[GAP], who, [centre(a), centre(b)]);
    if (!path) { failed.push(key); continue; }
    for (const p of path) claims.set(p.x, p.y, who);
    tunnels[key] = [...pa.stub.slice(0, GAP), ...path, ...pb.stub.slice(0, GAP).reverse()];
  }
  const tiles = new Uint8Array(W * H);
  for (const r of Object.values(rooms)) for (let y = r.y; y < r.y + r.h; y++) tiles.fill(FLOOR, y * W + r.x, y * W + r.x + r.w);
  for (const t of Object.values(tunnels)) for (const p of t) tiles[p.y * W + p.x] = TUNNEL;
  const doors: Door[] = plans.filter((p) => tunnels[p.key]).flatMap(({ key, ends }) => ends.map(([room, p]) => ({ ...p.door, room, link: key })));
  for (const d of doors) tiles[d.y * W + d.x] = DOOR;
  return { w: W, h: H, tiles, rooms, doors, tunnels, failed };
}

// The labyrinth's floorplan. Tries again (stuck corridors first) until every
// corridor is dug; if it never manages, the best try, with `failed` listing the rest.
export function buildFloorplan(map: DungeonMap, rng: Rng = Math.random): Floorplan {
  let best: Floorplan | null = null;
  let first: string[] = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const fp = attempt(map, rng, first);
    if (!fp) continue;
    if (fp.failed.length === 0) return fp;
    if (!best || fp.failed.length < best.failed.length) best = fp;
    first = [...new Set([fp.failed[0], ...first])];
  }
  if (!best) throw new Error("floorplan: the rooms never fitted");
  return best;
}

// Everything wrong with a floorplan, in words (none = it's sound): every room
// is there, rooms never touch, and the tunnels join exactly the scroll's
// linked rooms, each by its own tunnel, entered only by its doors.
export function checkFloorplan(fp: Floorplan, map: DungeonMap): string[] {
  const problems: string[] = [];
  const { w, h, tiles } = fp;
  for (const id of Object.keys(map.nodes)) if (!fp.rooms[id]) problems.push(`no room for ${id}`);
  for (const k of fp.failed) problems.push(`corridor ${k} not dug`);
  // Label every walkable tile: a room's floor by the room, tunnels and doors by
  // which tunnel they're part of (joined up, side by side, not diagonally).
  const label = new Int32Array(w * h).fill(-1);
  const ids = Object.keys(fp.rooms);
  ids.forEach((id, i) => {
    const r = fp.rooms[id];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (tiles[y * w + x] !== FLOOR) problems.push(`room ${id} has a hole at ${x},${y}`);
      label[y * w + x] = i;
    }
  });
  const walk = (t: number) => tiles[t] === TUNNEL || tiles[t] === DOOR;
  let next = ids.length;
  const strayFloor = tiles.findIndex((t, i) => t === FLOOR && label[i] === -1);
  if (strayFloor >= 0) problems.push(`floor outside any room at ${strayFloor % w},${(strayFloor / w) | 0}`);
  for (let t = 0; t < w * h; t++) {
    if (!walk(t) || label[t] !== -1) continue;
    const stack = [t];
    label[t] = next;
    while (stack.length > 0) {
      const u = stack.pop()!, x = u % w, y = (u / w) | 0;
      for (const d of DIRS) {
        const v = (y + d.y) * w + x + d.x;
        if (x + d.x < 0 || x + d.x >= w || y + d.y < 0 || y + d.y >= h || !walk(v) || label[v] !== -1) continue;
        label[v] = next;
        stack.push(v);
      }
    }
    next++;
  }
  // Which rooms each tunnel opens into (only from a door, straight in).
  const opens = new Map<number, Set<string>>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = y * w + x;
    if (label[t] === -1) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const u = ny * w + nx;
      if (label[u] === -1 || label[u] === label[t]) continue;
      // Only a tunnel's door may touch a room, and only that room's floor.
      const [tun, room] = label[t] >= ids.length ? [t, u] : [u, t];
      const ok = label[tun] >= ids.length && label[room] < ids.length && tiles[tun] === DOOR
        && fp.doors.some((d) => d.y * w + d.x === tun && d.room === ids[label[room]]);
      if (!ok) { problems.push(`spaces touch at ${x},${y}`); continue; }
      if (dx !== 0 && dy !== 0) continue; // the door's own room, at a corner
      const set = opens.get(label[tun]) ?? new Set<string>();
      set.add(ids[label[room]]);
      opens.set(label[tun], set);
    }
  }
  const joined = new Set<string>();
  for (let c = ids.length; c < next; c++) {
    const rooms = [...(opens.get(c) ?? [])];
    if (rooms.length !== 2) { problems.push(`a tunnel opens into ${rooms.length} rooms (${rooms.join(", ")})`); continue; }
    const k = linkKey(rooms[0], rooms[1]);
    if (!map.nodes[rooms[0]].links.includes(rooms[1])) problems.push(`a tunnel joins ${k}, which the scroll doesn't link`);
    if (joined.has(k)) problems.push(`two tunnels join ${k}`);
    joined.add(k);
  }
  for (const a of Object.values(map.nodes)) for (const b of a.links) {
    const k = linkKey(a.id, b);
    if (!joined.has(k) && !fp.failed.includes(k)) problems.push(`nothing joins ${k}`);
  }
  return [...new Set(problems)];
}

// A walkable labyrinth: a planar scroll (no crossing corridors) and a
// floorplan that passed the check. Takes rollMap's arguments.
export function rollLabyrinth(firstRun: boolean, rng: Rng = Math.random, spec: MapSpec = DEFAULT_SPEC, dungeon: DungeonId = 1, dynamite = false): { map: DungeonMap; plan: Floorplan } {
  for (let i = 0; i < MAP_REROLLS; i++) {
    const map = rollMap(firstRun, rng, { ...spec, planar: true }, dungeon, dynamite);
    let plan: Floorplan;
    try { plan = buildFloorplan(map, rng); } catch { continue; } // the rooms never fitted
    if (checkFloorplan(plan, map).length === 0) return { map, plan };
  }
  throw new Error("floorplan: no labyrinth came out sound");
}
