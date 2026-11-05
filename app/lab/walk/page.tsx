"use client";
// app/lab/walk/page.tsx — walking round a rolled Encampment (lib/dungeon/layout.ts,
// lib/dungeon/walk.ts): tap anywhere to walk there, the camera following you,
// in a phone-shaped view, zoomed in close (Zoom flicks between sizes).
//
// You carry a torch (lib/dungeon/torch.ts): it lights what it can reach in a
// straight line, so you walk round a corner to see past it, and what it's lit
// stays remembered, dimmer. You can only walk where you've seen; foes show
// only in the light. It glows warm, flickering, fading to a cold dark.
// Up tunnels are one way: what's behind you closes. A closed tunnel is
// rock; one you'd seen falls in, rubble blocking its mouth (with a crash).
// Each room is labelled with what's in it once you've been in (campMap: the
// live Encampment's mix). The scroll (scrollMarks) can be looked at
// SCROLL_LOOKS times a roll: a mark per room, and, like a treasure map, what
// your torch has lit, your trail, red lines where you cut yourself off, and a
// cross on each room you've cleared.
// Reveal shows the whole scroll (every room and tunnel, every room's contents)
// without using a look, and stays open through rerolls, to judge layouts.
// A dotted line shows the way you'll walk.
//
// A little depth (tileArt.ts): side walls show their face as you go across a
// room, and south walls stand up over the floor, going see-through as you
// get close behind them.
//
// Art draws it with the PixelLab samples (lib/dungeon/tileArt.ts, lib/sprites/walk.ts;
// the boxes stay the default); Tiles and Hero flick between the samples.
//
// The rooms play out (lib/dungeon/foes.ts, walkRooms.ts): each fight room's
// foes stand in it, rolled by the live room roll; if any of them sees you,
// all of them fight you, in the real battle screen, with an in-memory test
// team (TEST_TEAM). Win and they leave a sack of spoils; lose and it's a
// fresh roll from the entrance. Chests, stashes and sacks open when you tap
// them (you walk up first) in the game's loot window, with a test bag.
// Cones shows what each foe can see.
//
// Dev tool: NOTHING here touches the game's save, slots, registry or battle
// history. Your spot (where you are, what you've seen and cleared, the bag) is
// kept only for this tab (sessionStorage, LAB_KEY), so a reload carries on.

import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_INFO, makeEnemy, enemyFighter, gearOf, gearName, hasFight, type Enemy, type Room, type SackItem } from "@/lib/dungeon/run";
import { ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, campMap, roomCentre, WALK_SPEC, scrollMarks, cutOffY, SCROLL_LOOKS, type ScrollMark, startProgress, enter, isOpen, stepRule, routeProblems, type Progress } from "@/lib/dungeon/layout";
import { advance, cameraAt, findPath, roomAt, walkTo, walkable, type CanStep, type Walker } from "@/lib/dungeon/walk";
import { cellArt, depthEdges, drawOrder, facingOf, walkFrame, sideFace, capFade, FACINGS, SHEET_TILE, WANG_TILES, FACE_TILE, TOP_TILE, WALL_LIFT, type Facing } from "@/lib/dungeon/tileArt";
import { torchLit, torchGlow, shutPlan, rubbleOf, placeSconces, canIgnite, sconceInSight, sconceGlow, TORCH_RADIUS, SCONCE_RADIUS, type Sconce } from "@/lib/dungeon/torch";
import { placeFoes, spottedBy, stepFoe, visionCone, ALERT_KINDS, type Foe } from "@/lib/dungeon/foes";
import { rollWalkRooms, fightSack, chestSack } from "@/lib/dungeon/walkRooms";
import { WALK_TILES, WALK_HEROES, KIT_PX, KIT_ROW, KIT_NORTH, KIT_CAP, KIT_SIDE } from "@/lib/sprites/walk";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, BURLAP_SACK, BURLAP_SACK_OPEN } from "@/lib/sprites/props";
import { artFor } from "@/lib/sprites/art";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { BattleView, usePlayableBattle, type MemberInfo } from "@/components/BattleScreen";
import { lookOf } from "@/components/ContainerLoot";
import LootWindow from "@/components/LootWindow";
import DenFrame from "@/components/DenFrame";
import { ROOM_ART } from "@/components/DungeonMapView";
import type { Pt } from "@/lib/dungeon/floorplan";
import type { Rarity } from "@/lib/types";

// Zoom, as tiles across the screen, so it looks the same on a phone and a
// laptop whatever the screen's size (🧪: the user tries them).
const ZOOMS = [22, 15, 11, 9];
const START_ZOOM = 1; // 15 across (the user's pick, 2026-11-06)
const LAB_KEY = "codex_lab_walk_v1"; // sessionStorage: this tab's spot in the lab (never the game's save)
// The team you fight with (🧪): three creatures of this rarity, in gear of this rarity, at this level.
const TEST_TEAM: { rarity: Rarity; gear: Rarity; level: number } = { rarity: "uncommon", gear: "uncommon", level: 5 };
const LAB_BAG = 6;        // the test bag's slots
const REACH_OBJECT = 1.5; // tiles: this close to a chest or a sack, a tap opens it
const TAP_OBJECT = 1;     // tiles: a tap this close to one counts as tapping it
const FOE_PX = 22;        // a foe's height at 16px tiles (it scales with the zoom)
const OBJECT_PX = 28;     // a chest's or a sack's width at 16px tiles
const FALL_TIME = 0.6;    // seconds rubble takes to fall
const DUST_TIME = 1.2;    // seconds its dust hangs
const SHAKE_TIME = 0.4;   // seconds the screen shakes
const SHAKE_PX = 3;       // at 16px tiles

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = {
  rock: "#07060b", wall: "#4a4f5c", wallTop: "#5d6372", wallSide: "#34374a", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f",
  you: "#e0483e", goal: "#f1d9a0", label: "#2a2418", foe: "#b0302a", cone: "rgba(255, 90, 60, 0.18)", coneEdge: "rgba(255, 90, 60, 0.5)",
  rubble: ["#5b5560", "#6f6872", "#48434d"], dust: "200, 190, 175",
};
const DARK_RGB = [6, 5, 12]; // the dark's colour: a cold near-black
const CLOSED = "rgba(7, 6, 11, 0.6)";
const SHEET: React.CSSProperties = { position: "absolute", inset: "6% 6%", zIndex: 10, overflowY: "auto", padding: 12, background: "rgba(20, 16, 10, 0.95)", border: "2px solid #6b4f2a", color: "#f1d9a0", fontSize: 13 };
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14" };

// What the scroll shows when you open it (a snapshot: it doesn't change while open).
type Scroll = { marks: ScrollMark[]; ink: { x: number; y: number; w: number; wall: boolean }[]; trail: Pt[]; cuts: number[]; cleared: string[] };

// Something to loot: a room's chest, stash or treasure (at its middle), or a
// sack of spoils left by a fight. items: what's in it, once opened (null: not yet).
type Box = { id: string; kind: "chest" | "stash" | "treasure" | "spoils"; room: string; x: number; y: number; items: SackItem[] | null };
const BOX_NAMES: Record<Box["kind"], string> = { chest: "The chest", stash: "The stash", treasure: "The treasure", spoils: "The spoils" };

// Your spot, kept for this tab (Progress.line can be Infinity, which JSON can't hold: null).
// known: the tiles you've seen, as runs of [start, length].
type Saved = {
  seed: number; x: number; y: number; room: string; line: number | null; seen: string[]; done: string[]; hp: number[]; bag: SackItem[]; looks: number; cuts: number[]; trail: Pt[];
  known?: number[]; purse?: SackItem[]; boxes?: Box[]; litSconces?: string[];
};
const readSaved = (): Saved | null => {
  try { const s = window.sessionStorage.getItem(LAB_KEY); return s ? (JSON.parse(s) as Saved) : null; } catch { return null; }
};
const writeSaved = (s: Saved | null) => {
  try { if (s) window.sessionStorage.setItem(LAB_KEY, JSON.stringify(s)); else window.sessionStorage.removeItem(LAB_KEY); } catch { /* (private mode: not kept) */ }
};
const toRuns = (a: Uint8Array) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] && !a[i - 1]) { let j = i; while (a[j]) j++; out.push(i, j - i); }
  return out;
};
const fromRuns = (runs: number[], size: number) => {
  const a = new Uint8Array(size);
  for (let k = 0; k + 1 < runs.length; k += 2) a.fill(1, runs[k], Math.min(size, runs[k] + runs[k + 1]));
  return a;
};

// Pictures for the canvas, loaded once.
const IMAGES = new Map<string, HTMLImageElement>();
function image(src: string): HTMLImageElement | null {
  let img = IMAGES.get(src);
  if (!img) { img = new Image(); img.src = src; IMAGES.set(src, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// The test team: three of TEST_TEAM, no two the same species, rolled with the layout.
function testTeam(seed: number): { enemies: Enemy[]; info: MemberInfo[] } {
  const rng = seeded(seed * 7 + 1);
  const enemies: Enemy[] = [];
  for (let i = 0; i < 3; i++) enemies.push(makeEnemy(TEST_TEAM.rarity, TEST_TEAM.gear, enemies.map((e) => e.creatureId), rng, TEST_TEAM.level));
  return { enemies, info: enemies.map(infoOf) };
}
function infoOf(e: Enemy): MemberInfo {
  const w = gearOf(e, "weapon"), a = gearOf(e, "armor");
  return { rarity: CREATURE_BY_ID[e.creatureId].rarity, label: creatureTypeLabel(e.proficiency), creatureId: e.creatureId, weaponName: w && gearName(w), armorName: a && gearName(a) };
}

export default function WalkLab() {
  const [seed, setSeed] = useState(1);
  const layout = useMemo(() => rollLayout(WALK_SPEC, seeded(seed)), [seed]);
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const camp = useMemo(() => campMap(layout, false, seeded(seed + 7919)), [layout, seed]);
  const kinds = camp.nodes;
  const team = useMemo(() => testTeam(seed), [seed]);
  const rooms = useMemo<Record<string, Room>>(() => rollWalkRooms(camp, seeded(seed + 101), true, team.enemies.flatMap((e) => CREATURE_BY_ID[e.creatureId].races ?? [])), [camp, seed, team]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const startSpot = useMemo(() => roomCentre(layout.rooms[layout.start]), [layout]);
  const me = useRef<Walker>({ ...startSpot, path: [] });
  const goal = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState<Progress>(startProgress(layout));
  const progressRef = useRef(progress);
  // The floorplan as it stands: closed tunnels are rock (torch.ts shutPlan). Walking, light, sight and art all use it.
  const live = useMemo(() => shutPlan(plan, layout, progress), [plan, layout, progress]);
  const art = useMemo(() => cellArt(live), [live]);
  const edges = useMemo(() => depthEdges(live), [live]);
  const [here, setHere] = useState<string | null>(layout.start);
  const [dark, setDark] = useState(true);
  const darkRef = useRef(dark);
  const [looks, setLooks] = useState(SCROLL_LOOKS);
  const [scroll, setScroll] = useState<Scroll | null>(null);
  const [reveal, setReveal] = useState(false);
  // Drawing: the boxes, or the art samples (which tileset, which hero); the foes' cones; the zoom.
  const [drawArt, setDrawArt] = useState(true);
  const [tileSet, setTileSet] = useState(0);
  const [hero, setHero] = useState(0);
  const [cones, setCones] = useState(false);
  const [zoom, setZoom] = useState(START_ZOOM);
  const look = useRef({ drawArt, tileSet, hero, cones, across: ZOOMS[zoom] });
  useEffect(() => { look.current = { drawArt, tileSet, hero, cones, across: ZOOMS[zoom] }; }, [drawArt, tileSet, hero, cones, zoom]);
  // Your walk so far, tile by tile, and the cut-offs you've crossed (tiles down), for the scroll.
  const trail = useRef<Pt[]>([]);
  const cuts = useRef<number[]>([]);
  useEffect(() => { darkRef.current = dark; }, [dark]);
  // The hero's facing and how far they've walked (for the walk frames).
  const facing = useRef<Facing>("north");
  const walked = useRef(0);

  // The run: the foes still standing, the rooms dealt with (beaten, opened),
  // your team's HP (share of max), the test bag and what takes no room in it
  // (gold, cards), what there is to loot, a fight on, a loot window open.
  const foes = useRef<Foe[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const doneRef = useRef(done);
  const [hp, setHp] = useState<number[]>([1, 1, 1]);
  const [bag, setBag] = useState<SackItem[]>([]);
  const [purse, setPurse] = useState<SackItem[]>([]);
  const [sheet, setSheet] = useState<"party" | "bag" | null>(null); // the dock's sheets
  const [retreatArmed, setRetreatArmed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fight, setFight] = useState<{ room: string; team: number[] } | null>(null);
  const fightRef = useRef(fight);
  const boxes = useRef<Box[]>([]);
  const [lootId, setLootId] = useState<string | null>(null);
  const lootRef = useRef(lootId);
  const [, redraw] = useState(0); // a box's contents changed (they live in boxes.current)
  const wantBox = useRef<string | null>(null); // walking up to this box, to open it
  const battle = usePlayableBattle(undefined, { history: false });
  useEffect(() => { fightRef.current = fight; lootRef.current = lootId; }, [fight, lootId]);
  const markDone = (id: string) => {
    const next = new Set(doneRef.current).add(id);
    doneRef.current = next;
    setDone(next);
  };

  // What you've seen: the tiles your torch has lit (remembered), the rooms you've been in.
  const seen = useRef(new Set<string>());
  const known = useRef<Uint8Array>(new Uint8Array(0));
  const lightNow = useRef<Uint8Array>(new Uint8Array(0)); // what the torch lights this moment
  // Rubble falling (tunnel key → when it closed, in performance.now() ms): the rest have fallen.
  const falls = useRef(new Map<string, number>());
  // The torches on the walls (torch.ts): lit or not.
  const sconces = useRef<Sconce[]>([]);
  const shakeAt = useRef(-Infinity);
  // Where you may walk: what the forward rule allows, (in the dark) only what you've seen, and never into a chest.
  const rule = (p: Progress): CanStep => {
    const forward = stepRule(layout, plan, p);
    const solid = new Set(boxes.current.filter((b) => b.kind !== "spoils").map((b) => `${b.x},${b.y}`));
    return (from, to) => forward(from, to) && (!darkRef.current || known.current[to.y * plan.w + to.x] === 1) && !solid.has(`${to.x},${to.y}`);
  };

  // Your spot, for this tab: written now and then as you go, read once when the page opens.
  const bagRef = useRef(bag), hpRef = useRef(hp), looksRef = useRef(looks), purseRef = useRef(purse);
  useEffect(() => { bagRef.current = bag; hpRef.current = hp; looksRef.current = looks; purseRef.current = purse; }, [bag, hp, looks, purse]);
  const keep = () => writeSaved({
    seed, x: Math.round(me.current.x), y: Math.round(me.current.y), room: progressRef.current.room,
    line: progressRef.current.line === Infinity ? null : progressRef.current.line,
    seen: [...seen.current], done: [...doneRef.current], hp: hpRef.current, bag: bagRef.current, looks: looksRef.current,
    cuts: cuts.current, trail: trail.current, known: toRuns(known.current), purse: purseRef.current, boxes: boxes.current,
    litSconces: sconces.current.filter((c) => c.lit).map((c) => c.id),
  });
  const keepRef = useRef(keep);
  useEffect(() => { keepRef.current = keep; });
  const restored = useRef(false);

  // A new labyrinth: back to its entrance (or, when the page opens, to the spot you'd got to in this tab).
  useEffect(() => {
    let saved: Saved | null = null;
    if (!restored.current) {
      restored.current = true;
      saved = readSaved();
      if (saved && saved.seed !== seed) { setSeed(saved.seed); restored.current = false; return; }
    }
    me.current = saved ? { x: saved.x, y: saved.y, path: [] } : { ...startSpot, path: [] };
    goal.current = null;
    wantBox.current = null;
    progressRef.current = saved ? { room: saved.room, line: saved.line ?? Infinity } : startProgress(layout);
    setProgress(progressRef.current);
    seen.current = new Set([layout.start, ...(saved?.seen ?? [])]);
    known.current = saved?.known ? fromRuns(saved.known, plan.w * plan.h) : new Uint8Array(plan.w * plan.h);
    lightNow.current = new Uint8Array(plan.w * plan.h);
    falls.current = new Map();
    const wasLit = new Set(saved?.litSconces ?? []);
    sconces.current = placeSconces(plan, layout.start, seeded(seed + 505)).map((c) => (wasLit.has(c.id) ? { ...c, lit: true } : c));
    trail.current = saved?.trail ?? [startSpot];
    cuts.current = saved?.cuts ?? [];
    setLooks(saved?.looks ?? SCROLL_LOOKS);
    setScroll(null);
    const gone = new Set(saved?.done ?? []);
    doneRef.current = gone;
    setDone(gone);
    setHp(saved?.hp ?? [1, 1, 1]);
    setBag(saved?.bag ?? []);
    setPurse(saved?.purse ?? []);
    setNote(null);
    setFight(null);
    setLootId(null);
    battle.clear();
    // The chests, stashes and treasure, at their rooms' middles (and any spoils left lying).
    boxes.current = saved?.boxes ?? Object.entries(rooms).filter(([, r]) => r.kind === "chest" || r.kind === "stash" || r.kind === "treasure")
      .map(([id, r]) => ({ id, kind: r.kind as Box["kind"], room: id, ...roomCentre(layout.rooms[id]), items: null }));
    // Each fight room's foes, where they start (beaten rooms have none).
    const rng = seeded(seed + 303);
    foes.current = Object.entries(rooms).flatMap(([id, r]) => (hasFight(r) && r.enemies && !gone.has(id) ? placeFoes(plan, id, r.enemies.length, rng) : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- battle.clear is stable enough
  }, [layout, startSpot, rooms]);

  // The fight with a room's foes: your team still standing against all of them.
  const startFight = (id: string) => {
    const room = rooms[id];
    if (!room?.enemies || fightRef.current) return;
    me.current = { x: Math.round(me.current.x), y: Math.round(me.current.y), path: [] };
    goal.current = null;
    wantBox.current = null;
    const standing = team.enemies.map((_, i) => i).filter((i) => hpRef.current[i] > 0);
    const mine = standing.map((i) => enemyFighter(team.enemies[i]));
    const f = { room: id, team: standing };
    fightRef.current = f;
    setFight(f);
    battle.start(
      { A: mine, B: room.enemies.map(enemyFighter) },
      { A: standing.map((i) => team.info[i]), B: room.enemies.map(infoOf) },
      room.level ?? "hard",
      { startHp: mine.map((m, k) => Math.round(hpRef.current[standing[k]] * m.maxHp)), title: `Lab · ${ROOM_INFO[room.kind].name}` },
    );
  };
  // Won: the foes are gone, leaving a sack of spoils where you stand (opened
  // for you); at the camp, the cages are listed too.
  const winFight = () => {
    const f = fightRef.current, m = battle.match;
    if (!f || !m) return;
    const nextHp = [...hpRef.current];
    m.state.sides.A.team.forEach((c, k) => { nextHp[f.team[k]] = c.hp / c.maxHp; });
    setHp(nextHp);
    hpRef.current = nextHp;
    const room = rooms[f.room];
    const sack = fightSack(room);
    foes.current = foes.current.filter((x) => x.room !== f.room);
    markDone(f.room);
    const spot = { x: Math.round(me.current.x), y: Math.round(me.current.y) };
    const id = `spoils:${f.room}`;
    boxes.current = [...boxes.current.filter((b) => b.id !== id), { id, kind: "spoils", room: f.room, ...spot, items: sack }];
    const cages = f.room === layout.boss ? (room.cages ?? []).flatMap((c) => (c.creatureId ? [`${CREATURE_BY_ID[c.creatureId].name} (Lv ${c.level ?? 1})`] : [])) : [];
    if (f.room === layout.boss) setNote(`The Encampment's cleared! In the cages: ${cages.join(", ") || "nobody"}. Reroll for another.`);
    fightRef.current = null;
    setFight(null);
    battle.clear();
    setLootId(id);
    keepRef.current();
  };
  // Lost: the run's over, a fresh roll from the entrance.
  const loseRun = () => {
    writeSaved(null);
    fightRef.current = null;
    setFight(null);
    battle.clear();
    setSeed((s) => s + 1);
    setTimeout(() => setNote("Beaten: back to the entrance, on a fresh roll."), 0);
  };
  // A box, reached: opened (rolled the first time) in the loot window.
  const openBox = (id: string) => {
    const b = boxes.current.find((x) => x.id === id);
    if (!b) return;
    if (!b.items) {
      const room = rooms[b.room];
      b.items = b.kind === "chest" ? chestSack() : b.kind === "treasure" ? [{ gold: room.gold ?? 0 }] : room.sack ?? [];
      markDone(b.room);
    }
    me.current = { ...me.current, path: me.current.path.slice(0, 1) };
    goal.current = null;
    wantBox.current = null;
    setLootId(id);
    keepRef.current();
  };
  const openBoxRef = useRef(openBox);
  useEffect(() => { openBoxRef.current = openBox; });

  // Draw every frame: walk on, move the camera, then what you've seen, lit by your torch.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h } = plan;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : live.tiles[y * w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    const knownAt = (x: number, y: number) => !darkRef.current || (x >= 0 && y >= 0 && x < w && y < h && known.current[y * w + x] === 1);
    const litAt = (x: number, y: number) => !darkRef.current || (x >= 0 && y >= 0 && x < w && y < h && lightNow.current[y * w + x] === 1);
    // The dark, a pixel a tile, drawn smoothed up over the view (soft edges to the light).
    // What each burning sconce lights (worked out once it's needed).
    const lightOf = new Map<string, Uint8Array>();
    const sconceLight = (c: Sconce) => {
      let a = lightOf.get(c.id);
      if (!a) { a = torchLit(live, c, SCONCE_RADIUS); lightOf.set(c.id, a); }
      return a;
    };
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d")!;
    const shade = mctx.createImageData(w, h);
    let last = performance.now(), frame = 0, shown: string | null = null, kept = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const busy = !!fightRef.current || !!lootRef.current;
      const before = { x: me.current.x, y: me.current.y };
      if (!busy) me.current = advance(me.current, dt);
      const moved = Math.hypot(me.current.x - before.x, me.current.y - before.y);
      if (moved > 0) { walked.current += moved; facing.current = facingOf(me.current.x - before.x, me.current.y - before.y, facing.current); }
      // The torch: what it lights now, remembered from now on.
      const flicker = 1 + 0.03 * Math.sin(now / 90) + 0.02 * Math.sin(now / 37 + 1.3);
      lightNow.current = torchLit(live, me.current);
      // Walk close to an unlit sconce and you light it; a burning one in sight lights its part of the room.
      for (const c of sconces.current) {
        if (!busy && canIgnite(live, c, me.current)) c.lit = true;
        if (sconceInSight(live, c, me.current)) {
          const a = sconceLight(c);
          for (let i = 0; i < a.length; i++) if (a[i]) lightNow.current[i] = 1;
        }
      }
      for (let i = 0; i < lightNow.current.length; i++) if (lightNow.current[i]) known.current[i] = 1;
      // Into a new room: maybe up a tunnel (what's behind closes, maybe falling in), so find the way on again.
      const room = roomAt(plan, me.current);
      if (room) seen.current.add(room);
      const step = { x: Math.round(me.current.x), y: Math.round(me.current.y) }, prev = trail.current[trail.current.length - 1];
      if (!prev || prev.x !== step.x || prev.y !== step.y) trail.current.push(step);
      if (room && room !== progressRef.current.room) {
        const next = enter(layout, progressRef.current, room);
        if (next !== progressRef.current) {
          if (next.line !== progressRef.current.line) {
            cuts.current.push(cutOffY(next));
            // The tunnels you'd seen that close now fall in (the one you came up, at least).
            const was = new Set(rubbleOf(plan, layout, progressRef.current).map((r) => r.key));
            for (const r of rubbleOf(plan, layout, next)) if (!was.has(r.key) && r.tiles.some((q) => known.current[q.y * w + q.x])) falls.current.set(r.key, now);
            if (falls.current.size > 0) shakeAt.current = now;
          }
          progressRef.current = next;
          setProgress(next);
          // (The way on is found again once the tunnel's rock: see the effect on `live`.)
        }
      }
      if (room !== shown) { shown = room; setHere(room); }
      // The foes look about; if any of a room's sees you (or you walk into the chief's camp), that room fights you.
      const p = progressRef.current;
      if (!busy) {
        foes.current = foes.current.map((f) => stepFoe(live, f, dt));
        const awake = (id: string) => !doneRef.current.has(id) && isOpen(layout, p, id);
        const alert = room && awake(room) && rooms[room] && ALERT_KINDS.includes(rooms[room].kind) ? room : null;
        const by = alert ?? spottedBy(live, foes.current, me.current, awake);
        if (by) startFight(by);
        // Walking up to a box you tapped: open it once you're close.
        const want = wantBox.current && boxes.current.find((b) => b.id === wantBox.current);
        if (want && Math.hypot(want.x - me.current.x, want.y - me.current.y) <= REACH_OBJECT) openBoxRef.current(want.id);
        else if (want && me.current.path.length === 0) wantBox.current = null;
      }
      if (now - kept > 1000) { kept = now; keepRef.current(); }

      const { drawArt: artOn, tileSet: ts, hero: hi, cones: conesOn, across } = look.current;
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      const T = cw / across, scale = T / 16;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cam = cameraAt(plan, me.current, { w: cw / T, h: ch / T });
      // A tunnel falling in shakes the screen a moment.
      const shake = (now - shakeAt.current) / 1000 < SHAKE_TIME ? SHAKE_PX * scale * (1 - (now - shakeAt.current) / 1000 / SHAKE_TIME) : 0;
      const jx = shake ? (Math.random() * 2 - 1) * shake : 0, jy = shake ? (Math.random() * 2 - 1) * shake : 0;
      const sx = (x: number) => Math.round((x - cam.x) * T + jx), sy = (y: number) => Math.round((y - cam.y) * T + jy);
      const x0 = Math.floor(cam.x) - 1, x1 = Math.ceil(cam.x + cw / T) + 1, y0 = Math.floor(cam.y) - 1, y1 = Math.ceil(cam.y + ch / T) + 1;
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      const floorSheet = artOn ? image(WALK_TILES[ts].floor) : null, tunnelSheet = artOn ? image(WALK_TILES[ts].tunnel) : null;
      const artReady = !!(floorSheet && tunnelSheet);
      // A kit (lib/sprites/walk.ts KitArt), in the three-quarter look: a kit pixel is T / KIT_PX
      // across and T / KIT_ROW down (its rows are squashed, as the view is).
      const kitArt = artOn ? WALK_TILES[ts].kit : undefined;
      const kitImg = kitArt && { floor: image(kitArt.floor), north: image(kitArt.north), cap: image(kitArt.cap), east: image(kitArt.east), west: image(kitArt.west) };
      const kit = kitImg && Object.values(kitImg).every(Boolean) ? (kitImg as Record<keyof typeof kitImg, HTMLImageElement>) : null;
      const vy = T / KIT_ROW, side = Math.round((KIT_SIDE * T) / KIT_PX);
      // How tall a floor tile's north wall stands on screen (its face, up to the rock there is).
      const faceAbove = (x: number, y: number) => {
        let rows = 0;
        while (rows < 3 && at(x, y - rows - 1) === ROCK) rows++;
        return Math.min(Math.round(KIT_NORTH * vy), rows * T);
      };
      if (kit) {
        // Floors, then each north wall's face standing in the rock above it, then the narrow
        // side walls' tops (up the face too, where the side wall meets it). The rest of the rock is dark.
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
      } else if (floorSheet && tunnelSheet) {
        // The art: a cell between each four tiles (tileArt.ts), half a tile off the grid.
        for (let cy = y0; cy < y1; cy++) for (let cx = x0; cx < x1; cx++) {
          if (cx < -1 || cy < -1 || cx >= w || cy >= h) continue;
          const i = (cy + 1) * art.w + cx + 1, t = art.tile[i];
          if (t < 0) continue;
          if (!knownAt(cx, cy) && !knownAt(cx + 1, cy) && !knownAt(cx, cy + 1) && !knownAt(cx + 1, cy + 1)) continue;
          const { col, row } = WANG_TILES[t];
          ctx.drawImage(art.tunnel[i] ? tunnelSheet : floorSheet, col * SHEET_TILE, row * SHEET_TILE, SHEET_TILE, SHEET_TILE, sx(cx + 0.5), sy(cy + 0.5), sx(cx + 1.5) - sx(cx + 0.5), sy(cy + 1.5) - sy(cy + 0.5));
        }
      } else {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const t = at(x, y);
          if (t === ROCK && !isWall(x, y)) continue;
          if (!knownAt(x, y)) continue;
          ctx.fillStyle = t === FLOOR ? COLOURS.floor : t === DOOR ? COLOURS.door : t !== ROCK ? COLOURS.tunnel : COLOURS.wall;
          ctx.fillRect(sx(x), sy(y), sx(x + 1) - sx(x), sy(y + 1) - sy(y));
        }
      }
      // Side walls' faces, wider the further across the room you are.
      const eye = { x: cam.x + cw / T / 2, y: cam.y + ch / T / 2 };
      const face = (x: number, y: number, wd: number, toRight: boolean) => {
        const px = Math.max(1, Math.round(wd * T)), left = toRight ? sx(x + 1) : sx(x) - px;
        if (floorSheet) {
          const f = WANG_TILES[FACE_TILE];
          ctx.drawImage(floorSheet, f.col * SHEET_TILE, f.row * SHEET_TILE, SHEET_TILE, SHEET_TILE, left, sy(y), px, sy(y + 1) - sy(y));
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        } else ctx.fillStyle = COLOURS.wallSide;
        ctx.fillRect(left, sy(y), px, sy(y + 1) - sy(y));
      };
      if (!kit && (artReady || !artOn)) {
        for (const q of edges.left) if (q.x >= x0 && q.x < x1 && q.y >= y0 && q.y < y1 && knownAt(q.x, q.y)) { const wd = sideFace(eye.x - (q.x + 1)); if (wd > 0) face(q.x, q.y, wd, true); }
        for (const q of edges.right) if (q.x >= x0 && q.x < x1 && q.y >= y0 && q.y < y1 && knownAt(q.x, q.y)) { const wd = sideFace(q.x - eye.x); if (wd > 0) face(q.x, q.y, wd, false); }
      }
      // Closed rooms, dimmed.
      for (const [id, rs] of Object.entries(plan.rooms)) {
        if (darkRef.current && !seen.current.has(id)) continue;
        if (!isOpen(layout, p, id)) {
          // (One path, so a dog-leg's overlapping arms are dimmed once.)
          ctx.fillStyle = CLOSED;
          ctx.beginPath();
          for (const r of rs) ctx.rect(sx(r.x) - T, sy(r.y) - T, (r.w + 2) * T, (r.h + 2) * T);
          ctx.fill();
        }
      }
      // What the foes can see.
      const showFoe = (f: Foe) => litAt(Math.round(f.x), Math.round(f.y));
      if (conesOn) for (const f of foes.current) {
        if (!showFoe(f)) continue;
        const pts = visionCone(live, f);
        ctx.fillStyle = COLOURS.cone;
        ctx.strokeStyle = COLOURS.coneEdge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach((q, k) => (k === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, (q.x - cam.x + 0.5) * T + jx, (q.y - cam.y + 0.5) * T + jy));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // The way you'll walk (a dotted line from you, shrinking as you go), where you're heading.
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
      // Everything standing up, lowest on screen last (drawOrder): chests, rubble, foes, you, and south walls' raised tops.
      const footX = (x: number) => (x - cam.x + 0.5) * T + jx, footY = (y: number) => (y - cam.y + 0.5) * T + 4 * scale + jy;
      const standing: { x: number; y: number; draw: () => void }[] = [];
      for (const b of boxes.current) {
        if (!knownAt(b.x, b.y)) continue;
        const a = artFor(b.kind === "chest" || b.kind === "treasure" ? (b.items ? TREASURE_CHEST_OPEN : TREASURE_CHEST) : b.items && b.kind !== "spoils" ? BURLAP_SACK_OPEN : BURLAP_SACK);
        const img = a && image(a.src);
        standing.push({ x: b.x, y: b.y, draw: () => {
          if (!img || !a) return;
          const wd = OBJECT_PX * scale, h2 = (wd * a.h) / a.w;
          ctx.drawImage(img, footX(b.x) - wd / 2, footY(b.y) - h2, wd, h2);
        } });
      }
      // Rubble where a tunnel's fallen in: stones heaped in its mouth (falling, then dust, if it's just closed).
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
            const t = age / DUST_TIME;
            ctx.fillStyle = `rgba(${COLOURS.dust}, ${0.5 * (1 - t)})`;
            ctx.beginPath();
            ctx.arc(footX(q.x + into.x), footY(q.y + into.y) - 6 * scale, T * (0.4 + 1.1 * t), 0, 2 * Math.PI);
            ctx.fill();
          }
        } });
      }
      for (const f of foes.current) {
        if (!showFoe(f)) continue;
        const a = artFor(CREATURE_SPRITES[rooms[f.room].enemies![f.index].creatureId] ?? []);
        const img = a && image(a.src);
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
          // Which way it's looking.
          ctx.strokeStyle = COLOURS.foe;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy - 2);
          ctx.lineTo(fx + Math.cos(f.facing) * T * 0.8, fy - 2 + Math.sin(f.facing) * T * 0.8);
          ctx.stroke();
        } });
      }
      const heroArt = WALK_HEROES[hi], heroImg = artOn ? image(heroArt.sheet) : null;
      standing.push({ x: me.current.x, y: me.current.y, draw: () => {
        if (heroImg) {
          const moving = me.current.path.length > 0 && !busy;
          const col = heroArt.frames > 0 ? walkFrame(walked.current, moving, heroArt.frames) + 1 : 0;
          const row = FACINGS.indexOf(facing.current), px = kit ? T / KIT_PX : scale * (heroArt.shrink ?? 1), size = heroArt.cell * px;
          ctx.drawImage(heroImg, col * heroArt.cell, row * heroArt.cell, heroArt.cell, heroArt.cell,
            Math.round(footX(me.current.x) - size / 2), Math.round(footY(me.current.y) - heroArt.feet * px), size, size);
          return;
        }
        ctx.fillStyle = COLOURS.you;
        ctx.beginPath();
        ctx.arc(footX(me.current.x), footY(me.current.y) - 4 * scale, T * 0.4, 0, 2 * Math.PI);
        ctx.fill();
      } });
      // South walls stand up over the floor's bottom row: their tops, raised (see-through close to you).
      const lift = kit ? Math.round(KIT_CAP * vy) : Math.round(WALL_LIFT * T);
      if (artReady || kit || !artOn) for (const q of edges.south) {
        if (q.x < x0 || q.x >= x1 || q.y < y0 || q.y >= y1 || !knownAt(q.x, q.y - 1)) continue;
        standing.push({ x: q.x, y: q.y - 0.5, draw: () => {
          ctx.globalAlpha = capFade(Math.hypot(q.x - me.current.x, q.y - 0.5 - WALL_LIFT / 2 - me.current.y));
          if (kit) {
            // The kit's cap band, reaching on over a side wall's top at a corner.
            const l = at(q.x - 1, q.y) === ROCK && at(q.x - 1, q.y - 1) === ROCK ? side : 0;
            const r = at(q.x + 1, q.y) === ROCK && at(q.x + 1, q.y - 1) === ROCK ? side : 0;
            ctx.drawImage(kit.cap, 0, 0, KIT_PX, KIT_CAP, sx(q.x) - l, sy(q.y) - lift, sx(q.x + 1) - sx(q.x) + l + r, lift);
          } else if (floorSheet) {
            const t = WANG_TILES[TOP_TILE];
            ctx.drawImage(floorSheet, t.col * SHEET_TILE, t.row * SHEET_TILE, SHEET_TILE, SHEET_TILE * WALL_LIFT, sx(q.x), sy(q.y) - lift, sx(q.x + 1) - sx(q.x), lift);
          } else { ctx.fillStyle = COLOURS.wallTop; ctx.fillRect(sx(q.x), sy(q.y) - lift, sx(q.x + 1) - sx(q.x), lift); }
          ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
          ctx.fillRect(sx(q.x), sy(q.y) - lift, T, Math.max(1, scale));
          ctx.globalAlpha = 1;
        } });
      }
      const burning = sconces.current.filter((c) => c.lit && knownAt(c.x, c.y) && c.x >= x0 - SCONCE_RADIUS && c.x < x1 + SCONCE_RADIUS && c.y >= y0 - SCONCE_RADIUS && c.y < y1 + SCONCE_RADIUS);
      for (const c of sconces.current) {
        if (c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y)) continue;
        standing.push({ x: c.x, y: c.y - 0.6, draw: () => {
          const fx = footX(c.x), top = sy(c.y) - (kit ? 1.1 : 0.55) * T;
          ctx.fillStyle = "#2a2018";
          ctx.fillRect(fx - 0.08 * T, top, 0.16 * T, 0.45 * T);
          ctx.fillStyle = "#4a3a2a";
          ctx.fillRect(fx - 0.16 * T, top, 0.32 * T, 0.1 * T);
        } });
      }
      for (const s of drawOrder(standing)) s.draw();
      // The torch: a warm glow round you, going cold away from it; then the dark
      // over everything (black where you've never seen, dim where you remember).
      if (darkRef.current) {
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
        // The burning sconces you've seen: their own warm pools.
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
      }
      // The burning sconces' flames, over the dark: a fire glows whatever's round it.
      for (const c of sconces.current) {
        if (!c.lit || c.x < x0 || c.x >= x1 || c.y < y0 || c.y >= y1 + 1 || !knownAt(c.x, c.y)) continue;
        const fx = footX(c.x), top = sy(c.y) - (kit ? 1.1 : 0.55) * T, wob = 1 + 0.12 * Math.sin(now / 70 + c.x);
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
      // Each room's label, on top, once you've been in.
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      for (const id of Object.keys(plan.rooms)) {
        if (darkRef.current && !seen.current.has(id)) continue;
        const { name, icon } = ROOM_INFO[kinds[id].kind], c = roomCentre(layout.rooms[id]);
        const text = `${icon} ${name}${doneRef.current.has(id) ? " ✓" : ""}`;
        if (artOn) { ctx.strokeText(text, sx(c.x + 0.5), sy(c.y - 1.5)); ctx.fillStyle = "#f1d9a0"; } else ctx.fillStyle = COLOURS.label;
        ctx.fillText(text, sx(c.x + 0.5), artOn ? sy(c.y - 1.5) : sy(c.y + 0.5));
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startFight() only reads plan, layout, rooms and refs
  }, [plan, live, layout, kinds, art, edges, rooms]);

  // A tunnel's turned to rock under the way you were going: find the way again.
  useEffect(() => {
    if (goal.current) me.current = walkTo(live, { ...me.current, path: me.current.path.slice(0, 1) }, goal.current, rule(progress));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rule() reads refs and the layout
  }, [live]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fightRef.current || lootRef.current) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const T = el.clientWidth / ZOOMS[zoom];
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / T, h: el.clientHeight / T });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / T), y: Math.floor(cam.y + (e.clientY - box.top) / T) };
    const can = rule(progressRef.current);
    // A tap on (or by) a box you can see: walk up beside it, and it opens.
    const b = boxes.current.find((x) => Math.hypot(x.x - spot.x, x.y - spot.y) <= TAP_OBJECT && (!dark || known.current[x.y * plan.w + x.x]));
    if (b) {
      if (Math.hypot(b.x - me.current.x, b.y - me.current.y) <= REACH_OBJECT) { openBox(b.id); return; }
      const from = me.current.path[0] ?? { x: Math.round(me.current.x), y: Math.round(me.current.y) };
      let best: Pt[] | null = null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = { x: b.x + dx, y: b.y + dy };
        if ((dx || dy || b.kind === "spoils") && walkable(live, n.x, n.y)) {
          const way = findPath(live, from, n, can);
          if (way && (!best || way.length < best.length)) best = way;
        }
      }
      if (best) {
        goal.current = null;
        wantBox.current = b.id;
        me.current = { ...me.current, path: me.current.path.length > 0 ? [from, ...best] : best };
      }
      return;
    }
    goal.current = spot;
    wantBox.current = null;
    me.current = walkTo(live, me.current, spot, can);
  };

  // The loot window's moves, on the box's contents and the test bag (what takes no room goes in the purse).
  const lootBox = lootId ? boxes.current.find((b) => b.id === lootId) ?? null : null;
  const setItems = (items: SackItem[]) => { if (lootBox) { lootBox.items = items; redraw((n) => n + 1); keepRef.current(); } };
  const take = (i: number, at?: number) => {
    const items = lootBox?.items ?? [], x = items[i];
    if (!x) return;
    const rest = items.filter((_, j) => j !== i);
    if (lookOf(x).free) { setPurse((p) => (purseRef.current = [...p, x])); setItems(rest); return; }
    if (at !== undefined && bag[at]) { setBag((b) => (bagRef.current = b.map((y, j) => (j === at ? x : y)))); setItems([...rest, bag[at]]); return; }
    if (bag.length >= LAB_BAG) return;
    setBag((b) => (bagRef.current = [...b, x]));
    setItems(rest);
  };
  const takeAll = () => {
    let items = lootBox?.items ?? [], room = LAB_BAG - bag.length;
    const free = items.filter((x) => lookOf(x).free), got: SackItem[] = [];
    items = items.filter((x) => !lookOf(x).free).filter((x) => (room-- > 0 ? (got.push(x), false) : true));
    setPurse((p) => (purseRef.current = [...p, ...free]));
    setBag((b) => (bagRef.current = [...b, ...got]));
    setItems(items);
  };
  const putBack = (at: number) => {
    if (!bag[at]) return;
    setItems([...(lootBox?.items ?? []), bag[at]]);
    setBag((b) => (bagRef.current = b.filter((_, j) => j !== at)));
  };
  const gold = purse.reduce((n, x) => n + ("gold" in x ? x.gold : 0), 0);

  const label = !here ? "a tunnel" : `${ROOM_INFO[kinds[here].kind].name} (${layout.rooms[here].shape})`;
  // The scroll as it stands: the seen tiles inked in rows (floor or wall), your trail, the cut-offs, the marks.
  // all: the whole map, as if every room had been lit and walked into (Reveal; no trail).
  const readScroll = (all = false): Scroll => {
    const ink: Scroll["ink"] = [];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      if (!all && !known.current[y * plan.w + x]) continue;
      const wall = at(x, y) === ROCK;
      if (wall && !isWall(x, y)) continue;
      const run = ink[ink.length - 1];
      if (run && run.y === y && run.wall === wall && run.x + run.w === x) run.w++;
      else ink.push({ x, y, w: 1, wall });
    }
    return {
      marks: scrollMarks(camp, layout, all ? Object.keys(layout.rooms) : seen.current, roomAt(plan, me.current)), ink,
      trail: all ? [] : trail.current.slice(), cuts: all ? [] : cuts.current.slice(), cleared: [...done],
    };
  };
  const shown = reveal ? readScroll(true) : scroll;
  const sound = routeProblems(layout, WALK_SPEC.minRoute).length === 0;
  const over = battle.match && !battle.view && battle.match.state.winner;
  const bagLooks = bag.map((x) => { const l = lookOf(x); return { name: l.name, sprite: l.sprite, icon: l.icon, color: l.color, glow: l.glow, peek: x }; });

  // The dock's Scroll: a look, while you have looks left.
  const lookAtScroll = () => { setLooks((n) => n - 1); setScroll(readScroll()); setSheet(null); };
  // Retreat (tap twice): the run's over, a fresh roll from the entrance.
  const retreat = () => {
    if (!retreatArmed) { setRetreatArmed(true); window.setTimeout(() => setRetreatArmed(false), 3000); return; }
    setRetreatArmed(false);
    writeSaved(null);
    setSeed((x) => x + 1);
    setTimeout(() => setNote("You retreated: a fresh roll from the entrance."), 0);
  };
  const standing = hp.filter((x) => x > 0).length;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      {/* The lab's own controls, beside the screen (not part of the game). */}
      <div style={{ flex: "1 1 220px", maxWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", margin: 0 }}>Walk the Encampment</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="chip" disabled={!!fight} onClick={() => { writeSaved(null); setSeed((x) => x + 1); }}>Reroll</button>
          <button className="chip" aria-pressed={dark} onClick={() => setDark((d) => !d)}>Darkness</button>
          <button className="chip" onClick={() => setZoom((z) => (z + 1) % ZOOMS.length)}>Zoom: {ZOOMS[zoom]} tiles across</button>
          <button className="chip" aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>Reveal</button>
          <button className="chip" aria-pressed={drawArt} onClick={() => setDrawArt((a) => !a)}>Art</button>
          <button className="chip" disabled={!drawArt} onClick={() => setTileSet((t) => (t + 1) % WALK_TILES.length)}>Tiles: {WALK_TILES[tileSet].name}</button>
          <button className="chip" disabled={!drawArt} onClick={() => setHero((t) => (t + 1) % WALK_HEROES.length)}>Hero: {WALK_HEROES[hero].name}</button>
          <button className="chip" aria-pressed={cones} onClick={() => setCones((c) => !c)}>Cones</button>
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
          Seed {seed} · {Object.keys(layout.rooms).length} rooms · {layout.tunnels.length} tunnels ({layout.tunnels.filter((t) => !t.up).length} sideways) ·{" "}
          {sound ? "sound" : "unsound!"} · in {label}{progress.line === Infinity ? "" : " · up tunnels are one way"}
        </div>
      </div>
      {/* The game's phone screen, as on a phone (scaled to fit the window): .game-screen
          makes the loot window and sheets open inside it, and cqw/cqh its shares. */}
      <div className="game-screen" style={{ height: "calc(100dvh - 32px)", width: "min(100%, calc((100dvh - 32px) * 9 / 16))", border: "1px solid #333" }}>
        <div className="screen-scale">
          <DenFrame title="The Encampment" icon="🌀" gold={gold} backLocked="The lab: retreat to leave" fill dock={
            // Two by two, as in the live Labyrinth: Party and Bag on top, Scroll and Retreat below.
            <div className="dock-tabs" style={{ gridAutoFlow: "row", gridTemplateColumns: "1fr 1fr" }}>
              <button className="dock-tab" disabled={!!fight} onClick={() => setSheet((x) => (x === "party" ? null : "party"))}>
                🐾 Party <span className="count">{standing}/{team.info.length}</span>
              </button>
              <button className="dock-tab" disabled={!!fight} onClick={() => setSheet((x) => (x === "bag" ? null : "bag"))}>
                🎒 Bag <span className="count">{bag.length}/{LAB_BAG}</span>
              </button>
              <button className="dock-tab" disabled={!!fight || looks === 0 || !!scroll || reveal} onClick={lookAtScroll}>
                📜 Scroll <span className="count">{looks}/{SCROLL_LOOKS}</span>
              </button>
              <button className="dock-tab" style={{ color: "#ff8a80", background: retreatArmed ? "#6e1f18" : undefined }} disabled={!!fight} onClick={retreat}>
                {retreatArmed ? "Tap: leave" : "🏃 Retreat"}
              </button>
            </div>
          }>
      <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", height: "100%" }}>
        <canvas
          ref={canvas}
          onPointerDown={tap}
          style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", touchAction: "none" }}
        />
        {note && !fight && !lootId && (
          <div onPointerDown={() => setNote(null)} style={{ position: "absolute", left: 8, right: 8, bottom: 8, padding: "8px 10px", background: "rgba(20, 16, 10, 0.92)", border: "2px solid #6b4f2a", color: "#f1d9a0", fontSize: 13, lineHeight: 1.4 }}>
            {note}
          </div>
        )}
        {sheet === "party" && !fight && (
          <div onPointerDown={() => setSheet(null)} style={SHEET}>
            <div className="pixel-font" style={{ marginBottom: 8 }}>The test team (not saved)</div>
            {team.info.map((m, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div>{CREATURE_BY_ID[m.creatureId!].name} · Lv {TEST_TEAM.level} · {Math.round(hp[i] * 100)}%</div>
                <div style={{ height: 6, background: "#2a2418", marginTop: 3 }}><div style={{ width: `${hp[i] * 100}%`, height: "100%", background: hp[i] > 0.5 ? "#5cc65c" : hp[i] > 0.2 ? "#e0b040" : "#e0483e" }} /></div>
              </div>
            ))}
          </div>
        )}
        {sheet === "bag" && !fight && (
          <div onPointerDown={() => setSheet(null)} style={SHEET}>
            <div className="pixel-font" style={{ marginBottom: 8 }}>The test bag (not saved)</div>
            {bag.length + purse.length === 0 ? <div style={{ opacity: 0.7 }}>Empty.</div> : [...purse, ...bag].map((x, i) => {
              const l = lookOf(x);
              return <div key={i} style={{ color: l.color }}>{"gold" in x ? `${x.gold} gold` : l.name}</div>;
            })}
          </div>
        )}
        {lootBox && (
          <>
            <LootWindow name={BOX_NAMES[lootBox.kind]} sprite={lootBox.kind === "chest" || lootBox.kind === "treasure" ? TREASURE_CHEST_OPEN : BURLAP_SACK_OPEN}
              items={lootBox.items ?? []} bag={bagLooks} slots={LAB_BAG} bagName="Test bag"
              onTake={(i) => take(i)} onTakeAll={takeAll} onSwap={(i, at) => take(i, at)} onPutBack={putBack}
              onClose={() => {
                // An empty sack of spoils goes; chests stay, open.
                if (lootBox.kind === "spoils" && (lootBox.items ?? []).length === 0) boxes.current = boxes.current.filter((b) => b.id !== lootBox.id);
                setLootId(null);
                keepRef.current();
              }} />
          </>
        )}
        {fight && battle.match && (
          // The real battle screen, over the whole phone screen.
          <div className="screen-scale" style={{ position: "fixed", inset: 0, zIndex: 20, background: "#0b0c11" }}>
            <BattleView
              battle={battle}
              showEstimates
              finishedActions={over === "A"
                ? <button className="pixel-btn" onClick={winFight}>Take the loot</button>
                : <button className="pixel-btn" onClick={loseRun}>Back to the entrance</button>}
            />
          </div>
        )}
        {shown && (
          // The scroll, like a treasure map: what you've lit, your trail, the
          // cut-offs in red, a mark per room (crossed once cleared). Tap to put it away.
          <div onPointerDown={() => (reveal ? setReveal(false) : setScroll(null))} style={{ position: "absolute", inset: 0, background: INK.paper, border: `3px solid ${INK.edge}`, touchAction: "none" }}>
            <svg viewBox={`0 0 ${plan.w} ${plan.h}`} style={{ position: "absolute", inset: "3%", width: "94%", height: "94%" }}>
              {shown.ink.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1.05} fill={r.wall ? INK.wall : INK.floor} />)}
              {shown.cuts.map((y, i) => <line key={i} x1={0} x2={plan.w} y1={y} y2={y} stroke={INK.cut} strokeWidth={0.9} strokeDasharray="3 2" />)}
              <polyline points={shown.trail.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ")} fill="none" stroke={INK.trail} strokeWidth={0.7} strokeDasharray="1.2 1.2" strokeLinejoin="round" />
              {shown.marks.map((m) => {
                const x = m.x * plan.w, y = m.y * plan.h, art = m.kind && ROOM_ART[m.kind];
                return (
                  <g key={m.id}>
                    <circle cx={x} cy={y} r={3.6} fill={INK.mark} stroke={m.here ? COLOURS.you : INK.edge} strokeWidth={m.here ? 0.9 : 0.5} />
                    {art
                      ? <image href={art} x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} style={{ imageRendering: "pixelated" }} />
                      : <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fontWeight="bold" fill={INK.text}>{m.kind ? ROOM_INFO[m.kind].icon : "?"}</text>}
                    {shown.cleared.includes(m.id) && <path d={`M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`} stroke={INK.cut} strokeWidth={0.9} />}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
          </DenFrame>
        </div>
      </div>
    </main>
  );
}
