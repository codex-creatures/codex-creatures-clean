"use client";
// app/bookcase/page.tsx
// The bookcase in the Den, where codexes are kept. It starts as a single
// shelf holding BOOKCASE_SIZE; upgrades will come later. A codex is read
// from a creature's page (only creatures of its race can learn it).

import DenFrame from "@/components/DenFrame";
import CodexShelf from "@/components/CodexShelf";
import { useGameState } from "@/hooks/useGameState";
import { BOOKCASE_SIZE } from "@/lib/dungeon/run";

const MUTED = "rgba(255,255,255,0.5)";

export default function BookcasePage() {
  const game = useGameState();
  if (!game.hydrated) return <DenFrame title="Bookcase" icon="📚"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;

  return (
    <DenFrame title="Bookcase" icon="📚">
      <div className="stone-panel">
        <p style={{ fontSize: 13, color: "#c8c4b8", lineHeight: 1.5, margin: 0 }}>
          Just a shelf for now: it holds <b>{BOOKCASE_SIZE} codexes</b>. Codexes you bring home from the Labyrinth go here;
          if it&apos;s full they stay in your bag. Each codex teaches one creature its move — read it from the creature&apos;s Moves tab in the Pit. Race codexes only work on creatures of that race.
        </p>
      </div>
      <div style={{ marginTop: 14 }}><CodexShelf inventory={game.inventory} /></div>
    </DenFrame>
  );
}
