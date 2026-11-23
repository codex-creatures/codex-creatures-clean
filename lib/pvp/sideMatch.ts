// lib/pvp/sideMatch.ts
// After every ranked match you play, two random rivals fight each other too
// (the user, 2026-11-24: "every time you play a battle, 2 random AI also
// battle, meaning that it continues to move"): the ladder shifts under
// everyone, not only where you fought. Your machine plays it, in the format
// you just played, once your own result is saved (app/duel), in the daily
// round's worker (lib/pvp/roundWorker.ts) so the game doesn't stall; then it's
// posted (rival_match on the server, which takes one only just after a ranked
// match you reported). Nothing is shown: it's the ladder moving in the background.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PvpFormat } from "./formats";
import { playRoundBattle } from "./dailyRound";
import { RIVALS } from "./rivals";
import { postRivalMatch, type RoundResult } from "../online/ranked";

export type SidePair = { a: string; b: string; format: PvpFormat };
// Who plays the battle: here, or (the game) a worker (lib/pvp/workerPlay.ts).
export type SidePlayer = (pair: SidePair) => Promise<RoundResult | null>;

// Two different rivals at random, in the format given.
export function pickSidePair(format: PvpFormat, ids: string[] = RIVALS.map((r) => r.id), rng: () => number = Math.random): SidePair | null {
  if (ids.length < 2) return null;
  const a = ids[Math.floor(rng() * ids.length)];
  const rest = ids.filter((id) => id !== a);
  return { a, b: rest[Math.floor(rng() * rest.length)], format };
}

const playHere: SidePlayer = async (pair) => {
  await new Promise<void>((r) => setTimeout(r, 0));
  return playRoundBattle(pair);
};

// Plays one side match and posts it. true if it counted on the ladder.
export async function startSideMatch(client: SupabaseClient, format: PvpFormat, play: SidePlayer = playHere, pair: SidePair | null = pickSidePair(format)): Promise<boolean> {
  if (!pair) return false;
  try {
    const r = await play(pair);
    return r ? await postRivalMatch(client, r) : false;
  } catch {
    return false;
  }
}
