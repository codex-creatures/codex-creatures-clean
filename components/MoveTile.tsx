"use client";
// components/MoveTile.tsx
// A move as an old, cracked dungeon floor stone (lib/sprites/moveSlab.ts),
// with a design carved across it for how the move hurts — an arrowhead
// sailing through the air (Pierce), a palm strike (Force), a bolt with an
// orb at its tip (Arcane) — its groove tinted with the move's style: red
// melee, green ranged, blue magic. The name sits across the top; the energy
// cost in a circle in the bottom-right; the (i) flips the stone to the
// details (style, damage type, power, what it does).

import { useMemo, useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type Skill } from "@/lib/creatures/creatureData";
import { moveSlab, SLAB_W, SLAB_H } from "@/lib/sprites/moveSlab";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// The stone, as crisp SVG pixels filling the tile.
function Slab({ m, faded }: { m: Skill; faded: boolean }) {
  const rects = useMemo(() => {
    const g = moveSlab(m.name, m.dmgType, m.type);
    const out: [number, number, number, string][] = [];
    g.forEach((row, y) => {
      for (let x = 0; x < row.length;) {
        let n = 1;
        while (row[x + n] === row[x]) n++;
        if (row[x]) out.push([x, y, n, row[x]]);
        x += n;
      }
    });
    return out;
  }, [m.name, m.dmgType, m.type]);
  return (
    <svg viewBox={`0 0 ${SLAB_W} ${SLAB_H}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: faded ? "brightness(0.55) saturate(0.4)" : undefined }}>
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
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
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${style.name}, ${dtype.name}, ${m.energyCost} energy`}
      className={active ? "move-live" : undefined}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", aspectRatio: `${SLAB_W} / ${SLAB_H}`, cursor: active ? "pointer" : "default", userSelect: "none",
        opacity: disabled ? 0.45 : dim ? 0.65 : 1,
        filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.55))",
        outline: selected ? "3px solid #ffd66e" : "none", outlineOffset: 1,
      }}>
      <Slab m={m} faded={info} />

      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, cursor: "pointer", zIndex: 1,
          background: info ? "#5a3b1c" : "rgba(20,18,15,0.75)", border: "2px solid #6e675c", color: "#e8e0cc",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 11, lineHeight: 1, padding: 0,
        }}>i</button>

      {!info ? (
        // The name, across the top.
        <div style={{ position: "absolute", left: 6, right: 28, top: "7%", textAlign: "center" }}>
          <div className="pixel-font" style={{ fontSize: "clamp(12px, 3.6vw, 16px)", lineHeight: 1.1, color: m.effect ? "#ffe3a0" : "#f4e6c4", textShadow: "0 2px 0 #1a1714, 0 0 4px #1a1714, 1px 0 0 #1a1714, -1px 0 0 #1a1714" }}>
            {m.name}
          </div>
          {tag && <div style={{ fontSize: 10, color: tag.color, textShadow: "0 1px 0 #000" }}>{tag.text}</div>}
          {note && <div style={{ fontSize: 11, color: note.color, textShadow: "0 1px 0 #000, 0 0 3px #000" }}>{note.text}</div>}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: "6px 30px 6px 8px", overflowY: "auto", fontSize: 11, lineHeight: 1.4, color: "#e8e0cc", textShadow: "0 1px 0 #000" }}>
          <div className="pixel-font" style={{ fontSize: 13, color: "#f4e6c4" }}>{m.name}</div>
          {m.self ? <div style={{ color: "#c7b8ff" }}>Utility — used on itself</div> : (
            <div>{style.name} · {dtype.name} · power {m.damage}</div>
          )}
          {m.cooldown ? <div>{m.cooldown}-round cooldown</div> : null}
          {m.desc && <div style={{ color: "#e2cc9a" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#e2cc9a" }}>{t}</div>)}
        </div>
      )}

      {/* The cost: energy, in a circle in the corner. */}
      <span title={`${m.energyCost} energy`} style={{
        ...NUM, position: "absolute", right: 5, bottom: 6, width: 28, height: 28, borderRadius: 14, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#e8f4ff",
        background: "radial-gradient(circle at 35% 30%, #4f9fe0, #1d4f86 70%)", border: "2px solid #0d2238",
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}>{m.energyCost}</span>
    </div>
  );
}
