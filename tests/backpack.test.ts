import { describe, it, expect } from "vitest";
import { rollWares, waresFor, priceUp, makeRoom, startRun, onBindle, BACKPACK, BINDLE, BACKPACK_PRICE, STOREHOUSE_BACKPACK, MERCHANT_SLOTS, type SackItem } from "../lib/dungeon/run";
import { guestOf, summonVisitor } from "../lib/tavern";

// A seeded rng, so a whole room's roll repeats.
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hasBackpack = (sack: SackItem[] = []) => sack.some((x) => "backpack" in x);

describe("the rugged backpack, until you've got one", () => {
  it("is on every merchant's cart while you're on the bindle, and only then", () => {
    for (let i = 1; i < 50; i++) {
      const w = rollWares(seeded(i), true);
      expect(w[0]).toMatchObject({ key: "backpack", price: BACKPACK_PRICE });
      expect(waresFor(w, {}).length).toBeLessThanOrEqual(MERCHANT_SLOTS);
      expect(rollWares(seeded(i)).some((x) => "backpack" in x)).toBe(false);
    }
    expect(makeRoom("merchant", seeded(3), Infinity, 1, true).wares?.[0].key).toBe("backpack");
  });

  it("drops off a cart rolled before you found it elsewhere", () => {
    const w = rollWares(seeded(7), true);
    expect(waresFor(w, {}).length).toBe(w.filter((x) => !("schematic" in x)).length); // (no plan wanted here)
    expect(waresFor(w, { bagSize: BACKPACK }).some((x) => "backpack" in x)).toBe(false);
  });

  it("takes no bag slot when you buy it", () => {
    const w = rollWares(seeded(7), true);
    expect(priceUp(w, ["backpack"], 5000, 0, []).short).toBeNull();
    expect(priceUp(w, ["backpack"], BACKPACK_PRICE - 1, 3, []).short).toBe("gold");
  });

  it(`is in about ${STOREHOUSE_BACKPACK * 100}% of storehouses while you're on the bindle, never after`, () => {
    let found = 0;
    const N = 2000;
    for (let i = 1; i <= N; i++) {
      if (hasBackpack(makeRoom("storehouse", seeded(i), Infinity, 1, true).sack)) found++;
      expect(hasBackpack(makeRoom("storehouse", seeded(i)).sack)).toBe(false);
    }
    expect(found / N).toBeGreaterThan(STOREHOUSE_BACKPACK - 0.05);
    expect(found / N).toBeLessThan(STOREHOUSE_BACKPACK + 0.05);
  });

  it("a run remembers you set out on the bindle", () => {
    expect(onBindle({})).toBe(true);
    expect(onBindle({ bagSize: BINDLE })).toBe(true);
    expect(onBindle({ bagSize: BACKPACK })).toBe(false);
    expect(startRun(["a"], ["a"], {}, 2, Math.random, 1, false, true).bindle).toBe(true);
    expect(startRun(["a"], ["a"], {}, 2).bindle).toBeUndefined();
  });

  it("a tavern merchant brings it too, while you're on the bindle", () => {
    const at = 1e12;
    expect(guestOf(summonVisitor({ repaired: true }, "merchant", seeded(5), true, at), "merchant", at)!.wares?.[0].key).toBe("backpack");
    expect(guestOf(summonVisitor({ repaired: true }, "merchant", seeded(5), false, at), "merchant", at)!.wares?.some((x) => "backpack" in x)).toBe(false);
  });
});
