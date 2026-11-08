"use client";
// app/lab/placement/page.tsx — the placement debugging view (docs/world-spec.md
// §8 2b-2 stage A): a made-up run's rooms, one at a time, as the placer saw
// them (lib/world/placementView.ts): the grid and subcells, every occupancy
// layer, clearances, reservations, panels blocked to walking, attachment
// slots, where things are used from, foes' bodies, and each spot tried and
// refused with why. Pick the dungeon, the seed and the room. The same seed
// gives the same run every time. Dev tool: nothing is saved.

import { useMemo, useState } from "react";
import { placeWalk, PLACED_V } from "@/lib/world/place";
import { placementSvg, VIEW_COLOURS } from "@/lib/world/placementView";
import { startWalkRun, walkRoom, type WalkDungeon } from "@/lib/dungeon/walkRun";
import { dungeonOf, type DungeonRun } from "@/lib/dungeon/run";
import { seeded } from "@/lib/world/walkWorld";

const KEY: [string, string][] = [
  ["door", "kept: a doorway"], ["path", "kept: a required path"], ["point", "kept: a thing's spot"], ["blocked", "blocked to walking (policy)"],
  ["structure", "structure (pillar)"], ["blocking", "blocking"], ["walk-over", "walk-over"], ["trigger", "trigger"], ["overhead", "overhead"],
  ["clearance", "clearance"], ["access", "used from here"], ["slot", "attachment slot"], ["slotTaken", "slot taken"],
];

export default function PlacementLab() {
  const [dungeon, setDungeon] = useState<WalkDungeon>(1);
  const [seed, setSeed] = useState(1);
  // A made-up run at the newest world version, placed here (never saved, so it needs no migration).
  const run: DungeonRun = useMemo(() => {
    const r = startWalkRun(["a", "b", "c"], ["a", "b", "c"], { a: 1, b: 1, c: 1 }, 1, [{}, {}], false, seeded(seed * 7919 + 13), dungeon);
    return { ...r, walk: { ...r.walk!, v: PLACED_V } };
  }, [dungeon, seed]);
  const placed = useMemo(() => placeWalk(run.walk!, run.map, dungeonOf(run), (id) => walkRoom(run, id)), [run]);
  const rooms = Object.keys(run.walk!.layout.rooms).sort();
  const [pick, setPick] = useState<string | null>(null);
  const roomId = pick && rooms.includes(pick) ? pick : rooms[0];
  const view = placementSvg(run.walk!, placed, roomId, (id) => walkRoom(run, id), 10);
  const kind = (id: string) => run.map.nodes[id]?.kind ?? "";
  return (
    <main style={{ minHeight: "100vh", background: "#15151d", color: "#eee", padding: 16, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", fontFamily: "monospace", fontSize: 13 }}>
      <div style={{ flex: "0 1 280px" }}>
        <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", margin: "0 0 8px" }}>Placement</h1>
        <p style={{ margin: "0 0 8px", color: "#aaa" }}>World version {run.walk!.v}. Nothing is saved.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <button className="chip" onClick={() => setDungeon(0)} style={{ opacity: dungeon === 0 ? 1 : 0.6 }}>Encampment</button>
          <button className="chip" onClick={() => setDungeon(1)} style={{ opacity: dungeon === 1 ? 1 : 0.6 }}>Labyrinth</button>
        </div>
        <label style={{ display: "block", marginBottom: 8 }}>Seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} style={{ width: 80 }} />
          <button className="chip" onClick={() => setSeed((s) => s + 1)}>Next</button></label>
        <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #333", marginBottom: 8 }}>
          {rooms.map((id) => (
            <button key={id} onClick={() => setPick(id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", minHeight: 32, background: id === roomId ? "#2d2d3a" : "transparent", color: "#eee", border: 0 }}>
              {id} · {kind(id)}
            </button>
          ))}
        </div>
        <div>{KEY.map(([k, label]) => (
          <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ width: 12, height: 12, background: VIEW_COLOURS[k as keyof typeof VIEW_COLOURS], display: "inline-block" }} />{label}
          </div>
        ))}</div>
      </div>
      <div style={{ flex: "1 1 400px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 15 }}>{roomId} · {kind(roomId)}</h2>
        <div style={{ overflow: "auto", background: "#000", padding: 8 }} dangerouslySetInnerHTML={{ __html: view.svg }} />
        <h3 style={{ fontSize: 14 }}>Things here</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{view.things.map((i) => <li key={i.id}>{i.id} · {i.def} · subcell {i.sx},{i.sy}{i.size ? ` · ${i.size.w}×${i.size.d}` : ""}{i.wall ? ` · ${i.wall} wall` : ""}</li>)}</ul>
        <h3 style={{ fontSize: 14 }}>Spots tried and refused ({view.rejected.length})</h3>
        <ol style={{ margin: 0, paddingLeft: 22 }}>{view.rejected.map((r) => <li key={r.n}>{r.id}: {r.what}</li>)}</ol>
        <h3 style={{ fontSize: 14 }}>What the placer reported</h3>
        <p style={{ margin: 0 }}>Moved: {placed.report.moved.length} · left out: {placed.report.omitted.length} · problems: {placed.report.problems.length}</p>
        {[...placed.report.problems, ...placed.report.moved, ...placed.report.omitted].map((p, i) => <div key={i}>{p.id}: {p.what}</div>)}
      </div>
    </main>
  );
}
