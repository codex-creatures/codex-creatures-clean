import { describe, it, expect, vi } from "vitest";
import { createBattle, resolveRound, affordableSkills, type BattleAction } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { BASIC_MOVES, STRONG_MOVES, CREATURE_BY_ID, RACE_MOVES, LEARNABLE_MOVES, MOVE_BY_NAME, movesAvailableTo, resolveMoves, canLearnFromCodex } from "../lib/creatures/creatureData";
import { dropFromOutcome } from "../lib/drops";

const hit = (skillName: string): BattleAction => ({ kind: "attack", skillName });
const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20 }, { mDef: 5, rDef: 5 }, moves);

describe("what a creature can use and learn", () => {
  it("only its own (rolled) moves plus what it learned from codexes", () => {
    const wolf = CREATURE_BY_ID.moss_wolf;
    const names = (own: string[], learned: string[] = []) => movesAvailableTo(wolf, learned, own).map((m) => m.name);
    expect(names(["Slash", "Jab", "Heavy Blow"])).toEqual(["Slash", "Jab", "Heavy Blow"]);
    expect(names(["Slash"], [LEARNABLE_MOVES[0].name, "Pounce", "Mirage"])).toEqual(["Slash", LEARNABLE_MOVES[0].name, "Pounce"]);
  });

  it("learnable codexes work on anyone; race codexes only on that race", () => {
    expect(canLearnFromCodex(CREATURE_BY_ID.cave_bat, LEARNABLE_MOVES[0].name)).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.cave_bat, "Pounce")).toBe(false);
    expect(canLearnFromCodex(CREATURE_BY_ID.moss_wolf, "Pounce")).toBe(true);
  });

  it("consumables: Common a Lesser Potion or basic codex, Uncommon a learnable codex, Rare a Healing Potion or strong codex", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValue(0.99); // past the codex share: the potion
    const potion = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "common" });
    const healing = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "rare" });
    random.mockReturnValue(0);    // under it: a codex
    const basic = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "common" });
    const strong = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "rare" });
    random.mockRestore();
    expect(healing && "potion" in healing && healing.potion).toBe("potion");
    expect(healing && "rarity" in healing && healing.rarity).toBe("rare");
    expect(strong && "codexMove" in strong && STRONG_MOVES.some((m) => m.name === strong.codexMove)).toBe(true);
    expect(strong && "rarity" in strong && strong.rarity).toBe("rare");
    const codex = dropFromOutcome({ outcome: "item", itemCategory: "consumable", rarity: "uncommon" });
    expect(potion && "potion" in potion && potion.potion).toBe("lesser");
    expect(basic && "codexMove" in basic && BASIC_MOVES.some((m) => m.name === basic.codexMove)).toBe(true);
    expect(basic && "rarity" in basic && basic.rarity).toBe("common");
    expect(codex && "codexMove" in codex && LEARNABLE_MOVES.some((m) => m.name === codex.codexMove)).toBe(true);
  });

  it("basic codexes: the natural moves up to 20 damage, for creatures of that class", () => {
    expect(BASIC_MOVES).toHaveLength(15);
    expect(BASIC_MOVES.every((m) => m.damage <= 20 && !m.effect)).toBe(true);
    expect(BASIC_MOVES.map((m) => m.name)).not.toContain("Devastator");
    const wolf = CREATURE_BY_ID.moss_wolf; // melee
    expect(wolf.cls).toBe("melee");
    expect(canLearnFromCodex(wolf, "Heavy Blow")).toBe(true);
    expect(canLearnFromCodex(wolf, "Ice Lance")).toBe(false);  // magic
    // Once learned, it can go in a slot and is kept there.
    expect(movesAvailableTo(wolf, ["Heavy Blow", "Ice Lance"], ["Slash"]).map((m) => m.name)).toEqual(["Slash", "Heavy Blow"]);
    expect(resolveMoves(wolf, ["Slash", "Heavy Blow"]).map((m) => m.name)).toEqual(["Slash", "Heavy Blow"]);
  });

  it("strong codexes: the rest of the natural moves, also for creatures of that class", () => {
    expect(STRONG_MOVES).toHaveLength(10);
    expect(STRONG_MOVES.every((m) => m.damage > 20)).toBe(true);
    const wolf = CREATURE_BY_ID.moss_wolf; // melee
    expect(canLearnFromCodex(wolf, "Devastator")).toBe(true);
    expect(canLearnFromCodex(wolf, "Starfall")).toBe(false); // magic
    expect(resolveMoves(wolf, ["Slash", "Devastator"]).map((m) => m.name)).toEqual(["Slash", "Devastator"]);
  });
});

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
    const fast = fighter("monkey_mage", ["Slash", "Bolt"]);      // agility 30%
    const s = createBattle([slow], [fast]);
    resolveRound(s, { A: hit("Pounce"), B: hit("Slash") });
    const attacks = s.log.filter((e) => e.type === "attack");
    expect(attacks[0].type === "attack" && attacks[0].attacker).toBe("Ironhide");

    // Same hit on a healthy and a wounded target (no precise hits; the same damage roll).
    const fixed = vi.spyOn(Math, "random").mockReturnValue(0.5);
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
    fixed.mockRestore();
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
