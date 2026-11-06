import { describe, it, expect } from "vitest";
import { DAILY_BOX, DAILY_GEAR, PRIMARY_QUESTS, SECONDARY_QUESTS, canClaim, claimDaily, dailyDone, dailyFor, dailyQuest, dayKey, noteDaily, openQuests, questsOfDay, rollDailyReward, rollRarity, todaysQuests, type DailyCtx } from "../lib/daily";
import { merchantCalls, VISITOR_STAY } from "../lib/tavern";
import type { Rarity } from "../lib/items/budgets";

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const rank = (r: Rarity) => ORDER.indexOf(r);
// Someone who's done everything, and someone who's done nothing.
const VET: DailyCtx = { wins: { 0: 1, 1: 1, 2: 1, 3: 1 }, online: true, klutz: true };
const NEW: DailyCtx = { wins: {}, online: false, klutz: false };
// A day whose quests are these (primary, secondary).
const dayFor = (primary: string, secondary?: string) => {
  for (let d = 1; d < 2000; d++) {
    const day = dayKey(new Date(2026, 0, d));
    const [p, s] = questsOfDay(day);
    if (p.id === primary && (!secondary || s.id === secondary)) return day;
  }
  throw new Error(`no day for ${primary} ${secondary}`);
};

describe("the daily quests", () => {
  it("two a day, a primary and a secondary, the same for a date wherever you are, and every quest comes up", () => {
    expect(questsOfDay("2026-11-02")).toEqual(questsOfDay("2026-11-02"));
    const days = Array.from({ length: 120 }, (_, d) => questsOfDay(dayKey(new Date(2026, 0, d + 1))));
    expect(new Set(days.map(([p]) => p.id)).size).toBe(PRIMARY_QUESTS.length);
    expect(new Set(days.map(([, s]) => s.id)).size).toBe(SECONDARY_QUESTS.length);
  });

  it("the day is the local date", () => {
    expect(dayKey(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
    expect(dayKey(new Date(2026, 10, 3, 0, 0))).toBe("2026-11-03");
  });

  it("a boss you've never beaten steps down: the Abyss, the Hydra, the Cyclops, the Encampment", () => {
    expect(dailyQuest("abyss", VET).id).toBe("abyss");
    expect(dailyQuest("abyss", NEW).id).toBe("camp");
    expect(dailyQuest("hydra", { ...NEW, wins: { 1: 3 } }).id).toBe("cyclops");
    expect(dailyQuest("abyss", { ...NEW, wins: { 2: 1 } }).id).toBe("hydra");
    expect(dailyQuest("cyclops", NEW).id).toBe("camp");
    expect(dailyQuest("duel", NEW).id).toBe("battles");
    expect(dailyQuest("klutz", NEW).id).toBe("battles");
    expect(dailyQuest("scans", NEW).id).toBe("scans");
  });

  it("the quests are fixed for the day once set, even after a first win", () => {
    const day = dayFor("hydra");
    const t = dailyFor({}, day, { ...NEW, wins: { 1: 1 } });
    expect(t.ids[0]).toBe("cyclops");
    expect(dailyFor(t, day, VET).ids[0]).toBe("cyclops");
    expect(dailyFor(t, dayKey(new Date(2030, 0, 1)), VET).progress).toEqual([0, 0]);
    // A save from the one-quest version starts the day afresh.
    expect(dailyFor({ day, progress: 3 as unknown as number[] }, day, VET).progress).toEqual([0, 0]);
  });

  it("each counts only its own kind of thing, and starts over the next day", () => {
    const day = dayFor("camp", "rooms");
    let s = dailyFor({}, day, VET);
    s = noteDaily(s, "scan", 1, day, VET);
    s = noteDaily(s, "win:1", 1, day, VET);
    expect(s.progress).toEqual([0, 0]);
    s = noteDaily(s, "win:0", 1, day, VET);
    s = noteDaily(s, "room", 7, day, VET);
    expect([dailyDone(s, 0), dailyDone(s, 1)]).toEqual([false, false]);
    s = noteDaily(s, "win:0", 1, day, VET);
    s = noteDaily(s, "room", 3, day, VET);
    expect([dailyDone(s, 0), dailyDone(s, 1)]).toEqual([true, true]);
    expect(todaysQuests(s).map((q) => q.id)).toEqual(["camp", "rooms"]);
  });

  it("each is claimed once, and stops counting after", () => {
    const day = dayFor("camp", "scans");
    let s = dailyFor({}, day, VET);
    for (let i = 0; i < 5; i++) s = noteDaily(s, "scan", 1, day, VET);
    expect([canClaim(s, 0), canClaim(s, 1)]).toEqual([false, true]);
    s = claimDaily(s, 1);
    expect(canClaim(s, 1)).toBe(false);
    expect(claimDaily(s, 1)).toEqual(s);
    expect(claimDaily(s, 0)).toEqual(s); // (not done yet)
    expect(noteDaily(s, "scan", 1, day, VET).progress[1]).toBe(5);
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

  it("the box is Rare or better, the gear Rare or Epic, the Epic piece Epic, the creature Rare at most", () => {
    const bad: string[] = [];
    const gearOk = (d: ReturnType<typeof rollDailyReward>[number], lo: Rarity, hi: Rarity) =>
      d.dropType === "item" && !!(d.itemKey || d.armorKey) && rank(d.rarity) >= rank(lo) && rank(d.rarity) <= rank(hi);
    for (let i = 0; i < 50; i++) {
      const box = rollDailyReward("box");
      if (box.length !== DAILY_BOX || !box.every((d) => gearOk(d, "rare", "legendary"))) bad.push("box");
      const gear = rollDailyReward("gear");
      if (gear.length !== DAILY_GEAR || !gear.every((d) => gearOk(d, "rare", "epic"))) bad.push("gear");
      const epic = rollDailyReward("epic");
      if (epic.length !== 1 || !gearOk(epic[0], "epic", "epic")) bad.push("epic");
      const [c, ...rest] = rollDailyReward("creature");
      if (rest.length || c?.dropType !== "creature" || rank(c.rarity) > rank("rare")) bad.push("creature");
      const [m] = rollDailyReward("material");
      if (m?.dropType !== "item" || !m.material) bad.push("material");
      const [x] = rollDailyReward("codex");
      if (x?.dropType !== "item" || !x.codexMove) bad.push("codex");
    }
    expect(bad).toEqual([]);
    const [scroll] = rollDailyReward("scroll"), [elixir] = rollDailyReward("elixir");
    expect(scroll.dropType === "item" && scroll.scroll).toBe("xp");
    expect(elixir.dropType === "item" && elixir.tool).toBe("revival");
    expect(rollDailyReward("cache")).toHaveLength(1);
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

describe("the Den's reminder", () => {
  it("lists today's quests not yet claimed, with progress held at the goal, and a done one marked ready", () => {
    const day = dayFor("cyclops", "scans");
    let s = dailyFor({}, day, VET);
    expect(openQuests(s).map((x) => [x.q.id, x.progress, x.done])).toEqual([["cyclops", 0, false], ["scans", 0, false]]);
    for (let n = 0; n < 7; n++) s = noteDaily(s, "scan", 1, day, VET);
    expect(openQuests(s)[1]).toMatchObject({ i: 1, progress: 5, done: true });
    s = claimDaily(s, 1);
    expect(openQuests(s).map((x) => x.q.id)).toEqual(["cyclops"]);
  });
});
