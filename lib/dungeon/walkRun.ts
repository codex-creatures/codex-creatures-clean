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
//   beaten room's loot lies.
// Walking into a room (walkInto) puts the one you leave back, unfinished
// or not: you can slip past foes unseen, and they're still there.

import type { Cage, DungeonRun, Room } from "./run";
import { rollLayout, campMap, roomCentre, WALK_SPEC, type Layout } from "./layout";
import { rollWalkRooms } from "./walkRooms";
import type { Pt } from "./floorplan";

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
};

// A new run of the walkable Encampment: the Encampment's room mix on a
// walkable layout, every room rolled, its chief's cages the ones given.
export function startWalkRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, cages: Cage[], bindle = false, rng: Rng = Math.random): DungeonRun {
  const layout = rollLayout(WALK_SPEC, rng);
  const map = campMap(layout, false, rng);
  const rooms = rollWalkRooms(map, rng);
  rooms[map.boss] = { ...rooms[map.boss], cages };
  const start = rooms[map.start] ?? null; // (the entrance holds nothing, unless it's treasure)
  delete rooms[map.start];
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(), dungeon: 0,
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: 0, map, path: [map.start], cleared: start ? [] : [map.start], current: start,
    loot: [], status: "exploring", inside: false, ...(bindle ? { bindle } : {}), campCages: cages,
    walk: { layout, rooms, seed: Math.floor(rng() * 1e9), at: roomCentre(layout.rooms[map.start]), room: map.start, line: null },
  };
}

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
    path: [...run.path, id], room: run.room + (run.path.includes(id) ? 0 : 1),
    cleared: finished ? [...new Set([...run.cleared, was])] : run.cleared,
    walk: { ...walk, rooms },
  };
}

// Your spot and what you've seen, kept in the run.
export const walkKeep = (run: DungeonRun, patch: Partial<WalkRun>): DungeonRun =>
  run.walk ? { ...run, walk: { ...run.walk, ...patch } } : run;

