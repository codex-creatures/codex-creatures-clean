import { describe, expect, it } from "vitest";
import { doubleTapper, DOUBLE_TAP_MS } from "../lib/doubleTap";

describe("double tap", () => {
  it("counts two quick taps on the same thing", () => {
    const tap = doubleTapper();
    expect(tap("a", 0)).toBe(false);
    expect(tap("a", DOUBLE_TAP_MS)).toBe(true);
  });
  it("not when slow, or on two different things", () => {
    const tap = doubleTapper();
    expect(tap("a", 0)).toBe(false);
    expect(tap("a", DOUBLE_TAP_MS + 1)).toBe(false);
    expect(tap("b", DOUBLE_TAP_MS + 50)).toBe(false);
  });
  it("a third quick tap starts afresh", () => {
    const tap = doubleTapper();
    tap("a", 0);
    expect(tap("a", 100)).toBe(true);
    expect(tap("a", 200)).toBe(false);
  });
});
