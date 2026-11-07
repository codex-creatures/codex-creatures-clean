import { describe, expect, it } from "vitest";
import { SUBCELLS, subcellOfPanel, panelOfSubcell, placeInPanel, subcellCentre, subcellAt, panelAt, panelAnchor, anchorPoint } from "../lib/world/grid";

// Panels, subcells and u (docs/world-spec.md §2, "Coordinates").
describe("panels and subcells", () => {
  it("a panel is exactly 3 × 3 subcells, its middle one at its centre", () => {
    expect(SUBCELLS).toBe(3);
    for (const p of [-4, -1, 0, 1, 7]) {
      const s = subcellOfPanel(p);
      expect([s - 1, s, s + 1].map(panelOfSubcell)).toEqual([p, p, p]);
      expect([s - 1, s, s + 1].map(placeInPanel)).toEqual([-1, 0, 1]);
      expect(subcellCentre(s)).toBe(p);
      expect(panelOfSubcell(s - 2)).toBe(p - 1);
      expect(panelOfSubcell(s + 2)).toBe(p + 1);
    }
  });

  it("negative coordinates work like positive ones", () => {
    expect(panelOfSubcell(-1)).toBe(0);
    expect(panelOfSubcell(-2)).toBe(-1);
    expect(placeInPanel(-2)).toBe(1);
    expect(panelOfSubcell(-4)).toBe(-1);
    expect(placeInPanel(-4)).toBe(-1);
    expect(panelOfSubcell(-5)).toBe(-2);
  });

  it("every point is in exactly one subcell and one panel, an edge going east (south)", () => {
    // Panel 3 covers 2.5 ≤ x < 3.5; subcell 9 covers 2⅚ ≤ x < 3⅙.
    expect(panelAt(2.5)).toBe(3);
    expect(panelAt(3.4999)).toBe(3);
    expect(panelAt(3.5)).toBe(4);
    expect(panelAt(-0.5)).toBe(0);
    expect(panelAt(-0.5001)).toBe(-1);
    expect(subcellAt(3)).toBe(9);
    expect(subcellAt(3 + 1 / 6)).toBe(10);
    expect(subcellAt(3 + 1 / 6 - 1e-9)).toBe(9);
    expect(subcellAt(-1 / 6)).toBe(0);
    expect(subcellAt(-1 / 6 - 1e-9)).toBe(-1);
    // A subcell's centre is in it, and in its panel.
    for (let s = -12; s <= 12; s++) {
      expect(subcellAt(subcellCentre(s))).toBe(s);
      expect(panelAt(subcellCentre(s))).toBe(panelOfSubcell(s));
    }
  });

  it("an anchor at a panel's centre is a whole subcell, and back", () => {
    expect(panelAnchor({ x: 3, y: 4 })).toEqual({ sx: 9, sy: 12 });
    expect(panelAnchor({ x: -2, y: 0 })).toEqual({ sx: -6, sy: 0 });
    expect(anchorPoint({ sx: 9, sy: 12 })).toEqual({ x: 3, y: 4 });
    // Never rounded: a point off a panel's centre has no panel anchor.
    expect(panelAnchor({ x: 3.5, y: 4 })).toBeNull();
    expect(panelAnchor({ x: 3, y: 4.2 })).toBeNull();
  });
});
