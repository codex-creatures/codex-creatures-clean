"use client";
// components/PlayClock.tsx
// Counts time played (lib/playTime.ts) while the game is on screen and
// you're not idle. Draws nothing. It holds the total in memory, tells
// Settings every second, and writes it into the save every few seconds and
// whenever the page is hidden or closed.
//
// It only adds to a save that already exists (so it never starts a game on
// its own), and never on the title screen, where slots are being swapped.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { readSave, savesLocked, writeSaveField, SAVE_KEY } from "@/lib/save";
import { countedMs, readPlayTime, PLAY_TIME_EVENT, PLAY_TIME_FIELD } from "@/lib/playTime";

const TICK_MS = 1000;
const WRITE_EVERY_MS = 10_000;

export default function PlayClock() {
  const path = usePathname();
  const paused = useRef(false);
  const flushRef = useRef<() => void>(() => {});

  useEffect(() => {
    let lastInput = Date.now(), lastTick = Date.now(), lastWrite = Date.now();
    let unsaved = 0; // ms counted but not yet in the save
    const hasSave = () => { try { return window.localStorage.getItem(SAVE_KEY) !== null; } catch { return false; } };

    // Into the save: read its total fresh (a slot swap or import may have
    // changed the game), add what's counted since.
    const flush = () => {
      lastWrite = Date.now();
      const secs = Math.floor(unsaved / 1000);
      if (secs < 1 || paused.current || savesLocked() || !hasSave()) return;
      unsaved -= secs * 1000;
      writeSaveField(PLAY_TIME_FIELD, readPlayTime(readSave()) + secs);
    };

    flushRef.current = flush;

    const tick = () => {
      const now = Date.now();
      const add = paused.current || !hasSave() ? 0 : countedMs(now - lastTick, now - lastInput, document.visibilityState === "visible");
      lastTick = now;
      unsaved += add;
      if (now - lastWrite >= WRITE_EVERY_MS) flush();
      if (add > 0) window.dispatchEvent(new CustomEvent(PLAY_TIME_EVENT, { detail: readPlayTime(readSave()) + Math.floor(unsaved / 1000) }));
    };

    const input = () => { lastInput = Date.now(); };
    const hidden = () => { if (document.visibilityState !== "visible") flush(); };
    const inputs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    inputs.forEach((e) => window.addEventListener(e, input, { passive: true }));
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", flush);
    const id = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(id);
      flush();
      inputs.forEach((e) => window.removeEventListener(e, input));
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  // Into the title screen: what's counted goes to the game you were in
  // first, before a slot swap can change it.
  useEffect(() => {
    flushRef.current();
    paused.current = path.startsWith("/start");
  }, [path]);

  return null;
}
