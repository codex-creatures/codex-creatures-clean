// tests/ranked.test.ts: the ranked ladder's queues (lib/pvp/ranked.ts), the server module (lib/online/ranked.ts,
// with a stand-in client) and the rivals' daily round (lib/pvp/dailyRound.ts).
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RANKED_FORMATS, RANKED_QUEUES, rankedQueueOf } from "../lib/pvp/ranked";
import { parseFormat } from "../lib/pvp/formats";
import { ELO_K, eloUpdate } from "../lib/pvp/elo";
import { LOG_EVENTS_KEPT, fetchLadder, logToKeep, parseLadder, parseRatingMove, postRivalMatch, postRivalRound, reportRanked } from "../lib/online/ranked";
import { playRound, roundPairs, startDailyRound } from "../lib/pvp/dailyRound";
import { pickSidePair, startSideMatch } from "../lib/pvp/sideMatch";
import { RIVALS } from "../lib/pvp/rivals";
import type { BattleEvent } from "../lib/combat/battle";

describe("the queues", () => {
  it("are 3v3 Rare at Lv 15 and 5v5 Legendary at Lv 25, everyone scaled, and their ids read back", () => {
    expect(RANKED_QUEUES).toEqual(["3v3", "5v5"]);
    expect(RANKED_FORMATS["3v3"]).toMatchObject({ size: 3, maxRarity: "rare", level: 15, scaleUp: true });
    expect(RANKED_FORMATS["5v5"]).toMatchObject({ size: 5, maxRarity: "legendary", level: 25, scaleUp: true });
    for (const q of RANKED_QUEUES) {
      expect(parseFormat(RANKED_FORMATS[q].id)).toEqual(RANKED_FORMATS[q]);
      expect(rankedQueueOf(RANKED_FORMATS[q].id)).toBe(q);
    }
    expect(rankedQueueOf("3v3-rare-15")).toBeUndefined();
  });
});

describe("the server's Elo", () => {
  // The migration's pvp_elo: round(32 * (s - 1 / (1 + power(10, (b - a) / 400.0)))). The same sum as lib/pvp/elo.ts.
  const sql = (a: number, b: number, s: number) => Math.round(ELO_K * (s - 1 / (1 + 10 ** ((b - a) / 400))));
  it("agrees with the game's", () => {
    for (const a of [800, 1000, 1234, 1600]) for (const b of [900, 1000, 1100, 1500]) {
      expect(eloUpdate(a, b, "win").a - a).toBe(sql(a, b, 1));
      expect(eloUpdate(a, b, "loss").a - a).toBe(sql(a, b, 0));
      expect(eloUpdate(a, b, "draw").a - a).toBe(sql(a, b, 0.5));
    }
  });
});

// A stand-in client: answers each RPC from a table, and notes the calls.
function fakeClient(answers: Record<string, unknown | ((args: Record<string, unknown>) => unknown)>, calls: { fn: string; args: Record<string, unknown> }[] = []) {
  const client = {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      calls.push({ fn, args });
      const a = answers[fn];
      if (a === undefined) return { data: null, error: { message: "no such function" } };
      if (a instanceof Error) throw a;
      return { data: typeof a === "function" ? (a as (x: Record<string, unknown>) => unknown)(args) : a, error: null };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const LADDER = {
  top: [{ rank: 1, id: "rival:blaze", name: "Blaze", rating: 1040, games: 4, ai: true, me: false }, { rank: 2, id: "u1", name: "Adam", rating: 1016, games: 1, ai: false, me: true }],
  me: { rank: 2, rating: 1016, games: 1 },
  rivals: [{ id: "blaze", rating: 1040 }, { id: "cinder", rating: 990 }],
  lastRound: "2026-11-23",
};

describe("the server module", () => {
  it("reads the ladder, and refuses a broken one", async () => {
    expect(parseLadder(LADDER)).toEqual(LADDER);
    expect(parseLadder({ ...LADDER, me: null })).toMatchObject({ me: null });
    expect(parseLadder({ ...LADDER, lastRound: null })).toMatchObject({ lastRound: null });
    expect(parseLadder({ top: [{ rank: "1" }], rivals: [] })).toBeNull();
    expect(parseLadder(null)).toBeNull();
    expect(await fetchLadder(fakeClient({ pvp_leaderboard: LADDER }).client)).toEqual(LADDER);
    expect(await fetchLadder(fakeClient({}).client)).toBeNull();
    expect(await fetchLadder(fakeClient({ pvp_leaderboard: new Error("offline") }).client)).toBeNull();
  });

  it("reports a match with its log cut to size, and reads the rating's move", async () => {
    const log = Array.from({ length: LOG_EVENTS_KEPT + 50 }, (_, i) => ({ type: "round", round: i } as BattleEvent));
    expect(logToKeep(log)).toHaveLength(LOG_EVENTS_KEPT);
    expect(logToKeep(log.slice(0, 10))).toHaveLength(10);
    const { client, calls } = fakeClient({ ranked_result: { before: 1000, after: 1016, rival: { before: 1000, after: 984 } } });
    const move = await reportRanked(client, { rival: "blaze", format: RANKED_FORMATS["3v3"].id, result: "win", reason: "battle", log });
    expect(move).toEqual({ before: 1000, after: 1016, rival: { before: 1000, after: 984 } });
    expect(calls[0].fn).toBe("ranked_result");
    expect(calls[0].args).toMatchObject({ rival: "blaze", result: "win", reason: "battle", format: "3v3-rare-15-scaled" });
    expect((calls[0].args.log as unknown[]).length).toBe(LOG_EVENTS_KEPT);
    expect(parseRatingMove({ before: 1 })).toBeNull();
    expect(await reportRanked(fakeClient({}).client, { rival: "blaze", format: "x", result: "win", reason: "battle", log: [] })).toBeNull();
  });

  it("posts a round once: true when taken, false when the day was already posted", async () => {
    expect(await postRivalRound(fakeClient({ rival_round: true }).client, "2026-11-24", [])).toBe(true);
    expect(await postRivalRound(fakeClient({ rival_round: false }).client, "2026-11-24", [])).toBe(false);
    expect(await postRivalRound(fakeClient({}).client, "2026-11-24", [])).toBeNull();
  });
});

describe("the rivals' daily round", () => {
  // (The easy AI here: the hard one takes seconds a battle. The battles are the same kind either way.)
  it.skipIf(RIVALS.length < 2)("plays the day's pairings in the two queues by turns, the same for the same day", () => {
    const ids = RIVALS.slice(0, 3).map((r) => r.id);
    const round = playRound("2026-11-24", ids, "easy");
    expect(round).toHaveLength(3);
    expect(round.map((r) => r.format)).toEqual([RANKED_FORMATS["3v3"].id, RANKED_FORMATS["5v5"].id, RANKED_FORMATS["3v3"].id]);
    for (const r of round) { expect(ids).toContain(r.a); expect(ids).toContain(r.b); expect(["a", "b", "draw"]).toContain(r.winner); expect(r.log.length).toBeGreaterThan(0); }
    expect(playRound("2026-11-24", ids, "easy").map((r) => [r.a, r.b])).toEqual(round.map((r) => [r.a, r.b]));
  }, 30_000);

  it.skipIf(RIVALS.length < 2)("runs once a day: it's skipped when the server has today's, and posted when not", async () => {
    const day = "2026-11-24", now = new Date(`${day}T10:00:00Z`);
    const taken = fakeClient({ pvp_leaderboard: { ...LADDER, lastRound: day } });
    expect((await startDailyRound(taken.client, now)).status).toBe("taken");
    expect(taken.calls.map((c) => c.fn)).toEqual(["pvp_leaderboard"]);
    // (Another day: the same module remembers today's was taken; a new day plays. The battles by a stand-in player.)
    const posting = fakeClient({ pvp_leaderboard: { ...LADDER, lastRound: day }, rival_round: true });
    const seen: number[] = [];
    const s = await startDailyRound(posting.client, new Date("2026-11-25T10:00:00Z"), async (d, ids, onBattle) =>
      roundPairs(d, ids).map((p, i) => { onBattle(i + 1); seen.push(i + 1); return { a: p.a, b: p.b, format: p.format.id, winner: "a" as const, log: [] }; }));
    expect(s).toMatchObject({ day: "2026-11-25", status: "posted", of: RIVALS.length, played: RIVALS.length });
    expect(seen).toHaveLength(RIVALS.length);
    const post = posting.calls.find((c) => c.fn === "rival_round")!;
    expect(post.args.day).toBe("2026-11-25");
    expect((post.args.results as unknown[]).length).toBe(RIVALS.length);
  });
});

describe("the side match after a ranked match", () => {
  const f = RANKED_FORMATS["3v3"];

  it("picks two different rivals at random, in the format you played", () => {
    const ids = ["blaze", "cinder", "dusk"];
    for (let i = 0; i < 50; i++) {
      const p = pickSidePair(f, ids)!;
      expect(ids).toContain(p.a); expect(ids).toContain(p.b); expect(p.a).not.toBe(p.b); expect(p.format).toBe(f);
    }
    // (A fixed roll picks a fixed pair; the second roll is among the others.)
    expect(pickSidePair(f, ids, () => 0)).toEqual({ a: "blaze", b: "cinder", format: f });
    expect(pickSidePair(f, ids, () => 0.99)).toEqual({ a: "dusk", b: "cinder", format: f });
    expect(pickSidePair(f, ["blaze"])).toBeNull();
    expect(pickSidePair(f)).not.toBeNull();
  });

  it("plays the pair and posts it as one rival match; nothing is posted if the battle couldn't be played", async () => {
    const posting = fakeClient({ rival_match: { aBefore: 1000, aAfter: 1016, bBefore: 1000, bAfter: 984 } });
    const log = Array.from({ length: LOG_EVENTS_KEPT + 5 }, (_, i) => ({ type: "round", round: i } as BattleEvent));
    const ok = await startSideMatch(posting.client, f, async (p) => ({ a: p.a, b: p.b, format: p.format.id, winner: "b", log }), { a: "blaze", b: "dusk", format: f });
    expect(ok).toBe(true);
    expect(posting.calls.map((c) => c.fn)).toEqual(["rival_match"]);
    expect(posting.calls[0].args).toMatchObject({ a: "blaze", b: "dusk", format: f.id, winner: "b" });
    expect((posting.calls[0].args.log as unknown[]).length).toBe(LOG_EVENTS_KEPT);
    const quiet = fakeClient({ rival_match: {} });
    expect(await startSideMatch(quiet.client, f, async () => null)).toBe(false);
    expect(await startSideMatch(quiet.client, f, async () => { throw new Error("no worker"); })).toBe(false);
    expect(quiet.calls).toHaveLength(0);
    // (Offline, or refused by the server: false, and the player's own result stands.)
    expect(await postRivalMatch(fakeClient({}).client, { a: "blaze", b: "dusk", format: f.id, winner: "a", log: [] })).toBe(false);
    expect(await postRivalMatch(fakeClient({ rival_match: new Error("offline") }).client, { a: "blaze", b: "dusk", format: f.id, winner: "a", log: [] })).toBe(false);
  });

  it.skipIf(RIVALS.length < 2)("a pair plays out as a real battle (the easy AI here)", async () => {
    const posting = fakeClient({ rival_match: {} });
    const { playRoundBattle } = await import("../lib/pvp/dailyRound");
    const ok = await startSideMatch(posting.client, f, async (p) => playRoundBattle(p, "easy"));
    expect(ok).toBe(true);
    const args = posting.calls[0].args;
    expect(RIVALS.map((r) => r.id)).toContain(args.a);
    expect(["a", "b", "draw"]).toContain(args.winner);
    expect((args.log as unknown[]).length).toBeGreaterThan(0);
  }, 30_000);
});
