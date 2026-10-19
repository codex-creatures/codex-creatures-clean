"use client";
// components/CodexMove.tsx
// What a codex teaches, shown as the move itself: its stone tablet
// (MoveTile: the style's colour, how it hurts, the energy cost, and the (i)
// for the details), with its race if it's a race codex.

import { MoveTile } from "./MoveTile";
import RaceTag from "./RaceTag";
import { MOVE_BY_NAME } from "@/lib/creatures/creatureData";

export default function CodexMove({ move }: { move: string }) {
  const m = MOVE_BY_NAME[move];
  if (!m) return <span>Teaches {move}</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 180, flex: "none" }}><MoveTile m={m} /></div>
      {m.race && <RaceTag race={m.race} />}
    </div>
  );
}
