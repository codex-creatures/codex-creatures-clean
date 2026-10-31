"use client";
// components/Triumph.tsx
// A labyrinth's boss beaten: a big moment before the run's summary. The
// title stamps in under a shower of gold, your team cheers, and a few
// numbers from the run. Tap (or Continue) to carry on to the summary.

import { useEffect } from "react";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { useEscape } from "@/hooks/useEscape";
import { buzz } from "@/lib/haptics";

const GOLD = "#f1d9a0";
const MUTED = "rgba(255,255,255,0.6)";
const SPARKS = 36; // falling bits of gold
const SPARK_COLORS = ["#ffd66e", "#f1d9a0", "#5ee08a", "#ff8a5c", "#9cc8ff"];
// Where each spark falls from, how fast, and when: scattered by a fixed
// formula, so it's the same every time (and pure to render).
const scatter = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const SPARK_LIST = Array.from({ length: SPARKS }, (_, i) => ({
  left: scatter(i, 1) * 100, delay: scatter(i, 2) * 1.6, dur: 2.2 + scatter(i, 3) * 1.8,
  size: 4 + Math.floor(scatter(i, 4) * 3) * 2, color: SPARK_COLORS[i % SPARK_COLORS.length],
}));

export default function Triumph({ title, line, team, stats, onDone }: {
  title: string; line: string;
  team: { id: string; name: string; creatureId?: string }[];
  stats: { label: string; value: string }[];
  onDone: () => void;
}) {
  useEffect(() => { buzz("levelUp"); }, []);
  useEscape(onDone);

  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 260, background: "radial-gradient(circle at 50% 35%, rgba(70,52,12,0.92), rgba(4,5,9,0.95) 70%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, overflow: "hidden" }}>
      {SPARK_LIST.map((s, i) => (
        <span key={i} aria-hidden className="triumph-spark"
          style={{ left: `${s.left}%`, width: s.size, height: s.size, background: s.color, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
      ))}
      <div role="dialog" aria-label={title} style={{ position: "relative", width: "100%", maxWidth: 420, display: "grid", gap: 12, textAlign: "center", justifyItems: "center" }}>
        <div className="pixel-font triumph-banner" style={{ fontSize: 15, color: "#ffd66e", letterSpacing: 2 }}>🏆 VICTORY 🏆</div>
        <div className="pixel-font triumph-title levelup-title" style={{ fontSize: 30, lineHeight: 1.15, color: GOLD }}>{title}</div>
        <div className="triumph-line" style={{ fontSize: 15, color: "#e8e2d0", lineHeight: 1.45, maxWidth: 340 }}>{line}</div>

        {/* Your team, hopping for joy. */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-end", minHeight: 96 }}>
          {team.map((c, i) => (
            <div key={c.id} className="triumph-cheer" style={{ animationDelay: `${0.6 + i * 0.15}s`, display: "grid", justifyItems: "center", gap: 2 }}>
              <PixelSprite sprite={creatureSprite(c.creatureId)} scale={2}
                style={{ width: "auto", height: "auto", maxWidth: "min(84px, 22cqw)", maxHeight: 80, filter: "drop-shadow(0 0 8px rgba(255,214,110,0.5)) drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
              <span style={{ fontSize: 11, color: GOLD, maxWidth: 84, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
            </div>
          ))}
        </div>

        <div className="stone-panel triumph-stats" style={{ display: "grid", gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 6, width: "100%", padding: "8px 6px" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "grid", gap: 2 }}>
              <span className="pixel-font" style={{ fontSize: 20, color: GOLD }}>{s.value}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{s.label}</span>
            </div>
          ))}
        </div>
        <button className="pixel-btn triumph-stats" onClick={(e) => { e.stopPropagation(); onDone(); }}>Continue</button>
      </div>
    </div>
  );
}
