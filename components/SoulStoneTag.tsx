"use client";
// components/SoulStoneTag.tsx
// A creature's soul stone (a passive power some Rare+ creatures are born
// with: lib/creatures/soulStones.ts).
// reserve: the box keeps its space (empty) when there's none, and is always
// two lines tall, so a window flicking between creatures doesn't move.

import { SOUL_STONES, type SoulStoneKey } from "@/lib/creatures/soulStones";

export const SOUL_COLOR = "#b9e6ff";

export default function SoulStoneTag({ stone, compact, reserve }: { stone?: SoulStoneKey | null; compact?: boolean; reserve?: boolean }) {
  if (!stone && !reserve) return null;
  const s = stone ? SOUL_STONES[stone] : undefined;
  if (!s) return <div aria-hidden style={{ margin: "8px 0 0", height: "calc(2 * 1.4em + 16px)", fontSize: 12 }} />;
  if (compact) return <span title={s.text} style={{ color: SOUL_COLOR }}>{s.icon} {s.name}</span>;
  return (
    <div title={reserve ? s.text : undefined} style={{ margin: "8px 0 0", padding: "6px 10px", fontSize: 12, lineHeight: 1.4, color: SOUL_COLOR,
      ...(reserve ? { height: "calc(2 * 1.4em + 16px)", boxSizing: "border-box", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } : {}),
      background: "rgba(185,230,255,0.07)", border: "2px solid rgba(185,230,255,0.35)" }}>
      <b>{s.icon} Soul stone: {s.name}</b> — {s.text}
    </div>
  );
}
