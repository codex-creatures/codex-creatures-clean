// lib/pvp/roundWorker.ts
// The rivals' daily round, played off the main thread (a Web Worker), so the
// hard AI's thinking (a second or more a move in a 5v5) never stalls the
// game while the round runs in the background (lib/pvp/dailyRound.ts).
// In: { day, ids }. Out: { done: n } after each battle, then { results }.

import { playRoundBattle, roundPairs } from "./dailyRound";
import type { RoundResult } from "../online/ranked";

export type RoundIn = { day: string; ids: string[] };
export type RoundOut = { done: number } | { results: RoundResult[] };

self.onmessage = (e: MessageEvent<RoundIn>) => {
  const { day, ids } = e.data;
  const results: RoundResult[] = [];
  roundPairs(day, ids).forEach((p, i) => {
    const r = playRoundBattle(p);
    if (r) results.push(r);
    (self as unknown as Worker).postMessage({ done: i + 1 } satisfies RoundOut);
  });
  (self as unknown as Worker).postMessage({ results } satisfies RoundOut);
};
