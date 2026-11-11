import { describe, expect, it, vi } from "vitest";
// These are the old versions' rules, on Cyclops runs of the size they were made at (30 rooms, 10 to
// the lair: it grew to 60 and 15 on 2026-11-11, at world version 11).
vi.mock("../lib/dungeon/layout", async (real) => { const m = await real<typeof import("../lib/dungeon/layout")>(); return { ...m, WALK_LABYRINTH: m.WALK_LABYRINTH_30 }; });
import fs from "node:fs";
import path from "node:path";
import { slowIt, stressIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { hasFight, dungeonOf, type Cage, type DungeonRun, type Room } from "../lib/dungeon/run";
import { DOOR_CLEAR, parentOf } from "../lib/dungeon/foes";
import { findPath } from "../lib/dungeon/walk";
import type { Floorplan, Pt } from "../lib/dungeon/floorplan";
import { roomIds, thingsOf, solidCells, approach, foeStarts } from "../lib/world/walkWorld";
import { newWalkRun, migrateWalkRun, placementsOfWalk, placedProblem, canRecover, recoverWalkRun } from "../lib/world/migrate";
import { placeWalk, reachableIn, PLACED_V, FIRST_PLACED_V, SPAWN_CLEARANCE, CANDLE_FIRE_GAP, type Placed } from "../lib/world/place";
import { placementsFrom } from "../lib/world/placements";
import {
  newOccupancy, canPlace, take, markStone, reserve, clearanceCells, roomFor, panelKey, attachmentSlots, slotKey, slotPoint, slotLightCell, OVERLAPS, LAYERS,
  type Occupancy,
} from "../lib/world/occupancy";
import { navBlocked, oneSolidPerPanel } from "../lib/world/policy";
import { footprintPanels, footprintCells, panelOfSubcell, panelAt } from "../lib/world/grid";
import { creatureSize, sizeClassOf } from "../lib/world/creatures";
import { objectDef, type Instance, type ObjectDef } from "../lib/world/objects";
import { WALK_V } from "../lib/world/version";
import { placementSvg } from "../lib/world/placementView";

// Phase 2b-2 stage A (docs/world-spec.md §8, the user, 2026-11-08): runs
// placed at world version 4 (new runs from stage A until stage B made them v5;
// built here as newWalkRun built them then). Things take their own footprints in named
// occupancy layers; things whose footprints don't meet may share a panel;
// clearances are kept; candles keep today's spots, at subcell level; bodies
// are checked for room. The panel rules for walking and the generator's "one
// solid thing a panel" are temporary policies (lib/world/policy.ts).
// Version 3's tests are tests/place.test.ts and tests/placeV3.test.ts, as they were.

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const quiet = <T>(f: () => T): T => { const warn = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = warn; } };
const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const made = (dungeon: 0 | 1, seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon, false, false); // (rooms as rolled before people wandered: a v4 run)
// A v4 run as it was made new: placed by v4's rules, once.
const v4Run = (r: DungeonRun): DungeonRun => {
  const walk = { ...r.walk!, v: 4 };
  return { ...r, walk: { ...walk, placed: placeWalk(walk, r.map, dungeonOf(r), (id) => walkRoom(r, id)).placed } };
};
const cache = new Map<string, DungeonRun>();
const rolled = (dungeon: 0 | 1, seed: number) => {
  const k = `${dungeon}:${seed}`;
  if (!cache.has(k)) cache.set(k, v4Run(made(dungeon, seed)));
  return structuredClone(cache.get(k)!);
};
const roomOf = (run: DungeonRun) => (id: string) => walkRoom(run, id);
const placedOf = (run: DungeonRun): Placed => placeWalk(run.walk!, run.map, dungeonOf(run), roomOf(run));
const asV3 = (run: DungeonRun): DungeonRun => ({ ...run, walk: { ...run.walk!, v: FIRST_PLACED_V } });
const here = (run: DungeonRun) => run.path[run.path.length - 1];
const withRoom = (run: DungeonRun, id: string, f: (r: Room) => Room): DungeonRun =>
  id === here(run) ? { ...run, current: f(run.current!) } : { ...run, walk: { ...run.walk!, rooms: { ...run.walk!.rooms, [id]: f(run.walk!.rooms[id]) } } };
const fightRooms = (run: DungeonRun) => roomIds(run.walk!.layout, run.map).filter((id) => { const r = walkRoom(run, id); return !!r && hasFight(r) && !r.done; });
const panelOf = (i: Instance): Pt => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) });
const isFloorThing = (i: Instance) => objectDef(i.def).attach === "floor" && i.def !== "foe" && i.def !== "witch";
const STEPS: Pt[] = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];

// Everything stage A promises of one new run, as lines (collected, checked once).
function problems(name: string, run: DungeonRun): string[] {
  const out: string[] = [];
  const bad = (s: string) => out.push(`${name}: ${s}`);
  const walk = run.walk!, plan = layoutFloorplan(walk.layout), room = roomOf(run), dungeon = dungeonOf(run);
  const { placed, report, occupancy: o } = placedOf(run);
  if (walk.v !== 4) bad(`saved as v${walk.v}`);
  if (JSON.stringify(walk.placed) !== JSON.stringify(placed)) bad("saved placements aren't what the placer makes");
  for (const p of report.problems) bad(`placer: ${p.id} ${p.what}`);
  for (const p of report.moved) bad(`moved: ${p.id} ${p.what}`);
  const problem = placedProblem(walk.placed, 4);
  if (problem) bad(problem);
  if (migrateWalkRun(run).outcome !== "unchanged") bad(`opened: ${migrateWalkRun(run).outcome}`);
  // Physical: no two things on a subcell (campfires included), each on the floor at the size it was placed with, clearances kept.
  const cells = new Map<string, string>();
  const things = placed.filter(isFloorThing);
  for (const i of things) {
    const d = objectDef(i.def);
    if (i.legacy) bad(`${i.id} has a legacy mark`);
    if (JSON.stringify(i.size) !== JSON.stringify(d.footprint)) bad(`${i.id} placed with ${JSON.stringify(i.size)}`);
    for (const c of footprintCells(i, i.size!)) {
      const k = `${c.sx},${c.sy}`;
      if (cells.has(k)) bad(`${i.id} on ${cells.get(k)}'s subcell`);
      cells.set(k, i.id);
    }
    for (const p of footprintPanels(i, i.size!)) if (plan.tiles[p.y * plan.w + p.x] !== 1) bad(`${i.id} off the floor`);
  }
  for (const f of walk.fires ?? []) for (const c of footprintCells({ sx: f.x * 3, sy: f.y * 3 }, objectDef("campfire").footprint)) {
    if (cells.has(`${c.sx},${c.sy}`)) bad(`${cells.get(`${c.sx},${c.sy}`)} on a campfire`);
    cells.set(`${c.sx},${c.sy}`, `campfire:${f.room}`);
  }
  for (const i of things) for (const c of clearanceCells(objectDef(i.def), i, i.size!)) {
    const who = cells.get(`${c.sx},${c.sy}`);
    if (who && who !== i.id) bad(`${who} in ${i.id}'s clearance`);
  }
  // The temporary policy: a solid thing inside one panel, alone in it.
  const solidIn = new Map<string, string>();
  for (const i of things) if (objectDef(i.def).collision === "solid") {
    const ps = footprintPanels(i, i.size!);
    if (ps.length > 1) bad(`${i.id} across a panel's edge`);
    if (solidIn.has(panelKey(ps[0]))) bad(`${i.id} in ${solidIn.get(panelKey(ps[0]))}'s panel`);
    solidIn.set(panelKey(ps[0]), i.id);
  }
  // Reservations: nothing in a doorway or on another's spot, nothing solid across a path; one thing a wall slot.
  for (const i of things) for (const p of footprintPanels(i, i.size!)) {
    const r = o.reserved.get(panelKey(p));
    if (r?.why === "door") bad(`${i.id} in a doorway`);
    if (r?.why === "point" && r.owner !== i.id) bad(`${i.id} on ${r.owner}'s spot`);
    if (r?.why === "path" && objectDef(i.def).collision === "solid") bad(`${i.id} across a path`);
  }
  const slots = new Set<string>();
  for (const i of placed) if (i.wall) {
    const k = slotKey(panelOf(i), i.wall);
    if (slots.has(k)) bad(`${i.id}: its slot twice`);
    slots.add(k);
  }
  for (const i of placed) if (i.def === "candle") for (const f of walk.fires ?? []) {
    if (Math.hypot(panelOf(i).x - f.x, panelOf(i).y - f.y) < CANDLE_FIRE_GAP) bad(`${i.id} by a campfire`);
  }
  // Access, as the walk screen builds the rooms: everything you use can be walked up to from its room's door.
  const ids = roomIds(walk.layout, run.map);
  const p = placementsOfWalk(walk, run.map, dungeon, room);
  const shown = thingsOf(walk.layout, p, ids, room, p.witches, walk.spots, dungeon);
  const solid = solidCells(shown, walk.fires ?? [], []);
  const can = (_: Pt, to: Pt) => !solid.has(`${to.x},${to.y}`);
  const doorOf = (id: string): Pt | null => {
    const floors = plan.rooms[parentOf(id)];
    for (const d of plan.doors) if (d.room === parentOf(id)) for (const s of STEPS) {
      const q = { x: d.x + s.x, y: d.y + s.y };
      if (floors.some((r) => q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h) && !solid.has(`${q.x},${q.y}`)) return q;
    }
    return null;
  };
  for (const t of shown) {
    if (t.inert) continue;
    const from = doorOf(t.room);
    if (from && !approach(plan, t, from, can)) bad(`${t.key} ${t.def}: can't be walked up to`);
  }
  // Navigation is today's: exactly the panels of solid things and fires are blocked (and a mini boss's or
  // boss's chest, solid since 2026-11-09: kept a spot, not placed as a thing).
  const chests = shown.filter((t) => t.def === "loot-chest").map((t) => panelKey({ x: panelAt(t.x), y: panelAt(t.y) }));
  const blockedByThings = new Set([...things.filter((i) => objectDef(i.def).collision === "solid").map((i) => panelKey(panelOf(i))), ...(walk.fires ?? []).map(panelKey), ...chests]);
  if ([...solid].sort().join() !== [...blockedByThings].sort().join()) bad("walking's blocked panels aren't the solid things' panels");
  // Foes and the witch: reachable, on nothing, clear of the doors, with room for their bodies.
  for (const f of [...p.foes, ...p.witches]) {
    const at = { x: f.x, y: f.y }, from = doorOf(f.room);
    if (solid.has(panelKey(at)) || cells.has(`${at.x * 3},${at.y * 3}`)) bad(`${f.room} foe ${f.index} on something`);
    if (!from || !findPath(plan, from, at, can)) bad(`${f.room} foe ${f.index} where you can't get`);
    if (!f.waits && plan.doors.some((d) => d.room === parentOf(f.room) && Math.hypot(d.x - f.x, d.y - f.y) < DOOR_CLEAR)) bad(`${f.room} foe ${f.index} by a door`);
    const r = room(f.room), species = f.waits ? r?.boss ?? r?.enemies?.[0]?.creatureId : r?.enemies?.[f.index]?.creatureId;
    if (species && roomFor(o, at, creatureSize(species), SPAWN_CLEARANCE[sizeClassOf(species) ?? ""] ?? 0)) bad(`${f.room} foe ${f.index} (${species}): no room for its body`);
  }
  for (const id of fightRooms(run)) if (!p.foes.some((f) => f.room === id)) bad(`${id}: no foes`);
  for (const id of ids) {
    const r = room(id);
    if (r?.kind !== "library") continue;
    const want = r.librarian ? "librarian" : "stores";
    if (!placed.some((i) => i.id === `${id}:${want}`) || placed.some((i) => i.id === `${id}:${r.librarian ? "stores" : "librarian"}`)) bad(`${id}: not just its ${want} placed`);
  }
  for (const id of Object.keys(walk.layout.rooms)) {
    const reach = reachableIn(o, plan.rooms[id], id);
    let shut = 0;
    for (const r of plan.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!navBlocked(o, { x, y }) && !reach.has(`${x},${y}`)) shut++;
    if (shut > 6) bad(`${id}: ${shut} panels walled off`);
  }
  return out;
}

// A small room to try the layers in: a floorplan of one 9 × 7 room, its door at the bottom middle.
function testRoom(): { fp: Floorplan; o: Occupancy; p: Pt } {
  const w = 11, h = 10, tiles = new Uint8Array(w * h);
  for (let y = 1; y < 8; y++) for (let x = 1; x < 10; x++) tiles[y * w + x] = 1;
  tiles[8 * w + 5] = 3;
  tiles[3 * w + 7] = 0; // a pillar
  const fp: Floorplan = { w, h, tiles, rooms: { r: [{ x: 1, y: 1, w: 9, h: 7 }] }, doors: [{ x: 5, y: 8, room: "r", link: "t" }], tunnels: { t: [{ x: 5, y: 8 }] } };
  const o = newOccupancy(fp);
  markStone(o, { x: 7, y: 3 });
  return { fp, o, p: { x: 3, y: 3 } };
}
const at = (p: Pt, dx = 0, dy = 0) => ({ sx: p.x * 3 + dx, sy: p.y * 3 + dy });
const trigger: ObjectDef = { ...objectDef("candle"), id: "plate", kind: "prop", occupies: "trigger" };
const hanging: ObjectDef = { ...objectDef("candle"), id: "lamp", kind: "prop", occupies: "overhead" };

describe("runs placed at world version 4 (2b-2 stage A)", () => {
  it("a v4 run is saved at v4, once, with sound placements", () => {
    const run = rolled(0, 21);
    expect(run.walk!.v).toBe(4);
    expect(WALK_V).toBe(PLACED_V);
    expect(quiet(() => newWalkRun(run))).toEqual(run);
  });
  it("rolled runs keep every promise (subcells, clearances, the policy, doors, paths, access, foes and their bodies)", () => {
    const bad = [0, 1].flatMap((d) => problems(`dungeon ${d}`, rolled(d as 0 | 1, 21)));
    expect(bad).toEqual([]);
  });
  slowIt("…over 300 rooms and more in each dungeon", () => {
    const bad: string[] = [];
    for (const d of [0, 1] as const) {
      let rooms = 0;
      for (let s = 100; rooms < 300; s++) {
        const run = v4Run(made(d, s));
        rooms += Object.keys(run.walk!.layout.rooms).length;
        bad.push(...problems(`dungeon ${d} seed ${s}`, run));
      }
    }
    expect(bad).toEqual([]);
  }, 600_000);

  it("is deterministic, survives save, export and reload, and beating rooms moves nobody", () => {
    for (const d of [0, 1] as const) {
      const run = rolled(d, 22);
      expect(v4Run(made(d, 22)).walk!.placed).toEqual(run.walk!.placed);
      expect(json(run)).toEqual(run);
      expect(migrateWalkRun(json(run)).outcome).toBe("unchanged");
      const beaten = fightRooms(run).filter((_, i) => i % 2 === 0).reduce((r, id) => withRoom(r, id, (x) => ({ ...x, done: true })), run);
      expect(migrateWalkRun(beaten).run).toBe(beaten);
      expect(placedOf(beaten).placed).toEqual(run.walk!.placed);
      const before = placementsOfWalk(run.walk!, run.map, dungeonOf(run), roomOf(run)).foes;
      for (const f of foeStarts(placementsOfWalk(beaten.walk!, beaten.map, dungeonOf(beaten), roomOf(beaten)), roomIds(beaten.walk!.layout, beaten.map), roomOf(beaten))) {
        expect(before.find((b) => b.room === f.room && b.index === f.index)).toEqual(f);
      }
    }
  });
  it("wall torches keep their ids and lit state through a reload", () => {
    const run = rolled(1, 23);
    const torches = run.walk!.placed!.filter((i) => i.def.startsWith("sconce"));
    const lit = [torches.find((t) => !t.start)!.id];
    const a = placementsFrom(run.walk!.placed!, { ...run.walk!, lit }), b = placementsFrom(json(run).walk!.placed!, json({ ...run.walk!, lit }));
    expect(b.sconces).toEqual(a.sconces);
    for (const t of torches) expect(a.sconces.find((s) => s.id === t.id)!.lit).toBe(t.start === "lit" || lit.includes(t.id));
  });
  it("a damaged v4 run is held, and mended into the run as made; a v3 run is still placed and mended by its own rules", () => {
    const run = rolled(1, 21);
    const broken = { ...run, walk: { ...run.walk!, placed: [] as Instance[] } };
    expect(quiet(() => migrateWalkRun(broken)).outcome).toBe("damaged");
    expect(canRecover(broken)).toBe(true);
    const mended = quiet(() => recoverWalkRun(broken));
    expect(mended.run.walk!.v).toBe(4);
    expect(mended.run.walk!.placed).toEqual(run.walk!.placed);
    const v3 = asV3(run), v3placed = placedOf(v3).placed;
    for (const i of v3placed) expect(i.sx % 3 === 0 && i.sy % 3 === 0, i.id).toBe(true);
    expect(quiet(() => recoverWalkRun({ ...v3, walk: { ...v3.walk!, placed: [] as Instance[] } })).run.walk!.placed).toEqual(v3placed);
  });
  it("a thing off its panel's middle stands at its footprint's middle, and walking reads the panel it's in", () => {
    // A sack in a corner of its panel (storage leans to a wall).
    for (let s = 21; s < 40; s++) {
      const run = rolled(1, s), sack = run.walk!.placed!.find((i) => i.def === "sack" && (i.sx % 3 || i.sy % 3));
      if (!sack) continue;
      const spot = placementsFrom(run.walk!.placed!, run.walk!).spot(sack.id)!;
      const cells = footprintCells(sack, sack.size!);
      expect(spot.x).toBeCloseTo((Math.min(...cells.map((c) => c.sx)) + Math.max(...cells.map((c) => c.sx))) / 6);
      expect({ x: panelAt(spot.x), y: panelAt(spot.y) }).toEqual(panelOf(sack));
      return;
    }
    throw new Error("no sack off its panel's middle in these runs");
  });
});

describe("the occupancy layers (world-spec §8 2b-2: named layers, each with its overlaps)", () => {
  it("allows the overlaps it should: triggers under anything on the floor, overhead over it, things side by side in one panel", () => {
    const { o, p } = testRoom();
    const sack = objectDef("sack"), candle = objectDef("candle"), pots = objectDef("pots");
    take(o, sack, at(p), "sack");
    // A candle in the same panel, beside the sack.
    expect(canPlace(o, candle, at(p, 1, 1), "candle")).toBeNull();
    take(o, candle, at(p, 1, 1), "candle");
    // A trigger under the sack, and under the candle; overhead over both.
    expect(canPlace(o, trigger, at(p), "plate")).toBeNull();
    expect(canPlace(o, trigger, at(p, 1, 1), "plate2")).toBeNull();
    expect(canPlace(o, hanging, at(p), "lamp")).toBeNull();
    // A walk-over thing across a panel's edge, where it meets nothing.
    expect(canPlace(o, pots, at({ x: p.x + 1, y: p.y }, 2, 0), "pots")).toBeNull();
    expect(footprintPanels(at({ x: p.x + 1, y: p.y }, 2, 0), pots.footprint).length).toBe(2);
    // The table is symmetric, and nothing shares stone.
    for (const a of LAYERS) for (const b of OVERLAPS[a]) expect(OVERLAPS[b], `${a}/${b}`).toContain(a);
    expect(OVERLAPS.structure).toEqual([]);
  });
  it("refuses the overlaps it should, saying why", () => {
    const { o, p } = testRoom();
    const sack = objectDef("sack"), candle = objectDef("candle"), chest = objectDef("chest"), pool = objectDef("pool");
    take(o, sack, at(p), "sack");
    take(o, candle, at(p, 1, 1), "candle");
    take(o, trigger, at(p, 1, 0), "plate");
    expect(canPlace(o, sack, at(p, 1, 0), "sack2")).toBe("on sack");                // blocking on blocking
    expect(canPlace(o, candle, at(p, -1, -1), "candle2")).toBe("on sack");          // walk-over on blocking
    expect(canPlace(o, candle, at(p, 1, 1), "candle3")).toBe("on candle");          // walk-over on walk-over
    expect(canPlace(o, trigger, at(p, 1, 0), "plate2")).toBe("on plate");           // a trigger on a trigger
    expect(canPlace(o, candle, at({ x: 7, y: 3 }), "candle4")).toMatch(/^off the floor|^on pillar/); // on stone
    expect(canPlace(o, candle, at({ x: 0, y: 0 }), "candle5")).toMatch(/^off the floor/);
    // Clearances: a chest's front row is kept; a pool keeps a ring round it.
    const c = { x: 3, y: 6 };
    take(o, chest, at(c), "chest");
    expect(canPlace(o, candle, at(c, 0, 1), "candle6")).toBe("in chest's clearance");
    expect(canPlace(o, pool, at({ x: 5, y: 3 }), "pool")).toBeNull();
    take(o, pool, at({ x: 5, y: 3 }), "pool");
    expect(canPlace(o, candle, at({ x: 4, y: 3 }, 1, 0), "candle7")).toBe("in pool's clearance");
    expect(canPlace(o, sack, at({ x: 6, y: 4 }), "sack3")).toBe("in pool's clearance");
    // Reservations: a doorway, and a spot kept for someone else.
    reserve(o, { x: 5, y: 7 }, "door");
    expect(canPlace(o, candle, at({ x: 5, y: 7 }), "candle8")).toBe("in a doorway");
    reserve(o, { x: 8, y: 6 }, "point", "r:chest");
    expect(canPlace(o, candle, at({ x: 8, y: 6 }), "candle9")).toBe("on the spot kept for r:chest");
  });
  it("a floor candle shares a panel with a sack: no overlap, and walking is blocked by the sack alone", () => {
    const { o, p } = testRoom(), sack = objectDef("sack"), candle = objectDef("candle");
    take(o, sack, at(p), "sack");
    expect(navBlocked(o, p)).toBe(true);
    take(o, candle, at(p, 1, 1), "candle");
    const sackCells = new Set(footprintCells(at(p), sack.footprint).map((c) => `${c.sx},${c.sy}`));
    expect(sackCells.has(`${p.x * 3 + 1},${p.y * 3 + 1}`)).toBe(false);
    // A candle alone never blocks a panel.
    const lone = testRoom();
    take(lone.o, candle, at(lone.p, 1, 1), "candle");
    expect(navBlocked(lone.o, lone.p)).toBe(false);
    // Beside a chest: the chest fills its panel's back two rows and keeps the front row clear,
    // so a candle stands in the next panel, which stays walkable.
    const c = testRoom(), chest = objectDef("chest");
    take(c.o, chest, at(c.p), "chest");
    expect(canPlace(c.o, candle, at(c.p, 0, 1), "candle")).toBe("in chest's clearance");
    expect(canPlace(c.o, candle, at({ x: c.p.x + 1, y: c.p.y }, -1, 0), "candle")).toBeNull();
    take(c.o, candle, at({ x: c.p.x + 1, y: c.p.y }, -1, 0), "candle");
    expect(navBlocked(c.o, { x: c.p.x + 1, y: c.p.y })).toBe(false);
  });
  it("the map holds several solid things in a panel and one across panels; only the policy refuses them", () => {
    const { o, p } = testRoom(), sack = objectDef("sack"), barrels = objectDef("barrels");
    take(o, sack, at(p), "sack");
    const second = at(p, 2, 0);
    expect(canPlace(o, sack, second, "sack2")).toBeNull();
    expect(footprintPanels(second, sack.footprint).length).toBe(2);
    expect(oneSolidPerPanel(o, sack, second, sack.footprint)).toMatch(/edge/);
    expect(oneSolidPerPanel(o, sack, at(p, 1, 1), sack.footprint)).toMatch(/second solid/);
    expect(canPlace(o, barrels, at({ x: 4, y: 5 }, 2, 0), "barrels")).toBeNull();
    expect(oneSolidPerPanel(o, barrels, at({ x: 4, y: 5 }, 2, 0), barrels.footprint)).toMatch(/edge/);
  });
  it("keeps the panel policies out of the occupancy map", () => {
    const src = (f: string) => fs.readFileSync(path.join(__dirname, "..", "lib", "world", f), "utf8");
    const occ = src("occupancy.ts");
    expect(occ).not.toMatch(/from "\.\/policy"/);
    for (const name of ["navBlocked", "canStand", "oneSolidPerPanel", "PanelClaims", "claimedBy"]) expect(occ, name).not.toMatch(new RegExp(`export (function|const|type) ${name}\\b`));
    const pol = src("policy.ts");
    for (const name of ["navBlocked", "canStand", "oneSolidPerPanel", "claimedBy"]) expect(pol, name).toMatch(new RegExp(`export (function|const) ${name}\\b`));
    expect(src("place.ts")).toMatch(/from "\.\/policy"/);
  });
});

describe("attachment slots on structure's faces (walls now; pillars ready for stage B)", () => {
  it("finds slots on walls and on pillars' faces, each with its place on the face and the floor subcell its light starts in", () => {
    const { fp } = testRoom();
    const slots = attachmentSlots(fp);
    const pillar = slots.filter((s) => s.kind === "pillar");
    // The pillar at 7,3 has four faces onto floor, three slots each.
    expect(pillar.length).toBe(12);
    expect(new Set(pillar.map((s) => s.wall))).toEqual(new Set(["north", "south", "east", "west"]));
    for (const s of slots) {
      const q = slotPoint(s), cell = slotLightCell(s);
      // On the face: half way between the stone's middle and the floor's.
      expect(Math.abs(q.x - (s.floor.x + s.rock.x) / 2) <= 1 / 3 + 1e-9 && Math.abs(q.y - (s.floor.y + s.rock.y) / 2) <= 1 / 3 + 1e-9, s.key).toBe(true);
      // Its light starts on its floor panel, in the subcell against the face.
      expect({ x: panelOfSubcell(cell.sx), y: panelOfSubcell(cell.sy) }, s.key).toEqual(s.floor);
    }
    expect(new Set(slots.map((s) => s.key)).size).toBe(slots.length);
  });
  it("every wall torch in a new run is in a wall slot of the run's own, one to a slot", () => {
    const run = rolled(1, 21), all = new Map(attachmentSlots(layoutFloorplan(run.walk!.layout)).map((s) => [s.key, s]));
    const torches = run.walk!.placed!.filter((i) => i.wall);
    expect(torches.length).toBeGreaterThan(0);
    for (const t of torches) expect(all.get(slotKey(panelOf(t), t.wall!))?.kind, t.id).toBe("wall");
  });
});

// What version 4 changes against version 3's rules on the same runs (the user
// asked: do things share panels, do counts or access change). Printed.
function simV4(runs: number) {
  const lines: string[] = [];
  for (const d of [0, 1] as const) {
    const t = { rooms: 0, candles: 0, candles3: 0, torches: 0, torches3: 0, foes: 0, foes3: 0, things: 0, things3: 0, blocked: 0, blocked3: 0, shared: 0, offMiddle: 0, rejected: 0, omitted: 0, problems: 0 };
    for (let s = 500; s < 500 + runs; s++) {
      const run = v4Run(made(d, s)), walk = run.walk!;
      const v4 = placedOf(run), v3 = placedOf(asV3(run));
      t.rooms += Object.keys(walk.layout.rooms).length;
      const count = (l: Instance[], f: (i: Instance) => boolean) => l.filter(f).length;
      t.candles += count(v4.placed, (i) => i.def === "candle"); t.candles3 += count(v3.placed, (i) => i.def === "candle");
      t.torches += count(v4.placed, (i) => !!i.wall); t.torches3 += count(v3.placed, (i) => !!i.wall);
      t.foes += count(v4.placed, (i) => i.def === "foe"); t.foes3 += count(v3.placed, (i) => i.def === "foe");
      t.things += count(v4.placed, isFloorThing); t.things3 += count(v3.placed, isFloorThing);
      const blocked = (l: Instance[]) => new Set([...l.filter((i) => isFloorThing(i) && objectDef(i.def).collision === "solid").map((i) => panelKey(panelOf(i))), ...(walk.fires ?? []).map(panelKey)]).size;
      t.blocked += blocked(v4.placed); t.blocked3 += blocked(v3.placed);
      const per = new Map<string, number>();
      for (const i of v4.placed) if (isFloorThing(i)) per.set(panelKey(panelOf(i)), (per.get(panelKey(panelOf(i))) ?? 0) + 1);
      t.shared += [...per.values()].filter((n) => n > 1).length;
      t.offMiddle += count(v4.placed, (i) => isFloorThing(i) && (i.sx % 3 !== 0 || i.sy % 3 !== 0));
      t.rejected += v4.report.rejected.length; t.omitted += v4.report.omitted.length; t.problems += v4.report.problems.length + v4.report.moved.length;
    }
    lines.push(`dungeon ${d}: ${runs} runs, ${t.rooms} rooms. Floor things ${t.things} (v3 ${t.things3}); candles ${t.candles} (v3 ${t.candles3}), ${t.omitted} left out; wall torches ${t.torches} (v3 ${t.torches3}); foes ${t.foes} (v3 ${t.foes3}). ` +
      `Panels blocked to walking ${t.blocked} (v3 ${t.blocked3}). Panels two things share: ${t.shared}. Things off their panel's middle: ${t.offMiddle}. Spots tried and refused: ${t.rejected}. Problems or moves: ${t.problems}.`);
    expect(t.problems).toBe(0);
    expect(t.things).toBe(t.things3);
    expect(t.foes).toBe(t.foes3);
    expect(t.torches).toBe(t.torches3);
    expect(t.blocked).toBeLessThanOrEqual(t.blocked3);
  }
  console.log(lines.join("\n"));
}
slowIt("the v4 sim: what changes against v3's rules (40 runs a dungeon)", () => simV4(40), 900_000);
stressIt("the v4 sim, 200 runs a dungeon (stress)", () => simV4(200), 3_600_000);

describe("the placement debugging view (app/lab/placement)", () => {
  it("draws a room's grid, layers, slots, things and refusals; PLACEMENT_SVG=<folder> writes examples", () => {
    const dir = process.env.PLACEMENT_SVG;
    for (const [d, s] of [[0, 21], [1, 21]] as const) {
      const run = rolled(d, s), placed = placedOf(run);
      for (const id of Object.keys(run.walk!.layout.rooms).sort()) {
        const v = placementSvg(run.walk!, placed, id, roomOf(run));
        expect(v.svg.startsWith("<svg")).toBe(true);
        expect(v.svg.endsWith("</svg>")).toBe(true);
        expect(v.svg).toContain("slot");
        if (dir) fs.writeFileSync(path.join(dir, `d${d}-s${s}-${id}-${run.map.nodes[id]?.kind}.svg`), v.svg);
      }
    }
  });
});
