import { describe, it, expect } from "vitest";
import {
  stowDrop, needsSlot, rareLeftBehind, wipedOut, lootIdOf, BINDLE, startRun,
  type DungeonMeta, type DungeonRun,
} from "../lib/dungeon/run";
import { materialDrop, addMaterials, canAfford, countMaterial, SCHEMATICS } from "../lib/items/materials";
import { weaponDrop, potionDrop } from "../lib/drops";
import type { Drop } from "../lib/types";

const meta = (over: Partial<DungeonMeta> = {}): DungeonMeta => ({ runs: 0, clears: 0, injuries: {}, bag: [], ...over });
const qtyOf = (m: DungeonMeta, d: Drop) => { const x = m.loot?.[d.id]; return x?.dropType === "item" ? x.qty : undefined; };

describe("materials", () => {
  it("at home: a tally, like gold — building takes exactly the cost", () => {
    let m = addMaterials({}, { planks: 15 });
    m = addMaterials(m, { planks: 12, nails: 10 });
    expect(countMaterial(m, "planks")).toBe(27);
    const cost = SCHEMATICS.crooked_bookcase.cost;
    expect(canAfford(m, cost)).toBe(true);
    m = addMaterials(m, Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, -n!])));
    expect(m).toEqual({ planks: 7, nails: 0 });
    expect(canAfford(m, cost)).toBe(false);
  });

  it("down there: a stack takes a bag slot, and more of the same joins it", () => {
    const planks = materialDrop("planks", 4);
    let m = stowDrop(meta(), planks)!;
    expect(m.bag).toHaveLength(1);
    expect(needsSlot(m, materialDrop("planks", 1))).toBe(false);
    expect(needsSlot(m, materialDrop("nails", 1))).toBe(true);
    m = stowDrop(m, materialDrop("planks", 3))!;
    expect(m.bag).toHaveLength(1);
    expect(qtyOf(m, planks)).toBe(7);
    m = stowDrop(m, materialDrop("nails", 2))!;
    expect(m.bag).toHaveLength(2);
  });

  it("a full bag: a new stack has no room, but a stack you carry still grows", () => {
    const planks = materialDrop("planks", 2);
    let m = stowDrop(meta(), planks)!;
    m = stowDrop(m, weaponDrop("void_scythe", "common"))!;
    m = stowDrop(m, potionDrop("", "lesser"))!;
    expect(m.bag).toHaveLength(BINDLE);
    expect(stowDrop(m, materialDrop("nails", 1))).toBeNull();
    const grown = stowDrop(m, materialDrop("planks", 5))!;
    expect(qtyOf(grown, planks)).toBe(7);
    expect(grown.bag.map(lootIdOf).filter(Boolean)).toHaveLength(2); // (the potion is a potion entry)
  });
});

describe("the run", () => {
  const run = (): DungeonRun => ({ ...startRun(["a", "b"], ["a", "b"], {}, 2), inside: true });

  it("is over when nobody is left standing (outside a fight)", () => {
    expect(wipedOut(run())).toBe(false);
    expect(wipedOut({ ...run(), hp: { a: 0, b: 0.5 } })).toBe(false);
    expect(wipedOut({ ...run(), hp: { a: 0, b: 0 } })).toBe(true);
    expect(wipedOut({ ...run(), hp: { a: 0, b: 0 }, battle: {} })).toBe(false); // (a fight decides its own end)
  });

  it("warns before you walk off from rare things in an opened chest, or waiting for room", () => {
    const rare = weaponDrop("void_scythe", "rare"), common = weaponDrop("void_scythe", "common");
    const r = { ...run(), current: { kind: "stash" as const, done: true, opened: true, sack: [{ gear: rare }, { gear: common }, { gold: 100 }] } };
    expect(rareLeftBehind(r).map((d) => d.id)).toEqual([rare.id]);
    expect(rareLeftBehind({ ...r, current: { ...r.current, opened: false } })).toEqual([]); // (never opened: nothing comes out)
    expect(rareLeftBehind({ ...run(), current: null, pending: [rare] })).toHaveLength(1);
  });
});
