"use client";
// components/MoveSlots.tsx
// A creature's moves. Its 4 move slots sit on top; below are the other moves
// it knows — the ones it was born with (3–4) and any learned from a codex
// (codexes on the bookcase are offered under these, in the creature
// window). Tap a slot, then tap a move below to swap it in.
// Reading a codex with all 4 slots full: `teaching` asks you to tap the
// move it replaces, then Confirm.

import { useState } from "react";
import { CLASS_INFO, MOVE_SLOTS, movesAvailableTo, resolveMoves, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { moveKind, moveTag } from "./ClassBadge";
import { MoveTile } from "./MoveTile";

const MUTED = "rgba(255,255,255,0.5)";
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// A one-line summary (used on cards and other compact lists).
export function MoveInfo({ m }: { m: Skill }) {
  return (
    <>
      <span style={{ fontWeight: 600, color: m.effect ? "#ffd98a" : "white" }}>{m.name}</span>
      <span style={{ fontSize: 12, color: MUTED }}> · {m.self ? "utility" : `${moveKind(m)} · ${m.damage} dmg`} · {m.energyCost}⚡</span>
      {m.desc && <span style={{ display: "block", fontSize: 11, color: "#c9b48a", marginTop: 2 }}>{m.desc}</span>}
    </>
  );
}

// A move as a full card.
export function MoveCard({ m, slot, tag, selected, dim, onClick }: {
  m: Skill; slot?: number; tag?: { text: string; color: string }; selected?: boolean; dim?: boolean; onClick?: () => void;
}) {
  const style = CLASS_INFO[m.type], dtype = moveTag(m);
  const pill = (text: string, color: string) => (
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
        {m.self ? pill("Utility", "#c7b8ff") : <>{pill(`${style.icon} ${style.name}`, style.color)}{pill(`${dtype.icon} ${dtype.name}`, dtype.color)}</>}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {!m.self && <span style={{ fontSize: 13, color: MUTED }}>Damage <span style={{ ...NUM, fontSize: 17, color: "#ff9f7a" }}>{m.damage}</span></span>}
        <span style={{ fontSize: 13, color: MUTED }}>Energy <span style={{ ...NUM, fontSize: 17, color: "#7fc4ff" }}>{m.energyCost}</span></span>
        {m.cooldown && <span style={{ fontSize: 13, color: MUTED }}>Cooldown <span style={{ ...NUM, fontSize: 17 }}>{m.cooldown}</span></span>}
      </div>
      {m.desc && <div style={{ fontSize: 12, color: "#c9b48a", marginTop: 6, lineHeight: 1.4 }}>{m.desc}</div>}
    </button>
  );
}

export default function MoveSlots({ template, moves, born, learned, onChange, teaching }: {
  template: CreatureTemplate;
  moves?: string[];   // what's in its slots
  born?: string[];    // the moves it was born with (its roll)
  learned?: string[]; // moves learned from codexes
  onChange?: (moves: string[]) => void;
  teaching?: { move: string; onPick: (slot: number) => void; onCancel: () => void };
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [forget, setForget] = useState<number | null>(null); // teaching: the slot picked to forget, awaiting Confirm
  const current = resolveMoves(template, moves);
  const options = movesAvailableTo(template, learned, born).filter((m) => !current.some((c) => c.name === m.name));
  const fromCodex = new Set(learned ?? []);
  const groups: [string, Skill[], { text: string; color: string } | undefined][] = [
    ["Its other moves", options.filter((m) => !fromCodex.has(m.name)), undefined],
    ["Learned from a codex", options.filter((m) => fromCodex.has(m.name)), { text: "codex", color: "#c7b8ff" }],
  ];

  function choose(name: string) {
    if (editing === null) return;
    const next = current.map((m) => m.name);
    next[editing] = name;
    onChange?.(next);
    setEditing(null);
  }

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
              <span>Forget <b>{current[forget].name}</b> for <b>{teaching.move}</b>?</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="chip" onClick={() => { const i = forget; setForget(null); teaching.onPick(i); }}>✓ Confirm</button>
                <button className="chip" onClick={() => setForget(null)}>Back</button>
              </span>
            </>
          )}
        </div>
      )}
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 8, display: teaching ? "none" : undefined }}>
        {onChange ? (editing === null ? "Tap one of your moves to swap it out." : `Now pick a move below to put in slot ${editing + 1}.`) : "Its moves in battle."}
      </div>
      <div className="move-grid">
        {Array.from({ length: MOVE_SLOTS }, (_, i) => current[i]).map((m, i) => m ? (
          <MoveTile key={i} m={m} slot={i} selected={teaching ? forget === i : editing === i}
            onClick={teaching ? () => setForget(forget === i ? null : i) : onChange ? () => setEditing(editing === i ? null : i) : undefined} />
        ) : (
          <button key={i} disabled={!onChange} onClick={() => setEditing(editing === i ? null : i)}
            style={{ padding: 12, borderRadius: 10, border: `2px dashed ${editing === i ? "#ffd66e" : "#2a2d38"}`, background: "transparent", color: MUTED, cursor: "pointer" }}>
            Empty slot {i + 1}
          </button>
        ))}
      </div>

      {onChange && !teaching && groups.map(([title, list, tag]) => list.length > 0 && (
        <div key={title} style={{ marginTop: 16 }}>
          <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", marginBottom: 8 }}>{title}</div>
          <div className="move-grid">
            {list.map((m) => (
              <MoveTile key={m.name} m={m} tag={tag} dim={editing === null}
                onClick={() => (editing === null ? undefined : choose(m.name))} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
