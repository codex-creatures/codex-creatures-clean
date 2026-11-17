"use client";
// hooks/useNewDen.ts
// 🧪 Whether the new Den is switched on (lib/den3d/setting.ts), for the screens that change with it:
// null until the page is in the browser (it's per device, so the server can't know), then on or off,
// and again whenever Settings switches it.

import { useSyncExternalStore } from "react";
import { readNewDen, writeNewDen } from "@/lib/den3d/setting";

const listeners = new Set<() => void>();
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export function useNewDen(): boolean | null {
  return useSyncExternalStore(subscribe, () => readNewDen(window.localStorage), () => null);
}

export function switchNewDen(on: boolean) {
  writeNewDen(window.localStorage, on);
  for (const f of listeners) f();
}
