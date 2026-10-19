import { describe, it, expect } from "vitest";
import { createChamber, CW, CH } from "../lib/dungeon/chamber";

describe("chamber: a taller room for the battle stage", () => {
  it("is CH tall unless it's extended", () => {
    expect(createChamber({ tunnels: ["unknown"], seed: 7 }).height).toBe(CH);
  });

  it("adds the extension above and below, and keeps the usual picture in the middle", () => {
    const plain = createChamber({ tunnels: ["unknown"], seed: 7 });
    const tall = createChamber({ tunnels: ["unknown"], seed: 7, extend: { above: 16, below: 24 } });
    expect(tall.height).toBe(CH + (16 + 24) * 2); // 2 fine pixels per layout unit
    // The tunnel is in the same place on the picture, just lower on the canvas.
    const x = CW / 2;
    const y = Array.from({ length: CH }, (_, i) => i).find((i) => plain.idAt(x, i) === 1)!;
    expect(y).toBeDefined();
    expect(tall.idAt(x, y + 16 * 2)).toBe(1);
    expect(tall.idAt(x, 0)).toBe(0);
  });
});
