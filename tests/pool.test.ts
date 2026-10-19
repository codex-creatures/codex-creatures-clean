import { describe, it, expect } from "vitest";
import { soak, hoursToFull, endRun, startRun, POOL_LEVELS, type DungeonMeta } from "../lib/dungeon/run";

const meta = (injuries: Record<string, number>, soakedAt?: string): DungeonMeta => ({ runs: 1, clears: 0, injuries, bag: [], soakedAt });

describe("the healing pool", () => {
  const rate = POOL_LEVELS[0].healPerHour;
  const t0 = Date.parse("2026-10-15T10:00:00Z");

  it("heals the injured slowly in real time, and lets go of anyone back at full", () => {
    const m = soak(meta({ a: 0, b: 0.9 }, new Date(t0).toISOString()), t0 + 2 * 3_600_000);
    expect(m.injuries.a).toBeCloseTo(2 * rate);
    expect(m.injuries.b).toBeUndefined();
    expect(m.soakedAt).toBe(new Date(t0 + 2 * 3_600_000).toISOString());
  });

  it("starts the clock when it first sees someone (no healing for time before that)", () => {
    expect(soak(meta({ a: 0.5 }), t0).injuries.a).toBe(0.5);
  });

  it("knows how long until full", () => {
    expect(hoursToFull(meta({}), 0)).toBeCloseTo(1 / rate);
    expect(hoursToFull(meta({}), 1)).toBe(0);
  });

  it("keeps ticking for everyone at home while a run is on; the party comes home with its run wounds", () => {
    const home = { ...meta({ resting: 0.2 }, new Date(t0).toISOString()), clears: 1 }; // (past the first Cyclops: no free healing)
    const run = { ...startRun(["out"], ["out"], {}, 2), hp: { out: 0.4 }, status: "retreated" as const };
    const after = endRun({ meta: home, run }, t0 + 2 * 3_600_000);
    expect(after.meta.injuries.resting).toBeCloseTo(0.2 + 2 * rate);
    expect(after.meta.injuries.out).toBe(0.4);
    expect(after.meta.soakedAt).toBe(new Date(t0 + 2 * 3_600_000).toISOString());
  });
});
