"use client";
// app/lab/three/page.tsx — 🧪 the 3D prototype (components/WalkView3D.tsx) beside the game's own
// walk view (components/WalkView.tsx), on the same made-up run held in memory: the same seed gives
// the same layout, placements and foes in both. Nothing is saved, and the game doesn't use any of
// it. The switches try the camera's pitch, a perspective camera, sharp art-sized pixels, your
// torch's shadows and the zoom; the numbers under them say how it's running. "Grey geometry" is the
// camera-and-geometry experiment (world/rendering.md §4.8): solid rock, flat greys, one plain light,
// and the two side-wall candidates, A (a narrow perspective camera) and B (orthographic, leaned).
// It starts on the settled geometry (the user, 2026-11-10; world/rendering.md §4.8): B, lean 0.03,
// 60°, 2.25 u walls, a low south rim, unfound places black. "Flip" swaps a
// pair of choices every second, so a small difference shows as movement.
// Dev tool: Three.js is loaded on this page only.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import WalkView from "@/components/WalkView";
import type { View3D, Stats3D } from "@/components/WalkView3D";
import { newWalkRun } from "@/lib/world/migrate";
import { startWalkRun, walkInto, walkKeep, walkRoom, type WalkDungeon } from "@/lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "@/lib/dungeon/run";
import { DEFAULT_PITCH, WALL_HEIGHT } from "@/lib/render3d/dungeon3d";

const WalkView3D = dynamic(() => import("@/components/WalkView3D"), { ssr: false, loading: () => <p style={{ color: "#888", padding: 16 }}>Loading Three.js…</p> });

const TEAM = [
  { id: "a", name: "Moss Wolf", rarity: "uncommon" as const, creatureId: "moss_wolf", maxHp: 60 },
  { id: "b", name: "Amber Wasp", rarity: "common" as const, creatureId: "amber_wasp", maxHp: 40 },
  { id: "c", name: "Moss Wolf", rarity: "common" as const, creatureId: "moss_wolf", maxHp: 50 },
];
// The same run for both views: a seeded roll (a seed per dungeon, changed by "Another run").
const seeded = (seed: number) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const roll = (d: WalkDungeon, seed: number) => newWalkRun(startWalkRun(["a", "b", "c"], ["a", "b", "c"], { a: 1, b: 1, c: 1 }, 1, [{}, {}], false, seeded(seed), d));
const SIXTY = Math.PI / 3;
// The side-wall candidates, set up at 60°: A, a narrow perspective camera; B, orthographic with the lean.
const CANDIDATES = { A: { perspective: true, fov: 20, lean: 0, pitch: SIXTY }, B: { perspective: false, fov: 20, lean: 0.03, pitch: SIXTY } };
const PITCHES = [{ label: "35°", v: (35 * Math.PI) / 180 }, { label: "¾ (48.6°)", v: DEFAULT_PITCH }, { label: "60°", v: Math.PI / 3 }, { label: "75°", v: (75 * Math.PI) / 180 }];

// Settings from the address, to share or shoot a view:
// ?view=2d|3d&pitch=<degrees>&camera=persp&pixels=art&shadows=1&across=<n>&dungeon=1&seed=<n>
// and the grey experiment: &geo=grey (the settled geometry unless given) &fov=<degrees> &lean=<n> &south=full|low &wall=<u> &unseen=rock|black|shown
// and, 3D only: &seen=all (everything shown as seen) &room=<kind> (start in the first room of that kind: boss, encampment, chest…)
function fromAddress() {
  const q = new URLSearchParams(window.location.search), num = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  const grey = q.get("geo") === "grey";
  const view: View3D = { pitch: num("pitch") !== undefined ? (num("pitch")! * Math.PI) / 180 : grey ? SIXTY : DEFAULT_PITCH, perspective: q.get("camera") === "persp",
    pixels: q.get("pixels") === "art" ? "art" : "device", shadows: q.get("shadows") === "1", across: num("across") ?? 15,
    grey, fov: num("fov") ?? (grey ? 20 : 30), lean: num("lean") ?? (grey ? CANDIDATES.B.lean : 0), south: (q.get("south") ?? (grey ? "low" : "full")) === "low" ? "low" : "full", wall: num("wall") ?? WALL_HEIGHT,
    unseen: (["rock", "black", "shown"] as const).find((u) => u === q.get("unseen")) ?? (grey ? "black" : "rock") };
  return { three: q.get("view") !== "2d", dungeon: (num("dungeon") === 1 ? 1 : 0) as WalkDungeon, seed: num("seed") ?? 11, view, seeAll: q.get("seen") === "all", roomKind: q.get("room") ?? undefined };
}

// Drawn in the browser only (Three.js, and the settings in the address).
export default dynamic(() => Promise.resolve(ThreeLab), { ssr: false });

function ThreeLab() {
  const [start] = useState(fromAddress);
  const [dungeon, setDungeon] = useState<WalkDungeon>(start.dungeon);
  const [seed, setSeed] = useState(start.seed);
  const first = useMemo(() => roll(dungeon, seed), [dungeon, seed]);
  const [run, setRun] = useState<DungeonRun>(first);
  const [n, setN] = useState(0); // (a new run or view: start afresh)
  const [three, setThree] = useState(start.three);
  const [view, setView] = useState<View3D>(start.view);
  const [stats, setStats] = useState<Stats3D | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog((l) => [s, ...l].slice(0, 5));
  const reroll = (d: WalkDungeon, s: number) => { setDungeon(d); setSeed(s); setRun(roll(d, s)); setN((k) => k + 1); };
  const set = (v: Partial<View3D>) => setView((was) => ({ ...was, ...v }));
  // Flip: swap one pair every second (south rock full ↔ low rim; unfound places rock ↔ black).
  const [flip, setFlip] = useState<"south" | "unseen" | null>(null);
  useEffect(() => {
    if (!flip) return;
    const t = setInterval(() => setView((v) => flip === "south" ? { ...v, south: v.south === "full" ? "low" : "full" } : { ...v, unseen: v.unseen === "rock" ? "black" : "rock" }), 1000);
    return () => clearInterval(t);
  }, [flip]);
  const flipChip = (k: "south" | "unseen") => chip(flip === k, flip === k ? "Flipping…" : "Flip", () => setFlip((f) => (f === k ? null : k)));
  const chip = (on: boolean, label: string, onClick: () => void) => <button className="chip" data-active={on} onClick={onClick} style={{ minHeight: 36 }}>{label}</button>;
  const here = run.path[run.path.length - 1];
  const enter = (id: string, st: Parameters<typeof walkKeep>[1]) => { setRun((r) => walkInto(walkKeep(r, st), id)); say(`Into ${run.map.nodes[id].kind}`); };
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 240px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", margin: 0 }}>3D prototype</h1>
        <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>The same run, drawn by the game&apos;s 2D view or by Three.js. Tap to walk, or WASD. Nothing is saved.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chip(!three, "2D (the game)", () => { setThree(false); setN((k) => k + 1); })}
          {chip(three, "3D (Three.js)", () => { setThree(true); setN((k) => k + 1); })}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chip(dungeon === 0, "Encampment", () => reroll(0, seed))}
          {chip(dungeon === 1, "Labyrinth", () => reroll(1, seed))}
          {chip(false, "Another run", () => reroll(dungeon, seed + 1))}
        </div>
        {three && <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip(!view.grey, "Kit art", () => set({ grey: false }))}
            {chip(view.grey, "Grey geometry", () => set({ grey: true, ...CANDIDATES.B, south: "low", unseen: "black" }))}
          </div>
          {view.grey && <>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Side walls</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chip(view.perspective, "A: perspective", () => set(CANDIDATES.A))}
              {chip(!view.perspective, "B: ortho + lean", () => set(CANDIDATES.B))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {view.perspective
                ? [10, 20, 30].map((v) => chip(view.fov === v, `FOV ${v}°`, () => set({ fov: v })))
                : [0, 0.015, 0.03, 0.05].map((v) => chip(view.lean === v, v ? `Lean ${v}` : "No lean", () => set({ lean: v })))}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>South rock (stand by a room&apos;s south wall)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chip(view.south === "full", "Full", () => set({ south: "full" }))}
              {chip(view.south === "low", "Low rim", () => set({ south: "low" }))}
              {flipChip("south")}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Places not found yet</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {chip(view.unseen === "rock", "Solid rock", () => set({ unseen: "rock" }))}
              {chip(view.unseen === "black", "Black", () => set({ unseen: "black" }))}
              {chip(view.unseen === "shown", "Shown", () => set({ unseen: "shown" }))}
              {flipChip("unseen")}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Wall height</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[1.5, WALL_HEIGHT].map((v) => chip(view.wall === v, `${v} u`, () => set({ wall: v })))}</div>
          </>}
          <div style={{ fontSize: 12, opacity: 0.7 }}>Camera pitch</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{PITCHES.map((p) => chip(Math.abs(view.pitch - p.v) < 1e-6, p.label, () => set({ pitch: p.v })))}</div>
          {!view.grey && <><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip(!view.perspective, "Orthographic", () => set({ perspective: false }))}
            {chip(view.perspective, "Perspective", () => set({ perspective: true }))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip(view.pixels === "device", "Screen pixels", () => set({ pixels: "device" }))}
            {chip(view.pixels === "art", "Art pixels", () => set({ pixels: "art" }))}
            {chip(view.shadows, `Torch shadows: ${view.shadows ? "on" : "off"}`, () => set({ shadows: !view.shadows }))}
          </div></>}
          {view.grey && <div style={{ fontSize: 12, opacity: 0.6 }}>(Grey: the camera is A or B; no art or torch, so no pixel or shadow switches.)</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[11, 15, 19].map((a) => chip(view.across === a, `${a} across`, () => set({ across: a })))}</div>
          <div className="pixel-font" style={{ fontSize: 13, color: "#9fe0a8" }}>
            {stats ? `${stats.fps} fps · ${stats.calls} draw calls · ${(stats.triangles / 1000).toFixed(1)}k triangles · ${stats.lights} lights near` : "…"}
          </div>
        </>}
        <div style={{ fontSize: 12, opacity: 0.75 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
      <div className="game-screen" style={{ height: "calc(100dvh - 24px)", width: "min(100%, calc((100dvh - 24px) * 9 / 16))", border: "1px solid #333" }}>
        <div className="screen-scale" style={{ position: "relative" }}>
          {three
            ? <WalkView3D key={n} walk={run.walk!} map={run.map} dungeon={dungeonOf(run)} here={here} room={(id) => walkRoom(run, id)} view={view} onEnter={enter} onLog={say} onStats={setStats}
                seeAll={start.seeAll} startIn={start.roomKind && n === 0 ? Object.keys(run.map.nodes).find((id) => run.map.nodes[id].kind === start.roomKind) : undefined} />
            : <WalkView key={n} walk={run.walk!} map={run.map} dungeon={dungeonOf(run)} here={here} room={(id) => walkRoom(run, id)} busy={false}
                been={run.path} cleared={run.cleared} scroll={false} onScrollClose={() => {}} team={TEAM} hp={run.hp}
                onEnter={enter} onSpotted={(id) => say(`Seen by ${id}'s foes: a fight`)} onObject={(id) => say(`Opened ${id}'s ${run.map.nodes[id].kind}`)}
                onCage={(id, i) => say(`Opened cage ${i + 1} in ${id}`)} onHeal={() => {}} onKeep={(st) => setRun((r) => walkKeep(r, st))} />}
        </div>
      </div>
    </main>
  );
}
