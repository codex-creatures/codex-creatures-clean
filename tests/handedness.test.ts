import { describe, it, expect } from "vitest";
import { readLeftHanded, writeLeftHanded, HAND_KEY } from "../lib/handedness";

// Left-handed mode (the user, 2026-11-20): per device, off until turned on.
describe("left-handed mode", () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
  it("is off until turned on, and remembered", () => {
    const s = store();
    expect(readLeftHanded(s)).toBe(false);
    writeLeftHanded(s, true);
    expect(s.m.get(HAND_KEY)).toBe("left");
    expect(readLeftHanded(s)).toBe(true);
    writeLeftHanded(s, false);
    expect(readLeftHanded(s)).toBe(false);
  });
  it("a blocked storage just leaves it off", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readLeftHanded(bad)).toBe(false);
    expect(writeLeftHanded(bad, true)).toBe(true);
  });
});
