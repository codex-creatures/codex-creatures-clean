"use client";
// components/CageReveal.tsx
// Opening an Encampment cage: the cage rattles, the lock springs, and out
// comes what was inside (in its rarity's glow), or nothing at all.
// Tap to skip ahead; Continue closes it.

import { useEffect, useState } from "react";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { useEscape } from "@/hooks/useEscape";
import { buzz } from "@/lib/haptics";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";

export type CageFind = { name: string; creatureId: string; rarity: Rarity; level: number } | null; // null: an empty cage

const MUTED = "rgba(255,255,255,0.55)";
const RATTLE = 1100; // ms of the cage shaking before it opens

export default function CageReveal({ find, onDone }: { find: CageFind; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setOpen(true), reduced ? 0 : RATTLE);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => { if (open && find) buzz("levelUp"); }, [open, find]);
  const next = () => (open ? onDone() : setOpen(true));
  useEscape(next);
  const glow = find ? RARITY_COLORS[find.rarity].text : "#8a8478";

  return (
    <div onClick={next} style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(4,5,9,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div role="dialog" aria-label={find ? `${find.name} is yours` : "An empty cage"} className="stone-panel levelup-pop"
        style={{ width: "100%", maxWidth: 400, padding: 16, display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
        {/* The stage: a fixed height, the cage before and the creature after. */}
        <div style={{ position: "relative", height: 150, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!open ? (
            <span className="cage-rattle" style={{ fontSize: 84, lineHeight: 1 }}>🔒</span>
          ) : (
            <>
              <div className="cage-burst" style={{ position: "absolute", inset: 0, background: `radial-gradient(circle, ${glow}88 0%, transparent 60%)` }} />
              {find ? (
                <div className="cage-out">
                  <PixelSprite sprite={creatureSprite(find.creatureId)} scale={3}
                    style={{ width: "auto", height: "auto", maxWidth: "min(140px, 34cqw)", maxHeight: 130, filter: `drop-shadow(0 0 12px ${glow}) drop-shadow(0 3px 0 rgba(0,0,0,0.6))` }} />
                </div>
              ) : (
                <span className="cage-out" style={{ fontSize: 64, opacity: 0.6 }}>🕸️</span>
              )}
            </>
          )}
        </div>
        <div className={`pixel-font${open && find ? " levelup-title" : ""}`} style={{ fontSize: 20, color: open && find ? glow : "#f1d9a0", minHeight: 26 }}>
          {!open ? "The lock gives…" : find ? `A ${find.name}!` : "Empty."}
        </div>
        <div style={{ fontSize: 14, color: MUTED, minHeight: 20, visibility: open ? "visible" : "hidden" }}>
          {find ? `${find.rarity} · level ${find.level} · it's yours` : "Nothing in this one but cobwebs."}
        </div>
        <button className="pixel-btn" onClick={(e) => { e.stopPropagation(); onDone(); }} style={{ visibility: open ? "visible" : "hidden" }}>Continue</button>
      </div>
    </div>
  );
}
