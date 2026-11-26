import { describe, expect, it } from "vitest";
import { SIDE_ARROW_AT, SIDE_ARROW_KEY, SIDE_ARROW_MAX, SIDE_ARROW_MIN, readSideArrow, writeSideArrow } from "../lib/sideArrow";

const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("where the side arrows sit (lib/sideArrow.ts)", () => {
  it("starts where the middle third meets the bottom third, and keeps a dragged spot", () => {
    const s = store();
    expect(readSideArrow(s)).toBe(SIDE_ARROW_AT);
    writeSideArrow(s, 0.4);
    expect(readSideArrow(s)).toBe(0.4);
  });
  it("is never dragged off the screen, and shrugs off junk or blocked storage", () => {
    const s = store();
    expect([writeSideArrow(s, -1), writeSideArrow(s, 5)]).toEqual([SIDE_ARROW_MIN, SIDE_ARROW_MAX]);
    s.setItem(SIDE_ARROW_KEY, "nope");
    expect(readSideArrow(s)).toBe(SIDE_ARROW_AT);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect([readSideArrow(blocked), writeSideArrow(blocked, 0.5)]).toEqual([SIDE_ARROW_AT, 0.5]);
  });
});
