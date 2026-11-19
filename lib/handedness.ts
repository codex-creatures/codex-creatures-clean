// lib/handedness.ts
// Left-handed mode (Settings; the user, 2026-11-20): in the Labyrinth the walk
// stick moves to the bottom left, and the dock's most-pressed buttons (Bag,
// then Retreat) to the left with it. Kept per device like Vibration
// (lib/haptics.ts): not in the save, so it isn't carried in an exported file.

import { useSyncExternalStore } from "react";

export const HAND_KEY = "codex_creatures_hand_v1";

type Store = Pick<Storage, "getItem" | "setItem">;

export function readLeftHanded(store: Store): boolean {
  try { return store.getItem(HAND_KEY) === "left"; } catch { return false; }
}

const listeners = new Set<() => void>();
export function writeLeftHanded(store: Store, left: boolean): boolean {
  try { store.setItem(HAND_KEY, left ? "left" : "right"); } catch { /* storage full or blocked */ }
  listeners.forEach((l) => l());
  return left;
}

// For a screen: whether it's on, kept up to date if Settings changes it.
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useLeftHanded = () => useSyncExternalStore(subscribe, () => readLeftHanded(window.localStorage), () => false);
