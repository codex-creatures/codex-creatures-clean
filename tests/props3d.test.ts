import { describe, it, expect } from "vitest";
import { bookcaseArt, BOOKCASE_FACES, sackOutline, SACK_TALL, SACK_NECK } from "../lib/render3d/props3d";
import { ART_PER_U } from "../lib/render3d/chest3d";

describe("the 3D bookcase and sack drafts", () => {
  it("the bookcase's box comes from its pictures, near the object's height (1.4)", () => {
    const b = bookcaseArt();
    expect(b.width * ART_PER_U).toBeCloseTo(BOOKCASE_FACES.front.w, 6);
    expect(Math.abs(b.depth * ART_PER_U - BOOKCASE_FACES.side.w)).toBeLessThan(0.5); // (its sides as deep as its top)
    expect(BOOKCASE_FACES.side.h).toBe(BOOKCASE_FACES.front.h);
    expect(Math.abs(b.height - 1.4)).toBeLessThan(0.15);
    expect(b.width * ART_PER_U).toBeCloseTo(BOOKCASE_FACES.top.w, 6);
  });
  it("the sack is closed top and bottom, as tall as the object, narrowest at the tie", () => {
    const o = sackOutline();
    expect(o[0][0]).toBe(0);
    expect(o[o.length - 1][0]).toBe(0);
    expect(Math.max(...o.map(([, y]) => y))).toBeCloseTo(SACK_TALL, 6);
    expect(o.every(([, y]) => y >= 0)).toBe(true);
    const tie = o.find(([, y]) => y === SACK_NECK.y)!;
    expect(tie[0]).toBeLessThan(Math.max(...o.map(([r]) => r)) / 3);
  });
});
