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
export const RUNE_COLOR: Record<CombatClass, { glow: string; text: string; stone: [string, string, string] }> = {
  // stone: [lit edge, face, deep shadow]
  melee:  { glow: "#ff4a3d", text: "#ffb3a8", stone: ["#7a3a34", "#4a2421", "#24110f"] },
  ranged: { glow: "#3fd66b", text: "#a8f5b9", stone: ["#3c6e47", "#24452c", "#112216"] },
  magic:  { glow: "#4f9dff", text: "#b0d2ff", stone: ["#3a5680", "#22344f", "#101a28"] },
};

// The faint glyph behind a move's name.
function Glyph({ type, color }: { type: DamageType; color: string }) {
  const common = { fill: "none", stroke: color, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden className="rune-glyph"
      style={{ position: "absolute", inset: "8% 6%", width: "88%", height: "84%", color, filter: `drop-shadow(0 0 4px ${color})` }}>
      {type === "force" && (
        // A hadouken-style ball of force flying left to right, its trail streaming behind.
        <g {...common}>
          <circle cx="70" cy="30" r="10" fill={color} fillOpacity="0.6" stroke="none" />
          <circle cx="70" cy="30" r="16" strokeWidth="3" />
          <path d="M54 18 Q30 14 6 20 M50 30 H2 M54 42 Q30 46 6 40" strokeWidth="3" />
        </g>
      )}
      {type === "pierce" && (
        // An arrow flying left to right, with speed lines behind.
        <g {...common} strokeWidth="3">
          <path d="M10 30 H86" />
          <path d="M86 30 L74 22 M86 30 L74 38" strokeWidth="4" />
          <path d="M10 30 L4 22 M10 30 L4 38 M18 30 L12 22 M18 30 L12 38" />
          <path d="M26 16 H52 M30 44 H56" strokeWidth="2" strokeDasharray="5 4" />
        </g>
      )}
      {type === "arcane" && (
        // A bolt crackling left to right.
        <g {...common}>
          <path d="M4 26 L34 20 L30 30 L62 22 L58 32 L96 28 L60 38 L64 30 L32 38 L36 30 Z" fill={color} fillOpacity="0.5" strokeWidth="2" />
          <path d="M20 12 l5 4 M48 10 l3 5 M70 46 l4 5 M40 48 l-3 5" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

export function MoveTile({ m, note, extra = [], selected, disabled, dim, tag, onClick }: {
  m: Skill;
  note?: { text: string; color: string };   // one short line (e.g. "not enough energy")
  extra?: string[];        // more lines for the details side
  selected?: boolean; disabled?: boolean; dim?: boolean;
  slot?: number;           // its move slot (not shown; kept for callers)
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
        // A block of coloured stone: chiselled edges (lit top-left, shadowed
        // bottom-right), a rough face, a faint glow from the rune.
        background: `radial-gradient(ellipse at 50% 50%, ${rune.glow}26, transparent 65%),
          repeating-linear-gradient(115deg, rgba(0,0,0,0.10) 0 2px, transparent 2px 7px),
          repeating-linear-gradient(25deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 9px),
          linear-gradient(160deg, ${rune.stone[1]}, ${rune.stone[2]})`,
        border: `3px solid ${selected ? "#ffd66e" : "#0b0c10"}`,
        boxShadow: `inset 3px 3px 0 ${rune.stone[0]}, inset -3px -3px 0 ${rune.stone[2]}, inset 0 0 14px rgba(0,0,0,0.55), 0 4px 0 rgba(0,0,0,0.55)${selected ? ", 0 0 14px rgba(255,214,110,0.6)" : ""}`,
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

      {!info ? (
        <div style={{ position: "relative", padding: "0 26px" }}>
          {/* The name, carved: a dark cut above, the rune's glow inside. */}
          <div className="pixel-font" style={{
            fontSize: 18, lineHeight: 1.15, color: rune.text,
            textShadow: `0 -2px 0 rgba(0,0,0,0.85), 0 1px 0 ${rune.stone[0]}, 0 0 8px ${rune.glow}aa`,
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
