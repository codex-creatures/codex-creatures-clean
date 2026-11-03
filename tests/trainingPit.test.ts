import { describe, it, expect } from "vitest";
import { PIT_COST, TRAINING_XP_PER_HOUR, buildPit, canBuildPit, canTrain, hasPitPlan, hoursToLevel, restartTraining, startTraining, stopTraining, trained, training, trainingId } from "../lib/trainingPit";
import { MAX_LEVEL, xpToNext } from "../lib/creatures/levels";
import { MATERIALS, materialBundle, SCHEMATICS } from "../lib/items/materials";
import { MERCHANT_MATERIALS, merchantOffer, lootEntry, rollWares } from "../lib/dungeon/run";
import { materialOffer, TAVERN_MATERIAL_PRICES, type TavernQuest } from "../lib/tavern";
import type { Drop } from "../lib/types";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-03T00:00:00Z");
const at = (hours: number) => T0 + hours * HOUR;
const since = new Date(T0).toISOString();

describe("stone and essence stones", () => {
  it("the old essence stone is Stone (same key, so saves keep theirs), and essence stones are a new epic material", () => {
    expect(MATERIALS.essence_stones).toMatchObject({ name: "Stone", rarity: "rare" });
    expect(MATERIALS.essence).toMatchObject({ name: "Essence stones", rarity: "epic" });
    // Stone's where the essence stone was: the storage plans and the merchants.
    expect(SCHEMATICS.weapon_storage.cost.essence_stones).toBe(1);
    expect(MERCHANT_MATERIALS.find((m) => m.material === "essence_stones")?.price).toBe(150);
    expect(TAVERN_MATERIAL_PRICES.essence_stones).toBe(300);
  });

  it("essence stones come in Epic (1) and Legendary (1-2) material finds, and on 1 cart in 3 (500; the tavern 1,000; bought back for 250)", () => {
    const seen: Record<string, [number, number]> = {};
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      for (let i = 0; i < 400; i++) {
        const d = materialBundle(rarity) as Drop & { material?: string; qty?: number };
        if (d.material !== "essence") continue;
        const [lo, hi] = seen[rarity] ?? [99, 0];
        seen[rarity] = [Math.min(lo, d.qty!), Math.max(hi, d.qty!)];
      }
    }
    expect(seen).toEqual({ epic: [1, 1], legendary: [1, 2] });
    expect(MERCHANT_MATERIALS.find((m) => m.material === "essence")).toEqual({ material: "essence", qty: 1, price: 500, chance: 1 / 3 });
    expect(TAVERN_MATERIAL_PRICES.essence).toBe(1000);
    expect(materialOffer("essence")).toBe(250);
    const stack = { ...materialBundle("epic"), material: "essence", qty: 2 } as Drop;
    expect(merchantOffer(lootEntry(stack.id), stack, () => 0)).toBe(500);
    let carts = 0;
    for (let i = 0; i < 3000; i++) if (rollWares().some((w) => "material" in w && w.material === "essence")) carts++;
    expect(carts / 3000).toBeGreaterThan(0.28);
    expect(carts / 3000).toBeLessThan(0.38);
  });
});

describe("the Training Pit", () => {
  const open: TavernQuest = { blasted: true };
  const rich = { essence_stones: 12, metal_bars: 10, planks: 5, nails: 9, essence: 3 };

  it("comes from beating the Hydra, and costs 10 stone, 10 metal bars, 5 planks, 5 nails and 3 essence stones, once", () => {
    expect(PIT_COST).toEqual({ essence_stones: 10, metal_bars: 10, planks: 5, nails: 5, essence: 3 });
    expect(hasPitPlan(0)).toBe(false);
    expect(canBuildPit(open, rich, 0)).toBe(false);                 // no plans yet
    expect(canBuildPit({}, rich, 1)).toBe(false);                   // the tavern's room isn't open
    expect(canBuildPit(open, { ...rich, essence: 2 }, 1)).toBe(false);
    const done = buildPit(open, rich, 1)!;
    expect(done.tavern.pit).toBe(true);
    expect(done.materials).toEqual({ essence_stones: 2, metal_bars: 0, planks: 0, nails: 4, essence: 0 });
    expect(buildPit(done.tavern, rich, 1)).toBeNull();              // only once
  });

  it("trains at 100 XP an hour and stops when the bar's full", () => {
    expect(TRAINING_XP_PER_HOUR).toBe(100);
    const p = { level: 10, xp: 38 };                                 // 300 to go at Lv 10
    const room = xpToNext(10) - 38;
    expect(training(p, since, at(1))).toEqual({ earned: 100, room, full: false });
    expect(hoursToLevel(p, since, at(1))).toBeCloseTo((room - 100) / 100);
    expect(training(p, since, at(500))).toEqual({ earned: room, room, full: true }); // never more than one level
    expect(trained(p, since, at(500))).toEqual({ level: 11, xp: 0 });
    expect(trained(p, since, at(1))).toEqual({ level: 10, xp: 138 });
    expect(training(p, since, at(-1)).earned).toBe(0);               // a clock set back gives nothing
    expect(training({ level: MAX_LEVEL, xp: 0 }, since, at(99))).toEqual({ earned: 0, room: 0, full: false });
  });

  it("holds one creature at a time; levelling up starts it over from now", () => {
    const pit: TavernQuest = { ...open, pit: true };
    expect(canTrain(open)).toBe(false);                              // not built
    const t = startTraining(pit, "c1", at(0));
    expect(trainingId(t)).toBe("c1");
    expect(startTraining(t, "c2")).toBe(t);                          // already in use
    expect(restartTraining(t, at(3)).training).toEqual({ id: "c1", since: new Date(at(3)).toISOString() });
    expect(trainingId(stopTraining(t))).toBeUndefined();
    expect(trainingId({ training: { id: "c1", since } })).toBeUndefined(); // (no pit, nobody in it)
  });
});
