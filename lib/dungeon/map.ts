// lib/dungeon/map.ts
// The dungeon as a labyrinth: rooms scattered across the map, joined by
// corridors that wind, cross, loop back and dead-end. You start at the
// bottom; the boss's lair is at the top.
//
// - About ROOM_COUNT rooms. The rooms are joined into one network (a
//   spanning tree, so there are dead ends), then a few extra corridors
//   make loops, and a few long corridors cut across the map. A long one can
//   look like a shortcut and turn out to be the long way round.
// - The lair has one or two ways in. The shortest route from the entrance
//   to it is MIN_ROUTE–MAX_ROUTE rooms.
// - Fog is regional: you see SIGHT_RADIUS around where you stand. Rooms
//   you've seen stay on your map; corridors leaving your circle fade out, so
//   you know which way they head but not where they end.
// - MYSTERY_CHANCE of rooms are mysteries: "?" until you walk in, rolled
//   from MYSTERY_MIX (mostly mini bosses; librarians only turn up there).

import { MYSTERY_MIX, ROOM_MIX, rollRoomKind, type RoomKind } from "./run";

export const MAP_W = 100;
export const MAP_H = 140;
export const ROOM_COUNT = 20;        // not counting the entrance and the lair
export const MIN_SPACING = 15;       // how close two rooms can be
export const SIGHT_RADIUS = 34;      // how far you can see from where you stand
export const LOOP_CHANCE = 0.35;     // a room gets an extra corridor to a near neighbour
export const LONG_CORRIDORS = 2;     // corridors that cut across the map
export const MAX_LINKS = 4;          // corridors out of one room (extras respect this)
export const MIN_ROUTE = 5;          // shortest route to the lair, in rooms walked into
export const MAX_ROUTE = 9;
export const MYSTERY_CHANCE = 0.3;   // a room whose kind you can't see until you walk in

export type MapNode = {
  id: string;
  x: number;
  y: number;
  kind: RoomKind;
  links: string[];   // corridors to these rooms
  mystery?: boolean; // shown as "?" until you walk in
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

// Rooms walked into on the shortest route from the entrance to `to`.
export function routeLength(map: DungeonMap, to = map.boss): number {
  const seen = new Map<string, number>([[map.start, 0]]);
  const queue = [map.start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const n of map.nodes[id].links) {
      if (seen.has(n)) continue;
      seen.set(n, seen.get(id)! + 1);
      queue.push(n);
    }
  }
  return seen.get(to) ?? Infinity;
}

// One attempt at a layout (may fail the route-length check).
function layout(rng: Rng): DungeonMap {
  const nodes: Record<string, MapNode> = {};
  const add = (id: string, x: number, y: number) => { nodes[id] = { id, x, y, kind: "easy", links: [] }; };
  add("start", MAP_W / 2, MAP_H - 8);
  add("boss", MAP_W / 2, 8);

  // Scatter the rooms, keeping them apart.
  const rooms: string[] = [];
  for (let tries = 0; rooms.length < ROOM_COUNT && tries < 4000; tries++) {
    const p = { x: 8 + rng() * (MAP_W - 16), y: 24 + rng() * (MAP_H - 46) };
    if (Object.values(nodes).some((n) => distance(n, p) < MIN_SPACING)) continue;
    const id = `r${rooms.length}`;
    add(id, p.x, p.y);
    rooms.push(id);
  }

  // Join the entrance and the rooms into one network (shortest corridors first).
  const inTree = new Set(["start"]);
  const rest = new Set(rooms);
  while (rest.size > 0) {
    let best: [string, string] | null = null, bestD = Infinity;
    for (const a of inTree) for (const b of rest) {
      const d = distance(nodes[a], nodes[b]);
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    link(nodes, best![0], best![1]);
    inTree.add(best![1]);
    rest.delete(best![1]);
  }

  const free = (id: string) => nodes[id].links.length < MAX_LINKS;
  // Loops: an extra corridor to a near neighbour.
  for (const a of rooms) {
    if (rng() >= LOOP_CHANCE || !free(a)) continue;
    const near = rooms
      .filter((b) => b !== a && free(b) && !nodes[a].links.includes(b) && distance(nodes[a], nodes[b]) < 34)
      .sort((p, q) => distance(nodes[a], nodes[p]) - distance(nodes[a], nodes[q]));
    if (near[0]) link(nodes, a, near[0]);
  }
  // A few long corridors across the map.
  for (let i = 0, tries = 0; i < LONG_CORRIDORS && tries < 200; tries++) {
    const a = rooms[Math.floor(rng() * rooms.length)], b = rooms[Math.floor(rng() * rooms.length)];
    const d = distance(nodes[a], nodes[b]);
    if (a === b || d < 38 || d > 70 || !free(a) || !free(b) || nodes[a].links.includes(b)) continue;
    link(nodes, a, b);
    i++;
  }
  // The lair: one or two ways in, from the rooms nearest the top.
  const top = [...rooms].sort((p, q) => distance(nodes.boss, nodes[p]) - distance(nodes.boss, nodes[q]));
  link(nodes, "boss", top[0]);
  if (rng() < 0.5 && top[1]) link(nodes, "boss", top[1]);

  return { start: "start", boss: "boss", nodes };
}

export function rollMap(firstRun: boolean, rng: Rng = Math.random): DungeonMap {
  let map = layout(rng);
  for (let i = 0; i < 300; i++) {
    const r = routeLength(map);
    if (r >= MIN_ROUTE && r <= MAX_ROUTE) break;
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
  return map;
}

export const neighbours = (map: DungeonMap, id: string): MapNode[] => map.nodes[id].links.map((l) => map.nodes[l]);

// Rooms in sight from a spot.
export function inSight(map: DungeonMap, at: string): Set<string> {
  const here = map.nodes[at];
  return new Set(Object.values(map.nodes).filter((n) => distance(n, here) <= SIGHT_RADIUS).map((n) => n.id));
}

// Everything you've seen so far: what was in sight from every room you've
// stood in. The lair is always marked.
export function seenRooms(map: DungeonMap, path: string[]): Set<string> {
  const seen = new Set<string>([map.boss]);
  for (const at of new Set(path)) for (const id of inSight(map, at)) seen.add(id);
  return seen;
}

// Which way a corridor heads, for rooms you can't see the end of.
export function heading(from: Pt, to: Pt): string {
  const dx = to.x - from.x, dy = from.y - to.y; // up the map is north
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];
  return dirs[Math.round(((ang + 360) % 360) / 45) % 8];
}
