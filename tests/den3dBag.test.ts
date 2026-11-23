// The battle bag going home (lib/den3d/bag.ts): found things into storage, and the whole bag empties
// (potions back to storage, packed gear just unpacked).
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
  it("everything leaves the bag: found things and potions to storage", () => {
    const r = bagHome(bag, loot, 5);
    expect(r.bag).toEqual([]);
    expect(r.potions).toEqual(["potion", "lesser"]);
    expect(r.home.map((d) => d.id)).toEqual(["sword", "cx"]);
    expect(r.loot).toEqual({});
  });

  it("keeps a codex in the bag while the bookcase is full", () => {
    const r = bagHome(bag, loot, 0);
    expect(r.bag).toEqual([lootEntry("cx")]);
    expect(r.loot.cx).toBe(codex);
    expect(r.home.map((d) => d.id)).toEqual(["sword"]);
  });
});
