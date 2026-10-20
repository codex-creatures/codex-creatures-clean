import { describe, expect, it } from "vitest";
import { clampUiScale, readUiScale, writeUiScale, UI_SCALE_KEY, LAPTOP_UI_SCALE } from "../lib/uiScale";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe("screen size", () => {
  it("defaults to 100% when nothing is stored or it's broken", () => {
    expect(readUiScale(memory())).toBe(1);
    const s = memory();
    s.setItem(UI_SCALE_KEY, "banana");
    expect(readUiScale(s)).toBe(1);
  });
  it("starts a laptop bigger, until you pick a size", () => {
    const s = memory();
    expect(readUiScale(s, true)).toBe(LAPTOP_UI_SCALE);
    expect(LAPTOP_UI_SCALE).toBe(1.75);
    writeUiScale(s, 1);
    expect(readUiScale(s, true)).toBe(1);
  });
  it("snaps to the nearest allowed size", () => {
    expect(clampUiScale(1.3)).toBe(1.25);
    expect(clampUiScale(9)).toBe(2);
    expect(clampUiScale(0.1)).toBe(0.8);
  });
  it("remembers what you picked", () => {
    const s = memory();
    expect(writeUiScale(s, 1.5)).toBe(1.5);
    expect(readUiScale(s)).toBe(1.5);
  });
});
