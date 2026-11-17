// lib/den3d/bag.ts
// What comes out of the battle bag when a run ends (app/dungeon/page.tsx goHome). Always: what you
// found down there (gear, codexes, flares…) goes into storage, codexes onto the bookcase while it has
// room (one that doesn't fit stays in the bag). 🧪 With the new Den on (lib/den3d/setting.ts; the user,
// 2026-11-18), the whole bag empties: potions back into storage, packed gear just leaves the bag (it
// never left storage), so you pack afresh at the Labyrinth's entrance each run. Without it, potions
// and packed gear stay in the bag between runs, as before.

import { isPotionEntry, lootIdOf, type BagEntry, type PotionKey } from "../dungeon/run";
import type { Drop } from "../types";

export function bagHome(bag: BagEntry[], loot0: Record<string, Drop>, shelfFree: number, emptyAll: boolean): {
  home: Drop[]; potions: PotionKey[]; bag: BagEntry[]; loot: Record<string, Drop>;
} {
  const loot = { ...loot0 }, home: Drop[] = [], potions: PotionKey[] = [], kept: BagEntry[] = [];
  let shelf = shelfFree;
  for (const e of bag) {
    const id = lootIdOf(e), x = id ? loot[id] : undefined;
    if (id && x) {
      if (x.dropType === "item" && x.codexMove) {
        if (shelf <= 0) { kept.push(e); continue; } // the bookcase is full: it stays in the bag
        shelf--;
      }
      home.push(x);
      delete loot[id];
    } else if (id) continue;                         // (a loot entry with nothing behind it: dropped)
    else if (!emptyAll) kept.push(e);
    else if (isPotionEntry(e)) potions.push(e);      // (packed gear: nothing to do, it's still in storage)
  }
  return { home, potions, bag: kept, loot };
}
