"use client";
// hooks/useNewDen.ts
// The Den's options (lib/den3d/setting.ts), for the screens that change with them: null until the page is
// in the browser (they're per device, so the server can't know), then their values, again whenever
// Settings changes them. (The file's name is from when the Den had an old one beside it.)

import { useSyncExternalStore } from "react";
import { parseDenOptions, writeDenOptions, DEN_OPTIONS_KEY, type DenOptions } from "@/lib/den3d/setting";

const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const tell = () => { for (const f of listeners) f(); };

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
