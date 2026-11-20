// lib/firstScans.ts
// A new game's first scans (the user, 2026-11-13): Klutz's scanner, FIRST_SCANS free with
// no clock, before the stored scans (lib/scanCharges.ts) take over from 0.
//
// The first CALIBRATION_SCANS calibrate the altar (Klutz's job for you):
// each rolls fresh here, up to Rare at most (CALIBRATION_TOP), and asks no
// registry, global or local, so nothing about the barcode is written down.
// Once calibrated, those same barcodes are new to you again: scan them and
// they open from the registry, with the usual rules (explorer level and all).
//
// Two of them are gifts (the user, 2026-11-20; CALIBRATION_GIFTS): a Rare
// creature you've never had (a real one, not a card), so you've a second for
// the Encampment, and a Rare enchanted weapon, a first taste of enchantments.
// Which scans they land on is luck (giftSlot), and nothing says they're coming:
// it should feel like you got lucky.
//
// Kept in the save as { used, codes }: first scans used, and the barcodes
// read while calibrating (one barcode can't calibrate twice). Missing (a save
// from before this): none, so existing players carry on as they were.

import type { Drop, Rarity } from "./types";
import type { ItemKey } from "./items/ceilings";
import { REGISTRY_RULES, SCAN_ODDS, rollFromRules, type BarcodeOutcome } from "./barcodeRegistry";
import { scanDrop } from "./scanning";
import { weaponDrop } from "./drops";
import { enchanted } from "./items/enchantments";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { makeCreatureDrop } from "./creatures/summon";

export const FIRST_SCANS = 35;     // (the user, 2026-11-20: 10 to calibrate, then 25 free; it was 25 and 25)
export const CALIBRATION_SCANS = 10;
export const CALIBRATION_TOP: Rarity = "rare";
// Where the gifts can land, as how many first scans were used before it: the
// creature on the 2nd–6th scan, the weapon on the 7th–10th.
export const CALIBRATION_GIFTS = { creature: [1, 5], weapon: [6, 9] } as const;
// The scan a gift lands on, read off the first barcode you calibrated with, so
// it's settled from then on (with nothing new in the save) but different for everyone.
export function giftSlot(kind: keyof typeof CALIBRATION_GIFTS, firstCode: string): number {
  const [lo, hi] = CALIBRATION_GIFTS[kind];
  let h = kind === "creature" ? 7 : 13;
  for (const ch of firstCode) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lo + (h % (hi - lo + 1));
}

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

// A calibration scan's find: a gift if it's on its scan (giftSlot), else
// calibrationRoll. used: first scans used before this one; firstCode: the first
// barcode calibrated with (none yet: this is the first scan, never a gift);
// owned: the species you've had as creatures (the gift's one you haven't, if any's left).
export function calibrationDrop(used: number, firstCode: string | undefined, owned: ReadonlySet<string>, code: string, rng: () => number = Math.random): Drop | null {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  if (firstCode && used === giftSlot("creature", firstCode)) {
    const rares = REGISTRY_RULES.creatures.rare;
    const fresh = rares.filter((id) => !owned.has(id));
    return makeCreatureDrop(CREATURE_BY_ID[pick(fresh.length ? fresh : rares)], "creature", code);
  }
  if (firstCode && used === giftSlot("weapon", firstCode)) return enchanted(weaponDrop(pick(REGISTRY_RULES.weapons) as ItemKey, "rare", code), 1, rng);
  return scanDrop(calibrationRoll(rng), code);
}
