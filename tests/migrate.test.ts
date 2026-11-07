import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { migrateWalkRun, placedProblem, placementsOfWalk, WALK_V } from "../lib/world/migrate";
import { unsupportedRun } from "../lib/world/version";
import { walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { exportSave, importSave, checkSaveFile, SAVE_PARTS, type KeyValueStore } from "../lib/saveFile";

// Migrating a walkable run to saved placements (docs/world-spec.md §7, §8
// phase 2a): idempotent, never touching run state, never reading broken or
// missing placements as an empty list, and leaving newer runs alone.

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) as DungeonRun] as const);
const fixture = (name: string) => structuredClone(fixtures.find(([n]) => n === name)![1]);
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
// The run with what migration may add taken out again.
const without = (run: DungeonRun) => { const walk = { ...run.walk! }; delete walk.v; delete walk.placed; return { ...run, walk }; };

describe("migrating a run (v0 → v1)", () => {
  it("every fixture is a v0 run, migrated once, with nothing but `v` and `placed` added", () => {
    for (const [name, run0] of fixtures) {
      const before = json(run0);
      expect(run0.walk!.v, name).toBeUndefined();
      const m = migrateWalkRun(run0);
      expect(m.outcome, name).toBe("migrated");
      expect(m.run.walk!.v).toBe(WALK_V);
      expect(placedProblem(m.run.walk!.placed), name).toBeNull();
      expect(json(without(m.run)), name).toEqual(before); // run state, rooms, everything else: untouched
      expect(json(run0), name).toEqual(before); // and the run it was given isn't changed
    }
  });

  it("is idempotent: again, after a JSON round trip, after load → save → load", () => {
    for (const [name, run0] of fixtures) {
      const once = migrateWalkRun(run0).run;
      const twice = migrateWalkRun(once);
      expect(twice.outcome, name).toBe("unchanged");
      expect(twice.run, name).toBe(once); // the same object: nothing made again
      const reloaded = migrateWalkRun(json(once));
      expect(reloaded.outcome, name).toBe("unchanged");
      expect(json(reloaded.run), name).toEqual(json(once));
      expect(json(migrateWalkRun(json(reloaded.run)).run), name).toEqual(json(once));
    }
  });

  it("keeps run state as it is: lit torches, beaten rooms, where you stand", () => {
    const run = fixture("encampment-mid");
    const lit = ["start:0", "candle:start", "no-such-torch"];
    const m = migrateWalkRun({ ...run, walk: { ...run.walk!, lit, at: { x: 5, y: 9 } } }).run;
    expect(m.walk!.lit).toEqual(lit);
    expect(m.walk!.at).toEqual({ x: 5, y: 9 });
    expect(m.walk!.rooms).toEqual(run.walk!.rooms);
    expect(m.current).toEqual(run.current);
  });

  it("a Cyclops run with no `dungeon` field migrates as the Cyclops's", () => {
    for (const name of ["cyclops-fresh", "cyclops-mid"]) {
      const run = fixture(name);
      expect("dungeon" in run, name).toBe(false);
      expect(dungeonOf(run)).toBe(1);
      const m = migrateWalkRun(run);
      expect(m.outcome).toBe("migrated");
      expect("dungeon" in m.run).toBe(false);
      // Exactly what the same run marked as the Cyclops's gets.
      expect(m.run.walk!.placed).toEqual(migrateWalkRun({ ...run, dungeon: 1 }).run.walk!.placed);
    }
  });

  it("isn't a walkable run: nothing to do", () => {
    const run = { ...fixture("encampment-fresh"), walk: undefined } as DungeonRun;
    expect(migrateWalkRun(run)).toEqual({ run, outcome: "none" });
  });
});

describe("missing or broken placements are said, never read as empty", () => {
  const v1 = () => migrateWalkRun(fixture("encampment-mid")).run;
  const good = () => v1().walk!.placed!;
  const broken: [string, unknown][] = [
    ["missing", undefined],
    ["an empty list", []],
    ["not a list", { 0: good()[0] }],
    ["an entry that isn't an object", [...good(), 7]],
    ["an id twice", [...good(), good()[0]]],
    ["no id", [{ ...good()[0], id: "" }, ...good().slice(1)]],
    ["an unknown definition", [{ ...good()[0], def: "dragon" }, ...good().slice(1)]],
    ["half a subcell", [{ ...good()[0], sx: 9.5 }, ...good().slice(1)]],
    ["a subcell as text", [{ ...good()[0], sy: "12" }, ...good().slice(1)]],
    ["an unknown wall", [{ ...good()[0], wall: "south" }, ...good().slice(1)]],
    ["an unknown turn", [{ ...good()[0], rot: 4 }, ...good().slice(1)]],
    ["an unknown legacy rule", [{ ...good()[0], legacy: "row" }, ...good().slice(1)]],
  ];
  it("a v1 run with any of them is repaired: its placements made again, the same as first made", () => {
    for (const [what, placed] of broken) {
      const run = { ...v1(), walk: { ...v1().walk!, placed: placed as never } };
      expect(placedProblem(placed), what).not.toBeNull();
      const m = migrateWalkRun(run);
      expect(m.outcome, what).toBe("repaired");
      expect(m.problem, what).toBeTruthy();
      expect(m.run.walk!.placed, what).toEqual(good());
    }
  });
  it("a v0 run carrying placements is repaired too (they're not trusted)", () => {
    const run = fixture("encampment-fresh");
    const m = migrateWalkRun({ ...run, walk: { ...run.walk!, placed: [] } });
    expect(m.outcome).toBe("repaired");
    expect(m.run.walk!.placed!.length).toBeGreaterThan(0);
  });
  it("the walk screen never builds rooms from them: it makes them again for the visit, and says so", () => {
    const run = v1(), room = (id: string) => walkRoom(run, id);
    const sound = placementsOfWalk(run.walk!, run.map, room);
    const warn = console.warn;
    const said: string[] = [];
    console.warn = (s: string) => { said.push(s); };
    try {
      const again = placementsOfWalk({ ...run.walk!, placed: [] }, run.map, room);
      expect(again.sconces).toEqual(sound.sconces);
      expect(again.candles).toEqual(sound.candles);
      expect(again.witches).toEqual(sound.witches);
    } finally { console.warn = warn; }
    expect(said.length).toBe(1);
  });
  it("placements that can't be made (a broken layout) leave the run as it is: damaged", () => {
    const run = fixture("encampment-fresh");
    const bad = { ...run, walk: { ...run.walk!, layout: null as never } } as DungeonRun;
    const m = migrateWalkRun(bad);
    expect(m.outcome).toBe("damaged");
    expect(m.run).toBe(bad);
  });
});

describe("a run from a newer world version is left exactly as it is", () => {
  it("v2, or a version that isn't one: unsupported, the same object back", () => {
    for (const v of [WALK_V + 1, 99, "1", 1.5, -1, null]) {
      const run = { ...fixture("encampment-mid"), walk: { ...fixture("encampment-mid").walk!, v: v as never, placed: [{ id: "x" }] as never } };
      expect(unsupportedRun(run), String(v)).toBe(true);
      const m = migrateWalkRun(run);
      expect(m.outcome, String(v)).toBe("unsupported");
      expect(m.run, String(v)).toBe(run);
    }
    expect(unsupportedRun(fixture("encampment-mid"))).toBe(false);
    expect(unsupportedRun(migrateWalkRun(fixture("encampment-mid")).run)).toBe(false);
  });
});

describe("saves and save files", () => {
  const store = (init: Record<string, string>): KeyValueStore & { map: Map<string, string> } => {
    const map = new Map(Object.entries(init));
    return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
  };
  const saveWith = (run: DungeonRun) => JSON.stringify({ gold: 1, inventory: [], labyrinth: { meta: { runs: 1, clears: 0, injuries: {}, bag: [] }, run } });

  it("a v1 run survives export and import unchanged, and stays migrated", () => {
    const run = migrateWalkRun(fixture("encampment-mid")).run;
    const file = exportSave(store({ [SAVE_PARTS.progress]: saveWith(run), [SAVE_PARTS.registry]: "{}", [SAVE_PARTS.battles]: "[]" }));
    const checked = checkSaveFile(JSON.stringify(file));
    expect(checked.ok).toBe(true);
    const into = store({});
    expect(importSave(into, file).ok).toBe(true);
    const back = JSON.parse(into.map.get(SAVE_PARTS.progress)!).labyrinth.run as DungeonRun;
    expect(back).toEqual(json(run));
    expect(migrateWalkRun(back).outcome).toBe("unchanged");
  });
  it("a v0 run in an exported file imports as it was, and migrates when it's opened", () => {
    const run = fixture("cyclops-mid");
    const file = exportSave(store({ [SAVE_PARTS.progress]: saveWith(run), [SAVE_PARTS.registry]: "{}", [SAVE_PARTS.battles]: "[]" }));
    const into = store({});
    importSave(into, file);
    const back = JSON.parse(into.map.get(SAVE_PARTS.progress)!).labyrinth.run as DungeonRun;
    expect(back).toEqual(json(run));
    expect(json(migrateWalkRun(back).run)).toEqual(json(migrateWalkRun(run).run));
  });
});
