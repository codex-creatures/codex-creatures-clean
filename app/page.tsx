"use client";
// app/page.tsx — home: the Den, where you live. Click objects to open each
// part of the game. Under the room, a dock with the same places as buttons
// (quicker on small screens and for keyboard users), the Labyrinth first.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import { TOTAL_CREATURES, TOTAL_ITEMS } from "@/lib/items/gameHelpers";
import DenRoom, { SPOTS } from "@/components/DenRoom";
import GoldCount from "@/components/GoldCount";
import { useEffect, useState } from "react";
import { klutzStatus } from "@/lib/klutz";
import { klutzHasNews, needsFirstCreature, needsGearUp } from "@/lib/quest";
import { loadDungeon, bagSize, BINDLE } from "@/lib/dungeon/run";
import { OBJ } from "@/lib/den/scene";
import { canBlast, tavernVisitor } from "@/lib/tavern";

// The places in the dock under the room: your creatures, your things, then help.
const PLACES = [OBJ.pit, OBJ.altar, OBJ.cage, OBJ.pool, OBJ.klutz, OBJ.chest, OBJ.bag, OBJ.bookcase, OBJ.crate, OBJ.scroll];

export default function Home() {
  const game = useGameState();
  // Klutz comes and goes with the clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, []);
  const k = klutzStatus(game.klutz, game.klutzFighter.maxHp, now).kind;
  // The bag by the archway: a bindle until the rugged backpack from your first Cyclops.
  const [backpack, setBackpack] = useState(false);
  useEffect(() => { setBackpack(bagSize(loadDungeon().meta) > BINDLE); }, []);
  // Where Klutz has sent you: the cage for your first creature, then the Pit to
  // kit it out; later, with his dynamite, the rubble (lib/tavern.ts).
  const mine = game.inventory.filter((d) => d.dropType === "creature");
  const highlight = !game.hydrated ? undefined
    : needsFirstCreature(game.quest, mine.length > 0) && game.caged.length > 0 ? OBJ.cage
    : needsGearUp(game.quest, mine.map((c) => game.equipment[c.id])) ? OBJ.pit
    : canBlast(game.tavern) ? OBJ.tavern : undefined;

  return (
    <main className="screen-page">
      <header className="screen-header" style={{ gridTemplateColumns: "1fr auto" }}>
        <h1 className="pixel-font" style={{ margin: 0, fontSize: 18, color: "#f1d9a0", fontWeight: 600, whiteSpace: "nowrap" }}>Codex Creatures</h1>
        <div className="pixel-font" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
          <GoldCount gold={game.gold} size={13} />
          <span style={{ color: "#8fc1ff" }} title="Creatures discovered">🐾 {game.discoveredCreatures}/{TOTAL_CREATURES}</span>
          <span style={{ color: "#ffd98a" }} title="Items discovered">⚔️ {game.discoveredItems}/{TOTAL_ITEMS}</span>
          <Link href="/settings" aria-label="Settings" title="Settings: export, import or back up your save" style={{ fontSize: 16, lineHeight: 1 }}>⚙️</Link>
        </div>
      </header>

      <div className="screen-fill">
        <DenRoom caged={(game.caged[0] as { creatureId?: string } | undefined)?.creatureId}
          klutz={!game.hydrated || k === "away" ? "away" : k === "healing" ? "pool" : "home"}
          klutzNews={game.hydrated && (klutzHasNews(game.quest) || game.tavernDue || (game.scanTipDue && !game.scanTipRead))} backpack={backpack} highlight={highlight}
          rubble={game.tavern.blasted ? "open" : canBlast(game.tavern) ? "dynamite" : "shut"} onBlast={game.blastRubble}
          tavernNews={game.hydrated && !!tavernVisitor(game.tavern)} upgraded={game.bookcase >= 2} />
      </div>

      {/* The dock: the Labyrinth first and biggest, then every place in the Den. */}
      <nav className="screen-dock" style={{ display: "grid", gap: 6 }}>
        <Link href="/dungeon" className="pixel-btn" style={{ display: "block", textAlign: "center", fontSize: 18, padding: "8px 0" }}>
          🌀 Enter the Labyrinth
        </Link>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
          {PLACES.map((id) => {
            const s = SPOTS[id as keyof typeof SPOTS];
            return s?.href ? <Link key={id} href={s.href} className={`dock-tab${id === highlight ? " tutorial-pulse" : ""}`} style={{ fontSize: 11, whiteSpace: "normal", textAlign: "center", lineHeight: 1.1, minHeight: 40 }}>{s.label}</Link> : null;
          })}
        </div>
      </nav>
    </main>
  );
}
