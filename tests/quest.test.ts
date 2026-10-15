import { describe, it, expect } from "vitest";
import { rollBox, rattlebonesRoom, klutzClub, wantsClub, wantsThief, klutzHasNews, BOX_ROLLS, BOX_UNCOMMON } from "../lib/quest";
import { ITEM_KEYS, KLUTZ_CLUB_STATS } from "../lib/items/ceilings";

describe("the first quest: Klutz's box", () => {
  it("Klutz's Club doesn't roll: an even split of the Common budget, and it never turns up from scans", () => {
    const club = klutzClub() as { itemKey: string; rarity: string; stats: Record<string, number> };
    expect(club).toMatchObject({ itemKey: "klutz_club", rarity: "common" });
    expect(club.stats).toEqual(KLUTZ_CLUB_STATS);
    expect(Object.values(club.stats).reduce((a, b) => a + b, 0)).toBe(60);
    expect(ITEM_KEYS).not.toContain("klutz_club");
  });

  it("the thief is a lone Rattlebones with no gear", () => {
    const room = rattlebonesRoom();
    expect(room.quest).toBe("rattlebones");
    expect(room.enemies).toHaveLength(1);
    expect(room.enemies![0]).toMatchObject({ creatureId: "rattlebones", gear: [] });
  });

  it("the box holds 10 pieces of Common or Uncommon gear, about 20% Uncommon", () => {
    let uncommon = 0, total = 0;
    for (let i = 0; i < 400; i++) {
      const box = rollBox();
      expect(box).toHaveLength(BOX_ROLLS);
      for (const d of box) {
        expect(d.dropType).toBe("item");
        const it = d as { rarity: string; itemCategory: string };
        expect(["common", "uncommon"]).toContain(it.rarity);
        expect(["weapon", "armor"]).toContain(it.itemCategory);
        total++; if (it.rarity === "uncommon") uncommon++;
      }
    }
    expect(Math.abs(uncommon / total - BOX_UNCOMMON)).toBeLessThan(0.03);
  });

  it("goes club → thief → back to Klutz", () => {
    expect(wantsClub({ stage: "start" })).toBe(true);
    expect(klutzHasNews({ stage: "start" })).toBe(true);
    expect(wantsThief({ stage: "hunt", clubFound: true })).toBe(true);
    expect(wantsClub({ stage: "hunt", clubFound: true })).toBe(false);
    expect(klutzHasNews({ stage: "boxFound" })).toBe(true);
    expect(wantsThief({ stage: "done", clubFound: true })).toBe(false);
  });
});
