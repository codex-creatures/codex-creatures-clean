"use client";
// app/lab/walk/page.tsx — walking round a rolled Encampment (lib/dungeon/layout.ts,
// lib/dungeon/walk.ts): tap anywhere to walk there, the camera following you,
// in a phone-shaped view. Up tunnels are one way, and what's behind you
// closes (dimmed). Plain boxes for now, no art and nothing in the rooms (dev
// tool; nothing is saved). For judging the layout and the feel.

import { useEffect, useMemo, useRef, useState } from "react";
import { DUNGEONS } from "@/lib/dungeon/run";
import { ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, startProgress, enter, isOpen, stepRule, routeProblems, type Progress } from "@/lib/dungeon/layout";
import { advance, cameraAt, roomAt, walkTo, type Walker } from "@/lib/dungeon/walk";

const TILE = 16; // screen pixels per tile

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = { rock: "#0d0d14", wall: "#4a4f5c", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f", you: "#e0483e", goal: "#f1d9a0", label: "#2a2418" };
const CLOSED = "rgba(13, 13, 20, 0.6)";

export default function WalkLab() {
  const [seed, setSeed] = useState(1);
  const layout = useMemo(() => rollLayout(DUNGEONS[0].spec, seeded(seed)), [seed]);
  const plan = useMemo(() => layoutFloorplan(layout), [layout]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const startSpot = useMemo(() => {
    const r = plan.rooms[layout.start];
    return { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
  }, [plan, layout]);
  const me = useRef<Walker>({ ...startSpot, path: [] });
  const goal = useRef<{ x: number; y: number } | null>(null);
  const [progress, setProgress] = useState<Progress>(startProgress(layout));
  const progressRef = useRef(progress);
  const [here, setHere] = useState<string | null>(layout.start);

  // A new labyrinth: back to its entrance.
  useEffect(() => {
    me.current = { ...startSpot, path: [] };
    goal.current = null;
    progressRef.current = startProgress(layout);
    setProgress(progressRef.current);
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
      if (room && room !== progressRef.current.room) {
        const next = enter(layout, progressRef.current, room);
        if (next !== progressRef.current) {
          progressRef.current = next;
          setProgress(next);
          if (goal.current) me.current = walkTo(plan, { ...me.current, path: me.current.path.slice(0, 1) }, goal.current, stepRule(layout, plan, next));
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
      for (const [id, r] of Object.entries(plan.rooms)) {
        if (!isOpen(layout, p, id)) { ctx.fillStyle = CLOSED; ctx.fillRect(sx(r.x) - TILE, sy(r.y) - TILE, (r.w + 2) * TILE, (r.h + 2) * TILE); }
        ctx.fillStyle = COLOURS.label;
        const name = id === layout.start ? "Start" : id === layout.boss ? "Boss" : layout.rooms[id].shape;
        ctx.fillText(name, sx(r.x + r.w / 2), sy(r.y + r.h / 2));
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
  }, [plan, layout]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / TILE, h: el.clientHeight / TILE });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / TILE), y: Math.floor(cam.y + (e.clientY - box.top) / TILE) };
    goal.current = spot;
    me.current = walkTo(plan, me.current, spot, stepRule(layout, plan, progressRef.current));
  };

  const label = !here ? "a tunnel" : here === layout.start ? "the entrance" : here === layout.boss ? "the boss's room" : `a ${layout.rooms[here].shape} room`;
  const sound = routeProblems(layout, DUNGEONS[0].spec.minRoute).length === 0;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Walk the Encampment</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className="chip" onClick={() => setSeed((s) => s + 1)}>Reroll</button>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          Seed {seed} · {Object.keys(layout.rooms).length} rooms · {layout.tunnels.length} tunnels ({layout.tunnels.filter((t) => !t.up).length} sideways) ·{" "}
          {sound ? "sound" : "unsound!"} · in {label}{progress.line === Infinity ? "" : " · up tunnels are one way"}
        </span>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={tap}
        style={{ display: "block", width: "min(100%, 400px, calc(80vh * 9 / 16))", aspectRatio: "9 / 16", border: "1px solid #333", touchAction: "none" }}
      />
    </main>
  );
}
