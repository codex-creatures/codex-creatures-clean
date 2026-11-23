// lib/pvp/ranked.ts
// The ranked ladder's two queues (the user, 2026-11-24): 3v3 with Rare the
// rarest creature or gear, everyone at Lv 15; and 5v5 up to Legendary at
// Lv 25. Both scaled: every creature fights at exactly the level. You queue
// at the PvP portal's Ranked tab and are matched with a simulated rival
// (lib/pvp/rivals.ts) near your rating (lib/pvp/elo.ts).

import { makeFormat, type PvpFormat } from "./formats";

export type RankedQueue = "3v3" | "5v5";
export const RANKED_QUEUES: RankedQueue[] = ["3v3", "5v5"];
export const RANKED_FORMATS: Record<RankedQueue, PvpFormat> = {
  "3v3": makeFormat({ size: 3, maxRarity: "rare", level: 15, scaleUp: true }),
  "5v5": makeFormat({ size: 5, maxRarity: "legendary", level: 25, scaleUp: true }),
};
export const rankedQueueOf = (formatId: string): RankedQueue | undefined => RANKED_QUEUES.find((q) => RANKED_FORMATS[q].id === formatId);

// The short wait before a match is made (it feels like a queue; the rival is
// chosen at once).
export const QUEUE_SECONDS = 2;
