// lib/scanning.ts
// Opening a barcode you've never scanned, once its registry has answered
// (lib/barcodeRegistry.ts locally, lib/online/registry.ts online).

import type { Drop, Rarity } from "./types";
import { claimedOutcome, tooRare, type Lookup } from "./barcodeRegistry";
import { SCAN_UNLOCK } from "./creatures/levels";
import { dropFromOutcome } from "./drops";

// A barcode you've never scanned gives this many drops (1: items stay
// scarce — scanning a few things is rewarding enough). Each is its own
// registry entry (scanKeys: "code", "code:2", "code:3"), so everyone who
// scans the barcode finds the same things.
export const SCAN_DROPS = 1;
export const scanKeys = (code: string) => Array.from({ length: SCAN_DROPS }, (_, i) => (i === 0 ? code : `${code}:${i + 1}`));

export type Opened =
  // Someone else's find, too rare for your explorer level: it stays sealed
  // (the scan doesn't count), so you can come back for it at level `need`.
  | { kind: "too_rare"; rarity: Rarity; need: number }
  // What's inside. first: nobody had scanned the barcode before you.
  | { kind: "found"; drops: Drop[]; first: boolean };

// found: the registry's answer for each of scanKeys(code). Creature: the
// barcode fixes WHICH creature, you usually get a card of it. Items: identity
// + rarity from the barcode, stats roll fresh per player. A soul stone is
// only for the first ever to scan the barcode: anyone after gets gold.
export function openBarcode(code: string, found: Lookup[], playerLevel: number): Opened {
  const [main] = found;
  if (tooRare(main, playerLevel) && main.entry.outcome === "creature") {
    return { kind: "too_rare", rarity: main.entry.rarity, need: SCAN_UNLOCK[main.entry.rarity] };
  }
  const drops = found
    .map(({ entry, first }) => dropFromOutcome(first ? entry : claimedOutcome(entry), code))
    .filter((d): d is Drop => d !== null);
  return { kind: "found", drops, first: main.first };
}
