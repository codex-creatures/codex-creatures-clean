import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { walkSetup } from "./walkBaseline";
import { thingsOf, tapsThing, inReach, approach, guardedChestSpot, type Thing } from "../lib/world/walkWorld";
import { findPath, walkable, type CanStep } from "../lib/dungeon/walk";
import type { Pt } from "../lib/dungeon/floorplan";
import { fightContainer, type DungeonRun, type Room } from "../lib/dungeon/run";

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
      const things = thingsOf(s.layout, s.placed, s.ids, s.room, s.npcs, run.walk!.spots, s.dungeon);
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

describe("a mini boss's or boss's chest is there from the start, guarded (the user, 2026-11-07)", () => {
  const run = runs.find(([f]) => f === "encampment-fresh.json")![1];
  const s = walkSetup(run);
  const boss = s.layout.boss;
  const chestOf = (room: (id: string) => Room | undefined, spots = run.walk!.spots) =>
    thingsOf(s.layout, s.placed, s.ids, room, s.npcs, spots, s.dungeon).filter((t) => t.room === boss && t.def === "loot-chest");
  it("before the fight: shut, and not to be tapped, behind the boss", () => {
    const r = s.room(boss)!;
    expect(r.done).toBe(false);
    expect(fightContainer(r, s.dungeon)).not.toBe("sack");
    const [c, ...more] = chestOf(s.room);
    expect(more).toEqual([]);
    expect(c).toMatchObject({ state: "shut", open: false, inert: true, ...guardedChestSpot(s.layout, boss, r, s.dungeon) });
    expect(tapsThing(c, c)).toBe(false);
  });
  it("beaten: the same chest, in the same place, to loot (not where you stood when the fight began)", () => {
    const won = (id: string) => (id === boss ? { ...s.room(id)!, done: true, container: "chest" as const, sack: [] } : s.room(id));
    const [c] = chestOf(won, { [boss]: { x: 1, y: 1 } });
    expect(c).toMatchObject({ state: "shut", open: false, ...guardedChestSpot(s.layout, boss, s.room(boss)!, s.dungeon) });
    expect(c.inert).toBeUndefined();
    expect(tapsThing(c, c)).toBe(true);
  });
  it("an ordinary fight's sack still lies where you stood", () => {
    const id = s.ids.find((i) => { const r = s.room(i); return r && fightContainer(r, s.dungeon) === "sack" && r.enemies; });
    expect(id).toBeDefined();
    const won = (i: string) => (i === id ? { ...s.room(i)!, done: true, container: "sack" as const, sack: [] } : s.room(i));
    const sack = thingsOf(s.layout, s.placed, s.ids, won, s.npcs, { [id!]: { x: 3, y: 4 } }, s.dungeon).find((t) => t.room === id && t.def === "loot-sack");
    expect(sack).toMatchObject({ x: 3, y: 4 });
  });
});
