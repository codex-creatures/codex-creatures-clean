import { describe, it, expect } from "vitest";
import { KLUTZ } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { planExpedition, klutzStatus, collectKlutz, sendKlutz, currentHp, rollFind, WALK_MIN_MS, WALK_MAX_MS, HEAL_MS_PER_HP, FIND_CHANCE, SAME_RARITY_CHANCE, findRarity, type KlutzState } from "../lib/klutz";

// A small seeded random number generator, so expeditions are repeatable.
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const t0 = Date.parse("2026-10-15T12:00:00Z");
const plain = () => buildFighter(KLUTZ);
const mighty = () => ({ ...buildFighter(KLUTZ, { melee: 400, agility: 300 }, { mDef: 300, rDef: 300, magDef: 300, hp: 2000 }) });

describe("Klutz's expeditions", () => {
  it("he walks until he meets one creature (20–60 minutes in), fights it and comes home", () => {
    for (let s = 1; s < 40; s++) {
      const ex = planExpedition(mighty(), t0, seeded(s));
      expect(ex.encounters).toHaveLength(1);
      const e = ex.encounters[0];
      expect(e.won).toBe(true); // a mighty Klutz never loses
      expect(e.at).toBeGreaterThanOrEqual(t0 + WALK_MIN_MS);
      expect(e.at).toBeLessThanOrEqual(t0 + WALK_MAX_MS);
      expect(ex.endsAt).toBe(e.at);
      // The loot: the creature, then its weapon and an armour piece one tier below it.
      expect(e.loot[0]).toMatchObject({ dropType: "creature", creatureId: e.creatureId });
      expect(e.loot.slice(1).every((d) => d.dropType === "item" && (d as { rarity: string }).rarity === e.gearRarity)).toBe(true);
    }
  });

  it("a loss ends the trip early, and he heals 1 HP every 10 seconds in the pool", () => {
    // Find a seed where an ungeared Klutz loses.
    let ex = null;
    for (let s = 1; s < 200 && !ex; s++) {
      const e = planExpedition(plain(), t0, seeded(s));
      if (e.encounters.some((x) => !x.won)) ex = e;
    }
    expect(ex).not.toBeNull();
    const lost = ex!.encounters[ex!.encounters.length - 1];
    expect(lost.won).toBe(false);
    expect(ex!.endsAt).toBe(lost.at);

    const k: KlutzState = { expedition: ex! };
    expect(klutzStatus(k, ex!.maxHp, lost.at - 1).kind).toBe("away");
    const { state } = collectKlutz(k, lost.at);
    expect(state.hp).toBe(0);
    expect(currentHp(state, ex!.maxHp, lost.at + 5 * HEAL_MS_PER_HP)).toBe(5);
    expect(klutzStatus(state, ex!.maxHp, lost.at + 5 * HEAL_MS_PER_HP).kind).toBe("healing");
    expect(klutzStatus(state, ex!.maxHp, lost.at + ex!.maxHp * HEAL_MS_PER_HP).kind).toBe("home");
    // He can't be sent off while healing.
    expect(sendKlutz(state, plain(), lost.at + 1000)).toBe(state);
  });

  it("hands over the loot once", () => {
    const ex = planExpedition(mighty(), t0, seeded(7));
    const k: KlutzState = { expedition: ex };
    expect(collectKlutz(k, t0 + 1000).loot).toEqual([]); // still away
    const first = collectKlutz(k, ex.endsAt);
    expect(first.loot.length).toBe(3);
    expect(collectKlutz(first.state, ex.endsAt + 1).loot).toEqual([]);
  });
});

describe("Klutz's finds", () => {
  it("are for a slot he's wearing, and never rarer than his piece there", () => {
    expect(rollFind([])).toBeUndefined();
    for (let i = 0; i < 300; i++) {
      const d = rollFind([{ slot: "helmet", rarity: "rare" }]) as { itemCategory: string; armorSlot: string; rarity: string };
      expect(d).toMatchObject({ itemCategory: "armor", armorSlot: "helmet" });
      expect(["common", "uncommon", "rare"]).toContain(d.rarity);
    }
    expect(rollFind([{ slot: "weapon", rarity: "epic" }])).toMatchObject({ itemCategory: "weapon" });
  });

  it("rarity: 5% the same as his piece, otherwise lower and evenly spread; in Common gear, Common or Uncommon 50/50", () => {
    const N = 6000;
    const count = (worn: "common" | "rare" | "legendary") => {
      const c: Record<string, number> = {};
      for (let i = 0; i < N; i++) { const r = findRarity(worn); c[r] = (c[r] ?? 0) + 1; }
      return c;
    };
    const rare = count("rare");
    expect(Math.abs(rare.rare / N - SAME_RARITY_CHANCE)).toBeLessThan(0.015);
    expect(rare.epic ?? 0).toBe(0);
    expect(Math.abs(rare.common / N - 0.475)).toBeLessThan(0.03);
    expect(Math.abs(rare.uncommon / N - 0.475)).toBeLessThan(0.03);
    const legendary = count("legendary");
    expect(Math.abs(legendary.legendary / N - SAME_RARITY_CHANCE)).toBeLessThan(0.015);
    const common = count("common");
    expect(Math.abs(common.uncommon / N - 0.5)).toBeLessThan(0.03);
    expect(Object.keys(common).sort()).toEqual(["common", "uncommon"]);
  });

  it("turn up on about 35% of trips (win or lose) and come home with the loot", () => {
    let found = 0;
    for (let s = 1; s <= 400; s++) {
      const ex = planExpedition(plain(), t0, seeded(s), [{ slot: "weapon", rarity: "common" }]);
      if (ex.find) {
        found++;
        expect(collectKlutz({ expedition: ex }, ex.endsAt).loot).toContain(ex.find);
      }
    }
    expect(Math.abs(found / 400 - FIND_CHANCE)).toBeLessThan(0.08);
    expect(planExpedition(plain(), t0, seeded(3)).find).toBeUndefined(); // wearing nothing: nothing to find
  });
});
