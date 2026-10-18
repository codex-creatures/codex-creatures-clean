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
import { CardBody, CARD_WELL, CARD_YELLOW } from "./CardGallery";

const MUTED = "rgba(255,255,255,0.55)";
const ATTACKS: [keyof CreatureProficiency, string][] = [["atk", "Melee"], ["rng", "Ranged"], ["mag", "Magic"]];
const DEFENCES: [keyof CreatureProficiency, string][] = [["mdef", "Melee def"], ["rdef", "Ranged def"], ["magdef", "Magic def"]];

export default function EncounterCards({ creatureIds, onClose }: { creatureIds: string[]; onClose: () => void }) {
  const n = creatureIds.length;
  return (
    <CardFan count={n} label="The creatures you're about to fight" onClose={onClose}
      title={n === 1 ? "A creature blocks the way" : `${n} creatures block the way`}
      size={{ width: "min(300px, 78vw, 44vh)", height: "min(440px, 114vw, 64.5vh)" }}
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

// A fight card: the creature card (CardBody) with its rarity under the name,
// and its base stats below — attack %s, HP and agility on the left, the
// defence %s on the right.
function Card({ creatureId }: { creatureId: string }) {
  const t = findCreatureTemplate(creatureId);
  if (!t) return null;
  const p = t.proficiency;
  const own = t.cls === "melee" ? "atk" : t.cls === "ranged" ? "rng" : "mag";
  const row = (label: string, value: string, color?: string) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "2cqw", color: color ?? "#d8d4c8" }}>
      <span style={{ color: color ?? MUTED }}>{label}</span><b>{value}</b>
    </div>
  );
  const pct = (k: keyof CreatureProficiency) => `+${p[k]}%`;
  return (
    <div style={{ height: "100%", containerType: "inline-size" }}>
      <CardBody t={t} creatureId={creatureId} showRarity fill glow>
        <div style={{ ...CARD_WELL, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "6cqw", rowGap: "0.6cqw", fontSize: "clamp(9px, 4.6cqw, 13px)", lineHeight: 1.35 }}>
          <div>
            {ATTACKS.map(([k, label]) => row(label, pct(k), k === own ? CLASS_INFO[t.cls].color : undefined))}
            {row("HP", `${t.baseHp}`, CARD_YELLOW)}
            {row("Agility", pct("agil"))}
          </div>
          <div>
            {DEFENCES.map(([k, label]) => row(label, pct(k)))}
          </div>
        </div>
      </CardBody>
    </div>
  );
}
