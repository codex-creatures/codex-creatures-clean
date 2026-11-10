"use client";
// components/WalkView.tsx
// The walkable Encampment (the Labyrinth's "New"; lib/dungeon/walkRun.ts),
// drawn and walked on the Labyrinth screen in place of the room view: tap to
// walk there (lib/dungeon/walk.ts), or hold the stick bottom right (walkStick;
// or WASD / the arrows, and E uses what you're beside), by torchlight (lib/dungeon/torch.ts) in
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
import { roomAt, walkToward, walkStick, keysPush, isWalkKey, STICK_DEAD, type CanStep } from "@/lib/dungeon/walk";
import { depthEdges } from "@/lib/dungeon/tileArt";
import { shutPlan, fallenSoFar, FLARE_WALK } from "@/lib/dungeon/torch";
import { CAMPFIRE_HEAL } from "@/lib/dungeon/campfire";
import { ROOM_INFO, type DungeonId, type Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { Person } from "@/lib/dungeon/people";
import type { DungeonMap } from "@/lib/dungeon/map";
import { walkView, tapCell, DEPTH } from "@/lib/render/projection";
import { buildScene } from "@/lib/render/scene";
import { paintScene, type DarkLayer } from "@/lib/render/paint";
import { placeLabDecor, foeStarts, guarding, roomIds, thingsOf, solidCells, walkRule, tappedThing, usableNear, fromRuns, type Thing } from "@/lib/world/walkWorld";
import { placementsOfWalk } from "@/lib/world/migrate";
import { startWalk, restartLoop, stepWalk, walkState, walkUpTo, soundAlarm, type WalkState, type Warming } from "@/lib/world/walkSim";
import { ROOM_ART } from "@/components/DungeonMapView";
import { CreatureArt } from "@/components/CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { PartyMember } from "@/components/PartySlots";
import { drawnScale } from "@/lib/uiScale";

// (Faded browns on the old paper: SCROLL_SHEET.)
const INK = { edge: "#6b4f2a", floor: "#c4a874", wall: "#5e4024", trail: "#7a4a1a", cut: "#b02a1e", mark: "#e8d6a8", text: "#3a2a14", you: "#e0483e" };

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
  // librarian stand by their carts), and each fight room's foes, as saved in the run (lib/world/placements.ts).
  // The same places every time this opens.
  const ids = useMemo(() => roomIds(layout, map), [layout, map]);
  const [placed] = useState(() => placementsOfWalk(walk, map, dungeon, room));
  // The walk going on (lib/world/walkSim.ts): you, what you've seen, the lights, foes, the alarm. Kept between frames.
  const [sim] = useState(() => startWalk(walk, plan, live, { sconces: placed.sconces, candles: placed.candles, foes: guarding(foeStarts(placed, ids, room), layout, room, dungeon, placed), npcs: placed.witches }, fromRuns(walk.known, plan.w * plan.h)));
  // 🚧 Decor (samples) and banners: where they lie, from the run's seed.
  const labDecor = useMemo(() => (decor ? placeLabDecor(walk, plan, map, sim.candles, sim.sconces) : { decor: [], banners: [] }), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
  const decorItems = labDecor.decor, banners = labDecor.banners;
  // A flare's light: tiles of walking left with it (torch.ts), lit afresh by each new flare.
  const flaresSeen = useRef(walk.flares ?? 0);
  useEffect(() => {
    if ((walk.flares ?? 0) > flaresSeen.current) { flaresSeen.current = walk.flares ?? 0; sim.flareLeft = FLARE_WALK; }
  }, [walk.flares, sim]);
  const [warming, setWarming] = useState<Warming | null>(null);
  // The stick: how far it's pushed each way (-1..1, screen ways), null when let go; and the thing E would use.
  const stick = useRef<Pt | null>(null);
  const [usable, setUsable] = useState<Thing | null>(null);
  useEffect(() => { if (scroll) stick.current = null; }, [scroll]); // (the stick goes with the scroll out: let go)
  // The keyboard's stick (WASD, the arrows), used when the on-screen one isn't held.
  const keys = useRef(new Set<string>());

  // The props the frame loop reads, kept current.
  const spots = walk.spots;
  const props = useRef({ here, room, busy, scroll, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep });
  useEffect(() => { props.current = { here, room, busy, scroll, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep }; });

  const state = (): WalkState => walkState(sim);
  // Saved as you leave (a fight, the Den, a reload).
  useEffect(() => () => props.current.onKeep(walkState(sim)), [sim]);

  // The things to tap, as the rooms stand now.
  const things = (): Thing[] => thingsOf(layout, placed, ids, props.current.room, sim.npcs, props.current.spots, dungeon);

  // Tapped (and walked up to) a thing: a cage opens as a cage; a chest or cage still guarded sets its guards on you; anything else is its room's.
  const openThing = (t: Thing, st: WalkState) => (t.guarded ? soundAlarm(sim, t.room, performance.now())
    : t.cage !== undefined ? props.current.onCage?.(t.room, t.cage, st) : props.current.onObject(t.room, st));

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
      // Holding the stick: walk the way it points (a tapped walk's dropped; the rule's only worked out when a step's picked).
      const S = stick.current ?? (props.current.scroll ? null : keysPush(keys.current));
      if (S && Math.hypot(S.x, S.y) >= STICK_DEAD && !P.busy && sim.fired === 0 && !sim.alarm) {
        sim.goal = null;
        sim.wantThing = null;
        let can: CanStep | null = null;
        sim.me = walkStick(live, sim.me, S.x, S.y / DEPTH, (a, b) => (can ??= rule(sim.progress))(a, b));
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
      if (!F.draw) return;
      const near = usableNear(things(), sim.me, sim.known, plan.w) ?? null;
      setUsable((was) => (was?.key === near?.key && was?.open === near?.open ? was : near));

      // ── Drawing ──
      // A canvas pixel for each pixel on screen, Screen size's scaling included, so the browser never stretches the picture.
      const ratio = (window.devicePixelRatio || 1) * drawnScale(el);
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
    // (Settings → Screen size draws the screen scaled: the pointer's in drawn pixels, the view in the canvas's own.)
    const el = e.currentTarget, box = el.getBoundingClientRect(), k = drawnScale(el);
    const spot = tapCell(walkView(plan, sim.me, el.clientWidth, el.clientHeight), (e.clientX - box.left) / k, (e.clientY - box.top) / k);
    const can = rule(sim.progress);
    // A tap on (or by) something to loot that you've seen: walk up beside it, and it opens.
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
    if (busy || sim.fired > 0 || sim.alarm || !usable) return;
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

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
      <canvas ref={canvas} onPointerDown={tap} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", touchAction: "none" }} />
      {!scroll && <Stick onPush={(p) => { stick.current = p; }} />}
      {warming && !scroll && <Warmth team={team} warming={warming} />}
      {scroll && <WalkScroll map={map} layout={layout} plan={plan} known={sim.known} trail={sim.trail} progress={progress} cuts={sim.cuts}
        been={been} here={roomAt(plan, sim.me)} at={sim.me} cleared={cleared} lit={lit} seen={seen} onClose={onScrollClose} />}
    </div>
  );
}

// The stick, bottom right (above the dock's Bag; the user, 2026-11-09): press
// anywhere on the ring and drag, and you walk that way while it's held; the
// knob follows your thumb. Tap a thing to use it (the ✋ button over it was
// taken out: the user, 2026-11-09). Tapping the floor to walk works as before.
const STICK_SIZE = "min(28cqw, 120px)";
const STICK_KNOB = 0.42; // the knob's share of the ring
export function Stick({ onPush }: { onPush: (push: Pt | null) => void }) {
  const ring = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Pt>({ x: 0, y: 0 });
  const push = (e: React.PointerEvent) => {
    const box = ring.current!.getBoundingClientRect(), r = box.width / 2;
    let x = (e.clientX - box.left - r) / r, y = (e.clientY - box.top - r) / r;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    onPush({ x, y });
    setKnob({ x, y });
  };
  const letGo = () => { onPush(null); setKnob({ x: 0, y: 0 }); };
  const travel = ((1 - STICK_KNOB) / 2) * 100; // % of the ring the knob sits in from the edge, centred
  return (
    <div style={{ position: "absolute", right: 10, bottom: 10, zIndex: 4 }}>
      <div ref={ring} aria-label="Walk"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); push(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) push(e); }}
        onPointerUp={letGo} onPointerCancel={letGo} onLostPointerCapture={letGo}
        style={{ position: "relative", width: STICK_SIZE, height: STICK_SIZE, borderRadius: "50%", background: "rgba(10,10,16,0.45)", border: "2px solid rgba(241,217,160,0.5)", touchAction: "none" }}>
        <span aria-hidden style={{ position: "absolute", width: `${STICK_KNOB * 100}%`, height: `${STICK_KNOB * 100}%`, left: `${travel + knob.x * travel}%`, top: `${travel + knob.y * travel}%`,
          borderRadius: "50%", background: "rgba(241,217,160,0.75)", border: "2px solid #6b4f2a", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// By a campfire: a thin bar of what the fire has left (burnt down: embers),
// then your team in a column down from the top left (under the room's
// button: app/dungeon/page.tsx), out of the way (the
// user, 2026-11-09), small (the size of the Abyss's five team cards), a
// health bar under each going up and a "+" rising by each one getting some.
// Taps go through it to the walk.
const WARM_CELL = 56; // px across a creature
export function Warmth({ team, warming }: { team: Omit<PartyMember, "hp">[]; warming: Warming }) {
  return (
    <div style={{ position: "absolute", left: 8, top: 60, zIndex: 3, width: WARM_CELL, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span aria-hidden style={{ fontSize: 11, filter: warming.left > 0 ? undefined : "grayscale(1) brightness(0.6)" }}>🔥</span>
        <span style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.6)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(warming.left / CAMPFIRE_HEAL) * 100}%`, background: "#ff9a2e", transition: "width 0.1s linear" }} />
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
    </div>
  );
}

// The scroll, like a treasure map (layout.ts scrollMarks): what your torch has
// lit, your trail, a red line across each tunnel that fell in this run,
// a mark per room (crossed once cleared). A room a clairvoyance scroll looked
// into is drawn in, and the rooms it and a flare showed are marked (foreseen).
// As wide as the rooms' walls reach, scrolling up and down, opened at you
// (the user, 2026-11-06). Tap to put it away, or (onPick) tap a room to pick it.
const SCROLL_ROOM = 1 / 0.9; // zoomed out 10% past the walls, paper either side to look round (the user, 2026-11-09)
// Its paper (the user, 2026-11-09: a classic tea-stained scroll that looks like one): rolled at the top
// and bottom (PixelLab: PIXELLAB.md), cut nine ways round the map (its edges SCROLL_EDGE px of the sheet:
// top, right, bottom, left; drawn SCROLL_PX screen px a sheet px), the map scrolling between the rolls.
const SCROLL_SHEET = "/sprites/walk/scroll-frame.png", SCROLL_EDGE = [36, 12, 34, 12], SCROLL_PX = 1.6;
const SCROLL_BORDER = SCROLL_EDGE.map((e) => `${e * SCROLL_PX}px`).join(" ");
// people: who your locators find (decision 39), each shown by their icon where they stand, and nothing else.
export function WalkScroll({ map, layout, plan, known, trail, progress, cuts = [], been, here, at, cleared, lit, seen, people = [], onClose, onPick }: {
  map: DungeonMap; layout: WalkRun["layout"]; plan: ReturnType<typeof layoutFloorplan>; known: Uint8Array; trail: Pt[]; progress?: Progress; cuts?: number[];
  been: string[]; here: string | null; at?: Pt; cleared: string[]; lit?: string[]; seen?: string[]; people?: Person[]; onClose?: () => void; onPick?: (id: string) => void;
}) {
  const [shown] = useState(() => {
    // What's drawn: what you've seen, and the rooms a clairvoyance scroll looked into (walls and all).
    const drawn = known.length === plan.w * plan.h ? known.slice() : new Uint8Array(plan.w * plan.h);
    for (const id of seen ?? []) for (const f of plan.rooms[id] ?? []) {
      for (let y = Math.max(0, f.y - 1); y <= Math.min(plan.h - 1, f.y + f.h); y++) drawn.fill(1, y * plan.w + Math.max(0, f.x - 1), y * plan.w + Math.min(plan.w, f.x + f.w + 1));
    }
    const fell = new Set(!progress ? [] : fallenSoFar(plan, layout, progress, cuts, drawn));
    // A tunnel across that fell in is drawn as rock, as if there'd never been one (the user, 2026-11-09).
    const gone = new Set(layout.tunnels.filter((t) => !t.up && fell.has(t.key)).flatMap((t) => (plan.tunnels[t.key] ?? []).map((q) => q.y * plan.w + q.x)));
    const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h || gone.has(y * plan.w + x) ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => tile(x + dx, y + dy) !== ROCK));
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
    // Tunnels up that fell in behind you this run (fallenSoFar): a red line across the middle, a tile past each side.
    const shut = layout.tunnels.filter((t) => t.up && fell.has(t.key))
      .map(({ rect: { x, y, w, h } }) => ({ x1: x - 1, y1: y + h / 2, x2: x + w + 1, y2: y + h / 2 }));
    const marks: ScrollMark[] = scrollMarks(map, layout, been, here, foreseen(map, layout, lit, seen));
    // Across: the furthest walls, with a tile of paper either side, then zoomed out (SCROLL_ROOM) for paper to spare.
    const fit = right + 3 - (left - 2), vw = fit * SCROLL_ROOM;
    return { ink, shut, marks, people: people.map((q) => ({ ...q, at: { ...q.at } })), trail: trail.slice(), x0: left - 2 - (vw - fit) / 2, vw };
  });
  // Opened at you (or your room).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current, mark = shown.marks.find((m) => m.here);
    const y = at ? (at.y + 0.5) / plan.h : mark?.y;
    if (el && y !== undefined) el.scrollTop = y * el.scrollHeight - el.clientHeight / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div onClick={onPick ? undefined : onClose} style={{ position: "absolute", inset: 0, zIndex: 5, borderStyle: "solid", borderWidth: SCROLL_BORDER,
      borderImage: `url(${SCROLL_SHEET}) ${SCROLL_EDGE.join(" ")} fill / ${SCROLL_BORDER} stretch`, imageRendering: "pixelated", background: "transparent" }}>
    <div ref={box} style={{ position: "absolute", inset: 0, overflowX: "hidden", overflowY: "auto", touchAction: "pan-y" }}>
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
        {shown.people.map((q) => (
          <g key={q.id}>
            <circle cx={q.at.x + 0.5} cy={q.at.y + 0.5} r={3.6} fill={INK.mark} stroke={INK.you} strokeWidth={0.9} strokeDasharray="1.4 0.8" />
            <text x={q.at.x + 0.5} y={q.at.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fill={INK.text}>{ROOM_INFO[q.kind].icon}</text>
          </g>
        ))}
      </svg>
    </div>
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
