import { describe, it, expect } from "vitest";
import { COLLECTOR_PRICES, TRADE_UP_COUNT, canTradeUp, collectorCreatures, creaturePrice, rarityAbove, tradeUpCard } from "../lib/collector";
import { summonVisitor } from "../lib/tavern";
import { CREATURES_BY_RARITY } from "../lib/creatures/creatureData";
import { makeCreatureDrop } from "../lib/creatures/summon";
import type { Rarity } from "../lib/items/budgets";

const creature = (r: Rarity, i = 0) => makeCreatureDrop(CREATURES_BY_RARITY[r][i % CREATURES_BY_RARITY[r].length], "creature", "");
const card = (r: Rarity) => makeCreatureDrop(CREATURES_BY_RARITY[r][0], "card", "");

describe("the creature collector", () => {
  it("pays by rarity", () => {
    expect(COLLECTOR_PRICES).toEqual({ common: 50, uncommon: 100, rare: 250, epic: 600, legendary: 1500 });
    expect(creaturePrice(creature("rare"))).toBe(250);
  });

  it("deals in creatures only, and not busy ones", () => {
    const a = creature("common"), b = creature("rare"), c = card("rare");
    expect(collectorCreatures([a, b, c], new Set([b.id]))).toEqual([a]);
  });

  it("trades 3 creatures of one rarity (any species) for a card one rarity up", () => {
    for (const r of ["common", "uncommon", "rare", "epic"] as Rarity[]) {
      const three = [creature(r, 0), creature(r, 1), creature(r, 2)];
      const got = tradeUpCard(three)!;
      expect(got.dropType).toBe("card");
      expect(got.rarity).toBe(rarityAbove(r));
      expect(CREATURES_BY_RARITY[rarityAbove(r)!].some((t) => t.id === got.creatureId)).toBe(true);
    }
  });

  it("won't trade the wrong number, mixed rarities, cards or legendaries", () => {
    expect(TRADE_UP_COUNT).toBe(3);
    expect(canTradeUp([creature("rare"), creature("rare")])).toBe(false);
    expect(canTradeUp([creature("rare"), creature("rare"), creature("rare"), creature("rare")])).toBe(false);
    expect(canTradeUp([creature("rare"), creature("rare"), creature("epic")])).toBe(false);
    expect(canTradeUp([creature("rare"), creature("rare"), card("rare")])).toBe(false);
    const one = creature("rare");
    expect(canTradeUp([one, one, one])).toBe(false);
    expect(tradeUpCard([creature("legendary"), creature("legendary"), creature("legendary")])).toBeNull();
  });

  it("can be sent for at the tavern, bringing no stock", () => {
    const t = summonVisitor({ repaired: true, visitor: "merchant", wares: [] }, "collector");
    expect(t.visitor).toBe("collector");
    expect(t.wares).toBeUndefined();
  });
});
