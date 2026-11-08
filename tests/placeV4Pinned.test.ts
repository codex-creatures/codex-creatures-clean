import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { seeded, digest } from "./walkBaseline";
import { startWalkRun, walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type Cage, type DungeonRun } from "../lib/dungeon/run";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { torchLit, SCONCE_RADIUS, CANDLE_RADIUS } from "../lib/dungeon/torch";
import { CAMPFIRE_LIGHT } from "../lib/dungeon/campfire";
import { placeWalk } from "../lib/world/place";
import { placementsFrom } from "../lib/world/placements";

// World version 4's placements and lights, pinned (docs/world-spec.md §8,
// 2b-2 stage B, step B0): a v4 run, made with stage A's rules, keeps its
// candles, torches and which of them start lit, and each light reaches the
// same cells, whatever stage B's v5 changes. Recorded before any v5 work; only
// rewritten (UPDATE_GOLDEN=1) for a change the user has approved.
// (On these seeds v4 places candles and torches as v3 does: stage A changed
// only how things share panels. These still pin v4's own path.)

const GOLDEN = path.join(__dirname, "golden", "walk");
const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const made = (dungeon: 0 | 1, seed: number): DungeonRun => {
  const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon);
  return { ...run, walk: { ...run.walk!, v: 4 } };
};
const CASES = [[0, 31], [0, 32], [1, 31], [1, 32]] as const;

// Compared with its golden file, or written if it's missing (or UPDATE_GOLDEN=1).
const pinned = (name: string, now: unknown[]) => {
  const at = path.join(GOLDEN, name);
  if (process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(at)) fs.writeFileSync(at, "[\n" + now.map((i) => JSON.stringify(i)).join(",\n") + "\n]\n");
  expect(JSON.parse(JSON.stringify(now))).toEqual(JSON.parse(fs.readFileSync(at, "utf8")));
};

// Every light in the run as the walk screen gets it: each wall torch and candle
// (where, which wall, lit at the start or not) and each campfire, with the cells
// it lights on the floorplan, all tunnels open (how many, and a digest of which).
const lightsOf = (run: DungeonRun, placed: ReturnType<typeof placeWalk>["placed"]) => {
  const walk = { ...run.walk!, placed };
  const plan = layoutFloorplan(walk.layout);
  const { sconces, candles } = placementsFrom(placed, walk);
  const reach = (at: { x: number; y: number }, radius: number) => {
    const lit = torchLit(plan, at, radius);
    return { cells: lit.reduce((n, v) => n + v, 0), digest: digest(lit) };
  };
  return [
    ...sconces.map((c) => ({ kind: "torch", id: c.id, room: c.room, x: c.x, y: c.y, wall: c.wall ?? null, lit: c.lit, ...reach(c, SCONCE_RADIUS) })),
    ...candles.map((c) => ({ kind: "candle", id: c.id, room: c.room, x: c.x, y: c.y, lit: c.lit, ...reach(c, CANDLE_RADIUS) })),
    ...(walk.fires ?? []).map((f) => ({ kind: "campfire", room: f.room, x: f.x, y: f.y, left: f.left, ...reach(f, CAMPFIRE_LIGHT) })),
  ];
};

describe("world version 4's placements and lights stay as they were made", () => {
  // (The Cyclops's runs take seconds each: test:all runs them.)
  for (const [d, s] of CASES) (d === 0 ? it : slowIt)(`dungeon ${d} seed ${s}`, () => {
    const run = made(d, s);
    const { placed } = placeWalk(run.walk!, run.map, dungeonOf(run), (id) => walkRoom(run, id));
    pinned(`v4-d${d}-s${s}.placed.json`, placed);
    pinned(`v4-d${d}-s${s}.lights.json`, lightsOf(run, placed));
  });
});
