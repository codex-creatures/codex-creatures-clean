// lib/dungeon/people.ts
// People who wander (decision 39, the user, 2026-11-10; world version 9; the
// Cyclops first): in a walkable dungeon, 2 card witches, a merchant and a
// librarian walk about instead of having rooms of their own.
//
// - Each is a room of the run of their own ("person~<who>", like a big room's
//   second den: walkRun.ts), holding their game or their cart, with a mark on
//   the run's map (no tunnels, never on the scroll). Talking to one walks you
//   "into" them, so the Labyrinth screen's witch, merchant and librarian
//   windows work on them unchanged; walking into a room puts them back.
// - Each starts in a room with no creatures in it (any but the boss's lair;
//   the librarian in the large library if there is one), then wanders the
//   whole dungeon: off to one of the rooms near where they are (WANDER_NEAR),
//   a pause there (WANDER_PAUSE), then on. They keep out of any room with
//   creatures in it, and stop when they come up to you (walkSim.ts NPC_STILL).
// - Cut off (in a room you can no longer reach, or a tunnel that's fallen in
//   round them), they stop for good, and a locator can't find them ("It
//   appears that they are no longer here…"), so it isn't used up.
// - Each gives off a candle's light (PERSON_LIGHT); a witch's goes out once
//   you've played her, won or lost.
// - Locators (materials.ts LOCATORS): LOCATOR_FIND of chests and stashes hold
//   one, any of the three; the merchant sells one, at LOCATOR_PRICE. Used,
//   your scroll shows that person's icon where they are now, every time it's
//   opened, for the rest of the run (the crystal ball: the closest witch you
//   can still reach and haven't played). A library's lectern finds the librarian the same way.
// - Half the campfires have a stash beside them (CAMPFIRE_STASH).

import { makeRoom, hasFight, MERCHANT_SLOTS, type DungeonId, type Room, type RoomKind, type SackItem } from "./run";
import { isOpen, roomCentre, type Layout, type Progress } from "./layout";
import { findPath, type CanStep } from "./walk";
import { spawnOf, FOE_SPEED } from "./foes";
import { SCONCE_RADIUS } from "./torch";
import { ROCK, type Floorplan, type Pt } from "./floorplan";
import type { DungeonMap } from "./map";
import { toolDrop, LOCATORS, type LocatorKey } from "../items/materials";

type Rng = () => number;

export type PersonKind = "witch" | "merchant" | "librarian";
// Who wanders, in every walkable dungeon that has them.
export const PEOPLE: PersonKind[] = ["witch", "witch", "merchant", "librarian"];
export const PERSON = "person~";
export const isPerson = (id: string) => id.startsWith(PERSON);

// Where someone is, as saved in the run (WalkRun.people). room: the last room
// they were in (they may be in a tunnel); stopped: cut off, for good.
export type Person = { id: string; kind: PersonKind; at: Pt; room: string; stopped?: true };
// …and as they walk (walkSim.ts), a frame at a time.
export type Wanderer = Person & { x: number; y: number; facing: number; path: Pt[]; wait: number };

export const WANDER_SPEED = 0.6;                         // of a foe's pace (as the card witch walked her room)
export const WANDER_PAUSE: [number, number] = [4, 10];   // seconds they stay in a room they've walked to
export const WANDER_NEAR = 6;                            // they set off to one of this many rooms nearest them
export const PERSON_LIGHT = SCONCE_RADIUS;               // 🧪 tiles: a wall torch's reach (a candle's was too small round the whole picture, the user, 2026-11-11)
export const LOCATOR_FIND = 0.05;                        // of chests and stashes hold a locator
export const LOCATOR_PRICE = 200;                        // the merchant's (he has one)
export const CAMPFIRE_STASH = 0.5;                       // of campfires have a stash beside them

// Which person each locator finds.
export const LOCATES: Record<LocatorKey, PersonKind> = { merchant_map: "merchant", crystal_ball: "witch", librarian_locator: "librarian" };

const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);
const inRect = (r: { x: number; y: number; w: number; h: number }, p: Pt) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// A room with creatures in it still to beat (its second den's too): people keep out.
export function hostile(id: string, room: (id: string) => Room | undefined): boolean {
  return [id, spawnOf(id)].some((k) => { const r = room(k); return !!r && hasFight(r) && !r.done; });
}

// A floor tile in a room, off its middle (its feature stands there) and off its top row (the wall's face).
function floorTile(plan: Floorplan, id: string, rng: Rng, mid: Pt): Pt {
  const rects = plan.rooms[id];
  for (let tries = 0; tries < 20; tries++) {
    const r = rects[Math.floor(rng() * rects.length)];
    const p = { x: r.x + Math.floor(rng() * r.w), y: r.y + 1 + Math.floor(rng() * Math.max(1, r.h - 1)) };
    if (plan.tiles[p.y * plan.w + p.x] !== ROCK && Math.hypot(p.x - mid.x, p.y - mid.y) >= 2) return p;
  }
  return { x: Math.round(mid.x), y: Math.round(mid.y) };
}

// The people of a new run: each one's room (their game or cart, rolled as
// the room it used to be), their mark on the run's map, and where they start.
// rooms: the run's rooms as rolled (to keep out of the ones with creatures).
export function rollPeople(map: DungeonMap, layout: Layout, plan: Floorplan, rooms: Record<string, Room>, rng: Rng, dungeon: DungeonId, bindle: boolean): { rooms: Record<string, Room>; people: Person[] } {
  const ids = Object.keys(layout.rooms).sort();
  const calm = ids.filter((id) => id !== layout.boss && !hostile(id, (k) => rooms[k]));
  const library = ids.find((id) => map.nodes[id]?.kind === "library");
  const out: Record<string, Room> = {}, people: Person[] = [];
  const seen: Record<string, number> = {};
  for (const kind of PEOPLE) {
    const n = seen[kind] = (seen[kind] ?? -1) + 1;
    const id = `${PERSON}${kind}${kind === "witch" ? n : ""}`;
    const start = kind === "librarian" && library ? library : calm[Math.floor(rng() * calm.length)] ?? layout.start;
    const room = makeRoom(kind, rng, Infinity, dungeon, bindle);
    // (The merchant's locator takes his cart's last slot if it's full.)
    out[id] = kind === "merchant" ? { ...room, wares: [...(room.wares ?? []).slice(0, MERCHANT_SLOTS - 1), locatorWare(rng)] } : room;
    const mid = roomCentre(layout.rooms[start]);
    map.nodes[id] = { id, ...mid, kind, links: [], hidden: true };
    people.push({ id, kind, at: floorTile(plan, start, rng, mid), room: start });
  }
  return { rooms: out, people };
}

// The merchant's locator: one of the three.
const locatorWare = (rng: Rng) => {
  const tool = LOCATORS[Math.floor(rng() * LOCATORS.length)];
  return { key: tool, tool, price: LOCATOR_PRICE };
};
// What a chest or stash adds: now and then a locator.
export const locatorFinds = (rng: Rng = Math.random): SackItem[] =>
  rng() < LOCATOR_FIND ? [{ gear: toolDrop(LOCATORS[Math.floor(rng() * LOCATORS.length)]) }] : [];

// Which room each tile is in (-1: none, a tunnel or rock), worked out once a floorplan.
const ROOM_INDEX = new WeakMap<Floorplan, { at: Int16Array; ids: string[] }>();
export function roomIndex(plan: Floorplan) {
  let ix = ROOM_INDEX.get(plan);
  if (!ix) {
    const ids = Object.keys(plan.rooms), at = new Int16Array(plan.w * plan.h).fill(-1);
    ids.forEach((id, i) => { for (const r of plan.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) at.fill(i, y * plan.w + r.x, y * plan.w + r.x + r.w); });
    ix = { at, ids };
    ROOM_INDEX.set(plan, ix);
  }
  return ix;
}
const roomOfTile = (plan: Floorplan, p: Pt): string | null => {
  const { at, ids } = roomIndex(plan), i = at[Math.round(p.y) * plan.w + Math.round(p.x)];
  return i >= 0 ? ids[i] : null;
};

// Cut off: their room's behind you now, or the rock's come down round them.
export const cutOff = (layout: Layout, live: Floorplan, p: Progress, w: Pick<Person, "room" | "at" | "stopped">) =>
  !!w.stopped || !isOpen(layout, p, w.room) || live.tiles[Math.round(w.at.y) * live.w + Math.round(w.at.x)] === ROCK;

// The sim's wanderer, from where they were saved; and back.
export const wandererOf = (p: Person): Wanderer => ({ ...p, x: p.at.x, y: p.at.y, facing: Math.PI / 2, path: [], wait: 1 });
export const personOf = (w: Wanderer): Person => ({ id: w.id, kind: w.kind, at: { x: Math.round(w.x), y: Math.round(w.y) }, room: w.room, ...(w.stopped ? { stopped: true as const } : {}) });

// Someone `seconds` later: walking on to where they were going, or (there, a
// pause over) setting off to one of the rooms nearest them with no creatures
// in it, through rooms with none; or stopped for good, cut off.
// plan: the whole floorplan (rooms); live: as it stands (closed tunnels are rock).
export function stepWanderer(plan: Floorplan, live: Floorplan, layout: Layout, p: Progress, w: Wanderer, seconds: number, room: (id: string) => Room | undefined, rng: Rng = Math.random): Wanderer {
  if (w.stopped) return w;
  const here = { x: Math.round(w.x), y: Math.round(w.y) };
  if (cutOff(layout, live, p, { ...w, at: here })) return { ...w, path: [], stopped: true };
  if (w.path.length === 0) {
    if (w.wait > 0) return { ...w, wait: w.wait - seconds };
    const can: CanStep = (_, q) => { const r = roomOfTile(plan, q); return !r || (isOpen(layout, p, r) && !hostile(r, room)); };
    const centre = (id: string) => roomCentre(layout.rooms[id]);
    const near = Object.keys(layout.rooms).filter((id) => id !== w.room && isOpen(layout, p, id) && !hostile(id, room))
      .sort((a, b) => Math.hypot(centre(a).x - w.x, centre(a).y - w.y) - Math.hypot(centre(b).x - w.x, centre(b).y - w.y))
      .slice(0, WANDER_NEAR);
    for (let tries = 0; tries < 3 && near.length > 0; tries++) {
      const to = near.splice(Math.floor(rng() * near.length), 1)[0];
      const path = findPath(live, here, floorTile(plan, to, rng, centre(to)), can);
      if (path && path.length > 0) return { ...w, path, wait: between(rng, WANDER_PAUSE) };
    }
    return { ...w, wait: between(rng, WANDER_PAUSE) };
  }
  // (A room on the way that's grown creatures since, an ambush sprung: they wait it out.)
  const next = w.path[0], nextRoom = roomOfTile(plan, next);
  if (nextRoom && nextRoom !== w.room && hostile(nextRoom, room)) return { ...w, path: [], wait: between(rng, WANDER_PAUSE) };
  let { x, y } = w;
  let left = FOE_SPEED * WANDER_SPEED * seconds, facing = w.facing, i = 0;
  while (i < w.path.length && left > 0) {
    const q = w.path[i], d = Math.hypot(q.x - x, q.y - y);
    if (d > 0) facing = Math.atan2(q.y - y, q.x - x);
    if (d <= left) { x = q.x; y = q.y; left -= d; i++; continue; }
    x += ((q.x - x) / d) * left;
    y += ((q.y - y) / d) * left;
    left = 0;
  }
  const inRoom = roomOfTile(plan, { x, y });
  return { ...w, x, y, facing, path: w.path.slice(i), at: { x: Math.round(x), y: Math.round(y) }, ...(inRoom ? { room: inRoom } : {}) };
}

// Does this person give off light now? (A witch's goes out once she's been played.)
export function personLit(kind: PersonKind, r: Room | undefined): boolean {
  if (kind !== "witch") return true;
  return !!r && !r.done && (!r.witch || r.witch.state === "playing");
}

// Who a locator finds, as things stand: the merchant, the librarian, or the
// closest witch you can still reach and still play (the user, 2026-11-11: not
// one you've played); null if they're cut off (or no witch is left to find).
// you: where you stand; room: the run's rooms (a witch's game).
export function locate(kind: LocatorKey, people: Person[], you: Pt, layout: Layout, live: Floorplan, p: Progress, room: (id: string) => Room | undefined): Person | null {
  const who = LOCATES[kind];
  const open = people.filter((q) => q.kind === who && !cutOff(layout, live, p, q) && (who !== "witch" || personLit(who, room(q.id))));
  if (open.length === 0) return null;
  return open.reduce((a, b) => (Math.hypot(b.at.x - you.x, b.at.y - you.y) < Math.hypot(a.at.x - you.x, a.at.y - you.y) ? b : a));
}

// Is this tile in this room's floor? (For tests: someone standing in a room.)
export const inRoomFloor = (plan: Floorplan, id: string, q: Pt) => plan.rooms[id].some((r) => inRect(r, q));

// Where nobody wanders (the scroll-map dungeons, and a walkable run made before world version 9),
// a locator reveals the room they keep instead (the user, 2026-11-11): the closest to where you
// stand of that kind's rooms still to finish (a witch's, one not yet played), or null if there's
// none. finished: a room you've done with.
export const KEEPS: Record<LocatorKey, RoomKind> = { merchant_map: "merchant", crystal_ball: "witch", librarian_locator: "librarian" };
export function locateRoom(kind: LocatorKey, map: DungeonMap, here: string, finished: (id: string) => boolean): string | null {
  const at = map.nodes[here];
  const rooms = Object.values(map.nodes).filter((n) => n.kind === KEEPS[kind] && !finished(n.id));
  if (!at || rooms.length === 0) return null;
  const d = (n: { x: number; y: number }) => Math.hypot(n.x - at.x, n.y - at.y);
  return rooms.reduce((a, b) => (d(b) < d(a) ? b : a)).id;
}
