// lib/pvp/elo.ts
// The ranked ladder's rating (docs/design/online.md §12; the user, 2026-11-24):
// plain Elo. Everyone starts at ELO_START; a win over an equal is worth
// ELO_K / 2. The same rules rate players and the simulated rivals alike
// (lib/pvp/rivals.ts), so one ladder holds them all.
//
// Also here: which rival you're matched with (the nearest in rating, with a
// little chance so it isn't always the same one), and the rivals' daily
// round (each rival fights two others, the pairings fixed by the day, so
// whoever's browser runs the round gets the same battles).

import { seeded } from "../creatures/soulStones";
import type { DuelResult } from "./duel";

export const ELO_START = 1000;
export const ELO_K = 32;

// How likely a is to beat b (0 to 1).
export const expectedScore = (a: number, b: number) => 1 / (1 + 10 ** ((b - a) / 400));

// The score a result is worth to the side it's seen from.
export const resultScore = (r: DuelResult) => (r === "win" ? 1 : r === "loss" ? 0 : 0.5);

// Both ratings after a match, seen from a's side.
export function eloUpdate(a: number, b: number, result: DuelResult, k = ELO_K): { a: number; b: number } {
  const s = resultScore(result);
  const ea = expectedScore(a, b);
  const change = Math.round(k * (s - ea));
  return { a: a + change, b: b - change };
}

// What a would gain (or lose) from this result.
export const ratingChange = (a: number, b: number, result: DuelResult, k = ELO_K) => eloUpdate(a, b, result, k).a - a;

// How many of the nearest rivals the match is drawn from.
export const MATCH_NEAREST = 2;

// The rival you're matched with: one of the MATCH_NEAREST nearest in rating,
// at random, never the one you fought last if there's anyone else.
export function pickRival<T extends { id: string; rating: number }>(rivals: readonly T[], rating: number, lastId?: string, rng: () => number = Math.random): T | undefined {
  if (rivals.length === 0) return undefined;
  const others = rivals.length > 1 ? rivals.filter((r) => r.id !== lastId) : rivals;
  const near = [...others].sort((x, y) => Math.abs(x.rating - rating) - Math.abs(y.rating - rating) || x.id.localeCompare(y.id)).slice(0, MATCH_NEAREST);
  return near[Math.floor(rng() * near.length)];
}

// The day's rival round: the rivals in a ring, shuffled by the day, each
// fighting its two neighbours (so n rivals make n battles, each rival in
// two). Two rivals make one battle.
export function dailyPairs(ids: readonly string[], day: string): [string, string][] {
  const ring = [...ids].sort();
  const rng = seeded(`rivals:${day}`);
  for (let i = ring.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ring[i], ring[j]] = [ring[j], ring[i]];
  }
  if (ring.length < 2) return [];
  if (ring.length === 2) return [[ring[0], ring[1]]];
  return ring.map((id, i) => [id, ring[(i + 1) % ring.length]]);
}

// Today, as the day's key (UTC, so every player's copy agrees).
export const dayKey = (now = new Date()) => now.toISOString().slice(0, 10);
