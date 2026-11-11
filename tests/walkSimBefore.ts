// tests/walkSimBefore.ts
// The walk screen's frame logic as it stood before phase 1 moved it into
// lib/world/walkSim.ts (components/WalkView.tsx at 3e4e8a1, its draw loop up
// to "── Drawing ──"), copied with its refs, so tests/walkSim.test.ts can run
// the two side by side and show the move changed nothing. Only the props
// (P), React's setters and the clock are stand-ins; the rest is verbatim.

import { cutOffY, enter, isOpen, type Layout, type Progress } from "../lib/dungeon/layout";
import { advance, roomAt, type Walker } from "../lib/dungeon/walk";
import { facingOf, type Facing } from "../lib/dungeon/tileArt";
import { torchLit, rubbleOf, fallenIn, canIgnite, sconceInSight, fireInSight, torchReach, SCONCE_RADIUS, CANDLE_RADIUS, type Sconce, type Candle } from "../lib/dungeon/torch";
import { byFire, warmBy, CAMPFIRE_LIGHT, EMBER_LIGHT, type Campfire } from "../lib/dungeon/campfire";
import { foeClear } from "../lib/world/walkSim";
import { spottedBy, stepFoe, chargePath, chargeFoe, fightReady, parentOf, ALARM_PAUSE, ALARM_LIGHT, ARRIVE, FADE_TIME, type Foe } from "../lib/dungeon/foes";
import { hasFight, type Room } from "../lib/dungeon/run";
import { ROCK, type Floorplan, type Pt } from "../lib/dungeon/floorplan";
import { inReach, toRuns, type Thing } from "../lib/world/walkWorld";

const NPC_STILL = 4, NPC_SPEED = 0.6, KEEP_EVERY = 5000, HEAL_EVERY = 400, SHOW_EVERY = 100, OUT_SHOW = 1500, TRAIL_MAX = 3000;
type Ref<T> = { current: T };
const ref = <T,>(v: T): Ref<T> => ({ current: v });

export type OldProps = { here: string; room: (id: string) => Room | undefined; busy: boolean; team: { id: string }[]; hp: Record<string, number> };
export type OldEvent = { type: string; [k: string]: unknown };

export function oldWalk(o: {
  layout: Layout; plan: Floorplan; live: Floorplan; at: Pt; progress: Progress; known: Uint8Array; trail: Pt[]; cuts: number[];
  sconces: Sconce[]; candles: Candle[]; fires: Campfire[]; foes: Foe[]; npcs: Foe[]; flare: number;
}) {
  const { layout, plan } = o;
  const me = ref<Walker>({ ...o.at, path: [] }), goal = ref<Pt | null>(null), progressRef = ref(o.progress);
  const known = ref(o.known), lightNow = ref<Uint8Array>(new Uint8Array(plan.w * plan.h)), trail = ref(o.trail), cuts = ref(o.cuts);
  const sconces = ref(o.sconces), candles = ref(o.candles), fires = ref(o.fires), foes = ref(o.foes), npcs = ref(o.npcs);
  const flareLeft = ref(o.flare), facing = ref<Facing>("south"), walked = ref(0), falls = ref(new Map<string, number>()), shakeAt = ref(-Infinity);
  const wantThing = ref<string | null>(null), fired = ref(0);
  const alarm = ref<{ room: string; at: number; going: Set<number>; arrived: Map<number, number>; fadeAt: number | null } | null>(null);
  const events: OldEvent[] = [];
  const props: Ref<OldProps & { things: () => Thing[] }> = ref(null as never);
  const state = () => ({
    at: { x: Math.round(me.current.x), y: Math.round(me.current.y) }, room: progressRef.current.room,
    line: progressRef.current.line === Infinity ? null : progressRef.current.line,
    known: toRuns(known.current), lit: [...sconces.current, ...candles.current].filter((c) => c.lit).map((c) => c.id),
    trail: trail.current.slice(-TRAIL_MAX), cuts: cuts.current, fires: fires.current.map((f) => ({ ...f })), flare: Math.round(flareLeft.current),
  });
  const setProgress = (p: Progress) => events.push({ type: "progress", progress: p });
  const setWarming = (w: unknown) => events.push({ type: "warming", warming: w });
  const things = () => props.current.things();
  const openThing = (t: Thing, st: unknown) => events.push({ type: "use", thing: t, state: st });
  let live = o.live;
  let out: { draw: boolean; busy: boolean; reachNow: number; candlesSeen: Candle[]; fireSeen: Campfire[]; alarmed: Foe[]; foeLight: Uint8Array[]; giving: string[] } | null = null;

  // ── The effect's set-up and draw(), verbatim but for P and the callbacks. ──
  let w = plan.w;
  let lightOf = new Map<string, Uint8Array>();
  const sconceLight = (c: Sconce) => {
    let a = lightOf.get(c.id);
    if (!a) { a = torchLit(live, c, SCONCE_RADIUS); lightOf.set(c.id, a); }
    return a;
  };
  const there = (c: Sconce) => live.tiles[c.y * w + c.x] !== ROCK;
  const fireReach = (f: Campfire) => (f.left > 0 ? CAMPFIRE_LIGHT : EMBER_LIGHT);
  const fireLight = (f: Campfire) => {
    const id = `fire:${f.room}:${fireReach(f)}`;
    let a = lightOf.get(id);
    if (!a) { a = torchLit(live, f, fireReach(f)); lightOf.set(id, a); }
    return a;
  };
  let pending: Record<string, number> = {}, sent: Record<string, number> = {}, sentFor: Record<string, number> = {};
  let healedAt = 0, shownAt = 0, outAt = -Infinity, showing = false;
  let last = 0, kept = 0, movedSince = false, inRoom: string | null = null;
  // (The effect re-running: the floorplan changed.)
  const restart = (plan2: Floorplan, now: number, hp: Record<string, number>) => {
    live = plan2; w = plan.w; lightOf = new Map();
    pending = {}; sent = {}; sentFor = hp;
    healedAt = now; shownAt = 0; outAt = -Infinity; showing = false;
    last = now; kept = now; movedSince = false; inRoom = roomAt(plan, me.current);
  };
  const draw = (now: number) => {
    out = null;
    const dt = Math.min(now - last, 100) / 1000;
    last = now;
    if (fired.current && now - fired.current > 2000) { fired.current = 0; alarm.current = null; } // (it didn't start: carry on)
    const P = props.current, busy = P.busy || fired.current > 0, A = alarm.current;
    const before = { x: me.current.x, y: me.current.y };
    if (!busy && !A) me.current = advance(me.current, dt);
    const moved = Math.hypot(me.current.x - before.x, me.current.y - before.y);
    if (moved > 0) flareLeft.current = Math.max(0, flareLeft.current - moved);
    const reachNow = torchReach(flareLeft.current);
    if (moved > 0) { walked.current += moved; movedSince = true; facing.current = facingOf(me.current.x - before.x, me.current.y - before.y, facing.current); }
    lightNow.current = torchLit(live, me.current, reachNow);
    let lighted = false;
    for (const c of sconces.current) {
      if (!there(c)) continue;
      if (!busy && canIgnite(live, c, me.current)) { c.lit = true; lighted = true; }
      if (sconceInSight(live, c, me.current)) {
        const a = sconceLight(c);
        for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
      }
    }
    for (const c of candles.current) if (!busy && canIgnite(live, c, me.current)) { c.lit = true; lighted = true; }
    const candlesSeen = candles.current.filter((c) => c.lit && fireInSight(live, c, me.current));
    const candleLight = (c: Candle) => {
      let a = lightOf.get(c.id);
      if (!a) { a = torchLit(live, c, CANDLE_RADIUS); lightOf.set(c.id, a); }
      return a;
    };
    for (const c of candlesSeen) { const a = candleLight(c); for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1; }
    const fireSeen = fires.current.filter((f) => fireInSight(live, f, me.current));
    for (const f of fireSeen) { const a = fireLight(f); for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1; }
    const alarmed = A ? foes.current.filter((f) => f.room === A.room) : [];
    const foeLight = alarmed.map((f) => torchLit(live, f, ALARM_LIGHT));
    for (const a of foeLight) for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
    for (let i = 0; i < lightNow.current.length; i++) if (lightNow.current[i]) known.current[i] = 1;
    const step = { x: Math.round(me.current.x), y: Math.round(me.current.y) }, prev = trail.current[trail.current.length - 1];
    if (!prev || prev.x !== step.x || prev.y !== step.y) trail.current.push(step);
    const now_in = roomAt(plan, me.current);
    if (now_in && now_in !== inRoom) {
      inRoom = now_in;
      const next = enter(layout, progressRef.current, now_in);
      if (next !== progressRef.current) {
        if (next.line !== progressRef.current.line) {
          cuts.current.push(cutOffY(next, layout));
          const was = new Set(rubbleOf(plan, layout, progressRef.current).map((r) => r.key));
          for (const r of fallenIn(plan, layout, next, known.current)) if (!was.has(r.key)) falls.current.set(r.key, now);
          if (falls.current.size > 0) shakeAt.current = now;
        }
        progressRef.current = next;
        setProgress(next);
      }
      if (now_in !== P.here) { events.push({ type: "enter", room: now_in, state: state() }); kept = now; movedSince = false; }
    }
    const p = progressRef.current;
    const awake = (id: string) => { const r = P.room(id); return !!r && hasFight(r) && !r.done && isOpen(layout, p, parentOf(id)); };
    foes.current = foes.current.filter((f) => awake(f.room) || !isOpen(layout, p, parentOf(f.room)));
    // (Since: foes keep round anything solid, the user, 2026-11-12: the sim's foeClear, the one change made here.)
    const clear = foeClear(things, fires.current);
    if (!busy && A) {
      const t = (now - A.at) / 1000;
      foes.current = foes.current.map((f) => {
        if (f.room !== A.room || A.arrived.has(f.index)) return f;
        let g = f;
        if (t < ALARM_PAUSE) g = { ...g, facing: Math.atan2(me.current.y - g.y, me.current.x - g.x) };
        else {
          if (!A.going.has(f.index)) { A.going.add(f.index); g = { ...g, path: chargePath(live, g, me.current, clear) }; }
          g = chargeFoe(g, dt);
          if (Math.hypot(g.x - me.current.x, g.y - me.current.y) <= ARRIVE || g.path.length === 0) A.arrived.set(f.index, t);
        }
        return g;
      });
      const first = alarmed[0];
      if (first) facing.current = facingOf(first.x - me.current.x, first.y - me.current.y, facing.current);
      if (A.fadeAt === null && fightReady([...A.arrived.values()], alarmed.length, t)) A.fadeAt = now;
      if (A.fadeAt !== null && now - A.fadeAt >= FADE_TIME * 1000) {
        fired.current = now;
        events.push({ type: "spotted", room: A.room, state: state() });
      }
    } else if (!busy) {
      foes.current = foes.current.map((f) => stepFoe(live, f, dt, undefined, clear));
      npcs.current = npcs.current.map((n) => (Math.hypot(n.x - me.current.x, n.y - me.current.y) <= NPC_STILL
        ? { ...n, path: [], facing: Math.atan2(me.current.y - n.y, me.current.x - n.x) } : stepFoe(live, n, dt * NPC_SPEED, undefined, clear)));
      const by = spottedBy(live, foes.current, me.current, awake);
      if (by) {
        alarm.current = { room: by, at: now, going: new Set(), arrived: new Map(), fadeAt: null };
        me.current = { x: Math.round(me.current.x), y: Math.round(me.current.y), path: [] };
        goal.current = null;
        wantThing.current = null;
        events.push({ type: "keep", state: state() });
        out = { draw: false, busy, reachNow, candlesSeen, fireSeen, alarmed, foeLight, giving: [] };
        return;
      }
      const want = wantThing.current && things().find((t) => t.key === wantThing.current);
      if (want && inReach(want, me.current)) {
        wantThing.current = null;
        me.current = { ...me.current, path: me.current.path.slice(0, 1) };
        openThing(want, state());
        kept = now;
      } else if (want && me.current.path.length === 0) wantThing.current = null;
    }
    if (P.hp !== sentFor) { sentFor = P.hp; sent = {}; }
    const health = (id: string) => (P.hp[id] ?? 1) + (sent[id] ?? 0) + (pending[id] ?? 0);
    const fire = !busy && !A ? fires.current.find((f) => byFire(live, f, me.current)) : undefined;
    const giving: string[] = [];
    if (fire) {
      const ids = P.team.map((m) => m.id);
      const warm = warmBy(Object.fromEntries(ids.map((id) => [id, health(id)])), ids, fire.left, dt);
      for (const [id, g] of Object.entries(warm.gains)) if (g > 0) { pending[id] = (pending[id] ?? 0) + g; giving.push(id); }
      fire.left = warm.left;
      if (fire.left === 0) outAt = now;
    }
    if (Object.keys(pending).length > 0 && (giving.length === 0 || now - healedAt > HEAL_EVERY)) {
      for (const [id, g] of Object.entries(pending)) sent[id] = (sent[id] ?? 0) + g;
      const gains = pending;
      pending = {};
      healedAt = now;
      kept = now;
      movedSince = false;
      events.push({ type: "heal", gains, state: state() });
    }
    const show = !!fire || now - outAt < OUT_SHOW;
    if (show && now - shownAt > SHOW_EVERY) {
      shownAt = now;
      showing = true;
      setWarming({ hp: Object.fromEntries(P.team.map((m) => [m.id, Math.min(1, health(m.id))])), giving, left: fire?.left ?? 0 });
    } else if (!show && showing) { showing = false; setWarming(null); }
    if (lighted || (movedSince && (now - kept > KEEP_EVERY || P.busy))) { kept = now; movedSince = false; events.push({ type: "keep", state: state() }); }
    out = { draw: true, busy, reachNow, candlesSeen, fireSeen, alarmed, foeLight, giving };
  };
  return {
    me, goal, progressRef, known, lightNow, trail, cuts, sconces, candles, fires, foes, npcs, flareLeft, facing, walked, falls, shakeAt, wantThing, fired, alarm, events,
    setProps: (p: OldProps & { things: () => Thing[] }) => { props.current = p; },
    restart, draw, frame: () => out!,
  };
}
