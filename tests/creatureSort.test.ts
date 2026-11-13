import { describe, expect, it } from "vitest";
import { NO_CARD_FILTER, NO_INV_FILTER, sortCreatures } from "@/components/CreatureMarks";

describe("creature sort", () => {
  const list = [
    { name: "Bat", rarity: "legendary", level: 3 },
    { name: "Cat", rarity: "common", level: 12 },
    { name: "Ant", rarity: "rare", level: 12 },
    { name: "Dog", rarity: "epic" },
  ];
  it("starts on highest level first, rarest breaking ties; cards start on rarity", () => {
    expect(NO_INV_FILTER.sort).toBe("level");
    expect(NO_CARD_FILTER.sort).toBe("rarity");
    expect(sortCreatures(list, "level", (x) => x).map((x) => x.name)).toEqual(["Ant", "Cat", "Bat", "Dog"]);
  });
});
