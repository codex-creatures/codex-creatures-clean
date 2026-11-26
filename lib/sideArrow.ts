// lib/sideArrow.ts
// How far down the screen the previous / next arrows sit (components/SideArrow.tsx), as a share
// of its height: where the screen's middle third meets its bottom third, unless you've pressed,
// held and dragged them somewhere else (the user, 2026-11-26). Kept per device like left-handed
// mode (lib/handedness.ts): not in the save.

import { useSyncExternalStore } from "react";

export const SIDE_ARROW_KEY = "codex_creatures_side_arrow_v1";
export const SIDE_ARROW_AT = 2 / 3;
// Never dragged off the screen's top or bottom (the button is 52px; these leave it whole on a small phone).
export const SIDE_ARROW_MIN = 0.12;
export const SIDE_ARROW_MAX = 0.9;
// How long a press is held before the arrows lift to be dragged (ms), and how far a finger may
// wander meanwhile (px) before it's not a hold.
export const SIDE_ARROW_HOLD_MS = 350;
export const SIDE_ARROW_SLOP = 8;

type Store = Pick<Storage, "getItem" | "setItem">;

export const clampSideArrow = (at: number) => Math.min(SIDE_ARROW_MAX, Math.max(SIDE_ARROW_MIN, at));

export function readSideArrow(store: Store): number {
  try {
    const at = Number(store.getItem(SIDE_ARROW_KEY));
    return store.getItem(SIDE_ARROW_KEY) !== null && Number.isFinite(at) ? clampSideArrow(at) : SIDE_ARROW_AT;
  } catch { return SIDE_ARROW_AT; }
}

const listeners = new Set<() => void>();
export function writeSideArrow(store: Store, at: number): number {
  const v = clampSideArrow(at);
  try { store.setItem(SIDE_ARROW_KEY, v.toFixed(4)); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
  return v;
}

// For the arrows: where they sit, both moving together when either is dragged.
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useSideArrowAt = () => useSyncExternalStore(subscribe, () => readSideArrow(window.localStorage), () => SIDE_ARROW_AT);
