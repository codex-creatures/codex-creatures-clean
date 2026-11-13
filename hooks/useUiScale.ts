// hooks/useUiScale.ts
// The screen size picked in Settings (lib/uiScale.ts), kept in step when it
// changes (or the window changes shape: a laptop starts bigger). 1 until
// the page has loaded in the browser. A short phone screen starts smaller: its
// height is taken once, as the game loads, so the keyboard opening (or the
// browser's bars hiding) doesn't resize everything while you play.

import { useSyncExternalStore } from "react";
import { readUiScale, UI_SCALE_EVENT } from "@/lib/uiScale";

// The same test as the laptop layout of .game-screen in globals.css.
const WIDE = "(min-aspect-ratio: 3 / 4)";

const subscribe = (on: () => void) => {
  const wide = window.matchMedia(WIDE);
  window.addEventListener(UI_SCALE_EVENT, on);
  wide.addEventListener("change", on);
  return () => { window.removeEventListener(UI_SCALE_EVENT, on); wide.removeEventListener("change", on); };
};

let loadHeight: number | undefined;
const height = () => (loadHeight ??= window.innerHeight);

export function useUiScale(): number {
  return useSyncExternalStore(subscribe, () => readUiScale(window.localStorage, window.matchMedia(WIDE).matches, height()), () => 1);
}
