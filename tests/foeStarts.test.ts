import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { seeded } from "./walkBaseline";
import { placeFoeStartsBefore } from "./foeStartsBefore";
import { startWalkRun, walkRoom, type WalkRun } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { hasFight, dungeonOf, type Cage, type DungeonRun, type DungeonSave, type Room } from "../lib/dungeon/run";
import { roomIds, foeStarts, foesToPlace } from "../lib/world/walkWorld";
import { migrateWalkRun, placementsOfWalk, canRecover, recoverWalkRun, openWalkSave, WALK_V } from "../lib/world/migrate";
import { legacyPlacements } from "../lib/world/compat/v0";
import type { Instance } from "../lib/world/objects";

// The foe fix (docs/world-spec.md §8 phase 2a′, the user, 2026-11-07): each
// fight room's foes' starts are saved in the run, so beating one room never
// moves anyone else. At the moment they're saved they're exactly what the
// walk screen used to work out (tests/foeStartsBefore.ts); after that they
// never change. Where foes wander to stays this visit's only.

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) as DungeonRun] as const);
const fixture = (name: string) => structuredClone(fixtures.find(([n]) => n === name)![1]);
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const quiet = <T>(f: () => T): T => { const warn = console.warn; console.warn = () => {}; try { return f(); } finally { console.warn = warn; } };

const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const rolled = (dungeon: 0 | 1, seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon);
const ROLLED = [0, 1].flatMap((d) => [11, 12, 13, 14, 15, 16].map((s) => [`dungeon ${d} seed ${s}`, d as 0 | 1, s] as const));

const here = (run: DungeonRun) => run.path[run.path.length - 1];
// The run with one room changed (the one you're in, or one of the rest).
function withRoom(run: DungeonRun, id: string, f: (r: Room) => Room): DungeonRun {
  if (id === here(run)) return { ...run, current: f(run.current!) };
  const w = run.walk!;
  return { ...run, walk: { ...w, rooms: { ...w.rooms, [id]: f(w.rooms[id]) } } };
}
const beat = (run: DungeonRun, id: string) => withRoom(run, id, (r) => ({ ...r, done: true }));
const ids = (run: DungeonRun) => roomIds(run.walk!.layout, run.map);
const roomOf = (run: DungeonRun) => (id: string) => walkRoom(run, id);
const toBeat = (run: DungeonRun) => ids(run).filter((id) => { const r = walkRoom(run, id); return !!r && hasFight(r) && !r.done; });

// The foes the walk screen starts with, as it builds them (WalkView).
function built(run: DungeonRun) {
  const walk = run.walk!, room = roomOf(run);
  return foeStarts(placementsOfWalk(walk, run.map, dungeonOf(run), room), ids(run), room);
}
// …and as it worked them out before the fix.
const before = (run: DungeonRun) => placeFoeStartsBefore(run.walk!, layoutFloorplan(run.walk!.layout), run.map, dungeonOf(run), roomOf(run));
// A v1 run (phase 2a): placements saved, foes not.
const asV1 = (run: DungeonRun): DungeonRun => ({ ...run, walk: { ...run.walk!, v: 1, placed: legacyPlacements(run.walk!, run.map, roomOf(run)) } });
// Half the fight rooms beaten (every other one).
const halfBeaten = (run: DungeonRun) => toBeat(run).filter((_, i) => i % 2 === 0).reduce(beat, run);

// Foes as text to compare (keys in order; an endless wait as null either way).
const key = (foes: object[]) => JSON.stringify(foes.map((f) => Object.fromEntries(Object.entries(f).sort())));

// What the foe fix promises for one run, as lines (collected, checked once).
function problems(name: string, run0: DungeonRun): string[] {
  const out: string[] = [];
  for (const [state, run] of [["as saved", run0], ["half its fights beaten", halfBeaten(run0)]] as const) {
    for (const [how, start] of [["v0", run], ["v1", asV1(run)]] as const) {
      const m = migrateWalkRun(start);
      if (m.outcome !== "migrated") { out.push(`${name} ${state} ${how}: ${m.outcome} ${m.problem ?? ""}`); continue; }
      // 1. Saved, they're exactly what the walk screen showed at that moment.
      if (key(built(m.run)) !== key(before(m.run))) out.push(`${name} ${state} ${how}: saved starts aren't today's`);
      // 2. Beating any one room moves nobody else, and changes nothing saved.
      const now = built(m.run);
      for (const id of toBeat(m.run)) {
        const after = beat(m.run, id), again = migrateWalkRun(after);
        if (again.outcome !== "unchanged" || again.run !== after) out.push(`${name} ${state} ${how}: beating ${id} migrated the run again`);
        if (key(built(after)) !== key(now.filter((f) => f.room !== id))) out.push(`${name} ${state} ${how}: beating ${id} moved someone else`);
      }
    }
  }
  return out;
}

describe("foes keep their starting spots (the foe fix, world-spec §8 phase 2a′)", () => {
  it("each fixture: saved as the game showed them, and beating any one room moves nobody else", () => {
    expect(fixtures.flatMap(([name, run]) => problems(name, run))).toEqual([]);
  });

  slowIt("rolled runs in both dungeons: the same", () => {
    expect(ROLLED.flatMap(([name, d, s]) => problems(name, rolled(d, s)))).toEqual([]);
  });

  it("before the fix, beating a room did move the others (what it fixes)", () => {
    let moved = 0;
    for (const [, run0] of fixtures) {
      const run = migrateWalkRun(run0).run, now = before(run);
      for (const id of toBeat(run)) {
        const after = before(beat(run, id));
        moved += now.filter((f) => f.room !== id && !after.some((g) => g.room === f.room && g.index === f.index && g.x === f.x && g.y === f.y)).length;
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("every fight room still to beat has its foes saved, each with a stable id; a waiting boss is :foe:0", () => {
    for (const [name, run0] of fixtures) {
      const run = migrateWalkRun(run0).run, placed = run.walk!.placed!;
      for (const id of ids(run)) {
        const r = walkRoom(run, id)!, mine = placed.filter((i) => i.def === "foe" && i.room === id);
        expect(mine.length, `${name} ${id}`).toBe(r ? foesToPlace(r, dungeonOf(run)) : 0);
        expect(mine.map((i) => i.id), `${name} ${id}`).toEqual(mine.map((_, n) => `${id}:foe:${n}`));
        for (const i of mine) if (i.foe!.waits) expect(i.id).toBe(`${id}:foe:0`);
      }
    }
  });

  it("a JSON round trip changes nothing (a waiting boss's endless wait isn't saved as a number)", () => {
    for (const [name, run0] of fixtures) {
      const run = migrateWalkRun(run0).run, back = json(run);
      expect(migrateWalkRun(back).outcome, name).toBe("unchanged");
      expect(built(back), name).toEqual(built(run));
    }
    const cyclops = migrateWalkRun(fixture("cyclops-fresh")).run;
    expect(built(json(cyclops)).filter((f) => f.waits).every((f) => f.wait === Infinity)).toBe(true);
  });

  it("an ambush's foes are saved before it springs, and springing it moves nobody else", () => {
    // (The Cyclops fixture's camp, made an ambush not yet sprung.)
    const camp = "r16";
    const run = migrateWalkRun(withRoom(fixture("cyclops-fresh"), camp, (r) => ({ ...r, variant: "ambush" }))).run;
    const now = built(run), placed = run.walk!.placed!, count = walkRoom(run, camp)!.enemies!.length;
    expect(now.some((f) => f.room === camp)).toBe(false); // lurking: none to see yet
    expect(key(now)).toBe(key(before(run))); // the rest as the game showed them
    expect(placed.filter((i) => i.def === "foe" && i.room === camp).length).toBe(count);
    const sprung = withRoom(run, camp, (r) => ({ ...r, sprung: true }));
    expect(migrateWalkRun(sprung).outcome).toBe("unchanged");
    const after = built(sprung);
    expect(after.filter((f) => f.room !== camp)).toEqual(now);
    expect(after.filter((f) => f.room === camp).length).toBe(count);
  });
});

describe("migrating a v1 run (v1 → v2)", () => {
  const meta = { runs: 2, clears: 0, injuries: {}, bag: [] };
  it("adds only the foes: its other placements and run state untouched, written back once", () => {
    for (const [name, run0] of fixtures) {
      const v1 = asV1(halfBeaten(run0)), copy = json(v1);
      const m = migrateWalkRun(v1);
      expect(m.outcome, name).toBe("migrated");
      expect(m.run.walk!.v, name).toBe(WALK_V);
      const placed = m.run.walk!.placed!, old = v1.walk!.placed!;
      expect(placed.slice(0, old.length), name).toEqual(old);
      expect(placed.slice(old.length).every((i) => i.def === "foe"), name).toBe(true);
      const rest = (r: DungeonRun) => { const walk: Partial<WalkRun> = { ...r.walk! }; delete walk.v; delete walk.placed; return { ...r, walk }; };
      expect(json(rest(m.run)), name).toEqual(rest(copy));
      expect(json(v1), name).toEqual(copy); // the run it was given isn't changed
      // Opened: written back once; opened again, nothing more.
      const wrote: DungeonSave[] = [];
      const first = quiet(() => openWalkSave({ meta, run: v1 }, (s) => wrote.push(s)));
      expect(wrote, name).toHaveLength(1);
      quiet(() => openWalkSave(json(first), (s) => wrote.push(s)));
      expect(wrote, name).toHaveLength(1);
    }
  });
});

describe("missing or broken foe starts are said, never read as no foes", () => {
  const good = () => migrateWalkRun(fixture("encampment-mid")).run;
  const foeAt = (placed: Instance[]) => placed.findIndex((i) => i.def === "foe" && !i.foe!.waits);
  const edit = (f: (p: Instance[]) => Instance[]): DungeonRun => { const r = good(); return { ...r, walk: { ...r.walk!, placed: f(structuredClone(r.walk!.placed!)) } }; };
  const at = (p: Instance[], change: Record<string, unknown>) => p.map((i, n) => (n === foeAt(p) ? { ...i, ...change } as Instance : i));
  const broken: [string, DungeonRun][] = [
    ["a room's foe missing", edit((p) => p.filter((_, n) => n !== foeAt(p)))],
    ["a foe with no start", edit((p) => at(p, { foe: undefined }))],
    ["walks as text", edit((p) => at(p, { foe: { walks: "yes", wait: 1 } }))],
    ["a wait that isn't a number (an endless one through JSON)", edit((p) => at(p, { foe: { wait: null } }))],
    ["an unknown end", edit((p) => at(p, { foe: { wait: 1, end: 2 } }))],
    ["an id that isn't <room>:foe:<n>", edit((p) => at(p, { id: "nowhere:foe:x" }))],
    ["a foe's start on a chest", edit((p) => p.map((i) => (i.def === "chest" ? { ...i, foe: { wait: 1 } } : i)))],
  ];
  it("a v2 run with any of them is damaged: the same object back", () => {
    for (const [what, run] of broken) {
      const m = migrateWalkRun(run);
      expect(m.outcome, what).toBe("damaged");
      expect(m.problem, what).toBeTruthy();
      expect(m.run, what).toBe(run);
    }
  });
  it("mended only when asked: the same foes as first made, where no room's been beaten since", () => {
    for (const [what, run] of broken) {
      expect(canRecover(run), what).toBe(true);
      const m = quiet(() => recoverWalkRun(run));
      expect(m.outcome, what).toBe("repaired");
      expect(m.run.walk!.placed, what).toEqual(good().walk!.placed);
    }
  });
  it("a beaten room needs none: its foes' starts taken out, the run's still sound", () => {
    const run = good(), id = toBeat(run)[0];
    const after = beat(run, id);
    const less = { ...after, walk: { ...after.walk!, placed: after.walk!.placed!.filter((i) => !(i.def === "foe" && i.room === id)) } };
    expect(migrateWalkRun(less).outcome).toBe("unchanged");
  });
});
