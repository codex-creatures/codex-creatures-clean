"use client";
// components/CodexMove.tsx
// What a codex teaches, at a glance (the user, 2026-11-13: a basic visual
// snapshot, the details behind a "?"): on the left its stone tablet (MoveTile),
// on the right three fixed lines (style and race; power, energy and cooldown;
// its ability in a word or two) and a "?" that opens the full move card and
// who can learn it.

import { MoveTile } from "./MoveTile";
import { MoveCard } from "./MoveSlots";
import { MoveKind, moveTag } from "./ClassBadge";
import Glyph from "./Glyph";
import Help from "./Help";
import { MOVE_BY_NAME, codexLearners } from "@/lib/creatures/creatureData";
import { abilityOf } from "@/lib/creatures/moveAbility";

const MUTED = "rgba(255,255,255,0.6)";
const LINE: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", height: 20, lineHeight: "20px" };
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fbf1dc" };

export default function CodexMove({ move }: { move: string }) {
  const m = MOVE_BY_NAME[move];
  if (!m) return <span>Teaches {move}</span>;
  const ability = abilityOf(m), tag = moveTag(m), learners = codexLearners(move);
  const utility = m.self || m.damage === 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 150px) 1fr auto", gap: 10, alignItems: "center" }}>
      <MoveTile m={m} />
      <div style={{ fontSize: 13, minWidth: 0, display: "grid", gap: 2 }}>
        <div style={{ ...LINE, color: MUTED }}>{utility ? <>✨ Utility · <Glyph icon={tag.icon} art={tag.art} /> {tag.name}</> : <MoveKind m={m} />}</div>
        <div style={{ ...LINE, color: MUTED }}>
          {utility ? "No damage" : <>Power <span style={NUM}>{m.damage}{m.mult && m.mult !== 1 ? ` ×${m.mult}` : ""}</span></>}
          {" · "}⚡<span style={NUM}>{m.energyCost}</span>
          {m.cooldown ? <> · ⟳<span style={NUM}>{m.cooldown}</span></> : null}
        </div>
        <div style={{ ...LINE, color: "#ffd98a", fontWeight: 700, visibility: ability ? "visible" : "hidden" }}>{ability ?? "-"}</div>
      </div>
      <Help title={m.name} label={`What ${m.name} does`}>
        <MoveCard m={m} />
        <p style={{ color: learners.color }}>Learned by: {learners.text}</p>
      </Help>
    </div>
  );
}
