"use client";
// app/lab/newrun/page.tsx — the Labyrinth's "New" (the walkable Encampment,
// components/WalkView.tsx) on a made-up run held in memory: to see the
// game's walk view without a save. Being seen, walking into rooms and
// tapping things only say so here (the real screen plays them out). A
// made-up hurt team (one knocked out) heals by the campfires. "Labyrinth"
// rolls the walkable Labyrinth instead (the Cyclops at the top, its large
// room, pools, campfire rooms, the witch walking about). "Decor" switches the
// decor samples (lib/dungeon/decor.ts: bits lying about, worn floor tiles) on and off.
// Dev tool: nothing is saved.

import { useMemo, useState } from "react";
import WalkView from "@/components/WalkView";
import { startWalkRun, walkInto, walkKeep, walkRoom, type WalkDungeon } from "@/lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "@/lib/dungeon/run";

const TEAM = [
  { id: "a", name: "Moss Wolf", rarity: "uncommon" as const, creatureId: "moss_wolf", maxHp: 60 },
  { id: "b", name: "Amber Wasp", rarity: "common" as const, creatureId: "amber_wasp", maxHp: 40 },
  { id: "c", name: "Moss Wolf", rarity: "common" as const, creatureId: "moss_wolf", maxHp: 50 },
];

export default function NewRunLab() {
  const roll = (d: WalkDungeon) => startWalkRun(["a", "b", "c"], ["a", "b", "c"], { a: 0.3, b: 0.8, c: 0 }, 1, [{}, {}], false, Math.random, d);
  const first = useMemo(() => roll(0), []);
  const [run, setRun] = useState<DungeonRun>(first);
  const [n, setN] = useState(0); // (a new run: the view starts afresh)
  const [log, setLog] = useState<string[]>([]);
  const [scroll, setScroll] = useState(false);
  const [decor, setDecor] = useState(true); // 🚧 the decor samples (lib/dungeon/decor.ts)
  const say = (s: string) => setLog((l) => [s, ...l].slice(0, 6));
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 220px", maxWidth: 300 }}>
        <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", margin: 0 }}>{dungeonOf(run) === 0 ? "The new Encampment" : "The walkable Labyrinth"}</h1>
        <button className="chip" onClick={() => setScroll(true)}>Scroll</button>
        <button className="chip" onClick={() => { setDecor((d) => !d); setN((k) => k + 1); }}>Decor: {decor ? "on" : "off"}</button>
        <button className="chip" onClick={() => { setRun(roll(0)); setN((k) => k + 1); }}>Encampment</button>
        <button className="chip" onClick={() => { setRun(roll(1)); setN((k) => k + 1); }}>Labyrinth</button>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
      <div className="game-screen" style={{ height: "calc(100dvh - 32px)", width: "min(100%, calc((100dvh - 32px) * 9 / 16))", border: "1px solid #333" }}>
        <div className="screen-scale">
          <WalkView key={n} walk={run.walk!} map={run.map} dungeon={dungeonOf(run)} decor={decor} here={run.path[run.path.length - 1]} room={(id) => walkRoom(run, id)} busy={false}
            been={run.path} cleared={run.cleared} scroll={scroll} onScrollClose={() => setScroll(false)}
            onEnter={(id, st) => { setRun((r) => walkInto(walkKeep(r, st), id)); say(`Into ${run.map.nodes[id].kind}`); }}
            onSpotted={(id) => say(`Seen by ${id}'s foes: a fight`)}
            onObject={(id) => say(`Opened ${id}'s ${run.map.nodes[id].kind}`)}
            onCage={(id, i) => say(`Opened cage ${i + 1} in ${id}`)}
            team={TEAM} hp={run.hp}
            onHeal={(gains, st) => setRun((r) => ({ ...walkKeep(r, st), hp: Object.fromEntries(Object.entries(r.hp).map(([id, v]) => [id, v > 0 ? Math.min(1, v + (gains[id] ?? 0)) : v])) }))}
            onKeep={(st) => setRun((r) => walkKeep(r, st))} />
        </div>
      </div>
    </main>
  );
}
