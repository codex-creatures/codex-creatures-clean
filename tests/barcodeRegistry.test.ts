// tests/barcodeRegistry.test.ts
// The local barcode registry must behave like the planned global database:
// the barcode number has no influence, the first scan decides the outcome,
// and a global reset lets barcodes roll again.

import { describe, it, expect, beforeEach } from "vitest";
import { resolveBarcode, rollBarcodeOutcome, clearRegistry, scanBarcode, CHEST_ODDS, REGISTRY_KEY } from "../lib/barcodeRegistry";
import { SCAN_UNLOCK } from "../lib/creatures/levels";
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

describe("your explorer level and barcodes", () => {
  // A barcode registered as a legendary creature (as if someone else found it).
  const registerLegendary = (code: string) =>
    store[REGISTRY_KEY] = JSON.stringify({ [code]: { outcome: "creature", rarity: "legendary", creatureId: "storm_phoenix", registeredAt: "" } });

  it("the first ever to scan a barcode gets whatever it rolls, at any level", () => {
    let legendary = 0;
    for (let i = 0; i < 3000; i++) {
      clearRegistry(); // (keeps the registry small, so this stays quick)
      const { entry, sealed } = scanBarcode(`9${String(i).padStart(12, "0")}`, 1);
      expect(sealed).toBe(false);
      if (entry.outcome === "creature" && entry.rarity === "legendary") legendary++;
    }
    expect(legendary).toBeGreaterThan(0); // ~12 expected (40% × 1%)
  });

  it("someone else's find too rare for you is sealed until your level can find it", () => {
    registerLegendary("5000112637922");
    expect(scanBarcode("5000112637922", 1).sealed).toBe(true);
    expect(scanBarcode("5000112637922", SCAN_UNLOCK.legendary).sealed).toBe(false);
  });
});

describe("outcome odds (statistical)", () => {
  const N = 100000;
  const outcomes = { creature: 0, item: 0, gold: 0 };
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
    if (e.outcome === "gold") continue;
    if (e.outcome === "item" && e.itemCategory === "consumable") { consumable[e.rarity] = (consumable[e.rarity] ?? 0) + 1; continue; }
    rarity[e.rarity] = (rarity[e.rarity] ?? 0) + 1;
    rarityTotal++;
    if (e.outcome === "creature") creatures.add(e.creatureId);
    if (e.outcome === "item" && e.itemKey) weapons.add(e.itemKey);
    if (e.outcome === "item" && e.armorKey) armour.add(e.armorKey);
  }
  const pct = (n: number, total: number) => (n / total) * 100;

  it("is 40% creature, 13% weapon, 27% armour, 7% consumable, 6% material, 7% gold", () => {
    expect(pct(outcomes.creature, N)).toBeCloseTo(40, 0);
    expect(pct(outcomes.gold, N)).toBeCloseTo(7, 0);
    expect(pct(categories.weapon, N)).toBeCloseTo(13, 0);
    expect(pct(categories.armor, N)).toBeCloseTo(27, 0);
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
    const expected = { creature: 20, weapon: 12, armor: 24, consumable: 12, material: 12, gold: 20 };
    for (const [k, target] of Object.entries(expected)) expect(pct(got[k], N), k).toBeCloseTo(target, 0);
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
