"use client";
// components/ScanReveal.tsx
// A Code Cache opening at the altar: it rattles up the rarities, harder at each
// (white, green, blue, purple; a legendary goes still for a beat, then gold),
// stopping at its find's, cracks open in a flash of that colour (light rays for
// rare, falling gold and a jolt for epic, a big golden explosion for
// legendary), and the find pops out with what it is.
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
import { revealChoice, revealTier, shakeMs, shakeStages, type NewFind, type RevealTier } from "@/lib/scanReveal";
import type { Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.6)";
const SPARKS = 28;
const BIG_SPARKS = 56; // a legendary's explosion
// The cache before it's climbed anywhere: plain white, not common's grey.
const FIRST_GLOW = "#e6e9ef";
// How hard each stage rattles: further, and quicker, the rarer.
const RATTLE = { common: { px: 3, deg: 4, s: 0.16 }, uncommon: { px: 5, deg: 7, s: 0.13 }, rare: { px: 7, deg: 10, s: 0.11 },
  epic: { px: 9, deg: 13, s: 0.09 }, legendary: { px: 12, deg: 17, s: 0.07 } } as const;
const SPARK_COLORS = ["#ffd66e", "#f1d9a0", "#fff4c2"];
// Where each spark falls from, how fast and when: a fixed scatter, the same every time.
const scatter = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const SPARK_LIST = Array.from({ length: BIG_SPARKS }, (_, i) => ({
  left: scatter(i, 1) * 100, delay: scatter(i, 2) * 0.9, dur: 1.6 + scatter(i, 3) * 1.4,
  size: 4 + Math.floor(scatter(i, 4) * 3) * 2, color: SPARK_COLORS[i % SPARK_COLORS.length],
}));

export default function ScanReveal({ drop, line, isNew, sellValue, onKeep, onSell, onRelease }: {
  drop: Drop;
  line?: string | null;   // who got here first (lib/scanReveal.ts findLine)
  isNew?: NewFind;        // the first of its kind you've had (lib/scanReveal.ts newFinds)
  sellValue: number;      // what it sells for (0: it can't be sold)
  onKeep: () => void;     // also how gold closes
  onSell: () => void;
  onRelease: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const stages = shakeStages(drop);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ts = reduced ? [] : shakeStages(drop).slice(1).map((st, i) => setTimeout(() => setStage(i + 1), st.at));
    ts.push(setTimeout(() => setOpen(true), reduced ? 0 : shakeMs(drop)));
    return () => ts.forEach(clearTimeout);
  }, [drop]);
  const now = stages[Math.min(stage, stages.length - 1)];
  // Each step up a rarity gives a little nudge.
  useEffect(() => { if (stage > 0 && !now.pause) buzz("hit"); }, [stage, now.pause]);
  const shakeGlow = drop.dropType === "reward" ? "#ffd66e" : now.rarity === "common" ? FIRST_GLOW : RARITY_COLORS[now.rarity].text;
  const rattle = RATTLE[now.rarity];

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
    <div onClick={tap} style={{ position: "fixed", inset: 0, zIndex: 260, background: "radial-gradient(circle at 50% 30%, #141826 0%, #040509 70%)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "14cqh 12px 12px", overflow: "hidden" }}>
      {open && <RevealFlash tier={tier} glow={glow} />}

      <div role="dialog" aria-label={open ? look.name : "A Code Cache opens"} className={open && tier === "explosion" ? "reveal-jolt-big" : open && tier === "shower" ? "reveal-jolt" : undefined}
        style={{ position: "relative", width: "100%", maxWidth: 400, display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
        {/* The stage: a fixed height, the cache before and the find after. */}
        <div style={{ position: "relative", height: 190, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!open ? (
            // Keyed by stage, so each new colour starts with a flare and its own rattle.
            <span key={stage} className={now.pause ? "reveal-still" : "reveal-rattle"}
              style={{ "--rx": `${rattle.px}px`, "--rr": `${rattle.deg}deg`, animationDuration: `${rattle.s}s` } as React.CSSProperties}>
              <span className={`pixel-font${stage > 0 && !now.pause ? " reveal-step" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 110, height: 110, borderRadius: 12, fontSize: 64,
                color: shakeGlow, textShadow: `0 0 ${12 + stage * 4}px ${shakeGlow}`, background: `radial-gradient(circle, ${shakeGlow}${now.pause ? "33" : "66"} 0%, transparent 65%)`,
                transition: "color 0.15s, text-shadow 0.15s" }}>?</span>
            </span>
          ) : (
            <>
              <RevealBurst tier={tier} glow={glow} />
              {/* New to you: a tag pinned to the stage's top, so nothing below moves. */}
              {isNew && <div className="pixel-font levelup-title" style={{ position: "absolute", top: 0, left: "50%", zIndex: 1, translate: "-50% 0", whiteSpace: "nowrap", padding: "3px 10px", fontSize: 15,
                color: "#1a1206", background: "#ffd66e", border: "2px solid #fff2c4", boxShadow: "0 0 14px #ffcc4d" }}>✨ New {isNew}!</div>}
              <div className="cage-out" style={{ position: "relative", width: 150, height: 170, display: "flex", alignItems: "center", justifyContent: "center", filter: `drop-shadow(0 0 14px ${glow})` }}>
                {t && drop.dropType === "card" ? <div style={{ width: 120 }}><CardFace t={t} creatureId={creatureId ?? t.id} soulStone={drop.soulStone} mini /></div>
                  : t ? <div style={{ position: "relative", width: 150, height: 150 }}><CreatureArt creatureId={creatureId ?? t.id} title={t.name} /></div>
                  : look.sprite ? <PixelSprite sprite={look.sprite} scale={5} style={{ width: "auto", height: "auto", maxWidth: 140, maxHeight: 140, imageRendering: "pixelated" }} />
                  : <span style={{ fontSize: 80 }}>{look.icon}</span>}
              </div>
            </>
          )}
        </div>

        <div className={`pixel-font${open ? " levelup-title" : ""}`} style={{ fontSize: 20, color: open ? glow : shakeGlow, minHeight: 26, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
            : drop.dropType === "item" && <ItemPeek item={{ gear: drop }} />}
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

// The crack, shared with summoning (SummonShow): a flash over the whole screen,
// and falling gold for epic and legendary (put it in the full-screen backdrop)…
export function RevealFlash({ tier, glow }: { tier: RevealTier; glow: string }) {
  return (
    <>
      {(tier === "shower" || tier === "explosion") && SPARK_LIST.slice(0, tier === "explosion" ? BIG_SPARKS : SPARKS).map((s, i) => (
        <span key={i} aria-hidden className="triumph-spark"
          style={{ left: `${s.left}%`, width: s.size, height: s.size, background: s.color, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, animationIterationCount: 1 }} />
      ))}
      <div aria-hidden className={tier === "explosion" ? "reveal-flash-big" : "reveal-flash"} style={{ position: "absolute", inset: 0, background: tier === "explosion" ? "#fff2c4" : glow, pointerEvents: "none" }} />
    </>
  );
}
// …and round the find: a burst of its colour, light rays (rare and up) and a
// golden ring (legendary). Put it in the stage, behind the find.
export function RevealBurst({ tier, glow }: { tier: RevealTier; glow: string }) {
  return (
    <>
      {tier === "explosion" && <div aria-hidden className="reveal-boom" style={{ position: "absolute", width: 160, height: 160, left: "50%", top: "50%", margin: "-80px 0 0 -80px", borderRadius: "50%",
        border: "10px solid #ffe08a", boxShadow: "0 0 40px #ffcc4d, inset 0 0 40px #ffcc4d" }} />}
      {tier !== "puff" && <div aria-hidden className="reveal-rays" style={{ position: "absolute", width: 300, height: 300, left: "50%", top: "50%", margin: "-150px 0 0 -150px",
        background: `repeating-conic-gradient(${glow}55 0deg 10deg, transparent 10deg 30deg)`, maskImage: "radial-gradient(circle, #000 20%, transparent 68%)", WebkitMaskImage: "radial-gradient(circle, #000 20%, transparent 68%)" }} />}
      <div aria-hidden className="cage-burst" style={{ position: "absolute", inset: 0, background: `radial-gradient(circle, ${glow}99 0%, transparent 60%)` }} />
    </>
  );
}
