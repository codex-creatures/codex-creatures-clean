"use client";
// components/MoveTile.tsx
// A move as a stone tile (the dungeon look), for a 2×2 grid: its name, the
// hit it does, and its energy cost. The (i) in the corner flips the tile to
// the details: style, damage type, power and what it does.

import { useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type Skill } from "@/lib/creatures/creatureData";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

export function MoveTile({ m, hit, hitLabel = "hit", hitColor = "#ff9f7a", note, extra = [], selected, disabled, dim, slot, tag, onClick }: {
  m: Skill;
  hit?: number | string;   // the damage it does (missing: utility)
  hitLabel?: string;
  hitColor?: string;
  note?: { text: string; color: string };   // one short line under the hit (e.g. "▲ strong vs Ranged")
  extra?: string[];        // more lines for the details side (battle tags)
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
        position: "relative", minHeight: 104, padding: "10px 12px", cursor: active ? "pointer" : "default",
        background: selected ? "#33291a" : "#23262f",
        border: `3px solid ${selected ? "#c9a24a" : "#12131a"}`,
        boxShadow: `inset 3px 3px 0 ${selected ? "#5a4626" : "#3a3e4b"}, inset -3px -3px 0 #181a21, 0 4px 0 rgba(0,0,0,0.5)`,
        opacity: disabled ? 0.4 : dim ? 0.6 : 1, userSelect: "none",
      }}>
      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 4, right: 4, width: 26, height: 26, borderRadius: 13, cursor: "pointer",
          background: info ? "#5a3b1c" : "#1b1d25", border: "2px solid #4a4f5e", color: "#d8d4c8",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 13, lineHeight: 1, padding: 0,
        }}>i</button>

      <div className="pixel-font" style={{ fontSize: 15, color: m.effect ? "#ffd98a" : "#f1d9a0", paddingRight: 26, lineHeight: 1.15 }}>
        {slot !== undefined && <span style={{ opacity: 0.5, marginRight: 6 }}>{slot + 1}</span>}{m.name}
      </div>
      {tag && <div style={{ fontSize: 11, color: tag.color, marginTop: 2 }}>{tag.text}</div>}

      {!info ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
            {m.self
              ? <span style={{ fontSize: 13, color: "#c7b8ff" }}>Utility</span>
              : <span><span style={{ ...NUM, fontSize: 26, color: hitColor }}>{hit ?? m.damage}</span> <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{hitLabel}</span></span>}
            <span style={{ ...NUM, fontSize: 16, color: "#7fc4ff", whiteSpace: "nowrap" }}>⚡ {m.energyCost}</span>
          </div>
          {note && <div style={{ fontSize: 12, color: note.color, marginTop: 4 }}>{note.text}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 6, color: "#d8d4c8" }}>
          {m.self ? <div style={{ color: "#c7b8ff" }}>Utility — used on itself</div> : (
            <div>
              <span style={{ color: style.color }}>{style.icon} {style.name}</span> · <span style={{ color: dtype.color }}>{dtype.icon} {dtype.name}</span> · power {m.damage}
            </div>
          )}
          <div>⚡ {m.energyCost} energy{m.cooldown ? ` · ${m.cooldown}-round cooldown` : ""}</div>
          {m.desc && <div style={{ color: "#c9b48a" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#c9b48a" }}>{t}</div>)}
        </div>
      )}
    </div>
  );
}
