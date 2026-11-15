// World version 16 (the user, 2026-11-15): an unguarded storehouse's stores in crates and barrels to
// search one by one, groups of decor in rooms' tucked-away corners, and pairs of standing torches lining
// the way to the boss, lighting a pair at a time once your torch reaches them.
import { describe, expect, it } from "vitest";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { ROCK } from "../lib/dungeon/floorplan";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { placeWalk, reachableIn, STORE_CRATES, CORNER_DOOR_GAP, CORNER_MOST } from "../lib/world/place";
import { placedProblem, newWalkRun, placementsOfWalk, CRATES_EMPTY } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { thingsOf, roomIds } from "../lib/world/walkWorld";
import { startWalk, stepWalk, CHAIN_STEP } from "../lib/world/walkSim";
import { panelOfSubcell } from "../lib/world/grid";
import { panelKey } from "../lib/world/occupancy";
import { navBlocked } from "../lib/world/policy";
import type { Instance } from "../lib/world/objects";

const camp = Array.from({ length: 8 }, (_, i) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(i * 7919 + 5), 0, false, false));
const at = (run: DungeonRun, v: number) => {
  const walk = { ...run.walk!, v };
  return { walk, ...placeWalk(walk, run.map, dungeonOf(run), (k) => walkRoom(run, k)) };
};
const panel = (i: Instance) => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) });
const isNew = (i: Instance) => /^(crate|decor|brazier):/.test(i.id);

describe("world version 16", () => {
  it("version 15 has none of it; it's refused below 16", () => {
    for (const run of camp.slice(0, 2)) expect(at(run, 15).placed.filter(isNew)).toEqual([]);
    const c: Instance = { id: "crate:r:0", def: "store-crates", room: "r", sx: 3, sy: 3, size: { w: 3, d: 3 } };
    expect(placedProblem([c], 16)).toBeNull();
    expect(placedProblem([c], 15)).toMatch(/store-crates in a world version 15 run/);
    expect(placedProblem([{ ...c, id: "decor:r:0:0", def: "skull" }], 15)).toMatch(/skull in a world version 15 run/);
  });

  it("corner groups: in tucked-away corners, away from every doorway, never the entrance or the boss's; no door cut off", () => {
    const bad: string[] = [];
    let groups = 0;
    for (const [n, run] of camp.entries()) {
      const { walk, placed, report, occupancy: o } = at(run, 16), layout = walk.layout, plan = layoutFloorplan(layout);
      if (report.problems.length) bad.push(`${n}: ${report.problems.map((q) => q.what).join("; ")}`);
      expect(placedProblem(placed, 16)).toBeNull();
      const rock = (x: number, y: number) => x < 0 || y < 0 || x >= plan.w || y >= plan.h || plan.tiles[y * plan.w + x] === ROCK;
      const decor = placed.filter((i) => i.id.startsWith("decor:"));
      for (const id of Object.keys(layout.rooms)) {
        const mine = decor.filter((d) => d.room === id);
        if (mine.length && (id === layout.start || id === layout.boss)) bad.push(`${n} ${id}: decor in the ${id === layout.start ? "entrance" : "boss's room"}`);
        const g = new Set(mine.map((d) => d.id.split(":")[2]));
        if (g.size > CORNER_MOST) bad.push(`${n} ${id}: ${g.size} groups`);
        groups += g.size;
        // Each group's first piece is its corner: rock beside it and above or below.
        for (const d of mine.filter((q) => q.id.endsWith(":0"))) {
          const p = panel(d);
          if (!((rock(p.x - 1, p.y) || rock(p.x + 1, p.y)) && (rock(p.x, p.y - 1) || rock(p.x, p.y + 1)))) bad.push(`${n} ${d.id}: not in a corner`);
          const doors = plan.doors.filter((q) => q.room === id);
          if (doors.some((q) => Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y)) <= CORNER_DOOR_GAP - 1)) bad.push(`${n} ${d.id}: by a doorway`);
        }
        const reach = reachableIn(o, plan.rooms[id], id);
        for (const d of plan.doors.filter((q) => q.room === id)) for (const s of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const p = { x: d.x + s[0], y: d.y + s[1] };
          if (plan.rooms[id].some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) && !navBlocked(o, p) && !reach.has(panelKey(p))) bad.push(`${n} ${id}: door ${d.x},${d.y} cut off`);
        }
      }
      // Drawn as things in the way, nothing to use.
      const things = thingsOf(layout, placementsFrom(placed, walk), roomIds(layout, run.map), (k) => walkRoom(run, k), [], undefined, 0);
      for (const d of decor) if (!things.some((t) => t.key === d.id && t.inert)) bad.push(`${n} ${d.id}: not drawn`);
    }
    expect(bad).toEqual([]);
    expect(groups).toBeGreaterThan(camp.length);
  }, 120_000);

  it("the boss's standing torches: in pairs up the way to the boss, lighting a pair at a time once your torch reaches one", () => {
    const run = newWalkRun(camp[0]), walk = run.walk!, plan = layoutFloorplan(walk.layout);
    const torches = walk.placed!.filter((i) => i.id.startsWith("brazier:"));
    expect(torches.length).toBeGreaterThan(1);
    expect(torches.every((t) => t.room === walk.layout.boss && t.def === "standing-torch")).toBe(true);
    const placements = placementsOfWalk(walk, run.map, 0, (k) => walkRoom(run, k));
    const chained = placements.candles.filter((c) => c.chain !== undefined);
    expect(chained.length).toBe(torches.length);
    expect(chained.every((c) => !c.lit)).toBe(true);
    const pairs = Math.max(...chained.map((c) => c.chain!)) + 1;
    // Stood by the first pair: none lit by walking near; then a pair every CHAIN_STEP.
    const first = chained.find((c) => c.chain === 0)!;
    const sim = startWalk(walk, plan, plan, { sconces: placements.sconces, candles: placements.candles, foes: [], npcs: [] }, new Uint8Array(plan.w * plan.h).fill(1));
    sim.me = { x: Math.round(first.x), y: Math.round(first.y) + 1, path: [] };
    const step = (now: number) => stepWalk(sim, { now, busy: false, room: (k) => walkRoom(run, k), here: walk.layout.boss, team: ["a"], hp: run.hp, things: () => [], rng: seeded(1) });
    step(1000);
    const litNow = () => sim.candles.filter((c) => c.chain !== undefined && c.lit).map((c) => c.chain!);
    expect(litNow().every((p) => p === 0)).toBe(true);
    expect(litNow().length).toBeGreaterThan(0);
    for (let k = 1; k < pairs; k++) {
      step(1000 + k * CHAIN_STEP - 10);
      expect(Math.max(...litNow())).toBe(k - 1);
      step(1000 + k * CHAIN_STEP + 10);
      expect(Math.max(...litNow())).toBe(k);
    }
    expect(litNow().length).toBe(torches.length);
  }, 60_000);
});

describe("a storehouse's crates and barrels (world version 16)", () => {
  // The Labyrinth's large rooms: a storehouse, unguarded, now and then.
  const found = (() => {
    for (let s = 1; s <= 12; s++) {
      const run = newWalkRun(startWalkRun(["a"], ["a"], { a: 1 }, 4, [], false, seeded(s * 53 + 11), 1));
      const id = Object.keys(run.walk!.rooms).find((k) => run.walk!.rooms[k].kind === "storehouse" && run.walk!.rooms[k].crates);
      if (id) return { run, id };
    }
    return null;
  })();
  it("its stores are shared out among them, some left with nothing; each searched once; its one big pile is gone", () => {
    expect(found).not.toBeNull();
    const { run, id } = found!, r = run.walk!.rooms[id];
    const crates = run.walk!.placed!.filter((i) => i.id.startsWith(`crate:${id}:`));
    expect(crates.length).toBeGreaterThanOrEqual(2);
    expect(crates.length).toBeLessThanOrEqual(STORE_CRATES[1]);
    expect(r.crates!.length).toBe(crates.length);
    expect(r.sack).toEqual([]);
    expect(r.crates!.filter((c) => c.length === 0).length).toBeGreaterThanOrEqual(Math.min(CRATES_EMPTY, crates.length - 1));
    expect(r.crates!.flat().length).toBeGreaterThan(0);
    const placements = placementsOfWalk(run.walk!, run.map, 1, (k) => walkRoom(run, k));
    const things = (q = r) => thingsOf(run.walk!.layout, placements, [id], () => q, [], undefined, 1);
    expect(things().some((t) => t.key === id)).toBe(false); // (no stores pile)
    const mine = things().filter((t) => t.crate !== undefined);
    expect(mine.length).toBe(crates.length);
    expect(mine.every((t) => t.solid && !t.inert && !t.open)).toBe(true);
    expect(things({ ...r, searched: [0] }).find((t) => t.crate === 0)?.open).toBe(true);
  }, 120_000);
});
