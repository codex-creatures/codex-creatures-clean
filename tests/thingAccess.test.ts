// Using the things in a walkable run's rooms: a tap picks the thing you tapped,
// the way the walk screen walks you up to it ends where you can use it, it's
// used, and what that did is still there after a reload.
//
// Regression (the user's play-test, 2026-11-08): in world version 4 runs,
// chests and stashes couldn't be opened. From v4 a thing stands at its
// footprint's middle (placements.ts spotOf), off its panel's middle for a
// chest, a deck or a cart (the back two rows: y − 1/6) and a sack (a corner:
// x and y ± 1/6). Two faults followed, both fixed in lib/world/walkWorld.ts:
// 1. The tap: WalkView looked the thing up in the seen-map by its position,
//    `known[t.y * w + t.x]`, no cell at all off a panel's middle (or another
//    cell, when the map's width is a multiple of 6). Now tappedThing looks at
//    the panel it's in (usedFrom), and picks the thing drawn nearest the tap.
// 2. The reach: inReach measured 1.5 u from the off-centre middle, so from the
//    far diagonals you arrived just out of reach (≈1.54 u from a chest, ≈1.65 u
//    from a sack in the opposite corner). Now it's measured from the panel it's
//    in, as walking and `approach` are.
// v2 and v3 runs stand everything on a panel's middle: nothing changes there.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seeded, walkSetup } from "./walkBaseline";
import { startWalkRun, walkRoom, walkKeep } from "../lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun, type Room } from "../lib/dungeon/run";
import { walkable, findPath } from "../lib/dungeon/walk";
import { panelAt } from "../lib/world/grid";
import { thingsOf, inReach, approach, solidCells, tappedThing, tapsThing, usedFrom, type Thing } from "../lib/world/walkWorld";
import { startWalk, restartLoop, stepWalk, walkState, walkUpTo } from "../lib/world/walkSim";
import { migrateWalkRun } from "../lib/world/migrate";
import { placeWalk } from "../lib/world/place";
import { objectDef, REACH_OBJECT } from "../lib/world/objects";
import type { Floorplan, Pt } from "../lib/dungeon/floorplan";

const cache = new Map<string, DungeonRun>();
const made = (dungeon: 0 | 1, seed: number, v: number): DungeonRun => {
  const k = `${dungeon}:${seed}:${v}`;
  if (!cache.has(k)) {
    const run = startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, [], false, seeded(seed), dungeon);
    const walk = { ...run.walk!, v };
    cache.set(k, { ...run, walk: { ...walk, placed: placeWalk(walk, run.map, dungeonOf(run), (id) => walkRoom(run, id)).placed } });
  }
  return structuredClone(cache.get(k)!);
};
// Two runs that hold, between them, every kind of thing you use (d1 s45: chests, a rickety
// chest, sacks, a deck, the merchant and the librarian; d0 s41: the other dungeon's chests and sacks).
const CASES = [[0, 41], [1, 45]] as const;
const USED = ["chest", "rickety-chest", "sack", "card-deck", "merchant", "librarian"];
const FIXTURES = path.join(__dirname, "fixtures", "walk");
const fixture = (name: string): DungeonRun => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const noLights = { sconces: [], candles: [], foes: [], npcs: [] };

// Every thing you can use in a run, as the walk screen builds them.
function usable(run: DungeonRun) {
  const s = walkSetup(run);
  const things = thingsOf(s.layout, s.placed, s.ids, s.room, s.npcs, migrateWalkRun(run).run.walk!.spots, s.dungeon).filter((t) => !t.inert);
  return { s, things };
}
const here = (run: DungeonRun) => run.path[run.path.length - 1];
const withRoom = (run: DungeonRun, id: string, f: (r: Room) => Room): DungeonRun =>
  id === here(run) ? { ...run, current: f(run.current!) } : { ...run, walk: { ...run.walk!, rooms: { ...run.walk!.rooms, [id]: f(run.walk!.rooms[id]) } } };

// 1. A tap on each thing as drawn, with only the panel it's in seen, picks it.
function tapProblems(run: DungeonRun): string[] {
  const { s, things } = usable(run);
  return things.filter((t) => {
    const known = new Uint8Array(s.plan.w * s.plan.h), p = usedFrom(t);
    known[p.y * s.plan.w + p.x] = 1;
    return tappedThing(things, { x: t.x, y: t.y }, known, s.plan.w) !== t;
  }).map((t) => `${t.key} ${t.def} at ${t.x},${t.y}: a tap on it doesn't pick it`);
}

// 2. Every panel round a thing that you can walk to is within its reach, and the
// walk screen walks you no further: from there, a tap on it uses it at once.
function reachProblems(run: DungeonRun): string[] {
  const { s, things } = usable(run), solid = solidCells(things, run.walk!.fires ?? [], []);
  const can = (_: Pt, to: Pt) => !solid.has(`${to.x},${to.y}`);
  const bad: string[] = [];
  const sim = startWalk(run.walk!, s.plan, s.live, noLights, new Uint8Array(s.plan.w * s.plan.h).fill(1));
  for (const t of things) for (const { dx, dy } of objectDef(t.def).interact?.points ?? []) {
    const p = usedFrom(t), n: Pt = { x: p.x + dx, y: p.y + dy };
    if (!(dx || dy || !t.solid) || !walkable(s.plan, n.x, n.y) || solid.has(`${n.x},${n.y}`)) continue;
    if (!approach(s.plan, t, n, can)) continue;
    if (!inReach(t, n)) bad.push(`${t.key} ${t.def}: out of reach from ${dx},${dy}`);
    sim.me = { ...n, path: [] };
    sim.wantThing = null;
    if (walkUpTo(sim, t, s.live, can) !== "use") bad.push(`${t.key} ${t.def}: from ${dx},${dy} it walks you on instead of using it`);
  }
  return bad;
}

const offCentre = (run: DungeonRun) => usable(run).things.filter((t) => !Number.isInteger(t.x) || !Number.isInteger(t.y));

describe("v2 and v3 runs: as before (everything on its panel's middle)", () => {
  const runs: [string, () => DungeonRun][] = [
    ...["encampment-mid", "cyclops-mid", "cyclops-fresh"].map((n): [string, () => DungeonRun] => [`v2 ${n}`, () => fixture(n)]),
    ...CASES.map(([d, s]): [string, () => DungeonRun] => [`v3 dungeon ${d} seed ${s}`, () => made(d, s, 3)]),
  ];
  for (const [name, get] of runs) it(`${name}: taps pick things, reach is unchanged, and every way up to one ends in reach`, () => {
    const run = get(), { things } = usable(run);
    expect(things.length).toBeGreaterThan(0);
    const bad = [...tapProblems(run), ...reachProblems(run)];
    // The panel a thing's used from is where it stands, so reach is today's: from its position.
    for (const t of things) {
      const p = usedFrom(t);
      if (p.x !== t.x || p.y !== t.y) bad.push(`${t.key} ${t.def}: off its panel's middle`);
      for (const q of [{ x: t.x + 1, y: t.y + 1 }, { x: t.x + 2, y: t.y }, { x: t.x, y: t.y + 1.5 }]) {
        if (inReach(t, q) !== Math.hypot(t.x - q.x, t.y - q.y) <= REACH_OBJECT) bad.push(`${t.key} ${t.def}: reach changed at ${q.x},${q.y}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("v4 runs: using things off their panel's middle (the play-test regression)", () => {
  it("the cases hold every kind of thing you use, off its panel's middle", () => {
    const defs = new Set(CASES.flatMap(([d, s]) => offCentre(made(d, s, 4)).map((t) => t.def)));
    expect(USED.filter((d) => !defs.has(d))).toEqual([]);
  });
  for (const [d, s] of CASES) {
    it(`dungeon ${d} seed ${s}: a tap on a thing picks it`, () => expect(tapProblems(made(d, s, 4))).toEqual([]));
    it(`dungeon ${d} seed ${s}: from every panel round a thing you can reach, you can use it`, () => expect(reachProblems(made(d, s, 4))).toEqual([]));
  }
});

describe("two things in or by one panel", () => {
  // A sack in its panel's north-west corner, and the card witch (not solid) standing in the
  // same panel's south-east: each tap picks the one it's on, and only that one is used.
  const sack: Thing = { key: "r1", room: "r1", x: 5 - 1 / 6, y: 5 - 1 / 6, def: "sack", state: "shut", open: false, solid: true };
  const witch: Thing = { key: "r1:witch", room: "r1", x: 5 + 1 / 3, y: 5 + 1 / 3, def: "witch", open: false, solid: false, npc: true };
  const known = new Uint8Array(10 * 10).fill(1);
  it("a tap picks the thing drawn nearest it, whichever's listed first", () => {
    for (const list of [[sack, witch], [witch, sack]]) {
      expect(tappedThing(list, { x: sack.x, y: sack.y }, known, 10)).toBe(sack);
      expect(tappedThing(list, { x: witch.x, y: witch.y }, known, 10)).toBe(witch);
      expect(tappedThing(list, { x: 5 - 0.3, y: 5 - 0.2 }, known, 10)).toBe(sack);
    }
  });
  it("both are used from the panel they share, but only the one tapped is walked up to", () => {
    expect(usedFrom(sack)).toEqual(usedFrom(witch));
    expect(tapsThing(sack, { x: witch.x, y: witch.y })).toBe(true); // (the tap is close enough to both: the nearest wins)
    const plan: Floorplan = { w: 10, h: 10, tiles: new Uint8Array(100).fill(1), rooms: { r1: [{ x: 0, y: 0, w: 10, h: 10 }] }, doors: [], tunnels: {} };
    const walk = startWalkRun(["a"], ["a"], { a: 1 }, 4, [], false, seeded(1), 1).walk!;
    const sim = startWalk(walk, plan, plan, noLights, known);
    sim.me = { x: 8, y: 8, path: [] };
    const t = tappedThing([sack, witch], { x: witch.x, y: witch.y }, known, 10)!;
    expect(walkUpTo(sim, t, plan, (_, to) => !(to.x === 5 && to.y === 5))).toBe("walking");
    expect(sim.wantThing).toBe("r1:witch");
  });
  it("a thing whose panel you haven't seen isn't picked, even with the panel beside it seen", () => {
    const partSeen = new Uint8Array(100);
    partSeen[5 * 10 + 6] = 1; // (the panel east of theirs)
    expect(tappedThing([sack, witch], { x: sack.x, y: sack.y }, partSeen, 10)).toBeUndefined();
  });
  it("in real runs, each thing you use has its own key (the use event names it)", () => {
    for (const [d, s] of CASES) {
      const keys = usable(made(d, s, 4)).things.filter((t) => USED.includes(t.def)).map((t) => t.key);
      expect(keys.length).toBe(new Set(keys).size);
    }
  });
});

// The whole sequence, as the walk screen does it: tap the thing, walk up to it,
// it's used (stepWalk's "use" event), the room's state as the dungeon screen
// leaves it (a chest or stash opened), saved, and reloaded.
function useByTapping(run0: DungeonRun, t: Thing): string[] {
  const bad: string[] = [];
  const { s } = usable(run0);
  const run = migrateWalkRun(run0).run;
  const sim = startWalk(run.walk!, s.plan, s.live, noLights, new Uint8Array(s.plan.w * s.plan.h).fill(1));
  restartLoop(sim, s.live, run.hp, 1000);
  const things = () => thingsOf(s.layout, s.placed, s.ids, s.room, sim.npcs, run.walk!.spots, s.dungeon).filter((x) => !x.inert);
  // Start a few panels off, somewhere in its room you can walk up to it from.
  const p = usedFrom(t);
  let start: Pt | null = null;
  for (const r of s.plan.rooms[t.room] ?? []) for (let y = r.y; y < r.y + r.h && !start; y++) for (let x = r.x; x < r.x + r.w && !start; x++) {
    const d = Math.hypot(x - p.x, y - p.y);
    if (d >= 3 && d <= 6 && walkable(s.live, x, y) && approach(s.live, t, { x, y }, s.canWalk) && findPath(s.live, { x, y }, p, () => true)) start = { x, y };
  }
  if (!start) return [`${t.key} ${t.def}: nowhere to start from`];
  sim.me = { ...start, path: [] };
  const picked = tappedThing(things(), { x: t.x, y: t.y }, sim.known, s.plan.w);
  if (picked?.key !== t.key || picked.def !== t.def) return [`${t.key} ${t.def}: the tap picked ${picked?.def ?? "nothing"}`];
  if (walkUpTo(sim, picked, s.live, s.canWalk) !== "walking") return [`${t.key} ${t.def}: no way up to it`];
  let used: Thing | null = null, at: Pt | null = null, st = walkState(sim), now = 1000;
  for (let k = 0; k < 3000 && !used; k++) {
    now += 16;
    const frame = stepWalk(sim, { now, busy: false, room: s.room, here: here(run), team: ["a", "b"], hp: run.hp, things, rng: seeded(k + 1) });
    for (const e of frame.events) if (e.type === "use") { used = e.thing; at = { x: sim.me.x, y: sim.me.y }; st = e.state; }
  }
  if (!used) return [`${t.key} ${t.def}: walked up, never used`];
  if (used.key !== t.key || used.def !== t.def) bad.push(`${t.key} ${t.def}: used ${used.def} instead`);
  if (!inReach(t, at!)) bad.push(`${t.key} ${t.def}: used from out of reach`);
  // What the dungeon screen does with it: a chest or stash opened (its sack of loot), then saved and reloaded.
  const opens = ["chest", "rickety-chest", "sack"].includes(t.def);
  const after = json(walkKeep(opens ? withRoom(run, t.room, (r) => ({ ...r, opened: true, done: true, sack: [] })) : run, st));
  const shown = usable(after).things, again = shown.find((x) => x.key === t.key && x.def === t.def);
  if (!again) return [...bad, `${t.key} ${t.def}: gone after a reload`];
  if (again.x !== t.x || again.y !== t.y) bad.push(`${t.key} ${t.def}: moved after a reload`);
  if (opens && (!again.open || again.state !== "open")) bad.push(`${t.key} ${t.def}: shut again after a reload`);
  // (Your spot is saved as the panel you're on: it's used as you step into reach, mid-step.)
  if (after.walk!.at.x !== Math.round(at!.x) || after.walk!.at.y !== Math.round(at!.y)) bad.push(`${t.key} ${t.def}: you're not where you used it after a reload`);
  if (tappedThing(shown, { x: t.x, y: t.y }, new Uint8Array(s.plan.w * s.plan.h).fill(1), s.plan.w)?.key !== t.key) bad.push(`${t.key} ${t.def}: can't be tapped after a reload`);
  return bad;
}

describe("the whole sequence: tap, walk up, use, save, reload", () => {
  for (const [d, s] of CASES) for (const v of [3, 4]) it(`v${v} dungeon ${d} seed ${s}: one of each kind of thing`, () => {
    const run = made(d, s, v), { things } = usable(run);
    const picks = USED.map((def) => things.find((t) => t.def === def)).filter((t): t is Thing => !!t);
    expect(picks.length).toBeGreaterThan(1);
    expect(picks.flatMap((t) => useByTapping(run, t))).toEqual([]);
  }, 120_000);
  it("a v4 run reloaded from its save: the same things, where they were, each tappable and in reach from round it", () => {
    for (const [d, s] of CASES) {
      const run = made(d, s, 4), reloaded = json(migrateWalkRun(json(run)).run);
      const a = usable(run).things, b = usable(reloaded).things;
      expect(b.map((t) => [t.key, t.def, t.x, t.y])).toEqual(a.map((t) => [t.key, t.def, t.x, t.y]));
      expect([...tapProblems(reloaded), ...reachProblems(reloaded)]).toEqual([]);
    }
  });
});

// (So nothing goes back to reading the grid at a thing's position.)
it("a thing 1/6 off its panel's middle is still in that panel", () => {
  expect(usedFrom({ x: 5 - 1 / 6, y: 5 + 1 / 6 })).toEqual({ x: 5, y: 5 });
  expect(panelAt(5 + 1 / 3)).toBe(5);
});
