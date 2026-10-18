import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, CREATURES_BY_RARITY } from "../lib/creatures/creatureData";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { proficiencyAt, rollsOf, hpAt, addXp, xpToNext, MAX_LEVEL, REF_LEVEL, HP_SCALE } from "../lib/creatures/levels";
import { buildFighter } from "../lib/combat/loadout";
import { newWitchGame, guess, walkAway, outcomes, drawNext, odds, START_MIN, START_MAX, MAX_CORRECT } from "../lib/dungeon/witch";
import { startRun, curse, illnessTick, stabTarget, makeRoom, enemyLevel, ILLNESS_DAMAGE, ILLNESS_ACTIONS, DEEP_ROUTE } from "../lib/dungeon/run";
import { rollMap, routeLength } from "../lib/dungeon/map";
import { DUNGEONS } from "../lib/dungeon/run";

describe("creature levels", () => {
  it("level 1 is only its rolls; level 15 is the species plus its rolls", () => {
    for (const t of Object.values(CREATURES_BY_RARITY).flat()) {
      const roll = rollCreature(t).proficiency;
      const rolls = rollsOf(t, roll);
      expect(proficiencyAt(t, roll, 1)).toEqual(rolls);
      expect(proficiencyAt(t, roll, REF_LEVEL)).toEqual(roll);
      // Rolls are zero-sum.
      expect(Object.values(rolls).reduce((a, b) => a + b, 0)).toBe(0);
    }
  });

  it("two Legendaries of a species at level 1 in the same gear differ only by their rolls (same HP)", () => {
    const t = CREATURE_BY_ID.ironhide;
    const a = buildFighter(t, { melee: 20 }, { mDef: 20 }, undefined, rollCreature(t).proficiency, undefined, undefined, 1);
    const b = buildFighter(t, { melee: 20 }, { mDef: 20 }, undefined, rollCreature(t).proficiency, undefined, undefined, 1);
    expect(a.maxHp).toBe(b.maxHp);
    for (const k of Object.keys(a.proficiency) as (keyof typeof a.proficiency)[]) expect(Math.abs(a.proficiency[k] - b.proficiency[k])).toBeLessThanOrEqual(20);
  });

  it("HP is bigger in general, and grows with level", () => {
    const t = CREATURE_BY_ID.moss_wolf;
    expect(hpAt(t, REF_LEVEL)).toBe(Math.round(t.baseHp * HP_SCALE));
    expect(hpAt(t, 1)).toBeLessThan(hpAt(t, 10));
    expect(hpAt(t, 30)).toBeGreaterThan(hpAt(t, REF_LEVEL));
  });

  it("XP levels you up, and stops at the max level", () => {
    expect(addXp({ level: 1, xp: 0 }, xpToNext(1))).toMatchObject({ level: 2, xp: 0, gained: 1 });
    expect(addXp({ level: 1, xp: 0 }, xpToNext(1) + xpToNext(2) + 5)).toMatchObject({ level: 3, xp: 5 });
    expect(addXp({ level: MAX_LEVEL - 1, xp: 0 }, 1e6)).toMatchObject({ level: MAX_LEVEL, xp: 0 });
  });
});

describe("the card witch", () => {
  it("starts on 4–7, and the next card goes higher, lower or sticks at equal odds", () => {
    for (let i = 0; i < 200; i++) {
      const g = newWitchGame();
      expect(g.card.n).toBeGreaterThanOrEqual(START_MIN);
      expect(g.card.n).toBeLessThanOrEqual(START_MAX);
    }
    expect(outcomes(11)).toEqual(["lower", "same"]);
    expect(outcomes(1)).toEqual(["higher", "same"]);
    odds(6, "higher").forEach((p) => expect(p).toBeCloseTo(1 / 3));
    expect(odds(11, "lower")).toEqual([0.5, 0.5, 0]); // can't lose at the top
    let up = 0, down = 0, same = 0;
    for (let i = 0; i < 6000; i++) {
      const n = drawNext(6).n;
      if (n > 6) up++; else if (n < 6) down++; else same++;
    }
    for (const c of [up, down, same]) expect(c / 6000).toBeCloseTo(1 / 3, 1);
  });

  it("right +1, stick nothing, wrong loses; walk away any time; the deck runs out", () => {
    const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
    const g = { ...newWitchGame(), card: { n: 6, suit: "melee" as const } };
    // rng: way (0.0 → higher), number, suit
    expect(guess(g, "higher", seq([0, 0.5, 0])).last?.result).toBe("right");
    expect(guess(g, "higher", seq([0.99, 0, 0]))).toMatchObject({ correct: 0, state: "playing", last: { result: "stick" } });
    expect(guess(g, "lower", seq([0, 0.5, 0]))).toMatchObject({ state: "lost" });
    expect(walkAway({ ...g, correct: 3 })).toMatchObject({ state: "left", correct: 3 });
    expect(guess({ ...g, correct: MAX_CORRECT - 1 }, "higher", seq([0, 0.5, 0])).state).toBe("left");
  });

  it("losing stabs whoever was last on the field (else the first of your team): 15% a room for 3 rooms", () => {
    const run = { ...startRun(["a", "b"], ["a", "b"], {}, 2), lastOnField: "b" };
    expect(stabTarget(run)).toBe("b");
    expect(stabTarget({ ...run, lastOnField: undefined })).toBe("a");
    let r = curse(run);
    expect(r.illness).toEqual({ id: "b", left: ILLNESS_ACTIONS });
    for (let i = 0; i < ILLNESS_ACTIONS; i++) r = illnessTick(r).run;
    expect(r.hp.b).toBeCloseTo(1 - ILLNESS_DAMAGE * ILLNESS_ACTIONS);
    expect(r.illness).toBeUndefined();
    expect(illnessTick(r).hurt).toBeUndefined();
  });
});

describe("the Deep Labyrinth", () => {
  it(`is ${DEEP_ROUTE} rooms from the entrance to the lair`, () => {
    for (let i = 0; i < 10; i++) expect(routeLength(rollMap(false, Math.random, DUNGEONS[2].spec))).toBe(DEEP_ROUTE);
  });
  it("has higher-level, rarer creatures than the Labyrinth, and the Warden's pack at the top", () => {
    expect(enemyLevel(2, "easy", 1)).toBeGreaterThan(enemyLevel(1, "easy", 1));
    const den = makeRoom("easy", Math.random, 10, 2);
    expect(den.enemies!.every((e) => (e.level ?? 0) >= 9)).toBe(true);
    const boss = makeRoom("boss", Math.random, 15, 2);
    expect(boss.boss).toBeUndefined();
    expect(boss.enemies).toHaveLength(3);
    expect(CREATURE_BY_ID[boss.enemies![0].creatureId].rarity).toBe("legendary");
    expect(makeRoom("boss", Math.random, 8, 1).boss).toBe("cyclops");
  });
});
