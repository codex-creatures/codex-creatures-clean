"use client";
// app/page.tsx — home: the Den, where you live. Click objects to open each
// part of the game.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { TOTAL_CREATURES, TOTAL_ITEMS } from "@/lib/items/gameHelpers";
import DenRoom, { SPOTS } from "@/components/DenRoom";
import { useEffect, useState } from "react";
import { klutzStatus } from "@/lib/klutz";
import { klutzHasNews } from "@/lib/quest";
import { loadDungeon, bagSize, BINDLE } from "@/lib/dungeon/run";

export default function Home() {
  const game = useGameState();
  // Klutz comes and goes with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  const k = klutzStatus(game.klutz, game.klutzFighter.maxHp, now).kind;
  // The bag by the archway: a bindle until your first mini boss's rugged backpack.
  const [backpack, setBackpack] = useState(false);
  useEffect(() => { setBackpack(bagSize(loadDungeon().meta) > BINDLE); }, []);

  return (
    <main style={{ padding: "16px 12px 32px", maxWidth: 960, margin: "0 auto", color: "white" }}>
      <div className="stone-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", marginBottom: 12 }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 22, color: "#f1d9a0", fontWeight: 600 }}>Codex Creatures</h1>
        <div className="pixel-font" style={{ display: "flex", gap: 14, fontSize: 15, flexWrap: "wrap" }}>
          <span style={{ color: "#f5c542" }}>🪙 {game.gold.toLocaleString()}</span>
          <span style={{ color: "#8fc1ff" }} title="Creatures discovered">🐾 {game.discoveredCreatures}/{TOTAL_CREATURES}</span>
          <span style={{ color: "#ffd98a" }} title="Items discovered">⚔️ {game.discoveredItems}/{TOTAL_ITEMS}</span>
        </div>
      </div>

      <DenRoom caged={(game.caged[0] as { creatureId?: string } | undefined)?.creatureId}
        klutz={!game.hydrated || k === "away" ? "away" : k === "healing" ? "pool" : "home"}
        klutzNews={game.hydrated && (klutzHasNews(game.quest) || (game.scanTipDue && !game.scanTipRead))} backpack={backpack} />

      {/* Plain links too — quicker on small screens and for keyboard users. */}
      <nav style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
        {Object.values(SPOTS).filter((s) => s.href).map((s) => (
          <Link key={s.href} href={s.href!} className="pixel-btn" style={{ fontSize: 14, padding: "6px 12px" }}>{s.label}</Link>
        ))}
      </nav>
    </main>
  );
}
