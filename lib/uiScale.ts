// lib/uiScale.ts
// Screen size (Settings): makes everything inside the game screen bigger or
// smaller, for screens where the game looks too small or too big. It's kept
// per device (not in the save, so it isn't carried in an exported save file):
// a laptop and a phone each have their own. Until you pick one, a phone
// starts at 100% and a laptop (a wide window, where the game is the portrait
// screen in the middle) at LAPTOP_UI_SCALE: at 100% everything looked too
// small there, and 175% browser zoom was the right size.

export const UI_SCALE_KEY = "codex_creatures_ui_scale_v1";
export const UI_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
export const LAPTOP_UI_SCALE = 1.75;
export const UI_SCALE_EVENT = "codex-ui-scale"; // fired on window when it changes

type Store = Pick<Storage, "getItem" | "setItem">;

// The size you start on: wide = a laptop-shaped window.
export const defaultUiScale = (wide: boolean) => (wide ? LAPTOP_UI_SCALE : 1);

// The nearest allowed size (the default for anything broken).
export function clampUiScale(v: unknown, fallback = 1): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return UI_SCALES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), 1);
}

// What you picked, or the default for this screen.
export function readUiScale(store: Store, wide = false): number {
  const fallback = defaultUiScale(wide);
  try {
    const v = store.getItem(UI_SCALE_KEY);
    return v === null ? fallback : clampUiScale(v, fallback);
  } catch { return fallback; }
}

export function writeUiScale(store: Store, v: number): number {
  const s = clampUiScale(v);
  try { store.setItem(UI_SCALE_KEY, String(s)); } catch { /* storage full or blocked: it still applies until reload */ }
  return s;
}

// How much bigger an element is drawn than its own layout size: pointer
// positions (clientX) are in drawn pixels, so divide by this to get the
// element's own pixels.
export const drawnScale = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1) || 1;
