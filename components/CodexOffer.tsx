"use client";
// components/CodexOffer.tsx
// One codex on a librarian's shelf (the Labyrinth's, or the tavern's): its
// name, who can learn it and a two-line taste of what it does, with the price
// to tap and buy; the "?" beside it shows the move in full (damage, energy,
// cooldown, style and what it does).

import { Coin } from "./GoldCount";
import Help from "./Help";
import { MoveCard } from "./MoveSlots";
import { codexLearners, MOVE_BY_NAME } from "@/lib/creatures/creatureData";

const MUTED = "rgba(255,255,255,0.55)";

export default function CodexOffer({ name, price, sold, off, onBuy }: {
  name: string; price: number; sold?: boolean;
  off: boolean;        // can't buy it (sold, too dear, no room)
  onBuy: () => void;
}) {
  const move = MOVE_BY_NAME[name];
  const learners = codexLearners(name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button className="card-btn" disabled={off} onClick={onBuy} style={{ flex: 1, opacity: off ? 0.5 : 1 }}>
        <span style={{ flex: 1 }}>
          <b style={{ color: "#c7b8ff" }}>📖 Codex: {name}</b>
          <span style={{ fontSize: 12, color: learners.color }}> · {learners.text}</span>
          {/* Two lines whatever the move, so every row is the same height. */}
          <span title={move?.desc} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35, height: "2.7em", fontSize: 12, color: MUTED }}>{move?.desc}</span>
        </span>
        <span className="pixel-font" style={{ color: "#f1d9a0", flexShrink: 0 }}>{sold ? "bought" : <><Coin /> {price}</>}</span>
      </button>
      {move && (
        <Help title={`Codex: ${name}`} label={`What ${name} does`}>
          <MoveCard m={move} />
          <p style={{ color: learners.color }}>{learners.text}</p>
        </Help>
      )}
    </div>
  );
}
