import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { slowIt } from "./slow";
import { walkSetup, seeded, digest } from "./walkBaseline";
import { oldDraw, OLD_KIT } from "./sceneBefore";
import { buildScene, type SceneInput, type DrawCmd } from "../lib/render/scene";
import { paintScene, type DarkLayer } from "../lib/render/paint";
import { startWalk, restartLoop, stepWalk, type WalkSim } from "../lib/world/walkSim";
import { thingsOf } from "../lib/world/walkWorld";
import { depthEdges } from "../lib/dungeon/tileArt";
import { shutPlan } from "../lib/dungeon/torch";
import { roomCentre, waysOn } from "../lib/dungeon/layout";
import { walkToward } from "../lib/dungeon/walk";
import type { DungeonRun } from "../lib/dungeon/run";

// The scene builder (lib/render/scene.ts), the walk screen's drawing moved out
// in phase 1 (docs/world-spec.md §8):
// - against the drawing as it stood before the move (tests/sceneBefore.ts, the
//   same lines verbatim, with the mossy kit it was written for), on a stand-in canvas that writes down every call:
//   painting the builder's list must make exactly the same calls, in order,
//   frame after frame (the dark's pixels compared too), over sessions on
//   every saved run, with pictures loaded or not;
// - and its draw list for fixed states, pinned (tests/golden/walk/*.draw.json,
//   taken right after the move; UPDATE_GOLDEN=1 rewrites them, only for a
//   change the user has approved).

const FIXTURES = path.join(__dirname, "fixtures", "walk");
const GOLDEN = path.join(__dirname, "golden", "walk");
const NAMES = fs.readdirSync(FIXTURES).map((f) => f.replace(/\.json$/, ""));
const fixture = (name: string): DungeonRun => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8"));

// A canvas that writes down what's done to it. A gradient is written down when it's used, as its circles and stops.
type Shade = { data: Uint8ClampedArray; width: number };
function standIn(log: unknown[]) {
  const gradient = (...glow: number[]) => { const g = { glow, stops: [] as unknown[], addColorStop: (at: number, c: string) => { g.stops.push([at, c]); } }; return g; };
  const val = (v: unknown) => (v && typeof v === "object" && "glow" in v ? { glow: (v as { glow: unknown }).glow, stops: (v as unknown as { stops: unknown }).stops } : v);
  const arg = (v: unknown) => (v && typeof v === "object" && "src" in v ? (v as { src: string }).src : v && typeof v === "object" && "shade" in v ? `dark ${digest((v as { shade: Shade }).shade.data)}` : v);
  return new Proxy({} as Record<string, unknown>, {
    get: (_, k: string) => (k === "createRadialGradient" ? gradient : (...a: unknown[]) => { log.push([k, ...a.map(arg)]); }),
    set: (_, k: string, v) => { log.push(["set", k, val(v)]); return true; },
  });
}
const darkLayer = (plan: { w: number; h: number }) => {
  const shade: Shade = { data: new Uint8ClampedArray(plan.w * plan.h * 4), width: plan.w };
  return { canvas: { shade }, ctx: { putImageData: () => {} }, shade } as unknown as DarkLayer & { shade: Shade };
};

// A session on a saved run: the walk going on, with `ready` deciding which pictures have loaded.
function* session(name: string, opts: { frames: number; seeAll?: boolean; decor?: boolean; ready?: (src: string) => boolean; busy?: boolean }) {
  const run = fixture(name), walk = run.walk!;
  const s = walkSetup(run, !!opts.decor);
  const known = opts.seeAll ? new Uint8Array(s.plan.w * s.plan.h).fill(1) : s.known;
  const sim: WalkSim = startWalk(walk, s.plan, s.live, { sconces: s.sconces, candles: s.candles, foes: s.foes, npcs: s.npcs }, known);
  let live = s.live, edges = depthEdges(live), liveFor = sim.progress, now = 1000;
  restartLoop(sim, live, run.hp, now);
  const ahead = waysOn(s.layout, sim.progress)[0];
  if (ahead && !opts.busy) sim.me = walkToward(live, sim.me, roomCentre(s.layout.rooms[ahead.to.room]), s.canWalk);
  const rng = seeded(walk.seed + 3);
  for (let k = 0; k < opts.frames; k++) {
    now += 16 + (k % 5);
    const things = () => thingsOf(s.layout, s.placed, s.ids, s.room, sim.npcs, walk.spots, s.dungeon);
    const frame = stepWalk(sim, { now, busy: !!opts.busy, room: s.room, here: run.path[run.path.length - 1], team: ["a", "b"], hp: run.hp, things, rng });
    if (frame.draw) {
      const input: SceneInput = { sim, frame, plan: s.plan, live, edges, layout: s.layout, decor: !!opts.decor, decorItems: s.decorItems, banners: s.banners, seed: walk.seed,
        room: s.room, things: things(), now, w: 390, h: 693, ready: opts.ready ?? (() => true), random: seeded(k + 1) };
      yield { input, again: () => ({ ...input, random: seeded(k + 1) }), plan: s.plan };
    }
    if (sim.progress !== liveFor) { liveFor = sim.progress; live = shutPlan(s.plan, s.layout, sim.progress); edges = depthEdges(live); restartLoop(sim, live, run.hp, now); }
  }
}

function compare(name: string, opts: Parameters<typeof session>[1]) {
  const bad: string[] = [];
  let calls = 0, frames = 0, plan: { w: number; h: number } | null = null, darkOld: Shade | null = null, darkNew: (DarkLayer & { shade: Shade }) | null = null;
  for (const { input, again, plan: p } of session(name, opts)) {
    if (!plan) { plan = p; darkOld = { data: new Uint8ClampedArray(p.w * p.h * 4), width: p.w }; darkNew = darkLayer(p); }
    const a: unknown[] = [], b: unknown[] = [];
    const mask = { shade: darkOld! };
    oldDraw(input, standIn(a), { putImageData: () => {} }, mask, darkOld!);
    // (With the kit the old drawing was written for: the walls' art has moved on since.)
    const scene = buildScene({ ...again(), kit: OLD_KIT });
    paintScene(standIn(b) as unknown as CanvasRenderingContext2D, scene.cmds, (src) => ({ src }) as unknown as CanvasImageSource, darkNew!);
    for (const key of scene.settled) input.sim.falls.delete(key);
    frames++;
    calls = Math.min(calls || Infinity, a.length);
    const x = JSON.stringify(a), y = JSON.stringify(b);
    if (x !== y) {
      const i = a.findIndex((c, k) => JSON.stringify(c) !== JSON.stringify(b[k]));
      bad.push(`${name} frame ${frames}: call ${i} of ${a.length}/${b.length}: ${JSON.stringify(a[i])} vs ${JSON.stringify(b[i])}`);
      break;
    }
  }
  return { bad, frames, calls };
}

// Pictures that "haven't loaded": some of them, picked by their address.
const someLoaded = (src: string) => digest(src).charCodeAt(7) % 3 !== 0;

describe("the scene builder: the walk screen's drawing, moved (world-spec §8)", () => {
  it("encampment-mid, a short walk: the same canvas calls, frame by frame", () => {
    const r = compare("encampment-mid", { frames: 120 });
    expect(r.bad).toEqual([]);
    expect(r.frames).toBeGreaterThan(100);
    expect(r.calls).toBeGreaterThan(200); // (every frame draws: floors, walls, you, the light)
  });
  it("encampment-top, seen all, with the lab's decor and some pictures not loaded: the same calls", () => {
    expect(compare("encampment-top", { frames: 60, seeAll: true, decor: true, ready: someLoaded }).bad).toEqual([]);
  });
  // (Longer sessions on every saved run: in the full suite.)
  for (const name of NAMES) {
    slowIt(`${name}: the same canvas calls over a long walk, as saved and seen all with decor`, () => {
      expect(compare(name, { frames: 900 }).bad).toEqual([]);
      expect(compare(name, { frames: 300, seeAll: true, decor: true }).bad).toEqual([]);
      expect(compare(name, { frames: 120, ready: someLoaded }).bad).toEqual([]);
    });
  }
});

// The draw list, written so a change shows line by line: a command a line, numbers to 3 places, the dark as a fingerprint.
const line = (c: DrawCmd) => c.map((v) => (typeof v === "number" ? +v.toFixed(3) : v && typeof v === "object" && "alpha" in v ? `dark ${(v as unknown as { w: number }).w}x${(v as unknown as { h: number }).h} ${digest((v as { alpha: Uint8Array }).alpha)}`
  : v && typeof v === "object" && "glow" in v ? { glow: (v as { glow: number[] }).glow.map((n) => +n.toFixed(3)), stops: (v as unknown as { stops: unknown }).stops } : v));
function golden(file: string, value: unknown) {
  const at = path.join(GOLDEN, file);
  const now = JSON.parse(JSON.stringify(value));
  if (process.env.UPDATE_GOLDEN === "1" || !fs.existsSync(at)) fs.writeFileSync(at, "[\n" + now.map((c: unknown) => JSON.stringify(c)).join(",\n") + "\n]\n");
  expect(now).toEqual(JSON.parse(fs.readFileSync(at, "utf8")));
}
describe("the draw list for fixed states, pinned (world-spec §8)", () => {
  for (const name of ["encampment-mid", "encampment-top", "cyclops-fresh"]) {
    const it2 = name.startsWith("cyclops") ? slowIt : it;
    it2(`${name}: frozen where it was saved`, () => {
      const { input } = session(name, { frames: 1, busy: true }).next().value!;
      golden(`${name}.draw.json`, buildScene(input).cmds.map(line));
    });
  }
  it("encampment-mid, seen all with the lab's decor, walking", () => {
    let last: SceneInput | null = null;
    for (const { input } of session("encampment-mid", { frames: 40, seeAll: true, decor: true })) last = input;
    golden("encampment-mid-decor.draw.json", buildScene(last!).cmds.map(line));
  });
});

describe("a lit candle stays lit out of sight (the user, 2026-11-07)", () => {
  it("its flame is drawn over the dark whether you can see it or not", () => {
    const { input } = session("encampment-mid", { frames: 1, busy: true, seeAll: true }).next().value!;
    const c = input.sim.candles[0];
    expect(c).toBeDefined();
    c.lit = true;
    input.sim.me = { ...input.sim.me, x: c.x, y: c.y + 1 };
    const flames = (seen: typeof c[]) => {
      const cmds = buildScene({ ...input, frame: { ...input.frame, candlesSeen: seen } }).cmds;
      const dark = cmds.findIndex((k) => k[0] === "dark");
      return cmds.slice(dark).filter((k) => k[0] === "drawImage" && k[1] === "/sprites/walk/candle-lit.png").length;
    };
    expect(flames([c])).toBe(1);
    expect(flames([])).toBe(1);
    c.lit = false;
    expect(flames([])).toBe(0);
  });
});
