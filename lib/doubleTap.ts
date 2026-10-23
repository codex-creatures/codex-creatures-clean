// lib/doubleTap.ts
// Double tap: a second tap on the same thing, quickly, does its main action
// (equip the piece you're looking at, take the loot) without reaching for
// the button. The first tap still just picks it, as before.

export const DOUBLE_TAP_MS = 400; // the most time between the two taps

// A tap tracker: call it with what was tapped (and when); true means this tap
// is the second of a double tap. It then forgets, so a third tap starts afresh.
export function doubleTapper(ms = DOUBLE_TAP_MS) {
  let last: { key: string; at: number } | null = null;
  return (key: string, now = Date.now()): boolean => {
    const twice = !!last && last.key === key && now - last.at <= ms;
    last = twice ? null : { key, at: now };
    return twice;
  };
}
