"use client";
// app/lab/walk/page.tsx — walking round a rolled Encampment (lib/dungeon/walk.ts):
// tap anywhere to walk there, the camera following you, in a phone-shaped
// view. Plain boxes for now, no art and nothing in the rooms (dev tool;
// nothing is saved). For judging the feel before the art goes on.

import { useEffect, useMemo, useRef, useState } from "react";
import { DUNGEONS } from "@/lib/dungeon/run";
import { rollLabyrinth, ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";
import { advance, cameraAt, entranceSpot, roomAt, walkTo, type Walker } from "@/lib/dungeon/walk";

const TILE = 16; // screen pixels per tile

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = { rock: "#0d0d14", wall: "#4a4f5c", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f", you: "#e0483e", goal: "#f1d9a0" };

export default function WalkLab() {
  const [seed, setSeed] = useState(1);
  const { map, plan } = useMemo(() => rollLabyrinth(false, seeded(seed), DUNGEONS[0].spec, 0), [seed]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const me = useRef<Walker>({ ...entranceSpot(plan, map), path: [] });
  const [here, setHere] = useState<string | null>(map.start);

  // A new labyrinth: back to its entrance.
  useEffect(() => { me.current = { ...entranceSpot(plan, map), path: [] }; }, [plan, map]);

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
      const ratio = window.devicePixelRatio || 1;
      const cw = el.clientWidth, ch = el.clientHeight;
      if (el.width !== Math.round(cw * ratio)) el.width = Math.round(cw * ratio);
      if (el.height !== Math.round(ch * ratio)) el.height = Math.round(ch * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const cam = cameraAt(plan, me.current, { w: cw / TILE, h: ch / TILE });
      ctx.fillStyle = COLOURS.rock;
      ctx.fillRect(0, 0, cw, ch);
      for (let y = Math.floor(cam.y); y < cam.y + ch / TILE; y++) for (let x = Math.floor(cam.x); x < cam.x + cw / TILE; x++) {
        const t = at(x, y);
        if (t === ROCK && !isWall(x, y)) continue;
        ctx.fillStyle = t === FLOOR ? COLOURS.floor : t === DOOR ? COLOURS.door : t !== ROCK ? COLOURS.tunnel : COLOURS.wall;
        ctx.fillRect(Math.round((x - cam.x) * TILE), Math.round((y - cam.y) * TILE), TILE, TILE);
      }
      // Where you're heading, then you.
      const goal = me.current.path[me.current.path.length - 1];
      if (goal) {
        ctx.strokeStyle = COLOURS.goal;
        ctx.lineWidth = 2;
        ctx.strokeRect((goal.x - cam.x) * TILE + 3, (goal.y - cam.y) * TILE + 3, TILE - 6, TILE - 6);
      }
      ctx.fillStyle = COLOURS.you;
      ctx.beginPath();
      ctx.arc((me.current.x - cam.x + 0.5) * TILE, (me.current.y - cam.y + 0.5) * TILE, TILE * 0.4, 0, 2 * Math.PI);
      ctx.fill();
      const room = roomAt(plan, me.current);
      if (room !== shown) { shown = room; setHere(room); }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [plan]);

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget, box = el.getBoundingClientRect();
    const cam = cameraAt(plan, me.current, { w: el.clientWidth / TILE, h: el.clientHeight / TILE });
    const spot = { x: Math.floor(cam.x + (e.clientX - box.left) / TILE), y: Math.floor(cam.y + (e.clientY - box.top) / TILE) };
    me.current = walkTo(plan, me.current, spot);
  };

  const node = here ? map.nodes[here] : null;
  const label = !node ? "a tunnel" : node.id === map.start ? "the entrance" : node.id === map.boss ? "the chief's tent" : node.kind;

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Walk the Encampment</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className="chip" onClick={() => setSeed((s) => s + 1)}>Reroll</button>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Seed {seed} · tap to walk · in {label}</span>
      </div>
      <canvas
        ref={canvas}
        onPointerDown={tap}
        style={{ display: "block", width: "min(100%, 400px, calc(80vh * 9 / 16))", aspectRatio: "9 / 16", border: "1px solid #333", touchAction: "none" }}
      />
    </main>
  );
}
