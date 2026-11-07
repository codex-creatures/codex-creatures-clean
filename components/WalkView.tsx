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
import { layoutFloorplan, scrollMarks, foreseen, isOpen, type Progress, type ScrollMark } from "@/lib/dungeon/layout";
import { roomAt, walkToward, type CanStep } from "@/lib/dungeon/walk";
import { depthEdges, drawOrder, facingOf, walkFrame, capFade, FACINGS, WALL_LIFT } from "@/lib/dungeon/tileArt";
import { torchGlow, shutPlan, rubbleOf, fallenSoFar, sconceGlow, FLARE_WALK, SCONCE_RADIUS, CANDLE_RADIUS, type Sconce, type Candle } from "@/lib/dungeon/torch";
import { floorVariant, wallVariant } from "@/lib/dungeon/decor";
import { CAMPFIRE_HEAL, type Campfire } from "@/lib/dungeon/campfire";
import { ALARM_LIGHT, FADE_TIME } from "@/lib/dungeon/foes";
import { ROOM_INFO, type DungeonId, type Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { WALK_KIT, WALK_HERO, WALK_WITCH, WALK_FLOOR_WORN, WALK_WALL_WORN, KIT_PX, KIT_ROW, KIT_NORTH, KIT_CAP, KIT_SIDE } from "@/lib/sprites/walk";
import { walkView, tapCell, artPxAcross, artPxDown, across, legacySize, type View } from "@/lib/render/projection";
import { objectDef, artOf, DECOR_DEF, FOE_U, NPC_U, BOSS_SCALE, CHIEF_SCALE, type ObjectDef, type ArtRef } from "@/lib/world/objects";
import { placeLights, placeLabDecor, placePeople, roomIds, thingsOf, solidCells, walkRule, tapsThing, inReach, approach, fromRuns, type Thing } from "@/lib/world/walkWorld";
import { startWalk, restartLoop, stepWalk, walkState, torchThere, fireReach, sconceLight, fireLight, candleLight, type WalkState, type Warming } from "@/lib/world/walkSim";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { artFor } from "@/lib/sprites/art";
import { ROOM_ART } from "@/components/DungeonMapView";
import { CreatureArt } from "@/components/CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { PartyMember } from "@/components/PartySlots";

const FALL_TIME = 0.6, DUST_TIME = 1.2, SHAKE_TIME = 0.4, SHAKE_PX = 3; // a tunnel falling in

// The kit's and the hero's art pixels (projection.ts ArtDensity): the kit's rows squashed into a square cell.
const KIT_DENSITY = { perU: KIT_PX, rowsPerU: KIT_ROW }, HERO_DENSITY = { perU: KIT_PX };

const COLOURS = { rock: "#07060b", goal: "#f1d9a0", foe: "#b0302a", rubble: ["#5b5560", "#6f6872", "#48434d"], dust: "200, 190, 175" };
const DARK_RGB = [6, 5, 12];
const CLOSED = "rgba(7, 6, 11, 0.6)";
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14", you: "#e0483e" };

export type { WalkState };

// What's drawn the same way every frame (lib/world/objects.ts).
const CAMPFIRE = objectDef("campfire"), CANDLE = objectDef("candle"), BANNER = objectDef("banner"), SOUTH_WALL = objectDef("wall-south");
// A definition's picture on screen, at today's size.
const drawSize = (view: View, d: ObjectDef, a: ArtRef) => legacySize(view, d.visual.legacy, a);

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
  // Every room (and second den), and what's in them where it starts (lib/world/walkWorld.ts): the wall
  // torches and the odd candle, lit as you pass; each fight room's foes, and the card witch walking about
  // her room (the merchant and the librarian stand by their carts): the same places every time this opens.
  const ids = useMemo(() => roomIds(layout, map), [layout, map]);
  // The walk going on (lib/world/walkSim.ts): you, what you've seen, the lights, foes, the alarm. Kept between frames.
  const [sim] = useState(() => startWalk(walk, plan, live, { ...placeLights(walk, plan), ...placePeople(walk, plan, map, dungeon, room) }, fromRuns(walk.known, plan.w * plan.h)));
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
  const things = (): Thing[] => thingsOf(layout, plan, ids, props.current.room, sim.npcs, props.current.spots);

  // Tapped (and walked up to) a thing: a cage opens as a cage; anything else is its room's.
  const openThing = (t: Thing, st: WalkState) => (t.cage !== undefined ? props.current.onCage?.(t.room, t.cage, st) : props.current.onObject(t.room, st));

  // Where you may walk: what the forward rule allows, only where you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => walkRule(layout, plan, p, sim.known, solidCells(things(), sim.fires, decorItems));

  // Draw every frame: walk on (walkSim.ts), move the camera, then what you've seen, lit by your torch.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h } = plan;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : live.tiles[y * w + x]);
    const knownAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sim.known[y * w + x] === 1;
    const litAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sim.lightNow[y * w + x] === 1;
    const there = (c: Sconce) => torchThere(sim, c);
    // The dark, a pixel a tile, drawn smoothed up over the view (soft edges to the light).
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    const shade = mctx.createImageData(w, h);
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
      const { busy, alarm: A, reachNow, candlesSeen, fireSeen, alarmed, foeLight, giving } = F;
      const p = sim.progress;
      const flicker = 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37 + 1.3);

      // ── Drawing ──
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // The camera on you (lib/render/projection.ts), shaken a moment when a tunnel falls in.
      const still = walkView(plan, sim.me, cw, ch), scale = still.scale;
      const shake = (now - sim.shakeAt) / 1000 < SHAKE_TIME ? SHAKE_PX * scale * (1 - (now - sim.shakeAt) / 1000 / SHAKE_TIME) : 0;
      const jx = shake ? (Math.random() * 2 - 1) * shake : 0, jy = shake ? (Math.random() * 2 - 1) * shake : 0;
      const view = shake ? walkView(plan, sim.me, cw, ch, { x: jx, y: jy }) : still;
      const { T, sx, sy, midX, midY, footX, footY, x0, x1, y0, y1 } = view;
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      // The kit (lib/sprites/walk.ts): a kit pixel is T / KIT_PX across and T / KIT_ROW down.
      const kitImg = { floor: image(WALK_KIT.floor), north: image(WALK_KIT.north), cap: image(WALK_KIT.cap), east: image(WALK_KIT.east), west: image(WALK_KIT.west) };
      const kit = Object.values(kitImg).every(Boolean) ? (kitImg as Record<keyof typeof kitImg, HTMLImageElement>) : null;
      const worn = WALK_FLOOR_WORN.map(image).filter((i): i is HTMLImageElement => !!i);
      const wornWalls = WALK_WALL_WORN.map(image).filter((i): i is HTMLImageElement => !!i);
      const vy = artPxDown(view, KIT_DENSITY), side = Math.round(KIT_SIDE * artPxAcross(view, KIT_DENSITY));
      const faceAbove = (x: number, y: number) => {
        let rows = 0;
        while (rows < 3 && at(x, y - rows - 1) === ROCK) rows++;
        return Math.min(Math.round(KIT_NORTH * vy), rows * T);
      };
      if (kit) {
        // Floors, each north wall's face standing in the rock above it, the narrow side walls' tops.
        for (let y = y0; y < y1 + 3; y++) for (let x = x0; x < x1; x++) {
          if (at(x, y) === ROCK || !knownAt(x, y)) continue;
          const wd = sx(x + 1) - sx(x);
          const v = decor && worn.length > 0 ? floorVariant(x, y, walk.seed, worn.length) : 0;
          if (y < y1) ctx.drawImage(v > 0 ? worn[v - 1] : kit.floor, 0, 0, KIT_PX, KIT_ROW, sx(x), sy(y), wd, sy(y + 1) - sy(y));
          if (at(x, y - 1) !== ROCK) continue;
          const dh = faceAbove(x, y);
          const wv = decor && wornWalls.length > 0 ? wallVariant(Math.floor(x / 2), y, walk.seed, wornWalls.length) : 0;
          if (dh > 0) ctx.drawImage(wv > 0 ? wornWalls[wv - 1] : kit.north, wv > 0 ? (x & 1) * KIT_PX : 0, KIT_NORTH - dh / vy, KIT_PX, dh / vy, sx(x), sy(y) - dh, wd, dh);
        }
        const bannerArt = artOf(BANNER)!, bannerImg = image(bannerArt.src);
        if (bannerImg) for (const b of banners) {
          if (!knownAt(b.x, b.y) || b.x < x0 - 2 || b.x > x1 || b.y < y0 || b.y > y1 + 3) continue;
          const { wd: wd2, h2 } = drawSize(view, BANNER, bannerArt), face = faceAbove(b.x, b.y);
          ctx.drawImage(bannerImg, sx(b.x + 1) - wd2 / 2, sy(b.y) - face + Math.max(0, (face - h2) * 0.35), wd2, Math.min(h2, face));
        }
        const strip = (img: HTMLImageElement, left: number, q: Pt, floorX: number) => {
          ctx.drawImage(img, 0, 0, KIT_SIDE, KIT_ROW, left, sy(q.y), side, sy(q.y + 1) - sy(q.y));
          if (at(floorX, q.y - 1) !== ROCK) return;
          const dh = faceAbove(floorX, q.y);
          ctx.drawImage(img, 0, 0, KIT_SIDE, KIT_ROW, left, sy(q.y) - dh, side, dh);
        };
        for (const q of edges.left) if (q.x >= x0 - 1 && q.x < x1 && q.y >= y0 && q.y < y1 + 3 && knownAt(q.x + 1, q.y)) strip(kit.west, sx(q.x + 1) - side, q, q.x + 1);
        for (const q of edges.right) if (q.x >= x0 && q.x < x1 + 1 && q.y >= y0 && q.y < y1 + 3 && knownAt(q.x - 1, q.y)) strip(kit.east, sx(q.x), q, q.x - 1);
      }
      // Rooms cut off behind you, dimmed.
      for (const [id, rs] of Object.entries(plan.rooms)) {
        if (isOpen(layout, p, id)) continue;
        ctx.fillStyle = CLOSED;
        ctx.beginPath();
        for (const r of rs) ctx.rect(sx(r.x) - T, sy(r.y) - T, (r.w + 2) * T, (r.h + 2) * T);
        ctx.fill();
      }
      // The way you'll walk: a dotted line from you, shrinking as you go.
      const end = sim.me.path[sim.me.path.length - 1];
      if (end) {
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.setLineDash([3 * scale, 4 * scale]);
        ctx.beginPath();
        ctx.moveTo(midX(sim.me.x), midY(sim.me.y));
        for (const q of sim.me.path) ctx.lineTo(midX(q.x), midY(q.y));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeRect(sx(end.x) + 3 * scale, sy(end.y) + 3 * scale, T - 6 * scale, T - 6 * scale);
      }
      // Everything standing up, lowest on screen last: things to loot, rubble, foes, you, south walls' tops.
      const standing: { x: number; y: number; draw: () => void }[] = [];
      const shown = things().filter((t) => knownAt(t.x, t.y) && (!t.npc || litAt(t.x, t.y) || t.solid));
      for (const t of shown) {
        const witch = t.def === "witch" ? sim.npcs.find((n) => n.room === t.room) : undefined;
        const sheet = witch && image(WALK_WITCH.sheet);
        if (witch && sheet) {
          // The card witch walking about (a sheet like the hero's), facing the way she goes.
          standing.push({ x: witch.x, y: witch.y, draw: () => {
            const face = facingOf(Math.cos(witch.facing), Math.sin(witch.facing), "south");
            const col = witch.path.length > 0 ? 1 + (Math.floor(now / 130) % WALK_WITCH.frames) : 0;
            const px = across(view, NPC_U) / WALK_WITCH.tall, size = WALK_WITCH.cell * px;
            const row = FACINGS.indexOf(face === "west" ? "east" : face);
            ctx.save();
            ctx.translate(Math.round(footX(witch.x)), Math.round(footY(witch.y) - WALK_WITCH.feet * px));
            if (face === "west") ctx.scale(-1, 1);
            ctx.drawImage(sheet, col * WALK_WITCH.cell, row * WALK_WITCH.cell, WALK_WITCH.cell, WALK_WITCH.cell, -size / 2, 0, size, size);
            ctx.restore();
          } });
          continue;
        }
        const d = objectDef(t.def), a = artOf(d, t.state), img = a && image(a.src);
        const px = witch ? { x: witch.x, y: witch.y } : t;
        standing.push({ x: px.x, y: px.y, draw: () => {
          if (!img || !a) return;
          const { wd, h2 } = drawSize(view, d, a);
          // (A used pool is dimmed.)
          if (t.def === "pool" && t.open) ctx.globalAlpha = 0.6;
          ctx.drawImage(img, footX(px.x) - wd / 2, footY(px.y) - h2 + h2 * (d.visual.legacy.lift ?? 0), wd, h2);
          ctx.globalAlpha = 1;
        } });
      }
      for (const r of rubbleOf(plan, layout, p)) {
        const fell = sim.falls.get(r.key);
        if (fell === undefined && !r.tiles.some((q) => sim.known[q.y * w + q.x])) continue; // never seen: just rock
        const age = fell === undefined ? Infinity : (now - fell) / 1000;
        if (age > DUST_TIME) sim.falls.delete(r.key);
        const into = r.wall === "top" ? { x: 0, y: 0.35 } : r.wall === "bottom" ? { x: 0, y: -0.35 } : r.wall === "left" ? { x: 0.35, y: 0 } : { x: -0.35, y: 0 };
        for (const q of r.tiles) standing.push({ x: q.x, y: q.y + into.y, draw: () => {
          const drop = age < FALL_TIME ? (1 - age / FALL_TIME) ** 2 * 3 * T : 0;
          for (let k = 0; k < 5; k++) {
            const rx = ((q.x * 7 + q.y * 13 + k * 29) % 10) / 10 - 0.5, ry = ((q.x * 11 + q.y * 5 + k * 17) % 10) / 10 - 0.5;
            ctx.fillStyle = COLOURS.rubble[k % 3];
            ctx.beginPath();
            ctx.ellipse(footX(q.x + into.x + rx * 0.8), footY(q.y + into.y + ry * 0.5) - 4 * scale - drop * (1 + k * 0.15), T * (0.22 + 0.05 * (k % 2)), T * 0.16, 0, 0, 2 * Math.PI);
            ctx.fill();
          }
          if (age < DUST_TIME) {
            const f = age / DUST_TIME;
            ctx.fillStyle = `rgba(${COLOURS.dust}, ${0.5 * (1 - f)})`;
            ctx.beginPath();
            ctx.arc(footX(q.x + into.x), footY(q.y + into.y) - 6 * scale, T * (0.4 + 1.1 * f), 0, 2 * Math.PI);
            ctx.fill();
          }
        } });
      }
      for (const f of sim.foes) {
        if (!litAt(Math.round(f.x), Math.round(f.y)) && !(A && f.room === A.room)) continue;
        const fr = P.room(f.room), e = fr?.enemies?.[f.index];
        const sprite = fr?.boss ? CREATURE_SPRITES[fr.boss] : e && CREATURE_SPRITES[e.creatureId];
        const a = sprite && artFor(sprite), img = a && image(a.src);
        standing.push({ x: f.x, y: f.y, draw: () => {
          const fx = footX(f.x), fy = footY(f.y), tall = across(view, FOE_U) * (f.waits ? (fr?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1);
          if (img && a) {
            // Art faces left unless marked; turned to face the way it looks.
            const wd = (tall * a.w) / a.h, flip = (Math.cos(f.facing) > 0.1) !== (a.faces === "right");
            ctx.save();
            ctx.translate(fx, fy - tall);
            if (flip) ctx.scale(-1, 1);
            ctx.translate(-wd / 2, 0);
            ctx.drawImage(img, 0, 0, wd, tall);
            ctx.restore();
          } else {
            ctx.fillStyle = COLOURS.foe;
            ctx.beginPath();
            ctx.arc(fx, fy - T * 0.4, T * 0.4, 0, 2 * Math.PI);
            ctx.fill();
          }
        } });
      }
      const heroImg = image(WALK_HERO.sheet);
      standing.push({ x: sim.me.x, y: sim.me.y, draw: () => {
        if (!heroImg) return;
        const moving = sim.me.path.length > 0 && !busy;
        const col = WALK_HERO.frames > 0 ? walkFrame(sim.walked, moving, WALK_HERO.frames) + 1 : 0;
        const row = FACINGS.indexOf(sim.facing), px = artPxAcross(view, HERO_DENSITY), size = WALK_HERO.cell * px;
        ctx.drawImage(heroImg, col * WALK_HERO.cell, row * WALK_HERO.cell, WALK_HERO.cell, WALK_HERO.cell,
          Math.round(footX(sim.me.x) - size / 2), Math.round(footY(sim.me.y) - WALK_HERO.feet * px), size, size);
      } });
      // South walls stand up over the floor's bottom row (see-through close to you).
      const lift = Math.round(KIT_CAP * vy);
      if (kit) for (const q of edges.south) {
        if (q.x < x0 || q.x >= x1 || q.y < y0 || q.y >= y1 || !knownAt(q.x, q.y - 1)) continue;
        standing.push({ x: q.x, y: q.y + SOUTH_WALL.visual.legacy.sortDy!, draw: () => {
          ctx.globalAlpha = capFade(Math.hypot(q.x - sim.me.x, q.y - 0.5 - WALL_LIFT / 2 - sim.me.y));
          const l = at(q.x - 1, q.y) === ROCK && at(q.x - 1, q.y - 1) === ROCK ? side : 0;
          const r = at(q.x + 1, q.y) === ROCK && at(q.x + 1, q.y - 1) === ROCK ? side : 0;
          ctx.drawImage(kit.cap, 0, 0, KIT_PX, KIT_CAP, sx(q.x) - l, sy(q.y) - lift, sx(q.x + 1) - sx(q.x) + l + r, lift);
          ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
          ctx.fillRect(sx(q.x), sy(q.y) - lift, T, Math.max(1, scale));
          ctx.globalAlpha = 1;
        } });
      }
      // The wall torches' brackets (their flames go over the dark, below).
      const burning = sim.sconces.filter((c) => c.lit && there(c) && knownAt(c.x, c.y) && c.x >= x0 - SCONCE_RADIUS && c.x < x1 + SCONCE_RADIUS && c.y >= y0 - SCONCE_RADIUS && c.y < y1 + SCONCE_RADIUS);
      // (On a tunnel's side wall, it sticks out from the wall's edge, by the tile's middle.)
      const bracket = (c: Sconce) => (c.wall === "left" ? { x: sx(c.x) + 0.1 * T, top: sy(c.y) - 0.2 * T } : c.wall === "right" ? { x: sx(c.x + 1) - 0.1 * T, top: sy(c.y) - 0.2 * T } : { x: footX(c.x), top: sy(c.y) - 1.1 * T });
      for (const c of sim.sconces) {
        if (c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y) || !there(c)) continue;
        standing.push({ x: c.x, y: c.y + objectDef(c.wall === "left" || c.wall === "right" ? "sconce-side" : "sconce").visual.legacy.sortDy!, draw: () => {
          const { x: fx, top } = bracket(c);
          ctx.fillStyle = "#2a2018";
          ctx.fillRect(fx - 0.08 * T, top, 0.16 * T, 0.45 * T);
          ctx.fillStyle = "#4a3a2a";
          ctx.fillRect(fx - 0.16 * T, top, 0.32 * T, 0.1 * T);
        } });
      }
      // Campfires: a ring of stones round logs stacked up, burning (or burnt down: embers). PixelLab art.
      const fireImg = image(artOf(CAMPFIRE, "lit")!.src), embersImg = image(artOf(CAMPFIRE, "out")!.src);
      const fireSize = drawSize(view, CAMPFIRE, artOf(CAMPFIRE, "lit")!);
      const drawFire = (f: Campfire, img: HTMLImageElement | null) => {
        if (!img) return;
        const { wd, h2 } = fireSize;
        ctx.drawImage(img, footX(f.x) - wd / 2, footY(f.y) - h2 + h2 * CAMPFIRE.visual.legacy.lift!, wd, h2);
      };
      for (const f of sim.fires) {
        if (!knownAt(f.x, f.y)) continue;
        standing.push({ x: f.x, y: f.y, draw: () => drawFire(f, f.left > 0 ? fireImg : embersImg) });
      }
      const candleImg = image(artOf(CANDLE, "out")!.src), candleLitImg = image(artOf(CANDLE, "lit")!.src);
      const candleSize = drawSize(view, CANDLE, artOf(CANDLE, "out")!);
      const drawCandle = (c: Candle) => {
        const img = c.lit ? candleLitImg : candleImg;
        if (!img) return;
        const { wd, h2 } = candleSize;
        ctx.drawImage(img, footX(c.x) - wd / 2, footY(c.y) - h2, wd, h2);
      };
      for (const c of sim.candles) if (knownAt(c.x, c.y)) standing.push({ x: c.x, y: c.y, draw: () => drawCandle(c) });
      for (const d of decorItems) {
        if (!knownAt(d.x, d.y) || d.x < x0 - 2 || d.x > x1 + 2 || d.y < y0 - 2 || d.y > y1 + 2) continue;
        const def = objectDef(DECOR_DEF[d.kind]), art = artOf(def)!, img = image(art.src);
        // (Flat things lie under everything else; things standing up take their turn.)
        const draw = () => {
          if (!img) return;
          const { wd, h2 } = drawSize(view, def, art);
          ctx.drawImage(img, footX(d.x) - wd / 2, footY(d.y) - h2 + h2 * (def.visual.legacy.lift ?? 0), wd, h2);
        };
        standing.push({ x: d.x, y: d.y + (def.visual.legacy.sortDy ?? 0), draw });
      }
      for (const s of drawOrder(standing)) s.draw();
      // Your torch's warm glow, going cold away from it, the wall torches' pools; then the dark
      // over everything (black where you've never seen, dim where you remember).
      const hx = footX(sim.me.x), hy = footY(sim.me.y) - 12 * scale, reach = reachNow * T * flicker;
      ctx.globalCompositeOperation = "multiply";
      const cool = ctx.createRadialGradient(hx, hy, 0, hx, hy, reach);
      cool.addColorStop(0, "rgb(255, 222, 170)");
      cool.addColorStop(0.6, "rgb(205, 170, 150)");
      cool.addColorStop(1, "rgb(150, 146, 185)");
      ctx.fillStyle = cool;
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = "lighter";
      const warm = ctx.createRadialGradient(hx, hy, 0, hx, hy, reach * 0.7);
      warm.addColorStop(0, "rgba(255, 150, 60, 0.22)");
      warm.addColorStop(1, "rgba(255, 150, 60, 0)");
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, cw, ch);
      for (const c of burning) {
        const fx = footX(c.x), fy = sy(c.y) - 0.3 * T, r = SCONCE_RADIUS * T * flicker;
        const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        pool.addColorStop(0, "rgba(255, 150, 60, 0.2)");
        pool.addColorStop(1, "rgba(255, 150, 60, 0)");
        ctx.fillStyle = pool;
        ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
      }
      for (const f of fireSeen) {
        const fx = footX(f.x), fy = footY(f.y) - 6 * scale, r = fireReach(f) * T * flicker;
        const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        pool.addColorStop(0, f.left > 0 ? "rgba(255, 150, 50, 0.3)" : "rgba(255, 90, 40, 0.18)");
        pool.addColorStop(1, "rgba(255, 150, 60, 0)");
        ctx.fillStyle = pool;
        ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
      }
      for (const f of alarmed) {
        const fx = footX(f.x), fy = footY(f.y) - 8 * scale, r = ALARM_LIGHT * T * flicker;
        const pool = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
        pool.addColorStop(0, "rgba(255, 150, 60, 0.25)");
        pool.addColorStop(1, "rgba(255, 150, 60, 0)");
        ctx.fillStyle = pool;
        ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
      }
      ctx.globalCompositeOperation = "source-over";
      const d = shade.data;
      for (let y = Math.max(0, y0 - 1); y < Math.min(h, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x < Math.min(w, x1 + 1); x++) {
        const i = y * w + x;
        let glow = torchGlow(Math.hypot(x - sim.me.x, y - sim.me.y), sim.lightNow[i] === 1, sim.known[i] === 1, reachNow, flicker);
        for (const c of burning) if (sconceLight(sim, c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker));
        for (const f of fireSeen) if (fireLight(sim, f)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - f.x, y - f.y), flicker, fireReach(f)));
        for (const c of candlesSeen) if (candleLight(sim, c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker, CANDLE_RADIUS));
        alarmed.forEach((f, k) => { if (foeLight[k][i]) glow = Math.min(glow, torchGlow(Math.hypot(x - f.x, y - f.y), true, true, ALARM_LIGHT, flicker)); });
        d[i * 4] = DARK_RGB[0]; d[i * 4 + 1] = DARK_RGB[1]; d[i * 4 + 2] = DARK_RGB[2]; d[i * 4 + 3] = Math.round(glow * 255);
      }
      mctx.putImageData(shade, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mask, sx(0), sy(0), w * T, h * T);
      ctx.imageSmoothingEnabled = false;
      // The burning torches' flames, over the dark: a fire glows whatever's round it.
      for (const c of sim.sconces) {
        if (!c.lit || c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y) || !there(c)) continue;
        const { x: fx, top } = bracket(c), wob = 1 + 0.12 * Math.sin(now / 70 + c.x);
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(fx, top - 0.15 * T, 0, fx, top - 0.15 * T, 0.7 * T);
        halo.addColorStop(0, "rgba(255, 170, 70, 0.55)");
        halo.addColorStop(1, "rgba(255, 170, 70, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(fx - 0.7 * T, top - 0.85 * T, 1.4 * T, 1.4 * T);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#ff9a2e";
        ctx.beginPath();
        ctx.ellipse(fx, top - 0.16 * T * wob, 0.14 * T, 0.26 * T * wob, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#fff1b0";
        ctx.beginPath();
        ctx.ellipse(fx, top - 0.08 * T, 0.07 * T, 0.13 * T * wob, 0, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Lit candles, over the dark, with a little flickering halo.
      for (const c of candlesSeen) {
        const fx = footX(c.x), top = footY(c.y) - candleSize.h2 * 0.9, r = 0.5 * T * (1 + 0.1 * Math.sin(now / 80 + c.x));
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(fx, top, 0, fx, top, r);
        halo.addColorStop(0, "rgba(255, 190, 90, 0.5)");
        halo.addColorStop(1, "rgba(255, 190, 90, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(fx - r, top - r, 2 * r, 2 * r);
        ctx.globalCompositeOperation = "source-over";
        drawCandle(c);
      }
      // The campfires, over the dark: a fire glows whatever's round it.
      for (const f of sim.fires) {
        if (f.x < x0 || f.x >= x1 || f.y < y0 || f.y >= y1 + 1 || !knownAt(f.x, f.y)) continue;
        const fx = footX(f.x), base = footY(f.y) - 0.45 * T, lit = f.left > 0;
        const r = (lit ? 0.9 + 0.5 * (f.left / CAMPFIRE_HEAL) : 0.55) * T * (1 + 0.08 * Math.sin(now / 90 + f.x));
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(fx, base, 0, fx, base, r);
        halo.addColorStop(0, lit ? "rgba(255, 160, 60, 0.55)" : "rgba(255, 80, 30, 0.3)");
        halo.addColorStop(1, "rgba(255, 160, 60, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(fx - r, base - r, 2 * r, 2 * r);
        ctx.globalCompositeOperation = "source-over";
        drawFire(f, lit ? fireImg : embersImg);
        if (lit) {
          // A tongue of flame flickering over the sprite's, taller the more the fire has left.
          const big = 0.5 + 0.5 * (f.left / CAMPFIRE_HEAL), wob = 1 + 0.2 * Math.sin(now / 55 + f.x);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = "#ffd27a";
          ctx.beginPath();
          ctx.ellipse(fx, base - 0.05 * T - 0.2 * T * big * wob, 0.08 * T, 0.22 * T * big * wob, 0, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // A healing pool's very faint glow, and a "!" over each cage you can open.
      for (const t of shown) {
        if (t.glow) {
          const fx = footX(t.x), fy = footY(t.y) - 0.1 * T, r = 1.1 * T, pulse = 0.06 + 0.03 * Math.sin(now / 700);
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
          g.addColorStop(0, `rgba(120, 220, 255, ${pulse})`);
          g.addColorStop(1, "rgba(120, 220, 255, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(fx - r, fy - r, 2 * r, 2 * r);
          ctx.globalCompositeOperation = "source-over";
        }
        if (t.flag && litAt(t.x, t.y)) {
          ctx.font = `bold ${Math.round(T * 0.75)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.lineWidth = Math.max(2, scale * 1.5);
          ctx.strokeStyle = "#1a0e05";
          ctx.fillStyle = "#ffd23f";
          const top = footY(t.y) - drawSize(view, objectDef(t.def), artOf(objectDef(t.def), t.state)!).wd - 1 * scale - Math.abs(Math.sin(now / 200)) * 2 * scale;
          ctx.strokeText("!", footX(t.x), top);
          ctx.fillText("!", footX(t.x), top);
        }
      }
      // Healing by one: green crosses rising round you.
      if (giving.length > 0) {
        ctx.font = `bold ${Math.round(T * 0.4)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let k = 0; k < 6; k++) {
          const ph = (now / 1100 + k / 6) % 1;
          ctx.fillStyle = `rgba(120, 255, 140, ${1 - ph})`;
          ctx.fillText("+", footX(sim.me.x) + Math.sin(k * 2.3) * 0.45 * T, footY(sim.me.y) - (0.6 + ph * 0.9) * T);
        }
      }
      if (A) {
        const pop = Math.min(1, (now - A.at) / 150);
        ctx.font = `bold ${Math.round(T * 0.9 * pop)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = Math.max(2, scale * 1.5);
        ctx.strokeStyle = "#1a0e05";
        ctx.fillStyle = "#ffd23f";
        for (const f of sim.foes.filter((g) => g.room === A.room)) {
          const fx = footX(f.x), top = footY(f.y) - across(view, FOE_U) - 2 * scale - Math.abs(Math.sin(now / 120)) * 3 * scale;
          ctx.strokeText("!", fx, top);
          ctx.fillText("!", fx, top);
        }
        if (A.fadeAt !== null) {
          ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, (now - A.fadeAt) / (FADE_TIME * 1000))})`;
          ctx.fillRect(0, 0, cw, ch);
        }
      }
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
