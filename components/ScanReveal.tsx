"use client";
// components/ScanReveal.tsx
// A Code Cache opening at the altar: it shakes harder and harder, cracks open
// in a flash of the find's rarity (light rays for rare, falling gold and a
// jolt for epic and legendary), and the find pops out with what it is.
// Then Keep / Sell (anything with a price), Keep / Release (a creature or card), Keep
// (anything else), or just tap on (gold). Tap during the shake to skip it.
// Timings and choices: lib/scanReveal.ts.

import { useEffect, useState } from "react";
import PixelSprite from "./PixelSprite";
import { ItemPeek } from "./LootWindow";
import { CardFace } from "./CardGallery";
import { CreatureArt } from "./CreaturePortrait";
import { lookOf } from "./ContainerLoot";
import { Coin } from "./GoldCount";
import { useEscape } from "@/hooks/useEscape";
import { buzz } from "@/lib/haptics";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { revealChoice, revealTier, shakeMs } from "@/lib/scanReveal";
import type { Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.6)";
const REVEAL_PEEK_BODY = 100; // room for armour's two rows of stats
const SPARKS = 28;
const SPARK_COLORS = ["#ffd66e", "#f1d9a0", "#fff4c2"];
// Where each spark falls from, how fast and when: a fixed scatter, the same every time.
const scatter = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const SPARK_LIST = Array.from({ length: SPARKS }, (_, i) => ({
  left: scatter(i, 1) * 100, delay: scatter(i, 2) * 0.9, dur: 1.6 + scatter(i, 3) * 1.4,
  size: 4 + Math.floor(scatter(i, 4) * 3) * 2, color: SPARK_COLORS[i % SPARK_COLORS.length],
}));

export default function ScanReveal({ drop, line, sellValue, onKeep, onSell, onRelease }: {
  drop: Drop;
  line?: string | null;   // who got here first (lib/scanReveal.ts findLine)
  sellValue: number;      // what it sells for (0: it can't be sold)
  onKeep: () => void;     // also how gold closes
  onSell: () => void;
  onRelease: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setOpen(true), reduced ? 0 : shakeMs(drop));
    return () => clearTimeout(t);
  }, [drop]);

  const choice = revealChoice(drop, sellValue);
  const rarity = drop.dropType === "reward" ? undefined : drop.rarity;
  const tier = revealTier(rarity);
  useEffect(() => { if (open) buzz(tier === "puff" ? "hit" : "levelUp"); }, [open, tier]);

  const look = drop.dropType === "reward" ? lookOf({ gold: drop.amount }) : lookOf({ gear: drop });
  const glow = rarity ? RARITY_COLORS[rarity].text : "#ffd66e";
  const t = drop.dropType === "card" || drop.dropType === "creature" ? findCreatureTemplate(drop.creatureId, drop.name) : undefined;
  const creatureId = drop.dropType === "reward" ? undefined : drop.creatureId ?? t?.id;
  // Tapping the backdrop: skips the shake; then only gold closes that way
  // (everything else waits for a button).
  const tap = () => (!open ? setOpen(true) : choice === "gold" ? onKeep() : undefined);
  useEscape(() => (open ? onKeep() : setOpen(true)));
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f(); };

  return (
    <div onClick={tap} style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(4,5,9,0.88)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "14cqh 12px 12px", overflow: "hidden" }}>
      {open && tier === "shower" && SPARK_LIST.map((s, i) => (
        <span key={i} aria-hidden className="triumph-spark"
          style={{ left: `${s.left}%`, width: s.size, height: s.size, background: s.color, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, animationIterationCount: 1 }} />
      ))}
      {open && <div aria-hidden className="reveal-flash" style={{ position: "absolute", inset: 0, background: glow, pointerEvents: "none" }} />}

      <div role="dialog" aria-label={open ? look.name : "A Code Cache opens"} className={open && tier === "shower" ? "reveal-jolt" : undefined}
        style={{ position: "relative", width: "100%", maxWidth: 400, display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
        {/* The stage: a fixed height, the cache before and the find after. */}
        <div style={{ position: "relative", height: 190, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!open ? (
            <span className="reveal-shake" style={{ animationDuration: `${shakeMs(drop)}ms` }}>
              <span className="pixel-font cache-sealed" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 110, height: 110, borderRadius: 12, fontSize: 64, color: "#8fc1ff",
                textShadow: "0 0 12px rgba(143,193,255,0.9)", background: "radial-gradient(circle, rgba(143,193,255,0.4) 0%, transparent 65%)" }}>?</span>
            </span>
          ) : (
            <>
              {tier !== "puff" && <div aria-hidden className="reveal-rays" style={{ position: "absolute", width: 300, height: 300, left: "50%", top: "50%", margin: "-150px 0 0 -150px",
                background: `repeating-conic-gradient(${glow}55 0deg 10deg, transparent 10deg 30deg)`, maskImage: "radial-gradient(circle, #000 20%, transparent 68%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 68%)" }} />}
              <div aria-hidden className="cage-burst" style={{ position: "absolute", inset: 0, background: `radial-gradient(circle, ${glow}99 0%, transparent 60%)` }} />
              <div className="cage-out" style={{ position: "relative", width: 150, height: 170, display: "flex", alignItems: "center", justifyContent: "center", filter: `drop-shadow(0 0 14px ${glow})` }}>
                {t && drop.dropType === "card" ? <div style={{ width: 120 }}><CardFace t={t} creatureId={creatureId ?? t.id} soulStone={drop.soulStone} mini /></div>
                  : t ? <div style={{ position: "relative", width: 150, height: 150 }}><CreatureArt creatureId={creatureId ?? t.id} title={t.name} /></div>
                  : look.sprite ? <PixelSprite sprite={look.sprite} scale={5} style={{ width: "auto", height: "auto", maxWidth: 140, maxHeight: 140, imageRendering: "pixelated" }} />
                  : <span style={{ fontSize: 80 }}>{look.icon}</span>}
              </div>
            </>
          )}
        </div>

        <div className={`pixel-font${open ? " levelup-title" : ""}`} style={{ fontSize: 20, color: open ? glow : "#8fc1ff", minHeight: 26, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {!open ? "The cache stirs…" : choice === "gold" ? `+${drop.dropType === "reward" ? drop.amount : 0} gold!` : `${look.name}!`}
        </div>

        {/* Who got here first: one line, its space kept when there's nothing to say. */}
        <div className={open ? "levelup-stats" : undefined} style={{ fontSize: 14, minHeight: 18, lineHeight: "18px", maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          color: line?.startsWith("✨") ? "#ffd66e" : MUTED, fontWeight: line?.startsWith("✨") ? 700 : 400, visibility: open && line ? "visible" : "hidden" }}>{line ?? "-"}</div>

        {/* What it is: gear and other things as in your bag, a creature or card by its rarity. Space kept while shaking. */}
        <div style={{ width: "100%", minHeight: 170, visibility: open ? "visible" : "hidden" }} className={open ? "levelup-stats" : undefined}>
          {choice === "gold" ? <div style={{ fontSize: 14, color: MUTED, paddingTop: 8 }}>Tap to carry on</div>
            : t ? <div className="stone-panel" style={{ padding: "10px 12px", fontSize: 14, color: MUTED, textTransform: "capitalize" }}>
                {drop.dropType !== "reward" && drop.rarity} {drop.dropType === "card" ? "creature card" : "creature"}{t.race ? ` · ${t.race}` : ""}
              </div>
            : drop.dropType === "item" && <ItemPeek item={{ gear: drop }} bodyHeight={REVEAL_PEEK_BODY} />}
        </div>

        <div style={{ display: "flex", gap: 10, width: "100%", visibility: open && choice !== "gold" ? "visible" : "hidden" }}>
          <button className="pixel-btn" style={{ flex: 1, minHeight: 48 }} onClick={stop(onKeep)}>Keep</button>
          {choice === "sell" && <button className="pixel-btn" style={{ flex: 1, minHeight: 48 }} onClick={stop(onSell)}>Sell <Coin /> {sellValue}</button>}
          {choice === "release" && <button className="pixel-btn" style={{ flex: 1, minHeight: 48 }} onClick={stop(onRelease)}>Release</button>}
        </div>
      </div>
    </div>
  );
}
