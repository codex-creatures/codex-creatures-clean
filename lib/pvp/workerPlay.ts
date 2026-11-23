// lib/pvp/workerPlay.ts
// The rivals' battles played in a Web Worker (lib/pvp/roundWorker.ts), so the
// hard AI's thinking (a second or more a move in a 5v5) never stalls the game:
// the daily round (the PvP portal, lib/pvp/dailyRound.ts) and the side match
// after a ranked match (the duel screen, lib/pvp/sideMatch.ts). Without
// workers (tests), both are undefined and each module plays its battles
// itself, a breath apart.

import type { RoundPlayer } from "./dailyRound";
import type { SidePlayer } from "./sideMatch";
import type { RoundIn, RoundOut } from "./roundWorker";
import type { RoundResult } from "../online/ranked";

function inWorker(input: RoundIn, onBattle: (done: number) => void): Promise<RoundResult[]> {
  return new Promise((resolve, reject) => {
    try {
      const w = new Worker(new URL("./roundWorker.ts", import.meta.url));
      w.onmessage = (e: MessageEvent<RoundOut>) => {
        if ("done" in e.data) onBattle(e.data.done);
        else { resolve(e.data.results); w.terminate(); }
      };
      w.onerror = (e) => { reject(e); w.terminate(); };
      w.postMessage(input);
    } catch (e) { reject(e); }
  });
}

const haveWorkers = typeof Worker !== "undefined";
export const roundPlayer: RoundPlayer | undefined = haveWorkers ? (day, ids, onBattle) => inWorker({ day, ids }, onBattle) : undefined;
export const sidePlayer: SidePlayer | undefined = haveWorkers ? async (pair) => (await inWorker({ pair }, () => {}))[0] ?? null : undefined;
