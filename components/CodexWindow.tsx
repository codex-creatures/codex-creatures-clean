"use client";
// components/CodexWindow.tsx
// A codex, tapped, in a window floating over the shelf (the user, 2026-11-24: not a box in the page).
// ‹ › on the screen's sides, ← → keys or a sideways swipe for the next one; ✕, Esc or tapping off it
// closes it. Used by the bookcase (CodexShelf) and a creature's Moves tab (CreatureDetailModal),
// whose own arrow keys it holds off while it's open.

import { useEffect, useRef } from "react";
import type { Rarity } from "@/lib/items/budgets";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import SideArrow from "./SideArrow";

const MUTED = "rgba(255,255,255,0.5)";
const SWIPE_PX = 40;

export default function CodexWindow({ index, count, onPrev, onNext, onClose, rarity, children }: {
  index: number; count: number; onPrev: () => void; onNext: () => void; onClose: () => void; rarity: Rarity; children: React.ReactNode;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const keys = useRef({ onPrev, onNext, onClose });
  useEffect(() => { keys.current = { onPrev, onNext, onClose }; });
  useEffect(() => {
    // (Caught first and stopped, so a creature window under it doesn't flick creatures or close too.)
    const onKey = (e: KeyboardEvent) => {
      const act = e.key === "ArrowLeft" ? keys.current.onPrev : e.key === "ArrowRight" ? keys.current.onNext : e.key === "Escape" ? keys.current.onClose : undefined;
      if (!act) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === "Escape" || count > 1) act();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [count]);
  const col = RARITY_COLORS[rarity];
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 220, padding: 16 }}>
      {count > 1 && (["prev", "next"] as const).map((d) => (
        <SideArrow key={d} dir={d} label={d === "prev" ? "Previous codex" : "Next codex"}
          onClick={(e) => { e.stopPropagation(); (d === "prev" ? onPrev : onNext)(); }} />
      ))}
      <div className="modal-panel stone-panel" onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t || count < 2) return;
          const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return; // (sideways only: it scrolls up and down)
          (dx < 0 ? onNext : onPrev)();
        }}
        style={{ position: "relative", width: "100%", maxWidth: 440, maxHeight: "80cqh", overflowY: "auto", boxSizing: "border-box", padding: 16,
          borderColor: "#12131a", boxShadow: `inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 0 0 2px ${col.border}, 0 0 40px ${col.glow}` }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <span className="pixel-font" style={{ fontSize: 13, color: MUTED, visibility: count > 1 ? "visible" : "hidden" }}>{index + 1} / {count}</span>
          <button onClick={onClose} aria-label="Close"
            style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", lineHeight: 1, minWidth: 44, minHeight: 44 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
