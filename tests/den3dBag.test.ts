// The battle bag going home (lib/den3d/bag.ts): found things into storage always; with the new Den,
// the whole bag empties (potions back to storage, packed gear just unpacked).
import { describe, expect, it } from "vitest";
import { bagHome } from "@/lib/den3d/bag";
import { gearEntry, lootEntry, type BagEntry } from "@/lib/dungeon/run";
import type { Drop } from "@/lib/types";

const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, dropType: "item", itemCategory: "weapon", name: id, rarity: "common", roll: 0, ...extra }) as unknown as Drop;
const codex = item("cx", { itemCategory: "consumable", codexMove: "Slash" });
const sword = item("sword");
const bag: BagEntry[] = ["potion", gearEntry("mine"), lootEntry("sword"), lootEntry("cx"), "lesser"];
const loot = { sword, cx: codex };

describe("the bag going home", () => {
  it("as before: found things go to storage, potions and packed gear stay", () => {
    const r = bagHome(bag, loot, 5, false);
    expect(r.home.map((d) => d.id)).toEqual(["sword", "cx"]);
    expect(r.bag).toEqual(["potion", gearEntry("mine"), "lesser"]);
    expect(r.potions).toEqual([]);
    expect(r.loot).toEqual({});
  });

  it("with the new Den: everything leaves the bag, potions back to storage", () => {
    const r = bagHome(bag, loot, 5, true);
    expect(r.bag).toEqual([]);
    expect(r.potions).toEqual(["potion", "lesser"]);
    expect(r.home.map((d) => d.id)).toEqual(["sword", "cx"]);
  });

  it("keeps a codex in the bag while the bookcase is full, either way", () => {
    for (const all of [false, true]) {
      const r = bagHome(bag, loot, 0, all);
      expect(r.bag).toContain(lootEntry("cx"));
      expect(r.loot.cx).toBe(codex);
      expect(r.home.map((d) => d.id)).toEqual(["sword"]);
    }
  });
});
