// lib/dungeon/layout.ts
// The walkable Labyrinth's layout, rolled in layers like the user's sketches
// (docs/ideas/gen-roll-1…4.png): first the rooms, packed together like a
// jigsaw, then straight tunnels between neighbours, then what's in each
// room (campMap). Long winding tunnels, the first try, were too much walking.
//
// - Everything is measured in blocks of BLOCK×BLOCK tiles: room sizes,
//   places and the rock between them, so it all lines up. A room's size is
//   its footprint, walls included.
// - Gen 1, rooms: the entrance alone along the bottom, then rooms of the
//   SHAPES dropped into the lowest free spot one by one (GAP_BLOCKS of rock
//   round each), LAYOUT_W blocks across (about 4 rooms side by side in the
//   middle), then the boss's room on top. One shape is a dog-leg: an L, two
//   long rooms joined at a right angle, turned any of four ways (its `cut`
//   is the corner it lacks; packed as its whole box).
// - Gen 2, tunnels: a straight tunnel, TUNNEL_W tiles wide, can join two
//   rooms whose facing walls overlap enough, with at most MAX_REACH blocks of
//   rock between them and nothing else in the way; now and then a second one
//   beside it (TWIN_CHANCE: two ways into the same room). All are dug (twins
//   by chance, or where a room needs one for a second way on); then tunnels
//   are dropped at random (DROP_CHANCE) as long as the layout stays sound
//   (routeProblems), so the straight way up isn't always there.
//
// Moving on (the user, 2026-11-05): you only ever go forward or sideways.
// - A tunnel going up is one way: up.
// - Once you've gone up one, there's a line along the bottom of the room you
//   came into. A room wholly behind it (the room you left, for one) is
//   closed, and so is every tunnel into it. Sideways tunnels go both ways,
//   even into a room that hangs partly behind the line.
// - Sound (routeProblems): wherever you go, the boss can still be reached
//   (no traps), every room can be reached somehow, the entrance has
//   START_WAYS ways out, the boss BOSS_WAYS ways in, no room more than
//   MAX_TUNNELS tunnels, the shortest route is spec.minRoute rooms or more,
//   and every room offers a choice (the user, 2026-11-05: never just one way
//   on): CHOICES or more of tunnels up out of it and sideways tunnels into
//   rooms with a tunnel up out of them.

import type { RoomKind } from "./run";
import { linkKey, fillCamp, markRooms, type DungeonMap, type MapNode, type MapSpec } from "./map";
import { FLOOR, TUNNEL, DOOR, checkFloorplan, type Door, type Floorplan, type Pt, type Rect } from "./floorplan";

export const BLOCK = 3;            // tiles across a block
export const LAYOUT_W = 30;        // blocks across the rooms (about 4 side by side in the middle), an EDGE more each side
export const EDGE = 2;             // blocks of rock round the outside
export type Shape = { name: string; w: number; h: number; weight: number; arm?: number }; // arm: a dog-leg's thickness
// The user's starting sizes (2026-11-05), in blocks, walls included.
export const SHAPES: Shape[] = [
  { name: "small", w: 5, h: 5, weight: 3 },
  { name: "wide", w: 10, h: 4, weight: 2 },
  { name: "tall", w: 4, h: 10, weight: 2 },
  { name: "big", w: 8, h: 6, weight: 2 },
  { name: "dog-leg", w: 9, h: 9, weight: 2, arm: 4 }, // a 9×4 and a 4×9 joined at a corner
];
export const START_SHAPE: Shape = { name: "start", w: 14, h: 4, weight: 0 };
export const BOSS_SHAPE: Shape = { name: "boss", w: 10, h: 8, weight: 0 };
export const GAP_BLOCKS = [1, 3];  // rock between two rooms (at least)
export const START_BESIDE = 1;     // blocks of rock beside the entrance, so the first rooms sit over it
export const MIN_OVERLAP = 3;      // blocks two rooms' facing walls share, for a tunnel between them
export const MAX_REACH = 6;        // blocks of rock a tunnel may cross
export const TUNNEL_W = 3;         // tiles
export const TWIN_CHANCE = 0.3;    // a second tunnel between the same two rooms, where one fits
export const TWIN_PILLAR = 2;      // tiles of rock between twins, at least
export const DROP_CHANCE = 0.5;    // a tunnel that could go, goes
export const MAX_TUNNELS = 5;      // per room
export const START_WAYS = [2, 3];  // ways out of the entrance
export const BOSS_WAYS = 2;        // ways into the boss's room (at least)
export const CHOICES = 2;          // ways on from every room (see the top)
export const LAYOUT_REROLLS = 400;

export type Corner = "ne" | "nw" | "se" | "sw";
const CORNERS: Corner[] = ["ne", "nw", "se", "sw"];
// Blocks, y down. cut and arm: a dog-leg's missing corner and thickness.
export type LayoutRoom = { id: string; shape: string; x: number; y: number; w: number; h: number; cut?: Corner; arm?: number };
// up: `a` is the room below, `b` the one above (one way, up). Sideways: `a` on the left.
export type Tunnel = { key: string; a: string; b: string; up: boolean; rect: Rect }; // rect in tiles, door rows included
export type Layout = { w: number; h: number; start: string; boss: string; rooms: Record<string, LayoutRoom>; tunnels: Tunnel[] };

type Rng = () => number;
const between = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));
function shuffle<T>(rng: Rng, list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// Shapes in a random order, likelier ones first.
function weighted(rng: Rng, shapes: Shape[]): Shape[] {
  const left = shapes.slice(), out: Shape[] = [];
  while (left.length > 0) {
    let r = rng() * left.reduce((s, x) => s + x.weight, 0);
    const i = Math.max(0, left.findIndex((x) => (r -= x.weight) < 0));
    out.push(...left.splice(i, 1));
  }
  return out;
}

// --- Gen 1: rooms -----------------------------------------------------------

// Packed from the bottom up: `top` is how high each column of blocks is
// filled, and each room goes in the lowest stretch of columns, GAP_BLOCKS
// above what's there and clear of its neighbours by a block or more.
export function rollRooms(count: number, rng: Rng): Layout {
  const W = LAYOUT_W;
  const placed: { id: string; shape: Shape; x: number; b: number; cut?: Corner }[] = []; // b: blocks up from the bottom
  const top = new Array<number>(W).fill(0);
  const clear = (x: number, b: number, s: Shape) => placed.every((p) =>
    x >= p.x + p.shape.w + 1 || p.x >= x + s.w + 1 || b >= p.b + p.shape.h + 1 || p.b >= b + s.h + 1);
  const put = (id: string, shape: Shape, x: number, b: number) => {
    placed.push({ id, shape, x, b, ...(shape.arm ? { cut: CORNERS[Math.floor(rng() * CORNERS.length)] } : {}) });
    for (let c = x; c < x + shape.w; c++) top[c] = Math.max(top[c], b + shape.h);
  };
  // The entrance, alone along the bottom.
  put("start", START_SHAPE, Math.floor((W - START_SHAPE.w) / 2) + between(rng, [-3, 3]), 0);
  // Beside it is rock, so the first rooms go over it.
  top.fill(START_SHAPE.h + START_BESIDE);
  const sx = placed[0].x;
  top.fill(START_SHAPE.h, sx, sx + START_SHAPE.w);
  const narrowest = Math.min(...SHAPES.map((s) => s.w));
  for (let n = 1; n <= count;) {
    // The lowest stretches of columns; one at random.
    const low = Math.min(...top);
    const runs: [number, number][] = [];
    for (let c = 0; c < W; c++) if (top[c] === low && (c === 0 || top[c - 1] !== low)) {
      let e = c;
      while (e < W && top[e] === low) e++;
      runs.push([c, e]);
    }
    const [r0, r1] = runs[Math.floor(rng() * runs.length)];
    if (r1 - r0 < narrowest) {
      // Too narrow for any room: rock, up to its lower neighbour.
      top.fill(Math.min(r0 > 0 ? top[r0 - 1] : Infinity, r1 < W ? top[r1] : Infinity), r0, r1);
      continue;
    }
    const b = low + between(rng, GAP_BLOCKS);
    let done = false;
    for (const shape of weighted(rng, SHAPES)) {
      if (shape.w > r1 - r0) continue;
      // Snug against one end of the stretch (a block off any neighbour), so
      // what's left stays in one piece and rooms line up with the ones below.
      const xs = Array.from({ length: r1 - r0 - shape.w + 1 }, (_, i) => r0 + i);
      if (rng() < 0.5) xs.reverse();
      const x = xs.find((x) => clear(x, b, shape));
      if (x === undefined) continue;
      put(`r${n++}`, shape, x, b);
      done = true;
      break;
    }
    if (!done) top.fill(low + 1, r0, r1); // hemmed in by a neighbour: try a block higher
  }
  // The boss's room on top, above every other room's floor: where the most
  // rooms could tunnel up into it, then as low as it'll go, then nearest the middle.
  const floorLine = Math.max(...placed.map((p) => p.b));
  const reaching = (x: number, b: number) => placed.filter((p) =>
    p.b + p.shape.h <= b && b - (p.b + p.shape.h) <= MAX_REACH
    && Math.min(x + BOSS_SHAPE.w, p.x + p.shape.w) - Math.max(x, p.x) >= MIN_OVERLAP).length;
  let best: { x: number; b: number; n: number } | null = null;
  for (let x = 0; x + BOSS_SHAPE.w <= W; x++) {
    let b = Math.max(Math.max(...top.slice(x, x + BOSS_SHAPE.w)) + GAP_BLOCKS[0], floorLine);
    while (!clear(x, b, BOSS_SHAPE)) b++;
    const n = reaching(x, b), mid = (q: number) => Math.abs(q + BOSS_SHAPE.w / 2 - W / 2);
    if (!best || n > best.n || (n === best.n && (b < best.b || (b === best.b && mid(x) < mid(best.x))))) best = { x, b, n };
  }
  put("boss", BOSS_SHAPE, best!.x, best!.b);
  // Into blocks counted from the top-left, with EDGE round the outside.
  const H = Math.max(...placed.map((p) => p.b + p.shape.h));
  const rooms: Record<string, LayoutRoom> = {};
  for (const p of placed) {
    rooms[p.id] = { id: p.id, shape: p.shape.name, x: p.x + EDGE, y: H - p.b - p.shape.h + EDGE, w: p.shape.w, h: p.shape.h,
      ...(p.cut ? { cut: p.cut, arm: p.shape.arm } : {}) };
  }
  return { w: W + 2 * EDGE, h: H + 2 * EDGE, start: "start", boss: "boss", rooms, tunnels: [] };
}

// A room as rectangles, in blocks: its box, or a dog-leg's two arms (the one
// across, on the side away from the missing corner, and the one up and down).
function partsOf(r: LayoutRoom): Rect[] {
  if (!r.cut || !r.arm) return [{ x: r.x, y: r.y, w: r.w, h: r.h }];
  const across = { x: r.x, y: r.cut[0] === "n" ? r.y + r.h - r.arm : r.y, w: r.w, h: r.arm };
  const upDown = { x: r.cut[1] === "e" ? r.x : r.x + r.w - r.arm, y: r.y, w: r.arm, h: r.h };
  return [across, upDown];
}
// In tiles: its footprints (walls included), and its floors (less a wall all round).
const footprintsOf = (r: LayoutRoom): Rect[] => partsOf(r).map((p) => ({ x: p.x * BLOCK, y: p.y * BLOCK, w: p.w * BLOCK, h: p.h * BLOCK }));
export const floorsOf = (r: LayoutRoom): Rect[] => footprintsOf(r).map((p) => ({ x: p.x + 1, y: p.y + 1, w: p.w - 2, h: p.h - 2 }));
// A floor tile in the middle of a room (a dog-leg's: where its arms meet).
export function roomCentre(r: LayoutRoom): Pt {
  const [f, g = f] = floorsOf(r);
  const x0 = Math.max(f.x, g.x), y0 = Math.max(f.y, g.y);
  const x1 = Math.min(f.x + f.w, g.x + g.w), y1 = Math.min(f.y + f.h, g.y + g.h);
  return { x: Math.floor((x0 + x1) / 2), y: Math.floor((y0 + y1) / 2) };
}
const overlaps = (a: Rect, b: Rect, margin = 0) =>
  a.x < b.x + b.w + margin && b.x < a.x + a.w + margin && a.y < b.y + b.h + margin && b.y < a.y + a.h + margin;

// --- Gen 2: tunnels ---------------------------------------------------------

// Every tunnel that could be dug: straight across the rock between two rooms'
// facing walls (any arm of a dog-leg), a tile in from their corners, through
// nothing else and a tile clear of the other tunnels. And twins, where one
// fits: a second between the same two rooms, well apart from the first.
export function tunnelOptions(layout: Layout, rng: Rng): Tunnel[] {
  const rooms = Object.values(layout.rooms);
  const prints = rooms.flatMap(footprintsOf);
  const out: Tunnel[] = [];
  const pairs: { first: Tunnel; spots: Rect[] }[] = [];
  const fits = (rect: Rect, up: boolean) => {
    // (Its end rows are doors, in its own two rooms' walls.)
    const inner = up ? { ...rect, y: rect.y + 1, h: rect.h - 2 } : { ...rect, x: rect.x + 1, w: rect.w - 2 };
    return prints.every((p) => !overlaps(inner, p)) && out.every((t) => !overlaps(rect, t.rect, 1));
  };
  const reach = MAX_REACH * BLOCK + 2; // tiles, its two door rows included
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id) continue;
    const spots: Rect[] = [];
    const [lo, hi] = a.y > b.y ? [a, b] : [b, a];
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const up = hi.y + hi.h <= lo.y;
    if (up) {
      // One above the other: from the bottom of a floor of the upper room to the top of one of the lower's.
      for (const fh of floorsOf(hi)) for (const fl of floorsOf(lo)) {
        const y = fh.y + fh.h, h = fl.y - y;
        if (h <= reach) for (let x = Math.max(fh.x, fl.x) + 1; x + TUNNEL_W <= Math.min(fh.x + fh.w, fl.x + fl.w) - 1; x++) spots.push({ x, y, w: TUNNEL_W, h });
      }
    } else if (l.x + l.w <= r.x) {
      // Side by side.
      for (const fl of floorsOf(l)) for (const fr of floorsOf(r)) {
        const x = fl.x + fl.w, w = fr.x - x;
        if (w <= reach) for (let y = Math.max(fl.y, fr.y) + 1; y + TUNNEL_W <= Math.min(fl.y + fl.h, fr.y + fr.h) - 1; y++) spots.push({ x, y, w, h: TUNNEL_W });
      }
    } else continue;
    const [from, to] = up ? [lo.id, hi.id] : [l.id, r.id];
    const mixed = shuffle(rng, spots);
    const first = mixed.find((s) => fits(s, up));
    if (!first) continue;
    out.push({ key: linkKey(from, to), a: from, b: to, up, rect: first });
    pairs.push({ first: out[out.length - 1], spots: mixed });
  }
  // The twins, once every pair has its first (so they don't crowd out other rooms' tunnels).
  for (const { first, spots } of pairs) {
    const apart = (s: Rect) => (first.up ? Math.abs(s.x - first.rect.x) : Math.abs(s.y - first.rect.y)) >= TUNNEL_W + TWIN_PILLAR;
    const twin = spots.find((s) => apart(s) && fits(s, first.up));
    if (twin) out.push({ ...first, key: `${first.key}${TWIN}`, rect: twin });
  }
  return out;
}
const TWIN = "#2"; // a twin's key: its first's, and this
const isTwin = (t: Tunnel) => t.key.endsWith(TWIN);

// --- Moving on --------------------------------------------------------------

// Where you are: the room, and the line (in blocks, from the top) a room has
// to start above to still be open (Infinity until you've gone up a tunnel).
export type Progress = { room: string; line: number };
export const startProgress = (layout: Layout): Progress => ({ room: layout.start, line: Infinity });
export const isOpen = (layout: Layout, p: Progress, room: string) => layout.rooms[room].y < p.line;

// The tunnels you can take from where you are, and where each leads.
export function waysOn(layout: Layout, p: Progress, tunnels = layout.tunnels): { tunnel: Tunnel; to: Progress }[] {
  if (p.room === layout.boss) return [];
  const out: { tunnel: Tunnel; to: Progress }[] = [];
  for (const t of tunnels) {
    if (t.up) {
      if (t.a !== p.room) continue;
      const above = layout.rooms[t.b];
      out.push({ tunnel: t, to: { room: t.b, line: above.y + above.h } });
    } else if (t.a === p.room || t.b === p.room) {
      const other = t.a === p.room ? t.b : t.a;
      if (isOpen(layout, p, other)) out.push({ tunnel: t, to: { room: other, line: p.line } });
    }
  }
  return out;
}

// Into a room by walking: the line moves up only if you came up a tunnel.
export function enter(layout: Layout, p: Progress, room: string): Progress {
  if (room === p.room) return p;
  const way = waysOn(layout, p).find((w) => w.to.room === room);
  return way ? way.to : p;
}

// Walking every way you could from the entrance (each spot being a room and
// a line): the rooms never reached, the ones you could get stuck in (with no
// way left to the boss), and the shortest route to the boss (rooms walked
// into, and its tunnels).
function explore(layout: Layout, tunnels: Tunnel[]) {
  const key = (p: Progress) => `${p.room}@${p.line}`;
  const first = startProgress(layout);
  const states = new Map<string, Progress>([[key(first), first]]);
  const came = new Map<string, { from: string; tunnel: Tunnel } | null>([[key(first), null]]);
  const next = new Map<string, string[]>();
  let end: string | null = null;
  const queue = [first];
  while (queue.length > 0) {
    const p = queue.shift()!;
    const k = key(p);
    if (p.room === layout.boss && end === null) end = k;
    const on = waysOn(layout, p, tunnels);
    next.set(k, on.map((w) => key(w.to)));
    for (const { tunnel, to } of on) {
      if (states.has(key(to))) continue;
      states.set(key(to), to);
      came.set(key(to), { from: k, tunnel });
      queue.push(to);
    }
  }
  const reached = new Set([...states.values()].map((p) => p.room));
  const unreached = Object.keys(layout.rooms).filter((id) => !reached.has(id));
  // From every spot you can get to, the boss can still be reached.
  const back = new Map<string, string[]>();
  for (const [k, on] of next) for (const q of on) back.set(q, [...(back.get(q) ?? []), k]);
  const good = new Set([...states.keys()].filter((k) => states.get(k)!.room === layout.boss));
  const stack = [...good];
  while (stack.length > 0) for (const k of back.get(stack.pop()!) ?? []) if (!good.has(k)) { good.add(k); stack.push(k); }
  const stuck = [...new Set([...states.keys()].filter((k) => !good.has(k)).map((k) => states.get(k)!.room))];
  const route: Tunnel[] = [];
  for (let k = end; k !== null && came.get(k);) { const c = came.get(k)!; route.unshift(c.tunnel); k = c.from; }
  return { unreached, stuck, route: end === null ? Infinity : route.length, routeTunnels: route };
}

const tunnelCount = (tunnels: Tunnel[], id: string) => tunnels.filter((t) => t.a === id || t.b === id).length;

// The rooms (bar the boss's) with fewer than CHOICES ways on: tunnels up out
// of them, and sideways tunnels that lead on: into the boss's room, a room
// with a tunnel up out of it, or on sideways again to one (never back the
// way you came).
export function fewChoices(layout: Layout, tunnels = layout.tunnels): string[] {
  const sideways = (id: string) => tunnels.filter((t) => !t.up && (t.a === id || t.b === id)).map((t) => (t.a === id ? t.b : t.a));
  const leadsOn = (id: string, been: Set<string>): boolean =>
    id === layout.boss || tunnels.some((t) => t.up && t.a === id)
    || sideways(id).some((n) => !been.has(n) && leadsOn(n, new Set([...been, id])));
  const ways = (id: string) => tunnels.filter((t) => t.up && t.a === id).length
    + sideways(id).filter((n) => leadsOn(n, new Set([id]))).length;
  return Object.keys(layout.rooms).filter((id) => id !== layout.boss && ways(id) < CHOICES);
}

// Everything that makes a layout unsound, in words (none = sound). See the top.
export function routeProblems(layout: Layout, minRoute: number, tunnels = layout.tunnels): string[] {
  const { unreached, stuck, route } = explore(layout, tunnels);
  const problems = unreached.map((id) => `${id} can't be reached`);
  if (stuck.length > 0) problems.push(`stuck in ${stuck.join(", ")}`);
  if (route < minRoute) problems.push(`the route to the boss is ${route} rooms`);
  const out = tunnelCount(tunnels, layout.start);
  if (out < START_WAYS[0] || out > START_WAYS[1]) problems.push(`${out} ways out of the entrance`);
  if (tunnelCount(tunnels, layout.boss) < BOSS_WAYS) problems.push(`${tunnelCount(tunnels, layout.boss)} ways into the boss`);
  const crowded = Object.keys(layout.rooms).filter((id) => tunnelCount(tunnels, id) > MAX_TUNNELS);
  if (crowded.length > 0) problems.push(`too many tunnels in ${crowded.join(", ")}`);
  const few = fewChoices(layout, tunnels);
  if (few.length > 0) problems.push(`only one way on from ${few.join(", ")}`);
  return problems;
}

// Dig them all (twins by chance, or where a room needs one for a second way
// on), then drop tunnels while it
// stays sound: off the shortest route till it's long enough, from rooms with
// too many, then any at DROP_CHANCE.
function pickTunnels(layout: Layout, options: Tunnel[], minRoute: number, rng: Rng): Tunnel[] | null {
  let chosen = options.filter((t) => !isTwin(t));
  // Twins: TWIN_CHANCE of them, and any a room needs for a second way on.
  for (const t of options.filter(isTwin)) {
    if (!chosen.some((c) => c.key === t.key.slice(0, -TWIN.length))) continue;
    const short = fewChoices(layout, chosen);
    if (rng() < TWIN_CHANCE || short.includes(t.a) || short.includes(t.b)) chosen.push(t);
  }
  // Sound but for things dropping tunnels can fix.
  const sound = (ts: Tunnel[]) => {
    const { unreached, stuck } = explore(layout, ts);
    return unreached.length === 0 && stuck.length === 0 && fewChoices(layout, ts).length === 0
      && tunnelCount(ts, layout.start) >= START_WAYS[0] && tunnelCount(ts, layout.boss) >= BOSS_WAYS;
  };
  if (!sound(chosen)) return null;
  const drop = (t: Tunnel) => {
    const without = chosen.filter((c) => c !== t);
    if (!sound(without)) return false;
    chosen = without;
    return true;
  };
  for (let { route, routeTunnels } = explore(layout, chosen); route < minRoute; { route, routeTunnels } = explore(layout, chosen)) {
    if (!shuffle(rng, routeTunnels).some(drop)) return null;
  }
  const cap = (id: string) => (id === layout.start ? START_WAYS[1] : MAX_TUNNELS);
  for (const t of shuffle(rng, chosen)) {
    const over = tunnelCount(chosen, t.a) > cap(t.a) || tunnelCount(chosen, t.b) > cap(t.b);
    if (over || rng() < DROP_CHANCE) drop(t);
  }
  return routeProblems(layout, minRoute, chosen).length === 0 ? chosen : null;
}

// --- Out to the rest of the game --------------------------------------------

// The layout as a scroll map: a node per room (at its middle, in tiles), and a
// link per tunnel. Just the shape: every room "easy" (campMap fills them).
export function layoutMap(layout: Layout): DungeonMap {
  const nodes: Record<string, MapNode> = {};
  for (const r of Object.values(layout.rooms)) {
    const kind = r.id === layout.start ? "entrance" : r.id === layout.boss ? "boss" : "easy";
    nodes[r.id] = { id: r.id, ...roomCentre(r), kind, links: [] };
  }
  for (const t of layout.tunnels) { nodes[t.a].links.push(t.b); nodes[t.b].links.push(t.a); }
  return { h: layout.h * BLOCK, start: layout.start, boss: layout.boss, nodes };
}

// Gen 3, what's in each room: the Encampment's mix as it is in the live game
// (map.ts: fillCamp), on the walkable layout. Fewer rooms are marked on the
// scroll from the start than on the old one: SCROLL_MARKS in all (the user,
// 2026-11-05: 3–4 at most), the marked stashes counted in, dens for the rest.
// firstRun: the entrance holds treasure.
export const SCROLL_MARKS = [3, 4];
export function campMap(layout: Layout, firstRun: boolean, rng: Rng = Math.random): DungeonMap {
  const map = fillCamp(layoutMap(layout), firstRun, rng);
  const stashes = Object.values(map.nodes).filter((n) => n.known).length;
  markRooms(map, 0, rng, Math.max(0, between(rng, SCROLL_MARKS) - stashes));
  return map;
}

// The scroll (the user, 2026-11-05): a look at where the rooms are, to work
// out a way up. A mark per room, where its middle is: its icon if you know
// what's there, else "?". Of the rooms and tunnels themselves, only what your
// torch has lit (drawn by the lab, like a treasure map, with your trail and
// the cut-offs behind you, cutOffY); never the rest.
// You know the entrance, the top, the rooms marked from the start and the
// ones you've been in; the hidden ones (the chest, unmarked stashes) only once
// you've been in. You can look at it SCROLL_LOOKS times a run.
export const SCROLL_LOOKS = 2;
// Where a cut-off is on the scroll, in tiles down: the bottom of the room you came up into.
export const cutOffY = (p: Progress) => p.line * BLOCK;
export type ScrollMark = { id: string; x: number; y: number; kind: RoomKind | null; here: boolean }; // x, y: 0–1 across and down
export function scrollMarks(map: DungeonMap, layout: Layout, been: Iterable<string>, here: string | null): ScrollMark[] {
  const visited = new Set(been);
  const w = layout.w * BLOCK, h = layout.h * BLOCK;
  return Object.values(map.nodes).map((n) => {
    const knows = visited.has(n.id) || (!n.hidden && (n.known || n.id === map.start || n.id === map.boss));
    return { id: n.id, x: n.x / w, y: n.y / h, kind: knows ? n.kind : null, here: n.id === here };
  });
}

// The layout as tiles to walk on (floorplan.ts's Floorplan, so walk.ts and
// checkFloorplan work on it). A tunnel's end rows are doors in its rooms' walls.
export function layoutFloorplan(layout: Layout): Floorplan {
  const w = layout.w * BLOCK, h = layout.h * BLOCK;
  const tiles = new Uint8Array(w * h);
  const rooms: Record<string, Rect[]> = {};
  for (const r of Object.values(layout.rooms)) {
    for (const f of (rooms[r.id] = floorsOf(r))) for (let y = f.y; y < f.y + f.h; y++) tiles.fill(FLOOR, y * w + f.x, y * w + f.x + f.w);
  }
  const doors: Door[] = [];
  const tunnels: Record<string, Pt[]> = {};
  for (const t of layout.tunnels) {
    const { x, y, w: tw, h: th } = t.rect;
    const pts: Pt[] = [];
    for (let ty = y; ty < y + th; ty++) for (let tx = x; tx < x + tw; tx++) {
      // The first and last row (or column) across the tunnel are doors.
      const end = t.up ? (ty === y ? t.b : ty === y + th - 1 ? t.a : null) : (tx === x ? t.a : tx === x + tw - 1 ? t.b : null);
      tiles[ty * w + tx] = end ? DOOR : TUNNEL;
      if (end) doors.push({ x: tx, y: ty, room: end, link: t.key });
      pts.push({ x: tx, y: ty });
    }
    tunnels[t.key] = pts;
  }
  return { w, h, tiles, rooms, doors, tunnels };
}

// A sound layout for a dungeon (spec.rooms rooms besides the entrance and
// the boss, the shortest route spec.minRoute rooms or more). Rolls again
// until one comes out sound, its tiles too (checkFloorplan).
export function rollLayout(spec: Pick<MapSpec, "rooms" | "minRoute">, rng: Rng = Math.random): Layout {
  for (let i = 0; i < LAYOUT_REROLLS; i++) {
    const rooms = rollRooms(spec.rooms, rng);
    const tunnels = pickTunnels(rooms, tunnelOptions(rooms, rng), spec.minRoute, rng);
    if (!tunnels) continue;
    const layout = { ...rooms, tunnels };
    if (checkFloorplan(layoutFloorplan(layout), layoutMap(layout)).length === 0) return layout;
  }
  throw new Error("layout: none came out sound");
}

// Walking it (walk.ts's canStep): only on tiles still open from where you
// are, and never down into a tunnel that goes up.
export function stepRule(layout: Layout, fp: Floorplan, p: Progress): (from: Pt, to: Pt) => boolean {
  const closed = new Uint8Array(fp.w * fp.h);
  const shut = (r: Rect) => { for (let y = r.y; y < r.y + r.h; y++) closed.fill(1, y * fp.w + r.x, y * fp.w + r.x + r.w); };
  for (const id of Object.keys(layout.rooms)) if (!isOpen(layout, p, id)) fp.rooms[id].forEach(shut);
  for (const t of layout.tunnels) if (!isOpen(layout, p, t.a) || !isOpen(layout, p, t.b)) shut(t.rect);
  // An up tunnel's top door, by tile: entered only from inside the tunnel.
  const topDoor = new Map<number, Tunnel>();
  for (const t of layout.tunnels) if (t.up) for (let x = t.rect.x; x < t.rect.x + t.rect.w; x++) topDoor.set(t.rect.y * fp.w + x, t);
  const inside = (t: Tunnel, q: Pt) => q.x >= t.rect.x && q.x < t.rect.x + t.rect.w && q.y >= t.rect.y && q.y < t.rect.y + t.rect.h;
  return (from, to) => {
    if (closed[to.y * fp.w + to.x]) return false;
    const t = topDoor.get(to.y * fp.w + to.x);
    return !t || inside(t, from);
  };
}
