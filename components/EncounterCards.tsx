"use client";
// components/EncounterCards.tsx
// Cards fanned out to flick through: the front one straight and the rest
// fanned behind. Flick with the arrows, ← →, a swipe, or a tap on a card
// behind; "Got it" (or Esc) puts them away. CardFan is the shared viewer
// (also for the cards you got on a run — see CardStack); EncounterCards is
// the tutorial's use of it: when you walk into a fight (until you've beaten
// the Cyclops), the creatures waiting there come up as cards showing their
// base % stats, race and class.

import { useEffect, useRef, useState } from "react";
import { CLASS_INFO, findCreatureTemplate, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import RaceTag from "./RaceTag";
import ClassBadge from "./ClassBadge";

const MUTED = "rgba(255,255,255,0.55)";
const STATS: [keyof CreatureProficiency, string, string][] = [
  ["atk", "⚔️", "Melee"], ["rng", "🏹", "Ranged"], ["mag", "🔮", "Magic"], ["agil", "💨", "Agility"],
  ["mdef", "🛡️", "M.Def"], ["rdef", "🔰", "R.Def"], ["magdef", "🧿", "Mg.Def"],
];

export default function EncounterCards({ creatureIds, onClose }: { creatureIds: string[]; onClose: () => void }) {
  const n = creatureIds.length;
  return (
    <CardFan count={n} label="The creatures you're about to fight" onClose={onClose}
      title={n === 1 ? "A creature blocks the way" : `${n} creatures block the way`}
      size={{ width: "min(300px, 78vw)", height: "min(440px, 66vh)" }}
      render={(i) => <Card creatureId={creatureIds[i]} />} />
  );
}

// The viewer: count cards, drawn by render(i), in a box of the given size.
export function CardFan({ count: n, title, label, size, render, onClose }: {
  count: number; title: string; label: string; size: { width: string; height: string };
  render: (i: number) => React.ReactNode; onClose: () => void;
}) {
  const [at, setAt] = useState(0);
  const step = (d: number) => setAt((i) => (i + d + n) % n);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); } // (so it doesn't also go back a page)
      if (e.key === "ArrowLeft") setAt((i) => (i - 1 + n) % n);
      if (e.key === "ArrowRight") setAt((i) => (i + 1) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, onClose]);

  return (
    <div role="dialog" aria-label={label}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = touchX.current === null ? 0 : e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,5,9,0.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="pixel-font" style={{ fontSize: "clamp(15px, 4vw, 19px)", color: "#f1d9a0", textShadow: "0 2px 0 #000", marginBottom: 14, textAlign: "center" }}>
        {title}
      </div>

      {/* The stack */}
      <div style={{ position: "relative", ...size }}>
        {Array.from({ length: n }, (_, i) => {
          // How far behind the front card this one sits (−1 just left, +1 just right).
          let k = i - at;
          if (k > n / 2) k -= n;
          if (k < -n / 2) k += n;
          return (
            <div key={i} className="encounter-card" onClick={() => k !== 0 && setAt(i)}
              style={{
                position: "absolute", inset: 0, zIndex: 10 - Math.abs(k), cursor: k === 0 ? "default" : "pointer",
                transform: k === 0 ? "none" : `translateX(${k * 34}px) translateY(${Math.abs(k) * 10}px) rotate(${k * 5}deg) scale(0.92)`,
                filter: k === 0 ? "none" : "brightness(0.55)",
              }}>
              {render(i)}
            </div>
          );
        })}
      </div>

      {/* Arrows, which card, and done */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
        {n > 1 && <button className="chip" aria-label="Previous card" onClick={() => step(-1)} style={{ fontSize: 20, padding: "4px 14px" }}>‹</button>}
        {n > 1 && <span className="pixel-font" style={{ fontSize: 13, color: MUTED }}>{at + 1} / {n}</span>}
        {n > 1 && <button className="chip" aria-label="Next card" onClick={() => step(1)} style={{ fontSize: 20, padding: "4px 14px" }}>›</button>}
      </div>
      <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onClose}>Got it</button>
    </div>
  );
}

function Card({ creatureId }: { creatureId: string }) {
  const t = findCreatureTemplate(creatureId);
  if (!t) return null;
  const c = RARITY_COLORS[t.rarity];
  const cls = CLASS_INFO[t.cls];
  const weakTo = (Object.keys(CLASS_INFO) as (keyof typeof CLASS_INFO)[]).find((k) => CLASS_INFO[k].beats === t.cls);
  return (
    <div className="stone-panel" style={{
      height: "100%", display: "flex", flexDirection: "column", padding: 14, overflow: "hidden",
      borderColor: "#12131a", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${c.border}, 0 0 30px ${c.glow}, 0 10px 24px rgba(0,0,0,0.6)`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="pixel-font" style={{ fontSize: 18, color: c.text, lineHeight: 1.1 }}>{t.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: c.text, border: `1px solid ${c.border}`, padding: "1px 6px" }}>{t.rarity}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        <RaceTag race={t.race} />
        <ClassBadge cls={t.cls} />
      </div>

      {/* The creature */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", margin: "6px 0" }}>
        <div style={{ position: "absolute", inset: "8% 12%", background: `radial-gradient(circle, ${c.glow}, transparent 70%)` }} />
        <PixelSprite sprite={creatureSprite(creatureId)} scale={2.2} title={t.name} style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      </div>

      {/* Base stats */}
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>Base stats · ❤️ {t.baseHp} HP</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, textAlign: "center" }}>
        {STATS.map(([k, icon, label]) => (
          <div key={k} title={label} style={{ background: "#12131a", padding: "4px 0" }}>
            <div style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{icon} {label}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>+{t.proficiency[k]}%</div>
          </div>
        ))}
      </div>

      {/* The class triangle, for this creature */}
      <div style={{ fontSize: 11, color: "#d8d4c8", marginTop: 8, lineHeight: 1.35 }}>
        <span style={{ color: cls.color }}>{cls.icon} {cls.name}</span>: strong against {CLASS_INFO[cls.beats].icon} {CLASS_INFO[cls.beats].name},
        weak to {weakTo && <>{CLASS_INFO[weakTo].icon} {CLASS_INFO[weakTo].name}</>}.
      </div>
    </div>
  );
}
