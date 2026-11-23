// tests/elo.test.ts: the ranked ladder's rating (lib/pvp/elo.ts).
import { describe, expect, it } from "vitest";
import { ELO_K, ELO_START, MATCH_NEAREST, dailyPairs, dayKey, eloUpdate, expectedScore, pickRival, ratingChange } from "../lib/pvp/elo";

describe("Elo", () => {
  it("equals are even, and the better side is favoured", () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1200, 1000)).toBeCloseTo(0.76, 2);
    expect(expectedScore(1000, 1200) + expectedScore(1200, 1000)).toBeCloseTo(1);
  });

  it("a win over an equal is worth half of K, and what one gains the other loses", () => {
    const r = eloUpdate(ELO_START, ELO_START, "win");
    expect(r).toEqual({ a: ELO_START + ELO_K / 2, b: ELO_START - ELO_K / 2 });
    const d = eloUpdate(ELO_START, ELO_START, "draw");
    expect(d).toEqual({ a: ELO_START, b: ELO_START });
    for (const [a, b] of [[900, 1300], [1300, 900], [1000, 1010]]) {
      for (const res of ["win", "loss", "draw"] as const) {
        const u = eloUpdate(a, b, res);
        expect(u.a - a + (u.b - b)).toBe(0);
      }
    }
  });

  it("an upset pays more than an expected win", () => {
    expect(ratingChange(900, 1300, "win")).toBeGreaterThan(ratingChange(1300, 900, "win"));
    expect(ratingChange(1300, 900, "loss")).toBeLessThan(ratingChange(900, 1300, "loss"));
    expect(ratingChange(1000, 1000, "loss")).toBe(-ELO_K / 2);
  });
});

describe("matchmaking", () => {
  const rivals = [900, 950, 1000, 1050, 1100, 1300, 1500].map((rating, i) => ({ id: `r${i}`, rating }));

  it("picks one of the nearest in rating", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickRival(rivals, 1000, undefined, Math.random)!.id);
    expect(seen.size).toBe(MATCH_NEAREST);
    expect(seen.has("r2")).toBe(true); // 1000 itself
    expect([...seen].every((id) => ["r1", "r2", "r3"].includes(id))).toBe(true);
  });

  it("never the same rival twice running, when there's anyone else", () => {
    for (let i = 0; i < 100; i++) expect(pickRival(rivals, 1000, "r2")!.id).not.toBe("r2");
    expect(pickRival([rivals[0]], 1000, "r0")!.id).toBe("r0"); // (alone: it has to be them)
    expect(pickRival([], 1000)).toBeUndefined();
  });

  it("is deterministic given the dice", () => {
    expect(pickRival(rivals, 1000, undefined, () => 0)!.id).toBe(pickRival(rivals, 1000, undefined, () => 0)!.id);
  });
});

describe("the daily round", () => {
  const ids = ["blaze", "cinder", "dusk", "ember", "frost", "gale", "hollow"];

  it("puts every rival in exactly two battles, and the same ones for the same day", () => {
    const pairs = dailyPairs(ids, "2026-11-24");
    expect(pairs).toHaveLength(ids.length);
    const count: Record<string, number> = {};
    for (const [a, b] of pairs) { expect(a).not.toBe(b); count[a] = (count[a] ?? 0) + 1; count[b] = (count[b] ?? 0) + 1; }
    for (const id of ids) expect(count[id]).toBe(2);
    expect(dailyPairs([...ids].reverse(), "2026-11-24")).toEqual(pairs);
  });

  it("changes from day to day", () => {
    const days = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"].map((d) => JSON.stringify(dailyPairs(ids, d)));
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("copes with one or two rivals", () => {
    expect(dailyPairs(["a"], "2026-11-24")).toEqual([]);
    expect(dailyPairs(["a", "b"], "2026-11-24")).toHaveLength(1);
  });

  it("keys the day in UTC", () => {
    expect(dayKey(new Date("2026-11-24T23:30:00Z"))).toBe("2026-11-24");
    expect(dayKey(new Date("2026-11-25T00:30:00Z"))).toBe("2026-11-25");
  });
});
