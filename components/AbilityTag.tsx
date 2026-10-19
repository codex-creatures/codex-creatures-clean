"use client";
// components/AbilityTag.tsx
// A creature's ability (a rare passive some Epic+ creatures are born with).
// reserve: the box keeps its space (empty) when there's none, and is always
// two lines tall, so a window flicking between creatures doesn't move.

import { ABILITIES, type AbilityKey } from "@/lib/creatures/abilities";

export default function AbilityTag({ ability, compact, reserve }: { ability?: AbilityKey; compact?: boolean; reserve?: boolean }) {
  if (!ability && !reserve) return null;
  const a = ability ? ABILITIES[ability] : undefined;
  if (!a) return <div aria-hidden style={{ margin: "8px 0 0", height: "calc(2 * 1.4em + 16px)", fontSize: 12 }} />;
  if (compact) return <span title={a.text} style={{ color: "#ffe9a8" }}>✦ {a.name}</span>;
  return (
    <div title={reserve ? a.text : undefined} style={{ margin: "8px 0 0", padding: "6px 10px", fontSize: 12, lineHeight: 1.4, color: "#ffe9a8",
      ...(reserve ? { height: "calc(2 * 1.4em + 16px)", boxSizing: "border-box", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } : {}),
      background: "rgba(255,233,168,0.07)", border: "2px solid rgba(255,233,168,0.35)" }}>
      <b>✦ Ability: {a.name}</b> — {a.text}
    </div>
  );
}
