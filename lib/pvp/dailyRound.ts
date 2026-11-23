// lib/pvp/dailyRound.ts
// The rivals' daily round (the user, 2026-11-24: "each AI battles each other
// once every day to adjust the Elo", run by whoever opens the PvP portal; "you
// don't have to stay in there"). The game has no server of its own, so the
// first signed-in player to open the portal each day plays the day's battles
// here, in the background, one at a time between frames, and posts them; the
// server takes one round a day, so a second player's copy is turned away.
// It carries on wherever the player goes in the game (it lives in this
// module, not a screen) and stops only with the tab.
//
// The pairings are fixed by the day (lib/pvp/elo.ts dailyPairs) and the
// queues taken by turns, so any player's copy plays the same round.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiLevel } from "../combat/thinkingAi";
import { dailyPairs, dayKey } from "./elo";
import { RANKED_FORMATS, RANKED_QUEUES } from "./ranked";
import { RIVAL_PVP_AI, playRivalMatch } from "./rivalMatch";
import { RIVALS, rivalById } from "./rivals";
import { fetchLadder, postRivalRound, type RoundResult } from "../online/ranked";

export type RoundState = { day: string; played: number; of: number; status: "playing" | "posted" | "taken" | "failed" };
// Who plays the battles: here, or (the portal) a worker, so the game doesn't stall. onBattle: one more done.
export type RoundPlayer = (day: string, ids: string[], onBattle: (done: number) => void) => Promise<RoundResult[]>;

let running: Promise<RoundState> | null = null;
let last: RoundState | null = null;
const watchers = new Set<(s: RoundState | null) => void>();
const tell = () => { for (const w of watchers) w(last); };

// Where the round is (for the Ranked tab's line), and a way to watch it.
export const roundState = () => last;
export function watchRound(w: (s: RoundState | null) => void) { watchers.add(w); return () => { watchers.delete(w); }; }

// The day's pairings with their queues: pair i in queue i (by turns).
export const roundPairs = (day: string, ids: string[]) => dailyPairs(ids, day).map(([a, b], i) => ({ a, b, format: RANKED_FORMATS[RANKED_QUEUES[i % RANKED_QUEUES.length]] }));

// One of the day's battles, played out.
export function playRoundBattle(p: { a: string; b: string; format: (typeof RANKED_FORMATS)[keyof typeof RANKED_FORMATS] }, level: AiLevel = RIVAL_PVP_AI): RoundResult | null {
  const ra = rivalById(p.a), rb = rivalById(p.b);
  const m = ra && rb ? playRivalMatch(ra, rb, p.format, level) : null;
  return m ? { a: p.a, b: p.b, format: p.format.id, winner: m.winner, log: m.state.log } : null;
}

// The whole round, played here (a breath between battles).
export function playRound(day: string, ids: string[] = RIVALS.map((r) => r.id), level: AiLevel = RIVAL_PVP_AI): RoundResult[] {
  return roundPairs(day, ids).flatMap((p) => { const r = playRoundBattle(p, level); return r ? [r] : []; });
}
const playHere: RoundPlayer = async (day, ids, onBattle) => {
  const out: RoundResult[] = [];
  for (const [i, p] of roundPairs(day, ids).entries()) {
    await new Promise<void>((r) => setTimeout(r, 0));
    const r = playRoundBattle(p);
    if (r) out.push(r);
    onBattle(i + 1);
  }
  return out;
};

// Starts today's round if the server hasn't had one yet (and none is running here). Resolves when it's done.
export function startDailyRound(client: SupabaseClient, now = new Date(), play: RoundPlayer = playHere): Promise<RoundState> {
  if (running) return running;
  const day = dayKey(now);
  if (last?.day === day && last.status !== "failed") return Promise.resolve(last);
  running = (async () => {
    const ladder = await fetchLadder(client);
    if (!ladder) return (last = { day, played: 0, of: 0, status: "failed" });
    if (ladder.lastRound && ladder.lastRound >= day) return (last = { day, played: 0, of: 0, status: "taken" });
    const ids = RIVALS.map((r) => r.id);
    last = { day, played: 0, of: roundPairs(day, ids).length, status: "playing" };
    tell();
    const results = await play(day, ids, (done) => { last = { ...last!, played: done }; tell(); });
    const posted = await postRivalRound(client, day, results);
    last = { ...last!, played: last!.of, status: posted === true ? "posted" : posted === false ? "taken" : "failed" };
    tell();
    return last;
  })().finally(() => { running = null; });
  return running;
}
