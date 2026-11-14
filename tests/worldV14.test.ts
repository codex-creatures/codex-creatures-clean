// World version 14 (the user, 2026-11-14): bookcases against rooms' top walls (some with a candle
// beside them, a few with a codex in), and a storehouse's dynamite and rugged backpack lying on its
// floor to pick up. Also the looted look of chests and sacks, and the rats' holes.
import { describe, expect, it } from "vitest";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { ROCK } from "../lib/dungeon/floorplan";
import { dungeonOf, shelfCodex, type DungeonRun, type Room } from "../lib/dungeon/run";
import { placeWalk, reachableIn, SHELF_ROOMS, SHELF_CHANCE, SHELF_CODEX } from "../lib/world/place";
import { placedProblem, newWalkRun, placementsOfWalk } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { thingsOf, roomIds, placeFloorLifeOf, shelfHasCodex, dynamiteOnFloor } from "../lib/world/walkWorld";
import { footprintCells, panelOfSubcell } from "../lib/world/grid";
import { panelKey } from "../lib/world/occupancy";
import { navBlocked } from "../lib/world/policy";
import { RAT_CHANCE } from "../lib/dungeon/decor";
import type { Instance } from "../lib/world/objects";

const runs = Array.from({ length: 12 }, (_, i) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(i * 7919 + 5), 0, false, false));
const at = (run: DungeonRun, v: number) => {
  const walk = { ...run.walk!, v };
  return { walk, ...placeWalk(walk, run.map, dungeonOf(run), (k) => walkRoom(run, k)) };
};
const isNew = (i: Instance) => i.id.startsWith("shelf:") || i.def === "dynamite" || i.def === "backpack";

describe("bookcases against a wall (world version 14)", () => {
  it("version 13 has none", () => {
    for (const run of runs.slice(0, 3)) expect(at(run, 13).placed.filter(isNew)).toEqual([]);
  });
  it("some rooms have one, its back to the top wall, never the entrance, the boss's or a library; no door cut off", () => {
    const bad: string[] = [];
    let rooms = 0, shelves = 0, candles = 0, codexes = 0;
    for (const [n, run] of runs.entries()) {
      const { walk, placed, report, occupancy: o } = at(run, 14), layout = walk.layout, plan = layoutFloorplan(layout);
      if (report.problems.length) bad.push(`${n}: ${report.problems.map((q) => q.what).join("; ")}`);
      expect(placedProblem(placed, 14)).toBeNull();
      const ss = placed.filter((i) => i.id.startsWith("shelf:"));
      for (const id of Object.keys(layout.rooms)) {
        const kind = walkRoom(run, id)?.kind ?? "";
        if (id !== layout.start && id !== layout.boss && SHELF_ROOMS.has(kind)) rooms++;
        const mine = ss.filter((s) => s.room === id);
        if (mine.length > 1) bad.push(`${n} ${id}: ${mine.length} bookcases`);
        if (mine.length && (id === layout.start || id === layout.boss || !SHELF_ROOMS.has(kind) || kind === "library")) bad.push(`${n} ${id}: a bookcase in a ${kind}`);
        const reach = reachableIn(o, plan.rooms[id], id);
        for (const d of plan.doors.filter((q) => q.room === id)) for (const s of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const p = { x: d.x + s[0], y: d.y + s[1] };
          if (plan.rooms[id].some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) && !navBlocked(o, p) && !reach.has(panelKey(p))) bad.push(`${n} ${id}: door ${d.x},${d.y} cut off`);
        }
      }
      for (const s of ss) {
        // Against the wall: rock right behind its footprint's back row.
        const cells = footprintCells(s, s.size!), top = Math.min(...cells.map((c) => c.sy));
        const py = panelOfSubcell(top), px = panelOfSubcell(s.sx);
        if (top - 3 * py !== -1 || plan.tiles[(py - 1) * plan.w + px] !== ROCK) bad.push(`${n} ${s.id}: not against the top wall`);
        if (s.def !== "bookcase") bad.push(`${n} ${s.id}: a ${s.def}`);
        const thing = thingsOf(layout, placementsFrom(placed, walk), [s.room], (k) => walkRoom(run, k), [], undefined, 0).find((q) => q.key === s.id);
        if (!thing || thing.def !== "bookcase" || !thing.shelf || !thing.solid || thing.inert || thing.open) bad.push(`${n} ${s.id}: as a thing ${JSON.stringify(thing)}`);
        if (s.codex) codexes++;
      }
      shelves += ss.length;
      // A candle beside one is a floor candle like any (the room's candle ids), right next to it.
      for (const s of ss) {
        const near = placed.filter((i) => i.def === "floor-candle" && i.room === s.room && Math.abs(panelOfSubcell(i.sx) - panelOfSubcell(s.sx)) <= 1 && Math.abs(panelOfSubcell(i.sy) - panelOfSubcell(s.sy)) <= 1);
        if (near.length) candles++;
        for (const c of near) if (!c.id.startsWith(`candle:${s.room}`)) bad.push(`${n} ${c.id}: a candle's id`);
      }
    }
    expect(bad).toEqual([]);
    expect(shelves / rooms).toBeGreaterThan(SHELF_CHANCE / 2);
    expect(shelves / rooms).toBeLessThan(SHELF_CHANCE * 1.6);
    expect(candles).toBeGreaterThan(0);
    expect(codexes).toBeLessThan(Math.max(4, shelves * SHELF_CODEX * 3));
  }, 60_000);
  it("is refused in a run of an older version; only a bookcase holds a codex", () => {
    const s: Instance = { id: "shelf:r", def: "bookcase", room: "r", sx: 3, sy: 3, size: { w: 3, d: 2 } };
    expect(placedProblem([s], 13)).toMatch(/bookcase in a world version 13 run/);
    expect(placedProblem([s], 14)).toBeNull();
    expect(placedProblem([{ ...s, codex: true }], 14)).toBeNull();
    expect(placedProblem([{ ...s, codex: true }], 13)).toMatch(/world version 13/);
    expect(placedProblem([{ ...s, id: "x", def: "chest", codex: true }], 14)).toMatch(/codex it can't have/);
    expect(placedProblem([{ ...s, id: "dynamite:r", def: "dynamite" }], 13)).toMatch(/dynamite in a world version 13 run/);
    // (A library's broken bookcases are older, and stay fine.)
    expect(placedProblem([{ ...s, id: "lib~b0:bookcase" }], 10)).toBeNull();
  });
  it("searched once, then left as it is; a codex in one is read from the run, and is one codex", () => {
    const run = newWalkRun(runs.find((r) => at(r, 14).placed.some((i) => i.id.startsWith("shelf:")))!);
    const s = run.walk!.placed!.find((i) => i.id.startsWith("shelf:"))!;
    const placements = placementsOfWalk(run.walk!, run.map, 0, (k) => walkRoom(run, k));
    const thing = (r: Room) => thingsOf(run.walk!.layout, placements, [s.room], () => r, [], undefined, 0).find((q) => q.key === s.id);
    const room = walkRoom(run, s.room)!;
    expect(thing(room)).toMatchObject({ open: false, state: "shut", shelf: true });
    expect(thing({ ...room, shelfSearched: true })).toMatchObject({ open: true, state: "open", shelf: true });
    expect(shelfHasCodex(run.walk, s.room)).toBe(!!s.codex);
    expect(shelfHasCodex(run.walk, "nowhere")).toBe(false);
    const c = shelfCodex(seeded(3));
    expect(c.dropType).toBe("item");
    expect((c as { codexMove?: string }).codexMove).toBeTruthy();
  });
});

describe("a storehouse's finds on its floor (world version 14)", () => {
  // The Labyrinth with Klutz's dynamite wanted: its first large room is the storehouse, holding the dynamite
  // (and, on the bindle, the rugged backpack now and then).
  const found = (() => {
    for (let s = 1; s <= 8; s++) {
      const run = newWalkRun(startWalkRun(["a"], ["a"], { a: 1 }, 4, [], true, seeded(s * 31 + 7), 1, true));
      const id = Object.keys(run.walk!.rooms).find((k) => run.walk!.rooms[k].kind === "storehouse" && run.walk!.rooms[k].dynamite);
      if (id && run.walk!.rooms[id].packOnFloor) return { run, id };
    }
    return null;
  })();
  it("lie on its floor, a \"!\" over each, the backpack out of its stores; picked up, they're gone", () => {
    expect(found).not.toBeNull();
    const { run, id } = found!;
    const placed = run.walk!.placed!, r = run.walk!.rooms[id];
    expect(placed.some((i) => i.id === `dynamite:${id}` && i.def === "dynamite")).toBe(true);
    expect(placed.some((i) => i.id === `backpack:${id}` && i.def === "backpack")).toBe(true);
    expect(dynamiteOnFloor(run.walk, id)).toBe(true);
    expect((r.sack ?? []).some((x) => "backpack" in x)).toBe(false);
    const placements = placementsOfWalk(run.walk!, run.map, 1, (k) => walkRoom(run, k));
    const things = (q: Room) => thingsOf(run.walk!.layout, placements, roomIds(run.walk!.layout, run.map), (k) => (k === id ? q : walkRoom(run, k)), [], undefined, 1);
    const guarded = !!r.enemies?.length && !r.done;
    for (const what of ["dynamite", "backpack"] as const) {
      const t = things(r).find((q) => q.key === `${what}:${id}`);
      expect(t).toMatchObject({ pickup: what, solid: false, flag: !guarded });
      expect(!!t?.guarded).toBe(guarded);
    }
    const after = things({ ...r, dynamite: false, packOnFloor: false });
    expect(after.some((q) => q.key === `dynamite:${id}` || q.key === `backpack:${id}`)).toBe(false);
  }, 120_000);
});

describe("looted chests and sacks (the user, 2026-11-14)", () => {
  it("a chest stays, open and empty; a sack goes", () => {
    const run = newWalkRun(runs[0]);
    const placements = placementsOfWalk(run.walk!, run.map, 0, (k) => walkRoom(run, k));
    const ids = roomIds(run.walk!.layout, run.map);
    const of = (kind: string) => ids.find((k) => walkRoom(run, k)?.kind === kind && placements.spot(`${k}:${kind === "stash" ? "sack" : "chest"}`));
    const look = (id: string, r: Room) => thingsOf(run.walk!.layout, placements, [id], () => r, [], undefined, 0).find((q) => q.key === id);
    const chest = of("chest") ?? of("treasure");
    expect(chest).toBeDefined();
    const c = walkRoom(run, chest!)!;
    expect(look(chest!, c)?.empty).toBeUndefined();
    expect(look(chest!, { ...c, done: true, opened: true, sack: [{ gold: 5 }] })).toMatchObject({ open: true });
    expect(look(chest!, { ...c, done: true, opened: true, sack: [{ gold: 5 }] })?.empty).toBeUndefined();
    expect(look(chest!, { ...c, done: true, opened: true, sack: [] })).toMatchObject({ open: true, empty: true });
    const stash = of("stash");
    if (stash) {
      const s = walkRoom(run, stash)!;
      expect(look(stash, { ...s, opened: true, sack: [{ gold: 5 }] })).toMatchObject({ def: "sack", open: true });
      expect(look(stash, { ...s, opened: true, sack: [] })).toBeUndefined();
    }
  });
});

describe("rats' holes in real rooms", () => {
  it(`about ${RAT_CHANCE * 100}% of rooms have one, with the wall torches where they are`, () => {
    let rooms = 0, holes = 0;
    for (const run0 of runs.slice(0, 4)) {
      const run = newWalkRun(run0), walk = run.walk!, plan = layoutFloorplan(walk.layout);
      const placements = placementsOfWalk(walk, run.map, 0, (k) => walkRoom(run, k));
      const things = thingsOf(walk.layout, placements, roomIds(walk.layout, run.map), (k) => walkRoom(run, k), [], {}, 0);
      const life = placeFloorLifeOf(walk, plan, things, placements.candles, placements.sconces);
      rooms += Object.keys(plan.rooms).length - 2;
      holes += life.holes.length;
      // The hole itself is never right under a wall torch.
      for (const h of life.holes) expect(placements.sconces.some((s) => Math.hypot(s.x - h.x, s.y - h.y) < 1.5)).toBe(false);
    }
    expect(holes / rooms).toBeGreaterThan(RAT_CHANCE / 3); // (seeded: these four runs have 9%; it was 2% before the rat could run under a torch)
  }, 60_000);
});
