"use client";
// components/EncounterCards.tsx
// Cards fanned out to flick through: the front one straight and the rest
// fanned behind. Flick with the arrows, ← →, a swipe, or a tap on a card
// behind; the button (or Esc, or ✕) puts them away. CardFan is the shared
// viewer (also for the cards you got on a run — see CardStack);
// EncounterCards is the fight's use of it: tap the creatures waiting in a
// room and they come up as cards with their base stats, and a Fight button.

import { useEffect, useRef, useState } from "react";
import { CLASS_INFO, findCreatureTemplate, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { CardBody, CARD_WELL, CARD_YELLOW } from "./CardGallery";

const MUTED = "rgba(255,255,255,0.55)";
const ATTACKS: [keyof CreatureProficiency, string][] = [["atk", "Melee"], ["rng", "Ranged"], ["mag", "Magic"], ["agil", "Agility"]];
const DEFENCES: [keyof CreatureProficiency, string][] = [["mdef", "Melee def"], ["rdef", "Ranged def"], ["magdef", "Magic def"]];

// onFight: start the fight (missing when nobody on your team can fight).
export default function EncounterCards({ creatureIds, onClose, onFight }: { creatureIds: string[]; onClose: () => void; onFight?: () => void }) {
  const n = creatureIds.length;
  return (
    <CardFan count={n} label="The creatures you're about to fight" onClose={onClose}
      title={n === 1 ? "A creature blocks the way" : `${n} creatures block the way`}
      size={{ width: "min(300px, 78cqw, 44cqh)", height: "min(440px, 114cqw, 64.5cqh)" }}
      action={onFight && { label: "⚔️ Fight", onClick: onFight }}
      render={(i) => <Card creatureId={creatureIds[i]} />} />
  );
}

// The viewer: count cards, drawn by render(i), in a box of the given size.
// action: the main button (otherwise "Got it", which just closes).
export function CardFan({ count: n, title, label, size, render, onClose, action }: {
  count: number; title: string; label: string; size: { width: string; height: string };
  render: (i: number) => React.ReactNode; onClose: () => void; action?: { label: string; onClick: () => void };
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
      <div className="pixel-font" style={{ fontSize: "clamp(15px, 4cqw, 19px)", color: "#f1d9a0", textShadow: "0 2px 0 #000", marginBottom: 14, textAlign: "center" }}>
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
      <button className="pixel-btn" style={{ marginTop: 12, minWidth: 140 }} onClick={action?.onClick ?? onClose}>{action?.label ?? "Got it"}</button>
      {action && (
        <button className="chip" aria-label="Close" onClick={onClose} style={{ position: "absolute", top: 14, right: 14, fontSize: 18, padding: "4px 12px" }}>✕</button>
      )}
    </div>
  );
}

// A fight card: the creature card (CardBody) with its rarity under the name,
// and its base stats below: attack %s and agility on the left, HP and the
// defence %s on the right. Bigger name and style / race than a small card.
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
      <CardBody t={t} creatureId={creatureId} showRarity fill glow big>
        <div style={{ ...CARD_WELL, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "6cqw", rowGap: "0.6cqw", fontSize: "clamp(9px, 4.6cqw, 13px)", lineHeight: 1.35 }}>
          <div>
            {ATTACKS.map(([k, label]) => row(label, pct(k), k === own ? CLASS_INFO[t.cls].color : undefined))}
          </div>
          <div>
            {row("HP", `${t.baseHp}`, CARD_YELLOW)}
            {DEFENCES.map(([k, label]) => row(label, pct(k)))}
          </div>
        </div>
      </CardBody>
    </div>
  );
}
