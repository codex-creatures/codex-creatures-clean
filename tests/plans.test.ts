import { describe, expect, it } from "vitest";
import { LADDERS, PLAN_FINDS, PLAN_PRICES, builtFrom, ladderOf, planFinds, wantedPlans, type Ladder } from "../lib/items/plans";
import { SCHEMATICS } from "../lib/items/materials";

// The Den's upgrades as ladders of schematics (the user, 2026-11-20).
const fresh = builtFrom({ boxes: { weapon: 0, armor: 0 }, cage: 1, shelf: 1, pit: false, pitSlots: 1 });
const rng = (v: number) => () => v;

describe("the Den's ladders of schematics", () => {
  it("every schematic is on exactly one ladder", () => {
    const all = Object.values(LADDERS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all.sort()).toEqual(Object.keys(SCHEMATICS).sort());
    for (const l of Object.keys(LADDERS) as Ladder[]) for (const k of LADDERS[l]) expect(ladderOf(k)).toBe(l);
  });

  it("you want the next plan on each open ladder: not the bookcase's before the crooked one, nor the pit's before the Training Pit", () => {
    expect(wantedPlans(fresh, [])).toEqual(["weapon_storage_1", "armor_storage_1", "iron_cage"]);
    const later = builtFrom({ boxes: { weapon: 2, armor: 4 }, cage: 2, shelf: 2, pit: true, pitSlots: 1 });
    expect(wantedPlans(later, [])).toEqual(["weapon_storage_3", "reinforced_cage", "crooked_bookcase", "pit_slot_2"]);
    const top = builtFrom({ boxes: { weapon: 4, armor: 4 }, cage: 3, shelf: 4, pit: true, pitSlots: 3 });
    expect(wantedPlans(top, [])).toEqual([]);
  });

  it("a plan you're holding (any on its ladder) stops that ladder's turning up", () => {
    expect(wantedPlans(fresh, ["iron_cage"])).toEqual(["weapon_storage_1", "armor_storage_1"]);
    expect(wantedPlans(fresh, ["weapon_storage_2"])).toEqual(["armor_storage_1", "iron_cage"]); // (an old one held)
  });

  it("chests: each wanted plan rolls on its own, only from its dungeon on; nothing wanted, no roll at all", () => {
    let rolls = 0;
    const counting = () => { rolls++; return 0; };
    expect(planFinds("miniboss", 1, [], counting)).toEqual([]);
    expect(planFinds("chest", 0, ["weapon_storage_1", "iron_cage"], counting)).toEqual([]); // (none in the Encampment)
    expect(rolls).toBe(0);
    const got = planFinds("miniboss", 1, ["iron_cage", "reinforced_cage", "weapon_storage_1"], rng(0)).map((x) => "gear" in x && x.gear.dropType === "item" && x.gear.schematic);
    expect(got).toEqual(["iron_cage", "weapon_storage_1"]); // (the reinforced cage only from the Hydra)
    expect(planFinds("boss", 2, ["reinforced_cage"], rng(0))).toHaveLength(1);
    expect(planFinds("boss", 2, ["reinforced_cage"], rng(0.5))).toEqual([]);
  });

  it("the reinforced cage: Hydra and deeper, or 3,000 gold (the user's); the iron cage isn't sold", () => {
    expect(PLAN_FINDS.reinforced_cage.from).toBe(2);
    expect(PLAN_PRICES.reinforced_cage).toBe(3000);
    expect(PLAN_PRICES.iron_cage).toBeUndefined();
  });

  it("the boxes' stages cost more each time, the last with essence crystals", () => {
    const value = (k: keyof typeof SCHEMATICS) => Object.entries(SCHEMATICS[k].cost).reduce((n, [m, q]) => n + (q ?? 0) * ({ planks: 8, nails: 6, metal_bars: 45, essence_stones: 150, essence: 500 } as Record<string, number>)[m], 0);
    for (const l of [LADDERS.weapon, LADDERS.armor]) {
      l.slice(1).forEach((k, i) => expect(value(k)).toBeGreaterThan(value(l[i])));
      expect(SCHEMATICS[l[l.length - 1]].cost.essence).toBeGreaterThan(0);
    }
  });
});

describe("old saves on the new stages", () => {
  it("the bookcase and the boxes land at or above what they held; a new game starts at the bottom", async () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } },
    };
    const { loadSave } = await import("../hooks/useGameState");
    const { SAVE_KEY } = await import("../lib/save");
    const { STORAGE_V } = await import("../lib/items/storage");
    expect(loadSave()).toMatchObject({ shelf: 1, storage: [] }); // (a new game)
    store[SAVE_KEY] = JSON.stringify({ inventory: [], scanCounts: {}, gold: 0 });
    expect(loadSave()!.shelf).toBe(2); // (the broken shelf of 10: the crooked bookcase, 15)
    store[SAVE_KEY] = JSON.stringify({ inventory: [], scanCounts: {}, gold: 0, bookcase: 4, storage: ["weapon", "armor", "armor"] });
    expect(loadSave()).toMatchObject({ shelf: 3, storage: ["weapon", "weapon", "armor", "armor", "armor", "armor"] });
    store[SAVE_KEY] = JSON.stringify({ inventory: [], scanCounts: {}, gold: 0, bookcase: 4, shelf: 4, storage: ["weapon"], storageV: STORAGE_V });
    expect(loadSave()).toMatchObject({ shelf: 4, storage: ["weapon"] });
  });
});
