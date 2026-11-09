// lib/dungeon/walk.ts
// Walking round the Labyrinth's tiles (floorplan.ts, from layout.ts): tap a spot and you
// walk there by the shortest way, through floors, doors and tunnels only
// (rock is solid), with the camera following you. Pure rules, no drawing
// (previewed in app/lab/walk).
//
// - Positions are in tiles; a tile's centre is its whole number.
// - The way is found over the tile grid, diagonals allowed (they look less
//   robotic in a room) but never cutting a corner of rock, so you can't slip
//   through a gap between two walls touching at a corner.
// - Tapping rock walks you to the nearest walkable tile, if one is within
//   TAP_REACH (a tap just off a tunnel still counts).
// - A tap anywhere else (the dark, rock, somewhere you can't get to) walks you
//   as close to it as you can get (walkToward; the user, 2026-11-06).
// - A new tap while walking finishes the step you're on, then turns.
// - canStep (optional) can forbid steps on top of rock: the Labyrinth's
//   closed rooms and one-way tunnels (layout.ts stepRule).

import { ROCK, type Floorplan, type Pt } from "./floorplan";
import type { DungeonMap } from "./map";

export const WALK_SPEED = 6;  // tiles a second
export const TAP_REACH = 3;   // a tap on rock looks this many tiles round for somewhere to walk

export type Walker = { x: number; y: number; path: Pt[] }; // path: the tiles still to reach, in order
export type CanStep = (from: Pt, to: Pt) => boolean;

export const walkable = (fp: Floorplan, x: number, y: number) =>
  x >= 0 && y >= 0 && x < fp.w && y < fp.h && fp.tiles[y * fp.w + x] !== ROCK;

// Where a walk starts: the middle of the entrance.
export function entranceSpot(fp: Floorplan, map: DungeonMap): Pt {
  const r = fp.rooms[map.start][0];
  return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
}

// The room a spot is in (its floor, not its doors), or null in a tunnel.
export function roomAt(fp: Floorplan, p: Pt): string | null {
  const x = Math.round(p.x), y = Math.round(p.y);
  for (const [id, rs] of Object.entries(fp.rooms)) if (rs.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) return id;
  return null;
}

// The walkable tile nearest a spot (itself if it's walkable), or null if
// there's none within `reach`.
export function nearestWalkable(fp: Floorplan, p: Pt, reach = TAP_REACH): Pt | null {
  const x0 = Math.round(p.x), y0 = Math.round(p.y);
  let best: Pt | null = null, bestD = Infinity;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const d = dx * dx + dy * dy;
    if (d < bestD && d <= reach * reach && walkable(fp, x0 + dx, y0 + dy)) { best = { x: x0 + dx, y: y0 + dy }; bestD = d; }
  }
  return best;
}

// Eight ways: the four straight first.
const STEPS: Pt[] = [
  { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
  { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

// The shortest way from one tile to another (A*): the tiles after `from`,
// ending on `to`. [] if they're the same tile, null if there's no way.
export function findPath(fp: Floorplan, from: Pt, to: Pt, canStep?: CanStep): Pt[] | null {
  if (!walkable(fp, from.x, from.y) || !walkable(fp, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];
  const { w } = fp;
  const cost = new Float64Array(fp.w * fp.h).fill(Infinity);
  const prev = new Int32Array(fp.w * fp.h).fill(-1);
  const guess = (x: number, y: number) => {
    const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // A binary heap of [estimate, tile].
  const heap: [number, number][] = [];
  const push = (f: number, t: number) => {
    heap.push([f, t]);
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
  const start = from.y * w + from.x, goal = to.y * w + to.x;
  cost[start] = 0;
  push(guess(from.x, from.y), start);
  while (heap.length > 0) {
    const [f, t] = pop();
    const x = t % w, y = (t / w) | 0;
    if (f - guess(x, y) > cost[t] + 1e-9) continue; // a stale entry (diagonals' √2 leave rounding crumbs)
    if (t === goal) {
      const path: Pt[] = [];
      for (let u = t; u !== start; u = prev[u]) path.push({ x: u % w, y: (u / w) | 0 });
      return path.reverse();
    }
    for (const s of STEPS) {
      const nx = x + s.x, ny = y + s.y;
      if (!walkable(fp, nx, ny)) continue;
      const diagonal = s.x !== 0 && s.y !== 0;
      if (diagonal && (!walkable(fp, x + s.x, y) || !walkable(fp, x, y + s.y))) continue; // no cutting a corner
      if (canStep && !canStep({ x, y }, { x: nx, y: ny })) continue;
      const n = ny * w + nx;
      const c = cost[t] + (diagonal ? Math.SQRT2 : 1);
      if (c >= cost[n]) continue;
      cost[n] = c;
      prev[n] = t;
      push(c + guess(nx, ny), n);
    }
  }
  return null;
}

// Head for a tapped spot (in tiles). Mid-step, the step is finished first.
// A tap with nowhere to walk near it leaves you as you were.
export function walkTo(fp: Floorplan, me: Walker, spot: Pt, canStep?: CanStep): Walker {
  const target = nearestWalkable(fp, spot);
  if (!target) return me;
  const from = me.path[0] ?? { x: Math.round(me.x), y: Math.round(me.y) };
  const way = findPath(fp, from, target, canStep);
  if (!way) return me;
  return { ...me, path: me.path.length > 0 ? [from, ...way] : way };
}

// The tile you can reach that's closest to a spot (as the crow flies), and
// of those the nearest to walk to; `from` itself if nothing reachable is closer.
export function closestReachable(fp: Floorplan, from: Pt, spot: Pt, canStep?: CanStep): Pt {
  const { w } = fp;
  const steps = new Int32Array(fp.w * fp.h).fill(-1);
  const gap = (x: number, y: number) => Math.hypot(x - spot.x, y - spot.y);
  let best = from, bestGap = gap(from.x, from.y);
  steps[from.y * w + from.x] = 0;
  const queue = [from.y * w + from.x];
  for (let q = 0; q < queue.length; q++) {
    const t = queue[q], x = t % w, y = (t / w) | 0;
    for (const s of STEPS) {
      const nx = x + s.x, ny = y + s.y, n = ny * w + nx;
      if (!walkable(fp, nx, ny) || steps[n] >= 0) continue;
      if (s.x !== 0 && s.y !== 0 && (!walkable(fp, x + s.x, y) || !walkable(fp, x, y + s.y))) continue; // no cutting a corner
      if (canStep && !canStep({ x, y }, { x: nx, y: ny })) continue;
      steps[n] = steps[t] + 1;
      queue.push(n);
      const g = gap(nx, ny);
      if (g < bestGap - 1e-9) { best = { x: nx, y: ny }; bestGap = g; } // (breadth first: the first found is the nearest to walk to)
    }
  }
  return best;
}

// Head for a tapped spot, or as close to it as you can get.
export function walkToward(fp: Floorplan, me: Walker, spot: Pt, canStep?: CanStep): Walker {
  const from = me.path[0] ?? { x: Math.round(me.x), y: Math.round(me.y) };
  const target = closestReachable(fp, from, spot, canStep);
  if (target.x === from.x && target.y === from.y) return me.path.length > 0 ? { ...me, path: [from] } : me;
  const way = findPath(fp, from, target, canStep);
  if (!way) return me;
  return { ...me, path: me.path.length > 0 ? [from, ...way] : way };
}

// Where you are `seconds` later, walking WALK_SPEED along the path.
export function advance(me: Walker, seconds: number): Walker {
  let { x, y } = me;
  let left = WALK_SPEED * seconds;
  let i = 0;
  while (i < me.path.length && left > 0) {
    const p = me.path[i];
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= left) { x = p.x; y = p.y; left -= d; i++; continue; }
    x += ((p.x - x) / d) * left;
    y += ((p.y - y) / d) * left;
    left = 0;
  }
  return { x, y, path: me.path.slice(i) };
}

// The camera's top-left corner (in tiles) for a view `view` tiles across:
// you in the middle, but never showing past the floorplan's edge (a
// floorplan smaller than the view sits in the middle of it).
export function cameraAt(fp: Floorplan, me: Pt, view: { w: number; h: number }): Pt {
  const axis = (at: number, size: number, span: number) =>
    span >= size ? (size - span) / 2 : Math.min(Math.max(at + 0.5 - span / 2, 0), size - span);
  return { x: axis(me.x, fp.w, view.w), y: axis(me.y, fp.h, view.h) };
}

// ── The joystick (WalkView's stick, bottom right; the user, 2026-11-09) ──
// Held, it walks you a tile at a time the way it points, snapped to the eight
// ways. Pushed diagonally into a wall, you slide along it the way it leans
// (the straight way with more push first); pushed straight into one, you stop.
export const STICK_DEAD = 0.3;  // share of the stick's reach that counts as letting go
export const STICK_NEXT = 0.35; // tiles: this close to the tile you're stepping onto, the next step's picked (no stop between)

// The tile next to `from` to step onto for a push (dx, dy: screen ways, down is +y), or null.
export function stickNext(fp: Floorplan, from: Pt, dx: number, dy: number, canStep?: CanStep): Pt | null {
  if (Math.hypot(dx, dy) < STICK_DEAD) return null;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // the nearest of the eight ways
  const sx = Math.round(Math.cos(a * Math.PI / 4)), sy = Math.round(Math.sin(a * Math.PI / 4));
  const ok = (x: number, y: number) => {
    if (x === 0 && y === 0) return false;
    const to = { x: from.x + x, y: from.y + y };
    if (!walkable(fp, to.x, to.y)) return false;
    if (x !== 0 && y !== 0 && (!walkable(fp, from.x + x, from.y) || !walkable(fp, from.x, from.y + y))) return false; // no cutting a corner
    return !canStep || canStep(from, to);
  };
  const tries: Pt[] = sx !== 0 && sy !== 0
    ? (Math.abs(dx) >= Math.abs(dy) ? [{ x: sx, y: sy }, { x: sx, y: 0 }, { x: 0, y: sy }] : [{ x: sx, y: sy }, { x: 0, y: sy }, { x: sx, y: 0 }])
    : [{ x: sx, y: sy }];
  const s = tries.find((t) => ok(t.x, t.y));
  return s ? { x: from.x + s.x, y: from.y + s.y } : null;
}

// Walk the way the stick's pushed: once you're nearly onto the tile you're
// stepping to (or standing), the next one's queued, so you walk on smoothly.
// Let go, and you finish the step you're on.
export function walkStick(fp: Floorplan, me: Walker, dx: number, dy: number, canStep?: CanStep): Walker {
  const to = me.path[0];
  if (to && Math.hypot(to.x - me.x, to.y - me.y) > STICK_NEXT) return { ...me, path: [to] };
  const from = to ?? { x: Math.round(me.x), y: Math.round(me.y) };
  const next = stickNext(fp, from, dx, dy, canStep);
  if (!next) return to ? { ...me, path: [to] } : me;
  return { ...me, path: to ? [to, next] : [next] };
}
