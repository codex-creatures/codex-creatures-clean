import { describe, expect, it } from "vitest";
import { slowIt, stressIt } from "./slow";
import { seeded } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { hasFight, dungeonOf, type Cage, type DungeonRun, type Room } from "../lib/dungeon/run";
import { DOOR_CLEAR, parentOf } from "../lib/dungeon/foes";
import { findPath } from "../lib/dungeon/walk";
import type { Pt } from "../lib/dungeon/floorplan";
import { roomIds, thingsOf, solidCells, approach, foeStarts } from "../lib/world/walkWorld";
import { newWalkRun, migrateWalkRun, placementsOfWalk, placedProblem, canRecover, recoverWalkRun, LEGACY_WALK_V } from "../lib/world/migrate";
// (These are world version 3's tests, kept as they were: since 2b-2 stage A a new run is placed at
// version 4 (tests/placeV4.test.ts), so the runs here are made at version 3 on purpose: newV3.)
import { placeWalk, passRng, reachableIn, FIRST_PLACED_V as PLACED_V, CANDLE_FIRE_GAP, type Placed } from "../lib/world/place";
import { legacyPlacements } from "../lib/world/compat/v0";
import { placementsFrom } from "../lib/world/placements";
import { panelKey } from "../lib/world/occupancy";
import { navBlocked } from "../lib/world/policy";
import { footprintPanels, panelOfSubcell } from "../lib/world/grid";
import { objectDef, type Instance } from "../lib/world/objects";
import { WALK_V, unsupportedRun } from "../lib/world/version";

// Phase 2b-1 (docs/world-spec.md §8, signed off by the user 2026-11-08): new
// runs are placed by lib/world/place.ts, as world version 3, every floor thing
// still on its own panel. Runs from before keep what they had (their tests:
// migrate, placements, foeStarts and the goldens, all unchanged).

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const quiet = <T>(f: () => T): T => { const warn = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = warn; } };
const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const made = (dungeon: 0 | 1, seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon, false, false); // (rooms as rolled before people wandered: a v3 run)
// A new run as 2b-1 made it: placed by version 3's rules, saved at version 3.
const newV3 = (run: DungeonRun): DungeonRun => {
  const walk = { ...run.walk!, v: PLACED_V };
  return { ...run, walk: { ...walk, placed: placeWalk(walk, run.map, dungeonOf(run), (id) => walkRoom(run, id)).placed } };
};
const cache = new Map<string, DungeonRun>();
const rolled = (dungeon: 0 | 1, seed: number) => {
  const k = `${dungeon}:${seed}`;
  if (!cache.has(k)) cache.set(k, newV3(made(dungeon, seed)));
  return structuredClone(cache.get(k)!);
};
const roomOf = (run: DungeonRun) => (id: string) => walkRoom(run, id);
const placedOf = (run: DungeonRun): Placed => placeWalk(run.walk!, run.map, dungeonOf(run), roomOf(run));
const here = (run: DungeonRun) => run.path[run.path.length - 1];
const withRoom = (run: DungeonRun, id: string, f: (r: Room) => Room): DungeonRun =>
  id === here(run) ? { ...run, current: f(run.current!) } : { ...run, walk: { ...run.walk!, rooms: { ...run.walk!.rooms, [id]: f(run.walk!.rooms[id]) } } };
const fightRooms = (run: DungeonRun) => roomIds(run.walk!.layout, run.map).filter((id) => { const r = walkRoom(run, id); return !!r && hasFight(r) && !r.done; });
const panelOf = (i: Instance): Pt => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) });

// Everything 2b-1 promises of one new run, as lines (collected, checked once).
function problems(name: string, run: DungeonRun): string[] {
  const out: string[] = [];
  const bad = (s: string) => out.push(`${name}: ${s}`);
  const walk = run.walk!, plan = layoutFloorplan(walk.layout), room = roomOf(run), dungeon = dungeonOf(run);
  const { placed, report, occupancy: o } = placedOf(run);
  if (walk.v !== PLACED_V) bad(`saved as v${walk.v}`);
  if (JSON.stringify(walk.placed) !== JSON.stringify(placed)) bad("saved placements aren't what the placer makes");
  for (const p of report.problems) bad(`placer: ${p.id} ${p.what}`);
  for (const p of report.moved) bad(`moved: ${p.id} ${p.what}`);
  const problem = placedProblem(walk.placed, PLACED_V);
  if (problem) bad(problem);
  if (migrateWalkRun(run).outcome !== "unchanged") bad(`opened: ${migrateWalkRun(run).outcome}`);
  // No legacy marks; floor things carry the size they were placed with.
  for (const i of placed) {
    const d = objectDef(i.def);
    if (i.legacy) bad(`${i.id} has a legacy mark`);
    if (d.attach === "floor" && d.kind !== "creature" && d.kind !== "npc" || i.def === "merchant" || i.def === "librarian") {
      if (JSON.stringify(i.size) !== JSON.stringify(d.footprint)) bad(`${i.id} placed with ${JSON.stringify(i.size)}`);
    }
  }
  // One floor thing a panel, all on the floor; one thing a wall slot; nothing in a doorway, and nothing solid across a path.
  const panels = new Map<string, string>(), slots = new Set<string>();
  for (const i of placed) {
    const d = objectDef(i.def);
    if (d.attach === "floor" && i.def !== "foe" && i.def !== "witch") {
      for (const p of footprintPanels(i, i.size ?? d.footprint)) {
        if (panels.has(panelKey(p))) bad(`${i.id} on ${panels.get(panelKey(p))}'s panel`);
        panels.set(panelKey(p), i.id);
        if (plan.tiles[p.y * plan.w + p.x] !== 1) bad(`${i.id} off the floor`);
        const r = o.reserved.get(panelKey(p));
        if (r?.why === "door") bad(`${i.id} in a doorway`);
        if (r?.why === "point" && r.owner !== i.id) bad(`${i.id} on ${r.owner}'s spot`);
        if (r?.why === "path" && d.collision === "solid") bad(`${i.id} across a path`);
      }
    } else if (i.wall) {
      const k = `${i.sx},${i.sy},${i.wall}`;
      if (slots.has(k)) bad(`${i.id}: its wall slot twice`);
      slots.add(k);
    }
  }
  // Candles keep away from campfires.
  for (const i of placed) if (i.def === "candle") for (const f of walk.fires ?? []) {
    const p = panelOf(i);
    if (Math.hypot(p.x - f.x, p.y - f.y) < CANDLE_FIRE_GAP) bad(`${i.id} by a campfire`);
  }
  // The things you use, as the walk screen builds them: each one you can walk up to and use, from its room's door.
  const ids = roomIds(walk.layout, run.map);
  const p = placementsOfWalk(walk, run.map, dungeon, room);
  const things = thingsOf(walk.layout, p, ids, room, p.witches, walk.spots, dungeon);
  const solid = solidCells(things, walk.fires ?? [], []);
  const can = (_: Pt, to: Pt) => !solid.has(`${to.x},${to.y}`);
  const doorOf = (id: string): Pt | null => {
    const floors = plan.rooms[parentOf(id)];
    for (const d of plan.doors) if (d.room === parentOf(id)) for (const s of [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
      const q = { x: d.x + s.x, y: d.y + s.y };
      if (floors.some((r) => q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h) && !solid.has(`${q.x},${q.y}`)) return q;
    }
    return null;
  };
  for (const t of things) {
    if (t.inert) continue;
    const from = doorOf(t.room);
    if (from && !approach(plan, t, from, can)) bad(`${t.key} ${t.def}: can't be walked up to`);
  }
  // Foes, the witch: each where you can get to it, nowhere solid or taken, clear of the doors (a waiting boss at its stand).
  const taken = new Set(placed.filter((i) => i.def !== "foe" && i.def !== "witch" && objectDef(i.def).attach === "floor").map((i) => panelKey(panelOf(i))));
  for (const f of [...p.foes, ...p.witches]) {
    const at = { x: f.x, y: f.y }, from = doorOf(f.room);
    if (solid.has(panelKey(at)) || taken.has(panelKey(at))) bad(`${f.room} foe ${f.index} on something`);
    if (!from || !findPath(plan, from, at, can)) bad(`${f.room} foe ${f.index} where you can't get`);
    if (!f.waits && plan.doors.some((d) => d.room === parentOf(f.room) && Math.hypot(d.x - f.x, d.y - f.y) < DOOR_CLEAR)) bad(`${f.room} foe ${f.index} by a door`);
  }
  // A library holds its librarian or codexes to find, never both, so the one placed is the one it shows.
  for (const id of ids) {
    const r = room(id);
    if (r?.kind !== "library") continue;
    if (!!r.librarian === !!r.sack) bad(`${id}: a library with ${r.librarian ? "both a librarian and codexes" : "neither a librarian nor codexes"}`);
    const want = r.librarian ? "librarian" : "stores";
    if (!placed.some((i) => i.id === `${id}:${want}`) || placed.some((i) => i.id === `${id}:${r.librarian ? "stores" : "librarian"}`)) bad(`${id}: not just its ${want} placed`);
  }
  // Every fight room has its foes; all ids unique (placedProblem), each foe's id its room's.
  for (const id of fightRooms(run)) if (!p.foes.some((f) => f.room === id)) bad(`${id}: no foes`);
  // No bigger pocket of floor walled off than the spec allows to pass unseen (flagged: 🧪 6 panels).
  for (const id of Object.keys(walk.layout.rooms)) {
    const reach = reachableIn(o, plan.rooms[id], id);
    let shut = 0;
    for (const r of plan.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!navBlocked(o, { x, y }) && !reach.has(`${x},${y}`)) shut++;
    if (shut > 6) bad(`${id}: ${shut} panels walled off`);
  }
  return out;
}

const SEEDS = [21, 22, 23, 24];

describe("new runs are placed by phase 2b's rules (world version 3)", () => {
  it("a new run is saved at v3, once, with sound placements", () => {
    const run = rolled(0, 21);
    expect(run.walk!.v).toBe(PLACED_V);
    expect(WALK_V).toBeGreaterThanOrEqual(PLACED_V);
    expect(run.walk!.placed!.length).toBeGreaterThan(0);
    // Placed once: making a new run of a run that has them changes nothing.
    expect(quiet(() => newWalkRun(run))).toEqual(run);
  });
  it("rolled runs keep every promise (doors, paths, access, nothing overlapping, foes where you can get)", () => {
    const bad = [0, 1].flatMap((d) => SEEDS.slice(0, 1).flatMap((s) => problems(`dungeon ${d} seed ${s}`, rolled(d as 0 | 1, s))));
    expect(bad).toEqual([]);
  });
  slowIt("…over 300 rooms and more in each dungeon", () => {
    const bad: string[] = [];
    for (const d of [0, 1] as const) {
      let rooms = 0;
      for (let s = 100; rooms < 300; s++) {
        const run = newV3(made(d, s));
        rooms += Object.keys(run.walk!.layout.rooms).length;
        bad.push(...problems(`dungeon ${d} seed ${s}`, run));
      }
    }
    expect(bad).toEqual([]);
  }, 600_000);

  it("is deterministic: the same run gives the same placements, and each room's pass its own numbers", () => {
    const run = rolled(1, 22);
    expect(placedOf(run).placed).toEqual(placedOf(structuredClone(run)).placed);
    expect(newV3(made(1, 22)).walk!.placed).toEqual(run.walk!.placed);
    const a = passRng(5, "r1", 7), b = passRng(5, "r1", 7), c = passRng(5, "r2", 7);
    const first = a();
    expect(b()).toBe(first);
    expect(c()).not.toBe(first);
  }, 120_000); // (new Cyclops runs take about 3 s each to roll, since its 60-room climb, 2026-11-11)

  it("keeps today's fixed spots: rooms' wall torches, features, stores and cages where the old rules put them", () => {
    for (const [d, s] of [[0, 21], [1, 23]] as const) {
      const run = rolled(d, s);
      const now = run.walk!.placed!, old = legacyPlacements(run.walk!, run.map, roomOf(run));
      const fixed = (list: Instance[]) => list
        .filter((i) => (i.def === "sconce" && run.walk!.layout.rooms[i.room]) || ["chest", "sack", "pool", "card-deck", "merchant", "librarian", "rickety-chest", "cage"].includes(i.def))
        .map((i) => `${i.id} ${i.def} ${i.sx},${i.sy}`).sort();
      // (The old rules also made a library's unused one of its librarian and its stores.)
      const shown = new Set(fixed(now).map((l) => l.split(" ")[0]));
      expect(fixed(now)).toEqual(fixed(old).filter((l) => shown.has(l.split(" ")[0])));
      expect(fixed(old).filter((l) => !shown.has(l.split(" ")[0])).every((l) => l.includes(":librarian ") || l.includes(":stores "))).toBe(true);
    }
  });

  it("beating rooms, or springing the ambush, moves nobody and changes nothing saved", () => {
    for (const d of [0, 1] as const) {
      const run = rolled(d, 24);
      const fights = fightRooms(run);
      const beaten = fights.filter((_, i) => i % 2 === 0).reduce((r, id) => withRoom(r, id, (x) => ({ ...x, done: true })), run);
      const sprung = Object.keys(beaten.walk!.rooms).reduce((r, id) => (r.walk!.rooms[id].variant === "ambush" ? withRoom(r, id, (x) => ({ ...x, sprung: true })) : r), beaten);
      const m = migrateWalkRun(sprung);
      expect(m.outcome).toBe("unchanged");
      expect(m.run).toBe(sprung);
      const before = placementsOfWalk(run.walk!, run.map, dungeonOf(run), roomOf(run)).foes;
      const after = foeStarts(placementsOfWalk(sprung.walk!, sprung.map, dungeonOf(sprung), roomOf(sprung)), roomIds(sprung.walk!.layout, sprung.map), roomOf(sprung));
      for (const f of after) expect(before.find((b) => b.room === f.room && b.index === f.index)).toEqual(f);
      // And the placer, run again on the changed run, gives exactly what was saved.
      expect(placedOf(sprung).placed).toEqual(run.walk!.placed);
    }
  });

  it("survives save, export, import and reload; wall torches keep their ids and lit state", () => {
    const run = rolled(0, 23);
    const back = json(run);
    expect(back).toEqual(run);
    expect(migrateWalkRun(back).outcome).toBe("unchanged");
    const torches = run.walk!.placed!.filter((i) => i.def.startsWith("sconce"));
    const lit = [torches.find((t) => !t.start)!.id];
    const p = placementsFrom(run.walk!.placed!, { ...run.walk!, lit });
    const q = placementsFrom(json(run).walk!.placed!, json({ ...run.walk!, lit }));
    expect(q.sconces).toEqual(p.sconces);
    for (const t of torches) expect(p.sconces.find((s) => s.id === t.id)!.lit).toBe(t.start === "lit" || lit.includes(t.id));
    // The entrance's torches start lit, as before.
    expect(torches.filter((t) => t.room === run.walk!.layout.start).every((t) => t.start === "lit")).toBe(true);
  });

  it("a damaged v3 run is held, and mended by the same rules into the run as made", () => {
    const run = rolled(1, 21);
    const broken = { ...run, walk: { ...run.walk!, placed: [] as Instance[] } };
    expect(quiet(() => migrateWalkRun(broken)).outcome).toBe("damaged");
    expect(canRecover(broken)).toBe(true);
    const mended = quiet(() => recoverWalkRun(broken));
    expect(mended.outcome).toBe("repaired");
    expect(mended.run.walk!.placed).toEqual(run.walk!.placed);
    expect(mended.run.walk!.v).toBe(PLACED_V);
  });

  it("versions: a v3 run is newer than a copy reading up to 2; a south wall or a placed size is refused below v3", () => {
    expect(unsupportedRun({ walk: { v: PLACED_V } })).toBe(false);
    expect(unsupportedRun({ walk: { v: WALK_V + 1 } })).toBe(true);
    expect(PLACED_V).toBeGreaterThan(LEGACY_WALK_V);
    const one = (extra: Partial<Instance>): Instance[] => [{ id: "r1:0", def: "sconce", room: "r1", sx: 3, sy: 3, ...extra }];
    expect(placedProblem(one({ wall: "south" }), PLACED_V)).toBeNull();
    expect(placedProblem(one({ wall: "south" }), LEGACY_WALK_V)).toMatch(/wall/);
    expect(placedProblem(one({ size: { w: 3, d: 2 } }), LEGACY_WALK_V)).toMatch(/size/);
    expect(placedProblem(one({ size: { w: 1.5, d: 2 } }), PLACED_V)).toMatch(/size/);
  });
});

// The sim the user asked for (the user, 2026-11-08): what's placed in new runs,
// against what the old rules placed in the same runs. Printed, and held to
// loose ranges of today's (the candles' rise is the approved change).
function simAgainstOld(runs: number) {
  type Tally = { runs: number; rooms: number; candles: number; candlesOld: number; candlesShownOld: number; omitted: number; moved: number; lit: number; litOld: number;
    torches: number; torchesOld: number; foes: number; foesOld: number; doorMin: number; gapMin: number; foesOnThings: number };
  const lines: string[] = [];
  for (const d of [0, 1] as const) {
    const t: Tally = { runs: 0, rooms: 0, candles: 0, candlesOld: 0, candlesShownOld: 0, omitted: 0, moved: 0, lit: 0, litOld: 0, torches: 0, torchesOld: 0, foes: 0, foesOld: 0, doorMin: Infinity, gapMin: Infinity, foesOnThings: 0 };
    for (let s = 500; s < 500 + runs; s++) {
      const run = newV3(made(d, s));
      const walk = run.walk!, plan = layoutFloorplan(walk.layout);
      const { placed, report } = placedOf(run);
      const old = quiet(() => migrateWalkRun({ ...run, walk: { ...walk, v: undefined, placed: undefined } })).run.walk!.placed!;
      t.runs++; t.rooms += Object.keys(walk.layout.rooms).length;
      t.omitted += report.omitted.length; t.moved += report.moved.length;
      const count = (l: Instance[], f: (i: Instance) => boolean) => l.filter(f).length;
      t.candles += count(placed, (i) => i.def === "candle");
      t.candlesOld += count(old, (i) => i.def === "candle");
      t.candlesShownOld += placementsFrom(old, walk).candles.length;
      t.torches += count(placed, (i) => i.def.startsWith("sconce")); t.torchesOld += count(old, (i) => i.def.startsWith("sconce"));
      t.lit += count(placed, (i) => i.def.startsWith("sconce") && i.start === "lit"); t.litOld += count(old, (i) => i.def.startsWith("sconce") && i.start === "lit");
      const foes = placed.filter((i) => i.def === "foe"), foesOld = old.filter((i) => i.def === "foe");
      t.foes += foes.length; t.foesOld += foesOld.length;
      const things = new Set(old.filter((i) => objectDef(i.def).attach === "floor" && i.def !== "foe" && i.def !== "witch").map((i) => panelKey(panelOf(i))));
      for (const f of [...(walk.fires ?? [])]) things.add(panelKey(f));
      t.foesOnThings += foesOld.filter((f) => things.has(panelKey(panelOf(f)))).length;
      for (const f of foes) {
        if (f.foe?.waits) continue;
        const at = panelOf(f);
        for (const dd of plan.doors) if (dd.room === parentOf(f.room)) t.doorMin = Math.min(t.doorMin, Math.hypot(dd.x - at.x, dd.y - at.y));
        for (const g of foes) if (g !== f && g.room === f.room) t.gapMin = Math.min(t.gapMin, Math.hypot(panelOf(g).x - at.x, panelOf(g).y - at.y));
      }
    }
    const per = (n: number) => (n / t.rooms).toFixed(3);
    lines.push(`dungeon ${d}: ${t.runs} runs, ${t.rooms} rooms. Candles a room: ${per(t.candles)} (old rules placed ${per(t.candlesOld)}, showed ${per(t.candlesShownOld)}; ${t.omitted} left out for want of a spot). ` +
      `Wall torches: ${per(t.torches)} (old ${per(t.torchesOld)}), lit at the start ${(t.lit / t.torches).toFixed(3)} (old ${(t.litOld / t.torchesOld).toFixed(3)}). ` +
      `Foes: ${t.foes} (old ${t.foesOld}); nearest a door ${t.doorMin.toFixed(2)}, closest two ${t.gapMin.toFixed(2)}; old rules' foes starting on a thing or a fire: ${t.foesOnThings}. Required things moved: ${t.moved}.`);
    expect(t.moved).toBe(0);
    expect(t.foes).toBe(t.foesOld);
    expect(t.doorMin).toBeGreaterThanOrEqual(DOOR_CLEAR);
    expect(Math.abs(t.torches - t.torchesOld) / t.torchesOld).toBeLessThan(0.15);
    expect(Math.abs(t.candles - t.candlesShownOld) / t.candlesShownOld).toBeLessThan(0.25);
  }
  console.log(lines.join("\n"));
}
slowIt("the sim: counts per room, against the old rules (40 runs a dungeon)", () => simAgainstOld(40), 900_000);
// …and the bigger one, as a stress test of its own: `npm run test:stress` (not part of test:all, to keep that within its time).
stressIt("the sim, 200 runs a dungeon (stress)", () => simAgainstOld(200), 3_600_000);

describe("a guarded storehouse (world version 11)", () => {
  // (The user, 2026-11-11: its guard keeps the storehouse's own chest. Before, the guard's chest
  // went in the room's middle, often on the storehouse's chest, with no way kept to it. This run's
  // large room is a guarded storehouse.)
  const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(2 * 7919 + 13), 1, false, false);
  const id = Object.keys(run.walk!.layout.rooms).find((k) => walkRoom(run, k)?.kind === "storehouse")!;
  const at = (v: number) => {
    const walk = { ...run.walk!, v }, p = placeWalk(walk, run.map, dungeonOf(run), (k) => walkRoom(run, k));
    return { p, placements: placementsFrom(p.placed, walk) };
  };
  it("has one chest, its own, guarded where it stands, with a way kept to it", () => {
    expect(hasFight(walkRoom(run, id)!)).toBe(true);
    const { p, placements } = at(WALK_V);
    expect(p.report.problems).toEqual([]);
    const chests = thingsOf(run.walk!.layout, placements, [id], (k) => walkRoom(run, k), [], undefined, 1).filter((t) => t.def.includes("chest"));
    expect(chests).toHaveLength(1);
    expect(chests[0].guarded).toBe(true);
    expect({ x: chests[0].x, y: chests[0].y }).toEqual(placements.spot(`${id}:stores`));
  });
  it("version 10 keeps its own rule: the guard's chest in the middle", () => {
    expect(at(10).p.report.problems.map((q) => q.what)).toEqual([`no way to ${id}:loot`]);
  }, 60_000);
});
