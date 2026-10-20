import { describe, it, expect } from "vitest";
import { BOX_CAP, boxCounts, fullBoxes, forFullBox, fitInBoxes } from "../lib/items/storage";
import { weaponDrop, armorDrop, potionDrop, codexDrop } from "../lib/drops";
import { materialDrop } from "../lib/items/materials";
import type { Drop } from "../lib/types";

const many = (n: number, make: () => Drop) => Array.from({ length: n }, make);
const sword = () => weaponDrop("void_scythe", "common");

describe("chest boxes", () => {
  it("counts weapons, armour and consumables separately; materials and codexes don't count", () => {
    const inv = [...many(3, sword), ...many(2, () => armorDrop("frontiers_mail", "common")),
      potionDrop(), codexDrop("Bolt"), materialDrop("planks", 40)];
    expect(boxCounts(inv)).toEqual({ weapon: 3, armor: 2, consumable: 1 });
  });

  it("a box with space lets you in; a full one (or one gone over) keeps you out", () => {
    expect(fullBoxes(many(BOX_CAP - 1, sword))).toEqual([]);
    expect(fullBoxes(many(BOX_CAP, () => potionDrop()))).toEqual(["consumable"]);
    const over = [...many(BOX_CAP + 7, () => armorDrop("frontiers_mail", "common")), ...many(BOX_CAP, sword)];
    expect(fullBoxes(over)).toEqual(["weapon", "armor"]);
  });

  it("a scan for a full box is spotted; one for a box with room isn't", () => {
    const inv = many(BOX_CAP, sword);
    expect(forFullBox(inv, sword())).toBe(true);
    expect(forFullBox(inv, potionDrop())).toBe(false);
    expect(forFullBox(inv, codexDrop("Bolt"))).toBe(false);
  });

  it("opening caches: only as many as there's room for; the rest stay shut", () => {
    const inv = many(BOX_CAP - 1, sword);
    const caches = [sword(), sword(), potionDrop(), materialDrop("nails", 5)];
    const { fit, full } = fitInBoxes(inv, caches);
    expect(fit).toEqual([caches[0], caches[2], caches[3]]);
    expect(full).toEqual(["weapon"]);
  });
});
