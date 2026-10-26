import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, MOVE_BY_NAME } from "../lib/creatures/creatureData";
import { CARD_NAME_LINE, MOVE_NAME_LINE, fitsLines, wrapLines } from "../lib/uiText";

// The fixed boxes' text (lib/uiText.ts): every name we write fits its box.
describe("names fit their fixed boxes", () => {
  it("wraps at spaces", () => {
    expect(wrapLines("Sylvaran, the Last Archer", 14)).toEqual(["Sylvaran, the", "Last Archer"]);
    expect(fitsLines("Sylvaran, the Last Archer", 14)).toBe(true);
    expect(fitsLines("A very long name indeed for a card", 14)).toBe(false);
  });
  it("every creature's name fits a card's two lines", () => {
    for (const c of Object.values(CREATURE_BY_ID)) expect(fitsLines(c.name, CARD_NAME_LINE), c.name).toBe(true);
  });
  it("every move's name fits a tablet's two lines", () => {
    for (const n of Object.keys(MOVE_BY_NAME)) expect(fitsLines(n, MOVE_NAME_LINE), n).toBe(true);
  });
});
