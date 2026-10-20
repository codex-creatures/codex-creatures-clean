import { describe, it, expect } from "vitest";
import { DISCOVERABLE_ITEMS, TOTAL_DISCOVERABLE_ITEMS, itemDiscoveryKey, discoveredItemKeys } from "../lib/items/discovery";
import { weaponDrop, armorDrop, potionDrop, codexDrop, goldDrop } from "../lib/drops";
import { materialDrop } from "../lib/items/materials";
import { ITEM_KEYS } from "../lib/items/ceilings";
import { ARMOR_KEYS } from "../lib/items/armor";
import { LEARNABLE_MOVES } from "../lib/creatures/creatureData";

describe("items discovered", () => {
  it("counts every kind of item, not only weapons and armour", () => {
    expect(TOTAL_DISCOVERABLE_ITEMS).toBeGreaterThan(ITEM_KEYS.length + ARMOR_KEYS.length);
    expect(DISCOVERABLE_ITEMS.has("m:planks")).toBe(true);
    expect(DISCOVERABLE_ITEMS.has("p:lesser")).toBe(true);
    expect(DISCOVERABLE_ITEMS.has(`c:${LEARNABLE_MOVES[0].name}`)).toBe(true);
  });

  it("gives each item drop its kind; armour pieces share their armour", () => {
    expect(itemDiscoveryKey(weaponDrop(ITEM_KEYS[0], "common"))).toBe(`w:${ITEM_KEYS[0]}`);
    const a = ARMOR_KEYS[0];
    expect(itemDiscoveryKey(armorDrop(a, "rare", "", undefined, "helmet"))).toBe(itemDiscoveryKey(armorDrop(a, "rare", "", undefined, "legs")));
    expect(itemDiscoveryKey(potionDrop("", "potion"))).toBe("p:potion");
    expect(itemDiscoveryKey(materialDrop("nails", 5))).toBe("m:nails");
    expect(itemDiscoveryKey(codexDrop(LEARNABLE_MOVES[0].name))).toBe(`c:${LEARNABLE_MOVES[0].name}`);
    expect(itemDiscoveryKey(goldDrop(10))).toBeUndefined();
  });

  it("remembers what you've used up, and counts what an older save already holds", () => {
    const keys = discoveredItemKeys(["p:lesser", "nonsense"], [weaponDrop(ITEM_KEYS[0], "common")], { planks: 3, nails: 0 });
    expect([...keys].sort()).toEqual(["m:planks", "p:lesser", `w:${ITEM_KEYS[0]}`].sort());
  });
});
