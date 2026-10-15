"use client";
// components/MoveSlots.tsx
// A creature's 4 move slots. Tap a slot to swap in any move it can use
// (its own moves plus the learnable ones).

import { useState } from "react";
import { MOVE_SLOTS, movesAvailableTo, resolveMoves, type CreatureTemplate, type Skill } from "@/lib/creatures/creatureData";
import { moveKind } from "./ClassBadge";

const MUTED = "rgba(255,255,255,0.45)";

export function MoveInfo({ m }: { m: Skill }) {
  return (
    <>
      <span style={{ fontWeight: 600, color: m.effect ? "#ffd98a" : "white" }}>{m.name}</span>
      <span style={{ fontSize: 12, color: MUTED }}> · {m.self ? "utility" : `${moveKind(m)} · ${m.damage} dmg`} · {m.energyCost}⚡</span>
      {m.desc && <span style={{ display: "block", fontSize: 11, color: "#c9b48a", marginTop: 2 }}>{m.desc}</span>}
    </>
  );
}

export default function MoveSlots({ template, moves, learned, onChange }: {
  template: CreatureTemplate;
  moves?: string[];
  learned?: string[]; // race moves learned from codexes
  onChange?: (moves: string[]) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const current = resolveMoves(template, moves);
  const own = new Set(template.skills.map((s) => s.name));
  const options = movesAvailableTo(template, learned).filter((m) => !current.some((c) => c.name === m.name));

  function choose(name: string) {
    if (editing === null) return;
    const next = current.map((m) => m.name);
    next[editing] = name;
    onChange?.(next);
    setEditing(null);
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: MOVE_SLOTS }, (_, i) => current[i]).map((m, i) => (
          <button
            key={i}
            disabled={!onChange}
            onClick={() => setEditing(editing === i ? null : i)}
            style={{
              textAlign: "left", padding: "8px 10px", borderRadius: 8, color: "white",
              border: editing === i ? "1px solid #ffd66e" : "1px solid rgba(255,255,255,0.1)",
              background: editing === i ? "rgba(255,214,110,0.08)" : "rgba(255,255,255,0.03)",
              cursor: onChange ? "pointer" : "default",
            }}
          >
            <span style={{ fontSize: 11, color: MUTED, marginRight: 6 }}>{i + 1}</span>
            {m ? <MoveInfo m={m} /> : <span style={{ color: MUTED, fontStyle: "italic" }}>Empty</span>}
          </button>
        ))}
      </div>

      {editing !== null && (
        <div style={{ marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid rgba(255,214,110,0.3)", maxHeight: 260, overflowY: "auto" }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>Replace slot {editing + 1} with:</div>
          {options.map((m) => (
            <button key={m.name} onClick={() => choose(m.name)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", marginBottom: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "white", cursor: "pointer" }}>
              <MoveInfo m={m} />
              {!own.has(m.name) && <span style={{ fontSize: 11, color: m.race ? "#c7b8ff" : "#8fc1ff", marginLeft: 6 }}>{m.race ? "codex" : "learnable"}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
