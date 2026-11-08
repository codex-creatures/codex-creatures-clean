import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pinnedRun } from "./pinnedRuns";
import { walkRoom } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "../lib/dungeon/run";
import { placeWalk } from "../lib/world/place";

// World version 3's placements, pinned (docs/world-spec.md §8, 2b-2 stage A):
// a v3 run, made with 2b-1's rules, keeps them, and mending one gives exactly
// them again, whatever later versions change. Recorded before stage A; only
// rewritten (UPDATE_GOLDEN=1) for a change the user has approved.

const GOLDEN = path.join(__dirname, "golden", "walk");
// (Each from its saved run, tests/pinnedRuns.ts, so rolling layouts differently can't move it.)
const made = (dungeon: 0 | 1, seed: number): DungeonRun => {
  const run = pinnedRun(dungeon, seed);
  return { ...run, walk: { ...run.walk!, v: 3 } };
};
const CASES = [[0, 31], [0, 32], [1, 31], [1, 32]] as const;

describe("world version 3's placements stay as they were made", () => {
  for (const [d, s] of CASES) it(`dungeon ${d} seed ${s}`, () => {
    const run = made(d, s);
    const now = placeWalk(run.walk!, run.map, dungeonOf(run), (id) => walkRoom(run, id)).placed;
    const at = path.join(GOLDEN, `v3-d${d}-s${s}.placed.json`);
    if (process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(at)) fs.writeFileSync(at, "[\n" + now.map((i) => JSON.stringify(i)).join(",\n") + "\n]\n");
    expect(JSON.parse(JSON.stringify(now))).toEqual(JSON.parse(fs.readFileSync(at, "utf8")));
  });
});
