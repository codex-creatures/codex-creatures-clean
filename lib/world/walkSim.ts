// lib/world/walkSim.ts
// The walkable rooms going on, a frame at a time (docs/world-spec.md §5.4):
// you walking, your torch and the lights in sight showing what's round you,
// walking into rooms (a tunnel closing behind you, falling in if you'd seen
// it), foes and the card witch about, a room's foes seeing you and coming at
// you, walking up to a thing you tapped, and a campfire healing your team.
// Moved out of the walk screen (components/WalkView.tsx) in phase 1, line for
// line: the screen runs the frame loop and draws; this decides.
//
// The state is kept between frames and changed in place (as the screen's refs
// were). Each frame hands back what happened, in order, for the screen to pass
// on (onEnter, onSpotted, onObject, onCage, onHeal, onKeep, the campfire
// window), each with the walk's state as it stood at that moment.

import { cutOffY, enter, isOpen, type Layout, type Progress } from "../dungeon/layout";
import { advance, roomAt, type CanStep, type Walker } from "../dungeon/walk";
import { facingOf, type Facing } from "../dungeon/tileArt";
import { torchLit, rubbleOf, fallenIn, showsRubble, canIgnite, sconceInSight, fireInSight, torchReach, SCONCE_RADIUS, CANDLE_RADIUS, type Sconce, type Candle } from "../dungeon/torch";
import { byFire, warmBy, CAMPFIRE_LIGHT, EMBER_LIGHT, type Campfire } from "../dungeon/campfire";
import { spottedBy, stepFoe, chargePath, chargeFoe, fightReady, parentOf, ALARM_PAUSE, ALARM_LIGHT, ARRIVE, FADE_TIME, type Foe } from "../dungeon/foes";
import { hasFight, type Room } from "../dungeon/run";
import type { WalkRun } from "../dungeon/walkRun";
import { ROCK, type Floorplan, type Pt } from "../dungeon/floorplan";
import { inReach, approach, toRuns, type Thing } from "./walkWorld";

export const NPC_STILL = 4;      // u: a wanderer stops to let you come up to it
export const NPC_SPEED = 0.6;    // …and walks about at this share of a foe's pace
export const KEEP_EVERY = 5000;  // ms: your spot's saved this often while you walk
export const HEAL_EVERY = 400;   // ms: health from a campfire is handed back this often
export const SHOW_EVERY = 100;   // ms: the campfire window updates this often
export const OUT_SHOW = 1500;    // ms the campfire window stays up after the fire's burnt down
export const TRAIL_MAX = 3000;   // cells of your trail kept for the scroll
export const FIRED_WAIT = 2000;  // ms: a fight called for that hasn't started by then: carry on

// What the screen saves of the walk (WalkRun's parts that change as you go).
export type WalkState = Pick<WalkRun, "at" | "room" | "line" | "known" | "lit" | "trail" | "cuts" | "fires" | "flare">;
// The campfire window: the team's health as it heals, who's getting some, what the fire has left.
export type Warming = { hp: Record<string, number>; giving: string[]; left: number };
// Seen: whose room, when (ms), the foes that have set off and reached you (by index: seconds after), the fade's start.
export type Alarm = { room: string; at: number; going: Set<number>; arrived: Map<number, number>; fadeAt: number | null };

export type WalkSim = {
  layout: Layout; plan: Floorplan;
  live: Floorplan;                   // the floorplan as it stands: closed tunnels are rock (torch.ts shutPlan)
  me: Walker; facing: Facing; walked: number;
  goal: Pt | null;                   // where you tapped to walk (to find the way again if a tunnel shuts under it)
  progress: Progress;
  known: Uint8Array; lightNow: Uint8Array; trail: Pt[]; cuts: number[];
  sconces: Sconce[]; candles: Candle[]; fires: Campfire[]; foes: Foe[]; npcs: Foe[];
  flareLeft: number;                 // cells of walking left with a flare's light
  falls: Map<string, number>;        // tunnels falling in (rubble key: when, ms)
  shakeAt: number;                   // when the screen last shook (ms)
  wantThing: string | null;          // walking up to this thing (its key), to open it
  fired: number;                     // when a fight was called for (0: none): once, till it starts
  alarm: Alarm | null;
  loop: Loop;
};
// What a run of the frame loop keeps to itself (begun afresh whenever the
// floorplan changes, as the walk screen's loop always was): lights worked out
// on this floorplan, health from a campfire not yet handed back, and when
// things were last saved and shown.
type Loop = {
  lightOf: Map<string, Uint8Array>;
  pending: Record<string, number>; sent: Record<string, number>; sentFor: Record<string, number>;
  healedAt: number; shownAt: number; outAt: number; showing: boolean;
  last: number; kept: number; movedSince: boolean; inRoom: string | null;
};

// The walk as it opens: from the saved run, with what walkWorld.ts placed.
// How an NPC walks (world-spec §5.7): its own rule, kept apart from the foes'
// and yours so wandering NPCs can change it alone. Today, the card witch's: a
// foe's wandering in her own room, at NPC_SPEED of its pace.
export const stepNpc = (fp: Floorplan, n: Foe, seconds: number, rng: () => number): Foe => stepFoe(fp, n, seconds * NPC_SPEED, rng);

export function startWalk(walk: WalkRun, plan: Floorplan, live: Floorplan, placed: { sconces: Sconce[]; candles: Candle[]; foes: Foe[]; npcs: Foe[] }, known: Uint8Array): WalkSim {
  return {
    layout: walk.layout, plan, live,
    me: { ...walk.at, path: [] }, facing: "south", walked: 0, goal: null, // (facing you to start: the torch shows)
    progress: { room: walk.room, line: walk.line ?? Infinity },
    known, lightNow: new Uint8Array(plan.w * plan.h), trail: walk.trail ?? [walk.at], cuts: walk.cuts ?? [],
    sconces: placed.sconces, candles: placed.candles, fires: (walk.fires ?? []).map((f) => ({ ...f })), foes: placed.foes, npcs: placed.npcs,
    flareLeft: walk.flare ?? 0, falls: new Map(), shakeAt: -Infinity, wantThing: null, fired: 0, alarm: null,
    loop: newLoop(plan, { x: walk.at.x, y: walk.at.y }, {}, 0),
  };
}
const newLoop = (plan: Floorplan, me: Pt, hp: Record<string, number>, now: number): Loop => ({
  lightOf: new Map(), pending: {}, sent: {}, sentFor: hp, healedAt: now, shownAt: 0, outAt: -Infinity, showing: false,
  last: now, kept: now, movedSince: false, inRoom: roomAt(plan, me),
});
// A fresh run of the frame loop, on the floorplan as it now stands.
export function restartLoop(sim: WalkSim, live: Floorplan, hp: Record<string, number>, now: number) {
  sim.live = live;
  sim.loop = newLoop(sim.plan, sim.me, hp, now);
}

// The walk's state to save, as it stands.
export const walkState = (sim: WalkSim): WalkState => ({
  at: { x: Math.round(sim.me.x), y: Math.round(sim.me.y) }, room: sim.progress.room,
  line: sim.progress.line === Infinity ? null : sim.progress.line,
  known: toRuns(sim.known), lit: [...sim.sconces, ...sim.candles].filter((c) => c.lit).map((c) => c.id),
  trail: sim.trail.slice(-TRAIL_MAX), cuts: sim.cuts, fires: sim.fires.map((f) => ({ ...f })), flare: Math.round(sim.flareLeft),
});

// The lights, worked out once per floorplan: a wall torch, a campfire (burning or embers), a candle.
// (A torch in a tunnel that's fallen in is gone with it.)
export const torchThere = (sim: WalkSim, c: Sconce) => sim.live.tiles[c.y * sim.plan.w + c.x] !== ROCK;
export const fireReach = (f: Campfire) => (f.left > 0 ? CAMPFIRE_LIGHT : EMBER_LIGHT);
const cached = (sim: WalkSim, id: string, at: Pt, radius: number) => {
  let a = sim.loop.lightOf.get(id);
  if (!a) { a = torchLit(sim.live, at, radius); sim.loop.lightOf.set(id, a); }
  return a;
};
export const sconceLight = (sim: WalkSim, c: Sconce) => cached(sim, c.id, c, SCONCE_RADIUS);
export const fireLight = (sim: WalkSim, f: Campfire) => cached(sim, `fire:${f.room}:${fireReach(f)}`, f, fireReach(f));
export const candleLight = (sim: WalkSim, c: Candle) => cached(sim, c.id, c, CANDLE_RADIUS);

export type WalkEvent =
  | { type: "progress"; progress: Progress }
  | { type: "enter"; room: string; state: WalkState }
  | { type: "spotted"; room: string; state: WalkState }
  | { type: "use"; thing: Thing; state: WalkState }
  | { type: "heal"; gains: Record<string, number>; state: WalkState }
  | { type: "keep"; state: WalkState }
  | { type: "warming"; warming: Warming | null };

// What the frame's picture needs from the frame (the rest it reads from the sim).
export type Frame = {
  draw: boolean;            // false: you've just been seen (the picture holds this frame)
  busy: boolean; alarm: Alarm | null; reachNow: number;
  candlesSeen: Candle[]; fireSeen: Campfire[]; alarmed: Foe[]; foeLight: Uint8Array[]; giving: string[];
  events: WalkEvent[];
};
// The screen's side: the time (ms), whether a window's over the walk, the
// rooms as they stand, the room you're in, your team and its health, the
// things to tap now; rng for the foes' wandering.
export type FrameInput = {
  now: number; busy: boolean; room: (id: string) => Room | undefined; here: string;
  team: string[]; hp: Record<string, number>; things: () => Thing[]; rng?: () => number;
};

// Tried to open a chest its guards still stand round: they've seen you (as
// if one had spotted you), and the fight follows once they reach you.
export function soundAlarm(sim: WalkSim, room: string, now: number) {
  if (sim.alarm || sim.fired) return;
  sim.alarm = { room, at: now, going: new Set(), arrived: new Map(), fadeAt: null };
  sim.me = { x: Math.round(sim.me.x), y: Math.round(sim.me.y), path: [] };
  sim.goal = null;
  sim.wantThing = null;
}

// A tap on a thing (walkWorld.ts tappedThing picks it): "use" if you're in reach
// of it now; else set off up beside it ("walking": stepWalk opens it once you're
// in reach, its "use" event); "none" if there's no way up to it.
export function walkUpTo(sim: WalkSim, t: Thing, live: Floorplan, can: CanStep): "use" | "walking" | "none" {
  if (inReach(t, sim.me)) return "use";
  const from = sim.me.path[0] ?? { x: Math.round(sim.me.x), y: Math.round(sim.me.y) };
  const best = approach(live, t, from, can);
  if (!best) return "none";
  sim.goal = null;
  sim.wantThing = t.key;
  sim.me = { ...sim.me, path: sim.me.path.length > 0 ? [from, ...best] : best };
  return "walking";
}

export function stepWalk(sim: WalkSim, input: FrameInput): Frame {
  const { now, room, here, things, rng = Math.random } = input;
  const L = sim.loop, live = sim.live, layout = sim.layout, plan = sim.plan;
  const events: WalkEvent[] = [];
  const dt = Math.min(now - L.last, 100) / 1000;
  L.last = now;
  if (sim.fired && now - sim.fired > FIRED_WAIT) { sim.fired = 0; sim.alarm = null; } // (it didn't start: carry on)
  const busy = input.busy || sim.fired > 0, A = sim.alarm;
  const before = { x: sim.me.x, y: sim.me.y };
  if (!busy && !A) sim.me = advance(sim.me, dt);
  const moved = Math.hypot(sim.me.x - before.x, sim.me.y - before.y);
  if (moved > 0) sim.flareLeft = Math.max(0, sim.flareLeft - moved);
  const reachNow = torchReach(sim.flareLeft);
  if (moved > 0) { sim.walked += moved; L.movedSince = true; sim.facing = facingOf(sim.me.x - before.x, sim.me.y - before.y, sim.facing); }
  // The torch: what it lights now, remembered from now on; the wall torches.
  sim.lightNow = torchLit(live, sim.me, reachNow);
  const lightNow = sim.lightNow;
  let lighted = false;
  for (const c of sim.sconces) {
    if (!torchThere(sim, c)) continue;
    if (!busy && canIgnite(live, c, sim.me)) { c.lit = true; lighted = true; }
    if (sconceInSight(live, c, sim.me)) {
      const a = sconceLight(sim, c);
      for (let i = 0; i < a.length; i++) if (a[i]) lightNow[i] = 1;
    }
  }
  for (const c of sim.candles) if (!busy && canIgnite(live, c, sim.me)) { c.lit = true; lighted = true; }
  const candlesSeen = sim.candles.filter((c) => c.lit && fireInSight(live, c, sim.me));
  for (const c of candlesSeen) { const a = candleLight(sim, c); for (let i = 0; i < a.length; i++) if (a[i]) lightNow[i] = 1; }
  const fireSeen = sim.fires.filter((f) => fireInSight(live, f, sim.me));
  for (const f of fireSeen) { const a = fireLight(sim, f); for (let i = 0; i < a.length; i++) if (a[i]) lightNow[i] = 1; }
  const alarmed = A ? sim.foes.filter((f) => f.room === A.room) : [];
  const foeLight = alarmed.map((f) => torchLit(live, f, ALARM_LIGHT));
  for (const a of foeLight) for (let i = 0; i < a.length; i++) if (a[i]) lightNow[i] = 1;
  for (let i = 0; i < lightNow.length; i++) if (lightNow[i]) sim.known[i] = 1;
  const step = { x: Math.round(sim.me.x), y: Math.round(sim.me.y) }, prev = sim.trail[sim.trail.length - 1];
  if (!prev || prev.x !== step.x || prev.y !== step.y) sim.trail.push(step);
  // Into a room: maybe up a tunnel (what's behind closes, falling in if you'd seen it).
  const nowIn = roomAt(plan, sim.me);
  if (nowIn && nowIn !== L.inRoom) {
    L.inRoom = nowIn;
    const next = enter(layout, sim.progress, nowIn);
    if (next !== sim.progress) {
      if (next.line !== sim.progress.line) {
        sim.cuts.push(cutOffY(next, layout));
        const was = new Set(rubbleOf(plan, layout, sim.progress).map((r) => r.key));
        for (const r of fallenIn(plan, layout, next, sim.known)) if (!was.has(r.key) && showsRubble(r)) sim.falls.set(r.key, now);
        if (sim.falls.size > 0) sim.shakeAt = now;
      }
      sim.progress = next;
      events.push({ type: "progress", progress: next });
    }
    if (nowIn !== here) { events.push({ type: "enter", room: nowIn, state: walkState(sim) }); L.kept = now; L.movedSince = false; }
  }
  // The foes look about; if any of a room's sees you (or you walk into the chief's camp), that room fights you.
  const p = sim.progress;
  const awake = (id: string) => { const r = room(id); return !!r && hasFight(r) && !r.done && isOpen(layout, p, parentOf(id)); };
  sim.foes = sim.foes.filter((f) => awake(f.room) || !isOpen(layout, p, parentOf(f.room)));
  const frame = (draw: boolean): Frame => ({ draw, busy, alarm: A, reachNow, candlesSeen, fireSeen, alarmed, foeLight, giving, events });
  const giving: string[] = [];
  if (!busy && A) {
    // Seen: a "!" a moment, then they come at you; it fades into the fight once they're there.
    const t = (now - A.at) / 1000;
    sim.foes = sim.foes.map((f) => {
      if (f.room !== A.room || A.arrived.has(f.index)) return f;
      let g = f;
      if (t < ALARM_PAUSE) g = { ...g, facing: Math.atan2(sim.me.y - g.y, sim.me.x - g.x) };
      else {
        if (!A.going.has(f.index)) { A.going.add(f.index); g = { ...g, path: chargePath(live, g, sim.me) }; }
        g = chargeFoe(g, dt);
        if (Math.hypot(g.x - sim.me.x, g.y - sim.me.y) <= ARRIVE || g.path.length === 0) A.arrived.set(f.index, t);
      }
      return g;
    });
    const first = alarmed[0];
    if (first) sim.facing = facingOf(first.x - sim.me.x, first.y - sim.me.y, sim.facing);
    if (A.fadeAt === null && fightReady([...A.arrived.values()], alarmed.length, t)) A.fadeAt = now;
    if (A.fadeAt !== null && now - A.fadeAt >= FADE_TIME * 1000) {
      sim.fired = now;
      events.push({ type: "spotted", room: A.room, state: walkState(sim) });
    }
  } else if (!busy) {
    sim.foes = sim.foes.map((f) => stepFoe(live, f, dt, rng));
    // The witch wanders, slowly, and stops (facing you) to let you come up to her.
    sim.npcs = sim.npcs.map((n) => (Math.hypot(n.x - sim.me.x, n.y - sim.me.y) <= NPC_STILL
      ? { ...n, path: [], facing: Math.atan2(sim.me.y - n.y, sim.me.x - n.x) } : stepNpc(live, n, dt, rng)));
    const by = spottedBy(live, sim.foes, sim.me, awake);
    if (by) {
      sim.alarm = { room: by, at: now, going: new Set(), arrived: new Map(), fadeAt: null };
      sim.me = { x: Math.round(sim.me.x), y: Math.round(sim.me.y), path: [] };
      sim.goal = null;
      sim.wantThing = null;
      events.push({ type: "keep", state: walkState(sim) });
      return frame(false);
    }
    // Walking up to a thing you tapped: open it once you're close.
    const want = sim.wantThing && things().find((t) => t.key === sim.wantThing);
    if (want && inReach(want, sim.me)) {
      sim.wantThing = null;
      sim.me = { ...sim.me, path: sim.me.path.slice(0, 1) };
      events.push({ type: "use", thing: want, state: walkState(sim) });
      L.kept = now;
    } else if (want && sim.me.path.length === 0) sim.wantThing = null;
  }
  // By a campfire: the team heals from it, the window shows it, and what it's given is handed back now and then.
  if (input.hp !== L.sentFor) { L.sentFor = input.hp; L.sent = {}; }
  const health = (id: string) => (input.hp[id] ?? 1) + (L.sent[id] ?? 0) + (L.pending[id] ?? 0);
  const fire = !busy && !A ? sim.fires.find((f) => byFire(live, f, sim.me)) : undefined;
  if (fire) {
    const warm = warmBy(Object.fromEntries(input.team.map((id) => [id, health(id)])), input.team, fire.left, dt);
    for (const [id, g] of Object.entries(warm.gains)) if (g > 0) { L.pending[id] = (L.pending[id] ?? 0) + g; giving.push(id); }
    fire.left = warm.left;
    if (fire.left === 0) L.outAt = now;
  }
  if (Object.keys(L.pending).length > 0 && (giving.length === 0 || now - L.healedAt > HEAL_EVERY)) {
    for (const [id, g] of Object.entries(L.pending)) L.sent[id] = (L.sent[id] ?? 0) + g;
    const gains = L.pending;
    L.pending = {};
    L.healedAt = now;
    L.kept = now;
    L.movedSince = false;
    events.push({ type: "heal", gains, state: walkState(sim) });
  }
  const show = !!fire || now - L.outAt < OUT_SHOW;
  if (show && now - L.shownAt > SHOW_EVERY) {
    L.shownAt = now;
    L.showing = true;
    events.push({ type: "warming", warming: { hp: Object.fromEntries(input.team.map((id) => [id, Math.min(1, health(id))])), giving, left: fire?.left ?? 0 } });
  } else if (!show && L.showing) { L.showing = false; events.push({ type: "warming", warming: null }); }
  if (lighted || (L.movedSince && (now - L.kept > KEEP_EVERY || input.busy))) { L.kept = now; L.movedSince = false; events.push({ type: "keep", state: walkState(sim) }); }
  return frame(true);
}
