import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { placeLightsBefore, placeWitchesBefore, thingsOfBefore } from "./placementsBefore";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { hasFight, dungeonOf, fightContainer, type Cage, type DungeonRun, type Room } from "../lib/dungeon/run";
import { roomIds, thingsOf, solidCells } from "../lib/world/walkWorld";
import { migrateWalkRun } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { OBJECTS, type Instance } from "../lib/world/objects";
import { panelOfSubcell, placeInPanel } from "../lib/world/grid";

// Phase 2a (docs/world-spec.md §8): what's generated in a walkable run is
// saved in it, and the rooms built from what's saved are exactly what the
// walk screen placed before (tests/placementsBefore.ts, its old lines), in
// every state a run can be in after its placements were made.

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const GOLDEN = path.join(__dirname, "golden", "walk");
const UPDATE = process.env.UPDATE_GOLDEN === "1";
const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) as DungeonRun] as const);

const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const rolled = (dungeon: 0 | 1, seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon);

// Every room changed as play changes it (the one you're in, and the rest).
function eachRoom(run: DungeonRun, f: (r: Room, n: number) => Room): DungeonRun {
  const w = run.walk!;
  const ids = Object.keys(w.rooms).sort();
  const rooms = Object.fromEntries(ids.map((id, n) => [id, f(w.rooms[id], n)]));
  return { ...run, current: run.current ? f(run.current, ids.length) : run.current, walk: { ...w, rooms } };
}
// The run in the states play can leave it in, after its placements were made.
function states(run: DungeonRun, placed: Instance[]): [string, DungeonRun][] {
  const ids = placed.filter((i) => i.def === "sconce" || i.def === "sconce-side" || i.def === "candle").map((i) => i.id);
  const beaten = (r: Room, n: number, every: number): Room => (n % every !== 0 ? r : {
    ...r, done: true, opened: n % 2 === 0, ...(hasFight(r) ? { container: n % 3 === 0 ? "chest" : "sack" } : {}),
    ...(r.cages ? { cages: r.cages.map((c, i) => ({ ...c, opened: i % 2 === 0 })) } : {}),
  } as Room);
  const lit = (r: DungeonRun, share: number) => ({ ...r, walk: { ...r.walk!, lit: ids.filter((_, i) => i % share === 0) } });
  return [
    ["as saved", run],
    ["every light lit", lit(run, 1)],
    ["some rooms beaten, some lights lit", lit(eachRoom(run, (r, n) => beaten(r, n, 2)), 3)],
    ["every room beaten", eachRoom(run, (r, n) => beaten(r, n, 1))],
  ];
}

// The rooms built both ways; what differs, as lines.
function differences(name: string, run0: DungeonRun): string[] {
  const m = migrateWalkRun(run0);
  if (m.outcome !== "migrated") return [`${name}: ${m.outcome} ${m.problem ?? ""}`];
  const placed = m.run.walk!.placed!;
  const out: string[] = [];
  for (const [state, run] of states(run0, placed)) {
    const walk = run.walk!, plan = layoutFloorplan(walk.layout), room = (id: string) => walkRoom(run, id);
    const ids = roomIds(walk.layout, run.map);
    const before = { ...placeLightsBefore(walk, plan), witches: placeWitchesBefore(walk, plan, run.map, room) };
    const now = placementsFrom(placed, walk);
    // (A mini boss's or boss's chest, there to guard from the start, came after phase 2a: those rooms' loot is left out.)
    const guarded = (t: { room: string; def: string }) => /^loot-/.test(t.def) && fightContainer(room(t.room)!, dungeonOf(run)) !== "sack";
    const thingsBefore = thingsOfBefore(walk.layout, plan, ids, room, before.witches, walk.spots).filter((t) => !guarded(t));
    // (And a camp's cages guarded till its foes are beaten, the user, 2026-11-09: compared without that flag.)
    const thingsNow = thingsOf(walk.layout, now, ids, room, now.witches, walk.spots, dungeonOf(run)).filter((t) => !guarded(t))
      .map(({ guarded: g, ...t }) => (t.cage !== undefined || !g ? t : { ...t, guarded: g }));
    const same = (what: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${name}, ${state}: ${what} differ`); };
    same("wall torches", now.sconces, before.sconces);
    same("candles", now.candles, before.candles);
    same("the witch", now.witches, before.witches);
    same("things to tap", thingsNow, thingsBefore);
    same("solid cells", [...solidCells(thingsNow, walk.fires ?? [], [])].sort(), [...solidCells(thingsBefore, walk.fires ?? [], [])].sort());
  }
  return out;
}

describe("phase 2a: saved placements build the same rooms (world-spec §8)", () => {
  it("each fixture, in every state: torches, candles, the witch, things to tap, solid cells", () => {
    expect(fixtures.flatMap(([name, run]) => differences(name, run))).toEqual([]);
  });

  // (50 each: rolling a run takes most of a second, and 300 each took 8 minutes.)
  slowIt("50 rolled runs in each walkable dungeon, in every state", () => {
    const bad: string[] = [];
    for (const dungeon of [0, 1] as const) for (let seed = 1; seed <= 50; seed++) bad.push(...differences(`dungeon ${dungeon} seed ${seed}`, rolled(dungeon, seed * 7919)));
    expect(bad).toEqual([]);
  }, 600_000);

  it("a few rolled runs too (the quick suite)", () => {
    const bad: string[] = [];
    for (const dungeon of [0, 1] as const) for (let seed = 1; seed <= 5; seed++) bad.push(...differences(`dungeon ${dungeon} seed ${seed}`, rolled(dungeon, seed * 7919)));
    expect(bad).toEqual([]);
  });
});

describe("what's saved, and how (world-spec §3, §7)", () => {
  // Every fixture's placements, and a spread of rolled ones.
  const all = (): [string, Instance[]][] => [
    ...fixtures.map(([name, run]) => [name, migrateWalkRun(run).run.walk!.placed!] as [string, Instance[]]),
    ...[0, 1].flatMap((d) => [11, 12, 13].map((s) => [`dungeon ${d} seed ${s}`, migrateWalkRun(rolled(d as 0 | 1, s)).run.walk!.placed!] as [string, Instance[]])),
  ];

  it("ids are unique and stable, anchors whole subcells at a panel's centre, legacy marked", () => {
    const bad: string[] = [];
    for (const [name, placed] of all()) {
      const ids = placed.map((i) => i.id);
      if (new Set(ids).size !== ids.length) bad.push(`${name}: an id twice`);
      for (const i of placed) {
        if (!Number.isInteger(i.sx) || !Number.isInteger(i.sy)) bad.push(`${name} ${i.id}: not whole subcells`);
        if (placeInPanel(i.sx) !== 0 || placeInPanel(i.sy) !== 0) bad.push(`${name} ${i.id}: not a panel's middle subcell`);
        if (i.legacy !== "panel") bad.push(`${name} ${i.id}: not marked legacy`);
        if (!OBJECTS[i.def]) bad.push(`${name} ${i.id}: unknown definition`);
      }
    }
    expect(bad).toEqual([]);
    // Made again, the same list.
    for (const [name, run] of fixtures) expect(migrateWalkRun(run).run.walk!.placed, name).toEqual(migrateWalkRun(run).run.walk!.placed);
  });

  it("wall things take no floor and say their wall; walk-over things never block; only solid definitions block", () => {
    const bad: string[] = [];
    for (const [name, run] of fixtures) {
      const m = migrateWalkRun(run).run, walk = m.walk!;
      for (const i of walk.placed!) {
        const d = OBJECTS[i.def];
        const onWall = d.attach.startsWith("wall");
        if (onWall !== (i.wall !== undefined)) bad.push(`${name} ${i.id}: wall ${i.wall} on a ${d.attach} thing`);
        if (onWall && (d.footprint.w !== 0 || d.footprint.d !== 0)) bad.push(`${name} ${i.def}: a wall thing with a floor footprint`);
      }
      // What blocks walking: exactly the things to tap whose definitions are solid (and campfires).
      const placed = placementsFrom(walk.placed!, walk), room = (id: string) => walkRoom(m, id);
      const things = thingsOf(walk.layout, placed, roomIds(walk.layout, m.map), room, placed.witches, walk.spots, dungeonOf(m));
      const solid = solidCells(things, [], []);
      for (const c of [...placed.sconces, ...placed.candles]) if (solid.has(`${c.x},${c.y}`) && !things.some((t) => t.solid && t.x === c.x && t.y === c.y)) bad.push(`${name} ${c.id}: blocks a panel`);
      for (const t of things) if (t.solid !== (OBJECTS[t.def].collision === "solid")) bad.push(`${name} ${t.key}: solid ${t.solid} for ${t.def}`);
    }
    expect(bad).toEqual([]);
  });

  it("each fixture's placements, pinned (tests/golden/walk/*.placed.json)", () => {
    for (const [name, run] of fixtures) {
      const file = path.join(GOLDEN, `${name}.placed.json`);
      const placed = migrateWalkRun(run).run.walk!.placed;
      // (Written the first time; after that only for a change the user has approved: UPDATE_GOLDEN=1.)
      if (UPDATE || !fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(placed, null, 1) + "\n");
      expect(placed, name).toEqual(JSON.parse(fs.readFileSync(file, "utf8")));
    }
  });

  it("a panel's things sit in it: anchors convert back to the panel they came from", () => {
    for (const [, placed] of all()) for (const i of placed) {
      expect(panelOfSubcell(i.sx) * 3).toBe(i.sx);
      expect(panelOfSubcell(i.sy) * 3).toBe(i.sy);
    }
  });
});

describe("today's placers are called from one place (world-spec §7: the isolated converter)", () => {
  // Source files that run the game (not tests), and the placer names only the converter may use.
  const ROOT = path.join(__dirname, "..");
  const files = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name).replace(/\\/g, "/")] : []);
  const ALLOWED: Record<string, string[]> = {
    // The old placers live on only as frozen copies (compat/v0Placers.ts) for the
    // converter, and for /lab/walk: the old walking test bed, a dev tool on
    // made-up layouts, never a saved run. New runs: lib/world/place.ts.
    placeSconces: ["lib/world/compat/v0.ts", "app/lab/walk/page.tsx"],
    placeCandles: ["lib/world/compat/v0.ts"],
    cageSpots: ["lib/world/compat/v0.ts"],
    legacyPlacements: ["lib/world/compat/v0.ts", "lib/world/migrate.ts"],
    // (The foe fix, phase 2a′: foes' starts are saved too.)
    placeFoes: ["lib/world/compat/v0.ts", "app/lab/walk/page.tsx"],
    placeWaiter: ["lib/world/compat/v0.ts"],
    legacyFoePlacements: ["lib/world/compat/v0.ts", "lib/world/migrate.ts"],
    v0Placers: ["lib/world/compat/v0.ts", "app/lab/walk/page.tsx"],
  };
  it("nothing else in the game imports them", () => {
    const bad: string[] = [];
    for (const f of ["lib", "components", "app", "hooks"].flatMap(files)) {
      const src = fs.readFileSync(path.join(ROOT, f), "utf8");
      const imports = src.match(/^import[^;]*;/gm)?.join("\n") ?? "";
      for (const [name, ok] of Object.entries(ALLOWED)) if (new RegExp(`\\b${name}\\b`).test(imports) && !ok.includes(f)) bad.push(`${f} imports ${name}`);
    }
    expect(bad).toEqual([]);
  });
});
