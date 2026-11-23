"use client";
// hooks/useScrollKeep.ts
// Tabs inside a scrolling screen keep their place (the user, 2026-11-24: the Storehouse's and Klutz's tabs sent
// you back to the top). Before the tab changes, `before()` notes how far down the screen is; once the new tab has
// rendered, it's put back there (the browser clamps it if the new tab is shorter: "roughly the same").
// `ref` goes on any element inside the scrolling box (the nearest scrolling ancestor is found from it).

import { useLayoutEffect, useRef } from "react";

export function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

export function useScrollKeep<T>(tab: T) {
  const ref = useRef<HTMLDivElement>(null);
  const kept = useRef<number | null>(null);
  const before = () => { kept.current = scrollParentOf(ref.current)?.scrollTop ?? null; };
  useLayoutEffect(() => {
    if (kept.current === null) return;
    const box = scrollParentOf(ref.current);
    if (box) box.scrollTop = kept.current;
    kept.current = null;
  }, [tab]);
  return { ref, before };
}
