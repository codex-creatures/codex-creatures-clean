import { describe, it, expect } from "vitest";
import {
  CHALLENGE_BOSSES, CHALLENGE_DAYS, CHALLENGE_GRADES, CHALLENGE_REWARDS, canClaimChallenge, challengeFor, challengeKey, challengeTask, claimChallenge, daysLeft,
  gradeOf, meetsChallenge, noteItemUsed, noteWin, pickChallenge, rewardOf, rewardText, rollChallengeReward, usedItemOn, type Challenge, type WonRun,
} from "../lib/challenge";
import type { Rarity } from "../lib/types";

const VET = { 1: 3, 2: 2, 3: 1, 4: 1 };
const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const team = (n: number, races: string[], rarity: Rarity = "rare") => Array.from({ length: n }, () => ({ races, rarity }));
const run = (over: Partial<WonRun> = {}): WonRun => ({ dungeon: 2, team: team(3, ["toxic"]), teamSize: 3, usedItem: false, ...over });

describe("the Challenge (the user, 2026-11-23)", () => {
  it("lasts 2 days: the same for both days and for everyone, then a new one", () => {
    expect(CHALLENGE_DAYS).toBe(2);
    const keys = Array.from({ length: 12 }, (_, d) => challengeKey(new Date(2026, 10, 1 + d)));
    for (let i = 0; i < keys.length; i += 2) expect(new Set([keys[i], keys[i + 1]]).size === 1 || new Set([keys[i + 1], keys[i + 2]]).size === 1).toBe(true);
    expect(new Set(keys).size).toBe(6);
    const left = Array.from({ length: 4 }, (_, d) => daysLeft(new Date(2026, 10, 1 + d)));
    expect([...left].sort()).toEqual([1, 1, 2, 2]);
    expect(pickChallenge("c100", VET)).toEqual(pickChallenge("c100", VET));
  });

  it("names every boss and every quirk in time", () => {
    const seen = Array.from({ length: 200 }, (_, w) => pickChallenge(`c${w}`, VET)!);
    expect(new Set(seen.map((c) => c.dungeon)).size).toBe(CHALLENGE_BOSSES.length);
    expect(new Set(seen.map((c) => c.quirk.kind))).toEqual(new Set(["race", "clean", "rarity"]));
    expect(new Set(seen.flatMap((c) => (c.quirk.kind === "race" ? [c.quirk.race] : []))).size).toBe(7);
    // A rarity cap is one that boss's Challenge can name (it has a grade).
    for (const c of seen) if (c.quirk.kind === "rarity") expect(CHALLENGE_GRADES[c.dungeon].rarity[c.quirk.top]).toBeDefined();
  });

  it("is locked till the Cyclops is beaten; a boss you've never beaten steps down to the deepest you have", () => {
    for (let w = 0; w < 60; w++) {
      expect(pickChallenge(`c${w}`, {})).toBeNull();
      expect(pickChallenge(`c${w}`, { 1: 1 })!.dungeon).toBe(1);
      expect([1, 2]).toContain(pickChallenge(`c${w}`, { 1: 1, 2: 1 })!.dungeon);
      // (The Abyss beaten before the Minotaur existed: its own Challenge still counts.)
      expect([1, 2, 3]).toContain(pickChallenge(`c${w}`, { 1: 1, 2: 1, 3: 1 })!.dungeon);
    }
  });

  it("what you got is fixed for the window; a locked one opens when the Cyclops falls; a new window starts afresh", () => {
    const locked = challengeFor({}, "c7", {});
    expect(locked.challenge).toBeNull();
    const open = challengeFor(locked, "c7", { 1: 1 });
    expect(open.challenge!.dungeon).toBe(1);
    expect(challengeFor(open, "c7", VET)).toBe(open); // (a later win doesn't swap it)
    const done = { ...open, done: true, claimed: true };
    expect(challengeFor(done, "c8", VET)).toMatchObject({ key: "c8" });
    expect(challengeFor(done, "c8", VET).done).toBeUndefined();
  });

  it("a team all of one race: a full team, every creature of it (one of two races counts)", () => {
    const c: Challenge = { dungeon: 2, quirk: { kind: "race", race: "toxic" } };
    expect(meetsChallenge(c, run())).toBe(true);
    expect(meetsChallenge(c, run({ team: [...team(2, ["toxic"]), ...team(1, ["beast", "toxic"])] }))).toBe(true);
    expect(meetsChallenge(c, run({ team: [...team(2, ["toxic"]), ...team(1, ["beast"])] }))).toBe(false);
    expect(meetsChallenge(c, run({ team: team(2, ["toxic"]) }))).toBe(false); // not a full team
    expect(meetsChallenge(c, run({ dungeon: 1 }))).toBe(false);              // another boss
    expect(meetsChallenge({ dungeon: 4, quirk: c.quirk }, run({ dungeon: 4, team: team(5, ["toxic"]), teamSize: 5 }))).toBe(true);
  });

  it("without a potion or an elixir: any team, nothing used on that run", () => {
    const c: Challenge = { dungeon: 2, quirk: { kind: "clean" } };
    expect(meetsChallenge(c, run({ team: team(1, ["geo"]) }))).toBe(true);
    expect(meetsChallenge(c, run({ usedItem: true }))).toBe(false);
    const s = noteItemUsed({ key: "c1", challenge: c }, "run-a");
    expect(usedItemOn(s, "run-a")).toBe(true);
    expect(usedItemOn(s, "run-b")).toBe(false);
    expect(noteWin(s, run({ usedItem: usedItemOn(s, "run-a") })).done).toBeUndefined();
    expect(noteWin(s, run({ usedItem: usedItemOn(s, "run-b") })).done).toBe(true);
  });

  it("none above a rarity: a full team, each at or under it", () => {
    const c: Challenge = { dungeon: 2, quirk: { kind: "rarity", top: "rare" } };
    expect(meetsChallenge(c, run({ team: [...team(2, ["geo"], "rare"), ...team(1, ["geo"], "common")] }))).toBe(true);
    expect(meetsChallenge(c, run({ team: [...team(2, ["geo"], "rare"), ...team(1, ["geo"], "epic")] }))).toBe(false);
    expect(meetsChallenge(c, run({ team: team(2, ["geo"], "rare") }))).toBe(false);
  });

  it("done once, claimed once", () => {
    const c: Challenge = { dungeon: 2, quirk: { kind: "clean" } };
    const s = noteWin({ key: "c1", challenge: c }, run());
    expect(canClaimChallenge(s)).toBe(true);
    const claimed = claimChallenge(s);
    expect(canClaimChallenge(claimed)).toBe(false);
    expect(claimChallenge(claimed)).toBe(claimed);
    expect(canClaimChallenge({ key: "c1", challenge: c })).toBe(false);
  });

  it("pays enchanted pieces of its rarity, and its crystals; never less for a deeper boss or a harder quirk", () => {
    for (const d of CHALLENGE_BOSSES) for (const g of [1, 2, 3] as const) {
      const r = CHALLENGE_REWARDS[d][g];
      for (let i = 0; i < 20; i++) {
        const drops = rollChallengeReward(r);
        const gear = drops.filter((x) => x.dropType === "item" && (x.itemKey || x.armorKey));
        expect(gear).toHaveLength(r.pieces);
        for (const x of gear) if (x.dropType === "item") { expect(x.enchant).toBeTruthy(); expect(ORDER.indexOf(x.rarity)).toBeGreaterThanOrEqual(ORDER.indexOf(r.lo)); expect(ORDER.indexOf(x.rarity)).toBeLessThanOrEqual(ORDER.indexOf(r.hi)); }
        expect(drops.reduce((n, x) => n + (x.dropType === "item" && x.material === "essence" ? x.qty ?? 1 : 0), 0)).toBe(r.crystals);
      }
      expect(rewardText(r).length).toBeGreaterThan(10);
    }
    // A rough worth: pieces by rarity, and crystals.
    const worth = (d: (typeof CHALLENGE_BOSSES)[number], g: 1 | 2 | 3) => { const r = CHALLENGE_REWARDS[d][g]; return r.pieces * (10 ** ORDER.indexOf(r.lo) + 10 ** ORDER.indexOf(r.hi)) + r.crystals * 50; };
    for (const d of CHALLENGE_BOSSES) { expect(worth(d, 2)).toBeGreaterThan(worth(d, 1)); expect(worth(d, 3)).toBeGreaterThan(worth(d, 2)); }
    for (let i = 1; i < CHALLENGE_BOSSES.length; i++) for (const g of [1, 2, 3] as const) expect(worth(CHALLENGE_BOSSES[i], g)).toBeGreaterThan(worth(CHALLENGE_BOSSES[i - 1], g));
    const c: Challenge = { dungeon: 2, quirk: { kind: "race", race: "beast" } };
    expect(rewardOf(c)).toBe(CHALLENGE_REWARDS[2][gradeOf(c)]);
    expect(challengeTask(c)).toBe("Beat the Hydra with a full Beast team");
  });
});
