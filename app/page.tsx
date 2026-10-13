"use client";
// app/page.tsx — home: the dungeon you live in. Click objects to open each
// part of the game.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { TOTAL_CREATURES, TOTAL_ITEMS } from "@/lib/items/gameHelpers";
import DungeonRoom, { SPOTS } from "@/components/DungeonRoom";

export default function Home() {
  const game = useGameState();

  return (
    <main style={{ padding: "16px 12px 32px", maxWidth: 680, margin: "0 auto", color: "white" }}>
      <div className="stone-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", marginBottom: 12 }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 22, color: "#f1d9a0", fontWeight: 600 }}>Codex Creatures</h1>
        <div className="pixel-font" style={{ display: "flex", gap: 14, fontSize: 15, flexWrap: "wrap" }}>
          <span style={{ color: "#f5c542" }}>🪙 {game.gold.toLocaleString()}</span>
          <span style={{ color: "#8fc1ff" }} title="Creatures discovered">🐾 {game.discoveredCreatures}/{TOTAL_CREATURES}</span>
          <span style={{ color: "#ffd98a" }} title="Items discovered">⚔️ {game.discoveredItems}/{TOTAL_ITEMS}</span>
        </div>
      </div>

      <DungeonRoom />

      {/* Plain links too — quicker on small screens and for keyboard users. */}
      <nav style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
        {Object.values(SPOTS).filter((s) => s.href).map((s) => (
          <Link key={s.href} href={s.href!} className="pixel-btn" style={{ fontSize: 14, padding: "6px 12px" }}>{s.label}</Link>
        ))}
      </nav>
    </main>
  );
}
