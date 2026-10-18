"use client";
// app/page.tsx — home: the Den, where you live. Click objects to open each
// part of the game. Under the room, the same places as buttons (quicker on
// small screens and for keyboard users), with the Labyrinth first and biggest.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { TOTAL_CREATURES, TOTAL_ITEMS } from "@/lib/items/gameHelpers";
import DenRoom, { SPOTS } from "@/components/DenRoom";
import GoldCount from "@/components/GoldCount";
import { useEffect, useState } from "react";
import { klutzStatus } from "@/lib/klutz";
import { klutzHasNews } from "@/lib/quest";
import { loadDungeon, bagSize, BINDLE } from "@/lib/dungeon/run";
import { OBJ } from "@/lib/den/scene";

// The buttons under the room, in groups: your creatures, your things, and the rest.
const GROUPS: { title: string; ids: number[] }[] = [
  { title: "Creatures", ids: [OBJ.pit, OBJ.altar, OBJ.cage, OBJ.pool] },
  { title: "Things", ids: [OBJ.chest, OBJ.bag, OBJ.bookcase, OBJ.crate] },
  { title: "Help", ids: [OBJ.klutz, OBJ.scroll] },
];

export default function Home() {
  const game = useGameState();
  // Klutz comes and goes with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  const k = klutzStatus(game.klutz, game.klutzFighter.maxHp, now).kind;
  // The bag by the archway: a bindle until the rugged backpack from your first Cyclops.
  const [backpack, setBackpack] = useState(false);
  useEffect(() => { setBackpack(bagSize(loadDungeon().meta) > BINDLE); }, []);

  return (
    <main style={{ padding: "16px 12px 32px", maxWidth: 960, margin: "0 auto", color: "white" }}>
      <div className="title-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 22, color: "#f1d9a0", fontWeight: 600 }}>Codex Creatures</h1>
        <div className="pixel-font" style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 15, flexWrap: "wrap" }}>
          <GoldCount gold={game.gold} size={15} />
          <span style={{ color: "#8fc1ff" }} title="Creatures discovered">🐾 {game.discoveredCreatures}/{TOTAL_CREATURES}</span>
          <span style={{ color: "#ffd98a" }} title="Items discovered">⚔️ {game.discoveredItems}/{TOTAL_ITEMS}</span>
        </div>
      </div>

      <DenRoom caged={(game.caged[0] as { creatureId?: string } | undefined)?.creatureId}
        klutz={!game.hydrated || k === "away" ? "away" : k === "healing" ? "pool" : "home"}
        klutzNews={game.hydrated && (klutzHasNews(game.quest) || (game.scanTipDue && !game.scanTipRead))} backpack={backpack} />

      <nav className="stone-panel" style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <Link href="/dungeon" className="pixel-btn" style={{ display: "block", textAlign: "center", fontSize: 20, padding: "12px 0" }}>
          🌀 Enter the Labyrinth
        </Link>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="pixel-font" style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{g.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {g.ids.map((id) => {
                  const s = SPOTS[id as keyof typeof SPOTS];
                  return s?.href ? <Link key={id} href={s.href} className="pixel-btn" style={{ fontSize: 13, padding: "6px 10px", minHeight: 40 }}>{s.label}</Link> : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </main>
  );
}
