import { describe, it, expect } from "vitest";
import {
  CALIBRATION_GIFTS, calibrationDrop, CALIBRATION_SCANS, FIRST_SCANS, NEW_FIRST_SCANS, calibrating, calibrationLeft, calibrationRoll, firstScansLeft, readFirstScans, spendFirstScan,
} from "../lib/firstScans";
// (no React in it: called straight, under another name so the hooks lint leaves it be)
import { useDropGeneration as dropGeneration } from "../hooks/useDropGeneration";
import type { Drop } from "../lib/types";

// A seeded roll, so the sweep is the same every time.
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe("a new game's first scans", () => {
  it("35 with no clock, the first 10 calibrating", () => {
    expect(FIRST_SCANS).toBe(35);
    expect(CALIBRATION_SCANS).toBe(10);
    expect(firstScansLeft(NEW_FIRST_SCANS)).toBe(35);
    expect(calibrating(NEW_FIRST_SCANS)).toBe(true);
  });

  it("an old save (no field) has none, and isn't calibrating", () => {
    expect(readFirstScans(undefined)).toBeUndefined();
    expect(readFirstScans({ codes: [] })).toBeUndefined();
    expect(firstScansLeft(undefined)).toBe(0);
    expect(calibrating(undefined)).toBe(false);
    expect(readFirstScans({ used: 3, codes: ["123456", 7] })).toEqual({ used: 3, codes: ["123456"] });
  });

  it("calibrating remembers barcodes, then forgets them once calibrated", () => {
    let f = NEW_FIRST_SCANS;
    for (let i = 0; i < CALIBRATION_SCANS - 1; i++) f = spendFirstScan(f, `10000${i}`);
    expect(f.codes).toHaveLength(CALIBRATION_SCANS - 1);
    expect(calibrationLeft(f)).toBe(1);
    f = spendFirstScan(f, "999999");
    expect(calibrating(f)).toBe(false);
    expect(f.codes).toEqual([]);
    expect(firstScansLeft(f)).toBe(FIRST_SCANS - CALIBRATION_SCANS);
    for (let i = 0; i < FIRST_SCANS - CALIBRATION_SCANS; i++) f = spendFirstScan(f, "555555");
    expect(firstScansLeft(f)).toBe(0);
  });

  it("calibration finds nothing past Rare, and no soul stone", () => {
    const rng = seeded(7);
    const bad: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const o = calibrationRoll(rng);
      if (o.outcome === "soul_stone") bad.push("soul stone");
      if ((o.outcome === "creature" || o.outcome === "item") && !["common", "uncommon", "rare"].includes(o.rarity)) bad.push(o.rarity);
    }
    expect(bad).toEqual([]);
  });
});

describe("scanning while calibrating", () => {
  function scanner(calibrated: string[]) {
    const got = { drops: [] as Drop[], used: [] as string[], counted: [] as string[], again: 0 };
    const { generateDrop } = dropGeneration({
      rollMode: "deterministic",
      scanCounts: {},
      onDrop: (d) => got.drops.push(d),
      onScanCountUpdate: (code) => got.counted.push(code),
      canScanNew: () => true,
      onScanUsed: (code) => got.used.push(code),
      calibrating: true,
      calibrated,
      onCalibratedAgain: () => got.again++,
    });
    return { got, generateDrop };
  }

  it("a new barcode uses a scan, gives one find, and records nothing", async () => {
    const { got, generateDrop } = scanner([]);
    await generateDrop("4006381333931");
    expect(got.used).toEqual(["4006381333931"]);
    expect(got.drops).toHaveLength(1);
    expect(got.counted).toEqual([]); // not a scanned barcode: new again once calibrated
  });

  it("a barcode already read while calibrating is free and gives nothing", async () => {
    const { got, generateDrop } = scanner(["4006381333931"]);
    await generateDrop("4006381333931");
    expect(got).toEqual({ drops: [], used: [], counted: [], again: 1 });
  });
});

// The user, 2026-11-20: the 3rd calibration scan's a Rare creature you've never had (a real one), and the 6th a Rare enchanted weapon.
describe("calibration's two gifts", () => {
  it("a new Rare creature, then a Rare enchanted weapon, on their scans", () => {
    expect(CALIBRATION_GIFTS.creature).toBeLessThan(CALIBRATION_SCANS);
    expect(CALIBRATION_GIFTS.weapon).toBeLessThan(CALIBRATION_SCANS);
    for (let seed = 1; seed <= 30; seed++) {
      const owned = new Set(["moss_wolf"]);
      const c = calibrationDrop(CALIBRATION_GIFTS.creature, owned, "123456", seeded(seed)) as Drop & { creatureId: string };
      expect(c).toMatchObject({ dropType: "creature", rarity: "rare" });
      expect(owned.has(c.creatureId)).toBe(false);
      const w = calibrationDrop(CALIBRATION_GIFTS.weapon, owned, "123456", seeded(seed)) as Drop & { enchant?: unknown };
      expect(w).toMatchObject({ dropType: "item", itemCategory: "weapon", rarity: "rare" });
      expect(w.enchant).toBeTruthy();
    }
  });

  it("goes through the scanner on the right scan", async () => {
    const drops: Drop[] = [];
    const { generateDrop } = dropGeneration({ rollMode: "deterministic", scanCounts: {}, onDrop: (d) => drops.push(d), onScanCountUpdate: () => {},
      canScanNew: () => true, calibrating: true, calibrated: [], firstUsed: CALIBRATION_GIFTS.creature, owned: new Set() });
    await generateDrop("4006381333931");
    expect(drops[0]).toMatchObject({ dropType: "creature", rarity: "rare" });
  });
});

describe("a new game's first scans, as a save loads", () => {
  it("no game in the save (a new player, or Settings → Start new game): the first scans; a save from before them: none", async () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } },
    };
    const { loadSave } = await import("../hooks/useGameState");
    const { SAVE_KEY } = await import("../lib/save");
    expect(loadSave()!.firstScans).toEqual(NEW_FIRST_SCANS);
    store[SAVE_KEY] = JSON.stringify({ campaign: { v: 2 } }); // (only a side field written so far)
    expect(loadSave()!.firstScans).toEqual(NEW_FIRST_SCANS);
    store[SAVE_KEY] = JSON.stringify({ inventory: [], scanCounts: { "123": 1 }, gold: 10 });
    expect(loadSave()!.firstScans).toBeUndefined();
    store[SAVE_KEY] = JSON.stringify({ inventory: [], scanCounts: {}, gold: 0, firstScans: { used: 4, codes: [] } });
    expect(loadSave()!.firstScans).toEqual({ used: 4, codes: [] });
  });
});
