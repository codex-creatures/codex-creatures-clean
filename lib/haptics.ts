// lib/haptics.ts
// Vibration (Settings): a tiny buzz on hits, precise hits and level-ups.
// Phones only, and only where the browser lets a page vibrate (Android
// Chrome does; iPhone browsers don't, so the switch is hidden there). Off
// until you turn it on. Kept per device like Screen size (lib/uiScale.ts):
// not in the save, so it isn't carried in an exported save file.

export const HAPTICS_KEY = "codex_creatures_haptics_v1";

// Patterns in ms (buzz, pause, buzz, ...). Kept short: a nudge, not a rattle.
export const HAPTIC_PATTERNS = {
  hit: [18],               // a hit lands
  precise: [35, 40, 60],   // a precise hit (either side): a double thump
  levelUp: [30, 60, 30, 60, 90],
} as const;
export type HapticKind = keyof typeof HAPTIC_PATTERNS;

type Store = Pick<Storage, "getItem" | "setItem">;

export function readHaptics(store: Store): boolean {
  try { return store.getItem(HAPTICS_KEY) === "1"; } catch { return false; }
}

export function writeHaptics(store: Store, on: boolean): boolean {
  try { store.setItem(HAPTICS_KEY, on ? "1" : "0"); } catch { /* storage full or blocked */ }
  return on;
}

// Which buzz a battle attack gets, if any: a miss or a dodge gets none.
export function attackHaptic(e: { missed: boolean; evaded?: boolean; damage: number; precise: boolean }): HapticKind | null {
  if (e.missed || e.evaded || e.damage <= 0) return null;
  return e.precise ? "precise" : "hit";
}

// Can this browser vibrate at all?
export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

// Buzz, if it's switched on and the browser can.
export function buzz(kind: HapticKind | null) {
  if (!kind || !canVibrate()) return;
  try {
    if (readHaptics(window.localStorage)) navigator.vibrate([...HAPTIC_PATTERNS[kind]]);
  } catch { /* some browsers throw without a recent tap: it's only a nicety */ }
}
