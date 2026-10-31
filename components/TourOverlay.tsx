"use client";
// components/TourOverlay.tsx
// Klutz's tour (lib/tour.ts), over whatever screen you're on: the screen
// dims except for the thing he's talking about, and his line sits at the
// top or bottom, away from it. A tap anywhere goes on (to the next step's
// screen, if it's another); Skip ends it. While it's up, the screen under it
// can't be tapped.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PixelSprite from "./PixelSprite";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { useTour } from "@/hooks/useTour";
import { TOUR, endTour, nextTourStep } from "@/lib/tour";

type Box = { step: number; left: number; top: number; width: number; height: number; low: boolean }; // low: in the bottom half
const PAD = 6;         // room round the lit-up thing
const LOOK_MS = 2500;  // how long to look for it on a screen that's still loading

export default function TourOverlay() {
  const step = useTour();
  const path = usePathname();
  const router = useRouter();
  const me = useRef<HTMLDivElement>(null);
  const [found, setBox] = useState<Box | null>(null);
  const s = step === null ? undefined : TOUR[step];
  const here = !!s && s.path === path;

  // On to the step's screen.
  useEffect(() => { if (s && !here) router.push(s.path); }, [s, here, router]);

  // Find what it's about (the screen may still be loading), bring it into
  // view and measure it, in this overlay's own units (the screen may be scaled).
  useEffect(() => {
    if (!s?.target || !here || step === null) return;
    const started = Date.now();
    let raf = 0, scrolled = false;
    const look = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      const o = me.current;
      if (el && o && el.offsetParent !== null) {
        if (!scrolled) { el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }); scrolled = true; }
        const r = el.getBoundingClientRect(), b = o.getBoundingClientRect();
        const k = b.width / (o.offsetWidth || 1);
        const top = (r.top - b.top) / k, height = r.height / k;
        setBox({ step, left: (r.left - b.left) / k, top, width: r.width / k, height, low: top + height / 2 > o.offsetHeight / 2 });
      }
      if (Date.now() - started < LOOK_MS) raf = requestAnimationFrame(look); // (keeps up while things settle)
    };
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, [s, here, step]);

  if (step === null || !s || !here) return null;
  const box = found?.step === step ? found : null; // (measured for this step)
  const onTop = !!box?.low; // the lit-up thing low down: Klutz up top
  const last = step === TOUR.length - 1;

  return (
    <div ref={me} onClick={nextTourStep} role="dialog" aria-label="Klutz's tour"
      style={{ position: "fixed", inset: 0, zIndex: 400, cursor: "pointer", overflow: "hidden" }}>
      {/* The dimming, with a hole round the thing (or all over, with nothing to show). */}
      {box ? (
        <div className="tour-hole" style={{ position: "absolute", left: box.left - PAD, top: box.top - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2,
          boxShadow: "0 0 0 9999px rgba(4,5,9,0.72)", border: "2px solid #ffd66e", borderRadius: 8 }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "rgba(4,5,9,0.72)" }} />
      )}

      {/* Klutz and his line. */}
      <div key={step} className="klutz-say" style={{ position: "absolute", left: 10, right: 10, ...(onTop ? { top: 10 } : { bottom: 10 }),
        display: "flex", alignItems: "flex-end", gap: 8 }}>
        {CREATURE_SPRITES.klutz && <div style={{ flexShrink: 0 }}><PixelSprite sprite={CREATURE_SPRITES.klutz} scale={1.4} title="Klutz" /></div>}
        <div className="tutorial-tip speech" style={{ fontSize: 15, flex: 1, lineHeight: 1.4 }}>
          <b>Klutz:</b> &ldquo;{s.say}&rdquo;
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, fontSize: 12, opacity: 0.75 }}>
            <span>{step + 1}/{TOUR.length} · {last ? "tap to finish" : "tap to carry on"}</span>
            {!last && (
              <button className="chip" onClick={(e) => { e.stopPropagation(); endTour(); }} style={{ minHeight: 32, padding: "2px 10px", fontSize: 12 }}>Skip tour</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
