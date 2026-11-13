import { describe, it, expect } from "vitest";
import {
  CALIBRATION_SCANS, FIRST_SCANS, NEW_FIRST_SCANS, calibrating, calibrationLeft, calibrationRoll, firstScansLeft, readFirstScans, spendFirstScan,
} from "../lib/firstScans";
// (no React in it: called straight, under another name so the hooks lint leaves it be)
import { useDropGeneration as dropGeneration } from "../hooks/useDropGeneration";
import type { Drop } from "../lib/types";

// A seeded roll, so the sweep is the same every time.
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe("a new game's first scans", () => {
  it("50 with no clock, the first 25 calibrating", () => {
    expect(FIRST_SCANS).toBe(50);
    expect(CALIBRATION_SCANS).toBe(25);
    expect(firstScansLeft(NEW_FIRST_SCANS)).toBe(50);
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
