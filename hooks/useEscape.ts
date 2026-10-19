"use client";
// hooks/useEscape.ts
// Esc closes whatever's open (a window, a panel over the battle…), like
// tapping its ✕. It also marks the key as used (preventDefault), so the
// page doesn't go back as well (components/EscapeBack.tsx). Pass null when
// nothing's open, or a do-nothing function to just keep the page put.

import { useEffect, useRef } from "react";

export function useEscape(onEscape: (() => void) | null) {
  const ref = useRef(onEscape);
  useEffect(() => { ref.current = onEscape; });
  const on = onEscape !== null;
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      ref.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);
}
