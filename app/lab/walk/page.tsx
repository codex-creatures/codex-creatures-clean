"use client";
// app/lab/walk/page.tsx — walking round a rolled Encampment (lib/dungeon/layout.ts,
// lib/dungeon/walk.ts): tap anywhere to walk there, the camera following you,
// in a phone-shaped view. Up tunnels are one way, and what's behind you
// closes (dimmed). In the dark you only see rooms you've been in and
// the tunnels out of them; a room lights up as you reach its door, and you
// can only walk where you can see. Each room is labelled with what's in it
// (campMap: the live Encampment's mix). The scroll (scrollMarks) can be looked
// at SCROLL_LOOKS times a roll: a mark per room, and, like a treasure map,
// what your torch has lit, your trail, and red lines where you cut yourself off.
// Reveal shows the whole scroll (every room and tunnel, every room's contents)
// without using a look, and stays open through rerolls, to judge layouts. Plain boxes for now, no art and no
// fights (dev tool; nothing is saved). For judging the layout and the feel.

import { useEffect, useMemo, useRef, useState } from "react";
import { DUNGEONS, ROOM_INFO } from "@/lib/dungeon/run";
import { ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, campMap, roomCentre, scrollMarks, cutOffY, SCROLL_LOOKS, type ScrollMark, startProgress, enter, isOpen, stepRule, routeProblems, type Progress } from "@/lib/dungeon/layout";
import { advance, cameraAt, roomAt, walkTo, type CanStep, type Walker } from "@/lib/dungeon/walk";
import { ROOM_ART } from "@/components/DungeonMapView";
import type { Pt } from "@/lib/dungeon/floorplan";

const TILE = 16; // screen pixels per tile

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = { rock: "#0d0d14", wall: "#4a4f5c", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f", you: "#e0483e", goal: "#f1d9a0", label: "#2a2418" };
const CLOSED = "rgba(13, 13, 20, 0.6)";
const INK = { paper: "#d8c49a", edge: "#6b4f2a", floor: "#bfa676", wall: "#5a3e1e", trail: "#7a4a1a", cut: "#c0281e", mark: "#efe0bc", text: "#3a2a14" };

// What the scroll shows when you open it (a snapshot: it doesn't change while open).
type Scroll = { marks: ScrollMark[]; ink: { x: number; y: number; w: number; wall: boolean }[]; trail: Pt[]; cuts: number[] };

export default function WalkLab() {
  const [seed, setSeed] = useState(1);
  const layout = useMemo(() => rollLayout(DUNGEONS[0].spec, seeded(seed)), [seed]);
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const camp = useMemo(() => campMap(layout, false, seeded(seed + 7919)), [layout, seed]);
  const kinds = camp.nodes;
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
  // Your walk so far, tile by tile, and the cut-offs you've crossed (tiles down), for the scroll.
  const trail = useRef<Pt[]>([]);
  const cuts = useRef<number[]>([]);
  useEffect(() => { darkRef.current = dark; }, [dark]);

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

  // A new labyrinth: back to its entrance.
  useEffect(() => {
    me.current = { ...startSpot, path: [] };
    goal.current = null;
    progressRef.current = startProgress(layout);
    setProgress(progressRef.current);
    seen.current = new Set();
    lit.current = new Uint8Array(plan.w * plan.h);
    see(layout.start);
    trail.current = [startSpot];
    cuts.current = [];
    setLooks(SCROLL_LOOKS);
    setScroll(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see() only reads plan and layout
  }, [layout, startSpot]);

  // Draw every frame: walk on, move the camera, then the visible tiles and you.
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h, tiles } = plan;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : tiles[y * w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
    let last = performance.now(), frame = 0, shown: string | null = null;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      me.current = advance(me.current, Math.min(now - last, 100) / 1000);
      last = now;
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

      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cam = cameraAt(plan, me.current, { w: cw / TILE, h: ch / TILE });
      const sx = (x: number) => Math.round((x - cam.x) * TILE), sy = (y: number) => Math.round((y - cam.y) * TILE);
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      for (let y = Math.floor(cam.y); y < cam.y + ch / TILE; y++) for (let x = Math.floor(cam.x); x < cam.x + cw / TILE; x++) {
        const t = at(x, y);
        if (t === ROCK && !isWall(x, y)) continue;
        if (darkRef.current && !lit.current[y * w + x]) continue;
        ctx.fillStyle = t === FLOOR ? COLOURS.floor : t === DOOR ? COLOURS.door : t !== ROCK ? COLOURS.tunnel : COLOURS.wall;
        ctx.fillRect(sx(x), sy(y), TILE, TILE);
      }
      // Closed rooms and tunnels, dimmed; each room's shape.
      const p = progressRef.current;
      ctx.fillStyle = CLOSED;
      for (const t of layout.tunnels) if (!isOpen(layout, p, t.a) || !isOpen(layout, p, t.b)) ctx.fillRect(sx(t.rect.x), sy(t.rect.y), t.rect.w * TILE, t.rect.h * TILE);
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const [id, rs] of Object.entries(plan.rooms)) {
        if (darkRef.current && !seen.current.has(id)) continue;
        if (!isOpen(layout, p, id)) {
          // (One path, so a dog-leg's overlapping arms are dimmed once.)
          ctx.fillStyle = CLOSED;
          ctx.beginPath();
          for (const r of rs) ctx.rect(sx(r.x) - TILE, sy(r.y) - TILE, (r.w + 2) * TILE, (r.h + 2) * TILE);
          ctx.fill();
        }
        ctx.fillStyle = COLOURS.label;
        const { name, icon } = ROOM_INFO[kinds[id].kind], c = roomCentre(layout.rooms[id]);
        ctx.fillText(`${icon} ${name}`, sx(c.x + 0.5), sy(c.y + 0.5));
      }
      // Where you're heading, then you.
      const end = me.current.path[me.current.path.length - 1];
      if (end) {
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx(end.x) + 3, sy(end.y) + 3, TILE - 6, TILE - 6);
      }
      ctx.fillStyle = COLOURS.you;
      ctx.beginPath();
      ctx.arc((me.current.x - cam.x + 0.5) * TILE, (me.current.y - cam.y + 0.5) * TILE, TILE * 0.4, 0, 2 * Math.PI);
      ctx.fill();
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see() and rule() only read plan, layout and refs
  }, [plan, layout, doorRoom, kinds]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
    return { marks: scrollMarks(camp, layout, all ? Object.keys(layout.rooms) : seen.current, roomAt(plan, me.current)), ink, trail: all ? [] : trail.current.slice(), cuts: all ? [] : cuts.current.slice() };
  };
  const shown = reveal ? readScroll(true) : scroll;
  const sound = routeProblems(layout, DUNGEONS[0].spec.minRoute).length === 0;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Walk the Encampment</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className="chip" onClick={() => setSeed((s) => s + 1)}>Reroll</button>
        <button className="chip" aria-pressed={dark} onClick={() => setDark((d) => !d)}>Darkness</button>
        <button className="chip" disabled={looks === 0 || !!scroll || reveal} onClick={() => {
          setLooks((n) => n - 1);
          setScroll(readScroll());
        }}>Scroll ({looks} left)</button>
        <button className="chip" aria-pressed={reveal} onClick={() => setReveal((r) => !r)}>Reveal</button>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          Seed {seed} · {Object.keys(layout.rooms).length} rooms · {layout.tunnels.length} tunnels ({layout.tunnels.filter((t) => !t.up).length} sideways) ·{" "}
          {sound ? "sound" : "unsound!"} · in {label}{progress.line === Infinity ? "" : " · up tunnels are one way"}
        </span>
      </div>
      <div style={{ position: "relative", width: "min(100%, 400px, calc(80vh * 9 / 16))", aspectRatio: "9 / 16" }}>
        <canvas
          ref={canvas}
          onPointerDown={tap}
          style={{ display: "block", width: "100%", height: "100%", border: "1px solid #333", touchAction: "none" }}
        />
        {shown && (
          // The scroll, like a treasure map: what you've lit, your trail, the
          // cut-offs in red, a mark per room. Tap to put it away.
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
