"use client";
// components/Sheet.tsx
// A panel that slides up over the screen (your roster, your bag…) instead of
// pushing the page longer. Tap outside it, the ✕, or Esc to put it away.

import { useEffect } from "react";

export default function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }; // (not a page back)
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 190, background: "rgba(4,5,9,0.7)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="title-bar sheet-up"
        style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: "14px 14px calc(18px + env(safe-area-inset-bottom))", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>{title}</span>
          <button className="chip" aria-label="Close" onClick={onClose} style={{ fontSize: 16, padding: "4px 12px" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
