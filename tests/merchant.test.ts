import { describe, it, expect } from "vitest";
import {
  rollWares, waresFor, priceUp, wareDrop, minibossExtras, bagUpgradePrice,
  BACKPACK, BAG_MAX, BAG_UPGRADE_PRICES, STORAGE_PLAN_PRICE, MERCHANT_SLOTS, type Ware,
} from "../lib/dungeon/run";
import { TOOLS } from "../lib/items/materials";
import { BOX_CAP, BIG_BOX_CAP, boxCap, fullBoxes, forFullBox, fitInBoxes } from "../lib/items/storage";
import { weaponDrop, armorDrop } from "../lib/drops";

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
    expect(share(n, has("weapon_storage"))).toBeCloseTo(0.2, 1);
    expect(share(n, has("armor_storage"))).toBeCloseTo(0.2, 1);
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
      expect(w.length).toBeLessThanOrEqual(MERCHANT_SLOTS);
      expect(w.map((x) => x.key)).toEqual(expect.arrayContaining(["potion", "lesser", "flare"]));
    }
  });

  it("prices: elixir 500, schematics 2,000", () => {
    const all = Array.from({ length: 400 }, () => rollWares()).flat();
    expect(all.find((x) => x.key === "revival")?.price).toBe(TOOLS.revival.price);
    expect(TOOLS.revival.price).toBe(500);
    expect(all.find((x) => x.key === "weapon_storage")?.price).toBe(STORAGE_PLAN_PRICE);
  });
});

describe("what the cart shows you", () => {
  const up: Ware = { key: "bag_up", bagUp: true, price: 0 };
  const plan: Ware = { key: "weapon_storage", schematic: "weapon_storage", price: STORAGE_PLAN_PRICE };

  it("an upgrade is priced for your backpack: 1,000 â†’ 1,500 â†’ 2,000, none past 8 or on the bindle", () => {
    expect(waresFor([up], { bagSize: BACKPACK })[0].price).toBe(1000);
    expect(waresFor([up], { bagSize: 6 })[0].price).toBe(1500);
    expect(waresFor([up], { bagSize: 7 })[0].price).toBe(2000);
    expect(waresFor([up], { bagSize: BAG_MAX })).toEqual([]);
    expect(waresFor([up], {})).toEqual([]); // the bindle
    expect(BAG_UPGRADE_PRICES.map((_, i) => bagUpgradePrice(BACKPACK + i))).toEqual([1000, 1500, 2000]);
  });

  it("a storage schematic you have (or built) isn't offered", () => {
    expect(waresFor([plan], { bagSize: 5 })).toHaveLength(1);
    expect(waresFor([plan], { bagSize: 5 }, ["weapon_storage"])).toEqual([]);
    expect(waresFor([plan], { bagSize: 5 }, ["armor_storage"])).toHaveLength(1);
  });

  it("an upgrade needs no bag slot; a schematic or elixir does", () => {
    const elixir: Ware = { key: "revival", tool: "revival", price: 500 };
    expect(priceUp([up], ["bag_up"], 5000, 0, []).short).toBeNull();
    expect(priceUp([plan, elixir], ["weapon_storage", "revival"], 5000, 1, []).short).toBe("room");
  });

  it("each ware becomes the right thing", () => {
    expect(wareDrop(plan)).toMatchObject({ schematic: "weapon_storage" });
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
  it("a built box holds 75, the others still 50", () => {
    expect(boxCap("weapon")).toBe(BOX_CAP);
    expect(boxCap("weapon", ["weapon"])).toBe(BIG_BOX_CAP);
    expect(boxCap("armor", ["weapon"])).toBe(BOX_CAP);
    expect(fullBoxes(swords(BOX_CAP))).toEqual(["weapon"]);
    expect(fullBoxes(swords(BOX_CAP), ["weapon"])).toEqual([]);
    expect(fullBoxes(swords(BIG_BOX_CAP), ["weapon"])).toEqual(["weapon"]);
    expect(forFullBox(swords(60), weaponDrop("void_scythe", "common"), ["weapon"])).toBe(false);
    expect(forFullBox(swords(60), weaponDrop("void_scythe", "common"))).toBe(true);
    const armour = Array.from({ length: 3 }, () => armorDrop("frontiers_mail", "common"));
    expect(fitInBoxes(swords(70), [...swords(10), ...armour], ["weapon"]).fit).toHaveLength(5 + 3);
  });
});
