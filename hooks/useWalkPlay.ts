"use client";
// hooks/useWalkPlay.ts
// The walk going on, for the walk screen (components/WalkView3D.tsx): everything
// but the drawing. Set up as components/WalkView.tsx (the 2D view, kept until
// the 3D one has been played) sets it up, line for line: the run's placements
// and the frame-by-frame sim (lib/world/walkSim.ts), its events handed to the
// screen's callbacks, taps, the stick and the keys (WASD / the arrows walk, E
// uses what you're beside), a flare's light, and saving as you leave.
// The screen calls `step` once a frame and draws from what it hands back.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, isOpen, type Progress } from "@/lib/dungeon/layout";
import { walkToward, walkStick, keysPush, isWalkKey, STICK_DEAD, type CanStep } from "@/lib/dungeon/walk";
import { shutPlan, FLARE_WALK } from "@/lib/dungeon/torch";
import type { DungeonId, Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { foeStarts, guarding, roomIds, thingsOf, solidCells, walkRule, tappedThing, usableNear, fromRuns, type Thing } from "@/lib/world/walkWorld";
import { placementsOfWalk } from "@/lib/world/migrate";
import { startWalk, restartLoop, stepWalk, walkState, walkUpTo, soundAlarm, type WalkState, type Warming, type Frame } from "@/lib/world/walkSim";
import type { PartyMember } from "@/components/PartySlots";

// What the screen hands the walk (as WalkView's props; app/dungeon/page.tsx says what each does).
export type WalkPlayProps = {
  walk: WalkRun;                       // the run's walk record (read when this opens; your spot is ours from then)
  map: DungeonMap;                     // what kind each room is
  dungeon?: DungeonId;                 // which (the Encampment's chief waits; the Labyrinth's camps don't)
  here: string;                        // the room you're in (the run's position)
  room: (id: string) => Room | undefined; // each room as it stands now
  busy: boolean;                       // a window's open over it: nobody moves
  scroll: boolean;                     // the scroll is out
  team: Omit<PartyMember, "hp">[];     // who's walking with you (a campfire heals them)
  hp: Record<string, number>;          // …their health, shares of max HP (the run's)
  onEnter: (id: string, state: WalkState) => void;
  onSpotted: (id: string, state: WalkState) => void;
  onObject: (id: string, state: WalkState) => void;
  onCage?: (id: string, cage: number, state: WalkState) => void;
  onHeal: (gains: Record<string, number>, state: WalkState) => void;
  onKeep: (state: WalkState) => void;
  seeAll?: boolean;                    // the lab: everything shown as seen (to judge a room)
  startIn?: string;                    // the lab: start in the middle of this room
};

export function useWalkPlay(P0: WalkPlayProps) {
  const { walk, map, dungeon = 0, room, seeAll = false, startIn } = P0;
  const layout = walk.layout;
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const [progress, setProgress] = useState<Progress>({ room: walk.room, line: walk.line ?? Infinity });
  // The floorplan as it stands: closed tunnels are rock. Walking, light, sight and drawing all use it.
  const live = useMemo(() => shutPlan(plan, layout, progress), [plan, layout, progress]);
  // The rooms cut off behind you (drawn dimmed): a 1 on each of their tiles and the walls round them.
  const closed = useMemo(() => {
    const out = new Uint8Array(plan.w * plan.h);
    for (const [id, rs] of Object.entries(plan.rooms)) {
      if (isOpen(layout, progress, id)) continue;
      for (const r of rs) for (let y = Math.max(0, r.y - 1); y <= Math.min(plan.h - 1, r.y + r.h); y++) out.fill(1, y * plan.w + Math.max(0, r.x - 1), y * plan.w + Math.min(plan.w, r.x + r.w + 1));
    }
    return out;
  }, [plan, layout, progress]);
  // Every room (and second den), and what's in them where it starts, as saved in the run (lib/world/placements.ts).
  const ids = useMemo(() => roomIds(layout, map), [layout, map]);
  const [placed] = useState(() => placementsOfWalk(walk, map, dungeon, room));
  // The walk going on (lib/world/walkSim.ts): you, what you've seen, the lights, foes, the alarm. Kept between frames.
  const [sim] = useState(() => {
    const s = startWalk(walk, plan, live, { sconces: placed.sconces, candles: placed.candles, foes: guarding(foeStarts(placed, ids, room), layout, room, dungeon, placed), npcs: placed.witches }, fromRuns(walk.known, plan.w * plan.h));
    if (seeAll) s.known.fill(1);
    const r = startIn ? plan.rooms[startIn]?.[0] : undefined;
    if (r) s.me = { ...s.me, x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2), path: [] };
    return s;
  });
  // A flare's light: tiles of walking left with it (torch.ts), lit afresh by each new flare.
  const flaresSeen = useRef(walk.flares ?? 0);
  useEffect(() => {
    if ((walk.flares ?? 0) > flaresSeen.current) { flaresSeen.current = walk.flares ?? 0; sim.flareLeft = FLARE_WALK; }
  }, [walk.flares, sim]);
  const [warming, setWarming] = useState<Warming | null>(null);
  // The stick: how far it's pushed each way (-1..1, screen ways), null when let go; and the thing E would use.
  const stick = useRef<Pt | null>(null);
  const [usable, setUsable] = useState<Thing | null>(null);
  useEffect(() => { if (P0.scroll) stick.current = null; }, [P0.scroll]); // (the stick goes with the scroll out: let go)
  // The keyboard's stick (WASD, the arrows), used when the on-screen one isn't held.
  const keys = useRef(new Set<string>());

  // The props the frame loop reads, kept current.
  const props = useRef(P0);
  useEffect(() => { props.current = P0; });

  const state = (): WalkState => walkState(sim);
  // Saved as you leave (a fight, the Den, a reload).
  useEffect(() => () => props.current.onKeep(walkState(sim)), [sim]);

  // The things to tap, as the rooms stand now.
  const things = (): Thing[] => thingsOf(layout, placed, ids, props.current.room, sim.npcs, props.current.walk.spots, dungeon);

  // Tapped (and walked up to) a thing: a cage opens as a cage; a chest or cage still guarded sets its guards on you; anything else is its room's.
  const openThing = (t: Thing, st: WalkState) => (t.guarded ? soundAlarm(sim, t.room, performance.now())
    : t.cage !== undefined ? props.current.onCage?.(t.room, t.cage, st) : props.current.onObject(t.room, st));

  // Where you may walk: what the forward rule allows, only where you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => walkRule(layout, plan, p, sim.known, solidCells(things(), sim.fires, []));

  // The loop starts afresh on each floorplan (a tunnel's fallen in), and a walk under way finds the way again.
  useEffect(() => {
    restartLoop(sim, live, props.current.hp, performance.now());
    if (sim.goal) sim.me = walkToward(live, { ...sim.me, path: sim.me.path.slice(0, 1) }, sim.goal, rule(progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rule() reads refs and the layout
  }, [live]);

  // One frame: walk on (the stick, else the keys; `down`: floor a screen-height of stick is), then the sim.
  const step = (now: number, down = 1): Frame => {
    const P = props.current;
    const S = stick.current ?? (P.scroll ? null : keysPush(keys.current));
    if (S && Math.hypot(S.x, S.y) >= STICK_DEAD && !P.busy && sim.fired === 0 && !sim.alarm) {
      sim.goal = null;
      sim.wantThing = null;
      let can: CanStep | null = null;
      sim.me = walkStick(live, sim.me, S.x, S.y * down, (a, b) => (can ??= rule(sim.progress))(a, b));
    }
    const F = stepWalk(sim, { now, busy: P.busy, room: P.room, here: P.here, team: P.team.map((m) => m.id), hp: P.hp, things });
    for (const e of F.events) {
      if (e.type === "progress") setProgress(e.progress);
      else if (e.type === "enter") P.onEnter(e.room, e.state);
      else if (e.type === "spotted") P.onSpotted(e.room, e.state);
      else if (e.type === "use") openThing(e.thing, e.state);
      else if (e.type === "heal") P.onHeal(e.gains, e.state);
      else if (e.type === "keep") P.onKeep(e.state);
      else setWarming(e.warming);
    }
    if (F.draw) {
      const near = usableNear(things(), sim.me, sim.known, plan.w) ?? null;
      setUsable((was) => (was?.key === near?.key && was?.open === near?.open ? was : near));
    }
    return F;
  };

  // A tap on the floor at `spot`: on (or by) something to loot that you've seen, walk up beside it and it opens; else walk there.
  const tapAt = (spot: Pt) => {
    if (props.current.busy || sim.fired > 0 || sim.alarm) return;
    const can = rule(sim.progress);
    const t = tappedThing(things(), spot, sim.known, plan.w);
    if (t) {
      if (walkUpTo(sim, t, live, can) === "use") openThing(t, state());
      return;
    }
    sim.goal = spot;
    sim.wantThing = null;
    sim.me = walkToward(live, sim.me, spot, can);
  };

  // E: use what you're beside, as tapping it does.
  const use = () => {
    if (props.current.busy || sim.fired > 0 || sim.alarm || !usable) return;
    openThing(usable, state());
  };
  const useNow = useRef(use);
  useEffect(() => { useNow.current = use; });

  // Keys: WASD / the arrows walk (held), E uses what you're beside. Not while typing in a box.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isWalkKey(e.code)) { keys.current.add(e.code); e.preventDefault(); }
      else if (e.code === "KeyE" && !e.repeat) useNow.current();
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); };
    const drop = () => keys.current.clear(); // (the window lost focus: a key let go there never tells us)
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", drop);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", drop); };
  }, []);

  // The on-screen stick, pushed (or let go: null).
  const push = (p: Pt | null) => { stick.current = p; };

  return { plan, live, layout, progress, closed, sim, things, warming, usable, push, step, tapAt, use };
}
export type WalkPlay = ReturnType<typeof useWalkPlay>;
