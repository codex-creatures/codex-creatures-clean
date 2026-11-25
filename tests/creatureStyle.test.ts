// A creature's preferred attack style(s), shown in its window as "Melee - Magic" (the user, 2026-11-24).
import { describe, it, expect } from "vitest";
import { preferredStyles } from "../lib/creatures/creatureType";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";

describe("preferredStyles (lib/creatures/creatureType.ts)", () => {
  it("is its best attack multiplier's style, and a second one close to it", () => {
    expect(preferredStyles(CREATURE_BY_ID.moss_wolf.proficiency)).toEqual(["melee"]);            // atk 16, rng 2
    expect(preferredStyles(CREATURE_BY_ID.void_serpent.proficiency)).toEqual(["magic", "melee"]); // mag 38, atk 34
    expect(preferredStyles(CREATURE_BY_ID.hollow_matriarch.proficiency)).toEqual(["melee"]); // atk 40, rng 24 (under 65%)
    expect(preferredStyles(CREATURE_BY_ID.veilstalker.proficiency)).toEqual(["melee", "magic"]); // atk 20, mag 16
    expect(preferredStyles({ atk: 0, rng: 0, mag: 0, agil: 5, mdef: 5, rdef: 5, magdef: 5, hp: 0 })).toEqual([]);
  });
});
