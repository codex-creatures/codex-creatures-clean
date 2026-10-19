"use client";
// components/CodeCache.tsx
// Opening a cache of items: a 2×5 grid of sealed "?" slots. Tap one to
// reveal what's inside, or reveal the lot with the button at the bottom.
// Used for Klutz's box (an armoury box) and, later, Code Caches (scans
// saved up while offline: "Extract all").

import { GOLD_SPRITE } from "@/lib/sprites/items";
import { useState } from "react";
import { useEscape } from "@/hooks/useEscape";
import PixelSprite, { itemSprite, creatureSprite } from "./PixelSprite";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureOrItemDrop, Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.55)";
const COLUMNS = 5;
const REVEAL_ALL_STEP_MS = 140; // "reveal all" still opens them one after another

function look(d: Drop) {
  if (d.dropType === "reward") return { sprite: GOLD_SPRITE, icon: "💰", name: `${d.amount} gold`, color: "#f1d9a0", glow: "rgba(241,217,160,0.35)" };
  const x = d as CreatureOrItemDrop;
  const rc = RARITY_COLORS[x.rarity];
  const sprite = x.dropType === "item" ? itemSprite(x) : creatureSprite(x.creatureId);
  return { sprite, icon: x.codexMove ? "📖" : x.scroll ? "📜" : x.dropType === "card" ? "🃏" : "📦", name: x.name, color: rc.text, glow: rc.border, rarity: x.rarity };
}

export default function CodeCache({ title, intro, items, revealAllLabel = "Reveal all", doneLabel, onDone }: {
  title: string;
  intro?: React.ReactNode;
  items: Drop[];
  revealAllLabel?: string;   // "Extract all" for scans
  doneLabel: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState<boolean[]>(() => items.map(() => false));
  const [last, setLast] = useState<number | null>(null);
  useEscape(() => {}); // the page stays put until you've seen what's inside
  const all = open.every(Boolean);

  const reveal = (i: number) => {
    setOpen((o) => (o[i] ? o : o.map((v, j) => (j === i ? true : v))));
    setLast(i);
  };
  function revealAll() {
    open.forEach((v, i) => { if (!v) window.setTimeout(() => reveal(i), REVEAL_ALL_STEP_MS * open.slice(0, i).filter((x) => !x).length); });
  }

  const shown = last !== null ? look(items[last]) : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }}>
      <div className="stone-panel" style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>{title}</div>
        {intro && <p style={{ fontSize: 13, color: "#d8d4c8", lineHeight: 1.5, margin: "6px 0 0" }}>{intro}</p>}

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`, gap: 6, margin: "14px 0 10px" }}>
          {items.map((d, i) => {
            const l = look(d);
            return open[i] ? (
              <button key={i} className="cache-open" onClick={() => setLast(i)} title={l.name} aria-label={l.name}
                style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: 2, cursor: "pointer",
                  background: "#15161d", border: `3px solid ${l.color}`, boxShadow: `0 0 10px ${l.glow}, inset 0 0 12px ${l.glow}`,
                  outline: last === i ? "2px solid #ffd66e" : "none", outlineOffset: 1 }}>
                {l.sprite ? <PixelSprite sprite={l.sprite} scale={2} /> : <span style={{ fontSize: 22 }}>{l.icon}</span>}
              </button>
            ) : (
              <button key={i} className="cache-sealed" onClick={() => reveal(i)} aria-label={`Reveal item ${i + 1}`}
                style={{ aspectRatio: "1", cursor: "pointer", padding: 0, background: "#23262f", border: "3px solid #12131a",
                  boxShadow: "inset 3px 3px 0 #3a3e4b, inset -3px -3px 0 #181a21, 0 3px 0 rgba(0,0,0,0.5)" }}>
                <span className="pixel-font" style={{ fontSize: 22, color: "#8fc1ff", textShadow: "0 0 8px rgba(143,193,255,0.8)" }}>?</span>
              </button>
            );
          })}
        </div>

        {/* What you just revealed. */}
        <div style={{ minHeight: 40, fontSize: 14 }}>
          {shown ? (
            <>
              <b style={{ color: shown.color }}>{shown.name}</b>
              {shown.rarity && <span style={{ color: MUTED, textTransform: "capitalize" }}> · {shown.rarity}</span>}
            </>
          ) : <span style={{ color: MUTED }}>Tap a slot to see what&apos;s inside.</span>}
        </div>

        {all
          ? <button className="pixel-btn" onClick={onDone}>{doneLabel}</button>
          : <button className="pixel-btn" onClick={revealAll}>{revealAllLabel}</button>}
      </div>
    </div>
  );
}
