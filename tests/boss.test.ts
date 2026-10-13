import { describe, it, expect } from "vitest";
import { createBattle, resolveRound, sendInReplacement, currentAgility, fieldOf, type BattleState } from "../lib/combat/battle";
import { effectiveAgil, calcDamage } from "../lib/combat/engine";
import { chooseAiAction, chooseAiReplacement } from "../lib/combat/thinkingAi";
import { CYCLOPS } from "../lib/combat/bossAi";
import { cyclopsTeam } from "../lib/creatures/bosses";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID, MOVE_BY_NAME } from "../lib/creatures/creatureData";

// A sturdy player creature with plain moves.
const hero = (hp = 5000) => ({ ...buildFighter(CREATURE_BY_ID.ironhide, { melee: 30, ranged: 30 }, { mDef: 10, rDef: 10 }), hp, maxHp: hp });
const pass = { kind: "pass" } as const;
const fight = () => createBattle([hero(), hero(), hero()], cyclopsTeam(), {}, "cyclops");

function toPhase2(s: BattleState) {
  const body = s.sides.B.team[CYCLOPS.BODY];
  body.hp = Math.floor(body.maxHp * CYCLOPS.SPLIT_AT) + 1;
  resolveRound(s, { A: { kind: "attack", skillName: "Heavy Blow" }, B: pass });
}

describe("the Cyclops", () => {
  it("starts as the body alone; the hands and eye are hidden", () => {
    const s = fight();
    expect(fieldOf(s.sides.B)).toEqual([CYCLOPS.BODY]);
    expect(s.sides.B.team.map((f) => !!f.hidden)).toEqual([false, true, true, true]);
  });

  it("can't be knocked out as the body: at half health it falls apart into two hands", () => {
    const s = fight();
    s.sides.B.team[0].hp = 2;
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: pass });
    expect(s.sides.B.boss!.phase).toBe(2);
    expect(s.sides.B.team[0].hp).toBe(0);
    expect(fieldOf(s.sides.B)).toEqual(CYCLOPS.HANDS);
    expect(s.sides.B.team[1].hidden).toBe(false);
    expect(s.log.some((e) => e.type === "faint" && e.name === "Cyclops")).toBe(false);
    expect(s.log.some((e) => e.type === "lineup" && e.text)).toBe(true);
    expect(s.needsReplacement).toEqual([]);
  });

  it("both hands attack every round, and you choose which one to hit", () => {
    const s = fight();
    toPhase2(s);
    const before = s.log.length;
    resolveRound(s, { A: { kind: "attack", skillName: "Slash", target: 2 }, B: pass });
    const attacks = s.log.slice(before).filter((e) => e.type === "attack");
    expect(attacks.filter((e) => e.side === "B")).toHaveLength(2);
    const mine = attacks.find((e) => e.side === "A")!;
    expect(mine.type === "attack" && mine.targetIndex).toBe(2);
    expect(s.sides.B.team[2].hp).toBeLessThan(s.sides.B.team[2].maxHp);
    expect(s.sides.B.team[1].hp).toBe(s.sides.B.team[1].maxHp);
  });

  it("when one hand falls the other fights on; when both fall, the floating Eye appears", () => {
    const s = fight();
    toPhase2(s);
    s.sides.B.team[1].hp = 1;
    resolveRound(s, { A: { kind: "attack", skillName: "Slash", target: 1 }, B: pass });
    expect(fieldOf(s.sides.B)).toEqual([2]);
    s.sides.B.team[2].hp = 1;
    resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: pass });
    expect(s.sides.B.boss!.phase).toBe(3);
    expect(fieldOf(s.sides.B)).toEqual([CYCLOPS.EYE]);
    expect(s.sides.B.team[CYCLOPS.EYE].stance).toBe("float");
    expect(s.winner).toBeNull();
  });

  it("the Eye's Float stance: ranged hits it harder than the same melee hit", () => {
    const eye = cyclopsTeam()[CYCLOPS.EYE];
    const a = buildFighter(CREATURE_BY_ID.ironhide, { melee: 30, ranged: 30 }, {});
    const flat = { ...eye, armor: { ...eye.armor, mdef: 0, rdef: 0 } };
    expect(calcDamage(MOVE_BY_NAME.Bolt, a, flat, false).damage).toBeGreaterThan(calcDamage(MOVE_BY_NAME.Slash, a, flat, false).damage);
  });

  it("Stomp's cripple is the strong one (−50% agility)", () => {
    const s = fight();
    const me = s.sides.A.team[0];
    me.statuses = [{ id: "cripple", rounds: 3, loss: MOVE_BY_NAME.Stomp.effect!.kind === "cripple" ? MOVE_BY_NAME.Stomp.effect!.agilityLoss : 0 }];
    expect(currentAgility(me)).toBeCloseTo(effectiveAgil(me) * 0.5);
  });

  it("the boss never swaps or asks for a replacement, and the AI leaves it to its script", () => {
    const s = fight();
    expect(chooseAiAction(s, "B", "hard")).toEqual(pass);
    for (let r = 0; r < 30 && !s.winner; r++) {
      resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "swap", to: 3 } });
      for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "easy"));
    }
    expect(s.sides.B.swaps).toBe(0);
  });

  it("full battles against the AI always finish, with a winner", () => {
    for (let i = 0; i < 20; i++) {
      const A = [0, 1, 2].map(() => buildFighter(CREATURE_BY_ID.dire_wolf, { melee: 30, ranged: 10 }, { mDef: 20, rDef: 20, agility: 20 }));
      const s = createBattle(A, cyclopsTeam(), {}, "cyclops");
      while (!s.winner) {
        resolveRound(s, { A: chooseAiAction(s, "A", "easy"), B: pass });
        for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "easy"));
      }
      expect(["A", "B"]).toContain(s.winner);
    }
  });
});
