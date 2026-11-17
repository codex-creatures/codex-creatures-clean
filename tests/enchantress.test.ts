// tests/enchantress.test.ts
// The Enchantress (decision 47, lib/enchantress.ts): a tavern visitor who
// rerolls an item's enchantment for an essence stone and gold by its rarity.

import { describe, it, expect } from "vitest";
import { canReroll, enchantedItems, reroll, rerollCost, REROLL_ESSENCE, REROLL_GOLD } from "../lib/enchantress";
import { guestOf, summonVisitor, VISITORS } from "../lib/tavern";
import { weaponDrop, armorDrop } from "../lib/drops";
import { enchantPool } from "../lib/items/enchantments";
import { seeded } from "../lib/creatures/soulStones";
import type { CreatureOrItemDrop } from "../lib/types";

const sword = (rarity: "rare" | "epic" | "legendary" | "common", enchant?: CreatureOrItemDrop["enchant"]) =>
  ({ ...(weaponDrop("void_scythe", rarity) as CreatureOrItemDrop), ...(enchant ? { enchant } : {}) });

describe("the Enchantress", () => {
  it("is a fourth visitor, sent for like the others, bringing no stock", () => {
    expect(VISITORS).toEqual(["merchant", "librarian", "enchantress"]); // (the collector's away: 2026-11-18)
    const t = summonVisitor({ repaired: true }, "enchantress", seeded("x"), false, 1e12);
    const g = guestOf(t, "enchantress", 1e12)!;
    expect(g).toBeDefined();
    expect(g.wares).toBeUndefined();
    expect(g.offers).toBeUndefined();
  });
  it("costs 1 essence stone plus 1,000 / 2,000 / 5,000 gold by the item's rarity", () => {
    expect(REROLL_ESSENCE).toBe(1);
    expect(REROLL_GOLD).toEqual({ rare: 1000, epic: 2000, legendary: 5000 });
    expect(rerollCost(sword("epic", "bounty"))).toEqual({ gold: 2000, materials: { essence: 1 } });
    expect(rerollCost(sword("epic"))).toBeNull(); // (nothing to reroll)
  });
  it("needs the gold and an essence stone", () => {
    const d = sword("rare", "keen");
    expect(canReroll(d, 1000, { essence: 1 })).toBe(true);
    expect(canReroll(d, 999, { essence: 1 })).toBe(false);
    expect(canReroll(d, 1000, { essence_stones: 5 })).toBe(false); // (Stone isn't an essence stone)
  });
  it("gives a different enchantment from the pool that fits the item", () => {
    const rng = seeded("reroll");
    for (let i = 0; i < 100; i++) {
      const d = sword("legendary", "bossbane");
      const r = reroll(d, rng);
      expect(r.enchant).not.toBe("bossbane");
      expect(enchantPool(d)).toContain(r.enchant);
      expect(r.stats).toEqual(d.stats); // (the stats stay as they are)
    }
    const helm = { ...(armorDrop("frontiers_mail", "epic", "", undefined, "helmet") as CreatureOrItemDrop), enchant: "fleet" as const };
    expect(enchantPool(helm)).toContain(reroll(helm, seeded("a")).enchant);
  });
  it("works on enchanted weapons and armour only", () => {
    const list = enchantedItems([sword("rare", "keen"), sword("rare"), sword("common", "keen")]);
    expect(list.map((d) => d.enchant)).toEqual(["keen"]);
  });
});
