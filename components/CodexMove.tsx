"use client";
// components/CodexMove.tsx
// What a codex teaches, shown as the move itself: on the left its stone
// tablet (MoveTile: the style's colour, how it hurts, the energy cost, and
// the (i) for more), on the right what it does, in words (up to 5 lines).

import { MoveTile } from "./MoveTile";
import { MOVE_BY_NAME } from "@/lib/creatures/creatureData";
import { moveKind } from "./ClassBadge";

const MUTED = "rgba(255,255,255,0.6)";

export default function CodexMove({ move }: { move: string }) {
  const m = MOVE_BY_NAME[move];
  if (!m) return <span>Teaches {move}</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 150px) 1fr", gap: 10, alignItems: "center" }}>
      <MoveTile m={m} />
      <div style={{ fontSize: 12, lineHeight: 1.35, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        <div style={{ color: MUTED }}>{m.self ? "Utility: used on itself" : `${moveKind(m)} · power ${m.damage}`}{m.cooldown ? ` · ${m.cooldown}-round cooldown` : ""}</div>
        {m.desc && <div style={{ color: "#e8e2d0" }}>{m.desc}</div>}
      </div>
    </div>
  );
}
