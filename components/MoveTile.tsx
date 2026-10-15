"use client";
// components/MoveTile.tsx
// A move as an old, cracked stone tablet (lib/sprites/moveSlab.ts) in its
// style's stone: red for melee, green for ranged, blue for magic. Its name is
// chiselled into the middle, big and bold. How it hurts is a small carved
// icon in a socket in the bottom-left corner — an impact (Force), an
// arrowhead (Pierce), a bolt (Arcane) — like the type marker on a move
// button in other monster-battling games; the energy cost sits opposite, in
// a circle in the bottom-right. The (i) flips the tablet to the details.

import { useMemo, useState } from "react";
import { CLASS_INFO, DAMAGE_TYPE_INFO, type Skill } from "@/lib/creatures/creatureData";
import { moveSlab, SLAB_W, SLAB_H, SLAB_STONE, DAMAGE_ICONS } from "@/lib/sprites/moveSlab";
import PixelSprite from "./PixelSprite";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// The stone, as crisp SVG pixels filling the tile.
function Slab({ m, faded }: { m: Skill; faded: boolean }) {
  const rects = useMemo(() => {
    const g = moveSlab(m.name, m.type);
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
  }, [m.name, m.type]);
  return (
    <svg viewBox={`0 0 ${SLAB_W} ${SLAB_H}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: faded ? "brightness(0.5) saturate(0.6)" : undefined }}>
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
  const stone = SLAB_STONE[m.type];
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${style.name}, ${dtype.name}, ${m.energyCost} energy`}
      className={active ? "move-live" : undefined}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", aspectRatio: `${SLAB_W} / ${SLAB_H}`, minHeight: 76, cursor: active ? "pointer" : "default", userSelect: "none",
        opacity: disabled ? 0.45 : dim ? 0.65 : 1,
        filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.55))",
        outline: selected ? "3px solid #ffd66e" : "none", outlineOffset: 1,
      }}>
      <Slab m={m} faded={info} />

      <button type="button" aria-label={info ? "Hide details" : "Show details"} title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
        style={{
          position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 11, cursor: "pointer", zIndex: 1,
          background: info ? "#5a3b1c" : "rgba(15,12,10,0.55)", border: `2px solid ${stone.cut}`, color: "#eee4cc",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 11, lineHeight: 1, padding: 0,
        }}>i</button>

      {!info ? (
        // The name, chiselled in: dark cut letters, a dark edge above, a lit lip below.
        <div style={{ position: "absolute", inset: "0 26px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 6 }}>
          <div className="pixel-font" style={{
            fontSize: "clamp(15px, 4.4vw, 19px)", lineHeight: 1.05, color: stone.cut, letterSpacing: "0.02em",
            textShadow: `1px 0 0 ${stone.cut}, 0 -1px 0 rgba(0,0,0,0.45), 0 1px 0 ${stone.lip}, 1px 1px 0 ${stone.lip}`,
          }}>
            {m.name}
          </div>
          {tag && <div style={{ fontSize: 10, color: tag.color, textShadow: "0 1px 0 #000" }}>{tag.text}</div>}
          {note && <div style={{ fontSize: 11, marginTop: 2, color: "#ffe1d8", background: "rgba(0,0,0,0.45)", padding: "0 5px" }}>{note.text}</div>}
        </div>
      ) : (
        <div style={{ position: "absolute", inset: "6px 30px 6px 8px", overflowY: "auto", fontSize: 11, lineHeight: 1.4, color: "#eee4cc", textShadow: "0 1px 0 #000" }}>
          <div className="pixel-font" style={{ fontSize: 13, color: "#f4e6c4" }}>{m.name}</div>
          {m.self ? <div style={{ color: "#d8ccff" }}>Utility — used on itself</div> : (
            <div>{style.name} · {dtype.name} · power {m.damage}</div>
          )}
          {m.cooldown ? <div>{m.cooldown}-round cooldown</div> : null}
          {m.desc && <div style={{ color: "#f0d9a4" }}>{m.desc}</div>}
          {extra.map((t) => <div key={t} style={{ color: "#f0d9a4" }}>{t}</div>)}
        </div>
      )}

      {/* How it hurts: a carved icon in a socket, bottom-left. */}
      {!info && (
        <span title={m.self ? "Utility" : dtype.name} style={{
          position: "absolute", left: 6, bottom: 7, width: 26, height: 26, borderRadius: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `radial-gradient(circle at 50% 60%, ${stone.cut}cc, ${stone.cut})`,
          boxShadow: `inset 0 2px 3px rgba(0,0,0,0.7), 0 1px 0 ${stone.lip}`,
        }}>
          {m.self ? <span style={{ color: "#eee4cc", fontSize: 13 }}>✦</span> : <PixelSprite sprite={DAMAGE_ICONS[m.dmgType]} scale={1.8} />}
        </span>
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
