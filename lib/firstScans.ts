// lib/firstScans.ts
// A new game's first scans (the user, 2026-11-13): FIRST_SCANS of them with
// no clock, before the stored scans (lib/scanCharges.ts) take over.
//
// The first CALIBRATION_SCANS calibrate the altar (Klutz's job for you):
// each rolls fresh here, up to Rare at most (CALIBRATION_TOP), and asks no
// registry, global or local, so nothing about the barcode is written down.
// Once calibrated, those same barcodes are new to you again: scan them and
// they open from the registry, with the usual rules (explorer level and all).
//
// Kept in the save as { used, codes }: first scans used, and the barcodes
// read while calibrating (one barcode can't calibrate twice). Missing (a save
// from before this): none, so existing players carry on as they were.

import type { Rarity } from "./types";
import { REGISTRY_RULES, SCAN_ODDS, rollFromRules, type BarcodeOutcome } from "./barcodeRegistry";

export const FIRST_SCANS = 50;
export const CALIBRATION_SCANS = 25;
export const CALIBRATION_TOP: Rarity = "rare";

export type FirstScans = { used: number; codes: string[] };

export const NEW_FIRST_SCANS: FirstScans = { used: 0, codes: [] };

// A save's field, checked: anything odd counts as missing (none).
export function readFirstScans(raw: unknown): FirstScans | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { used, codes } = raw as Partial<FirstScans>;
  if (typeof used !== "number" || !Number.isFinite(used)) return undefined;
  return { used: Math.max(0, Math.floor(used)), codes: Array.isArray(codes) ? codes.filter((c): c is string => typeof c === "string") : [] };
}

export const firstScansLeft = (f: FirstScans | undefined) => (f ? Math.max(0, FIRST_SCANS - f.used) : 0);
export const calibrating = (f: FirstScans | undefined) => !!f && f.used < CALIBRATION_SCANS;
export const calibrationLeft = (f: FirstScans | undefined) => (f ? Math.max(0, CALIBRATION_SCANS - f.used) : 0);

// One used: while calibrating, the barcode is remembered (the list is
// dropped once calibrated: those barcodes are new to you again).
export function spendFirstScan(f: FirstScans, code?: string): FirstScans {
  const used = f.used + 1;
  const codes = used >= CALIBRATION_SCANS ? [] : code && !f.codes.includes(code) ? [...f.codes, code] : f.codes;
  return { used, codes };
}

// A calibration scan's find: the usual odds, but no rarity above Rare and no
// soul stone (that's for whoever registers a barcode first, and calibrating
// registers nothing).
const UP_TO: Rarity[] = ["common", "uncommon", "rare"];
const CALIBRATION_ODDS = { ...SCAN_ODDS, soul_stone: 0 };
export function calibrationRoll(rng: () => number = Math.random): BarcodeOutcome {
  const rarity = Object.fromEntries(Object.entries(REGISTRY_RULES.rarity).filter(([r]) => UP_TO.includes(r as Rarity)));
  return rollFromRules({ ...REGISTRY_RULES, odds: CALIBRATION_ODDS, rarity }, rng);
}
