// tests/barcodeRegistry.test.ts
// The local barcode registry must behave like the planned global database:
// the barcode number has no influence, the first scan decides the outcome,
// and a global reset lets barcodes roll again.

import { describe, it, expect, beforeEach } from "vitest";
import { resolveBarcode, rollBarcodeOutcome, clearRegistry } from "../lib/barcodeRegistry";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { ITEM_KEYS } from "../lib/items/ceilings";
import { ARMOR_KEYS } from "../lib/items/armor";

// Minimal in-memory stand-in for the browser's localStorage.
const store: Record<string, string> = {};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  },
};

beforeEach(() => clearRegistry());

describe("registry behaviour", () => {
  it("a registered barcode returns the same outcome on every later scan", () => {
    const first = resolveBarcode("5000112637922");
    for (let i = 0; i < 20; i++) expect(resolveBarcode("5000112637922")).toEqual(first);
  });

  it("global reset lets barcodes roll a new outcome", () => {
    let changed = 0;
    for (let i = 0; i < 50; i++) {
      const code = `50001126${String(i).padStart(5, "0")}`;
      const before = JSON.stringify(resolveBarcode(code));
      clearRegistry();
      if (JSON.stringify(resolveBarcode(code)) !== before) changed++;
      clearRegistry();
    }
    expect(changed).toBeGreaterThan(40); // occasional identical re-rolls are fine
  });
});

describe("outcome odds (statistical)", () => {
  const N = 100000;
  const outcomes = { creature: 0, item: 0, gold: 0 };
  const rarity: Record<string, number> = {};
  const consumable: Record<string, number> = {}; // potions (Common) and codexes (Uncommon) only
  let rarityTotal = 0;
  const weapons = new Set<string>();
  const armour = new Set<string>();
  const creatures = new Set<string>();

  for (let i = 0; i < N; i++) {
    const e = rollBarcodeOutcome();
    outcomes[e.outcome]++;
    if (e.outcome === "gold") continue;
    if (e.outcome === "item" && e.itemCategory === "consumable") { consumable[e.rarity] = (consumable[e.rarity] ?? 0) + 1; continue; }
    rarity[e.rarity] = (rarity[e.rarity] ?? 0) + 1;
    rarityTotal++;
    if (e.outcome === "creature") creatures.add(e.creatureId);
    if (e.outcome === "item" && e.itemKey) weapons.add(e.itemKey);
    if (e.outcome === "item" && e.armorKey) armour.add(e.armorKey);
  }
  const pct = (n: number, total: number) => (n / total) * 100;

  it("is 20% creature / 60% item / 20% gold", () => {
    expect(pct(outcomes.creature, N)).toBeCloseTo(20, 0);
    expect(pct(outcomes.item, N)).toBeCloseTo(60, 0);
    expect(pct(outcomes.gold, N)).toBeCloseTo(20, 0);
  });

  it("consumables are only Common (potion) or Uncommon (codex), 40:30", () => {
    expect(Object.keys(consumable).sort()).toEqual(["common", "uncommon"]);
    expect(consumable.common / (consumable.common + consumable.uncommon)).toBeCloseTo(40 / 70, 1);
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
