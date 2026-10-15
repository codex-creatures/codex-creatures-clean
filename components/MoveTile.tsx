"use client";
// components/MoveTile.tsx
// A move as a stone tile (the dungeon look), for a 2×2 grid. The move's name
// is the main thing; its energy cost sits in a circle in the bottom-right,
// like a card's cost. The (i) in the corner flips the tile to the details:
// its style, damage type, power and what it does.

import { useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type Skill } from "@/lib/creatures/creatureData";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

export function MoveTile({ m, note, extra = [], selected, disabled, dim, slot, tag, onClick }: {
  m: Skill;
  note?: { text: string; color: string };   // one short line (e.g. "not enough energy")
  extra?: string[];        // more lines for the details side
  selected?: boolean; disabled?: boolean; dim?: boolean;
  slot?: number;           // its move slot (1–4 shown)
  tag?: { text: string; color: string };
  onClick?: () => void;
}) {
  const [info, setInfo] = useState(false);
  const style = CLASS_INFO[m.type], dtype = DAMAGE_TYPE_INFO[m.dmgType];
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", minHeight: 84, padding: "10px 12px 12px", cursor: active ? "pointer" : "default",
        background: selected ? "#33291a" : "#23262f",
        border: `3px solid ${selected ? "#c9a24a" : "#12131a"}`,
        boxShadow: `inset 3px 3px 0 ${selected ? "#5a4626" : "#3a3e4b"}, inset -3px -3px 0 #181a21, 0 4px 0 rgba(0,0,0,0.5)`,
        opacity: disabled ? 0.4 : dim ? 0.6 : 1, userSelect: "none",
      }}>
      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, cursor: "pointer",
          background: info ? "#5a3b1c" : "#1b1d25", border: "2px solid #4a4f5e", color: "#d8d4c8",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 12, lineHeight: 1, padding: 0,
        }}>i</button>

      {!info ? (
        <>
          <div className="pixel-font" style={{ fontSize: 18, color: m.effect ? "#ffd98a" : "#f1d9a0", paddingRight: 28, lineHeight: 1.15 }}>
            {slot !== undefined && <span style={{ opacity: 0.45, marginRight: 6, fontSize: 14 }}>{slot + 1}</span>}{m.name}
          </div>
          {tag && <div style={{ fontSize: 11, color: tag.color, marginTop: 3 }}>{tag.text}</div>}
          {note && <div style={{ fontSize: 12, color: note.color, marginTop: 4, paddingRight: 40 }}>{note.text}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#d8d4c8", paddingRight: 40 }}>
          <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", paddingRight: 0 }}>{m.name}</div>
          {m.self ? <div style={{ color: "#c7b8ff" }}>Utility — used on itself</div> : (
            <div>
              <span style={{ color: style.color }}>{style.icon} {style.name}</span> · <span style={{ color: dtype.color }}>{dtype.icon} {dtype.name}</span> · power {m.damage}
            </div>
          )}
          {m.cooldown ? <div>{m.cooldown}-round cooldown</div> : null}
          {m.desc && <div style={{ color: "#c9b48a" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#c9b48a" }}>{t}</div>)}
        </div>
      )}

      {/* The cost: energy, in a circle in the corner. */}
      <span title={`${m.energyCost} energy`} style={{
        ...NUM, position: "absolute", right: 7, bottom: 7, width: 34, height: 34, borderRadius: 17,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#e8f4ff",
        background: "radial-gradient(circle at 35% 30%, #4f9fe0, #1d4f86 70%)", border: "2px solid #0d2238",
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}>{m.energyCost}</span>
    </div>
  );
}
