"use client";
// app/lab/walk/page.tsx — walking round a rolled Encampment (lib/dungeon/layout.ts,
// lib/dungeon/walk.ts): tap anywhere to walk there, the camera following you,
// in a phone-shaped view. Up tunnels are one way, and what's behind you
// closes (dimmed). In the dark you only see rooms you've been in and
// the tunnels out of them; a room lights up as you reach its door, and you
// can only walk where you can see. Each room is labelled with what's in it
// (campMap: the live Encampment's mix). The scroll (scrollMarks) can be looked
// at SCROLL_LOOKS times a roll: a mark per room, and, like a treasure map,
// what your torch has lit, your trail, red lines where you cut yourself off,
// and a cross on each room you've cleared.
// Reveal shows the whole scroll (every room and tunnel, every room's contents)
// without using a look, and stays open through rerolls, to judge layouts.
// A dotted line shows the way you'll walk.
//
// Art draws it with the PixelLab samples (lib/dungeon/tileArt.ts, lib/sprites/walk.ts;
// the boxes stay the default); Tiles and Hero flick between the samples.
//
// The rooms play out (lib/dungeon/foes.ts, walkRooms.ts): each fight room's
// foes stand in it, rolled by the live room roll; if any of them sees you,
// all of them fight you, in the real battle screen, with an in-memory test
// team (TEST_TEAM). Win and their loot goes in the lab's bag; lose and it's a
// fresh roll from the entrance. Walk up to a chest or a stash and it opens.
// Cones shows what each foe can see.
//
// Dev tool: NOTHING here touches the game's save, slots, registry or battle
// history. Your spot (where you are, what's lit and cleared, the bag) is kept
// only for this tab (sessionStorage, LAB_KEY), so a reload carries on.

import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_INFO, makeEnemy, enemyFighter, gearOf, gearName, hasFight, type Enemy, type Room, type SackItem } from "@/lib/dungeon/run";
import { ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, campMap, roomCentre, WALK_SPEC, scrollMarks, cutOffY, SCROLL_LOOKS, type ScrollMark, startProgress, enter, isOpen, stepRule, routeProblems, type Progress } from "@/lib/dungeon/layout";
import { advance, cameraAt, roomAt, walkTo, type CanStep, type Walker } from "@/lib/dungeon/walk";
import { cellArt, drawOrder, facingOf, walkFrame, FACINGS, SHEET_TILE, WANG_TILES, type Facing } from "@/lib/dungeon/tileArt";
import { placeFoes, spottedBy, stepFoe, visionCone, ALERT_KINDS, type Foe } from "@/lib/dungeon/foes";
import { rollWalkRooms, fightSack, chestSack } from "@/lib/dungeon/walkRooms";
import { WALK_TILES, WALK_HEROES, DOOR_SIZE } from "@/lib/sprites/walk";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, BURLAP_SACK, BURLAP_SACK_OPEN } from "@/lib/sprites/props";
import { artFor } from "@/lib/sprites/art";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { BattleView, usePlayableBattle, type MemberInfo } from "@/components/BattleScreen";
import { lookOf } from "@/components/ContainerLoot";
import { ROOM_ART } from "@/components/DungeonMapView";
import type { Pt } from "@/lib/dungeon/floorplan";
import type { Rarity } from "@/lib/types";

const TILE = 16; // screen pixels per tile
const LAB_KEY = "codex_lab_walk_v1"; // sessionStorage: this tab's spot in the lab (never the game's save)
// The team you fight with (🧪): three creatures of this rarity, in gear of this rarity, at this level.
const TEST_TEAM: { rarity: Rarity; gear: Rarity; level: number } = { rarity: "uncommon", gear: "uncommon", level: 5 };
const REACH_OBJECT = 1.5; // tiles: walk this close to a chest or a stash and it opens
const FOE_PX = 22;        // a foe's height on screen, in px
const OBJECT_PX = 28;     // a chest's or a stash's width on screen, in px

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = { rock: "#0d0d14", wall: "#4a4f5c", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f", you: "#e0483e", goal: "#f1d9a0", label: "#2a2418", foe: "#b0302a", cone: "rgba(255, 90, 60, 0.18)", coneEdge: "rgba(255, 90, 60, 0.5)" };
const CLOSED = "rgba(13, 13, 20, 0.6)";
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14" };

// What the scroll shows when you open it (a snapshot: it doesn't change while open).
type Scroll = { marks: ScrollMark[]; ink: { x: number; y: number; w: number; wall: boolean }[]; trail: Pt[]; cuts: number[]; cleared: string[] };

// Your spot, kept for this tab (Progress.line can be Infinity, which JSON can't hold: null).
type Saved = { seed: number; x: number; y: number; room: string; line: number | null; seen: string[]; done: string[]; hp: number[]; bag: SackItem[]; looks: number; cuts: number[]; trail: Pt[] };
const readSaved = (): Saved | null => {
  try { const s = window.sessionStorage.getItem(LAB_KEY); return s ? (JSON.parse(s) as Saved) : null; } catch { return null; }
};
const writeSaved = (s: Saved | null) => {
  try { if (s) window.sessionStorage.setItem(LAB_KEY, JSON.stringify(s)); else window.sessionStorage.removeItem(LAB_KEY); } catch { /* (private mode: not kept) */ }
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
const sackNames = (sack: SackItem[]) => sack.map((x) => ("gold" in x ? `${x.gold} gold` : lookOf(x).name)).join(", ");

export default function WalkLab() {
  const [seed, setSeed] = useState(1);
  const layout = useMemo(() => rollLayout(WALK_SPEC, seeded(seed)), [seed]);
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const camp = useMemo(() => campMap(layout, false, seeded(seed + 7919)), [layout, seed]);
  const kinds = camp.nodes;
  const team = useMemo(() => testTeam(seed), [seed]);
  const rooms = useMemo<Record<string, Room>>(() => rollWalkRooms(camp, seeded(seed + 101), true, team.enemies.flatMap((e) => CREATURE_BY_ID[e.creatureId].races ?? [])), [camp, seed, team]);
  const art = useMemo(() => cellArt(plan), [plan]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const startSpot = useMemo(() => {
    return roomCentre(layout.rooms[layout.start]);
  }, [layout]);
  const me = useRef<Walker>({ ...startSpot, path: [] });
  const goal = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState<Progress>(startProgress(layout));
  const progressRef = useRef(progress);
  const [here, setHere] = useState<string | null>(layout.start);
  const [dark, setDark] = useState(true);
  const darkRef = useRef(dark);
  const [looks, setLooks] = useState(SCROLL_LOOKS);
  const [scroll, setScroll] = useState<Scroll | null>(null);
  const [reveal, setReveal] = useState(false);
  // Drawing: the boxes, or the art samples (which tileset, which hero); the foes' cones.
  const [drawArt, setDrawArt] = useState(false);
  const [tileSet, setTileSet] = useState(0);
  const [hero, setHero] = useState(0);
  const [cones, setCones] = useState(false);
  const look = useRef({ drawArt, tileSet, hero, cones });
  useEffect(() => { look.current = { drawArt, tileSet, hero, cones }; }, [drawArt, tileSet, hero, cones]);
  // Your walk so far, tile by tile, and the cut-offs you've crossed (tiles down), for the scroll.
  const trail = useRef<Pt[]>([]);
  const cuts = useRef<number[]>([]);
  useEffect(() => { darkRef.current = dark; }, [dark]);
  // The hero's facing and how far they've walked (for the walk frames).
  const facing = useRef<Facing>("north");
  const walked = useRef(0);

  // The run: the foes still standing, the rooms dealt with (beaten, opened),
  // your team's HP (share of max), what you've found, a fight on.
  const foes = useRef<Foe[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const doneRef = useRef(done);
  const [hp, setHp] = useState<number[]>([1, 1, 1]);
  const [bag, setBag] = useState<SackItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fight, setFight] = useState<{ room: string; team: number[] } | null>(null);
  const fightRef = useRef(fight);
  const battle = usePlayableBattle(undefined, { history: false });
  useEffect(() => { fightRef.current = fight; }, [fight]);
  const markDone = (id: string) => {
    const next = new Set(doneRef.current).add(id);
    doneRef.current = next;
    setDone(next);
  };

  // What you can see: the rooms you've been in (walls and all) and the
  // tunnels out of them, to the far door.
  const seen = useRef(new Set<string>());
  const lit = useRef(new Uint8Array(0));
  const doorRoom = useMemo(() => new Map(plan.doors.map((d) => [d.y * plan.w + d.x, d.room])), [plan]);
  const see = (room: string) => {
    if (seen.current.has(room)) return;
    seen.current.add(room);
    const light = (x0: number, y0: number, w: number, h: number) => {
      for (let y = Math.max(0, y0); y < Math.min(plan.h, y0 + h); y++) lit.current.fill(1, y * plan.w + Math.max(0, x0), y * plan.w + Math.min(plan.w, x0 + w));
    };
    for (const r of plan.rooms[room]) light(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    for (const t of layout.tunnels) if (t.a === room || t.b === room) light(t.rect.x - 1, t.rect.y - 1, t.rect.w + 2, t.rect.h + 2);
  };
  // Where you may walk: what the forward rule allows, and (in the dark) only what you can see.
  const rule = (p: Progress): CanStep => {
    const forward = stepRule(layout, plan, p);
    return (from, to) => forward(from, to) && (!darkRef.current || lit.current[to.y * plan.w + to.x] === 1);
  };

  // Your spot, for this tab: written now and then as you go, read once when the page opens.
  const bagRef = useRef(bag), hpRef = useRef(hp), looksRef = useRef(looks);
  useEffect(() => { bagRef.current = bag; hpRef.current = hp; looksRef.current = looks; }, [bag, hp, looks]);
  const keep = () => writeSaved({
    seed, x: Math.round(me.current.x), y: Math.round(me.current.y), room: progressRef.current.room,
    line: progressRef.current.line === Infinity ? null : progressRef.current.line,
    seen: [...seen.current], done: [...doneRef.current], hp: hpRef.current, bag: bagRef.current, looks: looksRef.current,
    cuts: cuts.current, trail: trail.current,
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
    progressRef.current = saved ? { room: saved.room, line: saved.line ?? Infinity } : startProgress(layout);
    setProgress(progressRef.current);
    seen.current = new Set();
    lit.current = new Uint8Array(plan.w * plan.h);
    see(layout.start);
    for (const r of saved?.seen ?? []) see(r);
    trail.current = saved?.trail ?? [startSpot];
    cuts.current = saved?.cuts ?? [];
    setLooks(saved?.looks ?? SCROLL_LOOKS);
    setScroll(null);
    const gone = new Set(saved?.done ?? []);
    doneRef.current = gone;
    setDone(gone);
    setHp(saved?.hp ?? [1, 1, 1]);
    setBag(saved?.bag ?? []);
    setNote(null);
    setFight(null);
    battle.clear();
    // Each fight room's foes, where they start (beaten rooms have none).
    const rng = seeded(seed + 303);
    foes.current = Object.entries(rooms).flatMap(([id, r]) => (hasFight(r) && r.enemies && !gone.has(id) ? placeFoes(plan, id, r.enemies.length, rng) : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see() only reads plan and layout; battle.clear is stable enough
  }, [layout, startSpot, rooms]);

  // The fight with a room's foes: your team still standing against all of them.
  const startFight = (id: string) => {
    const room = rooms[id];
    if (!room?.enemies || fightRef.current) return;
    me.current = { x: Math.round(me.current.x), y: Math.round(me.current.y), path: [] };
    goal.current = null;
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
  // Won: the foes are gone, their loot's in the bag; at the camp, the cages too.
  const winFight = () => {
    const f = fightRef.current, m = battle.match;
    if (!f || !m) return;
    const nextHp = [...hpRef.current];
    m.state.sides.A.team.forEach((c, k) => { nextHp[f.team[k]] = c.hp / c.maxHp; });
    setHp(nextHp);
    hpRef.current = nextHp;
    const room = rooms[f.room];
    const sack = fightSack(room);
    setBag((b) => (bagRef.current = [...b, ...sack]));
    foes.current = foes.current.filter((x) => x.room !== f.room);
    markDone(f.room);
    const cages = f.room === layout.boss ? (room.cages ?? []).flatMap((c) => (c.creatureId ? [`${CREATURE_BY_ID[c.creatureId].name} (Lv ${c.level ?? 1})`] : [])) : [];
    setNote(f.room === layout.boss
      ? `The Encampment's cleared! Loot: ${sackNames(sack)}. In the cages: ${cages.join(", ") || "nobody"}. Reroll for another.`
      : `Won! Into the bag: ${sackNames(sack)}.`);
    fightRef.current = null;
    setFight(null);
    battle.clear();
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
  // A chest or a stash, walked up to: opened, into the bag.
  const openObject = (id: string) => {
    const room = rooms[id];
    const sack = room.kind === "chest" ? chestSack() : room.kind === "treasure" ? [{ gold: room.gold ?? 0 }] : room.sack ?? [];
    setBag((b) => (bagRef.current = [...b, ...sack]));
    markDone(id);
    setNote(`${room.kind === "chest" ? "The chest" : room.kind === "stash" ? "The stash" : "The treasure"}: ${sackNames(sack) || "empty"}.`);
    keepRef.current();
  };
  const objects = useMemo(() => Object.entries(rooms).filter(([, r]) => r.kind === "chest" || r.kind === "stash" || r.kind === "treasure")
    .map(([id, r]) => ({ id, kind: r.kind, ...roomCentre(layout.rooms[id]) })), [rooms, layout]);

  // Draw every frame: walk on, move the camera, then the visible tiles and you.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h, tiles } = plan;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : tiles[y * w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    const litAt = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && lit.current[y * w + x] === 1;
    let last = performance.now(), frame = 0, shown: string | null = null, kept = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(now - last, 100) / 1000;
      last = now;
      const fighting = !!fightRef.current;
      const before = { x: me.current.x, y: me.current.y };
      if (!fighting) me.current = advance(me.current, dt);
      const moved = Math.hypot(me.current.x - before.x, me.current.y - before.y);
      if (moved > 0) { walked.current += moved; facing.current = facingOf(me.current.x - before.x, me.current.y - before.y, facing.current); }
      // Into a new room: maybe up a tunnel (what's behind closes), so find the way on again.
      const room = roomAt(plan, me.current);
      const onDoor = doorRoom.get(Math.round(me.current.y) * plan.w + Math.round(me.current.x));
      if (onDoor) see(onDoor);
      if (room) see(room);
      const step = { x: Math.round(me.current.x), y: Math.round(me.current.y) }, prev = trail.current[trail.current.length - 1];
      if (!prev || prev.x !== step.x || prev.y !== step.y) trail.current.push(step);
      if (room && room !== progressRef.current.room) {
        const next = enter(layout, progressRef.current, room);
        if (next !== progressRef.current) {
          if (next.line !== progressRef.current.line) cuts.current.push(cutOffY(next));
          progressRef.current = next;
          setProgress(next);
          if (goal.current) me.current = walkTo(plan, { ...me.current, path: me.current.path.slice(0, 1) }, goal.current, rule(next));
        }
      }
      if (room !== shown) { shown = room; setHere(room); }
      // The foes look about; if any of a room's sees you (or you walk into the chief's camp), that room fights you.
      const p = progressRef.current;
      if (!fighting) {
        foes.current = foes.current.map((f) => stepFoe(plan, f, dt));
        const awake = (id: string) => !doneRef.current.has(id) && isOpen(layout, p, id);
        const alert = room && awake(room) && rooms[room] && ALERT_KINDS.includes(rooms[room].kind) ? room : null;
        const by = alert ?? spottedBy(plan, foes.current, me.current, awake);
        if (by) startFight(by);
        for (const o of objects) if (!doneRef.current.has(o.id) && Math.hypot(o.x - me.current.x, o.y - me.current.y) <= REACH_OBJECT) openObject(o.id);
      }
      if (now - kept > 1000) { kept = now; keepRef.current(); }

      const { drawArt: artOn, tileSet: ts, hero: hi, cones: conesOn } = look.current;
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const cam = cameraAt(plan, me.current, { w: cw / TILE, h: ch / TILE });
      const sx = (x: number) => Math.round((x - cam.x) * TILE), sy = (y: number) => Math.round((y - cam.y) * TILE);
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      const floorSheet = artOn ? image(WALK_TILES[ts].floor) : null, tunnelSheet = artOn ? image(WALK_TILES[ts].tunnel) : null;
      if (floorSheet && tunnelSheet) {
        // The art: a cell between each four tiles (tileArt.ts), half a tile off the grid.
        for (let cy = Math.floor(cam.y - 0.5); cy < cam.y + ch / TILE; cy++) for (let cx = Math.floor(cam.x - 0.5); cx < cam.x + cw / TILE; cx++) {
          if (cx < -1 || cy < -1 || cx >= w || cy >= h) continue;
          const i = (cy + 1) * art.w + cx + 1, t = art.tile[i];
          if (t < 0) continue;
          if (darkRef.current && !litAt(cx, cy) && !litAt(cx + 1, cy) && !litAt(cx, cy + 1) && !litAt(cx + 1, cy + 1)) continue;
          const { col, row } = WANG_TILES[t];
          ctx.drawImage(art.tunnel[i] ? tunnelSheet : floorSheet, col * SHEET_TILE, row * SHEET_TILE, SHEET_TILE, SHEET_TILE, sx(cx + 0.5), sy(cy + 0.5), TILE, TILE);
        }
      } else {
        for (let y = Math.floor(cam.y); y < cam.y + ch / TILE; y++) for (let x = Math.floor(cam.x); x < cam.x + cw / TILE; x++) {
          const t = at(x, y);
          if (t === ROCK && !isWall(x, y)) continue;
          if (darkRef.current && !lit.current[y * w + x]) continue;
          ctx.fillStyle = t === FLOOR ? COLOURS.floor : t === DOOR ? COLOURS.door : t !== ROCK ? COLOURS.tunnel : COLOURS.wall;
          ctx.fillRect(sx(x), sy(y), TILE, TILE);
        }
      }
      // Closed rooms and tunnels, dimmed; each room's shape.
      ctx.fillStyle = CLOSED;
      for (const t of layout.tunnels) if (!isOpen(layout, p, t.a) || !isOpen(layout, p, t.b)) ctx.fillRect(sx(t.rect.x), sy(t.rect.y), t.rect.w * TILE, t.rect.h * TILE);
      for (const [id, rs] of Object.entries(plan.rooms)) {
        if (darkRef.current && !seen.current.has(id)) continue;
        if (!isOpen(layout, p, id)) {
          // (One path, so a dog-leg's overlapping arms are dimmed once.)
          ctx.fillStyle = CLOSED;
          ctx.beginPath();
          for (const r of rs) ctx.rect(sx(r.x) - TILE, sy(r.y) - TILE, (r.w + 2) * TILE, (r.h + 2) * TILE);
          ctx.fill();
        }
      }
      // What the foes can see.
      const showFoe = (f: Foe) => !darkRef.current || seen.current.has(f.room);
      if (conesOn) for (const f of foes.current) {
        if (!showFoe(f)) continue;
        const pts = visionCone(plan, f);
        ctx.fillStyle = COLOURS.cone;
        ctx.strokeStyle = COLOURS.coneEdge;
        ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach((q, k) => (k === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, (q.x - cam.x + 0.5) * TILE, (q.y - cam.y + 0.5) * TILE));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // The way you'll walk (a dotted line from you, shrinking as you go), where you're heading.
      const end = me.current.path[me.current.path.length - 1];
      if (end) {
        const mid = (v: number) => (v + 0.5) * TILE;
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(mid(me.current.x - cam.x), mid(me.current.y - cam.y));
        for (const q of me.current.path) ctx.lineTo(mid(q.x - cam.x), mid(q.y - cam.y));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(end.x) + 3, sy(end.y) + 3, TILE - 6, TILE - 6);
      }
      // Everything standing up, lowest on screen last (drawOrder): door arches, chests, foes, you.
      const footX = (x: number) => (x - cam.x + 0.5) * TILE, footY = (y: number) => (y - cam.y + 0.5) * TILE + 4;
      const standing: { x: number; y: number; draw: () => void }[] = [];
      const doorImg = artOn ? image(WALK_TILES[ts].door) : null;
      if (doorImg) for (const t of layout.tunnels) {
        // Where a tunnel leaves a room's top wall (its bottom row), an arch.
        if (!t.up) continue;
        const row = t.rect.y + t.rect.h - 1;
        if (darkRef.current && !litAt(t.rect.x + 1, row)) continue;
        standing.push({ x: t.rect.x, y: row + 1, draw: () => ctx.drawImage(doorImg, sx(t.rect.x), sy(row + 1) + TILE / 2 - DOOR_SIZE, DOOR_SIZE, DOOR_SIZE) });
      }
      for (const o of objects) {
        if (darkRef.current && !seen.current.has(o.id)) continue;
        const a = artFor(o.kind === "chest" ? (doneRef.current.has(o.id) ? TREASURE_CHEST_OPEN : TREASURE_CHEST) : doneRef.current.has(o.id) ? BURLAP_SACK_OPEN : BURLAP_SACK);
        const img = a && image(a.src);
        standing.push({ x: o.x, y: o.y, draw: () => {
          if (!img || !a) return;
          const h2 = (OBJECT_PX * a.h) / a.w;
          ctx.drawImage(img, footX(o.x) - OBJECT_PX / 2, footY(o.y) - h2, OBJECT_PX, h2);
        } });
      }
      for (const f of foes.current) {
        if (!showFoe(f)) continue;
        const a = artFor(CREATURE_SPRITES[rooms[f.room].enemies![f.index].creatureId] ?? []);
        const img = a && image(a.src);
        standing.push({ x: f.x, y: f.y, draw: () => {
          const fx = footX(f.x), fy = footY(f.y);
          if (img && a) {
            // Art faces left unless marked; turned to face the way it looks.
            const wd = (FOE_PX * a.w) / a.h, flip = (Math.cos(f.facing) > 0.1) !== (a.faces === "right");
            ctx.save();
            ctx.translate(fx, fy - FOE_PX);
            if (flip) { ctx.scale(-1, 1); ctx.translate(-wd / 2, 0); } else ctx.translate(-wd / 2, 0);
            ctx.drawImage(img, 0, 0, wd, FOE_PX);
            ctx.restore();
          } else {
            ctx.fillStyle = COLOURS.foe;
            ctx.beginPath();
            ctx.arc(fx, fy - TILE * 0.4, TILE * 0.4, 0, 2 * Math.PI);
            ctx.fill();
          }
          // Which way it's looking.
          ctx.strokeStyle = COLOURS.foe;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy - 2);
          ctx.lineTo(fx + Math.cos(f.facing) * TILE * 0.8, fy - 2 + Math.sin(f.facing) * TILE * 0.8);
          ctx.stroke();
        } });
      }
      const heroArt = WALK_HEROES[hi], heroImg = artOn ? image(heroArt.sheet) : null;
      standing.push({ x: me.current.x, y: me.current.y, draw: () => {
        if (heroImg) {
          const col = walkFrame(walked.current, me.current.path.length > 0 && !fighting, heroArt.frames) + 1, row = FACINGS.indexOf(facing.current);
          ctx.drawImage(heroImg, col * heroArt.cell, row * heroArt.cell, heroArt.cell, heroArt.cell,
            Math.round(footX(me.current.x) - heroArt.cell / 2), Math.round(footY(me.current.y) - heroArt.feet), heroArt.cell, heroArt.cell);
          return;
        }
        ctx.fillStyle = COLOURS.you;
        ctx.beginPath();
        ctx.arc((me.current.x - cam.x + 0.5) * TILE, (me.current.y - cam.y + 0.5) * TILE, TILE * 0.4, 0, 2 * Math.PI);
        ctx.fill();
      } });
      for (const s of drawOrder(standing)) s.draw();
      // Each room's label, on top.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see(), rule(), startFight() and openObject() only read plan, layout, rooms and refs
  }, [plan, layout, doorRoom, kinds, art, rooms, objects]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (fightRef.current) return;
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / TILE, h: el.clientHeight / TILE });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / TILE), y: Math.floor(cam.y + (e.clientY - box.top) / TILE) };
    goal.current = spot;
    me.current = walkTo(plan, me.current, spot, rule(progressRef.current));
  };

  const label = !here ? "a tunnel" : `${ROOM_INFO[kinds[here].kind].name} (${layout.rooms[here].shape})`;
  // The scroll as it stands: the lit tiles inked in rows (floor or wall), your trail, the cut-offs, the marks.
  // all: the whole map, as if every room had been lit and walked into (Reveal; no trail).
  const readScroll = (all = false): Scroll => {
    const ink: Scroll["ink"] = [];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      if (!all && !lit.current[y * plan.w + x]) continue;
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

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Walk the Encampment</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className="chip" disabled={!!fight} onClick={() => { writeSaved(null); setSeed((s) => s + 1); }}>Reroll</button>
        <button className="chip" aria-pressed={dark} onClick={() => setDark((d) => !d)}>Darkness</button>
        <button className="chip" disabled={looks === 0 || !!scroll || reveal} onClick={() => {
          setLooks((n) => n - 1);
          setScroll(readScroll());
        }}>Scroll ({looks} left)</button>
        <button className="chip" aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>Reveal</button>
        <button className="chip" aria-pressed={drawArt} onClick={() => setDrawArt((a) => !a)}>Art</button>
        <button className="chip" disabled={!drawArt} onClick={() => setTileSet((t) => (t + 1) % WALK_TILES.length)}>Tiles: {WALK_TILES[tileSet].name}</button>
        <button className="chip" disabled={!drawArt} onClick={() => setHero((t) => (t + 1) % WALK_HEROES.length)}>Hero: {WALK_HEROES[hero].name}</button>
        <button className="chip" aria-pressed={cones} onClick={() => setCones((c) => !c)}>Cones</button>
        <button className="chip" aria-pressed={bagOpen} onClick={() => setBagOpen((b) => !b)}>Bag ({bag.length})</button>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          Seed {seed} · {Object.keys(layout.rooms).length} rooms · {layout.tunnels.length} tunnels ({layout.tunnels.filter((t) => !t.up).length} sideways) ·{" "}
          {sound ? "sound" : "unsound!"} · in {label}{progress.line === Infinity ? "" : " · up tunnels are one way"} ·{" "}
          team {team.info.map((m, i) => `${CREATURE_BY_ID[m.creatureId!].name} ${Math.round(hp[i] * 100)}%`).join(", ")}
        </span>
      </div>
      <div style={{ position: "relative", width: "min(100%, 400px, calc(80vh * 9 / 16))", aspectRatio: "9 / 16" }}>
        <canvas
          ref={canvas}
          onPointerDown={tap}
          style={{ display: "block", width: "100%", height: "100%", border: "1px solid #333", touchAction: "none" }}
        />
        {note && !fight && (
          <div onPointerDown={() => setNote(null)} style={{ position: "absolute", left: 8, right: 8, bottom: 8, padding: "8px 10px", background: "rgba(20, 16, 10, 0.92)", border: "2px solid #6b4f2a", color: "#f1d9a0", fontSize: 13, lineHeight: 1.4 }}>
            {note}
          </div>
        )}
        {bagOpen && !fight && (
          <div onPointerDown={() => setBagOpen(false)} style={{ position: "absolute", inset: "10% 8%", overflowY: "auto", padding: 12, background: "rgba(20, 16, 10, 0.95)", border: "2px solid #6b4f2a", color: "#f1d9a0", fontSize: 13 }}>
            <div className="pixel-font" style={{ marginBottom: 8 }}>The lab&apos;s bag (not saved)</div>
            {bag.length === 0 ? <div style={{ opacity: 0.7 }}>Empty.</div> : bag.map((x, i) => {
              const l = lookOf(x);
              return <div key={i} style={{ color: l.color }}>{"gold" in x ? `${x.gold} gold` : l.name}</div>;
            })}
          </div>
        )}
        {fight && battle.match && (
          // The real battle screen, in the phone-shaped box (screen-scale: its cqw/cqh are this box's).
          <div className="screen-scale" style={{ position: "absolute", inset: 0, background: "#0b0c11" }}>
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
    </main>
  );
}
