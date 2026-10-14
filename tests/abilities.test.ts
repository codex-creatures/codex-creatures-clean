import { describe, it, expect, vi, afterEach } from "vitest";
import { ABILITIES, ABILITY_CHANCE, DIVINE_HEALING, KEEN_EYE_BONUS, rollAbility, type AbilityKey } from "../lib/creatures/abilities";
import { CREATURE_TEMPLATES, CREATURE_BY_ID, MOVE_BY_NAME } from "../lib/creatures/creatureData";
import { makeCreatureDrop, summonFromCards } from "../lib/creatures/summon";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, DAMAGE_VARIANCE, rollDamage, PRECISE_IGNORE, type Fighter } from "../lib/combat/engine";
import { createBattle, resolveRound, type BattleEvent } from "../lib/combat/battle";

afterEach(() => vi.restoreAllMocks());

const make = (ability?: AbilityKey, agil = 0): Fighter => ({
  ...buildFighter(CREATURE_BY_ID.klutz, { melee: 40, ranged: 40, agility: agil }, { mDef: 10, rDef: 10 }),
  skills: [MOVE_BY_NAME.Slash], ...(ability ? { ability } : {}),
});
const firstHit = (log: BattleEvent[]) => log.find((e): e is Extract<BattleEvent, { type: "attack" }> => e.type === "attack" && e.side === "A")!;

describe("abilities", () => {
  it("only creatures in an ability's pool ever get one, and only Epic or better", () => {
    const pools = new Set(Object.values(ABILITIES).flatMap((a) => a.pool));
    for (const t of CREATURE_TEMPLATES) {
      const got = new Set(Array.from({ length: 300 }, () => rollAbility(t)).filter(Boolean));
      if (!pools.has(t.id)) expect(got.size).toBe(0);
      else expect(ABILITY_CHANCE[t.rarity]).toBeGreaterThan(0);
      for (const k of got) expect(ABILITIES[k as AbilityKey].pool).toContain(t.id);
    }
  });

  it("comes up at about its rarity's chance", () => {
    const t = CREATURE_BY_ID.sylvaran; // legendary, Keen Eye pool
    const n = 4000;
    const hits = Array.from({ length: n }, () => rollAbility(t)).filter((a) => a === "keen_eye").length;
    expect(hits / n).toBeGreaterThan(ABILITY_CHANCE.legendary! - 0.05);
    expect(hits / n).toBeLessThan(ABILITY_CHANCE.legendary! + 0.05);
  });

  it("a card's ability carries over when you summon from it", () => {
    const t = CREATURE_BY_ID.sylvaran;
    const roll = { proficiency: t.proficiency, moves: t.skills.map((s) => s.name), ability: "keen_eye" as const };
    const cards = [makeCreatureDrop(t, "card", "", roll), makeCreatureDrop(t, "card", ""), makeCreatureDrop(t, "card", "")];
    expect(cards[0].ability).toBe("keen_eye");
    expect(summonFromCards(cards, cards[0].id).ability).toBe("keen_eye");
  });

  it("Keen Eye: precise hits deal 10% more", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // every hit precise, same damage roll
    const slash = { kind: "attack", skillName: "Slash" } as const;
    const plain = createBattle([make(undefined, 100)], [make()]);
    resolveRound(plain, { A: slash, B: slash });
    const keen = createBattle([make("keen_eye", 100)], [make()]);
    resolveRound(keen, { A: slash, B: slash });
    expect(firstHit(plain.log).precise).toBe(true);
    expect(firstHit(keen.log).damage).toBe(Math.round(firstHit(plain.log).damage * (1 + KEEN_EYE_BONUS)));
  });

  it("Divine Healing: swapping out restores 15% of max HP", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const healer = make("divine_healing");
    const s = createBattle([healer, make()], [make()], { A: [10, healer.maxHp] });
    resolveRound(s, { A: { kind: "swap", to: 1 }, B: { kind: "attack", skillName: "Slash" } });
    expect(s.sides.A.team[0].hp).toBe(10 + Math.round(healer.maxHp * DIVINE_HEALING));
    expect(s.log.some((e) => e.type === "effect" && e.kind === "ability")).toBe(true);
  });
});

describe("damage roll", () => {
  it("every hit rolls within ±5% before armour", () => {
    for (let i = 0; i < 200; i++) {
      const r = rollDamage();
      expect(r).toBeGreaterThanOrEqual(1 - DAMAGE_VARIANCE);
      expect(r).toBeLessThanOrEqual(1 + DAMAGE_VARIANCE);
    }
    const a = make(), d = { ...make(), armor: { ...make().armor, mdef: 0 } };
    const avg = calcDamage(MOVE_BY_NAME.Slash, a, d, false).damage;
    expect(calcDamage(MOVE_BY_NAME.Slash, a, d, false, PRECISE_IGNORE, 1.05).damage).toBeGreaterThan(avg);
    expect(calcDamage(MOVE_BY_NAME.Slash, a, d, false, PRECISE_IGNORE, 0.95).damage).toBeLessThan(avg);
  });

  it("the same hit doesn't always do the same damage", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const s = createBattle([make(undefined, 100)], [make()]);
      resolveRound(s, { A: { kind: "attack", skillName: "Slash" }, B: { kind: "attack", skillName: "Slash" } });
      seen.add(firstHit(s.log).damage);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
