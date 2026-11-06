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
// - onSpotted: a room's foes saw you (or you stepped into the chief's camp):
//   that room fights you;
// - onObject: you tapped a chest, a sack or the treasure and walked up to it;
// - onKeep: your spot, what you've seen and the torches you've lit, to save
//   (now and then as you walk, and whenever any of the above happens).
// It reads the rooms as they stand from `room` (beaten rooms lose their
// foes, opened chests show open). Its own scroll, the treasure map, opens
// with `scroll`.

import { useEffect, useMemo, useRef, useState } from "react";
import { ROCK, type Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, roomCentre, scrollMarks, cutOffY, enter, isOpen, stepRule, type Progress, type ScrollMark } from "@/lib/dungeon/layout";
import { advance, cameraAt, findPath, roomAt, walkTo, walkable, type CanStep, type Walker } from "@/lib/dungeon/walk";
import { depthEdges, drawOrder, facingOf, walkFrame, capFade, FACINGS, WALL_LIFT, type Facing } from "@/lib/dungeon/tileArt";
import { torchLit, torchGlow, shutPlan, rubbleOf, placeSconces, canIgnite, sconceInSight, sconceGlow, TORCH_RADIUS, SCONCE_RADIUS, type Sconce } from "@/lib/dungeon/torch";
import { placeFoes, spottedBy, stepFoe, ALERT_KINDS, type Foe } from "@/lib/dungeon/foes";
import { hasFight, ROOM_INFO, type Room } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { WALK_KIT, WALK_HERO, KIT_PX, KIT_ROW, KIT_NORTH, KIT_CAP, KIT_SIDE } from "@/lib/sprites/walk";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, BURLAP_SACK, BURLAP_SACK_OPEN, RICKETY_CHEST, RICKETY_CHEST_OPEN } from "@/lib/sprites/props";
import { artFor } from "@/lib/sprites/art";
import { ROOM_ART } from "@/components/DungeonMapView";

export const WALK_ACROSS = 15;  // tiles across the screen (the user's pick, 2026-11-06)
const REACH_OBJECT = 1.5;       // tiles: this close to a chest or a sack, it opens
const TAP_OBJECT = 1;           // tiles: a tap this close to one counts as tapping it
const FOE_PX = 22;              // a foe's height at 16px tiles (it scales with the zoom)
const OBJECT_PX = 28;           // a chest's or a sack's width at 16px tiles
const FALL_TIME = 0.6, DUST_TIME = 1.2, SHAKE_TIME = 0.4, SHAKE_PX = 3; // a tunnel falling in
const KEEP_EVERY = 5000;        // ms: your spot's saved this often while you walk
const TRAIL_MAX = 3000;         // tiles of your trail kept for the scroll

const COLOURS = { rock: "#07060b", goal: "#f1d9a0", foe: "#b0302a", rubble: ["#5b5560", "#6f6872", "#48434d"], dust: "200, 190, 175" };
const DARK_RGB = [6, 5, 12];
const CLOSED = "rgba(7, 6, 11, 0.6)";
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14", you: "#e0483e" };

export type WalkState = Pick<WalkRun, "at" | "room" | "line" | "known" | "lit" | "trail" | "cuts">;

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const toRuns = (a: Uint8Array) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] && !a[i - 1]) { let j = i; while (a[j]) j++; out.push(i, j - i); }
  return out;
};
const fromRuns = (runs: number[] | undefined, size: number) => {
  const a = new Uint8Array(size);
  for (let k = 0; runs && k + 1 < runs.length; k += 2) a.fill(1, runs[k], Math.min(size, runs[k] + runs[k + 1]));
  return a;
};

// Pictures for the canvas, loaded once.
const IMAGES = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement | null {
  let img = IMAGES.get(src);
  if (!img) { img = new Image(); img.src = src; IMAGES.set(src, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// Something to loot, drawn where it lies: a room's chest, stash or
// treasure (at its middle), or a beaten room's sack or chest.
type Thing = { room: string; x: number; y: number; open: boolean; solid: boolean; art: Parameters<typeof artFor>[0] };

export default function WalkView({ walk, map, here, room, busy, been, cleared, scroll, onScrollClose, onEnter, onSpotted, onObject, onKeep }: {
  walk: WalkRun;                       // the run's walk record (read when this opens; your spot is ours from then)
  map: DungeonMap;                     // what kind each room is
  here: string;                        // the room you're in (the run's position)
  room: (id: string) => Room | undefined; // each room as it stands now
  busy: boolean;                       // a window's open over it: nobody moves
  been: string[];                      // rooms you've stood in (the scroll's marks)
  cleared: string[];                   // …and the ones finished (crossed out)
  scroll: boolean;                     // the scroll is out
  onScrollClose: () => void;
  onEnter: (id: string, state: WalkState) => void;
  onSpotted: (id: string, state: WalkState) => void;
  onObject: (id: string, state: WalkState) => void;
  onKeep: (state: WalkState) => void;
}) {
  const layout = walk.layout;
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const me = useRef<Walker>({ ...walk.at, path: [] });
  const goal = useRef<Pt | null>(null);
  const [progress, setProgress] = useState<Progress>({ room: walk.room, line: walk.line ?? Infinity });
  const progressRef = useRef(progress);
  // The floorplan as it stands: closed tunnels are rock. Walking, light, sight and drawing all use it.
  const live = useMemo(() => shutPlan(plan, layout, progress), [plan, layout, progress]);
  const edges = useMemo(() => depthEdges(live), [live]);
  const known = useRef<Uint8Array>(fromRuns(walk.known, plan.w * plan.h));
  const lightNow = useRef<Uint8Array>(new Uint8Array(plan.w * plan.h));
  const trail = useRef<Pt[]>(walk.trail ?? [walk.at]);
  const cuts = useRef<number[]>(walk.cuts ?? []);
  const sconces = useRef<Sconce[]>(useMemo(() => {
    const lit = new Set(walk.lit ?? []);
    return placeSconces(plan, layout.start, seeded(walk.seed + 505)).map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  }, [plan, layout, walk.seed, walk.lit]));
  const facing = useRef<Facing>("south"); // (facing you to start: the torch shows)
  const walked = useRef(0);
  const falls = useRef(new Map<string, number>());
  const shakeAt = useRef(-Infinity);
  const wantThing = useRef<string | null>(null); // walking up to this room's thing, to open it
  const fired = useRef(0);                      // when a fight was called for (0: none): once, till it starts

  // The props the frame loop reads, kept current.
  const spots = walk.spots;
  const props = useRef({ here, room, busy, spots, onEnter, onSpotted, onObject, onKeep });
  useEffect(() => { props.current = { here, room, busy, spots, onEnter, onSpotted, onObject, onKeep }; });

  const state = (): WalkState => ({
    at: { x: Math.round(me.current.x), y: Math.round(me.current.y) }, room: progressRef.current.room,
    line: progressRef.current.line === Infinity ? null : progressRef.current.line,
    known: toRuns(known.current), lit: sconces.current.filter((c) => c.lit).map((c) => c.id),
    trail: trail.current.slice(-TRAIL_MAX), cuts: cuts.current,
  });
  // Saved as you leave (a fight, the Den, a reload).
  useEffect(() => () => props.current.onKeep(state()), []);

  // Each fight room's foes, where they start (the same places every time this opens).
  const foes = useRef<Foe[]>(useMemo(() => {
    const rng = seeded(walk.seed + 303);
    return Object.keys(layout.rooms).sort().flatMap((id) => {
      const r = room(id);
      return r && hasFight(r) && !r.done && r.enemies ? placeFoes(plan, id, r.enemies.length, rng) : [];
    });
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  // The things to loot, as the rooms stand now.
  const things = (): Thing[] => Object.keys(layout.rooms).flatMap((id): Thing[] => {
    const r = props.current.room(id);
    if (!r) return [];
    const c = roomCentre(layout.rooms[id]);
    if (r.kind === "chest") return [{ room: id, ...c, open: r.done, solid: true, art: r.done ? TREASURE_CHEST_OPEN : TREASURE_CHEST }];
    if (r.kind === "treasure") return [{ room: id, ...c, open: r.done, solid: true, art: r.done ? TREASURE_CHEST_OPEN : TREASURE_CHEST }];
    if (r.kind === "stash") return [{ room: id, ...c, open: !!r.opened, solid: true, art: r.opened ? BURLAP_SACK_OPEN : BURLAP_SACK }];
    if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = props.current.spots?.[id] ?? c;
      const chest = r.container !== "sack";
      return [{ room: id, ...at, open: !!r.opened, solid: false, art: chest ? (r.opened ? RICKETY_CHEST_OPEN : RICKETY_CHEST) : r.opened ? BURLAP_SACK_OPEN : BURLAP_SACK }];
    }
    return [];
  });

  // Where you may walk: what the forward rule allows, only where you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => {
    const forward = stepRule(layout, plan, p);
    const solid = new Set(things().filter((t) => t.solid).map((t) => `${t.x},${t.y}`));
    return (from, to) => forward(from, to) && known.current[to.y * plan.w + to.x] === 1 && !solid.has(`${to.x},${to.y}`);
  };

  // Draw every frame: walk on, move the camera, then what you've seen, lit by your torch.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h } = plan;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : live.tiles[y * w + x]);
    const knownAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && known.current[y * w + x] === 1;
    const litAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && lightNow.current[y * w + x] === 1;
    const lightOf = new Map<string, Uint8Array>();
    const sconceLight = (c: Sconce) => {
      let a = lightOf.get(c.id);
      if (!a) { a = torchLit(live, c, SCONCE_RADIUS); lightOf.set(c.id, a); }
      return a;
    };
    // The dark, a pixel a tile, drawn smoothed up over the view (soft edges to the light).
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    const shade = mctx.createImageData(w, h);
    let last = performance.now(), frame = 0, kept = performance.now(), movedSince = false, inRoom: string | null = roomAt(plan, me.current);
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      if (fired.current && now - fired.current > 2000) fired.current = 0; // (it didn't start: carry on)
      const P = props.current, busy = P.busy || fired.current > 0;
      const before = { x: me.current.x, y: me.current.y };
      if (!busy) me.current = advance(me.current, dt);
      const moved = Math.hypot(me.current.x - before.x, me.current.y - before.y);
      if (moved > 0) { walked.current += moved; movedSince = true; facing.current = facingOf(me.current.x - before.x, me.current.y - before.y, facing.current); }
      // The torch: what it lights now, remembered from now on; the wall torches.
      const flicker = 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37 + 1.3);
      lightNow.current = torchLit(live, me.current);
      let lighted = false;
      for (const c of sconces.current) {
        if (!busy && canIgnite(live, c, me.current)) { c.lit = true; lighted = true; }
        if (sconceInSight(live, c, me.current)) {
          const a = sconceLight(c);
          for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
        }
      }
      for (let i = 0; i < lightNow.current.length; i++) if (lightNow.current[i]) known.current[i] = 1;
      const step = { x: Math.round(me.current.x), y: Math.round(me.current.y) }, prev = trail.current[trail.current.length - 1];
      if (!prev || prev.x !== step.x || prev.y !== step.y) trail.current.push(step);
      // Into a room: maybe up a tunnel (what's behind closes, falling in if you'd seen it).
      const now_in = roomAt(plan, me.current);
      if (now_in && now_in !== inRoom) {
        inRoom = now_in;
        const next = enter(layout, progressRef.current, now_in);
        if (next !== progressRef.current) {
          if (next.line !== progressRef.current.line) {
            cuts.current.push(cutOffY(next));
            const was = new Set(rubbleOf(plan, layout, progressRef.current).map((r) => r.key));
            for (const r of rubbleOf(plan, layout, next)) if (!was.has(r.key) && r.tiles.some((q) => known.current[q.y * w + q.x])) falls.current.set(r.key, now);
            if (falls.current.size > 0) shakeAt.current = now;
          }
          progressRef.current = next;
          setProgress(next);
        }
        if (now_in !== P.here) { P.onEnter(now_in, state()); kept = now; movedSince = false; }
      }
      // The foes look about; if any of a room's sees you (or you walk into the chief's camp), that room fights you.
      const p = progressRef.current;
      const awake = (id: string) => { const r = P.room(id); return !!r && hasFight(r) && !r.done && isOpen(layout, p, id); };
      foes.current = foes.current.filter((f) => awake(f.room) || !isOpen(layout, p, f.room));
      if (!busy) {
        foes.current = foes.current.map((f) => stepFoe(live, f, dt));
        const camp = now_in && awake(now_in) && ALERT_KINDS.includes(P.room(now_in)!.kind) ? now_in : null;
        const by = camp ?? spottedBy(live, foes.current, me.current, awake);
        if (by) {
          fired.current = now;
          me.current = { x: Math.round(me.current.x), y: Math.round(me.current.y), path: [] };
          goal.current = null;
          P.onSpotted(by, state());
          return;
        }
        // Walking up to a thing you tapped: open it once you're close.
        const want = wantThing.current && things().find((t) => t.room === wantThing.current);
        if (want && Math.hypot(want.x - me.current.x, want.y - me.current.y) <= REACH_OBJECT) {
          wantThing.current = null;
          me.current = { ...me.current, path: me.current.path.slice(0, 1) };
          P.onObject(want.room, state());
          kept = now;
        } else if (want && me.current.path.length === 0) wantThing.current = null;
      }
      if (lighted || (movedSince && now - kept > KEEP_EVERY)) { kept = now; movedSince = false; P.onKeep(state()); }

      // ── Drawing ──
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      const T = cw / WALK_ACROSS, scale = T / 16;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cam = cameraAt(plan, me.current, { w: cw / T, h: ch / T });
      const shake = (now - shakeAt.current) / 1000 < SHAKE_TIME ? SHAKE_PX * scale * (1 - (now - shakeAt.current) / 1000 / SHAKE_TIME) : 0;
      const jx = shake ? (Math.random() * 2 - 1) * shake : 0, jy = shake ? (Math.random() * 2 - 1) * shake : 0;
      const sx = (x: number) => Math.round((x - cam.x) * T + jx), sy = (y: number) => Math.round((y - cam.y) * T + jy);
      const x0 = Math.floor(cam.x) - 1, x1 = Math.ceil(cam.x + cw / T) + 1, y0 = Math.floor(cam.y) - 1, y1 = Math.ceil(cam.y + ch / T) + 1;
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      // The kit (lib/sprites/walk.ts): a kit pixel is T / KIT_PX across and T / KIT_ROW down.
      const kitImg = { floor: image(WALK_KIT.floor), north: image(WALK_KIT.north), cap: image(WALK_KIT.cap), east: image(WALK_KIT.east), west: image(WALK_KIT.west) };
      const kit = Object.values(kitImg).every(Boolean) ? (kitImg as Record<keyof typeof kitImg, HTMLImageElement>) : null;
      const vy = T / KIT_ROW, side = Math.round((KIT_SIDE * T) / KIT_PX);
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
          if (y < y1) ctx.drawImage(kit.floor, 0, 0, KIT_PX, KIT_ROW, sx(x), sy(y), wd, sy(y + 1) - sy(y));
          if (at(x, y - 1) !== ROCK) continue;
          const dh = faceAbove(x, y);
          if (dh > 0) ctx.drawImage(kit.north, 0, KIT_NORTH - dh / vy, KIT_PX, dh / vy, sx(x), sy(y) - dh, wd, dh);
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
      const end = me.current.path[me.current.path.length - 1];
      if (end) {
        const midX = (v: number) => (v - cam.x + 0.5) * T + jx, midY = (v: number) => (v - cam.y + 0.5) * T + jy;
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.setLineDash([3 * scale, 4 * scale]);
        ctx.beginPath();
        ctx.moveTo(midX(me.current.x), midY(me.current.y));
        for (const q of me.current.path) ctx.lineTo(midX(q.x), midY(q.y));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeRect(sx(end.x) + 3 * scale, sy(end.y) + 3 * scale, T - 6 * scale, T - 6 * scale);
      }
      // Everything standing up, lowest on screen last: things to loot, rubble, foes, you, south walls' tops.
      const footX = (x: number) => (x - cam.x + 0.5) * T + jx, footY = (y: number) => (y - cam.y + 0.5) * T + 4 * scale + jy;
      const standing: { x: number; y: number; draw: () => void }[] = [];
      for (const t of things()) {
        if (!knownAt(t.x, t.y)) continue;
        const a = artFor(t.art), img = a && image(a.src);
        standing.push({ x: t.x, y: t.y, draw: () => {
          if (!img || !a) return;
          const wd = OBJECT_PX * scale, h2 = (wd * a.h) / a.w;
          ctx.drawImage(img, footX(t.x) - wd / 2, footY(t.y) - h2, wd, h2);
        } });
      }
      for (const r of rubbleOf(plan, layout, p)) {
        const fell = falls.current.get(r.key);
        if (fell === undefined && !r.tiles.some((q) => known.current[q.y * w + q.x])) continue; // never seen: just rock
        const age = fell === undefined ? Infinity : (now - fell) / 1000;
        if (age > DUST_TIME) falls.current.delete(r.key);
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
      for (const f of foes.current) {
        if (!litAt(Math.round(f.x), Math.round(f.y))) continue;
        const e = P.room(f.room)?.enemies?.[f.index];
        const a = e && artFor(CREATURE_SPRITES[e.creatureId] ?? []), img = a && image(a.src);
        standing.push({ x: f.x, y: f.y, draw: () => {
          const fx = footX(f.x), fy = footY(f.y), tall = FOE_PX * scale;
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
      standing.push({ x: me.current.x, y: me.current.y, draw: () => {
        if (!heroImg) return;
        const moving = me.current.path.length > 0 && !busy;
        const col = WALK_HERO.frames > 0 ? walkFrame(walked.current, moving, WALK_HERO.frames) + 1 : 0;
        const row = FACINGS.indexOf(facing.current), px = T / KIT_PX, size = WALK_HERO.cell * px;
        ctx.drawImage(heroImg, col * WALK_HERO.cell, row * WALK_HERO.cell, WALK_HERO.cell, WALK_HERO.cell,
          Math.round(footX(me.current.x) - size / 2), Math.round(footY(me.current.y) - WALK_HERO.feet * px), size, size);
      } });
      // South walls stand up over the floor's bottom row (see-through close to you).
      const lift = Math.round(KIT_CAP * vy);
      if (kit) for (const q of edges.south) {
        if (q.x < x0 || q.x >= x1 || q.y < y0 || q.y >= y1 || !knownAt(q.x, q.y - 1)) continue;
        standing.push({ x: q.x, y: q.y - 0.5, draw: () => {
          ctx.globalAlpha = capFade(Math.hypot(q.x - me.current.x, q.y - 0.5 - WALL_LIFT / 2 - me.current.y));
          const l = at(q.x - 1, q.y) === ROCK && at(q.x - 1, q.y - 1) === ROCK ? side : 0;
          const r = at(q.x + 1, q.y) === ROCK && at(q.x + 1, q.y - 1) === ROCK ? side : 0;
          ctx.drawImage(kit.cap, 0, 0, KIT_PX, KIT_CAP, sx(q.x) - l, sy(q.y) - lift, sx(q.x + 1) - sx(q.x) + l + r, lift);
          ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
          ctx.fillRect(sx(q.x), sy(q.y) - lift, T, Math.max(1, scale));
          ctx.globalAlpha = 1;
        } });
      }
      // The wall torches' brackets (their flames go over the dark, below).
      const burning = sconces.current.filter((c) => c.lit && knownAt(c.x, c.y) && c.x >= x0 - SCONCE_RADIUS && c.x < x1 + SCONCE_RADIUS && c.y >= y0 - SCONCE_RADIUS && c.y < y1 + SCONCE_RADIUS);
      for (const c of sconces.current) {
        if (c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y)) continue;
        standing.push({ x: c.x, y: c.y - 0.6, draw: () => {
          const fx = footX(c.x), top = sy(c.y) - 1.1 * T;
          ctx.fillStyle = "#2a2018";
          ctx.fillRect(fx - 0.08 * T, top, 0.16 * T, 0.45 * T);
          ctx.fillStyle = "#4a3a2a";
          ctx.fillRect(fx - 0.16 * T, top, 0.32 * T, 0.1 * T);
        } });
      }
      for (const s of drawOrder(standing)) s.draw();
      // Your torch's warm glow, going cold away from it, the wall torches' pools; then the dark
      // over everything (black where you've never seen, dim where you remember).
      const hx = footX(me.current.x), hy = footY(me.current.y) - 12 * scale, reach = TORCH_RADIUS * T * flicker;
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
      ctx.globalCompositeOperation = "source-over";
      const d = shade.data;
      for (let y = Math.max(0, y0 - 1); y < Math.min(h, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x < Math.min(w, x1 + 1); x++) {
        const i = y * w + x;
        let glow = torchGlow(Math.hypot(x - me.current.x, y - me.current.y), lightNow.current[i] === 1, known.current[i] === 1, TORCH_RADIUS, flicker);
        for (const c of burning) if (sconceLight(c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker));
        d[i * 4] = DARK_RGB[0]; d[i * 4 + 1] = DARK_RGB[1]; d[i * 4 + 2] = DARK_RGB[2]; d[i * 4 + 3] = Math.round(glow * 255);
      }
      mctx.putImageData(shade, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mask, sx(0), sy(0), w * T, h * T);
      ctx.imageSmoothingEnabled = false;
      // The burning torches' flames, over the dark: a fire glows whatever's round it.
      for (const c of sconces.current) {
        if (!c.lit || c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y)) continue;
        const fx = footX(c.x), top = sy(c.y) - 1.1 * T, wob = 1 + 0.12 * Math.sin(now / 70 + c.x);
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
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the loop reads the rest through refs
  }, [plan, live, layout, edges]);

  // A tunnel's turned to rock under the way you were going: find the way again.
  useEffect(() => {
    if (goal.current) me.current = walkTo(live, { ...me.current, path: me.current.path.slice(0, 1) }, goal.current, rule(progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rule() reads refs and the layout
  }, [live]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || fired.current > 0) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const T = el.clientWidth / WALK_ACROSS;
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / T, h: el.clientHeight / T });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / T), y: Math.floor(cam.y + (e.clientY - box.top) / T) };
    const can = rule(progressRef.current);
    // A tap on (or by) something to loot that you've seen: walk up beside it, and it opens.
    const t = things().find((x) => Math.hypot(x.x - spot.x, x.y - spot.y) <= TAP_OBJECT && known.current[x.y * plan.w + x.x]);
    if (t) {
      if (Math.hypot(t.x - me.current.x, t.y - me.current.y) <= REACH_OBJECT) { onObject(t.room, state()); return; }
      const from = me.current.path[0] ?? { x: Math.round(me.current.x), y: Math.round(me.current.y) };
      let best: Pt[] | null = null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = { x: t.x + dx, y: t.y + dy };
        if ((dx || dy || !t.solid) && walkable(live, n.x, n.y)) {
          const way = findPath(live, from, n, can);
          if (way && (!best || way.length < best.length)) best = way;
        }
      }
      if (best) {
        goal.current = null;
        wantThing.current = t.room;
        me.current = { ...me.current, path: me.current.path.length > 0 ? [from, ...best] : best };
      }
      return;
    }
    goal.current = spot;
    wantThing.current = null;
    me.current = walkTo(live, me.current, spot, can);
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
      <canvas ref={canvas} onPointerDown={tap} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", touchAction: "none" }} />
      {scroll && <WalkScroll map={map} layout={layout} plan={plan} known={known.current} trail={trail.current} cuts={cuts.current}
        been={been} here={roomAt(plan, me.current)} cleared={cleared} onClose={onScrollClose} />}
    </div>
  );
}

// The scroll, like a treasure map (layout.ts scrollMarks): what your torch has
// lit, your trail, the cut-offs in red, a mark per room (crossed once
// cleared). Tap to put it away.
function WalkScroll({ map, layout, plan, known, trail, cuts, been, here, cleared, onClose }: {
  map: DungeonMap; layout: WalkRun["layout"]; plan: ReturnType<typeof layoutFloorplan>; known: Uint8Array; trail: Pt[]; cuts: number[];
  been: string[]; here: string | null; cleared: string[]; onClose: () => void;
}) {
  const [shown] = useState(() => {
    const ink: { x: number; y: number; w: number; wall: boolean }[] = [];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      if (!known[y * plan.w + x]) continue;
      const wall = at(x, y) === ROCK;
      if (wall && !isWall(x, y)) continue;
      const run = ink[ink.length - 1];
      if (run && run.y === y && run.wall === wall && run.x + run.w === x) run.w++;
      else ink.push({ x, y, w: 1, wall });
    }
    const marks: ScrollMark[] = scrollMarks(map, layout, been, here);
    return { ink, marks, trail: trail.slice(), cuts: cuts.slice() };
  });
  return (
    <div onPointerDown={onClose} style={{ position: "absolute", inset: 0, zIndex: 5, background: INK.paper, border: `3px solid ${INK.edge}`, touchAction: "none" }}>
      <svg viewBox={`0 0 ${plan.w} ${plan.h}`} style={{ position: "absolute", inset: "3%", width: "94%", height: "94%" }}>
        {shown.ink.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1.05} fill={r.wall ? INK.wall : INK.floor} />)}
        {shown.cuts.map((y, i) => <line key={i} x1={0} x2={plan.w} y1={y} y2={y} stroke={INK.cut} strokeWidth={0.9} strokeDasharray="3 2" />)}
        <polyline points={shown.trail.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ")} fill="none" stroke={INK.trail} strokeWidth={0.7} strokeDasharray="1.2 1.2" strokeLinejoin="round" />
        {shown.marks.map((m) => {
          const x = m.x * plan.w, y = m.y * plan.h, art = m.kind && ROOM_ART[m.kind];
          return (
            <g key={m.id}>
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
