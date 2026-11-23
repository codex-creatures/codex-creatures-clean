"use client";
// components/MoveSlots.tsx
// A creature's moves: its 4 move slots, and nothing else. It knows only what's
// in them (the user, 2026-11-24: nothing waits in reserve; a move taught from a
// codex replaces one for good). Reading a codex with all 4 slots full:
// `teaching` asks you to tap the move it replaces, then Confirm. Moves that
// came from a codex are tagged.

import { useState } from "react";
import { CLASS_INFO, MOVE_BY_NAME, MOVE_SLOTS, STEADY_MAX_ENERGY, hasSteadyMove, isUtility, resolveMoves, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { MoveKind, moveTag } from "./ClassBadge";
import Glyph from "./Glyph";
import { MoveTile } from "./MoveTile";

const MUTED = "rgba(255,255,255,0.5)";
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const CODEX_TAG = { text: "codex", color: "#c7b8ff" };

// A one-line summary (used on cards and other compact lists).
export function MoveInfo({ m }: { m: Skill }) {
  return (
    <>
      <span style={{ fontWeight: 600, color: m.effect ? "#ffd98a" : "white" }}>{m.name}</span>
      <span style={{ fontSize: 12, color: MUTED }}> · {isUtility(m) ? "utility" : <><MoveKind m={m} /> · {m.damage} dmg</>} · {m.energyCost}⚡</span>
      {m.desc && <span style={{ display: "block", fontSize: 11, color: "#c9b48a", marginTop: 2 }}>{m.desc}</span>}
    </>
  );
}

// A move as a full card.
export function MoveCard({ m, slot, tag, selected, dim, onClick }: {
  m: Skill; slot?: number; tag?: { text: string; color: string }; selected?: boolean; dim?: boolean; onClick?: () => void;
}) {
  const style = CLASS_INFO[m.type], dtype = moveTag(m);
  const pill = (text: React.ReactNode, color: string) => (
    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, border: `1px solid ${color}88`, color, whiteSpace: "nowrap" }}>{text}</span>
  );
  return (
    <button onClick={onClick} disabled={!onClick} aria-pressed={selected}
      style={{
        position: "relative", textAlign: "left", width: "100%", padding: "10px 12px", borderRadius: 10, color: "white",
        background: selected ? "rgba(255,214,110,0.10)" : "#15161d",
        border: `2px solid ${selected ? "#ffd66e" : "#2a2d38"}`, boxShadow: selected ? "0 0 12px rgba(255,214,110,0.35)" : "none",
        cursor: onClick ? "pointer" : "default", opacity: dim ? 0.55 : 1,
      }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {slot !== undefined && <span style={{ ...NUM, fontSize: 12, color: MUTED }}>{slot + 1}</span>}
        <span style={{ fontSize: 16, fontWeight: 700, color: m.effect ? "#ffd98a" : "white" }}>{m.name}</span>
        {tag && <span style={{ marginLeft: "auto", fontSize: 11, color: tag.color }}>{tag.text}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {isUtility(m) ? pill("Utility", "#c7b8ff") : <>{pill(`${style.icon} ${style.name}`, style.color)}{pill(<><Glyph icon={dtype.icon} art={dtype.art} /> {dtype.name}</>, dtype.color)}</>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {!isUtility(m) && <span style={{ fontSize: 13, color: MUTED }}>Power <span style={{ ...NUM, fontSize: 17, color: "#ff9f7a" }}>{m.damage}</span></span>}
        <span style={{ fontSize: 13, color: MUTED }}>Energy <span style={{ ...NUM, fontSize: 17, color: "#7fc4ff" }}>{m.energyCost}</span></span>
        {m.cooldown && <span style={{ fontSize: 13, color: MUTED }}>Cooldown <span style={{ ...NUM, fontSize: 17 }}>{m.cooldown}</span></span>}
      </div>
      {m.desc && <div style={{ fontSize: 12, color: "#c9b48a", marginTop: 6, lineHeight: 1.4 }}>{m.desc}</div>}
    </button>
  );
}

export default function MoveSlots({ template, moves, learned, teaching }: {
  template: CreatureTemplate;
  moves?: string[];   // what's in its slots
  learned?: string[]; // which of them came from a codex (tagged)
  teaching?: { move: string; onPick: (slot: number) => void; onCancel: () => void };
}) {
  const [forget, setForget] = useState<number | null>(null); // teaching: the slot picked to forget, awaiting Confirm
  const [warn, setWarn] = useState(false); // tried to give up its last steady move
  const current = resolveMoves(template, moves);
  // Would putting this move in this slot leave the set without a steady move (STEADY_MAX_ENERGY)?
  const breaks = (slot: number, m?: Skill) => !!m && !hasSteadyMove(current.map((c, i) => (i === slot ? m : c)));
  const fromCodex = new Set(learned ?? []);

  return (
    <div>
      {teaching && (
        <div className="tutorial-tip" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          {forget === null || !current[forget] ? (
            <>
              <span>Learning <b>{teaching.move}</b>: tap a move to forget.</span>
              <button className="chip" onClick={teaching.onCancel}>Cancel</button>
            </>
          ) : (
            <>
              {/* Reading the codex uses it up, so the swap waits for a Confirm. */}
              <span>Forget <b>{current[forget].name}</b> for <b>{teaching.move}</b>? It&apos;s gone for good.</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="chip" onClick={() => { const i = forget; setForget(null); teaching.onPick(i); }}>✓ Confirm</button>
                <button className="chip" onClick={() => setForget(null)}>Back</button>
              </span>
            </>
          )}
        </div>
      )}
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, display: teaching && !warn ? "none" : undefined }}>
        {warn ? <span style={{ color: "#ff8a80" }}>Keep one move of {STEADY_MAX_ENERGY}⚡ or less: it always has one it can afford.</span>
          : "Its moves in battle. A codex teaches a new one in place of one of these."}
      </div>
      <div className="move-grid">
        {Array.from({ length: MOVE_SLOTS }, (_, i) => current[i]).map((m, i) => m ? (
          <MoveTile key={i} m={m} slot={i} selected={teaching ? forget === i : false} tag={fromCodex.has(m.name) ? CODEX_TAG : undefined}
            onClick={teaching ? () => { const no = breaks(i, MOVE_BY_NAME[teaching.move]); setWarn(no); if (!no) setForget(forget === i ? null : i); } : undefined} />
        ) : (
          <div key={i} style={{ padding: 12, borderRadius: 10, border: "2px dashed #2a2d38", color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>
            Empty slot {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
