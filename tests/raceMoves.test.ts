import { describe, it, expect } from "vitest";
import { createBattle, resolveRound, affordableSkills, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { CREATURE_BY_ID, RACE_MOVES, MOVE_BY_NAME, movesAvailableTo, resolveMoves } from "../lib/creatures/creatureData";

const hit = (skillName: string): BattleAction => ({ kind: "attack", skillName });
const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20 }, { mDef: 5, rDef: 5 }, moves);

describe("race moves", () => {
  it("each race has one, and only creatures of that race can learn it", () => {
    expect(new Set(RACE_MOVES.map((m) => m.race)).size).toBe(5);
    const wolf = CREATURE_BY_ID.moss_wolf; // beast
    expect(movesAvailableTo(wolf).map((m) => m.name)).not.toContain("Pounce"); // not until learned
    expect(movesAvailableTo(wolf, ["Pounce", "Mirage"]).map((m) => m.name)).toContain("Pounce");
    expect(movesAvailableTo(wolf, ["Pounce", "Mirage"]).map((m) => m.name)).not.toContain("Mirage");
    expect(resolveMoves(wolf, ["Pounce", "Mirage", "Slash"]).map((m) => m.name)).toEqual(["Pounce", "Slash"]);
  });

  it("Pounce strikes first even when slower, and hits the wounded harder", () => {
    const slow = fighter("ironhide", ["Pounce", "Slash"]);      // agility 10%
    const fast = fighter("ember_lynx", ["Slash", "Bolt"]);      // agility 30%
    const s = createBattle([slow], [fast]);
    resolveRound(s, { A: hit("Pounce"), B: hit("Slash") });
    const attacks = s.log.filter((e) => e.type === "attack");
    expect(attacks[0].type === "attack" && attacks[0].attacker).toBe("Ironhide");

    // Same hit on a healthy and a wounded target (skipping precise hits).
    const dmg = (st: ReturnType<typeof createBattle>) => {
      resolveRound(st, { A: hit("Pounce"), B: hit("Slash") });
      const e = st.log.find((x) => x.type === "attack" && x.side === "A");
      return e && e.type === "attack" && !e.precise ? e.damage : null;
    };
    let a: number | null = null, b: number | null = null;
    for (let i = 0; i < 50 && (a === null || b === null); i++) {
      a ??= dmg(createBattle([slow], [fast]));
      b ??= dmg(createBattle([slow], [fast], { B: [Math.floor(fast.maxHp / 3)] }));
    }
    expect(b!).toBe(Math.round(a! * 1.5));
  });

  it("Rabid Bite's venom ticks 10% of max HP for 3–5 rounds, even on the bench", () => {
    for (let n = 0; n < 30; n++) {
      const biter = fighter("rust_beetle", ["Rabid Bite", "Jab"]);
      const victim = { ...fighter("crystal_golem", ["Jab"]), maxHp: 500, hp: 500 };
      const spare = fighter("crystal_golem", ["Jab"]);
      const s = createBattle([biter], [victim, spare]);
      resolveRound(s, { A: hit("Rabid Bite"), B: hit("Jab") });
      expect(s.sides.B.team[0].statuses.find((x) => x.id === "venom")?.dmg).toBe(50);
      resolveRound(s, { A: hit("Jab"), B: { kind: "swap", to: 1 } }); // to the bench — still bitten
      for (let r = 0; r < 6; r++) resolveRound(s, { A: hit("Jab"), B: hit("Jab") });
      const ticks = s.log.filter((e) => e.type === "effect" && e.kind === "venom" && e.side === "B" && e.index === 0).length;
      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(ticks).toBeLessThanOrEqual(5);
    }
  });

  it("Mirage makes attacks shimmer away", () => {
    const sprite = fighter("dust_sprite", ["Mirage", "Bolt"]);
    const wolf = fighter("moss_wolf", ["Slash"]);
    let dodged = 0, swings = 0;
    for (let n = 0; n < 200; n++) {
      const s = createBattle([{ ...sprite, maxHp: 999, hp: 999 }], [wolf]);
      resolveRound(s, { A: hit("Mirage"), B: hit("Slash") });
      resolveRound(s, { A: hit("Bolt"), B: hit("Slash") });
      for (const e of s.log) if (e.type === "attack" && e.side === "B" && s.log.indexOf(e) > s.log.findIndex((x) => x.type === "effect")) {
        swings++;
        if (e.evaded) dodged++;
      }
    }
    expect(dodged / swings).toBeGreaterThan(0.2);
    expect(dodged / swings).toBeLessThan(0.4);
  });

  it("Corpsify: knocked out next round → back with 55% HP; then a 3-round cooldown", () => {
    const bones = fighter("rattlebones", ["Corpsify", "Slash"]);
    const brute = { ...fighter("dire_wolf", ["Devastator"]), maxHp: 999, hp: 999 };
    // Cast while healthy (the wolf is faster, so it hits first this round)…
    const s = createBattle([{ ...bones, maxHp: 400, hp: 400 }], [brute]);
    resolveRound(s, { A: hit("Corpsify"), B: hit("Devastator") });
    const me = s.sides.A.team[0];
    // …then it's knocked out next round, and rises again.
    me.hp = 5;
    s.sides.B.team[0].energy = 100;
    resolveRound(s, { A: hit("Slash"), B: hit("Devastator") });
    expect(me.hp).toBe(Math.round(me.maxHp * 0.55));
    expect(s.log.some((e) => e.type === "effect" && e.kind === "revive")).toBe(true);
    expect(s.winner).toBeNull();
    // Recharging for 3 rounds after it was cast (one has passed), then usable again.
    for (let r = 0; r < 2; r++) {
      expect(affordableSkills(me).map((x) => x.name)).not.toContain("Corpsify");
      me.energy = 100; me.hp = me.maxHp; s.sides.B.team[0].energy = 0;
      resolveRound(s, { A: hit("Slash"), B: { kind: "pass" } });
    }
    me.energy = 100;
    expect(affordableSkills(me).map((x) => x.name)).toContain("Corpsify");
  });

  it("Corpsify wears off after next round", () => {
    const bones = fighter("rattlebones", ["Corpsify", "Slash"]);
    const s = createBattle([bones], [fighter("moss_wolf", ["Jab"])]);
    resolveRound(s, { A: hit("Corpsify"), B: hit("Jab") });
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "corpsify")).toBe(true);
    resolveRound(s, { A: hit("Slash"), B: hit("Jab") });
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "corpsify")).toBe(false);
  });

  it("Barrage hits every enemy on the field", () => {
    const archer = fighter("thicket_archer", ["Barrage"]);
    const s = createBattle([archer], [fighter("moss_wolf", ["Jab"]), fighter("cave_bat", ["Flick"])]);
    s.sides.B.partner = 1;
    resolveRound(s, { A: hit("Barrage"), B: hit("Jab") });
    const targets = s.log.filter((e) => e.type === "attack" && e.side === "A").map((e) => e.type === "attack" && e.targetIndex);
    expect(targets.sort()).toEqual([0, 1]);
    expect(MOVE_BY_NAME.Barrage.race).toBe("elvish");
  });
});
