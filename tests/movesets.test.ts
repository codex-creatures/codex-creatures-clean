import { describe, it, expect } from "vitest";
import {
  BOSS_MOVES, CREATURE_BY_ID, CREATURE_TEMPLATES, KLUTZ, MOVE_BY_NAME, RACE_MOVES, canLearnFromCodex, codexLearners,
  hasSteadyMove, isSteadyMove, resolveMoves,
} from "../lib/creatures/creatureData";
import { KIT_RACE_MOVES, kitMoveFor } from "../lib/creatures/raceKitsV2";
import { ENEMY_MOVE_LEVELS, enemyMoves, makeEnemy } from "../lib/dungeon/run";
import { defaultMoveNames } from "../lib/creatures/creatureData";
import { SPECIES_RACES } from "../lib/creatures/racesV2";

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
    expect(canLearnFromCodex(KLUTZ, "Rabid Bite")).toBe(false);
  });
});

describe("codexes say who can read them", () => {
  it("race moves, race-kit moves, class moves and learnable ones", () => {
    expect(codexLearners("Rabid Bite").text).toBe("Beast / Underkin / Toxic only");
    expect(codexLearners("Pounce").text).toBe("Beast only");
    expect(codexLearners("Tunnel Rush").text).toBe("Underkin melee only");
    expect(codexLearners("Slash").text).toBe("Melee only");
    expect(codexLearners("Cripple").text).toBe("any creature");
    for (const m of KIT_RACE_MOVES) expect(codexLearners(m.name).text, m.name).not.toBe("any creature");
  });
  it("every move but the bosses' has a description", () => {
    const boss = new Set(BOSS_MOVES.map((m) => m.name));
    for (const m of Object.values(MOVE_BY_NAME)) if (!boss.has(m.name)) expect(m.desc, m.name).toBeTruthy();
    expect(MOVE_BY_NAME.Gore.desc).toMatch(/^Strong against/);
    expect(MOVE_BY_NAME.Strike.desc).toMatch(/^No race/);
  });
});

describe("no resting: every set keeps a steady move", () => {
  it("every species starts with one", () => {
    for (const t of [...CREATURE_TEMPLATES, KLUTZ]) expect(hasSteadyMove(resolveMoves(t)), t.id).toBe(true);
  });
  it("a saved set without one gets one back", () => {
    const t = CREATURE_BY_ID.moss_wolf;
    const heavy = kitMoveFor("beast", "melee", "heavy").name;
    const moves = resolveMoves(t, ["Rush", heavy]);
    expect(hasSteadyMove(moves)).toBe(true);
    expect(moves.map((m) => m.name).slice(0, 2)).toEqual(["Rush", heavy]);
    const full = resolveMoves(t, ["Rush", heavy, "Cripple", "Dash Lash"]);
    expect(full).toHaveLength(4);
    expect(hasSteadyMove(full)).toBe(true);
  });
  it("a move with a cooldown isn't steady (Corpsify)", () => {
    expect(isSteadyMove(MOVE_BY_NAME.Corpsify)).toBe(false);
    expect(RACE_MOVES.length).toBeGreaterThan(0);
  });
});

describe("enemies' moves scale with level", () => {
  const t = CREATURE_BY_ID.moss_wolf;
  const start = defaultMoveNames(t);
  const heavy = kitMoveFor(SPECIES_RACES[t.id][0], t.cls, "heavy").name;
  it("low levels: the 3 starting moves", () => {
    expect(enemyMoves(t, start, ENEMY_MOVE_LEVELS.heavy - 1)).toEqual(start);
  });
  it("then its race's heavy move, then kit moves in place of the Neutral ones, always keeping a steady move", () => {
    expect(enemyMoves(t, start, ENEMY_MOVE_LEVELS.heavy)).toEqual([...start, heavy]);
    const mid = enemyMoves(t, start, ENEMY_MOVE_LEVELS.light);
    expect(mid).not.toContain("Strike");
    expect(mid).toContain("Rush");
    const high = enemyMoves(t, start, ENEMY_MOVE_LEVELS.quick);
    expect(high).not.toContain("Strike");
    expect(high).not.toContain("Rush");
    expect(new Set(high).size).toBe(4);
    for (const lv of [1, 5, 12, 20, 30]) for (let i = 0; i < 50; i++) {
      const e = makeEnemy("epic", "rare", [], Math.random, lv);
      const moves = resolveMoves(CREATURE_BY_ID[e.creatureId], e.moves);
      expect(moves.map((m) => m.name)).toEqual(e.moves); // all real moves of its own
      expect(hasSteadyMove(moves)).toBe(true);
    }
  });
});
