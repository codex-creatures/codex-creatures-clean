import { describe, expect, it } from "vitest";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { ROCK, type Pt } from "../lib/dungeon/floorplan";
import { LIGHT_GAP, CANDLE_GROUP } from "../lib/dungeon/torch";
import { placeWalk, MOUNTED_DEFS, PLACED_V, type Placed } from "../lib/world/place";
import { newWalkRun, migrateWalkRun, placedProblem } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { panelOfSubcell } from "../lib/world/grid";
import { WALK_V } from "../lib/world/version";
import type { Instance } from "../lib/world/objects";

// World version 8 (the user, 2026-11-09: "make the wall candles all wall torches. Wall candles
// should no longer exist"): the candle budget's lights on rooms' walls and pillars are wall
// torches; floor candles stay as they were.

const quiet = <T>(f: () => T): T => { const warn = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = warn; } };
const made = (d: 0 | 1, s: number, v?: number): DungeonRun => {
  const r = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, d === 0 ? [{ creatureId: "moss_wolf", level: 3 }, {}] : [], false, seeded(s * 7919 + 13), d);
  return v === undefined ? newWalkRun({ ...r, walk: { ...r.walk!, v: undefined } }) : { ...r, walk: { ...r.walk!, v } };
};
const placedOf = (run: DungeonRun): Placed => placeWalk(run.walk!, run.map, dungeonOf(run), (id) => walkRoom(run, id));
const panelOf = (i: Instance): Pt => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) });
const isTorch = (i: Instance) => i.def === "sconce" || i.def === "sconce-side";
const STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] } as const;

const RUNS: [0 | 1, number][] = process.env.FULL_TESTS ? [[0, 1], [0, 2], [0, 3], [1, 1], [1, 2]] : [[0, 1], [0, 2]];
const cases = RUNS.map(([d, s]) => { const run = made(d, s); return { d, s, run, p: placedOf(run) }; });

describe("world version 8: wall torches, not wall candles", () => {
  it("new runs are made at v8, with no wall candles at all", () => {
    expect(PLACED_V).toBe(8);
    expect(WALK_V).toBe(8);
    for (const { run } of cases) {
      expect(run.walk!.v).toBe(8);
      expect(run.walk!.placed!.some((i) => MOUNTED_DEFS.includes(i.def))).toBe(false);
    }
  });
  it("the budget's torches stand on rooms' own walls and pillars, never a south wall, one thing a slot, their gaps kept", () => {
    let extra = 0;
    for (const { run, p } of cases) {
      const fp = layoutFloorplan(run.walk!.layout);
      const owners = [...p.occupancy.attached.values()];
      expect(new Set(owners).size).toBe(owners.length);
      const torches = p.placed.filter(isTorch);
      // The extra ones: in a room, on a side wall or not where the first pass puts them (a room's top wall).
      const roomTorch = torches.filter((i) => run.walk!.layout.rooms[i.room]);
      for (const i of roomTorch) {
        expect(i.wall, i.id).not.toBe("south");
        const at = panelOf(i), [dx, dy] = STEP[i.wall!];
        expect(fp.tiles[at.y * fp.w + at.x], i.id).not.toBe(ROCK);
        expect(fp.tiles[(at.y + dy) * fp.w + at.x + dx], i.id).toBe(ROCK);
        expect(i.def).toBe(i.wall === "north" ? "sconce" : "sconce-side");
      }
      const budget = p.lighting!.budgets.reduce((n, b) => n + b.mounted, 0);
      extra += budget;
      // Each of the budget's torches keeps LIGHT_GAP from every other light (it was placed last).
      const lights = [...torches.map(panelOf), ...(run.walk!.fires ?? [])];
      const late = roomTorch.slice(-budget);
      for (const i of late) for (const q of lights) {
        const a = panelOf(i);
        if (q.x === a.x && q.y === a.y) continue;
        expect(Math.hypot(q.x - a.x, q.y - a.y), i.id).toBeGreaterThanOrEqual(LIGHT_GAP);
      }
    }
    expect(extra).toBeGreaterThan(0);
  });
  it("the first pass's torches are v7's exactly; the budget's take the room's next ids; floor candles start at candle:<room>", () => {
    for (const { d, s, p } of cases) {
      const v7 = placedOf(made(d, s, 7));
      const firstPass = v7.placed.filter(isTorch);
      for (const t of firstPass) expect(p.placed.find((i) => i.id === t.id), t.id).toEqual(t);
      const byRoom = new Map<string, string[]>();
      for (const i of p.placed.filter(isTorch)) byRoom.set(i.room, [...(byRoom.get(i.room) ?? []), i.id]);
      for (const [room, ids] of byRoom) expect(ids).toEqual(ids.map((_, n) => `${room}:${n}`));
      for (const i of p.placed.filter((q) => q.def === "floor-candle")) expect(i.id.startsWith(`candle:${i.room}`)).toBe(true);
      const firstCandle = new Map<string, string>();
      for (const i of p.placed.filter((q) => q.def === "floor-candle")) if (!firstCandle.has(i.room)) firstCandle.set(i.room, i.id);
      for (const [room, id] of firstCandle) expect(id).toBe(`candle:${room}`);
    }
  });
  it("a v8 run holding a wall candle is damaged; a v7 run's are fine", () => {
    const v7 = made(0, 4, 7), v7placed = placedOf(v7).placed;
    const mounted = v7placed.find((i) => MOUNTED_DEFS.includes(i.def));
    expect(mounted).toBeDefined();
    expect(placedProblem(v7placed, 7)).toBeNull();
    expect(placedProblem(v7placed, 8)).toMatch(/wall candle/);
    const { run } = cases[0];
    expect(quiet(() => migrateWalkRun({ ...run, walk: { ...run.walk!, placed: [...run.walk!.placed!, mounted!] } })).outcome).toBe("damaged");
  });
  it("the walk reads a room's side-wall torch with its side, so it's drawn on that wall", () => {
    for (const { run } of cases) {
      const pl = placementsFrom(run.walk!.placed!, run.walk!);
      for (const i of run.walk!.placed!.filter((q) => isTorch(q) && run.walk!.layout.rooms[q.room])) {
        const c = pl.sconces.find((q) => q.id === i.id)!;
        expect(c.wall).toBe(i.wall === "west" ? "left" : i.wall === "east" ? "right" : undefined);
        expect(c.lit).toBe(i.start === "lit");
      }
    }
  });
  slowIt("the count (printed): extra torches a room, and how many start lit, by kind", async () => {
    const by: Record<string, { rooms: number; torches: number; lit: number }> = {};
    for (const d of [0, 1] as const) for (let s = 1; s <= 10; s++) {
      await new Promise((ok) => setTimeout(ok, 0));
      const run = made(d, s, 8), p = placedOf(run);
      for (const b of p.lighting!.budgets) {
        const group = CANDLE_GROUP[b.kind] ?? "none", mine = p.placed.filter((i) => i.room === b.room && isTorch(i)).slice(-b.mounted || p.placed.length);
        const lit = b.mounted ? mine.filter((i) => i.start === "lit").length : 0;
        for (const k of ["all", group]) { const r = (by[k] ??= { rooms: 0, torches: 0, lit: 0 }); r.rooms++; r.torches += b.mounted; r.lit += lit; }
      }
    }
    console.log(Object.entries(by).map(([k, r]) => `${k}: ${r.rooms} rooms, ${(r.torches / r.rooms).toFixed(2)} extra torches a room, ${r.torches ? Math.round((100 * r.lit) / r.torches) : 0}% lit`).join("\n"));
    expect(by.all.torches / by.all.rooms).toBeGreaterThan(0.15);
    expect(by.none.torches).toBe(0);
  }, 300000);
});
