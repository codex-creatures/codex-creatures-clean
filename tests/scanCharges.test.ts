import { describe, it, expect } from "vitest";
import { SCAN_MAX, SCAN_REGEN_MS, clockText, nextScanIn, scanCharges, spendScan } from "../lib/scanCharges";

const MIN = 60 * 1000;

describe("scans stored", () => {
  it("9 at most, one more every 20 minutes: 9 every 3 hours", () => {
    expect(SCAN_MAX).toBe(9);
    expect(SCAN_REGEN_MS).toBe(20 * MIN);
    expect(SCAN_MAX * SCAN_REGEN_MS).toBe(3 * 60 * MIN);
  });

  it("an old save or a new game starts full", () => {
    expect(scanCharges(undefined, 1000)).toEqual({ left: 9, at: 1000 });
    expect(nextScanIn(undefined, 1000)).toBeNull();
  });

  it("from full, spending one starts the clock; it comes back 20 minutes later", () => {
    const t0 = 1_000_000;
    const c = spendScan(undefined, t0)!;
    expect(c).toEqual({ left: 8, at: t0 });
    expect(nextScanIn(c, t0 + 5 * MIN)).toBe(15 * MIN);
    expect(scanCharges(c, t0 + 20 * MIN - 1).left).toBe(8);
    expect(scanCharges(c, t0 + 20 * MIN).left).toBe(9);
    expect(nextScanIn(c, t0 + 20 * MIN)).toBeNull();
  });

  it("at 0 you can't scan, and you get one back every 20 minutes until you're at 9 (no more while full)", () => {
    const t0 = 5_000_000;
    let c = undefined as ReturnType<typeof spendScan> | undefined;
    for (let i = 0; i < 9; i++) c = spendScan(c ?? undefined, t0)!;
    expect(c).toEqual({ left: 0, at: t0 });
    expect(spendScan(c!, t0 + 19 * MIN)).toBeNull();
    expect(scanCharges(c!, t0 + 45 * MIN)).toEqual({ left: 2, at: t0 + 40 * MIN }); // the clock keeps its 5 minutes' head start
    expect(nextScanIn(c!, t0 + 45 * MIN)).toBe(15 * MIN);
    expect(scanCharges(c!, t0 + 3 * 60 * MIN).left).toBe(9);
    expect(scanCharges(c!, t0 + 30 * 60 * MIN).left).toBe(9); // a day away: still 9
  });

  it("spending part-way keeps the clock running", () => {
    const t0 = 0;
    const c = spendScan(spendScan(undefined, t0)!, t0 + 10 * MIN)!;
    expect(c).toEqual({ left: 7, at: t0 });
    expect(scanCharges(c, t0 + 20 * MIN).left).toBe(8);
  });

  it("a clock turned back, or junk in the save, can't give scans away", () => {
    expect(scanCharges({ left: 3, at: 10 * MIN }, 0)).toEqual({ left: 3, at: 0 });
    expect(scanCharges({ left: 50, at: 0 }, 0).left).toBe(9);
    expect(scanCharges({ left: -4, at: 0 }, 0).left).toBe(0);
    expect(scanCharges({ left: NaN, at: 0 } as never, 7)).toEqual({ left: 9, at: 7 });
  });

  it("shows the wait as minutes and seconds", () => {
    expect(clockText(15 * MIN)).toBe("15:00");
    expect(clockText(61_500)).toBe("1:02");
    expect(clockText(0)).toBe("0:00");
  });
});
