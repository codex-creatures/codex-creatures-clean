import { describe, it, expect } from "vitest";
import {
  BOSS_MOVES, CREATURE_BY_ID, CREATURE_TEMPLATES, KLUTZ, MOVE_BY_NAME, RACE_MOVES, canLearnFromCodex, codexLearners,
  hasSteadyMove, isSteadyMove, resolveMoves,
} from "../lib/creatures/creatureData";
import { CORE_MOVES } from "../lib/creatures/raceKitsV2";
import { ENEMY_MOVE_LEVELS, enemyMoves, makeEnemy } from "../lib/dungeon/run";
import { defaultMoveNames } from "../lib/creatures/creatureData";

describe("Klutz and race moves", () => {
  it("Klutz has no race (Neutral)", () => {
    expect(KLUTZ.race).toBeUndefined();
    expect(KLUTZ.races).toBeUndefined();
  });
  it("Rabid Bite: Beast, Underkin and Toxic creatures can learn it; it hits as Toxic", () => {
    const bite = MOVE_BY_NAME["Rabid Bite"];
    expect(bite.race).toBe("toxic");
    for (const t of CREATURE_TEMPLATES) {
      const can = (t.races ?? []).some((r) => ["beast", "underkin", "toxic"].includes(r));
      expect(canLearnFromCodex(t, "Rabid Bite"), t.id).toBe(can);
    }
    expect(canLearnFromCodex(KLUTZ, "Rabid Bite")).toBe(true); // (Klutz can learn any codex: the user, 2026-11-14)
  });
});

describe("codexes say who can read them", () => {
  it("race moves and learnable ones", () => {
    expect(codexLearners("Rabid Bite").text).toBe("Beast / Underkin / Toxic only");
    expect(codexLearners("Pounce").text).toBe("Beast + 4 more");
    expect(codexLearners("Erupt").text).toBe("Geo + 3 more");
    expect(codexLearners("Cripple").text).toBe("any creature");
  });
  it("every move but the bosses' has a description", () => {
    const boss = new Set(BOSS_MOVES.map((m) => m.name));
    for (const m of Object.values(MOVE_BY_NAME)) if (!boss.has(m.name)) expect(m.desc, m.name).toBeTruthy();
    // Plain hits don't spell out what they're strong against: that's for the player to learn.
    expect(MOVE_BY_NAME.Smash.desc).toBe("A plain melee hit.");
    for (const m of Object.values(MOVE_BY_NAME)) expect(m.desc ?? "", m.name).not.toMatch(/strong against|resisted by/i);
  });
});

describe("no resting: every set keeps a steady move", () => {
  it("every species starts with one", () => {
    for (const t of [...CREATURE_TEMPLATES, KLUTZ]) expect(hasSteadyMove(resolveMoves(t)), t.id).toBe(true);
  });
  it("a saved set without one gets one back", () => {
    const t = CREATURE_BY_ID.moss_wolf;
    const heavy = "Smash";
    const moves = resolveMoves(t, ["Rush", heavy]);
    expect(hasSteadyMove(moves)).toBe(true);
    expect(moves.map((m) => m.name).slice(0, 2)).toEqual(["Rush", heavy]);
    const full = resolveMoves(t, ["Rush", heavy, "Cripple", "Pounce"]);
    expect(full).toHaveLength(4);
    expect(hasSteadyMove(full)).toBe(true);
  });
  it("a move with a cooldown isn't steady (Corpsify)", () => {
    expect(isSteadyMove(MOVE_BY_NAME.Corpsify)).toBe(false);
    expect(RACE_MOVES.length).toBeGreaterThan(0);
  });
});

describe("enemies' moves (the core moves, 2026-11-12)", () => {
  it("they start with their 3 core moves; a hybrid adds its second style's heavy move from its level", () => {
    const wolf = CREATURE_BY_ID.moss_wolf, start = defaultMoveNames(wolf);
    expect(enemyMoves(wolf, start, 30)).toEqual(start); // one style: nothing more
    const toad = CREATURE_BY_ID.bellow_toad, toadStart = defaultMoveNames(toad); // a melee Ranger
    expect(enemyMoves(toad, toadStart, ENEMY_MOVE_LEVELS.heavy - 1)).toEqual(toadStart);
    expect(enemyMoves(toad, toadStart, ENEMY_MOVE_LEVELS.heavy)).toEqual([...toadStart, "Power Shot"]);
    const names = new Set(CORE_MOVES.map((m) => m.name));
    for (const lv of [1, 5, 12, 20, 30]) for (let i = 0; i < 50; i++) {
      const e = makeEnemy("epic", "rare", [], Math.random, lv);
      const moves = resolveMoves(CREATURE_BY_ID[e.creatureId], e.moves);
      expect(moves.map((m) => m.name)).toEqual(e.moves); // all real moves of its own
      expect(hasSteadyMove(moves)).toBe(true);
      // Core moves, or a rare cripple move it was born with.
      expect(e.moves.filter((n) => !names.has(n)).every((n) => MOVE_BY_NAME[n]?.effect?.kind === "cripple")).toBe(true);
    }
  });
});
