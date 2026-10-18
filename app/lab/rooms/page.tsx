"use client";
// app/lab/rooms/page.tsx — every kind of labyrinth room, as you'd stand in
// it, from a made-up run (dev tool; nothing is saved). For checking the
// room art without playing a run.

import { useMemo, useState } from "react";
import DungeonRoomView from "@/components/DungeonRoomView";
import { makeRoom, type DungeonRun, type Room, type RoomKind } from "@/lib/dungeon/run";
import type { DungeonMap } from "@/lib/dungeon/map";
import ContainerLoot from "@/components/ContainerLoot";
import { RICKETY_CHEST_OPEN } from "@/lib/sprites/props";
import { weaponDrop } from "@/lib/drops";

const KINDS: RoomKind[] = ["easy", "hard", "miniboss", "boss", "chest", "stash", "treasure", "pool", "merchant", "librarian", "witch", "cards", "entrance"];

// A room in the middle of a little map, with `ways` tunnels leading on.
function fakeRun(kind: RoomKind, ways: number, done: boolean, seed: number): DungeonRun {
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const here = `room${seed}`;
  const nodes: DungeonMap["nodes"] = { [here]: { id: here, x: 300, y: 300, kind, links: [] } };
  for (let i = 0; i < ways; i++) {
    const id = `n${i}`;
    nodes[id] = { id, x: 200 + i * 100, y: 200, kind: "easy", links: [] };
    nodes[here].links.push(id);
  }
  const room: Room | null = kind === "entrance" ? null : { ...makeRoom(kind, rng, kind === "easy" ? 9 : Infinity), done };
  return {
    id: "lab", runNumber: 9, startedAt: "", party: [], team: [], hp: {}, room: 3,
    map: { start: "start", boss: "boss", nodes: { ...nodes, start: { id: "start", x: 300, y: 500, kind: "entrance", links: [here] } } },
    path: ["start", here], cleared: [], current: room, inside: true, loot: [], status: "exploring",
  };
}

export default function RoomsLab() {
  const [ways, setWays] = useState(2);
  const [done, setDone] = useState(false);
  const [seed, setSeed] = useState(7);
  const runs = useMemo(() => KINDS.map((k) => fakeRun(k, ways, done, seed + KINDS.indexOf(k))), [ways, done, seed]);
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Labyrinth rooms</h1>
      <div className="stone-panel" style={{ maxWidth: 518, marginBottom: 16 }}>
        <ContainerLoot name="The rickety chest" sprite={RICKETY_CHEST_OPEN} bagUsed={3} bagSlots={5} onTake={() => {}} onTakeAll={() => {}}
          items={[{ gold: 120 }, { potion: "potion" }, { gear: weaponDrop("void_scythe", "epic") }, { gear: weaponDrop("klutz_club", "common") }, { backpack: true }]} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[1, 2, 3].map((n) => <button key={n} className="chip" aria-pressed={ways === n} onClick={() => setWays(n)}>{n} tunnel{n > 1 ? "s" : ""}</button>)}
        <button className="chip" onClick={() => setDone((d) => !d)}>{done ? "Showing: dealt with" : "Showing: fresh"}</button>
        <button className="chip" onClick={() => setSeed((s) => s + 13)}>Reroll</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 18 }}>
        {runs.map((r, i) => (
          <div key={`${KINDS[i]}-${seed}-${ways}-${done}`}>
            <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", marginBottom: 6 }}>{KINDS[i]}</div>
            <DungeonRoomView run={r} open onGo={() => {}} onEnemies={() => {}} />
          </div>
        ))}
      </div>
    </main>
  );
}
