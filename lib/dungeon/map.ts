// lib/dungeon/map.ts
// The dungeon as a labyrinth: rooms scattered across the map, joined by
// corridors that branch and rejoin. You start at the bottom; the boss's
// lair is at the top.
//
// - About ROOM_COUNT rooms, kept MIN_SPACING apart. Corridors always lead
//   onward — further north — so you can't go back, but there's never a dead
//   end: every room has at least one way on, and every way on reaches the
//   lair eventually. The choice is which branch: some are short and
//   straight, some wander past more rooms (more loot, more danger).
// - Each room has a corridor on to one of the nearest rooms ahead, and
//   BRANCH_CHANCE of a second; the entrance has two or three. Every room can
//   be reached from below. A few long corridors skip ahead.
// - The lair always has LAIR_DOORS ways in (and the entrance 2–3 ways out),
//   so there is always a choice at both ends. The shortest route from the entrance
//   to it is MIN_ROUTE–MAX_ROUTE rooms.
// - You carry a map scroll: every room and corridor is on it, but what's in
//   a room is "?" until you know. KNOWN_AT_START rooms are marked from the
//   off, so you can half-plan a route. Rooms within SIGHT_RADIUS of where
//   you've stood are revealed — except mysteries.
// - MYSTERY_CHANCE of rooms are mysteries: they stay "?" until you walk in,
//   even up close, and are rolled from MYSTERY_MIX (mostly mini bosses;
//   librarians only turn up there).

import { MYSTERY_MIX, ROOM_MIX, rollRoomKind, type RoomKind } from "./run";

export const MAP_W = 100;
export const MAP_H = 170;
export const ROOM_COUNT = 18;        // not counting the entrance and the lair
export const MIN_SPACING = 18;       // how close two rooms can be
export const SIGHT_RADIUS = 30;      // how far you can see from where you stand
export const BRANCH_CHANCE = 0.45;   // a room gets a second way on
export const LONG_CORRIDORS = 2;     // corridors that skip a long way ahead
export const MAX_STARTS = 3;         // ways out of the entrance (at least 2)
export const LAIR_DOORS = 2;         // always two ways into the lair
export const MIN_ROUTE = 5;          // shortest route to the lair, in rooms walked into
export const MAX_ROUTE = 9;
export const MYSTERY_CHANCE = 0.3;   // a room whose kind you can't see until you walk in
export const KNOWN_AT_START = 5;     // rooms already marked on your scroll

export type MapNode = {
  id: string;
  x: number;
  y: number;
  kind: RoomKind;
  links: string[];   // corridors to these rooms
  mystery?: boolean; // stays "?" until you walk in
  known?: boolean;   // marked on your scroll from the start
};

export type DungeonMap = {
  start: string;                  // the entrance (bottom)
  boss: string;                   // the lair (top)
  nodes: Record<string, MapNode>;
};

type Rng = () => number;
type Pt = { x: number; y: number };

export const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function link(nodes: Record<string, MapNode>, a: string, b: string) {
  if (a === b || nodes[a].links.includes(b)) return;
  nodes[a].links.push(b);
  nodes[b].links.push(a);
}

// Rooms walked into on the shortest route from the entrance to `to`
// (walking onward only).
export function routeLength(map: DungeonMap, to = map.boss): number {
  const seen = new Map<string, number>([[map.start, 0]]);
  const queue = [map.start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const n of map.nodes[id].links.filter((l) => isAhead(map.nodes[id], map.nodes[l]))) {
      if (seen.has(n)) continue;
      seen.set(n, seen.get(id)! + 1);
      queue.push(n);
    }
  }
  return seen.get(to) ?? Infinity;
}

// Is `b` further on than `a`? (Further north; the lair is furthest.)
export const isAhead = (a: Pt, b: Pt) => b.y < a.y;

// One attempt at a layout (may fail the route-length check).
function layout(rng: Rng): DungeonMap {
  const nodes: Record<string, MapNode> = {};
  const add = (id: string, x: number, y: number) => { nodes[id] = { id, x, y, kind: "easy", links: [] }; };
  add("start", MAP_W / 2, MAP_H - 8);
  add("boss", MAP_W / 2, 8);

  // Scatter the rooms, keeping them apart.
  const rooms: string[] = [];
  for (let tries = 0; rooms.length < ROOM_COUNT && tries < 6000; tries++) {
    const p = { x: 8 + rng() * (MAP_W - 16), y: 26 + rng() * (MAP_H - 50) };
    if (Object.values(nodes).some((n) => distance(n, p) < MIN_SPACING)) continue;
    const id = `r${rooms.length}`;
    add(id, p.x, p.y);
    rooms.push(id);
  }

  // The two rooms nearest the lair are the only ways in.
  const top = [...rooms].sort((p, q) => nodes[p].y - nodes[q].y);
  const lairDoors = new Set(top.slice(0, LAIR_DOORS));
  const nearest = (from: string, among: string[]) =>
    among.filter((id) => !nodes[from].links.includes(id)).sort((p, q) => distance(nodes[from], nodes[p]) - distance(nodes[from], nodes[q]));
  const aheadOf = (id: string) => rooms.filter((r) => isAhead(nodes[id], nodes[r]));
  const behind = (id: string) => ["start", ...rooms].filter((r) => isAhead(nodes[r], nodes[id]));
  const waysOnCount = (id: string) => nodes[id].links.filter((l) => isAhead(nodes[id], nodes[l])).length;

  // Ways on: every room leads to one of the nearest rooms ahead (sometimes two).
  for (const id of ["start", ...rooms]) {
    if (lairDoors.has(id)) { link(nodes, id, "boss"); continue; }
    const want = id === "start" ? 2 + (rng() < 0.5 ? 1 : 0) : rng() < BRANCH_CHANCE ? 2 : 1;
    const options = nearest(id, aheadOf(id)).slice(0, want + 1);
    // Mostly the nearest, now and then the next one along.
    while (options.length > 0 && waysOnCount(id) < want) {
      const pick = options.length > 1 && rng() < 0.3 ? 1 : 0;
      link(nodes, id, options.splice(pick, 1)[0]);
    }
    if (waysOnCount(id) === 0) link(nodes, id, "boss"); // nothing ahead: straight to the lair
  }
  // Ways in: every room can be reached from somewhere behind it.
  for (const id of rooms) {
    if (nodes[id].links.some((l) => isAhead(nodes[l], nodes[id]))) continue;
    const from = behind(id).filter((r) => r !== "start" || waysOnCount("start") < MAX_STARTS); // keep the entrance to 2–3 ways out
    link(nodes, id, nearest(id, from.length > 0 ? from : ["start"])[0]);
  }
  // A few long corridors that skip ahead.
  for (let i = 0, tries = 0; i < LONG_CORRIDORS && tries < 200; tries++) {
    const a = rooms[Math.floor(rng() * rooms.length)], b = rooms[Math.floor(rng() * rooms.length)];
    const d = distance(nodes[a], nodes[b]);
    if (a === b || d < 40 || d > 70 || nodes[a].links.includes(b) || lairDoors.has(a) || lairDoors.has(b)) continue;
    link(nodes, a, b);
    i++;
  }

  return { start: "start", boss: "boss", nodes };
}

export function rollMap(firstRun: boolean, rng: Rng = Math.random): DungeonMap {
  let map = layout(rng);
  for (let i = 0; i < 300; i++) {
    const r = routeLength(map);
    if (r >= MIN_ROUTE && r <= MAX_ROUTE && waysOn(map, map.start).length <= MAX_STARTS) break;
    map = layout(rng);
  }
  for (const n of Object.values(map.nodes)) {
    if (n.id === map.boss) n.kind = "boss";
    else if (n.id === map.start) n.kind = firstRun ? "treasure" : "entrance";
    else {
      const mystery = rng() < MYSTERY_CHANCE;
      n.kind = rollRoomKind(rng, [], mystery ? MYSTERY_MIX : ROOM_MIX);
      if (mystery) n.mystery = true;
    }
  }
  // A few rooms are marked on the scroll from the start (never mysteries).
  const plain = Object.values(map.nodes).filter((n) => n.id !== map.start && n.id !== map.boss && !n.mystery);
  for (let i = 0; i < KNOWN_AT_START && plain.length > 0; i++) plain.splice(Math.floor(rng() * plain.length), 1)[0].known = true;
  return map;
}

export const neighbours = (map: DungeonMap, id: string): MapNode[] => map.nodes[id].links.map((l) => map.nodes[l]);

// The corridors on from a room (the ones leading further in).
export const waysOn = (map: DungeonMap, id: string): MapNode[] => neighbours(map, id).filter((n) => isAhead(map.nodes[id], n));

// Rooms in sight from a spot.
export function inSight(map: DungeonMap, at: string): Set<string> {
  const here = map.nodes[at];
  return new Set(Object.values(map.nodes).filter((n) => distance(n, here) <= SIGHT_RADIUS).map((n) => n.id));
}

// The rooms whose contents you know: the entrance and the lair, the ones
// marked from the start, the ones you've walked into, and anything that was
// in sight from where you've stood — but never a mystery you haven't entered.
export function knownRooms(map: DungeonMap, path: string[]): Set<string> {
  const visited = new Set(path);
  const known = new Set<string>([map.boss, map.start, ...visited]);
  for (const n of Object.values(map.nodes)) if (n.known) known.add(n.id);
  for (const at of visited) for (const id of inSight(map, at)) if (!map.nodes[id].mystery) known.add(id);
  return known;
}

// Which way a corridor heads, for rooms you can't see the end of.
export function heading(from: Pt, to: Pt): string {
  const dx = to.x - from.x, dy = from.y - to.y; // up the map is north
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
  return dirs[Math.round(((ang + 360) % 360) / 45) % 8];
}
