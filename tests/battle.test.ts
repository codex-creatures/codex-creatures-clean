import { describe, it, expect, vi } from "vitest";
import { CREATURE_BY_ID, defaultMoveNames } from "../lib/creatures/creatureData";
import { effectiveAgil } from "../lib/combat/engine";
import { buildFighter } from "../lib/combat/loadout";
import { createBattle, resolveRound, sendInReplacement, activeOf, isCrippled, currentAgility, CRIPPLE_ROUNDS, CRIPPLE_AGILITY_LOSS, HASTE_ROUNDS, streakEffects } from "../lib/combat/battle";
import { runTeamBattle } from "../lib/combat/teamBattle";
import { creatureTypeLabel } from "../lib/creatures/creatureType";

const f = (id: string, weapon?: Record<string, number>) => buildFighter(CREATURE_BY_ID[id], weapon);

describe("team battle rules", () => {
  it("a swap resolves first and the incoming creature takes the hit", () => {
    const s = createBattle([f("moss_wolf"), f("rust_beetle")], [f("dire_wolf"), f("cave_bat")]);
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Slash" } });
    const beetle = s.sides.A.team[1];
    expect(s.sides.A.active).toBe(1);
    expect(beetle.hp).toBeLessThan(beetle.maxHp);
    expect(s.sides.A.team[0].hp).toBe(s.sides.A.team[0].maxHp);
  });

  it("swapping out restores 50% of missing energy", () => {
    const s = createBattle([f("moss_wolf"), f("rust_beetle")], [f("crystal_golem"), f("cave_bat")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Heavy Blow" }, B: { kind: "attack", skillName: "Jab" } });
    const wolf = s.sides.A.team[0];
    expect(wolf.energy).toBe(100 - 40 + 30); // 90
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Jab" } });
    expect(wolf.energy).toBe(95);
  });

  it("attack costs energy, then regenerates 30 (max 100)", () => {
    const s = createBattle([f("ironjaw_hound")], [f("crystal_golem")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).energy).toBe(80);
    expect(activeOf(s.sides.B).energy).toBe(100);
  });

  it("rejects moves the creature can't afford or doesn't know", () => {
    const s = createBattle([f("ironjaw_hound")], [f("crystal_golem")]);
    expect(() => resolveRound(s, { A: { kind: "attack", skillName: "Annihilator" }, B: { kind: "pass" } })).toThrow();
  });

  it("a fainted creature must be replaced before the next round", () => {
    const big = { melee: 500 };
    const s = createBattle([f("dire_wolf", big)], [f("cave_bat"), f("rust_beetle")]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Bolt" } });
    expect(s.needsReplacement).toEqual(["B"]);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Bolt" } });
    expect(s.round).toBe(1); // blocked until a replacement is sent in
    sendInReplacement(s, "B", 1);
    expect(activeOf(s.sides.B).name).toBe("Rust Beetle");
  });

  it("auto battles always finish", () => {
    const team = () => [f("mantis_warden"), f("swamp_witch"), f("crystalback")];
    for (let i = 0; i < 50; i++) {
      const r = runTeamBattle(team(), team(), { swapsA: true, swapsB: true });
      expect(["A", "B", "draw"]).toContain(r.winner);
    }
  });
});

describe("creature type labels", () => {
  it("come from proficiency multipliers", () => {
    expect(creatureTypeLabel(CREATURE_BY_ID.dire_wolf.proficiency)).toBe("Bruiser");
    expect(creatureTypeLabel(CREATURE_BY_ID.crystalback.proficiency)).toBe("Tank");
    expect(creatureTypeLabel(CREATURE_BY_ID.forest_slime.proficiency)).toBe("Balanced");
    expect(creatureTypeLabel(CREATURE_BY_ID.void_serpent.proficiency)).toBe("Hybrid · Skirmisher");
  });
});

describe("move slots and learnable moves", () => {
  const mv = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], undefined, undefined, moves);

  it("a creature fights with 4 moves: its first 4 by default, learnable moves allowed", () => {
    expect(buildFighter(CREATURE_BY_ID.void_serpent).skills.map((s) => s.name))
      .toEqual(["Starfall", "Soul Drain", "Hex", "Devastator"]);
    expect(mv("dire_wolf", ["Crush", "Cripple", "Dash Lash", "Precise Slice", "Slash"]).skills.map((s) => s.name))
      .toEqual(["Crush", "Cripple", "Dash Lash", "Precise Slice"]);
    expect(mv("dire_wolf", ["Annihilator"]).skills.map((s) => s.name)).toEqual(defaultMoveNames(CREATURE_BY_ID.dire_wolf));
  });

  it("precise moves hit 70% of the time, and every hit is precise", () => {
    let hits = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const s = createBattle([mv("dire_wolf", ["Precise Slice"])], [mv("crystal_golem", ["Jab"])]);
      resolveRound(s, { A: { kind: "attack", skillName: "Precise Slice" }, B: { kind: "attack", skillName: "Jab" } });
      const e = s.log.find((x) => x.type === "attack" && x.side === "A");
      if (e?.type === "attack" && !e.missed) { hits++; expect(e.precise).toBe(true); }
    }
    expect(hits / N).toBeGreaterThan(0.66);
    expect(hits / N).toBeLessThan(0.74);
  });

  it("cripple lands 50% of the time, slows the target, and lasts the next 3 rounds", () => {
    let crippled = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const s = createBattle([mv("crystal_golem", ["Cripple", "Jab"])], [mv("ironhide", ["Slash"])]);
      resolveRound(s, { A: { kind: "attack", skillName: "Cripple" }, B: { kind: "attack", skillName: "Slash" } });
      if (isCrippled(activeOf(s.sides.B))) crippled++;
    }
    expect(crippled / N).toBeGreaterThan(0.46);
    expect(crippled / N).toBeLessThan(0.54);

    const fast = { agility: 100 };
    const s = createBattle([buildFighter(CREATURE_BY_ID.crystal_golem, undefined, undefined, ["Cripple", "Jab"])], [buildFighter(CREATURE_BY_ID.ironhide, fast, undefined, ["Slash"])]);
    const target = activeOf(s.sides.B);
    target.statuses = [{ id: "cripple", rounds: CRIPPLE_ROUNDS }]; // as at the start of the round after it landed
    expect(currentAgility(target)).toBeCloseTo(effectiveAgil(target) * (1 - CRIPPLE_AGILITY_LOSS));
    for (let r = 0; r < CRIPPLE_ROUNDS; r++) {
      resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Slash" } });
      expect(isCrippled(target)).toBe(r < CRIPPLE_ROUNDS - 1);
    }
  });

  it("a crippled creature stumbles and loses about a quarter of its attacks, spending no energy", () => {
    let tries = 0, lost = 0;
    for (let i = 0; i < 3000; i++) {
      const s = createBattle([mv("crystal_golem", ["Jab"])], [mv("ironhide", ["Slash"])]);
      const b = activeOf(s.sides.B);
      b.statuses = [{ id: "cripple", rounds: CRIPPLE_ROUNDS }];
      resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Slash" } });
      tries++;
      const stumbled = s.log.some((e) => e.type === "effect" && e.kind === "stumble");
      if (stumbled) { lost++; expect(b.energy).toBe(100); }
      expect(s.log.some((e) => e.type === "attack" && e.side === "B")).toBe(!stumbled);
    }
    expect(lost / tries).toBeGreaterThan(0.21);
    expect(lost / tries).toBeLessThan(0.29);
  });

  it("a dash move hastes you: faster this round and the next ones", () => {
    // Thornmaw has +6% agility: A = 106, B = 116.6 — B is faster unless A dashes.
    const a = buildFighter(CREATURE_BY_ID.thornmaw, { agility: 100 }, undefined, ["Dash Lash", "Jab"]); // 106 agility
    const b = buildFighter(CREATURE_BY_ID.thornmaw, { agility: 110 }, undefined, ["Jab"]);              // 116.6 agility
    const first = (skill: string) => {
      const s = createBattle([a], [b]);
      resolveRound(s, { A: { kind: "attack", skillName: skill }, B: { kind: "attack", skillName: "Jab" } });
      return s.log.find((x) => x.type === "attack")!;
    };
    expect(first("Jab")).toMatchObject({ side: "B" });
    expect(first("Dash Lash")).toMatchObject({ side: "A" }); // 106 × 1.5 = 159 > 116.6

    // The haste carries on: A strikes first with a plain move for HASTE_ROUNDS more rounds, then it wears off.
    const s = createBattle([a], [b]);
    resolveRound(s, { A: { kind: "attack", skillName: "Dash Lash" }, B: { kind: "attack", skillName: "Jab" } });
    for (let r = 0; r <= HASTE_ROUNDS; r++) {
      const from = s.log.length;
      resolveRound(s, { A: { kind: "attack", skillName: "Jab" }, B: { kind: "attack", skillName: "Jab" } });
      expect(s.log.slice(from).find((x) => x.type === "attack")).toMatchObject({ side: r < HASTE_ROUNDS ? "A" : "B" });
    }
  });
});

describe("armour gap (same move, same target)", () => {
  const tank = () => buildFighter(CREATURE_BY_ID.crystal_golem, undefined, { mDef: 60, hp: 900 }, ["Jab"]);
  const hitter = () => buildFighter(CREATURE_BY_ID.ironhide, { melee: 40, hp: 900 }, undefined, ["Slash", "Crush"]);

  it("precise chance climbs from the 6th use, and each precise hit opens the armour further", () => {
    const s = createBattle([hitter()], [tank()]);
    const ignored: number[] = [];
    const rand = vi.spyOn(Math, "random").mockReturnValue(0); // every roll succeeds → every hit precise
    for (let i = 0; i < 10; i++) {
      resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
      const e = s.log.filter((x) => x.type === "attack" && x.side === "A").at(-1);
      if (e?.type === "attack") ignored.push(e.defenceIgnored);
    }
    rand.mockRestore();
    // hits 1–5: ordinary precise (25%); from hit 6 each precise opens it further.
    expect(ignored).toEqual([0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.5, 0.75, 1, 1]);
  });

  it("precise chance per use: 5% until the 6th use, then +10% each", () => {
    const at = (hits: number) => streakEffects({ move: "Slash", targetIdx: 0, hits, cracks: 0 }).preciseChance;
    expect(at(5)).toBeCloseTo(0.05);
    expect(at(6)).toBeCloseTo(0.15);
    expect(at(8)).toBeCloseTo(0.35);
  });

  it("the run resets on a different move or when either creature swaps", () => {
    const s = createBattle([hitter(), hitter()], [tank(), tank()]);
    const atk = () => resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
    atk(); atk(); atk();
    expect(activeOf(s.sides.A).streak?.hits).toBe(3);
    resolveRound(s, { A: { kind: "attack", skillName: "Crush" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).streak).toMatchObject({ move: "Crush", hits: 1 });
    atk(); atk();
    resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "swap", to: 1 } }); // defender swaps
    expect(activeOf(s.sides.A).streak).toMatchObject({ targetIdx: 1, hits: 1 });
    atk();
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Jab" } }); // attacker swaps
    expect(s.sides.A.team[0].streak).toBeUndefined();
  });
});

describe("resting", () => {
  it("a creature with no affordable move rests and recovers energy (no soft-lock)", () => {
    const s = createBattle([buildFighter(CREATURE_BY_ID.void_serpent)], [buildFighter(CREATURE_BY_ID.crystal_golem, undefined, { hp: 900 })]);
    activeOf(s.sides.A).energy = 20; // Void Serpent's cheapest default move costs 30
    resolveRound(s, { A: { kind: "pass" }, B: { kind: "attack", skillName: "Jab" } });
    expect(activeOf(s.sides.A).energy).toBe(50);
  });
});

describe("armour gap ends when its target leaves", () => {
  it("knocking the target out ends the attacker's run (no cracked armour on the replacement)", () => {
    const killer = buildFighter(CREATURE_BY_ID.ironhide, { melee: 40, hp: 600 }, undefined, ["Slash"]);
    const s = createBattle([killer], [buildFighter(CREATURE_BY_ID.rust_beetle, undefined, { mDef: 90, hp: 300 }), buildFighter(CREATURE_BY_ID.crystalback)]);
    const rand = vi.spyOn(Math, "random").mockReturnValue(0);
    while (s.needsReplacement.length === 0 && !s.winner) {
      resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Jab" } });
    }
    rand.mockRestore();
    expect(activeOf(s.sides.A).streak!.cracks).toBeGreaterThan(0); // the run had cracked the first creature
    sendInReplacement(s, "B", 1);
    expect(activeOf(s.sides.A).streak).toBeUndefined();
  });
});
