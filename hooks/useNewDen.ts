"use client";
// hooks/useNewDen.ts
// 🧪 Whether the new Den is switched on (lib/den3d/setting.ts), and its options, for the screens that change
// with them: null until the page is in the browser (they're per device, so the server can't know), then
// their values, again whenever Settings changes them.

import { useSyncExternalStore } from "react";
import { readNewDen, writeNewDen, parseDenOptions, writeDenOptions, DEN_OPTIONS_KEY, type DenOptions } from "@/lib/den3d/setting";

const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const tell = () => { for (const f of listeners) f(); };

export function useNewDen(): boolean | null {
  return useSyncExternalStore(subscribe, () => readNewDen(window.localStorage), () => null);
}

export function switchNewDen(on: boolean) {
  writeNewDen(window.localStorage, on);
  tell();
}

// (The same object back while the stored value's unchanged, as useSyncExternalStore needs.)
let cached: { raw: string | null; options: DenOptions } | null = null;
function snapshot(): DenOptions {
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(DEN_OPTIONS_KEY); } catch { /* blocked */ }
  if (!cached || cached.raw !== raw) cached = { raw, options: parseDenOptions(raw) };
  return cached.options;
}
export function useDenOptions(): DenOptions | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function setDenOptions(o: DenOptions) {
  writeDenOptions(window.localStorage, o);
  tell();
}
