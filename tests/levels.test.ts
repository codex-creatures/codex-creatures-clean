import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, CREATURES_BY_RARITY } from "../lib/creatures/creatureData";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { proficiencyAt, rollsOf, hpAt, addXp, xpToNext, MAX_LEVEL, REF_LEVEL, HP_SCALE, shareXp, impactsFromLog, addPlayerXp, playerXpToNext, canFind, SCAN_UNLOCK } from "../lib/creatures/levels";
import { rollBarcodeOutcome } from "../lib/barcodeRegistry";
import { starterCreature, STARTER_LEVEL } from "../lib/creatures/starter";
import { buildFighter } from "../lib/combat/loadout";
import { newWitchGame, guess, walkAway, remaining, drawNext, odds, sitDown, isSeated, DECK, MAX_CORRECT, type WitchGame } from "../lib/dungeon/witch";
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
  it("deals from a 33-card deck (1–11 in three suits), every card left equally likely", () => {
    expect(DECK).toHaveLength(33);
    const firsts = new Map<number, number>();
    for (let i = 0; i < 11000; i++) { const n = newWitchGame().card.n; firsts.set(n, (firsts.get(n) ?? 0) + 1); }
    for (let n = 1; n <= 11; n++) expect((firsts.get(n) ?? 0) / 11000).toBeCloseTo(1 / 11, 1);
    // From a 6 with nothing else played: 15 higher, 15 lower, 2 more sixes.
    const g = { card: { n: 6, suit: "melee" as const }, history: [] };
    expect(remaining(g)).toHaveLength(32);
    const [right, stick, wrong] = odds(g, "higher");
    expect(right).toBeCloseTo(15 / 32);
    expect(stick).toBeCloseTo(2 / 32);
    expect(wrong).toBeCloseTo(15 / 32);
    expect(odds({ card: { n: 11, suit: "magic" }, history: [] }, "lower")[2]).toBe(0); // can't lose at the top
  });

  it("a card that's been played never comes up again", () => {
    // All three sixes and every high card gone: from the last six, the next is always lower.
    const history = [{ n: 6, suit: "melee" as const }, { n: 6, suit: "ranged" as const },
      ...DECK.filter((c) => c.n > 6)];
    const g = { card: { n: 6, suit: "magic" as const }, history };
    expect(odds(g, "lower")).toEqual([1, 0, 0]);
    for (let i = 0; i < 200; i++) expect(drawNext(g).n).toBeLessThan(6);
    // Play a whole game out: no card twice.
    let w = newWitchGame();
    for (let i = 0; i < 100 && w.state === "playing"; i++) w = guess(w, w.card.n >= 6 ? "lower" : "higher");
    const seen = [...w.history, w.card].map((c) => `${c.n}${c.suit}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("right +1, stick nothing, wrong loses; walk away any time and see the next card; the deck runs out", () => {
    const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
    const g = { ...newWitchGame(), card: { n: 6, suit: "melee" as const } };
    // The 32 cards left run 1–5, 7–11 melee, then 1–11 ranged…: index 31 is the 11 of magic, index 5 the 7 of melee.
    const at = (i: number) => seq([(i + 0.5) / 32]);
    expect(guess(g, "higher", at(5)).last?.result).toBe("right");
    expect(guess(g, "higher", at(15))).toMatchObject({ correct: 0, state: "playing", last: { result: "stick" } }); // the 6 of ranged
    expect(guess(g, "lower", at(31))).toMatchObject({ state: "lost" });
    const left = walkAway({ ...g, correct: 3 });
    expect(left).toMatchObject({ state: "left", correct: 3 });
    expect(left.peek).toBeDefined();
    expect(remaining(g).some((c) => c.n === left.peek!.n && c.suit === left.peek!.suit)).toBe(true);
    expect(guess({ ...g, correct: MAX_CORRECT - 1 }, "higher", at(5))).toMatchObject({ state: "left", peek: expect.anything() });
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
    expect(den.enemies!.every((e) => (e.level ?? 0) >= 9)).toBe(true); // rooms 6–10: Lv 9+
    const boss = makeRoom("boss", Math.random, 15, 2);
    expect(boss.boss).toBeUndefined();
    expect(boss.enemies).toHaveLength(3);
    expect(CREATURE_BY_ID[boss.enemies![0].creatureId].rarity).toBe("legendary");
    expect(makeRoom("boss", Math.random, 8, 1).boss).toBe("cyclops");
  });
});

describe("enemy levels by depth", () => {
  const range = (d: 1 | 2, kind: Parameters<typeof enemyLevel>[1], depth: number) => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) seen.add(enemyLevel(d, kind, depth));
    return [Math.min(...seen), Math.max(...seen)];
  };
  it("the Labyrinth: rooms 1–2 are Lv 1–3, room 3 Lv 1–4, rooms 4–6 Lv 1–7, the rest Lv 3–7", () => {
    for (const depth of [1, 2]) expect(range(1, "easy", depth)).toEqual([1, 3]);
    expect(range(1, "easy", 3)).toEqual([1, 4]);
    for (const depth of [4, 5, 6]) expect(range(1, "easy", depth)).toEqual([1, 7]);
    for (const depth of [7, 8, 9]) expect(range(1, "easy", depth)).toEqual([3, 7]);
  });
  it("nothing in the Labyrinth is over Lv 7 (bar the Cyclops); the Deep Labyrinth goes higher", () => {
    for (const kind of ["easy", "hard", "miniboss"] as const) for (const depth of [1, 5, 9]) expect(range(1, kind, depth)[1]).toBeLessThanOrEqual(7);
    expect(range(2, "easy", 1)[0]).toBeGreaterThan(5);
    expect(range(2, "easy", 15)[1]).toBeGreaterThan(7);
  });
});

describe("sharing a fight's XP", () => {
  it("goes by impact, but everyone on the team gets at least 10% — even one that never fought", () => {
    const shares = shareXp(100, [{ dealt: 300, taken: 100 }, { dealt: 50, taken: 0 }, { dealt: 0, taken: 0 }]);
    expect(shares[2]).toBe(10);
    expect(shares[0]).toBeGreaterThan(shares[1]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(99);
    expect(shareXp(90, [{ dealt: 0, taken: 0 }, { dealt: 0, taken: 0 }, { dealt: 0, taken: 0 }])).toEqual([30, 30, 30]);
  });
  it("reads who did what from the fight's log", () => {
    const log = [
      { type: "attack", side: "A", attackerIndex: 0, targetIndex: 0, damage: 20 },
      { type: "attack", side: "A", attackerIndex: 1, targetIndex: 0, damage: 5, missed: true },
      { type: "attack", side: "B", attackerIndex: 0, targetIndex: 2, damage: 8 },
    ];
    expect(impactsFromLog(log, "A", 3)).toEqual([{ dealt: 20, taken: 0 }, { dealt: 0, taken: 0 }, { dealt: 0, taken: 8 }]);
  });
});

describe("your explorer level", () => {
  it("levels up from XP and decides how rare a creature a scan can find", () => {
    expect(addPlayerXp({ level: 1, xp: 0 }, playerXpToNext(1)).level).toBe(2);
    expect(canFind(1, "uncommon")).toBe(true);
    expect(canFind(1, SCAN_UNLOCK.legendary > 1 ? "legendary" : "common")).toBe(SCAN_UNLOCK.legendary <= 1);
    expect(canFind(SCAN_UNLOCK.epic, "epic")).toBe(true);
  });
  it("scans never roll a creature rarer than you can find", () => {
    for (let i = 0; i < 2000; i++) {
      const o = rollBarcodeOutcome(1);
      if (o.outcome === "creature") expect(canFind(1, o.rarity)).toBe(true);
    }
  });
  it("your first creature is a Rare at level 3", () => {
    const s = starterCreature() as { rarity: string; level?: number };
    expect(s.rarity).toBe("rare");
    expect(s.level).toBe(STARTER_LEVEL);
    expect(STARTER_LEVEL).toBe(3);
  });
});

describe("the card witch's prizes", () => {
  it("shows the card you'd win; a right guess wins it and turns over another", () => {
    let n = 0;
    const roll = () => `prize${++n}`;
    let g = newWitchGame(Math.random, roll);
    expect(g.prize).toBe("prize1");
    expect(g.won).toEqual([]);
    // Force a right guess: from 1, the next card can only be higher or the same.
    g = { ...g, card: { n: 1, suit: "melee" } };
    for (let i = 0; i < 50 && g.correct === 0; i++) g = guess({ ...g, card: { n: 1, suit: "melee" } }, "higher", Math.random, roll);
    expect(g.won).toEqual(["prize1"]);
    expect(g.prize).toBe("prize2");
  });

  it("the prize after this one waits face down behind it, and comes forward on a right guess", () => {
    let n = 0;
    const roll = () => `prize${++n}`;
    let g = newWitchGame(Math.random, roll);
    expect([g.prize, g.nextPrize]).toEqual(["prize1", "prize2"]);
    const fromOne = (w: WitchGame) => { let x = w; for (let i = 0; i < 50 && x.correct === w.correct; i++) x = guess({ ...x, card: { n: 1, suit: "melee" } }, "higher", Math.random, roll); return x; };
    g = fromOne(g);
    expect([g.prize, g.nextPrize]).toEqual(["prize2", "prize3"]);
    // Her last prize has nothing behind it, and winning it ends the game.
    g = fromOne({ ...g, correct: MAX_CORRECT - 2 });
    expect(g.prize).toBe("prize3");
    expect(g.nextPrize).toBeUndefined();
    g = fromOne(g);
    expect(g.state).toBe("left");
    expect(g.won?.at(-1)).toBe("prize3");
  });

  it("you sit down at her table first (a game underway from an old save counts)", () => {
    const g = newWitchGame();
    expect(isSeated(g)).toBe(false);
    expect(isSeated(sitDown(g))).toBe(true);
    expect(isSeated({ ...g, history: [{ n: 3, suit: "magic" }] })).toBe(true);
  });
});

import { withQuickAttack, QUICK_ATTACK } from "../lib/creatures/starter";
import { MOVE_BY_NAME as MOVES } from "../lib/creatures/creatureData";

describe("the starter's quick attack", () => {
  it("every starter knows a quick attack (haste), whatever it rolls", () => {
    for (let i = 0; i < 300; i++) {
      const s = starterCreature() as { moves?: string[] };
      expect(s.moves?.some((n) => MOVES[n]?.effect?.kind === "dash")).toBe(true);
      expect(s.moves?.length).toBeLessThanOrEqual(4);
    }
  });
  it("takes the last species move's place, of its own class; one it rolled is kept", () => {
    const t = CREATURES_BY_RARITY.rare[0];
    const own = t.skills.map((s) => s.name).slice(0, 4);
    const out = withQuickAttack(t, own);
    expect(out).toContain(QUICK_ATTACK[t.cls]);
    expect(MOVES[QUICK_ATTACK[t.cls]].type).toBe(t.cls);
    expect(out.slice(0, own.length - 1)).toEqual(own.slice(0, own.length - 1));
    expect(withQuickAttack(t, [...own.slice(0, 3), "Blink"])).toEqual([...own.slice(0, 3), "Blink"]);
  });
});
