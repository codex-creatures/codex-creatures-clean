// tests/barcodeRegistry.test.ts
// The barcode registry's rules (lib/barcodeRegistry.ts): the barcode number has no influence, the
// first scan decides the outcome (the global registry rolls it on the server from REGISTRY_RULES),
// a soul stone is only the first finder's, and someone else's find too rare for you waits sealed.

import { describe, it, expect } from "vitest";
import { tooRare, rollBarcodeOutcome, claimedOutcome, CHEST_ODDS, type BarcodeEntry } from "../lib/barcodeRegistry";
import { SCAN_UNLOCK } from "../lib/creatures/levels";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { ITEM_KEYS } from "../lib/items/ceilings";
import { ARMOR_KEYS } from "../lib/items/armor";

describe("your explorer level and barcodes", () => {
  const legendary: BarcodeEntry = { outcome: "creature", rarity: "legendary", creatureId: "storm_phoenix", registeredAt: "" };

  it("the first ever to scan a barcode gets whatever it rolls, at any level", () => {
    let found = 0;
    for (let i = 0; i < 3000; i++) {
      const entry = { ...rollBarcodeOutcome(), registeredAt: "" };
      expect(tooRare({ entry, first: true }, 1)).toBe(false);
      if (entry.outcome === "creature" && entry.rarity === "legendary") found++;
    }
    expect(found).toBeGreaterThan(0); // ~12 expected (40% × 1%)
  });

  it("a soul stone is only for the first to scan it: anyone after gets gold", () => {
    const stone = { outcome: "soul_stone", stone: "toxic_skin" } as const;
    expect(claimedOutcome(stone).outcome).toBe("gold");
    // Anything else is the same for everyone.
    const other = { outcome: "creature", rarity: "common", creatureId: "bellow_toad" } as const;
    expect(claimedOutcome(other)).toBe(other);
  });

  it("someone else's find too rare for you is sealed until your level can find it", () => {
    expect(tooRare({ entry: legendary, first: false }, 1)).toBe(true);
    expect(tooRare({ entry: legendary, first: false }, SCAN_UNLOCK.legendary)).toBe(false);
  });
});

describe("outcome odds (statistical)", () => {
  const N = 100000;
  const outcomes = { creature: 0, item: 0, gold: 0, soul_stone: 0 };
  const categories: Record<string, number> = {};
  const rarity: Record<string, number> = {};
  const consumable: Record<string, number> = {}; // potions and codexes
  let rarityTotal = 0;
  const weapons = new Set<string>();
  const armour = new Set<string>();
  const creatures = new Set<string>();

  for (let i = 0; i < N; i++) {
    const e = rollBarcodeOutcome();
    outcomes[e.outcome]++;
    if (e.outcome === "item") categories[e.itemCategory] = (categories[e.itemCategory] ?? 0) + 1;
    if (e.outcome === "gold" || e.outcome === "soul_stone") continue;
    if (e.outcome === "item" && e.itemCategory === "consumable") { consumable[e.rarity] = (consumable[e.rarity] ?? 0) + 1; continue; }
    rarity[e.rarity] = (rarity[e.rarity] ?? 0) + 1;
    rarityTotal++;
    if (e.outcome === "creature") creatures.add(e.creatureId);
    if (e.outcome === "item" && e.itemKey) weapons.add(e.itemKey);
    if (e.outcome === "item" && e.armorKey) armour.add(e.armorKey);
  }
  const pct = (n: number, total: number) => (n / total) * 100;

  it("is 40% creature, 13% weapon, 26% armour, 7% consumable, 6% material, 7% gold, 1% soul stone", () => {
    expect(pct(outcomes.creature, N)).toBeCloseTo(40, 0);
    expect(pct(outcomes.gold, N)).toBeCloseTo(7, 0);
    expect(pct(categories.weapon, N)).toBeCloseTo(13, 0);
    expect(pct(categories.armor, N)).toBeCloseTo(26, 0);
    expect(pct(outcomes.soul_stone, N)).toBeCloseTo(1, 0);
    expect(pct(categories.consumable, N)).toBeCloseTo(7, 0);
    expect(pct(categories.material, N)).toBeCloseTo(6, 0);
  });

  it("a Labyrinth chest keeps the original table: 20% creature, 12/24/12/12 items, 20% gold", () => {
    const got: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const e = rollBarcodeOutcome(CHEST_ODDS);
      const k = e.outcome === "item" ? e.itemCategory : e.outcome;
      got[k] = (got[k] ?? 0) + 1;
    }
    const expected = { creature: 20, weapon: 12, armor: 24, consumable: 12, material: 12, gold: 20, soul_stone: 0 };
    for (const [k, target] of Object.entries(expected)) expect(pct(got[k] ?? 0, N), k).toBeCloseTo(target, 0);
  });

  it("consumables are only Common, Uncommon or Rare, 40:30:20", () => {
    expect(Object.keys(consumable).sort()).toEqual(["common", "rare", "uncommon"]);
    const total = consumable.common + consumable.uncommon + consumable.rare;
    expect(consumable.common / total).toBeCloseTo(40 / 90, 1);
    expect(consumable.rare / total).toBeCloseTo(20 / 90, 1);
  });

  it("rarity follows 40/30/20/9/1 (everything but consumables)", () => {
    const expected = { common: 40, uncommon: 30, rare: 20, epic: 9, legendary: 1 };
    for (const [r, target] of Object.entries(expected)) {
      expect(Math.abs(pct(rarity[r] ?? 0, rarityTotal) - target), r).toBeLessThan(0.6);
    }
  });

  it("every weapon, armour piece and creature can drop", () => {
    expect(weapons.size).toBe(ITEM_KEYS.length);
    expect(armour.size).toBe(ARMOR_KEYS.length);
    expect(creatures.size).toBe(CREATURE_TEMPLATES.length);
  });
});
