"use client";
// components/altar/AltarBackdrop.tsx
// Behind the Soul Altar's screens: you stand over the altar, its cauldron of
// soul fire big at the bottom (the Den's altar art, its 8 frames playing:
// globals.css .altar-fire), teal light welling up from it into the dark, and
// spirit motes drifting up. Fills its (positioned) parent; never takes taps.

const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: 18 + ((i * 37) % 64),          // % across, bunched over the cauldron
  delay: -((i * 1.7) % 9),             // s, so they're already rising
  dur: 7 + (i % 5) * 1.3,              // s
  dx: ((i % 3) - 1) * 18,              // px of drift
  size: 3 + (i % 3),
}));

export default function AltarBackdrop({ size = "92cqw", lift = "-8%", dim = 0 }: {
  size?: string;  // how big the cauldron's drawn
  lift?: string;  // its bottom edge (negative: sunk below the screen's edge)
  dim?: number;   // 0–1: darken it, for a screen with a lot over it
}) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0,
      background: "radial-gradient(ellipse 90% 55% at 50% 100%, #0f3a36 0%, #0a1c20 38%, #06090d 70%, #040509 100%)" }}>
      {/* Light rising off the fire. */}
      <div style={{ position: "absolute", left: "10%", right: "10%", bottom: "8%", height: "70%",
        background: "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(80, 230, 200, 0.18), transparent 70%)" }} />
      {MOTES.map((m, i) => (
        <span key={i} className="altar-mote" style={{ left: `${m.left}%`, bottom: "16%", width: m.size, height: m.size,
          animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s`, ["--dx" as string]: `${m.dx}px` }} />
      ))}
      <div style={{ position: "absolute", left: "50%", bottom: lift, transform: "translateX(-50%)" }}>
        <div className="altar-fire" style={{ ["--s" as string]: size }} />
      </div>
      {dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(4, 5, 9, ${dim})` }} />}
    </div>
  );
}
