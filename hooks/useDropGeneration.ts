// hooks/useDropGeneration.ts
import type { Drop } from "@/lib/types";
import { lookupLocal, rollBarcodeOutcome, type Lookup } from "@/lib/barcodeRegistry";
import { dropFromOutcome, goldDrop } from "@/lib/drops";
import { openBarcode, scanKeys, type Opened } from "@/lib/scanning";
import { onlineClient } from "@/lib/online/client";
import { lookupOnline } from "@/lib/online/registry";
import type { Rarity } from "@/lib/types";

// "deterministic" (Repeatable): outcomes come from the barcode registry,
//   rolled once on first-ever scan; your own rescans give gold.
// "random": dev testing — every scan rolls a fresh outcome, nothing registered.
type RollMode = "random" | "deterministic";

// Ask the registry about a barcode: the global one in an online build, this
// browser's own in a copy without online. null: the global registry can't
// be reached (offline, or not signed in), so the scan waits sealed.
export async function lookUpBarcode(code: string): Promise<Lookup[] | null> {
  const keys = scanKeys(code);
  const client = onlineClient();
  if (!client) return keys.map(lookupLocal);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const found: Lookup[] = [];
  for (const key of keys) {
    const f = await lookupOnline(client, key);
    if (!f) return null;
    found.push(f);
  }
  return found;
}

type UseDropGenerationArgs = {
  rollMode: RollMode;
  scanCounts: Record<string, number>;
  // Reward drops carry their gold amount; the receiver credits it.
  onDrop: (drop: Drop) => void;
  onScanCountUpdate: (code: string, newCount: number) => void;
  // Everything one scan gave. found: "first" (nobody had scanned it before
  // you) or "looted" (you already had: a rescan), so the altar can say so.
  onScan?: (drops: Drop[], found?: "first" | "looted") => void;
  playerLevel?: number;              // your explorer level: how rare a creature you can find
  // A barcode whose creature is too rare for you yet: it stays sealed (the
  // scan doesn't count), so you can come back for it at level `need`.
  onSealed?: (rarity: Rarity, need: number) => void;
  // A new barcode with the global registry out of reach: it waits as a
  // sealed Code Cache (the scan counts once it's opened).
  onOffline?: (code: string) => void;
};

export function useDropGeneration({
  rollMode,
  scanCounts,
  onDrop,
  onScanCountUpdate,
  onScan,
  playerLevel = 1,
  onSealed,
  onOffline,
}: UseDropGenerationArgs) {
  async function generateDrop(code: string) {
    if (!/^[0-9]{6,20}$/.test(code)) return;

    const alreadyScanned = scanCounts[code] ?? 0;

    // ── RANDOM (testing) → A FRESH ROLL EVERY TIME ────────
    if (rollMode === "random") {
      onScanCountUpdate(code, alreadyScanned + 1);
      const drops = scanKeys(code).map(() => dropFromOutcome(rollBarcodeOutcome(), code)).filter((d): d is Drop => d !== null);
      drops.forEach(onDrop);
      onScan?.(drops);
      return;
    }

    // ── RESCAN → GOLD REWARD ──────────────────────────────
    if (alreadyScanned >= 1) {
      onScanCountUpdate(code, alreadyScanned + 1);
      const tier = alreadyScanned === 1 ? "mid" : "low";
      const REWARD_RULES = {
        mid: { min: 25, max: 50 },
        low: { min: 1,  max: 25 },
      } as const;
      const { min, max } = REWARD_RULES[tier];
      const drop = goldDrop(min + Math.floor(Math.random() * (max - min + 1)), code);
      onDrop(drop);
      onScan?.([drop], "looted");
      return;
    }

    // ── FIRST SCAN (for this player) → THE REGISTRY ───────
    const found = await lookUpBarcode(code);
    if (!found) {
      onOffline?.(code);
      return;
    }
    const opened = openBarcode(code, found, playerLevel);
    if (opened.kind === "too_rare") {
      onSealed?.(opened.rarity, opened.need);
      return;
    }
    onScanCountUpdate(code, 1);
    opened.drops.forEach(onDrop);
    onScan?.(opened.drops, opened.first ? "first" : undefined);
  }

  // A barcode scanned offline, now asked again. null: still out of reach.
  async function openSealed(code: string): Promise<Opened | null> {
    const found = await lookUpBarcode(code);
    return found && openBarcode(code, found, playerLevel);
  }

  return { generateDrop, openSealed };
}
