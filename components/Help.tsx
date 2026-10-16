"use client";
// components/Help.tsx
// A small "?" that opens the full story of a feature. Screens keep their own
// words short; the detail lives here, set out in big, easy-to-scan text:
// headings, bold, short points (use HelpSection, <ul>, <b>).

import { useEffect, useState } from "react";

export default function Help({ title, children, label }: { title: string; children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } }; // (not a page back)
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className="help-btn" onClick={() => setOpen(true)} aria-label={label ?? `How ${title} works`} title={label ?? `How ${title} works`}>?</button>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(4,5,9,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} className="stone-panel help-panel">
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 22, cursor: "pointer" }}>✕</button>
            <h2 className="pixel-font">{title}</h2>
            {children}
          </div>
        </div>
      )}
    </>
  );
}

export function HelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="pixel-font">{title}</h3>
      {children}
    </section>
  );
}
