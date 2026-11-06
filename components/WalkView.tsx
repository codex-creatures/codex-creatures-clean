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
import { layoutFloorplan, roomCentre, scrollMarks, foreseen, cutOffY, enter, isOpen, stepRule, type Progress, type ScrollMark } from "@/lib/dungeon/layout";
import { advance, cameraAt, findPath, roomAt, walkToward, walkable, type CanStep, type Walker } from "@/lib/dungeon/walk";
import { depthEdges, drawOrder, facingOf, walkFrame, capFade, FACINGS, WALL_LIFT, type Facing } from "@/lib/dungeon/tileArt";
import { torchLit, torchGlow, shutPlan, tunnelShut, rubbleOf, placeSconces, canIgnite, sconceInSight, fireInSight, sconceGlow, TORCH_RADIUS, SCONCE_RADIUS, type Sconce } from "@/lib/dungeon/torch";
import { byFire, warmBy, CAMPFIRE_HEAL, CAMPFIRE_LIGHT, EMBER_LIGHT, type Campfire } from "@/lib/dungeon/campfire";
import { placeFoes, placeWaiter, spottedBy, stepFoe, chargePath, chargeFoe, fightReady, spawnOf, parentOf, ALARM_PAUSE, ALARM_LIGHT, ARRIVE, FADE_TIME, type Foe } from "@/lib/dungeon/foes";
import { hasFight, ROOM_INFO, type DungeonId, type Room } from "@/lib/dungeon/run";
import { waitsHere, cageSpots, type WalkRun } from "@/lib/dungeon/walkRun";
import type { DungeonMap } from "@/lib/dungeon/map";
import { WALK_KIT, WALK_HERO, WALK_WITCH, WALK_CAGE, WALK_CAGE_OPEN, WALK_POOL, KIT_PX, KIT_ROW, KIT_NORTH, KIT_CAP, KIT_SIDE, type WalkProp } from "@/lib/sprites/walk";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, BURLAP_SACK, BURLAP_SACK_OPEN, RICKETY_CHEST, RICKETY_CHEST_OPEN, CARD_DECK, MERCHANT, LIBRARIAN, CARD_WITCH } from "@/lib/sprites/props";
import { artFor } from "@/lib/sprites/art";
import { ROOM_ART } from "@/components/DungeonMapView";
import { CreatureArt } from "@/components/CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { PartyMember } from "@/components/PartySlots";

export const WALK_ACROSS = 15;  // tiles across the screen (the user's pick, 2026-11-06)
const REACH_OBJECT = 1.5;       // tiles: this close to a chest or a sack, it opens
const TAP_OBJECT = 1;           // tiles: a tap this close to one counts as tapping it
const FOE_PX = 22;              // a foe's height at 16px tiles (it scales with the zoom)
const BOSS_SCALE = 2.6, CHIEF_SCALE = 1.3; // a waiting boss drawn this much bigger (the Cyclops; the Encampment's chief)
const NPC_PX = 26;              // a wanderer's height (the merchant, the librarian, the card witch)
const NPC_STILL = 4;            // tiles: a wanderer stops to let you come up to it
const NPC_SPEED = 0.6;          // …and walks about at this share of a foe's pace
const OBJECT_PX = 28;           // a chest's width at 16px tiles
const SACK_PX = 16;             // …a sack's (stashes, a fight's loot): smaller (the user, 2026-11-06)
const FALL_TIME = 0.6, DUST_TIME = 1.2, SHAKE_TIME = 0.4, SHAKE_PX = 3; // a tunnel falling in
const KEEP_EVERY = 5000;        // ms: your spot's saved this often while you walk
const HEAL_EVERY = 400;         // ms: health from a campfire is handed back this often
const SHOW_EVERY = 100;         // ms: the campfire window updates this often
const OUT_SHOW = 1500;          // ms the campfire window stays up after the fire's burnt down
const TRAIL_MAX = 3000;         // tiles of your trail kept for the scroll

const COLOURS = { rock: "#07060b", goal: "#f1d9a0", foe: "#b0302a", rubble: ["#5b5560", "#6f6872", "#48434d"], dust: "200, 190, 175" };
const DARK_RGB = [6, 5, 12];
const CLOSED = "rgba(7, 6, 11, 0.6)";
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14", you: "#e0483e" };

export type WalkState = Pick<WalkRun, "at" | "room" | "line" | "known" | "lit" | "trail" | "cuts" | "fires">;
// The campfire window: the team's health as it heals, who's getting some, what the fire has left.
type Warming = { hp: Record<string, number>; giving: string[]; left: number };

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

// Something to tap, drawn where it lies: a room's chest, stash or treasure
// (at its middle), a beaten room's sack or chest, a pool, a large room's
// stores, a camp's cages (along its top; flag: "!" over one you can open), or
// someone in the room (npc: the merchant, the librarian, the witch walking
// about). key: the room, or "<room>#<cage>".
type Thing = { key: string; room: string; x: number; y: number; open: boolean; solid: boolean; sack?: boolean; art?: Parameters<typeof artFor>[0];
  prop?: WalkProp; cage?: number; flag?: boolean; npc?: boolean; glow?: boolean };

export default function WalkView({ walk, map, dungeon = 0, here, room, busy, been, cleared, lit, seen, scroll, team, hp, onScrollClose, onEnter, onSpotted, onObject, onCage, onHeal, onKeep }: {
  walk: WalkRun;                       // the run's walk record (read when this opens; your spot is ours from then)
  map: DungeonMap;                     // what kind each room is
  dungeon?: DungeonId;                 // which (the Encampment's chief waits; the Labyrinth's camps don't)
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
    return placeSconces(plan, layout.start, seeded(walk.seed + 505), true).map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  }, [plan, layout, walk.seed, walk.lit]));
  const fires = useRef<Campfire[]>((walk.fires ?? []).map((f) => ({ ...f })));
  const [warming, setWarming] = useState<Warming | null>(null);
  const facing = useRef<Facing>("south"); // (facing you to start: the torch shows)
  const walked = useRef(0);
  const falls = useRef(new Map<string, number>());
  const shakeAt = useRef(-Infinity);
  const wantThing = useRef<string | null>(null); // walking up to this thing (its key), to open it
  const fired = useRef(0);                      // when a fight was called for (0: none): once, till it starts
  // Seen: whose room, when (ms), the foes that have set off and reached you (by index: seconds after), the fade's start.
  const alarm = useRef<{ room: string; at: number; going: Set<number>; arrived: Map<number, number>; fadeAt: number | null } | null>(null);

  // The props the frame loop reads, kept current.
  const spots = walk.spots;
  const props = useRef({ here, room, busy, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep });
  useEffect(() => { props.current = { here, room, busy, spots, team, hp, onEnter, onSpotted, onObject, onCage, onHeal, onKeep }; });

  const state = (): WalkState => ({
    at: { x: Math.round(me.current.x), y: Math.round(me.current.y) }, room: progressRef.current.room,
    line: progressRef.current.line === Infinity ? null : progressRef.current.line,
    known: toRuns(known.current), lit: sconces.current.filter((c) => c.lit).map((c) => c.id),
    trail: trail.current.slice(-TRAIL_MAX), cuts: cuts.current, fires: fires.current.map((f) => ({ ...f })),
  });
  // Saved as you leave (a fight, the Den, a reload).
  useEffect(() => () => props.current.onKeep(state()), []);

  // Every room, and a big room's second den (foes.ts spawnOf) where it has one.
  const ids = useMemo(() => Object.keys(layout.rooms).sort().flatMap((id) => (map.nodes[spawnOf(id)] ? [id, spawnOf(id)] : [id])), [layout, map]);
  // Each fight room's foes, where they start (the same places every time this
  // opens): two dens in a room keep to an end each; a boss waits at the top.
  const foes = useRef<Foe[]>(useMemo(() => {
    const rng = seeded(walk.seed + 303);
    return ids.flatMap((id) => {
      const r = room(id);
      if (!r || !hasFight(r) || r.done) return [];
      if (waitsHere(r, dungeon)) return [placeWaiter(plan, id)];
      const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
      return r.enemies ? placeFoes(plan, id, r.enemies.length, rng, end) : [];
    });
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  // The card witch walks about her room (the merchant and the librarian stand by their carts).
  const npcs = useRef<Foe[]>(useMemo(() => {
    const rng = seeded(walk.seed + 404);
    return ids.flatMap((id) => (room(id)?.kind === "witch" ? placeFoes(plan, id, 1, rng).map((f) => ({ ...f, walks: true, wait: 1 })) : []));
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  // The things to tap, as the rooms stand now.
  const things = (): Thing[] => ids.flatMap((id): Thing[] => {
    const r = props.current.room(id);
    if (!r) return [];
    const c = roomCentre(layout.rooms[parentOf(id)]);
    const out: Thing[] = [];
    const add = (t: Omit<Thing, "key" | "room">) => out.push({ key: id, room: id, ...t });
    if (r.kind === "chest" || r.kind === "treasure") add({ ...c, open: r.done, solid: true, art: r.done ? TREASURE_CHEST_OPEN : TREASURE_CHEST });
    else if (r.kind === "stash") add({ ...c, open: !!r.opened, solid: true, sack: true, art: r.opened ? BURLAP_SACK_OPEN : BURLAP_SACK });
    else if (r.kind === "pool") add({ ...c, open: r.done, solid: true, prop: WALK_POOL, glow: !r.done });
    else if (r.kind === "cards") add({ ...c, open: r.done, solid: true, art: CARD_DECK });
    else if (r.kind === "merchant") add({ ...c, open: false, solid: true, npc: true, art: MERCHANT });
    else if (r.kind === "librarian" || (r.kind === "library" && r.librarian)) add({ ...c, open: false, solid: true, npc: true, art: LIBRARIAN });
    else if (r.kind === "witch") for (const n of npcs.current.filter((f) => f.room === id)) add({ x: Math.round(n.x), y: Math.round(n.y), open: false, solid: false, npc: true, art: CARD_WITCH });
    // A large room's stores (a library's codexes lying about, a storehouse's crates), till a guard's beaten.
    if ((r.kind === "library" || r.kind === "storehouse") && r.sack && !hasFight(r) && !r.container) {
      add({ ...c, open: !!r.opened, solid: true, sack: r.kind === "library", art: r.kind === "library" ? (r.opened ? BURLAP_SACK_OPEN : BURLAP_SACK) : r.opened ? RICKETY_CHEST_OPEN : RICKETY_CHEST });
    }
    if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = props.current.spots?.[id] ?? c;
      const chest = r.container !== "sack";
      add({ ...at, open: !!r.opened, solid: false, sack: !chest, art: chest ? (r.opened ? RICKETY_CHEST_OPEN : RICKETY_CHEST) : r.opened ? BURLAP_SACK_OPEN : BURLAP_SACK });
    }
    // A camp's cages, along its top: "!" over each you can open (its guards beaten, or none to see).
    if (r.cages?.length) cageSpots(plan, parentOf(id), r.cages.length).forEach((q, i) => {
      const cage = r.cages![i];
      out.push({ key: `${id}#${i}`, room: id, ...q, cage: i, open: !!cage.opened, solid: true, prop: cage.opened ? WALK_CAGE_OPEN : WALK_CAGE, flag: !cage.opened && (!hasFight(r) || r.done) });
    });
    return out;
  });

  // Tapped (and walked up to) a thing: a cage opens as a cage; anything else is its room's.
  const openThing = (t: Thing, st: WalkState) => (t.cage !== undefined ? props.current.onCage?.(t.room, t.cage, st) : props.current.onObject(t.room, st));
  // A tap on (or by) a thing: within TAP_OBJECT of it, or of someone's body (they stand a tile tall).
  const tapped = (t: Thing, q: Pt) => Math.hypot(t.x - q.x, t.y - q.y) <= TAP_OBJECT || (!!t.npc && Math.hypot(t.x - q.x, t.y - 1 - q.y) <= TAP_OBJECT);

  // Where you may walk: what the forward rule allows, only where you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => {
    const forward = stepRule(layout, plan, p);
    const solid = new Set([...things().filter((t) => t.solid), ...fires.current].map((t) => `${t.x},${t.y}`));
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
    // (A torch in a tunnel that's fallen in is gone with it.)
    const there = (c: Sconce) => live.tiles[c.y * w + c.x] !== ROCK;
    const fireReach = (f: Campfire) => (f.left > 0 ? CAMPFIRE_LIGHT : EMBER_LIGHT);
    const fireLight = (f: Campfire) => {
      const id = `fire:${f.room}:${fireReach(f)}`;
      let a = lightOf.get(id);
      if (!a) { a = torchLit(live, f, fireReach(f)); lightOf.set(id, a); }
      return a;
    };
    // Health from a campfire: not yet handed back, and handed back but not in `hp` yet.
    let pending: Record<string, number> = {}, sent: Record<string, number> = {}, sentFor = props.current.hp;
    let healedAt = performance.now(), shownAt = 0, outAt = -Infinity, showing = false;
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
      if (fired.current && now - fired.current > 2000) { fired.current = 0; alarm.current = null; } // (it didn't start: carry on)
      const P = props.current, busy = P.busy || fired.current > 0, A = alarm.current;
      const before = { x: me.current.x, y: me.current.y };
      if (!busy && !A) me.current = advance(me.current, dt);
      const moved = Math.hypot(me.current.x - before.x, me.current.y - before.y);
      if (moved > 0) { walked.current += moved; movedSince = true; facing.current = facingOf(me.current.x - before.x, me.current.y - before.y, facing.current); }
      // The torch: what it lights now, remembered from now on; the wall torches.
      const flicker = 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37 + 1.3);
      lightNow.current = torchLit(live, me.current);
      let lighted = false;
      for (const c of sconces.current) {
        if (!there(c)) continue;
        if (!busy && canIgnite(live, c, me.current)) { c.lit = true; lighted = true; }
        if (sconceInSight(live, c, me.current)) {
          const a = sconceLight(c);
          for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
        }
      }
      const fireSeen = fires.current.filter((f) => fireInSight(live, f, me.current));
      for (const f of fireSeen) { const a = fireLight(f); for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1; }
      const alarmed = A ? foes.current.filter((f) => f.room === A.room) : [];
      const foeLight = alarmed.map((f) => torchLit(live, f, ALARM_LIGHT));
      for (const a of foeLight) for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
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
      const awake = (id: string) => { const r = P.room(id); return !!r && hasFight(r) && !r.done && isOpen(layout, p, parentOf(id)); };
      foes.current = foes.current.filter((f) => awake(f.room) || !isOpen(layout, p, parentOf(f.room)));
      if (!busy && A) {
        // Seen: a "!" a moment, then they come at you; it fades into the fight once they're there.
        const t = (now - A.at) / 1000;
        foes.current = foes.current.map((f) => {
          if (f.room !== A.room || A.arrived.has(f.index)) return f;
          let g = f;
          if (t < ALARM_PAUSE) g = { ...g, facing: Math.atan2(me.current.y - g.y, me.current.x - g.x) };
          else {
            if (!A.going.has(f.index)) { A.going.add(f.index); g = { ...g, path: chargePath(live, g, me.current) }; }
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
          P.onSpotted(A.room, state());
        }
      } else if (!busy) {
        foes.current = foes.current.map((f) => stepFoe(live, f, dt));
        // The witch wanders, slowly, and stops (facing you) to let you come up to her.
        npcs.current = npcs.current.map((n) => (Math.hypot(n.x - me.current.x, n.y - me.current.y) <= NPC_STILL
          ? { ...n, path: [], facing: Math.atan2(me.current.y - n.y, me.current.x - n.x) } : stepFoe(live, n, dt * NPC_SPEED)));
        const by = spottedBy(live, foes.current, me.current, awake);
        if (by) {
          alarm.current = { room: by, at: now, going: new Set(), arrived: new Map(), fadeAt: null };
          me.current = { x: Math.round(me.current.x), y: Math.round(me.current.y), path: [] };
          goal.current = null;
          wantThing.current = null;
          P.onKeep(state());
          return;
        }
        // Walking up to a thing you tapped: open it once you're close.
        const want = wantThing.current && things().find((t) => t.key === wantThing.current);
        if (want && Math.hypot(want.x - me.current.x, want.y - me.current.y) <= REACH_OBJECT) {
          wantThing.current = null;
          me.current = { ...me.current, path: me.current.path.slice(0, 1) };
          openThing(want, state());
          kept = now;
        } else if (want && me.current.path.length === 0) wantThing.current = null;
      }
      // By a campfire: the team heals from it, the window shows it, and what it's given is handed back now and then.
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
        P.onHeal(gains, state());
      }
      const show = !!fire || now - outAt < OUT_SHOW;
      if (show && now - shownAt > SHOW_EVERY) {
        shownAt = now;
        showing = true;
        setWarming({ hp: Object.fromEntries(P.team.map((m) => [m.id, Math.min(1, health(m.id))])), giving, left: fire?.left ?? 0 });
      } else if (!show && showing) { showing = false; setWarming(null); }
      if (lighted || (movedSince && (now - kept > KEEP_EVERY || P.busy))) { kept = now; movedSince = false; P.onKeep(state()); }

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
      const shown = things().filter((t) => knownAt(t.x, t.y) && (!t.npc || litAt(t.x, t.y) || t.solid));
      for (const t of shown) {
        const witch = t.npc && t.art === CARD_WITCH ? npcs.current.find((n) => n.room === t.room) : undefined;
        const sheet = witch && image(WALK_WITCH.sheet);
        if (witch && sheet) {
          // The card witch walking about (a sheet like the hero's), facing the way she goes.
          standing.push({ x: witch.x, y: witch.y, draw: () => {
            const face = facingOf(Math.cos(witch.facing), Math.sin(witch.facing), "south");
            const col = witch.path.length > 0 ? 1 + (Math.floor(now / 130) % WALK_WITCH.frames) : 0;
            const px = (NPC_PX * scale) / WALK_WITCH.tall, size = WALK_WITCH.cell * px;
            const row = FACINGS.indexOf(face === "west" ? "east" : face);
            ctx.save();
            ctx.translate(Math.round(footX(witch.x)), Math.round(footY(witch.y) - WALK_WITCH.feet * px));
            if (face === "west") ctx.scale(-1, 1);
            ctx.drawImage(sheet, col * WALK_WITCH.cell, row * WALK_WITCH.cell, WALK_WITCH.cell, WALK_WITCH.cell, -size / 2, 0, size, size);
            ctx.restore();
          } });
          continue;
        }
        const a = t.prop ?? (t.art ? artFor(t.art) : undefined), img = a && image(a.src);
        const px = witch ? { x: witch.x, y: witch.y } : t;
        standing.push({ x: px.x, y: px.y, draw: () => {
          if (!img || !a) return;
          const wd = t.prop ? t.prop.size * scale : t.npc ? (NPC_PX * scale * a.w) / a.h : (t.sack ? SACK_PX : OBJECT_PX) * scale, h2 = (wd * a.h) / a.w;
          // (A used pool is dimmed.)
          if (t.prop === WALK_POOL && t.open) ctx.globalAlpha = 0.6;
          ctx.drawImage(img, footX(px.x) - wd / 2, footY(px.y) - h2 + (t.prop === WALK_POOL ? h2 * 0.35 : 0), wd, h2);
          ctx.globalAlpha = 1;
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
        if (!litAt(Math.round(f.x), Math.round(f.y)) && !(A && f.room === A.room)) continue;
        const fr = P.room(f.room), e = fr?.enemies?.[f.index];
        const sprite = fr?.boss ? CREATURE_SPRITES[fr.boss] : e && CREATURE_SPRITES[e.creatureId];
        const a = sprite && artFor(sprite), img = a && image(a.src);
        standing.push({ x: f.x, y: f.y, draw: () => {
          const fx = footX(f.x), fy = footY(f.y), tall = FOE_PX * scale * (f.waits ? (fr?.boss ? BOSS_SCALE : CHIEF_SCALE) : 1);
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
      const burning = sconces.current.filter((c) => c.lit && there(c) && knownAt(c.x, c.y) && c.x >= x0 - SCONCE_RADIUS && c.x < x1 + SCONCE_RADIUS && c.y >= y0 - SCONCE_RADIUS && c.y < y1 + SCONCE_RADIUS);
      // (On a tunnel's side wall, it sticks out from the wall's edge, by the tile's middle.)
      const bracket = (c: Sconce) => (c.wall === "left" ? { x: sx(c.x) + 0.1 * T, top: sy(c.y) - 0.2 * T } : c.wall === "right" ? { x: sx(c.x + 1) - 0.1 * T, top: sy(c.y) - 0.2 * T } : { x: footX(c.x), top: sy(c.y) - 1.1 * T });
      for (const c of sconces.current) {
        if (c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y) || !there(c)) continue;
        standing.push({ x: c.x, y: c.wall === "left" || c.wall === "right" ? c.y + 0.4 : c.y - 0.6, draw: () => {
          const { x: fx, top } = bracket(c);
          ctx.fillStyle = "#2a2018";
          ctx.fillRect(fx - 0.08 * T, top, 0.16 * T, 0.45 * T);
          ctx.fillStyle = "#4a3a2a";
          ctx.fillRect(fx - 0.16 * T, top, 0.32 * T, 0.1 * T);
        } });
      }
      // Campfires: a ring of stones round crossed logs (the flames go over the dark, below). A placeholder for art.
      for (const f of fires.current) {
        if (!knownAt(f.x, f.y)) continue;
        standing.push({ x: f.x, y: f.y, draw: () => {
          const fx = footX(f.x), fy = footY(f.y) - 3 * scale;
          ctx.fillStyle = f.left > 0 ? "#3a2412" : "#24170c";
          for (const tilt of [-0.45, 0.45]) {
            ctx.save();
            ctx.translate(fx, fy - 0.08 * T);
            ctx.rotate(tilt);
            ctx.fillRect(-0.36 * T, -0.07 * T, 0.72 * T, 0.14 * T);
            ctx.restore();
          }
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * 2 * Math.PI;
            ctx.fillStyle = k % 2 ? "#5b5560" : "#6f6872";
            ctx.beginPath();
            ctx.ellipse(fx + Math.cos(a) * 0.42 * T, fy + Math.sin(a) * 0.22 * T, 0.11 * T, 0.08 * T, 0, 0, 2 * Math.PI);
            ctx.fill();
          }
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
        let glow = torchGlow(Math.hypot(x - me.current.x, y - me.current.y), lightNow.current[i] === 1, known.current[i] === 1, TORCH_RADIUS, flicker);
        for (const c of burning) if (sconceLight(c)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - c.x, y - c.y), flicker));
        for (const f of fireSeen) if (fireLight(f)[i]) glow = Math.min(glow, sconceGlow(Math.hypot(x - f.x, y - f.y), flicker, fireReach(f)));
        alarmed.forEach((f, k) => { if (foeLight[k][i]) glow = Math.min(glow, torchGlow(Math.hypot(x - f.x, y - f.y), true, true, ALARM_LIGHT, flicker)); });
        d[i * 4] = DARK_RGB[0]; d[i * 4 + 1] = DARK_RGB[1]; d[i * 4 + 2] = DARK_RGB[2]; d[i * 4 + 3] = Math.round(glow * 255);
      }
      mctx.putImageData(shade, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mask, sx(0), sy(0), w * T, h * T);
      ctx.imageSmoothingEnabled = false;
      // The burning torches' flames, over the dark: a fire glows whatever's round it.
      for (const c of sconces.current) {
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
      // The campfires' flames (or the embers' glow), over the dark.
      for (const f of fires.current) {
        if (f.x < x0 || f.x >= x1 || f.y < y0 || f.y >= y1 + 1 || !knownAt(f.x, f.y)) continue;
        const fx = footX(f.x), base = footY(f.y) - 0.2 * T, r = (f.left > 0 ? 1.1 : 0.6) * T;
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(fx, base - 0.2 * T, 0, fx, base - 0.2 * T, r);
        halo.addColorStop(0, f.left > 0 ? "rgba(255, 160, 60, 0.6)" : "rgba(255, 80, 30, 0.35)");
        halo.addColorStop(1, "rgba(255, 160, 60, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(fx - r, base - 0.2 * T - r, 2 * r, 2 * r);
        ctx.globalCompositeOperation = "source-over";
        if (f.left > 0) {
          // Taller the more it has left to give.
          const big = 0.6 + 0.4 * (f.left / CAMPFIRE_HEAL);
          for (const [dx, tall, col, wd] of [[-0.14, 0.5, "#ff7a1e", 0.15], [0.14, 0.45, "#ff7a1e", 0.14], [0, 0.7, "#ff9a2e", 0.2], [0, 0.4, "#fff1b0", 0.1]] as const) {
            const wob = 1 + 0.15 * Math.sin(now / 60 + dx * 20 + f.x);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.ellipse(fx + dx * T, base - (tall / 2) * T * big * wob, wd * T, (tall / 2) * T * big * wob, 0, 0, 2 * Math.PI);
            ctx.fill();
          }
        } else {
          for (let k = 0; k < 5; k++) {
            ctx.fillStyle = `rgba(255, ${Math.round(70 + 40 * Math.abs(Math.sin(now / 300 + k)))}, 30, 0.9)`;
            ctx.fillRect(fx + (((k * 7) % 5) - 2) * 0.1 * T, base + (((k * 3) % 3) - 1) * 0.06 * T, 0.07 * T, 0.07 * T);
          }
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
          const top = footY(t.y) - (t.prop?.size ?? OBJECT_PX) * scale - 1 * scale - Math.abs(Math.sin(now / 200)) * 2 * scale;
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
          ctx.fillText("+", footX(me.current.x) + Math.sin(k * 2.3) * 0.45 * T, footY(me.current.y) - (0.6 + ph * 0.9) * T);
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
        for (const f of foes.current.filter((g) => g.room === A.room)) {
          const fx = footX(f.x), top = footY(f.y) - FOE_PX * scale - 2 * scale - Math.abs(Math.sin(now / 120)) * 3 * scale;
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
    if (goal.current) me.current = walkToward(live, { ...me.current, path: me.current.path.slice(0, 1) }, goal.current, rule(progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rule() reads refs and the layout
  }, [live]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (busy || fired.current > 0 || alarm.current) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const T = el.clientWidth / WALK_ACROSS;
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / T, h: el.clientHeight / T });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / T), y: Math.floor(cam.y + (e.clientY - box.top) / T) };
    const can = rule(progressRef.current);
    // A tap on (or by) something to loot that you've seen: walk up beside it, and it opens.
    const t = things().find((x) => tapped(x, spot) && known.current[x.y * plan.w + x.x]);
    if (t) {
      if (Math.hypot(t.x - me.current.x, t.y - me.current.y) <= REACH_OBJECT) { openThing(t, state()); return; }
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
        wantThing.current = t.key;
        me.current = { ...me.current, path: me.current.path.length > 0 ? [from, ...best] : best };
      }
      return;
    }
    goal.current = spot;
    wantThing.current = null;
    me.current = walkToward(live, me.current, spot, can);
  };

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
      <canvas ref={canvas} onPointerDown={tap} style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", touchAction: "none" }} />
      {warming && !scroll && <Warmth team={team} warming={warming} />}
      {scroll && <WalkScroll map={map} layout={layout} plan={plan} known={known.current} trail={trail.current} progress={progress}
        been={been} here={roomAt(plan, me.current)} at={me.current} cleared={cleared} lit={lit} seen={seen} onClose={onScrollClose} />}
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
// lit, your trail, a red line along each tunnel you'd seen that's closed off,
// a mark per room (crossed once cleared). A room a clairvoyance scroll looked
// into is drawn in, and the rooms it and a flare showed are marked (foreseen).
// As wide as the rooms' walls reach, scrolling up and down, opened at you
// (the user, 2026-11-06). Tap to put it away, or (onPick) tap a room to pick it.
function WalkScroll({ map, layout, plan, known, trail, progress, been, here, at, cleared, lit, seen, onClose, onPick }: {
  map: DungeonMap; layout: WalkRun["layout"]; plan: ReturnType<typeof layoutFloorplan>; known: Uint8Array; trail: Pt[]; progress?: Progress;
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
    // Closed-off tunnels you'd seen: a red line down the middle.
    const shut = !progress ? [] : layout.tunnels
      .filter((t) => tunnelShut(layout, progress, t) && (plan.tunnels[t.key] ?? []).some((q) => drawn[q.y * plan.w + q.x]))
      .map(({ rect: { x, y, w, h }, up }) => (up ? { x1: x + w / 2, y1: y, x2: x + w / 2, y2: y + h } : { x1: x, y1: y + h / 2, x2: x + w, y2: y + h / 2 }));
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
        progress={{ room: walk.room, line: walk.line ?? Infinity }} been={been} here={here} at={walk.at} cleared={cleared} lit={lit} seen={seen} onPick={onPick} />
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
