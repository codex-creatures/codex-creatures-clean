"use client";
// components/SummonShow.tsx
// Summoning from 3 cards: the cards are set down on the Soul Altar, lift and
// whirl up into a whirlwind that spins faster and tighter as it climbs the
// rarities (white, green, blue, purple, and gold after a held breath, like a
// Code Cache), stopping at the creature's, then bursts into the creature in
// that colour. Tap during the whirl to skip it. Timings: lib/scanReveal.ts
// (summonStages). The ascension ritual (app/altar) plays it too, with the
// creatures given up and the one kept in a ring, climbing to its new rarity.

import { useEffect, useRef, useState } from "react";
import { CardFace } from "./CardGallery";
import { CreatureArt } from "./CreaturePortrait";
import { RevealBurst, RevealFlash } from "./ScanReveal";
import { buzz } from "@/lib/haptics";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { CreatureTemplate } from "@/lib/creatures/creatureData";
import { revealTier, summonMs, summonStages, SUMMON_PLACE_MS } from "@/lib/scanReveal";
import type { CreatureOrItemDrop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.6)";
const FIRST_GLOW = "#e6e9ef"; // the whirlwind before it's climbed anywhere (as the cache)
const STAGE_H = 300;          // the stage: the altar at the bottom, the whirlwind over it
const ALTAR_PX = 168;         // the altar's art (128px) drawn at this size
const CARD_PX = 54;
// Where the cards lie on the altar's top (from the stage's centre line), as
// angles round a flat ring, so the whirl starts from just where they lie.
const ORBIT_Y = STAGE_H - ALTAR_PX + 30; // the ring's centre, on the altar's top
const RING_R = 52;
const RING_FLAT = 0.4;  // the ring's seen from above: squashed this much
const LIFT = 110;       // how high the cards rise into the whirlwind
// Each card's place round the ring (3 cards: 210°, 330°, 90°).
const angleOf = (i: number, n: number) => 210 + (i * 360) / n;
const MAX_CARDS = 5;
const TURNS_PER_S = 2.4;
// Wisps of wind round the funnel: their height (0 bottom, 1 top), start angle and speed.
const WISPS = Array.from({ length: 12 }, (_, i) => ({ h: (i % 6) / 5, a: i * 97, speed: 1 + (i % 3) * 0.35 }));
const RINGS = 6;

export type ShowWords = { laying: string; stirring: string; done: string };
const SUMMON_WORDS = (name: string): ShowWords => ({ laying: "The cards are laid down…", stirring: "The cards stir…", done: `${name} summoned!` });

export default function SummonShow({ t, cards, result, onDone, words = SUMMON_WORDS(result.name), extra }: {
  t: CreatureTemplate;
  cards: CreatureOrItemDrop[];  // the cards used (or, ascending, the creatures: up to MAX_CARDS)
  result: CreatureOrItemDrop;   // the creature they became
  onDone: () => void;
  words?: ShowWords;
  extra?: React.ReactNode; // shown under it once it's out (the ascension: what it gained)
}) {
  const ring = cards.slice(0, MAX_CARDS);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(-1); // -1: still being set down
  const stages = summonStages(result);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wispRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const funnelRef = useRef<HTMLDivElement | null>(null);
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // How fast the rings sway (turns a second), quicker each step up: read by the
  // frame loop, so a step never restarts or jumps them (it used to remount them).
  const swayRef = useRef(0.8);

  // The stages, then the burst.
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ts = reduced ? [] : summonStages(result).map((st, i) => setTimeout(() => setStage(i), st.at));
    ts.push(setTimeout(() => setOpen(true), reduced ? 0 : summonMs(result)));
    return () => ts.forEach(clearTimeout);
  }, [result]);

  // The whirl itself, frame by frame: the cards spiral in and up, faster and
  // faster, and the wisps race round the funnel.
  useEffect(() => {
    if (open) return;
    const whirlMs = summonMs(result) - SUMMON_PLACE_MS;
    const start = performance.now();
    let raf = 0, sway = 0, last = start;
    const frame = (now: number) => {
      const ms = now - start;
      const u = Math.max(0, Math.min(1, (ms - SUMMON_PLACE_MS) / whirlMs));
      const spun = TURNS_PER_S * (whirlMs / 1000) * 360 * u * u; // speeding up
      const rise = Math.min(1, u * 4);
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = ((angleOf(i, ring.length) + spun) * Math.PI) / 180;
        const r = RING_R * (1 - 0.8 * u) * (1 + 0.4 * rise);
        const x = Math.cos(a) * r, y = -LIFT * rise + Math.sin(a) * r * RING_FLAT;
        el.style.transform = `translate(${x}px, ${y}px) rotate(${Math.cos(a) * 18 * rise}deg) scale(${1 - 0.65 * u})`;
        el.style.zIndex = Math.sin(a) > 0 ? "3" : "1"; // the near side passes in front of the wind
        el.style.opacity = String(u > 0.92 ? (1 - u) / 0.08 : 1);
      });
      wispRefs.current.forEach((el, i) => {
        if (!el) return;
        const w = WISPS[i];
        const a = ((w.a + (ms / 1000) * 360 * w.speed * (1 + 2 * u)) * Math.PI) / 180;
        const r = 14 + w.h * 46;
        el.style.transform = `translate(${Math.cos(a) * r}px, ${-w.h * 150 + Math.sin(a) * r * RING_FLAT}px)`;
        el.style.opacity = String(Math.min(1, u * 3) * (0.35 + 0.65 * Math.max(0, Math.sin(a))));
      });
      if (funnelRef.current) funnelRef.current.style.opacity = String(Math.min(1, u * 3));
      sway += ((now - last) / 1000) * swayRef.current * Math.PI * 2;
      last = now;
      ringRefs.current.forEach((el, k) => { if (el) el.style.translate = `${Math.sin(sway - k * 0.9) * 7}px 0`; });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [open, result, ring.length]);

  const now = stage >= 0 ? stages[Math.min(stage, stages.length - 1)] : undefined;
  swayRef.current = now?.pause ? 0.4 : 0.8 + Math.max(0, stage) * 0.25;
  // Each step up a rarity gives a little nudge, and the funnel a flare.
  useEffect(() => {
    if (stage <= 0 || now?.pause) return;
    buzz("hit");
    funnelRef.current?.animate?.([{ transform: "scale(1.35)", filter: "brightness(2.2)" }, { transform: "none", filter: "none" }], { duration: 300, easing: "ease-out" });
  }, [stage, now?.pause]);
  const wind = !now || now.rarity === "common" ? FIRST_GLOW : RARITY_COLORS[now.rarity].text;
  const glow = RARITY_COLORS[result.rarity].text;
  const tier = revealTier(result.rarity);
  useEffect(() => { if (open) buzz(tier === "puff" ? "hit" : "levelUp"); }, [open, tier]);

  return (
    <div onClick={() => (open ? undefined : setOpen(true))}
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "radial-gradient(circle at 50% 35%, #141826 0%, #040509 70%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", overflow: "hidden" }}>
      {open && <RevealFlash tier={tier} glow={glow} />}

      <div role="dialog" aria-label={open ? words.done : words.stirring} onClick={(e) => open && e.stopPropagation()}
        className={open && tier === "explosion" ? "reveal-jolt-big" : open && tier === "shower" ? "reveal-jolt" : undefined}
        style={{ position: "relative", width: "100%", maxWidth: 400, display: "grid", gap: 10, textAlign: "center", justifyItems: "center" }}>
        {/* The stage: a fixed height; the altar stays, the cards and wind give way to the creature. */}
        <div style={{ position: "relative", height: STAGE_H, width: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sprites/den/altar.png" alt="" draggable={false} style={{ position: "absolute", left: "50%", bottom: 0, width: ALTAR_PX, height: ALTAR_PX, marginLeft: -ALTAR_PX / 2,
            imageRendering: "pixelated", filter: `drop-shadow(0 0 ${open ? 18 : 8}px ${open ? glow : wind}88)`, transition: "filter 0.2s" }} />

          {!open ? (
            <div style={{ position: "absolute", left: "50%", top: ORBIT_Y, width: 0, height: 0 }}>
              {/* The whirlwind: rings widening up a funnel, swaying, in the stage's colour. */}
              <div ref={funnelRef} aria-hidden
                style={{ position: "absolute", left: 0, top: 0, opacity: 0, color: wind, transition: "color 0.15s", zIndex: 2 }}>
                {Array.from({ length: RINGS }, (_, k) => {
                  const w = 34 + k * 22, h = 10 + k * 3;
                  return <span key={k} ref={(el) => { ringRefs.current[k] = el; }} style={{ position: "absolute", left: -w / 2, top: -(k * 30) - h / 2, width: w, height: h, borderRadius: "50%",
                    border: "3px solid currentColor", borderTopColor: "transparent", boxShadow: "0 0 10px currentColor", opacity: 0.45 + k * 0.08 }} />;
                })}
                <span style={{ position: "absolute", left: -60, top: -170, width: 120, height: 190, background: "radial-gradient(ellipse at 50% 60%, currentColor 0%, transparent 65%)", opacity: 0.25 }} />
                {WISPS.map((_, i) => <span key={i} ref={(el) => { wispRefs.current[i] = el; }}
                  style={{ position: "absolute", left: -3, top: -2, width: 6, height: 4, borderRadius: 2, background: "currentColor", boxShadow: "0 0 6px currentColor", opacity: 0 }} />)}
              </div>
              {ring.map((k, i) => {
                const a = (angleOf(i, ring.length) * Math.PI) / 180;
                return (
                  <div key={k.id} ref={(el) => { cardRefs.current[i] = el; }}
                    style={{ position: "absolute", left: -CARD_PX / 2, top: -CARD_PX * 0.7, width: CARD_PX, zIndex: Math.sin(a) > 0 ? 3 : 1,
                      transform: `translate(${Math.cos(a) * RING_R}px, ${Math.sin(a) * RING_R * RING_FLAT}px)` }}>
                    <div className="summon-place" style={{ animationDelay: `${i * 0.18}s`, filter: `drop-shadow(0 0 6px ${wind})` }}>
                      <CardFace t={t} creatureId={k.creatureId ?? t.id} soulStone={k.soulStone} rarity={k.rarity} mini />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ position: "absolute", left: 0, right: 0, top: ORBIT_Y - LIFT - 95, height: 190, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RevealBurst tier={tier} glow={glow} />
              <div className="cage-out" style={{ position: "relative", width: 150, height: 150, filter: `drop-shadow(0 0 14px ${glow})` }}>
                <CreatureArt creatureId={result.creatureId ?? t.id} title={result.name} />
              </div>
            </div>
          )}
        </div>

        <div className={`pixel-font${open ? " levelup-title" : ""}`} style={{ fontSize: 20, color: open ? glow : wind, minHeight: 26, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {open ? words.done : stage < 0 ? words.laying : words.stirring}
        </div>
        <div style={{ fontSize: 14, minHeight: 18, color: MUTED, textTransform: "capitalize", visibility: open ? "visible" : "hidden" }} className={open ? "levelup-stats" : undefined}>
          {result.rarity} creature{t.race ? ` · ${t.race}` : ""}
        </div>
        {extra && <div className={open ? "levelup-stats" : undefined} style={{ width: "100%", display: "flex", justifyContent: "center", visibility: open ? "visible" : "hidden" }}>{extra}</div>}
        <button className="pixel-btn" style={{ width: "100%", minHeight: 48, visibility: open ? "visible" : "hidden" }} onClick={onDone}>Carry on</button>
      </div>
    </div>
  );
}
