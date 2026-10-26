"use client";
// components/MoveTile.tsx
// A move as an old, cracked stone tablet (lib/sprites/moveSlab.ts) in its
// race's colour (grey slate: a Balanced move, no race). Behind the name, big
// and in a darker shade of the stone, is its style: an impact (melee), an
// arrow (ranged), a bolt (magic). (Under the old rules: its style's stone,
// and its damage type's icon.) The name is large and bold over it. The energy cost sits in a circle in the
// bottom-right; the (i) flips the tablet to the details.

import { useMemo, useState } from "react";
import { CLASS_INFO, type Skill } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { moveTag } from "./ClassBadge";
import { moveSlab, SLAB_W, SLAB_H, SLAB_STONE, STYLE_ICON, STYLE_STONE, type SlabStone } from "@/lib/sprites/moveSlab";
import { raceOfMove } from "@/lib/combat/raceChart";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// The tablet's stone: its race's (Combat V2), or its style's under the old rules.
const stoneOf = (m: Skill): SlabStone => (damageTypesOn() ? STYLE_STONE[m.type] : raceOfMove(m) ?? "balanced");

// The stone, as crisp SVG pixels filling the tile.
function Slab({ m, faded }: { m: Skill; faded: boolean }) {
  const stone = stoneOf(m), icon = m.self ? undefined : damageTypesOn() ? m.dmgType : STYLE_ICON[m.type];
  const rects = useMemo(() => {
    const g = moveSlab(m.name, stone, icon);
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
  }, [m.name, stone, icon]);
  return (
    <svg viewBox={`0 0 ${SLAB_W} ${SLAB_H}`} preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", filter: faded ? "brightness(0.5) saturate(0.6)" : undefined }}>
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
}

export function MoveTile({ m, note, extra = [], selected, disabled, dim, tag, fill, onClick }: {
  m: Skill;
  note?: { text: string; color: string };   // one short line (e.g. "not enough energy")
  extra?: string[];        // more lines for the details side
  selected?: boolean; disabled?: boolean; dim?: boolean;
  slot?: number;           // its move slot (not shown; kept for callers)
  tag?: { text: string; color: string };
  fill?: boolean;          // stretch to fill its grid cell (the battle dock), not the tablet's own shape
  onClick?: () => void;
}) {
  const [info, setInfo] = useState(false);
  const style = CLASS_INFO[m.type], dtype = moveTag(m);
  const stone = SLAB_STONE[stoneOf(m)];
  const active = !!onClick && !disabled;
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${style.name}, ${dtype.name}, ${m.energyCost} energy`}
      className={active ? "move-live" : undefined}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", ...(fill ? { height: "100%", minHeight: 0 } : { aspectRatio: `${SLAB_W} / ${SLAB_H}`, minHeight: 76 }), cursor: active ? "pointer" : "default", userSelect: "none",
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
        // The name: large and bold, pale stone edged with the dark of the cut.
        <div style={{ position: "absolute", inset: "0 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div className="pixel-font" style={{
            fontSize: fill ? "clamp(13px, 4.6cqw, 20px)" : "clamp(18px, 5.4cqw, 23px)", lineHeight: 1.05, color: "#fbf1dc", letterSpacing: "0.03em",
            textShadow: `1px 0 0 #fbf1dc, 2px 0 0 ${stone.cut}, -1px 0 0 ${stone.cut}, 0 -1px 0 ${stone.cut}, 1px -1px 0 ${stone.cut}, 0 2px 0 ${stone.cut}, 1px 2px 0 ${stone.cut}, 0 3px 0 rgba(0,0,0,0.35)`,
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
