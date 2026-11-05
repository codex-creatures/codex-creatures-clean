"use client";
// app/lab/floorplan/page.tsx — the walkable Labyrinth's layout (the user's
// sketch, docs/ideas/labyrinth-v2.png), drawn as plain boxes: rooms, walls,
// tunnels and doors, from a rolled map (dev tool; nothing is saved). For
// judging the shapes before any art or walking.

import { useEffect, useMemo, useRef, useState } from "react";
import { rollMap } from "@/lib/dungeon/map";
import { DUNGEONS, type DungeonId } from "@/lib/dungeon/run";
import { buildFloorplan, checkFloorplan, ROCK, FLOOR, DOOR } from "@/lib/dungeon/floorplan";

const TILE = 5; // screen pixels per tile

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const COLOURS = { rock: "#0d0d14", wall: "#4a4f5c", floor: "#c9bf9f", tunnel: "#7d7a6c", door: "#3fae4f" };

export default function FloorplanLab() {
  const [dungeon, setDungeon] = useState<DungeonId>(1);
  const [seed, setSeed] = useState(11);
  const canvas = useRef<HTMLCanvasElement>(null);

  const { map, fp, problems, ms } = useMemo(() => {
    const map = rollMap(false, seeded(seed), { ...DUNGEONS[dungeon].spec, planar: true }, dungeon);
    const t = performance.now();
    const fp = buildFloorplan(map, seeded(seed + 1));
    const ms = Math.round(performance.now() - t);
    return { map, fp, problems: checkFloorplan(fp, map), ms };
  }, [dungeon, seed]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const { w, h, tiles } = fp;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? ROCK : tiles[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = at(x, y);
      // Rock beside anything walkable is wall.
      const wall = t === ROCK && [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => at(x + dx, y + dy) !== ROCK));
      ctx.fillStyle = t === FLOOR ? COLOURS.floor : t === DOOR ? COLOURS.door : t !== ROCK ? COLOURS.tunnel : wall ? COLOURS.wall : COLOURS.rock;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    // Each room's kind, like the sketch's labels.
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [id, r] of Object.entries(fp.rooms)) {
      const n = map.nodes[id];
      const label = id === map.start ? "Start" : id === map.boss ? "Boss" : n.large ? `${n.kind} (large)` : n.kind;
      ctx.fillStyle = "#2a2418";
      ctx.fillText(label, (r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE, r.w * TILE - 2);
    }
  }, [fp, map]);

  // Start looking at the entrance (the bottom).
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [fp]);

  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Labyrinth floorplan</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {([0, 1, 2, 3] as DungeonId[]).map((d) => (
          <button key={d} className="chip" aria-pressed={dungeon === d} onClick={() => setDungeon(d)}>{DUNGEONS[d].name}</button>
        ))}
        <button className="chip" onClick={() => setSeed((s) => s + 1)}>Reroll</button>
      </div>
      <p style={{ fontSize: 13, opacity: 0.8, margin: "0 0 10px" }}>
        Seed {seed} · {Object.keys(fp.rooms).length} rooms · {fp.w}×{fp.h} tiles · laid out in {ms} ms ·{" "}
        {problems.length === 0 ? <span style={{ color: "#7fd18b" }}>every corridor joins the right rooms</span>
          : <span style={{ color: "#ff8080" }}>{problems.length} problems: {problems.slice(0, 3).join("; ")}</span>}
      </p>
      <div ref={scroller} style={{ maxHeight: "80vh", overflow: "auto", border: "1px solid #333", display: "inline-block", maxWidth: "100%" }}>
        <canvas ref={canvas} width={fp.w * TILE} height={fp.h * TILE} style={{ display: "block" }} />
      </div>
    </main>
  );
}
