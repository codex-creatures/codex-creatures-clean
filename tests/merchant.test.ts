import { describe, it, expect } from "vitest";
import {
  rollWares, waresFor, priceUp, wareDrop, minibossExtras, bagUpgradePrice,
  BACKPACK, BAG_MAX, BAG_UPGRADE_PRICES, MERCHANT_SLOTS, type Ware,
} from "../lib/dungeon/run";
import { TOOLS, toolDrop } from "../lib/items/materials";
import { dropTakenBack } from "../lib/save";
import { BOX_CAP, BOX_CAPS, boxCap, buildBox, fullBoxes, forFullBox, fitInBoxes, storageFromOld } from "../lib/items/storage";
import { LADDERS, PLAN_PRICES } from "../lib/items/plans";
import { weaponDrop, armorDrop, codexDrop } from "../lib/drops";
import type { CreatureOrItemDrop } from "../lib/types";

// The bigger merchant (the user, 2026-10-23): steps 1 and 2 of the cart plan.
const share = (n: number, test: (w: Ware[]) => boolean, backpack = false) => {
  let hits = 0;
  for (let i = 0; i < n; i++) if (test(rollWares(Math.random, backpack))) hits++;
  return hits / n;
};
const has = (key: string) => (w: Ware[]) => w.some((x) => x.key === key);

describe("the merchant's rare wares", () => {
  it("each turns up about as often as planned", () => {
    const n = 4000;
    expect(share(n, has("bag_up"))).toBeCloseTo(0.2, 1);
    for (const l of Object.values(LADDERS)) expect(share(n, has(l[0]))).toBeCloseTo(0.2, 1); // (a schematic a ladder, as its first plan)
    expect(share(n, has("revival"))).toBeCloseTo(0.25, 1);
    expect(share(n, has("scroll"))).toBeCloseTo(0.2, 1);
  });

  it("the backpack while you're on the bindle, never an upgrade then", () => {
    for (let i = 0; i < 300; i++) {
      const w = rollWares(Math.random, true);
      expect(w[0].key).toBe("backpack");
      expect(has("bag_up")(w)).toBe(false);
    }
  });

  it("never more than 10 things, always the potions and a flare", () => {
    for (let i = 0; i < 1000; i++) {
      const w = rollWares(Math.random, i % 2 === 0);
      expect(w.filter((x) => !("schematic" in x)).length).toBeLessThanOrEqual(MERCHANT_SLOTS); // (plans you don't want take no space)
      expect(waresFor(w, { bagSize: i % 2 === 0 ? 3 : 5 }, ["weapon_storage_1", "armor_storage_1", "reinforced_cage", "crooked_bookcase", "pit_slot_2"]).length).toBeLessThanOrEqual(MERCHANT_SLOTS);
      expect(w.map((x) => x.key)).toEqual(expect.arrayContaining(["potion", "lesser", "flare"]));
    }
  });

  it("prices: elixir 500, schematics 2,000", () => {
    const all = Array.from({ length: 400 }, () => rollWares()).flat();
    expect(all.find((x) => x.key === "revival")?.price).toBe(TOOLS.revival.price);
    expect(TOOLS.revival.price).toBe(500);
    expect(PLAN_PRICES.weapon_storage).toBe(2000);
    expect(PLAN_PRICES.reinforced_cage).toBe(3000); // (the user's)
  });
});

describe("what the cart shows you", () => {
  const up: Ware = { key: "bag_up", bagUp: true, price: 0 };
  const plan: Ware = { key: "weapon_storage_1", schematic: "weapon_storage_1", price: 1000 };

  it("an upgrade is priced for your backpack: 1,000 â†’ 1,500 â†’ 2,000, none past 8 or on the bindle", () => {
    expect(waresFor([up], { bagSize: BACKPACK })[0].price).toBe(1000);
    expect(waresFor([up], { bagSize: 6 })[0].price).toBe(1500);
    expect(waresFor([up], { bagSize: 7 })[0].price).toBe(2000);
    expect(waresFor([up], { bagSize: BAG_MAX })).toEqual([]);
    expect(waresFor([up], {})).toEqual([]); // the bindle
    expect(BAG_UPGRADE_PRICES.map((_, i) => bagUpgradePrice(BACKPACK + i))).toEqual([1000, 1500, 2000, 2500, 3000]);
  });

  it("a ladder's schematic is offered only as the next one you want, at its price", () => {
    expect(waresFor([plan], { bagSize: 5 })).toEqual([]); // (nothing wanted on that ladder: held, or built to the top)
    expect(waresFor([plan], { bagSize: 5 }, ["armor_storage"])).toEqual([]);
    expect(waresFor([plan], { bagSize: 5 }, ["weapon_storage_3"])).toEqual([{ key: "weapon_storage_3", schematic: "weapon_storage_3", price: 3000 }]);
    // An old cart's second plan stands for its ladder too.
    expect(waresFor([{ key: "weapon_storage_2", schematic: "weapon_storage_2", price: 4000 }], {}, ["weapon_storage_1"])[0].price).toBe(1000);
    // The cage: the reinforced one for 3,000; the iron one isn't sold.
    const cage: Ware = { key: "iron_cage", schematic: "iron_cage", price: 0 };
    expect(waresFor([cage], {}, ["reinforced_cage"])).toEqual([{ key: "reinforced_cage", schematic: "reinforced_cage", price: 3000 }]);
    expect(waresFor([cage], {}, ["iron_cage"])).toEqual([]);
    // Each stage dearer than the last.
    for (const l of [LADDERS.weapon, LADDERS.armor, LADDERS.bookcase, LADDERS.pit]) l.slice(1).forEach((k, i) => expect(PLAN_PRICES[k]!).toBeGreaterThan(PLAN_PRICES[l[i]]!));
  });

  it("the cart stays as rolled: what you bought stays on it as sold, and nothing new is stocked", () => {
    // Bought the plan the cart showed: its ladder's next one doesn't take its place.
    expect(waresFor([plan], { bagSize: 5 }, ["weapon_storage_3"], undefined, ["weapon_storage_2"])).toEqual([{ key: "weapon_storage_2", schematic: "weapon_storage_2", price: PLAN_PRICES.weapon_storage_2 }]);
    // Bought the backpack: it stays (sold), so a cut material doesn't slip back on.
    const w = rollWares(() => 0.01, true);
    const before = waresFor(w, {});
    expect(waresFor(w, { bagSize: BACKPACK }, [], undefined, ["backpack"]).map((x) => x.key)).toEqual(before.map((x) => x.key));
  });

  it("an upgrade needs no bag slot; a schematic or elixir does", () => {
    const elixir: Ware = { key: "revival", tool: "revival", price: 500 };
    expect(priceUp([up], ["bag_up"], 5000, 0, []).short).toBeNull();
    expect(priceUp([plan, elixir], ["weapon_storage_1", "revival"], 5000, 1, []).short).toBe("room");
  });

  it("each ware becomes the right thing", () => {
    expect(wareDrop(plan)).toMatchObject({ schematic: "weapon_storage_1" });
    expect(wareDrop({ key: "revival", tool: "revival", price: 500 })).toMatchObject({ tool: "revival", itemCategory: "consumable" });
    expect(wareDrop(up)).toBeUndefined();
  });
});

describe("the Revival Elixir in chests", () => {
  it("a mini boss's chest holds one about 20% of the time", () => {
    let n = 0;
    for (let i = 0; i < 4000; i++) if (minibossExtras().some((x) => "gear" in x && x.gear.dropType === "item" && x.gear.tool === "revival")) n++;
    expect(n / 4000).toBeCloseTo(0.2, 1);
  });
});

describe("bigger storage boxes", () => {
  const swords = (n: number) => Array.from({ length: n }, () => weaponDrop("void_scythe", "common"));
  it("a box grows in stages: 50, 60, 75, 85, 100; the others stay as they were", () => {
    expect(BOX_CAPS).toEqual([50, 60, 75, 85, 100]);
    expect(boxCap("weapon")).toBe(BOX_CAP);
    expect(boxCap("weapon", ["weapon"])).toBe(60);
    expect(boxCap("weapon", ["weapon", "weapon"])).toBe(75);
    expect(boxCap("armor", ["weapon"])).toBe(BOX_CAP);
    expect(fullBoxes(swords(BOX_CAP))).toEqual(["weapon"]);
    expect(fullBoxes(swords(BOX_CAP), ["weapon"])).toEqual([]);
    expect(fullBoxes(swords(60), ["weapon"])).toEqual(["weapon"]);
    expect(forFullBox(swords(55), weaponDrop("void_scythe", "common"), ["weapon"])).toBe(false);
    expect(forFullBox(swords(55), weaponDrop("void_scythe", "common"))).toBe(true);
    const armour = Array.from({ length: 3 }, () => armorDrop("frontiers_mail", "common"));
    expect(fitInBoxes(swords(55), [...swords(10), ...armour], ["weapon"]).fit).toHaveLength(5 + 3);
  });
  it("a plan builds its own stage (skipping any between); one built again, or below, changes nothing", () => {
    const top = buildBox([], "weapon", 4);
    expect(boxCap("weapon", top)).toBe(100);
    expect(boxCap("weapon", [...top, "weapon"])).toBe(100); // (none past 100: that's to be bought)
    expect(buildBox(top, "weapon", 2)).toEqual(top);
    expect(boxCap("armor", buildBox(top, "armor", 1))).toBe(60);
  });
  it("an older save's boxes land on the new stages: built once (75) is stage 2, twice (100) stage 4", () => {
    const moved = storageFromOld(["weapon", "armor", "armor"]);
    expect(boxCap("weapon", moved)).toBe(75);
    expect(boxCap("armor", moved)).toBe(100);
    expect(boxCap("consumable", moved)).toBe(50);
    expect(storageFromOld([])).toEqual([]);
  });
});
