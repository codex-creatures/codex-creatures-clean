import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { walkSetup } from "./walkBaseline";
import { thingsOf, tapsThing, tappedThing, tappedOnRay, inReach, approach, guardedChestSpot, usableNear, guarding, foeStarts, cageGuardSpot, type Thing } from "../lib/world/walkWorld";
import { startWalk, restartLoop, stepWalk, soundAlarm } from "../lib/world/walkSim";
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
  it("before the fight: shut and solid, behind the boss; tapping it is trying to open it under their noses (2026-11-09)", () => {
    const r = s.room(boss)!;
    expect(r.done).toBe(false);
    expect(fightContainer(r, s.dungeon)).not.toBe("sack");
    const [c, ...more] = chestOf(s.room);
    expect(more).toEqual([]);
    expect(c).toMatchObject({ state: "shut", open: false, solid: true, guarded: true, ...guardedChestSpot(s.layout, boss, r, s.dungeon) });
    expect(tapsThing(c, c)).toBe(true);
  });
  it("trying to open it sets its guards on you: they've seen you, and the fight follows", () => {
    const sim = startWalk(run.walk!, s.plan, s.live, { sconces: s.sconces, candles: s.candles, foes: s.foes, npcs: s.npcs }, s.known);
    let now = 1000;
    restartLoop(sim, s.live, run.hp, now);
    soundAlarm(sim, boss, now);
    expect(sim.alarm?.room).toBe(boss);
    let spotted: string | undefined;
    const things = () => thingsOf(s.layout, s.placed, s.ids, s.room, sim.npcs, run.walk!.spots, s.dungeon);
    for (let k = 0; k < 600 && !spotted; k++) {
      now += 16;
      spotted = stepWalk(sim, { now, busy: false, room: s.room, here: run.path[run.path.length - 1], team: ["a"], hp: run.hp, things }).events.find((e) => e.type === "spotted")?.room;
    }
    expect(spotted).toBe(boss);
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
  it("a money stash's sack is marked, so it's drawn in its own cloth (the user, 2026-11-23); any other stash's isn't", () => {
    const stashes = s.ids.filter((i) => s.room(i)?.kind === "stash");
    expect(stashes.length).toBeGreaterThan(0);
    const rich = (i: string) => (i === stashes[0] ? { ...s.room(i)!, money: true } : s.room(i) && { ...s.room(i)!, money: undefined });
    const sacks = thingsOf(s.layout, s.placed, s.ids, rich, s.npcs, {}, s.dungeon).filter((t) => t.def === "sack");
    expect(sacks.find((t) => t.room === stashes[0])?.money).toBe(true);
    expect(sacks.filter((t) => t.room !== stashes[0]).every((t) => !t.money)).toBe(true);
  });
});

describe("a guarded chest's foes patrol close round it (the user, 2026-11-09)", () => {
  it("every foe of a room with a chest to guard walks round it; a waiting boss and a sack's foes don't", () => {
    const bad: string[] = [];
    for (const [name, run] of runs) {
      const s = walkSetup(run);
      const foes = guarding(foeStarts(s.placed, s.ids, s.room), s.layout, s.room, s.dungeon);
      for (const f of foes) {
        const r = s.room(f.room)!;
        const guards = !f.waits && fightContainer(r, s.dungeon) !== "sack";
        if (guards !== !!f.guard) bad.push(`${name} ${f.room}: guard ${!!f.guard}`);
        if (guards && (!f.walks || f.guard!.x !== guardedChestSpot(s.layout, f.room, r, s.dungeon).x)) bad.push(`${name} ${f.room}: not patrolling its chest`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("the joystick's use button", () => {
  const thing = (key: string, x: number, open = false, inert = false): Thing => ({ key, room: "r", x, y: 2, def: "chest", open, solid: true, inert });
  const known = new Uint8Array(100).fill(1);
  it("picks what you're in reach of and have seen, unopened first", () => {
    const things = [thing("far", 9), thing("open", 3, true), thing("shut", 4)];
    expect(usableNear(things, { x: 3, y: 3 }, known, 10)?.key).toBe("shut");
    expect(usableNear(things, { x: 3, y: 3 }, new Uint8Array(100), 10)).toBeUndefined();
    expect(usableNear([thing("drawn", 3, false, true)], { x: 3, y: 3 }, known, 10)).toBeUndefined();
  });
});

describe("a camp's cages are guarded like a chest (the user, 2026-11-09)", () => {
  const cages = [{ x: 4, y: 2 }, { x: 7, y: 2 }, { x: 10, y: 2 }];
  const placed = { spot: (id: string) => cages[Number(id.split("#")[1])] } as unknown as Parameters<typeof cageGuardSpot>[0];
  const camp = (done: boolean): Room => ({ kind: "encampment", variant: "plain", enemies: [{} as never, {} as never], cages: [{}, {}, {}], level: "normal", done });
  it("its foes patrol in front of the middle of the cages", () => {
    expect(cageGuardSpot(placed, "r", camp(false))).toEqual({ x: 7, y: 3 });
    const foe = { room: "r", index: 0, x: 5, y: 6, facing: 0, walks: false, path: [], wait: 0 };
    const [f] = guarding([foe], { rooms: {}, tunnels: [] } as never, () => camp(false), 1, placed);
    expect(f).toMatchObject({ walks: true, guard: { x: 7, y: 3 } });
  });
  it("trying a cage before they're beaten sets them on you; after, it opens", () => {
    const things = (done: boolean) => thingsOf({ rooms: {}, tunnels: [] } as never, { ...placed, sconces: [], candles: [], witches: [], foes: [] } as never, ["r"], () => camp(done), [], undefined, 1);
    expect(things(false).filter((t) => t.def === "cage").every((t) => t.guarded && !t.flag)).toBe(true);
    expect(things(true).filter((t) => t.def === "cage").every((t) => !t.guarded && t.flag)).toBe(true);
  });
});

// A tap in the 3D view picks a tall thing as drawn (the user, 2026-11-26: tapping a stack of boxes didn't walk
// to it: its ray met the floor behind the stack). The ray here comes down from the south, the camera's side.
describe("a tap's ray from the camera (tappedOnRay)", () => {
  const W = 10, known = new Uint8Array(W * W).fill(1);
  const at = (x: number, y: number): Thing => ({ key: `${x},${y}`, room: "r", x, y, def: "stacked-crates", open: false, solid: true });
  const ray = (floorY: number) => (h: number): Pt => ({ x: 5, y: floorY + 1.7 * h }); // higher up is nearer the camera
  it("picks a stack of crates when the tap lands on them as drawn, though the floor under the finger is behind them", () => {
    const stack = at(5, 5);
    expect(tappedThing([stack], { x: 5, y: 3 }, known, W)).toBeUndefined(); // (the floor alone: missed)
    expect(tappedOnRay([stack], ray(3), known, W)).toBe(stack);
  });
  it("leaves floor in front of a thing, and floor behind a low one, as floor", () => {
    expect(tappedOnRay([at(5, 5)], ray(7.5), known, W)).toBeUndefined();
    const sack = { ...at(5, 5), def: "sack" };
    expect(tappedOnRay([sack], ray(3), known, W)).toBeUndefined();
  });
  it("is the floor tap when the ray meets nothing tall: a tap right by a thing still picks it", () => {
    const sack = { ...at(5, 5), def: "sack" };
    expect(tappedOnRay([sack], ray(5), known, W)).toBe(sack);
  });
  it("of two in line, picks the one nearer the camera", () => {
    const front = at(5, 6), back = at(5, 4);
    expect(tappedOnRay([back, front], ray(3.2), known, W)).toBe(front);
  });
  it("never picks one you haven't seen", () => {
    expect(tappedOnRay([at(5, 5)], ray(3), new Uint8Array(W * W), W)).toBeUndefined();
  });
});
