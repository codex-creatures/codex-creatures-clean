"use client";
// components/dungeon/Shaker.tsx
// Shakes its contents each time `shake` goes up (the witch's stab, an illness). Moved out of app/dungeon/page.tsx as it was.

import { useEffect, useRef } from "react";

// Shakes its contents each time `shake` goes up (the witch's stab, an illness).
export default function Shaker({ shake, fill, children }: { shake: number; fill?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || shake === 0) return;
    el.classList.remove("screen-shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("screen-shake");
  }, [shake]);
  return <div ref={ref} style={fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>{children}</div>;
}
