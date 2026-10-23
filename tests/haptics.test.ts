import { describe, expect, it } from "vitest";
import { attackHaptic, readHaptics, writeHaptics, HAPTICS_KEY } from "../lib/haptics";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("vibration", () => {
  it("is off until you turn it on, and remembers", () => {
    const s = memory();
    expect(readHaptics(s)).toBe(false);
    writeHaptics(s, true);
    expect(s.m.get(HAPTICS_KEY)).toBe("1");
    expect(readHaptics(s)).toBe(true);
    writeHaptics(s, false);
    expect(readHaptics(s)).toBe(false);
  });
  it("stays off if storage is blocked", () => {
    expect(readHaptics({ getItem: () => { throw new Error("blocked"); }, setItem: () => {} })).toBe(false);
  });
  it("buzzes for hits that land, harder for precise ones", () => {
    expect(attackHaptic({ missed: false, damage: 12, precise: false })).toBe("hit");
    expect(attackHaptic({ missed: false, damage: 30, precise: true })).toBe("precise");
    expect(attackHaptic({ missed: true, damage: 0, precise: false })).toBeNull();
    expect(attackHaptic({ missed: false, evaded: true, damage: 0, precise: false })).toBeNull();
  });
});
