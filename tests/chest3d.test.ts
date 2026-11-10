import { describe, it, expect } from "vitest";
import { chestParts, CHEST_W, BAND } from "../lib/render3d/chest3d";

describe("the 3D chest draft", () => {
  it("stands on the floor, inside its size, with the lid on top of the body", () => {
    for (const w of [1, CHEST_W, 1.75]) {
      const c = chestParts(w), bad: string[] = [];
      const lidBoxes = c.lid.map((b) => ({ ...b, y: b.y + c.hinge.y, z: b.z + c.hinge.z }));
      for (const b of [...c.body, ...lidBoxes]) {
        if (b.y - b.h / 2 < -1e-9) bad.push(`below the floor: ${JSON.stringify(b)}`);
        if (Math.abs(b.x) + b.w / 2 > w / 2 + BAND + 1e-9) bad.push(`too wide: ${JSON.stringify(b)}`);
        if (Math.abs(b.z) + b.d / 2 > c.depth / 2 + 2 * BAND + 1e-9) bad.push(`too deep: ${JSON.stringify(b)}`);
      }
      expect(bad).toEqual([]);
      const top = Math.max(...lidBoxes.map((b) => b.y + b.h / 2));
      expect(top).toBeCloseTo(c.height + BAND, 6); // (the lid's iron bands stand proud of the wood)
    }
  });
  it("is 0.8 units tall at its usual width, as the chest's object is", () => {
    expect(chestParts().height).toBeCloseTo(0.8, 6);
  });
});
