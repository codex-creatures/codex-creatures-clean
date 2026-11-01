import { describe, it, expect } from "vitest";
import { DAILY_GEAR, DAILY_QUESTS, canClaim, claimDaily, dailyDone, dayKey, noteDaily, questOfDay, rollDailyReward, rollRarity, type DailyState } from "../lib/daily";
import { BOX_ROLLS } from "../lib/quest";
import { merchantCalls, VISITOR_STAY } from "../lib/tavern";
import type { Rarity } from "../lib/items/budgets";

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const rank = (r: Rarity) => ORDER.indexOf(r);
// A day whose quest is this one.
const dayFor = (id: string) => {
  for (let d = 1; d < 400; d++) {
    const day = dayKey(new Date(2026, 0, d));
    if (questOfDay(day).id === id) return day;
  }
  throw new Error(`no day for ${id}`);
};

describe("the daily quest", () => {
  it("is the same for a date wherever you are, and every quest comes up", () => {
    expect(questOfDay("2026-11-02")).toBe(questOfDay("2026-11-02"));
    const seen = new Set(Array.from({ length: 60 }, (_, d) => questOfDay(dayKey(new Date(2026, 0, d + 1))).id));
    expect(seen.size).toBe(DAILY_QUESTS.length);
  });

  it("the day is the local date", () => {
    expect(dayKey(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
    expect(dayKey(new Date(2026, 10, 3, 0, 0))).toBe("2026-11-03");
  });

  it("only today's kind of thing counts, and it starts over the next day", () => {
    const day = dayFor("camp");
    let s: DailyState = {};
    s = noteDaily(s, "scan", 1, day);
    s = noteDaily(s, "win:1", 1, day);
    expect(s.progress).toBe(0);
    s = noteDaily(s, "win:0", 1, day);
    expect(dailyDone(s, day)).toBe(false);
    s = noteDaily(s, "win:0", 1, day);
    expect(dailyDone(s, day)).toBe(true);
    const next = dayFor("sell");
    expect(dailyDone(s, next)).toBe(false);
    expect(noteDaily(s, "sell", 120, next)).toEqual({ day: next, progress: 120 });
  });

  it("is claimed once, and stops counting after", () => {
    const day = dayFor("scans");
    let s: DailyState = {};
    for (let i = 0; i < 5; i++) s = noteDaily(s, "scan", 1, day);
    expect(canClaim(s, day)).toBe(true);
    s = claimDaily(s, day);
    expect(canClaim(s, day)).toBe(false);
    expect(claimDaily(s, day)).toEqual(s);
    expect(noteDaily(s, "scan", 1, day).progress).toBe(5);
  });
});

describe("the daily rewards", () => {
  it("hold their rarity between the limits", () => {
    const bad: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = rollRarity(Math.random, "rare", "epic");
      if (rank(r) < rank("rare") || rank(r) > rank("epic")) bad.push(r);
    }
    expect(bad).toEqual([]);
  });

  it("the box is Klutz's box in Rare or better, the gear Rare or Epic, the creature Rare at most", () => {
    const bad: string[] = [];
    for (let i = 0; i < 50; i++) {
      const box = rollDailyReward("box");
      if (box.length !== BOX_ROLLS) bad.push(`box of ${box.length}`);
      for (const d of box) if (d.dropType !== "item" || rank(d.rarity) < rank("rare")) bad.push(`box ${d.dropType}`);
      const gear = rollDailyReward("gear");
      if (gear.length !== DAILY_GEAR) bad.push(`gear of ${gear.length}`);
      for (const d of gear) if (d.dropType !== "item" || !(d.itemKey || d.armorKey) || rank(d.rarity) < rank("rare") || rank(d.rarity) > rank("epic")) bad.push(`gear ${d.dropType}`);
      const [c, ...rest] = rollDailyReward("creature");
      if (rest.length || c?.dropType !== "creature" || rank(c.rarity) > rank("rare")) bad.push("creature");
    }
    expect(bad).toEqual([]);
    expect(rollDailyReward("gold")).toEqual([]);
    expect(rollDailyReward("merchant")).toEqual([]);
  });

  it("the merchant only calls at a repaired tavern", () => {
    expect(merchantCalls({ blasted: true })).toEqual({ blasted: true });
    const t = merchantCalls({ blasted: true, repaired: true, visitor: "librarian", stay: 1 });
    expect(t.visitor).toBe("merchant");
    expect(t.stay).toBe(VISITOR_STAY);
    expect(t.wares?.length).toBeGreaterThan(0);
  });
});
