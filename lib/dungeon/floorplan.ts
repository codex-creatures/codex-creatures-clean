// lib/dungeon/floorplan.ts
// The walkable Labyrinth as tiles (made by layout.ts's layoutFloorplan, walked
// by walk.ts): rock, room floors, tunnels and their doors, and the check that
// the tunnels join exactly the rooms the scroll links, no more and no fewer.
// A room's floor is one rectangle, or two overlapping ones (an L-shaped room).

import { linkKey, type DungeonMap } from "./map";

// What each tile is. Rock next to a floor, tunnel or door is drawn as wall.
export const ROCK = 0, FLOOR = 1, TUNNEL = 2, DOOR = 3;

export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number }; // a room's floor, top-left tile
export type Door = Pt & { room: string; link: string };
export type Floorplan = {
  w: number;
  h: number;
  tiles: Uint8Array;               // row by row, w × h
  rooms: Record<string, Rect[]>;   // each room's floor, in one or two rectangles
  doors: Door[];
  tunnels: Record<string, Pt[]>;   // by the tunnel's key: the tiles between its two rooms, doors included
};

// Up, right, down, left.
const DIRS: Pt[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

// Everything wrong with a floorplan, in words (none = it's sound): every room
// is there, rooms never touch, and the tunnels join exactly the scroll's
// linked rooms (two tunnels where it links two rooms twice), entered only by
// their doors.
export function checkFloorplan(fp: Floorplan, map: DungeonMap): string[] {
  const problems: string[] = [];
  const { w, h, tiles } = fp;
  for (const id of Object.keys(map.nodes)) if (!fp.rooms[id]) problems.push(`no room for ${id}`);
  // Label every walkable tile: a room's floor by the room, tunnels and doors by
  // which tunnel they're part of (joined up, side by side, not diagonally).
  const label = new Int32Array(w * h).fill(-1);
  const ids = Object.keys(fp.rooms);
  ids.forEach((id, i) => {
    for (const r of fp.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
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
  // Tunnels joining each pair of rooms, against the scroll's links between them.
  const joined = new Map<string, number>(), linked = new Map<string, number>();
  for (let c = ids.length; c < next; c++) {
    const rooms = [...(opens.get(c) ?? [])];
    if (rooms.length !== 2) { problems.push(`a tunnel opens into ${rooms.length} rooms (${rooms.join(", ")})`); continue; }
    const k = linkKey(rooms[0], rooms[1]);
    joined.set(k, (joined.get(k) ?? 0) + 1);
  }
  for (const a of Object.values(map.nodes)) for (const b of a.links) if (a.id < b) linked.set(linkKey(a.id, b), (linked.get(linkKey(a.id, b)) ?? 0) + 1);
  for (const k of new Set([...joined.keys(), ...linked.keys()])) {
    const j = joined.get(k) ?? 0, l = linked.get(k) ?? 0;
    if (l === 0) problems.push(`a tunnel joins ${k}, which the scroll doesn't link`);
    else if (j === 0) problems.push(`nothing joins ${k}`);
    else if (j !== l) problems.push(`${j} tunnels join ${k}, the scroll links it ${l} times`);
  }
  return [...new Set(problems)];
}
