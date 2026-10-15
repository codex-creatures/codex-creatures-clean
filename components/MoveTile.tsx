"use client";
// components/MoveTile.tsx
// A move as a rune tablet sunk into the stone, for a 2×2 grid. The move's
// name is carved in the middle, glowing in its style's colour: red for
// melee, green for ranged, blue for magic. Behind it, faintly, a glyph for
// how it hurts: a swirling energy ball for Force, an arrow for Pierce, a
// bolt for Arcane. The energy cost sits in a circle in the bottom-right; the
// (i) flips the tablet to the details (style, damage type, power, effect).

import { useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type CombatClass, type DamageType, type Skill } from "@/lib/creatures/creatureData";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// The rune glow for each style: the carved name and the glyph behind it.
export const RUNE_COLOR: Record<CombatClass, { glow: string; text: string }> = {
  melee:  { glow: "#ff4a3d", text: "#ffd2cb" },
  ranged: { glow: "#3fd66b", text: "#d0ffd9" },
  magic:  { glow: "#4f9dff", text: "#d4e7ff" },
};

// The faint glyph behind a move's name.
function Glyph({ type, color }: { type: DamageType; color: string }) {
  const common = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden className="rune-glyph"
      style={{ position: "absolute", inset: "8% 6%", width: "88%", height: "84%", color, filter: `drop-shadow(0 0 4px ${color})` }}>
      {type === "force" && (
        // A hadouken-style ball of force, rings rippling out, streaking in from the left.
        <g {...common}>
          <circle cx="62" cy="30" r="9" fill={color} fillOpacity="0.55" stroke="none" />
          <circle cx="62" cy="30" r="15" strokeWidth="3" />
          <circle cx="62" cy="30" r="22" strokeWidth="2" strokeDasharray="6 5" />
          <path d="M8 22 H34 M4 30 H38 M10 38 H34" strokeWidth="3" />
        </g>
      )}
      {type === "pierce" && (
        // An arrow punching through, with speed lines behind.
        <g {...common} strokeWidth="3">
          <path d="M14 46 L80 14" />
          <path d="M80 14 L66 15 M80 14 L74 26" strokeWidth="4" />
          <path d="M14 46 L10 36 M14 46 L4 46 M20 43 L16 33 M20 43 L10 43" />
          <path d="M30 52 L48 43 M40 55 L54 48" strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}
      {type === "arcane" && (
        // A crackling bolt.
        <g {...common}>
          <path d="M58 2 L36 32 H52 L40 58 L68 24 H52 L64 2 Z" fill={color} fillOpacity="0.45" strokeWidth="2.5" />
          <path d="M26 16 l-6 4 M76 40 l7 3 M72 10 l6 -3 M22 46 l-7 3" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

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
  const rune = RUNE_COLOR[m.type];
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${style.name}, ${dtype.name}, ${m.energyCost} energy`}
      className={`rune-tile${active ? " rune-live" : ""}`}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", minHeight: 84, padding: "10px 12px", cursor: active ? "pointer" : "default", overflow: "hidden",
        // Sunk into the stone: dark at the top where the light can't reach, a lit lip below.
        background: `radial-gradient(ellipse at 50% 55%, ${rune.glow}22, transparent 70%), linear-gradient(180deg, #121319, #1d1f27 55%, #23262f)`,
        border: `3px solid ${selected ? "#c9a24a" : "#0b0c10"}`,
        boxShadow: `inset 0 5px 10px rgba(0,0,0,0.75), inset 0 -2px 0 rgba(255,255,255,0.07), inset 0 0 0 1px ${rune.glow}33, 0 2px 0 #3a3e4b, 0 4px 0 rgba(0,0,0,0.5)${selected ? ", 0 0 12px rgba(255,214,110,0.5)" : ""}`,
        opacity: disabled ? 0.4 : dim ? 0.6 : 1, userSelect: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
      {!info && <Glyph type={m.dmgType} color={rune.glow} />}

      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, cursor: "pointer", zIndex: 1,
          background: info ? "#5a3b1c" : "#1b1d25", border: "2px solid #4a4f5e", color: "#d8d4c8",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 12, lineHeight: 1, padding: 0,
        }}>i</button>
      {slot !== undefined && <span className="pixel-font" style={{ position: "absolute", top: 6, left: 8, fontSize: 12, color: rune.text, opacity: 0.45 }}>{slot + 1}</span>}

      {!info ? (
        <div style={{ position: "relative", padding: "0 26px" }}>
          {/* The name, carved: a dark cut above, the rune's glow inside. */}
          <div className="pixel-font" style={{
            fontSize: 18, lineHeight: 1.15, color: rune.text,
            textShadow: `0 -1px 0 rgba(0,0,0,0.9), 0 0 6px ${rune.glow}, 0 0 14px ${rune.glow}88`,
          }}>
            {m.name}
          </div>
          {tag && <div style={{ fontSize: 11, color: tag.color, marginTop: 3 }}>{tag.text}</div>}
          {note && <div style={{ fontSize: 12, color: note.color, marginTop: 4 }}>{note.text}</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#d8d4c8", padding: "0 30px 0 0", textAlign: "left", alignSelf: "stretch" }}>
          <div className="pixel-font" style={{ fontSize: 14, color: rune.text }}>{m.name}</div>
          {m.self ? <div style={{ color: "#c7b8ff" }}>Utility — used on itself</div> : (
            <div>
              <span style={{ color: rune.glow }}>{style.icon} {style.name}</span> · <span style={{ color: dtype.color }}>{dtype.icon} {dtype.name}</span> · power {m.damage}
            </div>
          )}
          {m.cooldown ? <div>{m.cooldown}-round cooldown</div> : null}
          {m.desc && <div style={{ color: "#c9b48a" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#c9b48a" }}>{t}</div>)}
        </div>
      )}

      {/* The cost: energy, in a circle in the corner. */}
      <span title={`${m.energyCost} energy`} style={{
        ...NUM, position: "absolute", right: 6, bottom: 6, width: 30, height: 30, borderRadius: 15, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#e8f4ff",
        background: "radial-gradient(circle at 35% 30%, #4f9fe0, #1d4f86 70%)", border: "2px solid #0d2238",
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}>{m.energyCost}</span>
    </div>
  );
}
