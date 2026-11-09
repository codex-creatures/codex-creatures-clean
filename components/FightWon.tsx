"use client";
// components/FightWon.tsx
// A won fight, before anything else (the user, 2026-11-09): what XP each of
// your creatures got: its XP counting up from what it had to what it has now,
// the bar filling with it (on through each level it gains), then Loot (open what they dropped) or Leave
// (it stays on the floor, to open later). With nothing to loot (the thief),
// just Carry on. A creature that levelled up gets its show after this.

import { useEffect, useState } from "react";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { useEscape } from "@/hooks/useEscape";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { Rarity } from "@/lib/items/budgets";
import { addXp, xpToNext, MAX_LEVEL, type XpShown } from "@/lib/creatures/levels";

export type WonRow = { id: string; name: string; creatureId?: string; rarity: Rarity; xp: XpShown };

const GOLD = "#f1d9a0";
const MUTED = "rgba(255,255,255,0.55)";
const NUM: React.CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", fontWeight: 700, fontVariantNumeric: "tabular-nums" };
const ROW = 64; // px: each creature's row, the same whatever it says
const COUNT_MS = 1100, LEVEL_MS = 500, COUNT_DELAY = 250; // the count-up: its time, more for each level gained, and a moment first

export default function FightWon({ rows, onLoot, onLeave }: { rows: WonRow[]; onLoot?: () => void; onLeave: () => void }) {
  // How far through the count-up (0..1): the XP shown starts at what each had and counts up to what it has.
  const [t, setT] = useState(0);
  useEffect(() => {
    const ups = Math.max(0, ...rows.map((r) => r.xp.to.level - r.xp.from.level));
    const start = performance.now() + COUNT_DELAY, long = COUNT_MS + LEVEL_MS * Math.min(ups, 4);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / long));
      setT(k);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const eased = 1 - (1 - t) ** 2;
  useEscape(onLeave);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(4,5,9,0.82)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12cqh 12px 12px" }}>
      <div role="dialog" aria-label="Victory" className="stone-panel levelup-pop" style={{ width: "100%", maxWidth: 400, padding: 14, display: "grid", gap: 10 }}>
        <div className="pixel-font" style={{ fontSize: 20, color: GOLD, textAlign: "center" }}>Victory!</div>
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map((r) => {
            // Where it's got to so far: the XP it had plus this much of what it gained.
            const now = t >= 1 ? r.xp.to : addXp(r.xp.from, Math.round(r.xp.gained * eased));
            const top = now.level >= MAX_LEVEL, next = xpToNext(now.level);
            const up = now.level > r.xp.from.level, fill = top ? 1 : Math.min(1, now.xp / next);
            return (
              <div key={r.id} style={{ height: ROW, display: "grid", gridTemplateColumns: `${ROW - 8}px 1fr`, alignItems: "center", gap: 8, padding: "0 6px", background: "rgba(0,0,0,0.3)", border: "2px solid #2a2d38" }}>
                <span style={{ position: "relative", width: ROW - 12, height: ROW - 12, borderRadius: 6, border: `2px solid ${RARITY_COLORS[r.rarity].border}`, background: "rgba(10,10,16,0.75)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <PixelSprite sprite={creatureSprite(r.creatureId)} scale={3} title={r.name} style={{ width: "90%", height: "90%", objectFit: "contain" }} />
                </span>
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 14, color: "white", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }} title={r.name}>{r.name}</span>
                    <span style={{ ...NUM, fontSize: 14, color: "#7CFC9A", flexShrink: 0 }}>+{r.xp.gained} XP</span>
                  </div>
                  <div style={{ position: "relative", height: 10, background: "#0e0f14", border: "2px solid #2a2d38" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${fill * 100}%`, background: "linear-gradient(#ffe39a, #d9a23a)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED }}>
                    <span className="pixel-font" style={{ color: up ? GOLD : MUTED }}>Lv {now.level}{up ? " ⬆" : ""}</span>
                    <span style={NUM}>{top ? "Max level" : `${now.xp} / ${next} XP`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="dock-tabs">
          {onLoot && <button className="dock-tab" onClick={onLoot} style={{ minHeight: 44 }}>Loot</button>}
          <button className="dock-tab" onClick={onLeave} style={{ minHeight: 44 }}>{onLoot ? "Leave" : "Carry on"}</button>
        </div>
      </div>
    </div>
  );
}
