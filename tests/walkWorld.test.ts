import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { walkSetup } from "./walkBaseline";
import { thingsOf, tapsThing, inReach, approach, type Thing } from "../lib/world/walkWorld";
import { findPath, walkable, type CanStep } from "../lib/dungeon/walk";
import type { Pt } from "../lib/dungeon/floorplan";
import type { DungeonRun } from "../lib/dungeon/run";

// Taps and walking up to things (lib/world/walkWorld.ts), moved out of the walk
// screen in phase 1 (docs/world-spec.md §8): against the walk screen's own
// lines as they were on 2026-11-07, copied, over every saved run.
const FIXTURES = path.join(__dirname, "fixtures", "walk");
const runs = fs.readdirSync(FIXTURES).map((f) => [f, JSON.parse(fs.readFileSync(path.join(FIXTURES, f), "utf8")) as DungeonRun] as const);

const tappedBefore = (t: Thing, q: Pt) => !t.inert && (Math.hypot(t.x - q.x, t.y - q.y) <= 1 || (!!t.npc && Math.hypot(t.x - q.x, t.y - 1 - q.y) <= 1));
function approachBefore(s: ReturnType<typeof walkSetup>, t: Thing, from: Pt, can: CanStep) {
  let best: Pt[] | null = null;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = { x: t.x + dx, y: t.y + dy };
    if ((dx || dy || !t.solid) && walkable(s.live, n.x, n.y)) {
      const way = findPath(s.live, from, n, can);
      if (way && (!best || way.length < best.length)) best = way;
    }
  }
  return best;
}

describe("things you use, out of the walk screen (world-spec §5.4)", () => {
  for (const [name, run] of runs.filter(([f]) => !f.startsWith("cyclops"))) {
    it(`${name}: taps, reach and the way up to each thing are as they were`, () => {
      const s = walkSetup(run);
      const things = thingsOf(s.layout, s.plan, s.ids, s.room, s.npcs, run.walk!.spots);
      expect(things.length).toBe(s.things.length);
      const bad: string[] = [];
      for (const t of things) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const q = { x: t.x + dx, y: t.y + dy };
          if (tapsThing(t, q) !== tappedBefore(t, q)) bad.push(`${t.key} tap ${dx},${dy}`);
          if (inReach(t, q) !== Math.hypot(t.x - q.x, t.y - q.y) <= 1.5) bad.push(`${t.key} reach ${dx},${dy}`);
        }
        const from = run.walk!.at;
        for (const can of [s.canStep, s.canWalk]) {
          if (JSON.stringify(approach(s.live, t, from, can)) !== JSON.stringify(approachBefore(s, t, from, can))) bad.push(`${t.key} approach`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
