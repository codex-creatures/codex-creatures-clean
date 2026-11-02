import { describe, it, expect } from "vitest";
import { GOLD_SHAKE_MS, LEGENDARY_PAUSE_MS, RARITY_ORDER, findLine, findPrice, ordinal, revealChoice, revealTier, shakeMs, shakeStages, newFinds, summonStages, summonMs, SUMMON_PLACE_MS, SUMMON_GATHER_MS } from "../lib/scanReveal";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
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

  it("the cache rattles up through every rarity to its find's, so rarer finds rattle longer and open bigger", () => {
    const item = (rarity: string) => drop({ dropType: "item", rarity });
    RARITY_ORDER.forEach((r, i) => {
      const stages = shakeStages(item(r)).filter(st => !st.pause);
      expect(stages.map(st => st.rarity)).toEqual(RARITY_ORDER.slice(0, i + 1));
      if (i > 0) expect(shakeMs(item(r))).toBeGreaterThan(shakeMs(item(RARITY_ORDER[i - 1])));
    });
    // Each stage starts as the one before ends.
    const all = shakeStages(item("legendary"));
    for (let i = 1; i < all.length; i++) expect(all[i].at).toBe(all[i - 1].at + all[i - 1].ms);
    // A legendary holds still after the epic stage, then turns gold.
    expect(all.at(-2)).toMatchObject({ pause: true, ms: LEGENDARY_PAUSE_MS });
    expect(all.at(-1)!.rarity).toBe("legendary");
    expect(revealTier("common")).toBe("puff");
    expect(revealTier("rare")).toBe("rays");
    expect(revealTier("epic")).toBe("shower");
    expect(revealTier("legendary")).toBe("explosion");
    expect(shakeMs(drop({ dropType: "reward", amount: 5 }))).toBe(GOLD_SHAKE_MS);
  });

  it("the whole show stays short", () => {
    expect(shakeMs(drop({ dropType: "item", rarity: "common" }))).toBeLessThanOrEqual(1000);
    expect(shakeMs(drop({ dropType: "item", rarity: "legendary" }))).toBeLessThanOrEqual(4000);
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

describe("new finds", () => {
  const [a, b] = CREATURE_TEMPLATES;
  const mon = (id: string, t: { id: string; name: string }, dropType = "creature") => drop({ id, dropType, creatureId: t.id, name: t.name });
  const planks = (id: string) => drop({ id, dropType: "item", material: "planks" });
  const none = new Set<string>();

  it("a species you've never owned, or a kind of item you've never had, is new", () => {
    const got = newFinds([mon("x", a), mon("y", b, "card"), planks("z"), drop({ id: "g", dropType: "reward", amount: 5 })], new Set([b.id]), none);
    expect([...got]).toEqual([["x", "creature"], ["z", "item"]]);
    expect(newFinds([planks("z")], none, new Set(["m:planks"])).size).toBe(0);
  });

  it("of two of the same new kind at once, only the first is new", () => {
    expect([...newFinds([mon("x", a), mon("y", a), planks("p"), planks("q")], none, none).keys()]).toEqual(["x", "p"]);
  });
});

describe("summoning from cards", () => {
  it("sets the cards down, gathers in white, then climbs to the creature's rarity like a cache", () => {
    for (const rarity of RARITY_ORDER) {
      const d = drop({ dropType: "creature", rarity });
      const cache = shakeStages(d), show = summonStages(d);
      expect(show.map((s) => s.rarity)).toEqual(cache.map((s) => s.rarity));
      expect(show[0]).toMatchObject({ rarity: "common", at: SUMMON_PLACE_MS });
      expect(show.at(-1)!.rarity).toBe(rarity);
      expect(summonMs(d)).toBe(SUMMON_PLACE_MS + SUMMON_GATHER_MS + shakeMs(d));
      // Back to back: each stage starts as the last one ends.
      for (let i = 1; i < show.length; i++) expect(show[i].at).toBe(show[i - 1].at + show[i - 1].ms);
    }
  });
});
