"use client";
// app/lab/rooms/page.tsx — every kind of labyrinth room, as you'd stand in
// it, from a made-up run (dev tool; nothing is saved). For checking the
// room art without playing a run.

import { useMemo, useState } from "react";
import DungeonRoomView from "@/components/DungeonRoomView";
import { isFight, makeRoom, type DungeonRun, type Room, type RoomKind } from "@/lib/dungeon/run";
import type { DungeonMap } from "@/lib/dungeon/map";
import LootWindow from "@/components/LootWindow";
import { lookOf } from "@/components/ContainerLoot";
import type { SackItem } from "@/lib/dungeon/run";
import { RICKETY_CHEST_OPEN } from "@/lib/sprites/props";
import { weaponDrop } from "@/lib/drops";
import LevelUpShow from "@/components/LevelUpShow";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";

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
  // A loot window to try (nothing is saved): drag between the chest and a 3-slot bag.
  const [lootOpen, setLootOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [sack, setSack] = useState<SackItem[]>(() => [{ gold: 120 }, { potion: "potion" }, { gear: weaponDrop("void_scythe", "epic") }, { gear: weaponDrop("klutz_club", "common") }]);
  const [bag, setBag] = useState<SackItem[]>(() => [{ potion: "lesser" }, { gear: weaponDrop("klutz_club", "rare") }]);
  const roomless = (x: SackItem) => lookOf(x).free;
  const take = (i: number, at?: number) => {
    const x = sack[i];
    if (!roomless(x) && bag.length >= 3 && at === undefined) return;
    let nb = bag, ns = sack.filter((_, j) => j !== i);
    if (!roomless(x)) {
      if (at !== undefined && bag[at]) { ns = [...ns, bag[at]]; nb = bag.map((b, j) => (j === at ? x : b)); }
      else nb = [...bag, x];
    }
    setSack(ns); setBag(nb);
  };
  const runs = useMemo(() => KINDS.map((k) => fakeRun(k, ways, done, seed + KINDS.indexOf(k))), [ways, done, seed]);
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a12", color: "#eee", padding: 16 }}>
      <h1 className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Labyrinth rooms</h1>
      <div className="stone-panel" style={{ maxWidth: 518, marginBottom: 16 }}>
        <button className="pixel-btn" onClick={() => setLootOpen(true)}>Try the loot window</button>{" "}
        <button className="pixel-btn" onClick={() => setLevelOpen(true)}>Try the level-up show</button>
        {levelOpen && (
          <LevelUpShow onDone={() => setLevelOpen(false)} ups={[
            { id: "a", name: "Aurelius", creatureId: "aurelius", template: CREATURE_BY_ID.aurelius, from: 4, to: 5 },
            { id: "b", name: "Moss Wolf", creatureId: "moss_wolf", template: CREATURE_BY_ID.moss_wolf, from: 2, to: 4 },
          ]} />
        )}
        {lootOpen && (
          <LootWindow name="The rickety chest" sprite={RICKETY_CHEST_OPEN} items={sack} slots={3} bagName="Bindle"
            bag={bag.map((x) => { const l = lookOf(x); return { name: l.name, sprite: l.sprite, icon: l.icon, color: l.color, glow: l.glow, peek: x }; })}
            onTake={(i) => take(i)} onTakeAll={() => { for (let i = sack.length - 1; i >= 0; i--) if (roomless(sack[i])) take(i); }}
            onSwap={(i, at) => take(i, at)} onPutBack={(at) => { setSack([...sack, bag[at]]); setBag(bag.filter((_, j) => j !== at)); }}
            onClose={() => setLootOpen(false)} />
        )}
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
            <DungeonRoomView run={r} open onGo={() => {}} onEnemies={() => {}} onFight={!done && isFight(KINDS[i]) ? () => {} : undefined} />
          </div>
        ))}
      </div>
    </main>
  );
}
