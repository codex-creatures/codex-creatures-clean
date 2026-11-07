import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { walkSetup, seeded, digest } from "./walkBaseline";
import { oldWalk, type OldEvent } from "./walkSimBefore";
import { startWalk, restartLoop, stepWalk, type WalkSim, type Frame } from "../lib/world/walkSim";
import { thingsOf, approach, inReach, type Thing } from "../lib/world/walkWorld";
import { shutPlan } from "../lib/dungeon/torch";
import { roomCentre, waysOn, type Progress } from "../lib/dungeon/layout";
import { walkToward, type Walker } from "../lib/dungeon/walk";
import type { DungeonRun } from "../lib/dungeon/run";
import type { Pt } from "../lib/dungeon/floorplan";

// The walk going on (lib/world/walkSim.ts), moved out of the walk screen in
// phase 1 (docs/world-spec.md §8): run side by side with the screen's own
// frame logic from before the move (tests/walkSimBefore.ts), over a scripted
// session on each saved run (walking up to each thing, on into the rooms
// ahead, foes seeing you and coming at you, a window over the walk now and
// then, sitting by a campfire), frame by frame, with the same random numbers.
// Every frame, everything either side keeps or hands back must be the same.

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const fixture = (name: string): DungeonRun => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));
const copy = <T,>(v: T): T => structuredClone(v);

const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_, x) => (x instanceof Uint8Array ? digest(x) : x instanceof Set ? [...x] : x instanceof Map ? [...x] : x === Infinity ? "inf" : x === -Infinity ? "-inf" : x)));
function newSide(sim: WalkSim, f: Frame) {
  const A = sim.alarm;
  return plain({
    me: sim.me, facing: sim.facing, walked: sim.walked, progress: sim.progress, known: sim.known, lightNow: sim.lightNow, trail: sim.trail, cuts: sim.cuts,
    sconces: sim.sconces.filter((c) => c.lit).map((c) => c.id), candles: sim.candles.filter((c) => c.lit).map((c) => c.id), fires: sim.fires, foes: sim.foes, npcs: sim.npcs,
    flare: sim.flareLeft, falls: sim.falls, shakeAt: sim.shakeAt, want: sim.wantThing, fired: sim.fired, alarm: A && { ...A },
    frame: { draw: f.draw, busy: f.busy, reach: f.reachNow, candles: f.candlesSeen.map((c) => c.id), fires: f.fireSeen, alarmed: f.alarmed, foeLight: f.foeLight, giving: f.giving },
    events: f.events.map((e) => ({ ...e })),
  });
}
function oldSide(o: ReturnType<typeof oldWalk>, events: OldEvent[]) {
  const A = o.alarm.current, f = o.frame();
  return plain({
    me: o.me.current, facing: o.facing.current, walked: o.walked.current, progress: o.progressRef.current, known: o.known.current, lightNow: o.lightNow.current, trail: o.trail.current, cuts: o.cuts.current,
    sconces: o.sconces.current.filter((c) => c.lit).map((c) => c.id), candles: o.candles.current.filter((c) => c.lit).map((c) => c.id), fires: o.fires.current, foes: o.foes.current, npcs: o.npcs.current,
    flare: o.flareLeft.current, falls: o.falls.current, shakeAt: o.shakeAt.current, want: o.wantThing.current, fired: o.fired.current, alarm: A && { ...A },
    frame: { draw: f.draw, busy: f.busy, reach: f.reachNow, candles: f.candlesSeen.map((c) => c.id), fires: f.fireSeen, alarmed: f.alarmed, foeLight: f.foeLight, giving: f.giving },
    events,
  });
}

function session(name: string, frames: number) {
  const run = fixture(name), walk = run.walk!;
  const s = walkSetup(run);
  const room = s.room, here = run.path[run.path.length - 1];
  const team = [{ id: "a" }, { id: "b" }];
  let hp: Record<string, number> = { a: 0.3, b: 0.6 };
  const placed = () => ({ sconces: copy(s.sconces), candles: copy(s.candles), foes: copy(s.foes), npcs: copy(s.npcs) });
  const p0: Progress = { room: walk.room, line: walk.line ?? Infinity };
  const sim = startWalk(walk, s.plan, s.live, placed(), copy(s.known));
  const o = oldWalk({ layout: s.layout, plan: s.plan, live: s.live, at: walk.at, progress: p0, known: copy(s.known), trail: copy(walk.trail ?? [walk.at]), cuts: copy(walk.cuts ?? []),
    ...placed(), fires: copy(walk.fires ?? []), flare: walk.flare ?? 0 });
  const thingsNew = () => thingsOf(s.layout, s.plan, s.ids, room, sim.npcs, walk.spots);
  const thingsOld = () => thingsOf(s.layout, s.plan, s.ids, room, o.npcs.current, walk.spots);
  // The plan for the session: by a campfire, then each thing in turn, then on up the ways ahead.
  const targets: ({ thing: string } | { spot: Pt } | { fire: number })[] = [
    ...(walk.fires ?? []).slice(0, 1).map((_, i) => ({ fire: i })),
    ...s.things.map((t) => ({ thing: t.key })),
    ...waysOn(s.layout, p0).map((w) => ({ spot: roomCentre(s.layout.rooms[w.to.room]) })),
  ];
  const rngNew = seeded(walk.seed + 9), rngOld = seeded(walk.seed + 9);
  const real = Math.random;
  const bad: string[] = [];
  let now = 1000, k = 0, live = s.live, liveFor = p0;
  sim.live = live; restartLoop(sim, live, hp, now); o.restart(live, now, hp);
  // Send each side towards the next target, the way the screen's tap does.
  const go = (target: (typeof targets)[number]) => {
    if ("fire" in target) {
      const f = walk.fires![target.fire];
      const at: Walker = { x: f.x, y: f.y + 1, path: [] };
      sim.me = { ...at }; o.me.current = { ...at };
      return;
    }
    if ("thing" in target) {
      for (const [side, list] of [["new", thingsNew()], ["old", thingsOld()]] as const) {
        const t = list.find((x: Thing) => x.key === target.thing);
        const me = side === "new" ? sim.me : o.me.current;
        if (!t || inReach(t, me)) continue;
        const from = me.path[0] ?? { x: Math.round(me.x), y: Math.round(me.y) };
        const best = approach(live, t, from, s.canWalk);
        if (!best) continue;
        const next = { ...me, path: me.path.length > 0 ? [from, ...best] : best };
        if (side === "new") { sim.wantThing = t.key; sim.goal = null; sim.me = next; } else { o.wantThing.current = t.key; o.goal.current = null; o.me.current = next; }
      }
      return;
    }
    sim.goal = target.spot; sim.wantThing = null; sim.me = walkToward(live, sim.me, target.spot, s.canWalk);
    o.goal.current = target.spot; o.wantThing.current = null; o.me.current = walkToward(live, o.me.current, target.spot, s.canWalk);
  };
  let next = 0;
  for (k = 0; k < frames && bad.length === 0; k++) {
    if (k % 240 === 0 && next < targets.length) go(targets[next++]);
    now += 10 + ((k * 7) % 31); // uneven frames, now and then a long one
    if (k % 97 === 50) now += 150;
    if (k === frames >> 1) hp = { ...hp }; // the run's health handed back: a new object
    const busy = k % 300 > 280; // a window over the walk now and then
    const P = { here, room, busy, team, hp };
    o.setProps({ ...P, things: thingsOld });
    const oldEvents = o.events.splice(0);
    Math.random = rngOld;
    try { o.draw(now); } finally { Math.random = real; }
    oldEvents.push(...o.events.splice(0));
    const F = stepWalk(sim, { now, busy, room, here, team: team.map((m) => m.id), hp, things: thingsNew, rng: rngNew });
    const a = JSON.stringify(newSide(sim, F)), b = JSON.stringify(oldSide(o, oldEvents));
    if (a !== b) {
      const x = newSide(sim, F) as Record<string, unknown>, y = oldSide(o, oldEvents) as Record<string, unknown>;
      bad.push(`${name} frame ${k}: ${Object.keys(x).filter((q) => JSON.stringify(x[q]) !== JSON.stringify(y[q])).join(", ")}`);
    }
    // The floorplan changed (a tunnel shut behind you): the screen starts its loop afresh on the new one.
    if (sim.progress !== liveFor) {
      liveFor = sim.progress;
      live = shutPlan(s.plan, s.layout, sim.progress);
      restartLoop(sim, live, hp, now); o.restart(live, now, hp);
    }
  }
  return { bad, frames: k, seen: { spotted: sim.fired > 0 || sim.alarm !== null, cuts: sim.cuts.length, heal: sim.fires.some((f, i) => f.left !== (walk.fires ?? [])[i]?.left) } };
}

describe("the walk going on, out of the walk screen (world-spec §8)", () => {
  it("encampment-mid, a short session: frame by frame, the same as the walk screen's own logic", () => {
    const r = session("encampment-mid", 800);
    expect(r.bad).toEqual([]);
    expect(r.frames).toBe(800);
  });
  // (The full sessions take seconds each: in the full suite.)
  for (const name of ["encampment-fresh", "encampment-mid", "encampment-top", "encampment-before-pillars", "cyclops-fresh", "cyclops-mid"]) {
    slowIt(`${name}: frame by frame, the same as the walk screen's own logic`, () => {
      expect(session(name, 3000).bad).toEqual([]);
    });
  }
  slowIt("the sessions cover what they mean to: seen by foes, a tunnel shut behind you, a campfire's healing", () => {
    const runs = ["encampment-fresh", "encampment-mid"].map((n) => session(n, 3000).seen);
    expect(runs.some((r) => r.spotted)).toBe(true);
    expect(runs.some((r) => r.cuts > 0)).toBe(true);
    expect(runs.some((r) => r.heal)).toBe(true);
  });
});
