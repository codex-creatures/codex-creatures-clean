import { describe, it, expect, vi } from "vitest";
import { createBattle, resolveRound, sendInReplacement, currentAgility, fieldOf, type BattleState } from "../lib/combat/battle";
import { effectiveAgil, calcDamage, setCombatRules, LIVE_RULES } from "../lib/combat/engine";
import { chooseAiAction, chooseAiReplacement } from "../lib/combat/thinkingAi";
import { CYCLOPS, HYDRA } from "../lib/combat/bossAi";
import { bossTeam, cyclopsTeam } from "../lib/creatures/bosses";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID as LIVE_BY_ID, PRE_V2_SPECIES, MOVE_BY_NAME } from "../lib/creatures/creatureData";
// Battle mechanics tests use the older species, with the moves they were written with.
const CREATURE_BY_ID = { ...LIVE_BY_ID, ...PRE_V2_SPECIES };

// A sturdy player creature with plain moves.
const hero = (hp = 5000) => ({ ...buildFighter(CREATURE_BY_ID.ironhide, { melee: 30, ranged: 30 }, { mDef: 10, rDef: 10, magDef: 10 }, ["Slash", "Heavy Blow", "Crush", "Jab"]), hp, maxHp: hp });
const pass = { kind: "pass" } as const;
const fight = () => createBattle([hero(), hero(), hero()], cyclopsTeam(), {}, "cyclops");

function toPhase2(s: BattleState) {
  const body = s.sides.B.team[CYCLOPS.BODY];
  body.hp = Math.floor(body.maxHp * CYCLOPS.SPLIT_AT) + 1;
  // Fixed dice for this set-up round: no cripple from a Stomp, no stumble, so
  // the blow always lands and splits the body.
  const dice = vi.spyOn(Math, "random").mockReturnValue(0.99);
  resolveRound(s, { A: { kind: "attack", skillName: "Heavy Blow" }, B: pass });
  dice.mockRestore();
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
    const base = buildFighter(CREATURE_BY_ID.void_serpent, { melee: 30, ranged: 30 }, {});
    const a = { ...base, proficiency: { ...base.proficiency, atk: 30, rng: 30 } }; // equal melee and ranged %
    const flat = { ...eye, stance: "float" as const, armor: { ...eye.armor, mdef: 0, rdef: 0 } };
    setCombatRules({ ...LIVE_RULES, races: null }); // the stance alone: the two moves' races differ
    expect(calcDamage(MOVE_BY_NAME.Bolt, a, flat, false).damage).toBeGreaterThan(calcDamage(MOVE_BY_NAME.Slash, a, flat, false).damage);
    setCombatRules(LIVE_RULES);
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

describe("the Hydra", () => {
  // Heads that can't be knocked out by accident, unless a test sets them low.
  const hydra = () => {
    const s = createBattle([hero(), hero(), hero()], bossTeam("hydra", 16), {}, "hydra");
    for (const f of s.sides.B.team) { f.hp = 99999; f.maxHp = 99999; }
    return s;
  };
  const slash = (target?: number) => ({ kind: "attack" as const, skillName: "Jab", target });
  const headTurns = (s: BattleState, from: number) => s.log.slice(from)
    .flatMap((e) => (e.type === "attack" && e.side === "B" ? [e.attackerIndex] : e.type === "effect" && e.side === "B" && e.kind === "self" ? [e.index] : []));

  it("has all three heads on the field from the start, and you can hit any of them", () => {
    const s = hydra();
    expect(fieldOf(s.sides.B)).toEqual(HYDRA.HEADS);
    expect(s.sides.B.team.every((f) => !f.hidden)).toBe(true);
    resolveRound(s, { A: slash(2), B: pass });
    expect(s.sides.B.team[2].hp).toBeLessThan(99999);
    expect(s.sides.B.team[0].hp).toBe(99999);
  });

  it("each head takes 1.5× from its weak style (the old triangle) and resists nothing", () => {
    const heads = bossTeam("hydra", 16);
    expect(heads.map((h) => h.weakTo)).toEqual(["magic", "melee", "ranged"]);
    const base = buildFighter(CREATURE_BY_ID.void_serpent, { melee: 30, ranged: 30, magic: 30 }, {});
    const a = { ...base, proficiency: { ...base.proficiency, atk: 30, rng: 30, mag: 30 } };
    const moves = { melee: MOVE_BY_NAME.Slash, ranged: MOVE_BY_NAME.Bolt, magic: MOVE_BY_NAME.Hex };
    for (const head of heads) {
      for (const [style, move] of Object.entries(moves)) {
        const plain = calcDamage(move, a, { ...head, weakTo: undefined }, false).damage;
        const hit = calcDamage(move, a, head, false).damage;
        if (style === head.weakTo) expect(hit / plain).toBeCloseTo(1.5, 1);
        else expect(hit).toBe(plain);
      }
    }
    // The same defences on every head: no style is resisted.
    expect(new Set(heads.flatMap((h) => [h.armor.mdef, h.armor.rdef, h.armor.magdef])).size).toBe(1);
  });

  it("one head acts each round, left to right from where it started, skipping a head that's down", () => {
    const s = hydra();
    s.sides.B.boss!.breathAt = 99;
    s.sides.B.boss!.next = 1;
    const from = s.log.length;
    for (let r = 0; r < 4; r++) resolveRound(s, { A: slash(), B: pass });
    expect(headTurns(s, from)).toEqual([1, 2, 0, 1]);
    s.sides.B.team[2].hp = 0; // the next head is down
    const later = s.log.length;
    resolveRound(s, { A: slash(), B: pass });
    resolveRound(s, { A: slash(), B: pass });
    expect(headTurns(s, later)).toEqual([0, 1]);
  });

  it("breathes once in rounds 3–5: your creature on the field is poisoned (2.5% a round for 20 rounds)", () => {
    for (let n = 0; n < 20; n++) {
      const s = hydra();
      const breathRounds: number[] = [];
      for (let r = 0; r < 5; r++) {
        const from = s.log.length;
        resolveRound(s, { A: slash(), B: pass });
        if (s.log.slice(from).some((e) => e.type === "effect" && e.side === "B" && e.text.startsWith("uses Toxic Breath"))) breathRounds.push(s.round);
      }
      expect(breathRounds).toHaveLength(1);
      expect(breathRounds[0]).toBeGreaterThanOrEqual(3);
      const poison = s.sides.A.team[0].statuses.find((x) => x.id === "poison")!;
      expect(poison.dmg).toBe(Math.round(5000 * HYDRA.POISON_TICK));
      expect(poison.rounds).toBe(HYDRA.POISON_ROUNDS - (s.round - breathRounds[0] + 1));
    }
  });

  it("the cloud poisons whoever comes in while it hangs (not one already poisoned); after it clears, nobody", () => {
    const s = hydra();
    s.sides.B.boss!.breathAt = 1;
    resolveRound(s, { A: slash(), B: pass }); // round 1: it breathes; the cloud hangs over rounds 2–4
    s.sides.B.boss!.cloudUntil = 4;
    vi.spyOn(Math, "random").mockReturnValue(0.99); // (no second breath)
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "poison")).toBe(true);
    const ticks = s.sides.A.team[0].statuses.find((x) => x.id === "poison")!.rounds;
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: pass }); // round 2: in comes number 2…
    expect(s.sides.A.team[1].statuses.some((x) => x.id === "poison")).toBe(true);
    resolveRound(s, { A: { kind: "swap", to: 0 }, B: pass }); // …and back comes the first: not poisoned afresh
    expect(s.sides.A.team[0].statuses.find((x) => x.id === "poison")!.rounds).toBe(ticks - 2);
    resolveRound(s, { A: slash(), B: pass }); // round 4: the cloud's last
    resolveRound(s, { A: { kind: "swap", to: 2 }, B: pass }); // round 5: it's gone
    expect(s.sides.A.team[2].statuses.some((x) => x.id === "poison")).toBe(false);
    vi.restoreAllMocks();
  });

  it("a creature sent in after a knockout breathes the cloud in too", () => {
    const s = hydra();
    s.sides.B.boss!.breathAt = 1;
    s.sides.A.team[0].hp = 1;
    s.sides.A.team[0].statuses = [{ id: "venom", rounds: 3, dmg: 50 }];
    resolveRound(s, { A: slash(), B: pass });
    expect(s.needsReplacement).toEqual(["A"]);
    sendInReplacement(s, "A", 1);
    expect(s.sides.A.team[1].statuses.some((x) => x.id === "poison")).toBe(true);
  });

  it("a head that's cut down grows back after 5 rounds with 75% HP; two grow back with 50%", () => {
    const s = hydra();
    s.sides.B.boss!.breathAt = 99;
    s.sides.B.team[0].hp = 1;
    resolveRound(s, { A: slash(0), B: pass });
    expect(s.sides.B.team[0].hp).toBe(0);
    for (let r = 0; r < HYDRA.REGROW_ROUNDS - 1; r++) resolveRound(s, { A: slash(1), B: pass });
    expect(s.sides.B.team[0].hp).toBe(0);
    resolveRound(s, { A: slash(1), B: pass });
    expect(s.sides.B.team[0].hp).toBe(Math.round(99999 * 0.75));

    s.sides.B.team[0].hp = 1;
    resolveRound(s, { A: slash(0), B: pass });
    for (let r = 0; r < 3; r++) resolveRound(s, { A: slash(2), B: pass });
    s.sides.B.team[1].hp = 1;
    resolveRound(s, { A: slash(1), B: pass }); // a second head down: the count starts again
    for (let r = 0; r < HYDRA.REGROW_ROUNDS - 1; r++) resolveRound(s, { A: slash(2), B: pass });
    expect(s.sides.B.team[0].hp).toBe(0);
    resolveRound(s, { A: slash(2), B: pass });
    expect(s.sides.B.team[0].hp).toBe(Math.round(99999 * 0.5));
    expect(s.sides.B.team[1].hp).toBe(Math.round(99999 * 0.5));
  });

  it("is beaten when all three heads are down at once", () => {
    const s = hydra();
    s.sides.B.boss!.breathAt = 99;
    for (const i of HYDRA.HEADS) {
      s.sides.B.team[i].hp = 1;
      resolveRound(s, { A: slash(i), B: pass });
    }
    expect(s.winner).toBe("A");
  });

  it("full battles against the AI always finish, with a winner", () => {
    for (let i = 0; i < 10; i++) {
      const A = [0, 1, 2].map(() => buildFighter(CREATURE_BY_ID.dire_wolf, { melee: 30, ranged: 10 }, { mDef: 20, rDef: 20, agility: 20 }, undefined, undefined, undefined, undefined, 16));
      const s = createBattle(A, bossTeam("hydra", 16), {}, "hydra");
      while (!s.winner) {
        resolveRound(s, { A: chooseAiAction(s, "A", "easy"), B: pass });
        for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "easy"));
      }
      expect(["A", "B", "draw"]).toContain(s.winner);
    }
  });
});
