import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { migrateWalkRun, placedProblem, placementsOfWalk, canRecover, recoverWalkRun, openWalkSave, recoverWalkSave, WALK_V } from "../lib/world/migrate";
import { unsupportedRun } from "../lib/world/version";
import { walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun, type DungeonSave } from "../lib/dungeon/run";
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

describe("migrating a run (v0 → v2)", () => {
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
  it("a v1 run with any of them is damaged: the same object back, never made again on its own", () => {
    for (const [what, placed] of broken) {
      const run = { ...v1(), walk: { ...v1().walk!, placed: placed as never } };
      expect(placedProblem(placed), what).not.toBeNull();
      const m = migrateWalkRun(run);
      expect(m.outcome, what).toBe("damaged");
      expect(m.problem, what).toBeTruthy();
      expect(m.run, what).toBe(run);
    }
  });
  it("a v0 run carrying placements is damaged too (a legacy run never has them)", () => {
    const run = { ...fixture("encampment-fresh"), walk: { ...fixture("encampment-fresh").walk!, placed: [] } };
    const m = migrateWalkRun(run);
    expect(m.outcome).toBe("damaged");
    expect(m.run).toBe(run);
  });
  it("mended only when asked: the same placements as first made, what you've done kept", () => {
    for (const [what, placed] of broken) {
      const run = { ...v1(), walk: { ...v1().walk!, placed: placed as never } };
      expect(canRecover(run), what).toBe(true);
      const warn = console.warn;
      console.warn = () => {};
      let m;
      try { m = recoverWalkRun(run); } finally { console.warn = warn; }
      expect(m.outcome, what).toBe("repaired");
      expect(m.run.walk!.placed, what).toEqual(good());
      expect(without(m.run), what).toEqual(without(run));
      expect(migrateWalkRun(m.run).outcome, what).toBe("unchanged");
    }
  });
  it("nothing else can be mended: a sound run, a v0 run, a newer one", () => {
    expect(canRecover(v1())).toBe(false);
    expect(canRecover(fixture("encampment-fresh"))).toBe(false);
    expect(canRecover({ ...v1(), walk: { ...v1().walk!, v: WALK_V + 1, placed: [] as never } })).toBe(false);
    expect(canRecover(null)).toBe(false);
  });
  it("the walk screen never builds rooms from them: it makes them again for the visit, and says so", () => {
    const run = v1(), room = (id: string) => walkRoom(run, id);
    const sound = placementsOfWalk(run.walk!, run.map, dungeonOf(run), room);
    const warn = console.warn;
    const said: string[] = [];
    console.warn = (s: string) => { said.push(s); };
    try {
      const again = placementsOfWalk({ ...run.walk!, placed: [] }, run.map, dungeonOf(run), room);
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

describe("opening the Labyrinth's save (openWalkSave)", () => {
  const meta = { runs: 2, clears: 0, injuries: {}, bag: [] };
  const opened = (run: DungeonRun) => {
    const wrote: DungeonSave[] = [];
    const warn = console.warn;
    console.warn = () => {};
    try { return { save: openWalkSave({ meta, run }, (s) => wrote.push(s)), wrote }; } finally { console.warn = warn; }
  };
  it("a legacy run is migrated and written back once; opening it again writes nothing", () => {
    const first = opened(fixture("cyclops-mid"));
    expect(first.wrote).toHaveLength(1);
    expect(first.save.run!.walk!.v).toBe(WALK_V);
    expect(first.wrote[0]).toEqual(first.save);
    const again = opened(json(first.save.run!));
    expect(again.wrote).toHaveLength(0);
    expect(again.save.held).toBeUndefined();
  });
  it("a damaged modern run is held as it is, written nowhere, and mended only by recoverWalkSave", () => {
    const sound = migrateWalkRun(fixture("encampment-mid")).run;
    const bad = { ...sound, walk: { ...sound.walk!, placed: [{ id: "x" }] as never } };
    const { save, wrote } = opened(bad);
    expect(save.held).toBe("damaged");
    expect(save.run).toBe(bad);
    expect(wrote).toHaveLength(0);
    const mendWrote: DungeonSave[] = [];
    const warn = console.warn;
    console.warn = () => {};
    let mended: DungeonSave;
    try { mended = recoverWalkSave(save, (s) => mendWrote.push(s)); } finally { console.warn = warn; }
    expect(mended.held).toBeUndefined();
    expect(mended.run!.walk!.placed).toEqual(sound.walk!.placed);
    expect(mendWrote).toEqual([mended]);
  });
});

describe("one way in (world-spec §7: the migration boundary)", () => {
  // Source files that run the game (not tests or lib/world itself).
  const ROOT = path.join(__dirname, "..");
  const files = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name).replace(/\\/g, "/")] : []);
  const game = () => ["lib", "components", "app", "hooks"].flatMap(files).filter((f) => !f.startsWith("lib/world/"));
  const ALLOWED: Record<string, string[]> = {
    migrateWalkRun: [],
    recoverWalkRun: [],
    openWalkSave: ["app/dungeon/page.tsx"],
    recoverWalkSave: ["app/dungeon/page.tsx"],
    placedRun: ["app/dungeon/page.tsx", "app/lab/baseline/BaselineScenes.tsx", "app/lab/newrun/page.tsx"],
    placementsOfWalk: ["components/WalkView.tsx"],
  };
  it("the migration is reached only through its named doors", () => {
    const bad: string[] = [];
    for (const f of game()) {
      const imports = fs.readFileSync(path.join(ROOT, f), "utf8").match(/^import[^;]*;/gm)?.join("\n") ?? "";
      for (const [name, ok] of Object.entries(ALLOWED)) if (new RegExp(`\\b${name}\\b`).test(imports) && !ok.includes(f)) bad.push(`${f} imports ${name}`);
    }
    expect(bad).toEqual([]);
  });
  it("nothing outside lib/world reads a run's saved placements itself", () => {
    // (a property read like walk.placed or walk!.placed; not a spread of a list called placed)
    const bad = game().filter((f) => /[\w)\]!?]\.placed\b/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(bad).toEqual([]);
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
