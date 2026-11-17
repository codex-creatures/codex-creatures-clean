"use client";
// components/ClaimBurst.tsx
// A reward claimed: its picture lifts off the note it was on, floats to the middle of the screen
// and grows, with golden rays and sparkles behind it and what you got under it, then zooms off up
// and away (the user, 2026-11-17: "something that shows that it's been claimed"). A tap skips it.
// The look is in globals.css (.claim-*); onDone runs as it's gone (the reward's box opens then).

import { useEffect, useLayoutEffect, useRef } from "react";
import { drawnScale } from "@/lib/uiScale";

export const CLAIM_SPARKS = 10; // sparkles flying out round it
const FALLBACK_MS = 2600;       // done even if the animation's end never comes (a hidden tab)

export type ClaimShow = { art: string; inside?: string | null; tint: string; text: string; from: DOMRect | null };

export default function ClaimBurst({ show, onDone }: { show: ClaimShow; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null), fly = useRef<HTMLDivElement>(null);
  // Where the picture starts, from the middle of the screen (the screen's own pixels: it may be drawn
  // scaled), set before it's first drawn so the flight starts there.
  useLayoutEffect(() => {
    const el = box.current, f = show.from;
    if (!el || !fly.current || !f) return;
    const r = el.getBoundingClientRect(), k = drawnScale(el);
    fly.current.style.setProperty("--dx", `${(f.left + f.width / 2 - (r.left + r.width / 2)) / k}px`);
    fly.current.style.setProperty("--dy", `${(f.top + f.height / 2 - (r.top + r.height / 2)) / k}px`);
  }, [show.from]);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  useEffect(() => { const t = window.setTimeout(finish, FALLBACK_MS); return () => window.clearTimeout(t); });

  return (
    <div ref={box} className="claim-burst" onClick={finish} role="status" aria-label={show.text}>
      <div ref={fly} className="claim-fly" onAnimationEnd={(e) => { if (e.target === e.currentTarget) finish(); }}>
        <span className="claim-rays" style={{ "--tint": show.tint } as React.CSSProperties} />
        {Array.from({ length: CLAIM_SPARKS }, (_, i) => (
          <span key={i} className="claim-spark" style={{ "--a": `${(360 * i) / CLAIM_SPARKS + (i % 2) * 12}deg`, "--r": `${i % 2 ? 92 : 120}px` } as React.CSSProperties}>✦</span>
        ))}
        <span className="claim-pic">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={show.art} alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {show.inside && <img className="claim-inside" src={show.inside} alt="" draggable={false} />}
        </span>
        <span className="claim-text pixel-font">{show.text}</span>
      </div>
    </div>
  );
}
