// tests/rollSystem.test.ts
// LOCKED V1 item roll system. If one of these fails, either a bug crept in
// or a balance number changed — change the test only if the change was deliberate.

import { describe, it, expect } from "vitest";
import { RARITY_BUDGETS, RARITY_WEIGHTS, type Rarity } from "../lib/items/budgets";
import { CHUNK_MIN_PCT, CHUNK_MAX_PCT, CHAOS_PCT, WEIGHT_EXPONENT } from "../lib/items/rollConfig";
import { ITEM_CEILINGS, ITEM_KEYS, STAT_KEYS } from "../lib/items/ceilings";
import { ARMOR_CEILINGS, ARMOR_KEYS, ARMOR_PRIMARY_STATS, ARMOR_STAT_KEYS } from "../lib/items/armor";
import { PRIMARY_STATS_BY_ITEMKEY } from "../lib/items/itemPrimaries";
import { rollItemStats } from "../lib/items/rollItemStats";
import { rollArmorStats } from "../lib/items/rollArmorStats";

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const ROLLS_PER_COMBO = 1000;

describe("locked numbers", () => {
  it("rarity budgets are 60/80/100/120/150", () => {
    expect(RARITY_BUDGETS).toEqual({ common: 60, uncommon: 80, rare: 100, epic: 120, legendary: 150 });
  });

  it("rarity odds are 40/30/20/9/1", () => {
    expect(RARITY_WEIGHTS).toEqual({ common: 40, uncommon: 30, rare: 20, epic: 9, legendary: 1 });
  });

  it("roll tuning is 5–20% chunks, 20% chaos, room^0.6", () => {
    expect([CHUNK_MIN_PCT, CHUNK_MAX_PCT, CHAOS_PCT, WEIGHT_EXPONENT]).toEqual([0.05, 0.2, 0.2, 0.6]);
  });

  it("Legendary Void Scythe ceilings match the design", () => {
    expect(ITEM_CEILINGS.void_scythe.legendary).toEqual({ melee: 110, ranged: 35, agility: 45, hp: 130 });
    expect(PRIMARY_STATS_BY_ITEMKEY.void_scythe).toEqual(["melee", "hp"]);
  });
});

describe("item definitions are valid", () => {
  it("every weapon has 2 primaries and ceilings that can hold each budget", () => {
    for (const k of ITEM_KEYS) {
      expect(PRIMARY_STATS_BY_ITEMKEY[k]).toHaveLength(2);
      for (const r of RARITIES) {
        const cap = STAT_KEYS.reduce((s, st) => s + ITEM_CEILINGS[k][r][st], 0);
        expect(cap, `${k} ${r}`).toBeGreaterThanOrEqual(RARITY_BUDGETS[r]);
      }
    }
  });

  it("every armour piece has 2 primaries and ceilings that can hold each budget", () => {
    for (const k of ARMOR_KEYS) {
      expect(ARMOR_PRIMARY_STATS[k]).toHaveLength(2);
      for (const r of RARITIES) {
        const cap = ARMOR_STAT_KEYS.reduce((s, st) => s + ARMOR_CEILINGS[k][r][st], 0);
        expect(cap, `${k} ${r}`).toBeGreaterThanOrEqual(RARITY_BUDGETS[r]);
      }
    }
  });
});

describe("weapon roll invariants", () => {
  it(`hold for every weapon × rarity (${ROLLS_PER_COMBO} rolls each)`, () => {
    for (const k of ITEM_KEYS) {
      const primaries = PRIMARY_STATS_BY_ITEMKEY[k];
      for (const r of RARITIES) {
        const ceilings = ITEM_CEILINGS[k][r];
        for (let i = 0; i < ROLLS_PER_COMBO; i++) {
          const { stats } = rollItemStats(k, r);
          const label = `${k} ${r} ${JSON.stringify(stats)}`;
          expect(STAT_KEYS.reduce((s, st) => s + stats[st], 0), label).toBe(RARITY_BUDGETS[r]);
          for (const st of STAT_KEYS) {
            expect(stats[st], label).toBeGreaterThanOrEqual(0);
            expect(stats[st], label).toBeLessThanOrEqual(ceilings[st]);
            expect(Number.isInteger(stats[st]), label).toBe(true);
          }
          for (const p of primaries) expect(stats[p], label).toBeGreaterThanOrEqual(1);
        }
      }
    }
  }, 60_000);

  it("non-primary stats are allowed to roll 0", () => {
    // Void Scythe: Range/Agility can legitimately be 0 — this must stay possible.
    let sawZero = false;
    for (let i = 0; i < 20000 && !sawZero; i++) {
      const { stats } = rollItemStats("void_scythe", "common");
      if (stats.ranged === 0 || stats.agility === 0) sawZero = true;
    }
    expect(sawZero).toBe(true);
  });
});

describe("armour roll invariants", () => {
  it(`hold for every armour × rarity (${ROLLS_PER_COMBO} rolls each)`, () => {
    for (const k of ARMOR_KEYS) {
      const primaries = ARMOR_PRIMARY_STATS[k];
      for (const r of RARITIES) {
        const ceilings = ARMOR_CEILINGS[k][r];
        for (let i = 0; i < ROLLS_PER_COMBO; i++) {
          const { stats } = rollArmorStats(k, r);
          const label = `${k} ${r} ${JSON.stringify(stats)}`;
          expect(ARMOR_STAT_KEYS.reduce((s, st) => s + stats[st], 0), label).toBe(RARITY_BUDGETS[r]);
          for (const st of ARMOR_STAT_KEYS) {
            expect(stats[st], label).toBeGreaterThanOrEqual(0);
            expect(stats[st], label).toBeLessThanOrEqual(ceilings[st]);
          }
          for (const p of primaries) expect(stats[p], label).toBeGreaterThanOrEqual(1);
        }
      }
    }
  }, 60_000);
});

describe("god-roll scarcity (statistical)", () => {
  it("Legendary Void Scythe hits 100+ Attack roughly 1% of the time, never above 110", () => {
    const N = 20000;
    let godRolls = 0;
    let max = 0;
    for (let i = 0; i < N; i++) {
      const atk = rollItemStats("void_scythe", "legendary").stats.melee;
      if (atk >= 100) godRolls++;
      max = Math.max(max, atk);
    }
    const pct = (godRolls / N) * 100;
    // Target ~1.1%. Bounds are wide enough that random chance won't fail
    // the test, but a real change to the algorithm will.
    expect(pct).toBeGreaterThan(0.5);
    expect(pct).toBeLessThan(2);
    expect(max).toBeLessThanOrEqual(110);
  });
});

describe("broken configs fail loudly", () => {
  it("throws if ceilings can't hold the budget", () => {
    const original = ITEM_CEILINGS.void_scythe.legendary;
    ITEM_CEILINGS.void_scythe.legendary = { melee: 10, ranged: 10, agility: 10, hp: 10 };
    try {
      expect(() => rollItemStats("void_scythe", "legendary")).toThrow(/below budget/);
    } finally {
      ITEM_CEILINGS.void_scythe.legendary = original;
    }
  });
});
