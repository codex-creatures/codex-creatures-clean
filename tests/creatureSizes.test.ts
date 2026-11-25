import { describe, expect, it } from "vitest";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { CREATURE_SIZE, SIZE_HEIGHT, sizeOf, DEFAULT_SIZE } from "../lib/creatures/sizes";
import { FOE_SIZE5_U } from "../lib/world/objects";
import { sizeClassOf, LOOK_SIZES_V } from "../lib/world/creatures";

describe("creature sizes (lib/creatures/sizes.ts)", () => {
  it("gives every creature a size, and names only real ones", () => {
    expect(Object.keys(CREATURE_BY_ID).filter((id) => !CREATURE_SIZE[id])).toEqual([]);
    expect(Object.keys(CREATURE_SIZE).filter((id) => !CREATURE_BY_ID[id])).toEqual([]);
  });

  it("keeps the user's sorting", () => {
    expect([sizeOf("flicker_wisp"), sizeOf("moss_wolf"), sizeOf("leafblade_scout"), sizeOf("crystalback"), sizeOf("ironhide")]).toEqual([1, 2, 3, 4, 5]);
    expect(sizeOf("no_such_creature")).toBe(DEFAULT_SIZE);
  });

  it("grows with each size, the biggest at full height", () => {
    const h = [1, 2, 3, 4, 5].map((s) => SIZE_HEIGHT[s as 1]);
    expect(h.every((x, i) => i === 0 || x > h[i - 1])).toBe(true);
    expect(SIZE_HEIGHT[5]).toBe(1);
  });

  it("stands a person-sized creature as tall as the hero in the Labyrinth (1.5u)", () => {
    expect(FOE_SIZE5_U * SIZE_HEIGHT[3]).toBeCloseTo(1.5);
  });
});

describe("the placer's room for a foe (lib/world/creatures.ts)", () => {
  it("follows the look size from world version 19, and the old classes before it", () => {
    expect([sizeClassOf("ironhide", 18), sizeClassOf("ironhide", 19), sizeClassOf("ironhide")]).toEqual(["medium", "large", "large"]);
    expect([sizeClassOf("glob", 18), sizeClassOf("glob", 19)]).toEqual(["tiny", "medium"]);
    // Bosses stay huge, whatever their look size.
    expect([sizeClassOf("hydra_fang", 19), sizeClassOf("minotaur", 19)]).toEqual(["huge", "huge"]);
    expect(LOOK_SIZES_V).toBe(19);
  });
});
