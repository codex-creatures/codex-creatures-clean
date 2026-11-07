"use client";
// components/WalkView.tsx
// The walkable Encampment (the Labyrinth's "New"; lib/dungeon/walkRun.ts),
// drawn and walked on the Labyrinth screen in place of the room view: tap to
// walk there (lib/dungeon/walk.ts), by torchlight (lib/dungeon/torch.ts) in
// the kit's three-quarter look (lib/sprites/walk.ts), 15 tiles across.
// Worked out and tried in /lab/walk first; the rules are the same here.
//
// What it hands back to the screen (app/dungeon/page.tsx), which runs the
// room as the live Labyrinth does:
// - onEnter: you walked into a room (it becomes run.current);
// - onSpotted: a room's foes saw you (or you stepped into the chief's camp),
//   lit up with a "!", came at you, and it faded out (lib/dungeon/foes.ts
//   fightReady): that room fights you;
// - onObject: you tapped a chest, a sack or the treasure and walked up to it;
// - onHeal: you stood by a campfire (lib/dungeon/campfire.ts) and your team
//   got this much health (shares of max HP), now and then while it lasts;
// - onKeep: your spot, what you've seen and the torches you've lit, to save
//   (now and then as you walk, and whenever any of the above happens).
// It reads the rooms as they stand from `room` (beaten rooms lose their
// foes, opened chests show open). Its own scroll, the treasure map, opens
// with `scroll`. By a campfire, a window over it shows your team healing.

import { useEffect, useMemo, useRef, useState } from "react";
import { ROCK, type Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, scrollMarks, foreseen, type Progress, type ScrollMark } from "@/lib/dungeon/layout";
import { roomAt, walkToward, type CanStep } from "@/lib/dungeon/walk";
import { depthEdges } from "@/lib/dungeon/tileArt";
import { shutPlan, fallenSoFar, FLARE_WALK } from "@/lib/dungeon/torch";
import { CAMPFIRE_HEAL } from "@/lib/dungeon/campfire";
import { ROOM_INFO, type DungeonId, type Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { walkView, tapCell } from "@/lib/render/projection";
import { buildScene } from "@/lib/render/scene";
import { paintScene, type DarkLayer } from "@/lib/render/paint";
import { placeLabDecor, placeFoeStarts, roomIds, thingsOf, solidCells, walkRule, tapsThing, inReach, approach, fromRuns, type Thing } from "@/lib/world/walkWorld";
import { placementsOfWalk } from "@/lib/world/migrate";
import { startWalk, restartLoop, stepWalk, walkState, type WalkState, type Warming } from "@/lib/world/walkSim";
import { ROOM_ART } from "@/components/DungeonMapView";
import { CreatureArt } from "@/components/CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { PartyMember } from "@/components/PartySlots";

const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14", you: "#e0483e" };

export type { WalkState };

// Pictures for the canvas, loaded once.
const IMAGES = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement | null {
  let img = IMAGES.get(src);
  if (!img) { img = new Image(); img.src = src; IMAGES.set(src, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export default function WalkView({ walk, map, dungeon = 0, decor = false, here, room, busy, been, cleared, lit, seen, scroll, team, hp, onScrollClose, onEnter, onSpotted, onObject, onCage, onHeal, onKeep }: {
  walk: WalkRun;                       // the run's walk record (read when this opens; your spot is ours from then)
  map: DungeonMap;                     // what kind each room is
  dungeon?: DungeonId;                 // which (the Encampment's chief waits; the Labyrinth's camps don't)
  decor?: boolean;                     // 🚧 the decor samples (lib/dungeon/decor.ts): /lab/newrun only, for now
  here: string;                        // the room you're in (the run's position)
  room: (id: string) => Room | undefined; // each room as it stands now
  busy: boolean;                       // a window's open over it: nobody moves
  been: string[];                      // rooms you've stood in (the scroll's marks)
  cleared: string[];                   // …and the ones finished (crossed out)
  lit?: string[]; seen?: string[];     // rooms a flare or a clairvoyance scroll showed (the run's)
  scroll: boolean;                     // the scroll is out
  team: Omit<PartyMember, "hp">[];     // who's walking with you (a campfire heals them)
  hp: Record<string, number>;          // …their health, shares of max HP (the run's)
  onScrollClose: () => void;
  onEnter: (id: string, state: WalkState) => void;
  onSpotted: (id: string, state: WalkState) => void;
  onObject: (id: string, state: WalkState) => void;
  onCage?: (id: string, cage: number, state: WalkState) => void;
  onHeal: (gains: Record<string, number>, state: WalkState) => void;
  onKeep: (state: WalkState) => void;
}) {
  const layout = walk.layout;
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState<Progress>({ room: walk.room, line: walk.line ?? Infinity });
  // The floorplan as it stands: closed tunnels are rock. Walking, light, sight and drawing all use it.
  const live = useMemo(() => shutPlan(plan, layout, progress), [plan, layout, progress]);
  const edges = useMemo(() => depthEdges(live), [live]);
  // Every room (and second den), and what's in them where it starts: the wall torches and the odd candle,
  // lit as you pass, the card witch walking about her room, and each room's things (the merchant and the
  // librarian stand by their carts), as saved in the run (lib/world/placements.ts); each fight room's foes
  // (lib/world/walkWorld.ts). The same places every time this opens.
  const ids = useMemo(() => roomIds(layout, map), [layout, map]);
  const [placed] = useState(() => placementsOfWalk(walk, map, room));
  // The walk going on (lib/world/walkSim.ts): you, what you've seen, the lights, foes, the alarm. Kept between frames.
  const [sim] = useState(() => startWalk(walk, plan, live, { sconces: placed.sconces, candles: placed.candles, foes: placeFoeStarts(walk, plan, map, dungeon, room), npcs: placed.witches }, fromRuns(walk.known, plan.w * plan.h)));
  // 🚧 Decor (samples) and banners: where they lie, from the run's seed.
  const labDecor = useMemo(() => (decor ? placeLabDecor(walk, plan, map, sim.candles, sim.sconces) : { decor: [], banners: [] }), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
  const decorItems = labDecor.decor, banners = labDecor.banners;
  // A flare's light: tiles of walking left with it (torch.ts), lit afresh by each new flare.
  const flaresSeen = useRef(walk.flares ?? 0);
  useEffect(() => {
    if ((walk.flares ?? 0) > flaresSeen.current) { flaresSeen.current = walk.flares ?? 0; sim.flareLeft = FLARE_WALK; }
  }, [walk.flares, sim]);
  const [warming, setWarming] = useState<Warming | null>(null);

  // The props the frame loop reads, kept current.
  const spots = walk.spots;
  const props = useRef({ here, room, busy, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep });
  useEffect(() => { props.current = { here, room, busy, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep }; });

  const state = (): WalkState => walkState(sim);
  // Saved as you leave (a fight, the Den, a reload).
  useEffect(() => () => props.current.onKeep(walkState(sim)), [sim]);

  // The things to tap, as the rooms stand now.
  const things = (): Thing[] => thingsOf(layout, placed, ids, props.current.room, sim.npcs, props.current.spots, dungeon);

  // Tapped (and walked up to) a thing: a cage opens as a cage; anything else is its room's.
  const openThing = (t: Thing, st: WalkState) => (t.cage !== undefined ? props.current.onCage?.(t.room, t.cage, st) : props.current.onObject(t.room, st));

  // Where you may walk: what the forward rule allows, only where you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => walkRule(layout, plan, p, sim.known, solidCells(things(), sim.fires, decorItems));

  // Draw every frame: walk on (walkSim.ts), move the camera, then what you've seen, lit by your torch.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    // The dark, a pixel a tile, drawn smoothed up over the view (soft edges to the light).
    const mask = document.createElement("canvas");
    mask.width = plan.w;
    mask.height = plan.h;
    const mctx = mask.getContext("2d")!;
    const dark: DarkLayer = { canvas: mask, ctx: mctx, shade: mctx.createImageData(plan.w, plan.h) };
    restartLoop(sim, live, props.current.hp, performance.now());
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const P = props.current;
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
      if (!F.draw) return;

      // ── Drawing ──
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // What to draw (lib/render/scene.ts: the camera on you, the rooms, the light), painted (paint.ts).
      const scene = buildScene({ sim, frame: F, plan, live, edges, layout, decor, decorItems, banners, seed: walk.seed, room: P.room, things: things(), now, w: cw, h: ch, ready: (src) => image(src) !== null, random: Math.random });
      for (const key of scene.settled) sim.falls.delete(key);
      paintScene(ctx, scene.cmds, image, dark);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the loop reads the rest through refs
  }, [plan, live, layout, edges]);

  // A tunnel's turned to rock under the way you were going: find the way again.
  useEffect(() => {
    if (sim.goal) sim.me = walkToward(live, { ...sim.me, path: sim.me.path.slice(0, 1) }, sim.goal, rule(progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rule() reads refs and the layout
  }, [live]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || sim.fired > 0 || sim.alarm) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const spot = tapCell(walkView(plan, sim.me, el.clientWidth, el.clientHeight), e.clientX - box.left, e.clientY - box.top);
    const can = rule(sim.progress);
    // A tap on (or by) something to loot that you've seen: walk up beside it, and it opens.
    const t = things().find((x) => tapsThing(x, spot) && sim.known[x.y * plan.w + x.x]);
    if (t) {
      if (inReach(t, sim.me)) { openThing(t, state()); return; }
      const from = sim.me.path[0] ?? { x: Math.round(sim.me.x), y: Math.round(sim.me.y) };
      const best = approach(live, t, from, can);
      if (best) {
        sim.goal = null;
        sim.wantThing = t.key;
        sim.me = { ...sim.me, path: sim.me.path.length > 0 ? [from, ...best] : best };
      }
      return;
    }
    sim.goal = spot;
    sim.wantThing = null;
    sim.me = walkToward(live, sim.me, spot, can);
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
      <canvas ref={canvas} onPointerDown={tap} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", touchAction: "none" }} />
      {warming && !scroll && <Warmth team={team} warming={warming} />}
      {scroll && <WalkScroll map={map} layout={layout} plan={plan} known={sim.known} trail={sim.trail} progress={progress} cuts={sim.cuts}
        been={been} here={roomAt(plan, sim.me)} at={sim.me} cleared={cleared} lit={lit} seen={seen} onClose={onScrollClose} />}
    </div>
  );
}

// By a campfire: your team in a row along the bottom, small (the size of the
// Abyss's five team cards; the user, 2026-11-06), a health bar under each
// going up and a "+" rising by each one getting some, and a thin bar of what
// the fire has left (burnt down: embers). Taps go through it to the walk.
const WARM_CELL = 56; // px across a creature
function Warmth({ team, warming }: { team: Omit<PartyMember, "hp">[]; warming: Warming }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        {team.map((m) => {
          const hp = warming.hp[m.id] ?? 1, gets = warming.giving.includes(m.id), ko = hp <= 0;
          return (
            <div key={m.id} title={m.name} style={{ width: WARM_CELL, position: "relative" }}>
              <span style={{ position: "relative", display: "block", width: WARM_CELL, height: WARM_CELL, borderRadius: 8, border: `2px solid ${RARITY_COLORS[m.rarity].border}`, background: "rgba(10,10,16,0.75)", opacity: ko ? 0.4 : 1, filter: ko ? "grayscale(1)" : undefined, overflow: "hidden" }}>
                <CreatureArt creatureId={m.creatureId} title={m.name} />
              </span>
              <span style={{ display: "block", height: 6, marginTop: 3, background: "rgba(0,0,0,0.75)", borderRadius: 3, overflow: "hidden", boxShadow: gets ? "0 0 6px rgba(120,255,140,0.8)" : undefined }}>
                <span style={{ display: "block", height: "100%", width: `${Math.max(0, hp) * 100}%`, background: hp > 0.5 ? "#22c55e" : hp > 0.25 ? "#f5c542" : "#ef4444", transition: "width 0.1s linear" }} />
              </span>
              <span className="fire-heal" aria-hidden style={{ visibility: gets ? "visible" : "hidden", bottom: 12 }}>+</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, width: Math.min(team.length, 5) * (WARM_CELL + 8) - 8 }}>
        <span aria-hidden style={{ fontSize: 11, filter: warming.left > 0 ? undefined : "grayscale(1) brightness(0.6)" }}>🔥</span>
        <span style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.6)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(warming.left / CAMPFIRE_HEAL) * 100}%`, background: "#ff9a2e", transition: "width 0.1s linear" }} />
        </span>
      </div>
    </div>
  );
}

// The scroll, like a treasure map (layout.ts scrollMarks): what your torch has
// lit, your trail, a red line across each tunnel that fell in this run,
// a mark per room (crossed once cleared). A room a clairvoyance scroll looked
// into is drawn in, and the rooms it and a flare showed are marked (foreseen).
// As wide as the rooms' walls reach, scrolling up and down, opened at you
// (the user, 2026-11-06). Tap to put it away, or (onPick) tap a room to pick it.
function WalkScroll({ map, layout, plan, known, trail, progress, cuts = [], been, here, at, cleared, lit, seen, onClose, onPick }: {
  map: DungeonMap; layout: WalkRun["layout"]; plan: ReturnType<typeof layoutFloorplan>; known: Uint8Array; trail: Pt[]; progress?: Progress; cuts?: number[];
  been: string[]; here: string | null; at?: Pt; cleared: string[]; lit?: string[]; seen?: string[]; onClose?: () => void; onPick?: (id: string) => void;
}) {
  const [shown] = useState(() => {
    const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => tile(x + dx, y + dy) !== ROCK));
    // What's drawn: what you've seen, and the rooms a clairvoyance scroll looked into (walls and all).
    const drawn = known.length === plan.w * plan.h ? known.slice() : new Uint8Array(plan.w * plan.h);
    for (const id of seen ?? []) for (const f of plan.rooms[id] ?? []) {
      for (let y = Math.max(0, f.y - 1); y <= Math.min(plan.h - 1, f.y + f.h); y++) drawn.fill(1, y * plan.w + Math.max(0, f.x - 1), y * plan.w + Math.min(plan.w, f.x + f.w + 1));
    }
    const ink: { x: number; y: number; w: number; wall: boolean }[] = [];
    let left = plan.w, right = 0;
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      if (tile(x, y) !== ROCK) { left = Math.min(left, x); right = Math.max(right, x); }
      if (!drawn[y * plan.w + x]) continue;
      const wall = tile(x, y) === ROCK;
      if (wall && !isWall(x, y)) continue;
      const run = ink[ink.length - 1];
      if (run && run.y === y && run.wall === wall && run.x + run.w === x) run.w++;
      else ink.push({ x, y, w: 1, wall });
    }
    // Tunnels that fell in behind you this run (fallenSoFar): a red line across the middle, a tile past each side.
    const fell = new Set(!progress ? [] : fallenSoFar(plan, layout, progress, cuts, drawn));
    const shut = layout.tunnels.filter((t) => fell.has(t.key))
      .map(({ rect: { x, y, w, h }, up }) => (up ? { x1: x - 1, y1: y + h / 2, x2: x + w + 1, y2: y + h / 2 } : { x1: x + w / 2, y1: y - 1, x2: x + w / 2, y2: y + h + 1 }));
    const marks: ScrollMark[] = scrollMarks(map, layout, been, here, foreseen(map, layout, lit, seen));
    // Across: the furthest walls, with a tile of paper either side.
    const x0 = Math.max(0, left - 2), x1 = Math.min(plan.w, right + 3);
    return { ink, shut, marks, trail: trail.slice(), x0, vw: x1 - x0 };
  });
  // Opened at you (or your room).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current, mark = shown.marks.find((m) => m.here);
    const y = at ? (at.y + 0.5) / plan.h : mark?.y;
    if (el && y !== undefined) el.scrollTop = y * el.scrollHeight - el.clientHeight / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} onClick={onPick ? undefined : onClose} style={{ position: "absolute", inset: 0, zIndex: 5, overflowX: "hidden", overflowY: "auto", background: INK.paper, border: `3px solid ${INK.edge}`, touchAction: "pan-y" }}>
      <svg viewBox={`${shown.x0} 0 ${shown.vw} ${plan.h}`} style={{ display: "block", width: "100%", aspectRatio: `${shown.vw} / ${plan.h}` }}>
        {shown.ink.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1.05} fill={r.wall ? INK.wall : INK.floor} />)}
        {shown.shut.map((l, i) => <line key={i} {...l} stroke={INK.cut} strokeWidth={0.9} strokeLinecap="round" />)}
        <polyline points={shown.trail.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ")} fill="none" stroke={INK.trail} strokeWidth={0.7} strokeDasharray="1.2 1.2" strokeLinejoin="round" />
        {shown.marks.map((m) => {
          const x = m.x * plan.w, y = m.y * plan.h, art = m.kind && ROOM_ART[m.kind];
          return (
            <g key={m.id} onClick={onPick ? () => onPick(m.id) : undefined} style={{ cursor: onPick ? "pointer" : undefined }}>
              {onPick && <circle cx={x} cy={y} r={6} fill="transparent" />}
              <circle cx={x} cy={y} r={3.6} fill={INK.mark} stroke={m.here ? INK.you : INK.edge} strokeWidth={m.here ? 0.9 : 0.5} />
              {art
                ? <image href={art} x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} style={{ imageRendering: "pixelated" }} />
                : <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fontWeight="bold" fill={INK.text}>{m.kind ? ROOM_INFO[m.kind].icon : "?"}</text>}
              {cleared.includes(m.id) && <path d={`M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`} stroke={INK.cut} strokeWidth={0.9} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// The scroll in a window (the Labyrinth screen's map sheet, while walking): to
// pick a room for a clairvoyance scroll (onPick), or to see what one or a
// flare showed. Your walk as last kept.
export function WalkMap({ walk, map, here, been, cleared, lit, seen, onPick }: {
  walk: WalkRun; map: DungeonMap; here: string; been: string[]; cleared: string[]; lit?: string[]; seen?: string[]; onPick?: (id: string) => void;
}) {
  const plan = useMemo(() => layoutFloorplan(walk.layout), [walk.layout]);
  return (
    <div style={{ position: "relative", width: "100%", height: "60cqh" }}>
      <WalkScroll map={map} layout={walk.layout} plan={plan} known={fromRuns(walk.known, plan.w * plan.h)} trail={walk.trail ?? [walk.at]}
        progress={{ room: walk.room, line: walk.line ?? Infinity }} cuts={walk.cuts} been={been} here={here} at={walk.at} cleared={cleared} lit={lit} seen={seen} onPick={onPick} />
    </div>
  );
}

// The map at the entrance (the Labyrinth screen's MapFirst): the scroll before
// you've walked anywhere, its marks only (no rooms or tunnels drawn yet).
export function WalkFirstMap({ walk, map }: { walk: WalkRun; map: DungeonMap }) {
  const plan = useMemo(() => layoutFloorplan(walk.layout), [walk.layout]);
  return (
    <div style={{ position: "relative", width: "100%", height: "45cqh", margin: "0 auto" }}>
      <WalkScroll map={map} layout={walk.layout} plan={plan} known={new Uint8Array(0)} trail={[]}
        been={[map.start]} here={map.start} cleared={[]} />
    </div>
  );
}
