import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, MOVE_BY_NAME } from "../lib/creatures/creatureData";
import { CARD_NAME_LINE, DESC_LINE, DESC_LINES, EXTRA_LINES, MOVE_DETAILS, MOVE_NAME_LINE, NAME_MIN_PX, TABLET_PLACES, fitsLines, tabletName, wrapLines } from "../lib/uiText";

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

// Move tablets wherever they're shown, and the details window behind their i (the user,
// 2026-11-14). The sums are lib/uiText.ts's; /lab/movetext checks them in a real browser.
describe("move text fits wherever it's shown", () => {
  const names = [...new Set(Object.values(MOVE_BY_NAME).map((m) => m.name))];
  it("every name fits every tablet: no word split, two lines, never smaller than NAME_MIN_PX", () => {
    const bad: string[] = [];
    for (const p of TABLET_PLACES) for (const n of names) {
      const { font, line } = tabletName(n, p);
      if (font < NAME_MIN_PX) bad.push(`${p.id}: ${n} would be ${font.toFixed(1)}px`);
      else if (!fitsLines(n, line)) bad.push(`${p.id}: ${n} needs more than two lines of ${line}`);
    }
    expect(bad).toEqual([]);
  });
  it("every description fits the details window, with room for a fight's effect lines", () => {
    const bad = Object.values(MOVE_BY_NAME).filter((m) => m.desc && !fitsLines(m.desc, DESC_LINE, DESC_LINES))
      .map((m) => `${m.name}: ${wrapLines(m.desc!, DESC_LINE).length} lines`);
    expect([...new Set(bad)]).toEqual([]);
    // The window holds its header, DESC_LINES and EXTRA_LINES.
    const { h, pad, font, lineHeight } = MOVE_DETAILS;
    expect(18 * lineHeight + 2 * font * lineHeight + 6 + (DESC_LINES + EXTRA_LINES) * font * lineHeight + 3 * 2 + 2 * pad + 8).toBeLessThanOrEqual(h);
  });
});
