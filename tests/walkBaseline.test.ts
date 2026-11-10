import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { sceneInputs, walkSetup, playForward, seeded, digest } from "./walkBaseline";
import { startWalkRun, walkInto, walkRoom } from "../lib/dungeon/walkRun";
import { WALK_SPEC, layoutFloorplan, waysOn, roomCentre, type Layout } from "../lib/dungeon/layout";
import { loadDungeon, type Cage, type DungeonRun } from "../lib/dungeon/run";
import { stepFoe } from "../lib/dungeon/foes";
import { advance, findPath } from "../lib/dungeon/walk";
import { SAVE_KEY } from "../lib/save";

// Phase 0 of the world architecture (docs/world-spec.md §8): the walkable
// dungeons as they are on 2026-11-07, pinned so later phases can show they
// changed nothing they weren't meant to.
//
// - Fixtures (tests/fixtures/walk/): saved runs made once by today's code, as
//   the game saves them. They're the save format to keep working, so they're
//   never remade by the tests: MAKE_WALK_FIXTURES=1 writes any that are
//   missing (delete one first to remake it, and say why in the commit).
// - Goldens (tests/golden/walk/): what the walk screen works out from each
//   (tests/walkBaseline.ts). UPDATE_GOLDEN=1 rewrites them: only for a change
//   the user has approved, said in the commit.

const quickIt = it;

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const GOLDEN = path.join(__dirname, "golden", "walk");
const MAKE = process.env.MAKE_WALK_FIXTURES === "1";
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const encampment = (seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, cages, false, seeded(seed), 0);
const cyclops = (seed: number) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(seed), 1, false, false); // (rooms as rolled before people wandered, decision 39: phase 0 pinned them)
// A run from before rooms had stone in them (2026-11-07): rolled at 3-tile blocks, saved with no block and no insides.
function beforePillars(seed: number): DungeonRun {
  const was = WALK_SPEC.block;
  (WALK_SPEC as { block: number }).block = 3;
  try {
    const run = playForward(encampment(seed), 3);
    const strip = (l: Layout): Layout => ({ ...l, block: undefined, rooms: Object.fromEntries(Object.entries(l.rooms).map(([id, r]) => [id, { ...r, block: undefined, inner: undefined }])) });
    return JSON.parse(JSON.stringify({ ...run, walk: { ...run.walk!, layout: strip(run.walk!.layout) } }));
  } finally {
    (WALK_SPEC as { block: number }).block = was;
  }
}

// The saved runs: what each is, and how it was made.
const MAKERS: Record<string, () => DungeonRun> = {
  "encampment-fresh": () => encampment(101),
  "encampment-mid": () => playForward(encampment(102), 5),
  "encampment-top": () => playForward(encampment(106), 60),     // as far up as it goes: the chief's camp
  "encampment-before-pillars": () => beforePillars(103),
  "cyclops-fresh": () => cyclops(104),
  "cyclops-mid": () => playForward(cyclops(105), 6),
};
const NAMES = Object.keys(MAKERS);

function fixture(name: string): DungeonRun {
  const file = path.join(FIXTURES, `${name}.json`);
  if (!fs.existsSync(file)) {
    if (!MAKE) throw new Error(`missing fixture ${name}: run with MAKE_WALK_FIXTURES=1 to make it with today's code`);
    fs.mkdirSync(FIXTURES, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(MAKERS[name]()));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Compare with the golden (or write it, with UPDATE_GOLDEN=1).
function golden(name: string, value: unknown) {
  const file = path.join(GOLDEN, `${name}.json`);
  const now = JSON.parse(JSON.stringify(value));
  if (UPDATE || (MAKE && !fs.existsSync(file))) {
    fs.mkdirSync(GOLDEN, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
  }
  if (!fs.existsSync(file)) throw new Error(`missing golden ${name}: run with UPDATE_GOLDEN=1`);
  expect(now).toEqual(JSON.parse(fs.readFileSync(file, "utf8")));
}

// Ten seconds of the room's foes going about (seeded), and you walking up to each thing.
function motion(run: DungeonRun) {
  const s = walkSetup(run);
  const rng = seeded(run.walk!.seed + 1);
  let foes = s.foes;
  for (let t = 0; t < 100; t++) foes = foes.map((f) => stepFoe(s.live, f, 0.1, rng));
  const walks = s.things.map((t) => {
    const way = findPath(s.live, run.walk!.at, t, s.canStep);
    if (!way) return `${t.key} none`;
    let me = { ...run.walk!.at, path: way }, ticks = 0;
    while (me.path.length > 0 && ticks < 2000) { me = advance(me, 1 / 60); ticks++; }
    return `${t.key} ${ticks} ${me.x.toFixed(2)},${me.y.toFixed(2)}`;
  });
  // By the walking rules alone (forward, solid things), to each room's middle: steps, or none.
  const rooms = Object.values(run.walk!.layout.rooms).sort((a, b) => (a.id < b.id ? -1 : 1)).map((r) => {
    const way = findPath(s.live, run.walk!.at, roomCentre(r), s.canWalk);
    return `${r.id} ${way ? way.length : "none"}`;
  });
  return { rooms, foes: foes.map((f) => `${f.room}#${f.index}@${f.x.toFixed(3)},${f.y.toFixed(3)} face ${f.facing.toFixed(3)}`), walks };
}

describe("phase 0: the walkable dungeons, pinned (world-spec §8)", () => {
  for (const name of NAMES) {
    // (The Cyclops's layouts are bigger: its two run in the full suite.)
    const it = name.startsWith("cyclops") ? slowIt : quickIt;
    it(`${name}: what the walk screen works out, live and with the lab's decor`, () => {
      const run = fixture(name);
      golden(`${name}.scene`, { live: sceneInputs(run, false), decor: sceneInputs(run, true) });
    });
    it(`${name}: foes going about and walking up to things`, () => {
      golden(`${name}.motion`, motion(fixture(name)));
    });
  }

  it("the fixtures are what they say: fresh, part-way, at the top, from before pillars, each dungeon", () => {
    const fresh = fixture("encampment-fresh"), mid = fixture("encampment-mid"), top = fixture("encampment-top");
    const old = fixture("encampment-before-pillars"), cyc = fixture("cyclops-mid");
    expect(fresh.walk!.line).toBeNull();
    expect(fresh.dungeon).toBe(0);
    expect(mid.walk!.line).not.toBeNull();
    expect(mid.walk!.lit!.length).toBeGreaterThan(0);
    expect(mid.walk!.cuts!.length).toBeGreaterThan(0);
    expect(top.walk!.room).toBe(top.map.boss);
    expect(old.walk!.layout.block).toBeUndefined();
    expect(Object.values(old.walk!.layout.rooms).some((r) => r.inner)).toBe(false);
    expect(cyc.dungeon).toBeUndefined(); // (the Labyrinth's runs carry no dungeon number: 1 is the default)
    expect(Object.values(fixture("encampment-mid").walk!.layout.rooms).some((r) => r.inner)).toBe(true);
  });

  it("each saved run loads through the game's own loader and carries on", () => {
    const store: Record<string, string> = {};
    const g = globalThis as unknown as { window?: unknown };
    const had = g.window;
    g.window = { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } };
    try {
      for (const name of NAMES) {
        const run = fixture(name);
        store[SAVE_KEY] = JSON.stringify({ labyrinth: { meta: { runs: 4, clears: 1, injuries: {}, bag: [] }, run } });
        const loaded = loadDungeon().run!;
        expect(loaded, name).not.toBeNull();
        expect(loaded.status, name).toBe("exploring");
        expect(sceneInputs(loaded), name).toEqual(sceneInputs(run));
        // It carries on: the next room along can be walked into.
        const way = waysOn(loaded.walk!.layout, { room: loaded.walk!.room, line: loaded.walk!.line ?? Infinity })[0];
        if (way) expect(walkInto(loaded, way.to.room).path.at(-1), name).toBe(way.to.room);
        expect(walkRoom(loaded, loaded.walk!.room) ?? null, name).toEqual(loaded.current ?? null);
      }
    } finally {
      g.window = had;
    }
  });

  // Fresh runs of each dungeon, ten seeds each: what's rolled and placed.
  const sweep = (make: (seed: number) => DungeonRun) => Array.from({ length: 10 }, (_, i) => {
    const run = make(1000 + i);
    const s = sceneInputs(run, true);
    const plan = layoutFloorplan(run.walk!.layout);
    return { tiles: digest(plan.tiles), rooms: Object.keys(run.map.nodes).length, kinds: digest(JSON.stringify(Object.values(run.map.nodes).map((n) => n.kind))), scene: digest(JSON.stringify(s)) };
  });
  slowIt("ten fresh Encampment runs", () => golden("sweep-encampment", sweep(encampment)));
  slowIt("ten fresh Cyclops runs", () => golden("sweep-cyclops", sweep(cyclops)));
});
