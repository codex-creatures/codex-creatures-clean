"use client";
// app/lab/newrun/page.tsx — the Labyrinth's "New" (the walkable Encampment,
// components/WalkView.tsx) on a made-up run held in memory: to see the
// game's walk view without a save. Being seen, walking into rooms and
// tapping things only say so here (the real screen plays them out). A
// made-up hurt team (one knocked out) heals by the campfires.
// Dev tool: nothing is saved.

import { useMemo, useState } from "react";
import WalkView from "@/components/WalkView";
import { startWalkRun, walkInto, walkKeep, walkRoom } from "@/lib/dungeon/walkRun";
import type { DungeonRun } from "@/lib/dungeon/run";

const TEAM = [
  { id: "a", name: "Moss Wolf", rarity: "uncommon" as const, creatureId: "moss_wolf", maxHp: 60 },
  { id: "b", name: "Amber Wasp", rarity: "common" as const, creatureId: "amber_wasp", maxHp: 40 },
  { id: "c", name: "Moss Wolf", rarity: "common" as const, creatureId: "moss_wolf", maxHp: 50 },
];

export default function NewRunLab() {
  const first = useMemo(() => startWalkRun(["a", "b", "c"], ["a", "b", "c"], { a: 0.3, b: 0.8, c: 0 }, 1, [{}, {}]), []);
  const [run, setRun] = useState<DungeonRun>(first);
  const [log, setLog] = useState<string[]>([]);
  const [scroll, setScroll] = useState(false);
  const say = (s: string) => setLog((l) => [s, ...l].slice(0, 6));
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 220px", maxWidth: 300 }}>
        <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", margin: 0 }}>The new Encampment</h1>
        <button className="chip" onClick={() => setScroll(true)}>Scroll</button>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 8 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      </div>
      <div className="game-screen" style={{ height: "calc(100dvh - 32px)", width: "min(100%, calc((100dvh - 32px) * 9 / 16))", border: "1px solid #333" }}>
        <div className="screen-scale">
          <WalkView walk={run.walk!} map={run.map} here={run.path[run.path.length - 1]} room={(id) => walkRoom(run, id)} busy={false}
            been={run.path} cleared={run.cleared} scroll={scroll} onScrollClose={() => setScroll(false)}
            onEnter={(id, st) => { setRun((r) => walkInto(walkKeep(r, st), id)); say(`Into ${run.map.nodes[id].kind}`); }}
            onSpotted={(id) => say(`Seen by ${id}'s foes: a fight`)}
            onObject={(id) => say(`Opened ${id}'s ${run.map.nodes[id].kind}`)}
            team={TEAM} hp={run.hp}
            onHeal={(gains, st) => setRun((r) => ({ ...walkKeep(r, st), hp: Object.fromEntries(Object.entries(r.hp).map(([id, v]) => [id, v > 0 ? Math.min(1, v + (gains[id] ?? 0)) : v])) }))}
            onKeep={(st) => setRun((r) => walkKeep(r, st))} />
        </div>
      </div>
    </main>
  );
}
