import { describe, expect, it } from "vitest";
import { clampUiScale, readUiScale, writeUiScale, drawnScale, UI_SCALE_KEY, LAPTOP_UI_SCALE } from "../lib/uiScale";

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
    expect(LAPTOP_UI_SCALE).toBe(1.5);
    writeUiScale(s, 1);
    expect(readUiScale(s, true)).toBe(1);
  });
  it("starts a short phone screen smaller (not below 80%), until you pick a size", () => {
    const s = memory();
    expect(readUiScale(s, false, 844)).toBe(1);
    expect(readUiScale(s, false, 664)).toBe(1);
    expect(readUiScale(s, false, 600)).toBe(0.9);
    expect(readUiScale(s, false, 548)).toBe(0.9);
    expect(readUiScale(s, false, 480)).toBe(0.8);
    expect(readUiScale(s, true, 480)).toBe(LAPTOP_UI_SCALE); // (a laptop's short window: still the laptop's size)
    writeUiScale(s, 1);
    expect(readUiScale(s, false, 480)).toBe(1);
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

describe("drawn bigger by Screen size (drawnScale)", () => {
  // (The walk screen turns a tap into a spot, and sizes its canvas, by this: the user, 2026-11-08,
  // found taps landing in the wrong place at 150%.)
  const el = (drawn: number, own: number) => ({ offsetWidth: own, getBoundingClientRect: () => ({ width: drawn }) }) as unknown as HTMLElement;
  it("is how much bigger it's drawn than its own size, and 1 for one not laid out", () => {
    expect(drawnScale(el(540, 360))).toBe(1.5);
    expect(drawnScale(el(360, 360))).toBe(1);
    expect(drawnScale(el(0, 0))).toBe(1);
  });
});
