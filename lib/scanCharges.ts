// lib/scanCharges.ts
// How many new barcodes you can scan (the user, 2026-11-02): up to SCAN_MAX
// scans stored, and one more every SCAN_REGEN_MS while you're below that
// (none while full), so 9 every 3 hours. It stops mass scanning, and gives a
// reason to come back and scan while you can.
//
// Only a new Code Cache uses one: a barcode new to you, opened or kept sealed
// (offline). Rescans (a little gold), one too rare for you yet (it doesn't
// count) and the testing "random" mode are free.
//
// Kept in the save as { left, at }: scans stored at the time `at` (ms), the
// moment the clock towards the next one started. Missing (an old save, a new
// game): full.

export const SCAN_MAX = 9;
export const SCAN_REGEN_MS = 20 * 60 * 1000;

export type ScanCharges = { left: number; at: number };

// Where you stand now: the scans regained since `at` added on (up to
// SCAN_MAX), the clock moved on by as many as were regained. A clock that's
// gone backwards (the device's time changed) starts again from now.
export function scanCharges(c: ScanCharges | undefined, now: number): ScanCharges {
  if (!c || !Number.isFinite(c.left) || !Number.isFinite(c.at)) return { left: SCAN_MAX, at: now };
  const left = Math.max(0, Math.min(SCAN_MAX, Math.floor(c.left)));
  if (left >= SCAN_MAX || c.at > now) return { left, at: now };
  const gained = Math.floor((now - c.at) / SCAN_REGEN_MS);
  const after = Math.min(SCAN_MAX, left + gained);
  return { left: after, at: after >= SCAN_MAX ? now : c.at + gained * SCAN_REGEN_MS };
}

// Use one: null if there's none left. From full, the clock starts now.
export function spendScan(c: ScanCharges | undefined, now: number): ScanCharges | null {
  const cur = scanCharges(c, now);
  if (cur.left <= 0) return null;
  return { left: cur.left - 1, at: cur.left >= SCAN_MAX ? now : cur.at };
}

// How long until the next one (ms), or null when full.
export function nextScanIn(c: ScanCharges | undefined, now: number): number | null {
  const cur = scanCharges(c, now);
  return cur.left >= SCAN_MAX ? null : cur.at + SCAN_REGEN_MS - now;
}

// "12:05" (minutes and seconds) for the countdown.
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
