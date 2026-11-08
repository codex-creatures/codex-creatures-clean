import fs from "node:fs";
import path from "node:path";
import { seeded } from "./walkBaseline";
import { startWalkRun } from "../lib/dungeon/walkRun";
import type { Cage, DungeonRun } from "../lib/dungeon/run";

// The runs the placement pins are made from (tests/placeV3.test.ts and
// tests/placeV4Pinned.test.ts): saved once, as tests/walkBaseline.test.ts's
// fixtures are, so a change to how layouts are rolled can't move them. Each
// pin places its version's things on the saved layout. MAKE_WALK_FIXTURES=1
// writes any that are missing, from today's code.

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];

export function pinnedRun(dungeon: 0 | 1, seed: number): DungeonRun {
  const file = path.join(FIXTURES, `pin-d${dungeon}-s${seed}.json`);
  if (!fs.existsSync(file)) {
    if (process.env.MAKE_WALK_FIXTURES !== "1") throw new Error(`missing fixture pin-d${dungeon}-s${seed}: run with MAKE_WALK_FIXTURES=1 to make it with today's code`);
    const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, dungeon === 0 ? cages : [], false, seeded(seed), dungeon);
    fs.mkdirSync(FIXTURES, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(run));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
