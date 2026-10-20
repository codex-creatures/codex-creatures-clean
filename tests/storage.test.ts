import { describe, it, expect } from "vitest";
import { BOX_CAP, boxCounts, fullBoxes } from "../lib/items/storage";
import { weaponDrop, armorDrop, potionDrop } from "../lib/drops";
import { materialDrop } from "../lib/items/materials";
import type { Drop } from "../lib/types";

const many = (n: number, make: () => Drop) => Array.from({ length: n }, make);

describe("chest boxes", () => {
  it("counts weapons, armour and consumables separately; materials don't count", () => {
    const inv = [...many(3, () => weaponDrop("void_scythe", "common")), ...many(2, () => armorDrop("frontiers_mail", "common")),
      potionDrop(), materialDrop("planks", 40)];
    expect(boxCounts(inv)).toEqual({ weapon: 3, armor: 2, consumable: 1 });
  });

  it("a box with space lets you in; a full one (or one gone over) keeps you out", () => {
    expect(fullBoxes(many(BOX_CAP - 1, () => weaponDrop("void_scythe", "common")))).toEqual([]);
    expect(fullBoxes(many(BOX_CAP, () => potionDrop()))).toEqual(["consumable"]);
    const over = [...many(BOX_CAP + 7, () => armorDrop("frontiers_mail", "common")), ...many(BOX_CAP, () => weaponDrop("void_scythe", "common"))];
    expect(fullBoxes(over)).toEqual(["weapon", "armor"]);
  });
});
