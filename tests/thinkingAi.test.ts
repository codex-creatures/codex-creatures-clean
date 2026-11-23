// The thinking AI's nudges (lib/combat/thinkingAi.ts): the small, human-like
// weights laid over its lookahead since 2026-11-24, after the user watched the
// ranked rivals walk into caltrops every swap.
import { describe, it, expect, vi, afterEach } from "vitest";
import { createBattle, resolveRound, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { entryCost, foeSwapChance, chooseAiAction, HAZARD_LAY_BONUS, DEBUFF_BONUS } from "../lib/combat/thinkingAi";

const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20, magic: 20 }, { mDef: 5, rDef: 5, magDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T) => ({ ...f, maxHp: 1000, hp: 1000 });
const attack = (skillName: string): BattleAction => ({ kind: "attack", skillName });
const swap = (to: number): BattleAction => ({ kind: "swap", to });
afterEach(() => vi.restoreAllMocks());

describe("the thinking AI weighs entry hazards and likely swaps", () => {
  it("a swap onto caltrops costs their entry damage as a share of the team's HP; a Toxic creature ignores a cloud", () => {
    const s = createBattle(
      [big(fighter("cave_bat", ["Strike", "Caltrops"]))],
      [big(fighter("moss_wolf", ["Strike"])), big(fighter("rattlebones", ["Strike"])), big(fighter("rotgut_fly", ["Strike"]))],
    );
    expect(entryCost(s, "B", 1)).toBe(0); // nothing under B yet
    resolveRound(s, { A: attack("Caltrops"), B: attack("Strike") });
    expect(entryCost(s, "B", 1)).toBeCloseTo(0.1 / 3); // 10% of the comer's HP, over a team of 3
    // A cloud under B as well: its first tick counts, unless the comer can't be poisoned.
    s.sides.B.ground = [...(s.sides.B.ground ?? []), { kind: "cloud", move: "Choking Smog", rounds: 5, tick: 0.1, tailMin: 1, tailMax: 3 }];
    expect(entryCost(s, "B", 1)).toBeCloseTo(0.2 / 3);
    expect(entryCost(s, "B", 2)).toBeCloseTo(0.1 / 3); // the Rotgut Fly is Toxic
  });

  it("a hurt foe, or one that swapped lately, looks likely to swap; a foe with no bench never does", () => {
    const s = createBattle(
      [big(fighter("cave_bat", ["Strike"]))],
      [big(fighter("moss_wolf", ["Strike"])), big(fighter("glob", ["Strike"]))],
    );
    expect(foeSwapChance(s, "A")).toBe(0);
    expect(foeSwapChance(s, "B")).toBe(0); // A has nobody benched
    s.sides.B.team[0].hp = 250;
    expect(foeSwapChance(s, "A")).toBeCloseTo(0.35);
    s.sides.B.team[0].hp = 1000;
    resolveRound(s, { A: attack("Strike"), B: swap(1) });
    expect(foeSwapChance(s, "A")).toBeCloseTo(0.35); // swapped this round
    resolveRound(s, { A: attack("Strike"), B: attack("Strike") });
    expect(foeSwapChance(s, "A")).toBeCloseTo(0.35); // and still counts a round later
    resolveRound(s, { A: attack("Strike"), B: attack("Strike") });
    expect(foeSwapChance(s, "A")).toBe(0); // two rounds on, forgotten
  });

  it("the nudges are small next to a win, and the Hard AI still finishes a last foe it can kill", () => {
    expect(HAZARD_LAY_BONUS * 4).toBeLessThan(0.1);
    expect(DEBUFF_BONUS).toBeLessThan(0.1);
    const s = createBattle(
      [big(fighter("cave_bat", ["Strike", "Caltrops", "Cripple"]))],
      [{ ...fighter("moss_wolf", ["Strike"]), maxHp: 1000, hp: 5 }],
    );
    // Their last creature is at 5 HP: any hit wins, and caltrops have nobody left to catch.
    for (let i = 0; i < 5; i++) {
      const a = chooseAiAction(s, "A", "hard");
      expect(a.kind === "attack" && ["Strike", "Cripple"].includes(a.skillName)).toBe(true);
    }
  });

  it("with caltrops under it and nothing to gain, the Hard AI stops swapping for nothing", () => {
    // Two identical Globs on B facing a Cave Bat: swapping gains nothing, and caltrops make it cost.
    const make = () => createBattle(
      [big(fighter("cave_bat", ["Strike", "Caltrops"]))],
      [big(fighter("glob", ["Strike"])), big(fighter("glob", ["Strike"]))],
    );
    let swaps = 0;
    for (let i = 0; i < 12; i++) {
      const s = make();
      resolveRound(s, { A: attack("Caltrops"), B: attack("Strike") });
      if (chooseAiAction(s, "B", "hard").kind === "swap") swaps++;
    }
    expect(swaps).toBeLessThanOrEqual(1);
  });
});
