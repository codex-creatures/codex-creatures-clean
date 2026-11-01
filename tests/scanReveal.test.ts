import { describe, it, expect } from "vitest";
import { GOLD_SHAKE_MS, SHAKE_MS, findLine, findPrice, ordinal, revealChoice, revealTier, shakeMs } from "../lib/scanReveal";
import { POTIONS, SCROLL_PRICE, codexPrice } from "../lib/dungeon/run";
import { TOOLS } from "../lib/items/materials";
import type { Drop } from "../lib/types";

const drop = (x: Record<string, unknown>) => ({ id: "d", name: "Thing", rarity: "common", ...x }) as unknown as Drop;

describe("the altar's unveiling", () => {
  it("creatures and cards are released, gold just taken, anything with a price sold, the rest kept", () => {
    expect(revealChoice(drop({ dropType: "item", itemCategory: "weapon" }), 30)).toBe("sell");
    expect(revealChoice(drop({ dropType: "creature" }), 0)).toBe("release");
    expect(revealChoice(drop({ dropType: "card" }), 0)).toBe("release");
    expect(revealChoice(drop({ dropType: "reward", amount: 50 }), 0)).toBe("gold");
    expect(revealChoice(drop({ dropType: "item", material: "planks" }), 0)).toBe("keep");
  });

  it("gear sells at the Inventory's price, potions, codexes, scrolls and tools at half what they cost", () => {
    const gear = () => 42;
    expect(findPrice(drop({ dropType: "item", itemCategory: "weapon" }), gear)).toBe(42);
    expect(findPrice(drop({ dropType: "item", itemCategory: "armor" }), gear)).toBe(42);
    const potion = Object.keys(POTIONS)[0] as keyof typeof POTIONS;
    expect(findPrice(drop({ dropType: "item", potion }), gear)).toBe(Math.floor(POTIONS[potion].price / 2));
    expect(findPrice(drop({ dropType: "item", scroll: "xp" }), gear)).toBe(SCROLL_PRICE / 2);
    expect(findPrice(drop({ dropType: "item", tool: "flare" }), gear)).toBe(Math.floor(TOOLS.flare.price / 2));
    const move = "x";
    expect(findPrice(drop({ dropType: "item", codexMove: move }), gear)).toBe(Math.floor(codexPrice(move) / 2));
    // Materials go to your tally, and gold, creatures and cards aren't sold.
    expect(findPrice(drop({ dropType: "item", material: "planks", qty: 3 }), gear)).toBe(0);
    expect(findPrice(drop({ dropType: "reward", amount: 5 }), gear)).toBe(0);
    expect(findPrice(drop({ dropType: "card" }), gear)).toBe(0);
  });

  it("rarer finds shake longer and open bigger", () => {
    const order = ["common", "uncommon", "rare", "epic", "legendary"] as const;
    for (let i = 1; i < order.length; i++) expect(SHAKE_MS[order[i]]).toBeGreaterThan(SHAKE_MS[order[i - 1]]);
    expect(revealTier("common")).toBe("puff");
    expect(revealTier("rare")).toBe("rays");
    expect(revealTier("legendary")).toBe("shower");
    expect(shakeMs(drop({ dropType: "reward", amount: 5 }))).toBe(GOLD_SHAKE_MS);
    expect(shakeMs(drop({ dropType: "item", rarity: "epic" }))).toBe(SHAKE_MS.epic);
  });

  it("the whole show stays short", () => {
    expect(Math.max(...Object.values(SHAKE_MS))).toBeLessThanOrEqual(2000);
  });

  it("says whether you were first to find it, or how many found it before you", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
    expect(findLine("first")).toContain("First to find");
    expect(findLine("first", 1)).toContain("First to find");
    expect(findLine(undefined, 3)).toBe("You're the 3rd to find this Code Cache");
    expect(findLine("looted")).toContain("already looted");
    expect(findLine(undefined)).toBeNull(); // a copy without online: nobody to count
  });
});
