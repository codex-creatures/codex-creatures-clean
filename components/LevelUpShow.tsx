"use client";
// components/LevelUpShow.tsx
// After a fight, each creature that levelled up gets a little show:
// 1. "<name> levelled up!" pops in, with the creature;
// 2. its level bar fills from the old level to the new one (one fill a level);
// 3. its stats (HP and its %s, before gear) count up from what they were,
//    each with a green +N beside it.
// Tap to skip ahead; Next / Continue goes on to the next creature.

import { useEffect, useState } from "react";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { useEscape } from "@/hooks/useEscape";
import { STATS } from "./CreatureDetailModal";
import { hpAt, proficiencyAt } from "@/lib/creatures/levels";
import type { CreatureProficiency, CreatureTemplate } from "@/lib/creatures/creatureData";

export type LevelUpInfo = { id: string; name: string; creatureId?: string; template: CreatureTemplate; rolled?: CreatureProficiency; from: number; to: number };

const MUTED = "rgba(255,255,255,0.55)";
const GOLD = "#f1d9a0";
const GREEN = "#7CFC9A";
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };

// When each part starts and how long it takes (ms).
const INTRO = 700;
const PER_LEVEL = 650;
const STATS_IN = 400;   // pause before the numbers start climbing
const COUNT = 1300;

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export default function LevelUpShow({ ups, onDone }: { ups: LevelUpInfo[]; onDone: () => void }) {
  const [n, setN] = useState(0);
  const [t, setT] = useState(0);      // ms into this creature's show
  const u = ups[n];
  const levels = u ? u.to - u.from : 0;
  const barEnd = INTRO + PER_LEVEL * levels;
  const end = barEnd + STATS_IN + COUNT;

  useEffect(() => {
    if (!u) return;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = reduced ? end : now - start; // (reduced motion: straight to the end)
      setT(e);
      if (e < end) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, u, end]);

  const done = t >= end;
  const next = () => { if (!done) { setT(end); return; } if (n + 1 < ups.length) { setN(n + 1); setT(0); } else onDone(); };
  useEscape(next); // Esc works like a tap: skip, then Next

  if (!u) return null;

  // The bar: which level it's filling towards, and how full.
  const barT = Math.max(0, t - INTRO);
  const step = Math.min(levels, Math.floor(barT / PER_LEVEL));
  const shownLevel = u.from + step;
  const fill = shownLevel >= u.to ? 1 : ease((barT % PER_LEVEL) / PER_LEVEL);
  // The right end shows the level it's filling towards from the start (dim), lit once reached.
  const target = Math.min(u.to, shownLevel + 1);
  const reached = shownLevel >= target;
  // The stats, from the old level's to the new one's.
  const k = ease((t - barEnd - STATS_IN) / COUNT);
  const showStats = t >= barEnd;
  const before = proficiencyAt(u.template, u.rolled, u.from), after = proficiencyAt(u.template, u.rolled, u.to);
  const rows = STATS.map((s) => {
    const a = s.key === "hp" ? hpAt(u.template, u.from) : before[s.key as keyof CreatureProficiency];
    const b = s.key === "hp" ? hpAt(u.template, u.to) : after[s.key as keyof CreatureProficiency];
    return { ...s, a, b, now: Math.round(a + (b - a) * k) };
  }).filter((r) => r.key === "hp" || r.a !== 0 || r.b !== 0);

  return (
    <div onClick={next} style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(4,5,9,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div role="dialog" aria-label={`${u.name} levelled up`} className="stone-panel levelup-pop"
        style={{ width: "100%", maxWidth: 400, maxHeight: "92cqh", overflowY: "auto", padding: 14, display: "grid", gap: 10, textAlign: "center" }}>
        <div className="pixel-font levelup-title" style={{ fontSize: 20, color: GOLD }}>{u.name} levelled up!</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className={done ? undefined : "levelup-hop"}>
            <PixelSprite sprite={creatureSprite(u.creatureId)} scale={3} style={{ width: "auto", height: "auto", maxWidth: "min(120px, 30cqw)", maxHeight: 110, filter: "drop-shadow(0 0 10px rgba(255,214,110,0.55)) drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
          </div>
        </div>

        {/* The level bar: old level → new level. */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
          <span className="pixel-font" style={{ fontSize: 14, color: MUTED }}>Lv {u.from}</span>
          <div style={{ position: "relative", height: 14, background: "#0e0f14", border: "2px solid #2a2d38" }}>
            <div style={{ position: "absolute", inset: 0, width: `${fill * 100}%`, background: "linear-gradient(#ffe39a, #d9a23a)" }} />
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0 9px, rgba(0,0,0,0.35) 9px 10px)" }} />
          </div>
          <span key={shownLevel} className={`pixel-font${reached ? " levelup-bump" : ""}`} style={{ fontSize: 16, color: reached ? GOLD : MUTED, minWidth: 44, textAlign: "right" }}>Lv {target}</span>
        </div>

        {/* What it gained. */}
        {showStats && (
          <div className="levelup-stats" style={{ display: "grid", gap: 4, textAlign: "left", padding: "8px 10px", background: "rgba(0,0,0,0.3)", border: "2px solid #2a2d38" }}>
            {rows.map((r) => {
              const pct = r.key === "hp" ? "" : "%";
              const gain = r.b - r.a;
              return (
                <div key={r.key} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto 52px", alignItems: "center", gap: 6, fontSize: 14 }}>
                  <span style={{ textAlign: "center" }}>{r.icon}</span>
                  <span>{r.label}</span>
                  <span style={{ ...NUM, fontSize: 16, color: k >= 1 && gain > 0 ? GREEN : "white" }}>{r.now}{pct}</span>
                  <span style={{ ...NUM, fontSize: 13, color: GREEN, textAlign: "right", opacity: gain > 0 ? Math.min(1, k * 2) : 0 }}>+{gain}{pct}</span>
                </div>
              );
            })}
          </div>
        )}

        <button className="pixel-btn" onClick={(e) => { e.stopPropagation(); next(); }} style={{ justifySelf: "center", visibility: done ? "visible" : "hidden" }}>
          {n + 1 < ups.length ? "Next" : "Continue"}
        </button>
        {ups.length > 1 && <div style={{ fontSize: 11, color: MUTED }}>{n + 1} / {ups.length}</div>}
      </div>
    </div>
  );
}
