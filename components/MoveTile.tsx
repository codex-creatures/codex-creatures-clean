"use client";
// components/MoveTile.tsx
// A move as a stone slab, in the Den's look. Its name is in the middle.
// - Its style is the painted band down the left, with its weapon on it:
//   red with a sword (melee), green with a bow (ranged), blue with a staff
//   (magic).
// - How it hurts is under the name: Force (a blunt impact), Pierce (an
//   arrowhead) or Arcane (a magic spark).
// The energy cost sits in a circle in the bottom-right; the (i) flips the
// slab to the details (power, cooldown, what it does).

import { useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type CombatClass, type Skill } from "@/lib/creatures/creatureData";
import { STYLE_ICONS, DAMAGE_ICONS } from "@/lib/sprites/icons";
import PixelSprite from "./PixelSprite";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// Each style's colour on a move: red melee, green ranged, blue magic.
export const STYLE_COLOR: Record<CombatClass, string> = {
  melee: "#e8584a",
  ranged: "#4fbf62",
  magic: "#4f8fe8",
};

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
  const color = STYLE_COLOR[m.type];
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${style.name}, ${dtype.name}, ${m.energyCost} energy`}
      className={active ? "move-live" : undefined}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", minHeight: 84, padding: "10px 30px 10px 34px", cursor: active ? "pointer" : "default",
        background: selected ? "#33291a" : "#23262f",
        border: `3px solid ${selected ? "#c9a24a" : "#12131a"}`,
        boxShadow: `inset 3px 3px 0 ${selected ? "#5a4626" : "#3a3e4b"}, inset -3px -3px 0 #181a21, 0 4px 0 rgba(0,0,0,0.5)`,
        opacity: disabled ? 0.4 : dim ? 0.6 : 1, userSelect: "none",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center",
      }}>
      {/* The style: a painted band down the left edge, its weapon on it. */}
      <span title={style.name} style={{ position: "absolute", left: 3, top: 3, bottom: 3, width: 24, background: color,
        boxShadow: "inset -3px 0 0 rgba(0,0,0,0.35), inset 2px 0 0 rgba(255,255,255,0.2)",
        display: "flex", justifyContent: "center", paddingTop: 7 }}>
        <PixelSprite sprite={STYLE_ICONS[m.type]} scale={2} />
      </span>

      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: 12, cursor: "pointer",
          background: info ? "#5a3b1c" : "#1b1d25", border: "2px solid #4a4f5e", color: "#d8d4c8",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 12, lineHeight: 1, padding: 0,
        }}>i</button>

      {!info ? (
        <>
          <div className="pixel-font" style={{ fontSize: 17, lineHeight: 1.15, color: m.effect ? "#ffd98a" : "#f1d9a0", textShadow: "0 2px 0 rgba(0,0,0,0.6)" }}>
            {m.name}
          </div>
          {/* What kind of attack: its style and how it hurts. */}
          {m.self ? (
            <div style={{ fontSize: 12, color: "#c7b8ff", marginTop: 5 }}>✦ Utility</div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 13, color: dtype.color, whiteSpace: "nowrap" }}>
              <PixelSprite sprite={DAMAGE_ICONS[m.dmgType]} scale={2} />{dtype.name}
            </div>
          )}
          {tag && <div style={{ fontSize: 11, color: tag.color, marginTop: 3 }}>{tag.text}</div>}
          {note && <div style={{ fontSize: 12, color: note.color, marginTop: 3 }}>{note.text}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#d8d4c8", textAlign: "left", alignSelf: "stretch" }}>
          <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0" }}>{m.name}</div>
          {m.self ? <div style={{ color: "#c7b8ff" }}>Utility — used on itself</div> : (
            <div><span style={{ color }}>{style.name}</span> · <span style={{ color: dtype.color }}>{dtype.name}</span> · power {m.damage}</div>
          )}
          {m.cooldown ? <div>{m.cooldown}-round cooldown</div> : null}
          {m.desc && <div style={{ color: "#c9b48a" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#c9b48a" }}>{t}</div>)}
        </div>
      )}

      {/* The cost: energy, in a circle in the corner. */}
      <span title={`${m.energyCost} energy`} style={{
        ...NUM, position: "absolute", right: 6, bottom: 6, width: 30, height: 30, borderRadius: 15,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#e8f4ff",
        background: "radial-gradient(circle at 35% 30%, #4f9fe0, #1d4f86 70%)", border: "2px solid #0d2238",
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}>{m.energyCost}</span>
    </div>
  );
}
