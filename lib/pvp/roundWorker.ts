// lib/pvp/roundWorker.ts
// The rivals' battles, played off the main thread (a Web Worker), so the
// hard AI's thinking (a second or more a move in a 5v5) never stalls the
// game: the daily round (lib/pvp/dailyRound.ts) and the side match after a
// ranked match (lib/pvp/sideMatch.ts). Driven from lib/pvp/workerPlay.ts.
// In: { day, ids } (the day's round) or { pair } (one side match).
// Out: { done: n } after each battle, then { results }.

import { playRoundBattle, roundPairs } from "./dailyRound";
import type { SidePair } from "./sideMatch";
import type { RoundResult } from "../online/ranked";

export type RoundIn = { day: string; ids: string[] } | { pair: SidePair };
export type RoundOut = { done: number } | { results: RoundResult[] };

self.onmessage = (e: MessageEvent<RoundIn>) => {
  const pairs = "pair" in e.data ? [e.data.pair] : roundPairs(e.data.day, e.data.ids);
  const results: RoundResult[] = [];
  pairs.forEach((p, i) => {
    const r = playRoundBattle(p);
    if (r) results.push(r);
    (self as unknown as Worker).postMessage({ done: i + 1 } satisfies RoundOut);
  });
  (self as unknown as Worker).postMessage({ results } satisfies RoundOut);
};
