// Using the things in a walkable run's rooms: a tap on one finds it, and the
// way the walk screen walks you up to it ends where you can use it.
//
// Regression (the user's play-test, 2026-11-08): in world version 4 runs,
// chests and stashes can't be opened. From v4 a thing stands at its
// footprint's middle (placements.ts spotOf), which is off its panel's middle
// for a chest, a deck or a cart (the back two rows: y − 1/6) and a sack (a
// corner: x and y ± 1/6). Two separate faults follow:
// 1. The tap: WalkView looks the thing up in the seen-map by its position,
//    `known[t.y * w + t.x]`, which is no cell at all for a fractional
//    position (undefined), so the tap never picks the thing.
// 2. The reach: `approach` walks you to any panel round the thing's panel, but
//    `inReach` measures 1.5 u from the thing's (now off-centre) middle, so
//    from the far diagonal panels you arrive out of reach (≈1.54 u for a
//    chest, ≈1.65 u for a sack in the opposite corner) and nothing opens.
// v3 runs (and older) stand everything on a panel's middle, so neither shows.
// The v4 tests are `it.fails` until the fix; then they become `it`.
import { describe, expect, it } from "vitest";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { walkable } from "../lib/dungeon/walk";
import { panelAt } from "../lib/world/grid";
import { roomIds, thingsOf, inReach, approach, solidCells, type Thing } from "../lib/world/walkWorld";
import { placementsOfWalk } from "../lib/world/migrate";
import { placeWalk } from "../lib/world/place";
import { objectDef } from "../lib/world/objects";
import type { Floorplan, Pt } from "../lib/dungeon/floorplan";

const cache = new Map<string, DungeonRun>();
const made = (dungeon: 0 | 1, seed: number, v: number): DungeonRun => {
  const k = `${dungeon}:${seed}:${v}`;
  if (cache.has(k)) return cache.get(k)!;
  const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(seed), dungeon);
  const walk = { ...run.walk!, v };
  const out = { ...run, walk: { ...walk, placed: placeWalk(walk, run.map, dungeonOf(run), (id) => walkRoom(run, id)).placed } };
  cache.set(k, out);
  return out;
};
const CASES = [[0, 41], [1, 41]] as const;

// Every thing you can use in a run, as the walk screen builds them.
function usable(run: DungeonRun): { plan: Floorplan; things: Thing[] } {
  const walk = run.walk!, plan = layoutFloorplan(walk.layout), room = (id: string) => walkRoom(run, id), dungeon = dungeonOf(run);
  const p = placementsOfWalk(walk, run.map, dungeon, room);
  const things = thingsOf(walk.layout, p, roomIds(walk.layout, run.map), room, p.witches, walk.spots, dungeon).filter((t) => !t.inert);
  return { plan, things };
}

// 1. The tap's lookup, as WalkView.tsx does it: the thing's position into the seen-map,
// with only the thing's own panel seen. (A position 1/6 off can still give a whole
// number, when the map's width is a multiple of 6: then it reads some other cell.)
function tapProblems(run: DungeonRun): string[] {
  const { plan, things } = usable(run);
  return things.filter((t) => {
    const known = new Uint8Array(plan.w * plan.h);
    known[panelAt(t.y) * plan.w + panelAt(t.x)] = 1;
    return known[t.y * plan.w + t.x] !== 1;
  }).map((t) => `${t.key} ${t.def} at ${t.x},${t.y}: a tap can't find it`);
}

// 2. Every panel the walk screen may walk you to beside a thing is within its reach.
function reachProblems(run: DungeonRun): string[] {
  const { plan, things } = usable(run), solid = solidCells(things, run.walk!.fires ?? [], []);
  const bad: string[] = [];
  for (const t of things) for (const { dx, dy } of objectDef(t.def).interact?.points ?? []) {
    const n: Pt = { x: panelAt(t.x) + dx, y: panelAt(t.y) + dy };
    if (!(dx || dy || !t.solid) || !walkable(plan, n.x, n.y) || solid.has(`${n.x},${n.y}`)) continue;
    if (!approach(plan, t, n, (_, to) => !solid.has(`${to.x},${to.y}`))) continue;
    if (!inReach(t, n)) bad.push(`${t.key} ${t.def}: out of reach from ${dx},${dy} (${Math.hypot(t.x - n.x, t.y - n.y).toFixed(2)} u)`);
  }
  return bad;
}

const offCentre = (run: DungeonRun) => usable(run).things.filter((t) => !Number.isInteger(t.x) || !Number.isInteger(t.y)).length;

describe("using things: v3 runs (everything on a panel's middle)", () => {
  for (const [d, s] of CASES) it(`dungeon ${d} seed ${s}: taps find things, and every way up to one ends in reach`, () => {
    const run = made(d, s, 3);
    expect([...tapProblems(run), ...reachProblems(run)]).toEqual([]);
  });
});

describe("using things: v4 runs (the play-test regression)", () => {
  it("the cases hold things off their panel's middle (so the tests below test something)", () => {
    expect(CASES.map(([d, s]) => offCentre(made(d, s, 4))).every((n) => n > 0)).toBe(true);
  });
  for (const [d, s] of CASES) {
    it.fails(`dungeon ${d} seed ${s}: a tap on a thing finds it`, () => expect(tapProblems(made(d, s, 4))).toEqual([]));
    it.fails(`dungeon ${d} seed ${s}: every way up to a thing ends in reach`, () => expect(reachProblems(made(d, s, 4))).toEqual([]));
  }
});
