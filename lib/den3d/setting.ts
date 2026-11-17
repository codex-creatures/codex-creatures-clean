// lib/den3d/setting.ts
// 🧪 The new Den (Settings → "New Den"), off until you turn it on (the user, 2026-11-18: to
// test it live before it replaces the old one). Kept per device like Screen size and Vibration
// (lib/uiScale.ts, lib/haptics.ts): not in the save, so it isn't carried in an exported file.
// It switches the Den's picture (components/Den3D.tsx) and the battle bag's going home with it
// (lib/den3d/bag.ts: the bag empties into storage after a run).

export const NEW_DEN_KEY = "codex_creatures_den3d_v1";

type Store = Pick<Storage, "getItem" | "setItem">;

export function readNewDen(store: Store): boolean {
  try { return store.getItem(NEW_DEN_KEY) === "1"; } catch { return false; }
}

export function writeNewDen(store: Store, on: boolean): boolean {
  try { store.setItem(NEW_DEN_KEY, on ? "1" : "0"); } catch { /* storage full or blocked */ }
  return on;
}

// In the browser (false on the server, and wherever storage is blocked).
export const newDenOn = () => typeof window !== "undefined" && readNewDen(window.localStorage);
