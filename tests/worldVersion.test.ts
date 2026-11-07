import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadDungeon, saveDungeon, endRun, type DungeonRun } from "../lib/dungeon/run";
import { migrateWalkRun } from "../lib/world/migrate";
import { WALK_V } from "../lib/world/version";
import { SAVE_KEY } from "../lib/save";

// Forward compatibility (docs/world-spec.md §7): a run saved by a newer world
// version is never played, ended or written over by this copy of the game,
// whatever it saves; the rest of the save carries on as normal.

const fixture = (name: string): DungeonRun => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "walk", `${name}.json`), "utf8"));
const meta = { runs: 4, clears: 1, injuries: {}, bag: [] };
// A run from a later version: its walk says so, and it may hold things this copy doesn't know.
const newer = (): DungeonRun => {
  const run = migrateWalkRun(fixture("encampment-mid")).run;
  return { ...run, walk: { ...run.walk!, v: WALK_V + 1, placed: [{ id: "x", def: "future-thing" }] as never, future: { kept: true } } as never };
};

let store: Record<string, string> = {};
const g = globalThis as unknown as { window?: unknown };
let had: unknown;
beforeEach(() => {
  store = {};
  had = g.window;
  g.window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } };
});
afterEach(() => { g.window = had; });
const put = (run: DungeonRun | null) => { store[SAVE_KEY] = JSON.stringify({ gold: 7, labyrinth: { meta, run } }); };
const storedRun = () => JSON.parse(store[SAVE_KEY]).labyrinth.run;

describe("a run from a newer world version", () => {
  it("loads exactly as stored, marked held, and isn't ended for looking unfamiliar", () => {
    const run = { ...newer(), map: {} } as unknown as DungeonRun; // (a map this copy wouldn't recognise: still not ended)
    put(run);
    const lab = loadDungeon();
    expect(lab.held).toBe("newer");
    expect(lab.run).toEqual(JSON.parse(JSON.stringify(run)));
    expect(lab.meta.runs).toBe(4);
  });

  it("is never written over: not by saving it, ending it, or starting another run", () => {
    const run = newer();
    put(run);
    const before = storedRun();
    const lab = loadDungeon();
    saveDungeon({ ...lab, run: { ...lab.run!, walk: { ...lab.run!.walk!, at: { x: 0, y: 0 } } } });
    expect(storedRun()).toEqual(before);
    saveDungeon(endRun(lab));
    expect(storedRun()).toEqual(before);
    saveDungeon({ ...lab, run: migrateWalkRun(fixture("encampment-fresh")).run });
    expect(storedRun()).toEqual(before);
  });

  it("the rest of the Labyrinth's save is still written", () => {
    put(newer());
    const lab = loadDungeon();
    saveDungeon({ ...lab, meta: { ...lab.meta, runs: 9 } });
    const saved = JSON.parse(store[SAVE_KEY]);
    expect(saved.labyrinth.meta.runs).toBe(9);
    expect(saved.gold).toBe(7);
    expect("held" in saved.labyrinth).toBe(false); // (a mark for this copy only, never saved)
  });
});

describe("a run this copy understands", () => {
  it("v0 and v1 runs load unmarked, and save as given", () => {
    for (const run of [fixture("encampment-mid"), migrateWalkRun(fixture("cyclops-mid")).run]) {
      put(run);
      const lab = loadDungeon();
      expect(lab.held).toBeUndefined();
      const moved = { ...lab.run!, walk: { ...lab.run!.walk!, at: { x: 1, y: 2 } } };
      saveDungeon({ ...lab, run: moved });
      expect(storedRun()).toEqual(JSON.parse(JSON.stringify(moved)));
      expect("held" in JSON.parse(store[SAVE_KEY]).labyrinth).toBe(false);
    }
  });
  it("with no run stored, a new one is written", () => {
    put(null);
    const run = migrateWalkRun(fixture("encampment-fresh")).run;
    saveDungeon({ ...loadDungeon(), run });
    expect(storedRun()).toEqual(JSON.parse(JSON.stringify(run)));
  });
});
