import { describe, it, expect } from "vitest";
import { createBattle, resolveRound, sendInReplacement, activeOf, type BattleState } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage } from "../lib/combat/engine";
import { CREATURE_BY_ID, CREATURE_TEMPLATES, KLUTZ, MOVE_BY_NAME, canLearnFromCodex, stylesOf } from "../lib/creatures/creatureData";
import { codexDrop } from "../lib/drops";
import { SOUL_STONES } from "../lib/creatures/soulStones";
import type { CreatureOrItemDrop } from "../lib/types";

// Brace, the Divine blessings, Blood Sacrifice and Toxic immunity (the user, 2026-11-03).
const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20, magic: 20 }, { mDef: 5, rDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T, hp = 999) => ({ ...f, maxHp: hp, hp });
const attack = (skillName: string) => ({ kind: "attack" as const, skillName });
const swap = (to: number) => ({ kind: "swap" as const, to });
const since = (s: BattleState, n: number) => s.log.slice(n);

describe("who can learn the new codexes", () => {
  it("Brace: anyone, Klutz too; a Rare codex", () => {
    for (const t of [...CREATURE_TEMPLATES, KLUTZ]) expect(canLearnFromCodex(t, "Brace"), t.id).toBe(true);
    expect((codexDrop("Brace") as CreatureOrItemDrop).rarity).toBe("rare");
  });
  it("the Divine blessings: every creature that fights in that style (hybrids too); Epic codexes", () => {
    for (const [move, style] of [["Divine Strength", "melee"], ["Arcane Channel", "magic"], ["Sureshot Blessing", "ranged"]] as const) {
      const learners = CREATURE_TEMPLATES.filter((t) => canLearnFromCodex(t, move));
      expect(learners.length, move).toBeGreaterThan(5);
      for (const t of CREATURE_TEMPLATES) expect(canLearnFromCodex(t, move), `${move} ${t.id}`).toBe(stylesOf(t).includes(style));
      expect(canLearnFromCodex(KLUTZ, move)).toBe(true); // (Klutz can learn any codex: the user, 2026-11-14)
      expect((codexDrop(move) as CreatureOrItemDrop).rarity).toBe("epic");
      expect(MOVE_BY_NAME[move]).toMatchObject({ energyCost: 50, cooldown: 5, race: "divine", self: true });
    }
    // A Battlemage learns both melee and magic.
    expect(canLearnFromCodex(CREATURE_BY_ID.crystal_golem, "Divine Strength")).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.crystal_golem, "Arcane Channel")).toBe(true);
    expect(canLearnFromCodex(CREATURE_BY_ID.crystal_golem, "Sureshot Blessing")).toBe(false);
  });
  it("Blood Sacrifice: Dark Seal's learners; an Epic codex, 70 energy", () => {
    for (const t of CREATURE_TEMPLATES) expect(canLearnFromCodex(t, "Blood Sacrifice"), t.id).toBe(canLearnFromCodex(t, "Dark Seal"));
    expect((codexDrop("Blood Sacrifice") as CreatureOrItemDrop).rarity).toBe("epic");
    expect(MOVE_BY_NAME["Blood Sacrifice"]).toMatchObject({ energyCost: 70, damage: 0 });
  });
});

describe("Brace", () => {
  it("goes first, even when slower, and the next hit does 90% less", () => {
    const fails: string[] = [];
    for (let n = 0; n < 200; n++) {
      // The Ironhide is slow; the Amber Wasp quick.
      const a = big(fighter("ironhide", ["Brace", "Strike"])), b = big(fighter("amber_wasp", ["Strike", "Rush"]));
      const s = createBattle([a], [b]);
      resolveRound(s, { A: attack("Brace"), B: attack("Strike") });
      const ev = s.log.filter((e) => e.type === "effect" || e.type === "attack");
      if (ev[0]?.type !== "effect") fails.push("brace not first");
      const hit = ev.find((e) => e.type === "attack");
      const plain = calcDamage(b.skills.find((m) => m.name === "Strike")!, b, a, false).damage; // (as the Wasp knows it: a Beast hit)
      if (hit?.type !== "attack" || !hit.braced || hit.damage > Math.max(1, Math.ceil(plain * 1.05 * 1.75 * 0.1))) fails.push(`hit ${hit?.type === "attack" ? hit.damage : "?"} vs ${plain}`);
      if (s.sides.A.team[0].statuses.some((x) => x.id === "brace")) fails.push("brace left over");
    }
    expect(fails.slice(0, 5)).toEqual([]);
  });
  it("lasts only the round it's used", () => {
    const s = createBattle([big(fighter("ironhide", ["Brace", "Strike"]))], [big(fighter("amber_wasp", ["Strike"])), big(fighter("glob", ["Strike"]))]);
    resolveRound(s, { A: attack("Brace"), B: swap(1) }); // (nobody hits it)
    expect(s.sides.A.team[0].statuses.some((x) => x.id === "brace")).toBe(false);
  });
});

describe("Divine Strength and the other blessings", () => {
  it("+50% melee attack while it stays out; doesn't stack; swapping out loses it", () => {
    const s = createBattle([big(fighter("moss_wolf", ["Divine Strength", "Strike", "Rush"])), big(fighter("dire_wolf", ["Strike"]))], [big(fighter("glob", ["Strike"]))]);
    const me = () => s.sides.A.team[0];
    const before = calcDamage(MOVE_BY_NAME.Strike, me(), activeOf(s.sides.B), false).damage;
    resolveRound(s, { A: attack("Divine Strength"), B: attack("Strike") });
    expect(me().boost).toEqual({ melee: 0.5 });
    expect(calcDamage(MOVE_BY_NAME.Strike, me(), activeOf(s.sides.B), false).damage).toBeGreaterThan(before);
    expect(() => resolveRound(s, { A: attack("Divine Strength"), B: attack("Strike") })).toThrow(); // 5-round cooldown
    resolveRound(s, { A: swap(1), B: attack("Strike") });
    expect(me().boost).toBeUndefined();
    expect(me().statuses.some((x) => x.id === "boost")).toBe(false);
  });
  it("only its own style: Arcane Channel doesn't lift a melee hit", () => {
    const s = createBattle([big(fighter("crystal_golem", ["Arcane Channel", "Strike", "Zap"]))], [big(fighter("glob", ["Strike"]))]);
    const me = () => s.sides.A.team[0];
    const melee = calcDamage(MOVE_BY_NAME.Strike, me(), activeOf(s.sides.B), false).damage;
    const magic = calcDamage(MOVE_BY_NAME.Zap, me(), activeOf(s.sides.B), false).damage;
    resolveRound(s, { A: attack("Arcane Channel"), B: attack("Strike") });
    expect(calcDamage(MOVE_BY_NAME.Strike, me(), activeOf(s.sides.B), false).damage).toBe(melee);
    expect(calcDamage(MOVE_BY_NAME.Zap, me(), activeOf(s.sides.B), false).damage).toBeGreaterThan(magic);
  });
});

describe("Toxic creatures can't be poisoned", () => {
  it("Rabid Bite's venom doesn't take on a Toxic creature", () => {
    for (let n = 0; n < 20; n++) {
      const s = createBattle([big(fighter("moss_wolf", ["Rabid Bite", "Strike"]))], [big(fighter("glob", ["Strike"]))]);
      resolveRound(s, { A: attack("Rabid Bite"), B: attack("Strike") });
      expect(s.sides.B.team[0].statuses.some((x) => x.id === "venom")).toBe(false);
    }
    const s = createBattle([big(fighter("moss_wolf", ["Rabid Bite", "Strike"]))], [big(fighter("dire_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Rabid Bite"), B: attack("Strike") });
    const hit = s.log.find((e) => e.type === "attack" && e.side === "A");
    if (hit?.type === "attack" && !hit.missed) expect(s.sides.B.team[0].statuses.some((x) => x.id === "venom")).toBe(true);
  });
  it("Toxic Skin doesn't poison a Toxic attacker", () => {
    expect(SOUL_STONES.toxic_skin).toBeTruthy();
    for (let n = 0; n < 200; n++) {
      const s = createBattle([big(fighter("glob", ["Strike"]))], [{ ...big(fighter("moss_wolf", ["Strike"])), soulStone: "toxic_skin" as const }]);
      resolveRound(s, { A: attack("Strike"), B: attack("Strike") });
      expect(s.sides.A.team[0].statuses.some((x) => x.id === "poison")).toBe(false);
    }
  });
});

describe("Blood Sacrifice", () => {
  // Dreadpox casts; their side: a wolf out front, two more on the bench.
  const setup = (bench = ["dire_wolf", "ironhide"]) => createBattle(
    [big(fighter("dreadpox", ["Blood Sacrifice", "Zap"]), 400), big(fighter("moss_wolf", ["Strike"]), 400)],
    [big(fighter("moss_wolf", ["Strike"]), 1000), ...bench.map((id) => big(fighter(id, ["Strike"]), 1000))],
    { A: [200, 400] });
  const pool = (s: BattleState) => s.sides.B.ground?.find((g) => g.kind === "blood");

  it("costs 25% of max HP, and the one out bleeds 5% a round; whoever you have out heals half", () => {
    const s = setup();
    const n = s.log.length;
    resolveRound(s, { A: attack("Blood Sacrifice"), B: attack("Strike") });
    const ev = since(s, n);
    expect(ev.find((e) => e.type === "effect" && e.kind === "self")).toMatchObject({ damage: 100 });
    expect(pool(s)).toMatchObject({ count: 0, by: 0 });
    const tick = ev.find((e) => e.type === "effect" && e.kind === "blood");
    expect(tick).toMatchObject({ side: "B", damage: 50 });
    const heal = ev.find((e) => e.type === "effect" && e.kind === "heal" && e.side === "A");
    expect(heal).toMatchObject({ damage: 25 });
  });
  it("20% to each that comes in; the third bursts with the caster's magic, and the pool's gone", () => {
    const s = setup(["dire_wolf", "ironhide", "amber_wasp"]);
    resolveRound(s, { A: attack("Blood Sacrifice"), B: attack("Strike") });
    const entries = (from: number) => since(s, from).filter((e) => e.type === "effect" && e.kind === "blood" && e.text.includes("steps into"));
    let n = s.log.length;
    resolveRound(s, { A: attack("Zap"), B: swap(1) });
    expect(entries(n)).toEqual([expect.objectContaining({ damage: 200 })]);
    expect(pool(s)?.count).toBe(1);
    n = s.log.length;
    resolveRound(s, { A: attack("Zap"), B: swap(2) });
    expect(entries(n).length).toBe(1);
    expect(pool(s)?.count).toBe(2);
    n = s.log.length;
    resolveRound(s, { A: attack("Zap"), B: swap(3) });
    const burst = since(s, n).find((e) => e.type === "effect" && e.kind === "burst");
    expect(burst).toBeTruthy();
    expect(pool(s)).toBeUndefined();
  });
  it("a replacement meets it as the next round starts", () => {
    const s = createBattle([big(fighter("dreadpox", ["Blood Sacrifice", "Zap"]), 400)], [fighter("moss_wolf", ["Strike"]), big(fighter("dire_wolf", ["Strike"]), 1000)], { B: [1] });
    resolveRound(s, { A: attack("Blood Sacrifice"), B: attack("Strike") });
    expect(s.needsReplacement).toEqual(["B"]);
    sendInReplacement(s, "B", 1);
    expect(s.sides.B.team[1].hp).toBe(1000); // not yet
    const n = s.log.length;
    resolveRound(s, { A: attack("Zap"), B: attack("Strike") });
    const ev = since(s, n);
    const entry = ev.findIndex((e) => e.type === "effect" && e.kind === "blood");
    expect(entry).toBeGreaterThan(-1);
    expect(ev[entry]).toMatchObject({ damage: 200 });
    expect(entry).toBeLessThan(ev.findIndex((e) => e.type === "attack"));
  });
  it("Undead are untouched: no bleeding, and coming in doesn't count", () => {
    const s = setup(["rattlebones", "dire_wolf"]);
    resolveRound(s, { A: attack("Blood Sacrifice"), B: swap(1) }); // (the swap comes first: a Rattlebones out before the pool)
    const n = s.log.length;
    resolveRound(s, { A: attack("Zap"), B: attack("Strike") });
    expect(since(s, n).some((e) => e.type === "effect" && e.kind === "blood")).toBe(false);
    resolveRound(s, { A: attack("Zap"), B: swap(0) }); // the wolf comes back: 1
    resolveRound(s, { A: attack("Zap"), B: swap(1) }); // the Rattlebones: doesn't count
    expect(pool(s)?.count).toBe(1);
  });
});

describe("Blood Sacrifice can knock out its caster", () => {
  it("25% of max HP is paid even if that's all it has left; the pool still spreads", () => {
    const s = createBattle([big(fighter("dreadpox", ["Blood Sacrifice", "Zap"]), 400), big(fighter("moss_wolf", ["Strike"]), 400)],
      [big(fighter("glob", ["Strike"]), 1000)], { A: [50, 400] });
    resolveRound(s, { A: attack("Blood Sacrifice"), B: attack("Strike") });
    expect(s.sides.A.team[0].hp).toBeLessThanOrEqual(0);
    expect(s.log.some((e) => e.type === "faint" && e.side === "A")).toBe(true);
    expect(s.sides.B.ground?.some((g) => g.kind === "blood")).toBe(true);
    expect(s.needsReplacement).toEqual(["A"]);
  });
});
