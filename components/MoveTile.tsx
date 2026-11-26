"use client";
// components/MoveTile.tsx
// A move as an old, cracked stone tablet (lib/sprites/moveSlab.ts) in its
// race's colour (grey slate: a Balanced move, no race). Behind the name, big
// and in a darker shade of the stone, is its style: an impact (melee), an
// arrow (ranged), a bolt (magic). (Under the old rules: its style's stone,
// and its damage type's icon.) The name is large and bold over it. The energy cost sits in a circle in the
// bottom-right; the (i) opens the details (MoveDetails), in a window over the screen.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CLASS_INFO, isUtility, type Skill } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { moveTag } from "./ClassBadge";
import { moveSlab, SLAB_W, SLAB_H, SLAB_STONE, STYLE_ICON, STYLE_STONE, type SlabStone } from "@/lib/sprites/moveSlab";
import { raceOfMove } from "@/lib/combat/raceChart";
import { FILL_CORNER, FILL_DAMAGE_CAP, FILL_DAMAGE_CHARS, FILL_DAMAGE_INSET, FILL_NAME_CAP, MOVE_DETAILS, NAME_EM, NAME_INSET, NAME_MIN_PX, twoLineLongest } from "@/lib/uiText";

const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// The tablet's stone: its race's (Combat V2), or its style's under the old rules.
const stoneOf = (m: Skill): SlabStone => (damageTypesOn() ? STYLE_STONE[m.type] : raceOfMove(m) ?? "balanced");

// The stone, as crisp SVG pixels filling the tile.
function Slab({ m }: { m: Skill }) {
  const stone = stoneOf(m), icon = isUtility(m) ? undefined : damageTypesOn() ? m.dmgType : STYLE_ICON[m.type];
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
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
}

// The name's font: its usual size (base, on the name box), or smaller when the
// tablet is narrow, so its longest word fits the box's width (100cqw: the name
// box is a container) and no word is ever split. lib/uiText.ts checks it stays
// readable (NAME_MIN_PX) wherever tablets are shown; /lab/movetext measures it.
const nameFont = (name: string) => `min(1em, calc(100cqw / ${(Math.max(...name.split(" ").map((w) => w.length)) * NAME_EM).toFixed(2)}))`;

// On a fill tablet (lib/uiText.ts fillNameFont, the same sum): cqw/cqh are the tablet's own.
const FILL_BOX = `(100cqw - ${NAME_INSET.fill.left + NAME_INSET.fill.right}px)`;
const fillNameFont = (name: string) =>
  `max(${NAME_MIN_PX}px, min(${FILL_NAME_CAP * 100}cqh, max(calc(${FILL_BOX} / ${(name.length * NAME_EM).toFixed(2)}), min(calc(${FILL_BOX} / ${(twoLineLongest(name) * NAME_EM).toFixed(2)}), 16.667cqh))))`;
const FILL_DAMAGE_FONT = `min(${FILL_DAMAGE_CAP * 100}cqh, calc((100cqw - ${FILL_DAMAGE_INSET.left + FILL_DAMAGE_INSET.right}px) / ${(FILL_DAMAGE_CHARS * NAME_EM).toFixed(2)}))`;
const FILL_NOTE_FONT = `max(${NAME_MIN_PX}px, min(14cqh, calc((100cqw - ${FILL_DAMAGE_INSET.left + FILL_DAMAGE_INSET.right + 10}px) / ${(9 * NAME_EM).toFixed(2)})))`;

// Letters cut into the stone: thickened a pixel in their own colour, edged in the stone's cut.
const carved = (ink: string, cut: string) =>
  `1px 0 0 ${ink}, 2px 0 0 ${cut}, -1px 0 0 ${cut}, 0 -1px 0 ${cut}, 1px -1px 0 ${cut}, 0 2px 0 ${cut}, 1px 2px 0 ${cut}, 0 3px 0 rgba(0,0,0,0.35)`;

export function MoveTile({ m, note, extra = [], selected, disabled, dim, tag, fill, onClick }: {
  m: Skill;
  note?: { text: string; color: string };   // one short line (e.g. "not enough energy")
  extra?: string[];        // more lines for the details window
  selected?: boolean; disabled?: boolean; dim?: boolean;
  slot?: number;           // its move slot (not shown; kept for callers)
  tag?: { text: string; color: string };
  fill?: boolean;          // stretch to fill its grid cell (the battle dock), not the tablet's own shape
  onClick?: () => void;
}) {
  const [info, setInfo] = useState(false);
  const stone = SLAB_STONE[stoneOf(m)];
  const active = !!onClick && !disabled;
  const inset = NAME_INSET[fill ? "fill" : "tablet"];
  // (A fight's tablet's i and cost are smaller, so its name and damage can sit centred: FILL_CORNER.)
  const infoPx = fill ? FILL_CORNER.info : 22, cost = fill ? FILL_CORNER.cost : 28, at = fill ? FILL_CORNER.at : 5;
  const middle = fill && !note && !tag; // nothing under the name (a utility move): it sits in the tablet's middle
  return (
    <div role={onClick ? "button" : undefined} tabIndex={active ? 0 : -1} aria-disabled={disabled} aria-pressed={selected}
      aria-label={`${m.name}: ${CLASS_INFO[m.type].name}, ${moveTag(m).name}, ${m.energyCost} energy`}
      className={active ? "move-live" : undefined}
      onClick={() => active && onClick!()} onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick!(); } }}
      style={{
        position: "relative", ...(fill ? { height: "100%", minHeight: 0 } : { aspectRatio: `${SLAB_W} / ${SLAB_H}`, minHeight: 76 }), cursor: active ? "pointer" : "default", userSelect: "none",
        opacity: disabled ? 0.45 : dim ? 0.65 : 1,
        filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.55))",
        outline: selected ? "3px solid #ffd66e" : "none", outlineOffset: 1,
      }}>
      <Slab m={m} />

      <button type="button" aria-label="Show details" title="Details"
        onClick={(e) => { e.stopPropagation(); setInfo(true); }}
        style={{
          position: "absolute", top: at, right: at, width: infoPx, height: infoPx, borderRadius: infoPx / 2, cursor: "pointer", zIndex: 1,
          background: "rgba(15,12,10,0.55)", border: `2px solid ${stone.cut}`, color: "#eee4cc",
          fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: fill ? 9 : 11, lineHeight: 1, padding: 0,
        }}>i</button>

      {fill ? (
        // In a fight the words are the button's (the user, 2026-11-26): the name sits on the line a third
        // of the way down, filling the box's width (smaller only for a long name); the damage, or a note,
        // hangs from the line two thirds down, the same size on every tablet. (lib/uiText.ts fillNameFont)
        <div style={{ position: "absolute", inset: 0, containerType: "size", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, height: middle ? "100%" : "33.333%", left: inset.left, right: inset.right, display: "flex", alignItems: middle ? "center" : "flex-end", justifyContent: "center", textAlign: "center" }}>
            <span className="pixel-font" title={m.name} style={{
              fontSize: fillNameFont(m.name), lineHeight: 1, letterSpacing: "0.03em", textWrap: "balance",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              color: "#fbf1dc", textShadow: carved("#fbf1dc", stone.cut),
            }}>{m.name}</span>
          </div>
          <div style={{ position: "absolute", top: "66.667%", left: FILL_DAMAGE_INSET.left, right: FILL_DAMAGE_INSET.right, display: "flex", justifyContent: "center", visibility: note || tag ? "visible" : "hidden" }}>
            <span className="pixel-font" style={{ maxWidth: "100%", lineHeight: 1, letterSpacing: "0.03em", overflow: "hidden",
              // (A note, "not enough energy", is longer: smaller, on up to two lines.)
              ...(note ? { fontSize: FILL_NOTE_FONT, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "center", color: "#ffe1d8", background: "rgba(0,0,0,0.45)", padding: "1px 5px", textShadow: "0 1px 0 #000" }
                : { fontSize: FILL_DAMAGE_FONT, whiteSpace: "nowrap", color: tag?.color, textShadow: carved(tag?.color ?? "#fbf1dc", stone.cut) }) }}>
              {note?.text ?? tag?.text ?? "-"}
            </span>
          </div>
        </div>
      ) : (
      /* A fixed frame: the name in a box two lines tall (a one-line name sits
          in its middle), and under it one line for a tag or note, kept when
          empty. So no tablet's name moves whatever it says. (lib/uiText.ts NAME_INSET) */
      <div style={{ position: "absolute", inset: `0 ${inset.right}px 0 ${inset.left}px`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ position: "relative", width: "100%" }}>
        <div className="pixel-font" title={m.name} style={{
          containerType: "inline-size",
          fontSize: "clamp(16px, 5cqw, 22px)", lineHeight: 1.05, height: "2.1em", width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          color: "#fbf1dc", letterSpacing: "0.03em", textShadow: carved("#fbf1dc", stone.cut),
        }}>
          <span style={{ fontSize: nameFont(m.name), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.name}</span>
        </div>
        {/* The tag or note line: one line, under the name. */}
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 2, display: "flex", justifyContent: "center", visibility: note || tag ? "visible" : "hidden" }}>
          <span style={{ height: 15, maxWidth: "100%", fontSize: 11, lineHeight: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 0 #000",
            ...(note ? { color: "#ffe1d8", background: "rgba(0,0,0,0.45)", padding: "0 5px" } : { color: tag?.color }) }}>
            {note?.text ?? tag?.text ?? "-"}
          </span>
        </div>
        </div>
      </div>
      )}

      {/* The cost: energy, in a circle in the corner. */}
      <span title={`${m.energyCost} energy`} style={{
        ...NUM, position: "absolute", right: at, bottom: at + 1, width: cost, height: cost, borderRadius: cost / 2, zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: fill ? 11 : 12, color: "#e8f4ff",
        background: "radial-gradient(circle at 35% 30%, #4f9fe0, #1d4f86 70%)", border: "2px solid #0d2238",
        boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}>{m.energyCost}</span>

      {info && <MoveDetailsWindow m={m} extra={extra} onClose={() => setInfo(false)} />}
    </div>
  );
}

// The details behind the i: one fixed box (MOVE_DETAILS), whatever the move, the same in a
// fight, the creature window or the tour. Its text fits without scrolling: lib/uiText.ts
// keeps every description inside DESC_LINES lines, with EXTRA_LINES to spare for a fight's
// effect lines.
export function MoveDetails({ m, extra = [] }: { m: Skill; extra?: string[] }) {
  const style = CLASS_INFO[m.type], dtype = moveTag(m);
  const line: React.CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  return (
    <div className="inv-panel" data-move-details style={{ width: MOVE_DETAILS.w, height: MOVE_DETAILS.h, maxWidth: "100%", boxSizing: "border-box", padding: MOVE_DETAILS.pad,
      overflow: "hidden", display: "flex", flexDirection: "column", gap: 2, fontSize: MOVE_DETAILS.font, lineHeight: MOVE_DETAILS.lineHeight, color: "#eee4cc", textAlign: "left", cursor: "default" }}>
      <div className="pixel-font" style={{ ...line, fontSize: 18, color: "#f1d9a0", paddingRight: 40 }}>{m.name}</div>
      <div style={line}>{isUtility(m) ? <span style={{ color: "#d8ccff" }}>{m.self ? "Utility: used on itself" : "Utility"}</span> : <>{style.name} · {dtype.name} · power {m.damage}</>}</div>
      <div style={line}>⚡ {m.energyCost} energy<span style={{ visibility: m.cooldown ? "visible" : "hidden" }}> · {m.cooldown}-round cooldown</span></div>
      <div data-desc style={{ color: "#f0d9a4", marginTop: 6 }}>{m.desc ?? ""}</div>
      {extra.map((t) => <div key={t} style={{ color: "#f0d9a4" }}>{t}</div>)}
    </div>
  );
}

// …drawn over the whole game screen (GameScreen's .screen-scale), anchored near the top. A tap
// anywhere closes it, and goes no further (not to the tablet, nor Klutz's tour behind it).
function MoveDetailsWindow({ m, extra, onClose }: { m: Skill; extra: string[]; onClose: () => void }) {
  const [screen] = useState(() => (typeof document === "undefined" ? null : document.querySelector(".screen-scale")));
  const close = (e: React.SyntheticEvent) => { e.stopPropagation(); onClose(); };
  const panel = (
    <div role="dialog" aria-label={`${m.name}: details`} onClick={close}
      style={{ position: "absolute", inset: 0, zIndex: 500, background: "rgba(4,5,9,0.6)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "14cqh 8px 0", cursor: "pointer" }}>
      <div style={{ position: "relative", maxWidth: "100%" }}>
        <MoveDetails m={m} extra={extra} />
        <button type="button" aria-label="Close" onClick={close}
          style={{ position: "absolute", top: 2, right: 2, width: 44, height: 44, background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 20, cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
  return screen ? createPortal(panel, screen) : panel;
}
