// lib/online/ranked.ts
// The ranked ladder on the server (supabase/migrations/…_ranked.sql): one
// table of ratings for players and the simulated rivals alike, every match
// kept with its log, and the rivals' daily round posted once a day. The
// server works the Elo out itself (lib/pvp/elo.ts has the same sums for
// showing what a match will be worth). Everything takes the client as an
// argument, so tests hand in a stand-in; offline, every call says null.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BattleEvent } from "../combat/battle";
import type { DuelResult, OverReason } from "../pvp/duel";

export const RANKED_TIMEOUT_MS = 10_000;
// A match log longer than this is cut to its last events before it's sent (the server keeps 80 KB a log).
export const LOG_EVENTS_KEPT = 400;

export type LadderRow = { rank: number; id: string; name: string; rating: number; games: number; ai: boolean; me: boolean };
export type Ladder = {
  top: LadderRow[];
  me: { rank: number; rating: number; games: number } | null;
  rivals: { id: string; rating: number }[];
  lastRound: string | null; // the last day a rivals' round was posted ('YYYY-MM-DD'), if any
};
export type RatingMove = { before: number; after: number; rival: { before: number; after: number } };

function timeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), RANKED_TIMEOUT_MS)),
  ]);
}

const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

export function parseLadder(data: unknown): Ladder | null {
  const o = data as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.top) || !Array.isArray(o.rivals)) return null;
  const top: LadderRow[] = [];
  for (const x of o.top) {
    const r = x as Record<string, unknown>;
    const rank = int(r.rank), rating = int(r.rating), games = int(r.games);
    if (rank === null || rating === null || games === null || typeof r.id !== "string" || typeof r.name !== "string") return null;
    top.push({ rank, id: r.id, name: r.name, rating, games, ai: r.ai === true, me: r.me === true });
  }
  const rivals: Ladder["rivals"] = [];
  for (const x of o.rivals) {
    const r = x as Record<string, unknown>;
    const rating = int(r.rating);
    if (typeof r.id !== "string" || rating === null) return null;
    rivals.push({ id: r.id, rating });
  }
  const m = o.me as Record<string, unknown> | null | undefined;
  const me = m && typeof m === "object" && int(m.rank) !== null && int(m.rating) !== null ? { rank: int(m.rank)!, rating: int(m.rating)!, games: int(m.games) ?? 0 } : null;
  return { top, me, rivals, lastRound: typeof o.lastRound === "string" ? o.lastRound : null };
}

export function parseRatingMove(data: unknown): RatingMove | null {
  const o = data as Record<string, unknown> | null;
  const r = o?.rival as Record<string, unknown> | undefined;
  const before = int(o?.before), after = int(o?.after), rb = int(r?.before), ra = int(r?.after);
  if (before === null || after === null || rb === null || ra === null) return null;
  return { before, after, rival: { before: rb, after: ra } };
}

// The ladder, or null if it couldn't be fetched (offline, signed out).
export async function fetchLadder(client: SupabaseClient): Promise<Ladder | null> {
  try {
    const { data, error } = await timeout(client.rpc("pvp_leaderboard"));
    return error ? null : parseLadder(data);
  } catch {
    return null;
  }
}

// A match's log as it's kept: the last LOG_EVENTS_KEPT events.
export const logToKeep = (log: readonly BattleEvent[]) => (log.length > LOG_EVENTS_KEPT ? log.slice(-LOG_EVENTS_KEPT) : [...log]);

// A ranked match you played: both ratings move on the server. null if it couldn't be posted.
export async function reportRanked(client: SupabaseClient, m: { rival: string; format: string; result: DuelResult; reason: OverReason; log: readonly BattleEvent[] }): Promise<RatingMove | null> {
  try {
    const { data, error } = await timeout(client.rpc("ranked_result", { rival: m.rival, format: m.format, result: m.result, reason: m.reason, log: logToKeep(m.log) }));
    return error ? null : parseRatingMove(data);
  } catch {
    return null;
  }
}

export type RoundResult = { a: string; b: string; format: string; winner: "a" | "b" | "draw"; log: readonly BattleEvent[] };

// The rivals' round for a day. true: taken; false: someone had posted that day already; null: couldn't be posted.
export async function postRivalRound(client: SupabaseClient, day: string, results: RoundResult[]): Promise<boolean | null> {
  try {
    const { data, error } = await timeout(client.rpc("rival_round", { day, results: results.map((r) => ({ ...r, log: logToKeep(r.log) })) }));
    return error ? null : data === true;
  } catch {
    return null;
  }
}
