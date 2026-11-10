// lib/dungeon/walkRun.ts
// The walkable Encampment as a real run (the Labyrinth's "New" choice; the
// user, 2026-11-06): an Encampment run (dungeon 0, its rules, fees, free
// runs and clears all the Encampment's) that you walk round instead of
// picking tunnels off a list. The run is the live game's DungeonRun with a
// `walk` record added (optional: old saves never have one):
// - its layout (rooms and tunnels, layout.ts) and the scroll map made from
//   it (run.map: campMap), so the screen draws the same place every time;
// - every room, rolled as the run starts (walkRooms.ts: its foes stand in
//   it where you can see them), each kept here while you're not in it; the
//   one you're in is run.current, as in the live game, so the Labyrinth
//   screen's fights, loot, cages and haul all work unchanged;
// - where you stand and how far up you've come (layout.ts Progress), what
//   your torch has shown you, the wall torches you've lit, and where each
//   beaten room's loot lies, and the rooms' campfires (campfire.ts).
// Walking into a room (walkInto) puts the one you leave back, unfinished
// or not: you can slip past foes unseen, and they're still there.

import { makeRoom, leaveRoom, wonAtTop, rollBookcases, type Cage, type DungeonId, type DungeonRun, type Room } from "./run";
import { rollPeople, locatorFinds, CAMPFIRE_STASH, type Person } from "./people";
import type { LocatorKey } from "../items/materials";
import { rollLayout, campMap, labyrinthMap, roomCentre, layoutFloorplan, WALK_SPEC, WALK_LABYRINTH, TWO_DEN_SHAPES, type Layout } from "./layout";
import { placeCampfires, CAMPFIRE_CHANCE, type Campfire } from "./campfire";
import { rollWalkRooms, roomDepth } from "./walkRooms";
import { spawnOf, isSpawn } from "./foes";
import type { Pt } from "./floorplan";
import type { Instance } from "../world/objects";
import type { DungeonMap } from "./map";

type Rng = () => number;

export type WalkRun = {
  layout: Layout;
  rooms: Record<string, Room>;  // every room but the one you're in (run.current)
  seed: number;                 // where foes start, and the wall torches
  at: Pt;                       // where you stand (a tile)
  room: string;                 // the last room you walked into going forward (layout.ts Progress.room)
  line: number | null;          // …and the cut-off line (Progress.line; null: none yet)
  known?: number[];             // the tiles you've seen, as runs of [start, length]
  lit?: string[];               // the wall torches burning (ids: torch.ts placeSconces)
  spots?: Record<string, Pt>;   // where a beaten room's loot lies (else its middle)
  trail?: Pt[];                 // your way so far, tile by tile (the scroll)
  cuts?: number[];              // …and the cut-offs you've crossed (tiles down)
  fires?: Campfire[];           // the rooms' campfires, and what each has left to give (none in older runs)
  flare?: number;               // tiles of walking left with a flare's light (torch.ts FLARE_WALK)
  flares?: number;              // flares lit this run (a new one lights afresh)
  v?: number;                   // the world version it was saved by (lib/world/migrate.ts WALK_V; missing: 0)
  placed?: Instance[];          // what was generated in it, where (lib/world/compat/v0.ts; missing in a v0 run)
  people?: Person[];            // who wanders it, and where they are (people.ts; world version 9 on: none in older runs)
  tracking?: LocatorKey[];      // the locators you've used this run: your scroll shows who each finds (people.ts locate)
};

// A library's broken bookcases (world version 9): rooms of their own, "<library>~b<i>" (as a second den is).
export const bookcaseOf = (library: string, i: number) => `${library}~b${i}`;
export const bookcasesIn = (map: DungeonMap, library: string) => Object.keys(map.nodes).filter((id) => id.startsWith(`${library}~b`))
  .sort((a, b) => Number(a.slice(a.lastIndexOf("b") + 1)) - Number(b.slice(b.lastIndexOf("b") + 1)));

// A big or long room that's a creature den holds a second den down its other
// end this often (the user, 2026-11-06; foes.ts spawnOf). 🧪
export const SECOND_DEN = 0.35;

// A new walkable run. The Encampment (dungeon 0): its room mix on a walkable
// layout, every room rolled, its chief's cages the ones given. The Labyrinth
// (dungeon 1, the Cyclops; /lab/newrun only for now): its own mix and large
// rooms (layout.ts labyrinthMap) on a bigger layout (WALK_LABYRINTH), the
// Cyclops waiting at the top. Either way, some big rooms hold two dens.
// dynamite: Klutz's dynamite quest wants a storehouse (the Labyrinth's large room).
// wander: people who wander (decision 39; the Cyclops's, world version 9 on); false: the rooms as
// they were before (the tests' runs made at older world versions).
export function startWalkRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, cages: Cage[], bindle = false, rng: Rng = Math.random, dungeon: WalkDungeon = 0, dynamite = false, wander = dungeon === 1): DungeonRun {
  const layout = rollLayout(dungeon === 0 ? WALK_SPEC : WALK_LABYRINTH, rng);
  const map = dungeon === 0 ? campMap(layout, false, rng) : labyrinthMap(layout, false, dungeon, rng, dynamite, wander);
  const rooms = rollWalkRooms(map, rng, true, [], dungeon, bindle);
  if (wander) addWanderersRooms(map, rooms, rng);
  for (const n of Object.values(map.nodes)) if (n.dynamite && rooms[n.id]) rooms[n.id] = { ...rooms[n.id], dynamite: true };
  if (dungeon === 0) rooms[map.boss] = { ...rooms[map.boss], cages };
  const start = rooms[map.start] ?? null; // (the entrance holds nothing, unless it's treasure)
  delete rooms[map.start];
  // Second dens, each a room of its own (with no tunnels: you walk into it in its parent).
  for (const r of Object.values(layout.rooms).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!TWO_DEN_SHAPES.includes(r.shape) || map.nodes[r.id].kind !== "easy" || rng() >= SECOND_DEN) continue;
    const id = spawnOf(r.id), parent = map.nodes[r.id];
    map.nodes[id] = { id, x: parent.x, y: parent.y, kind: "easy", links: [] };
    rooms[id] = makeRoom("easy", rng, roomDepth(map, r.id), dungeon, bindle);
  }
  const seed = Math.floor(rng() * 1e9);
  const fires = placeCampfires(layoutFloorplan(layout), map, (id) => roomCentre(layout.rooms[id]), rng, dungeon === 0 ? CAMPFIRE_CHANCE : 0);
  const people = wander ? rollPeople(map, layout, layoutFloorplan(layout), rooms, rng, dungeon, bindle) : null;
  if (people) Object.assign(rooms, people.rooms);
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(), ...(dungeon !== 1 ? { dungeon } : {}),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: 0, map, path: [map.start], cleared: start ? [] : [map.start], current: start,
    loot: [], status: "exploring", inside: false, ...(bindle ? { bindle } : {}), ...(dungeon === 0 ? { campCages: cages } : {}),
    walk: { layout, rooms, seed, at: roomCentre(layout.rooms[map.start]), room: map.start, line: null, fires, ...(people ? { people: people.people } : {}) },
  };
}

// The rooms decision 39 changes (world version 9): a library's broken
// bookcases in place of its codexes lying about and its own librarian (the
// librarian wanders), with a locator lectern; half the campfires with a stash
// beside them; and now and then a locator in a stash (a chest's is rolled as
// it's opened).
function addWanderersRooms(map: DungeonMap, rooms: Record<string, Room>, rng: Rng) {
  for (const id of Object.keys(rooms).sort()) {
    const r = rooms[id];
    if (r.kind === "library") {
      rooms[id] = { kind: "library", lectern: true, done: false };
      rollBookcases(rng).forEach((b, i) => {
        const bid = bookcaseOf(id, i), n = map.nodes[id];
        map.nodes[bid] = { id: bid, x: n.x, y: n.y, kind: "bookcase", links: [] };
        rooms[bid] = b;
      });
    } else if (r.kind === "campfire" && rng() < CAMPFIRE_STASH) {
      rooms[id] = { ...r, sack: [...(makeRoom("stash", rng).sack ?? []), ...locatorFinds(rng)] };
    } else if (r.kind === "stash") {
      rooms[id] = { ...r, sack: [...(r.sack ?? []), ...locatorFinds(rng)] };
    }
  }
}

// The dungeons that can be walked so far (the Encampment, live as "New"; the Labyrinth, in the lab).
export type WalkDungeon = 0 | 1;

// A boss waiting for you to walk up to it (foes.ts placeWaiter): the
// Encampment's chief, the Labyrinth's boss. (Not the Labyrinth's large
// encampments: their foes look about like any room's.)
export const waitsHere = (r: Room, dungeon: DungeonId) => r.kind === "boss" || (dungeon === 0 && r.kind === "encampment");

// Where a camp's cages stand: a row along the top of its room (its top
// floor rect's), CAGE_GAP tiles apart, behind the boss waiting below them.
export const CAGE_GAP = 4;
// (Placed by lib/world/place.ts; compat/v0Placers.ts for older runs.)


// Where you stand on the run's map: the room you're in.
const here = (run: DungeonRun) => run.path[run.path.length - 1];

// A room as it stands now: the one you're in, or as you left it.
export function walkRoom(run: DungeonRun, id: string): Room | undefined {
  if (id === here(run)) return run.current ?? undefined;
  return run.walk?.rooms[id];
}

// Walked into a room: the one you were in is put back as it is (cleared if
// it's finished), and this one is where you are. Your first time in counts
// as a room explored. (The screen first leaves any opened sack's leftovers
// on the floor, as it does when you take a tunnel.)
export function walkInto(run: DungeonRun, id: string): DungeonRun {
  const walk = run.walk;
  if (!walk || run.status !== "exploring" || id === here(run) || !run.map.nodes[id]) return run;
  const was = here(run);
  const rooms = { ...walk.rooms };
  if (run.current) rooms[was] = run.current;
  const finished = !run.current || run.current.done;
  const next = rooms[id] ?? null;
  delete rooms[id];
  return {
    ...run, current: next, battle: undefined,
    path: [...run.path, id], room: run.room + (run.path.includes(id) || isSpawn(id) ? 0 : 1), // (a second den's room was counted already)
    cleared: finished ? [...new Set([...run.cleared, was])] : run.cleared,
    walk: { ...walk, rooms },
  };
}

// Heading home after beating the boss at the top (and staying to open the
// cages): back to its room if you'd walked out sideways, and the run's
// cleared, on to the haul as the live game's win is.
export const headHome = (run: DungeonRun): DungeonRun =>
  wonAtTop(run) && run.status === "exploring" ? leaveRoom(walkInto(run, run.map.boss)) : run;

// Your spot and what you've seen, kept in the run.
export const walkKeep = (run: DungeonRun, patch: Partial<WalkRun>): DungeonRun =>
  run.walk ? { ...run, walk: { ...run.walk, ...patch } } : run;

