// hooks/useDropGeneration.ts
import type { Drop } from "@/lib/types";
import { resolveBarcode, rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { dropFromOutcome, goldDrop } from "@/lib/drops";
import { canFind, SCAN_UNLOCK } from "@/lib/creatures/levels";
import type { Rarity } from "@/lib/types";

// "deterministic" (Repeatable): outcomes come from the barcode registry,
//   rolled once on first-ever scan; your own rescans give gold.
// "random": dev testing — every scan rolls a fresh outcome, nothing registered.
type RollMode = "random" | "deterministic";

// A barcode you've never scanned gives this many drops (1: items stay
// scarce — scanning a few things is rewarding enough). Each is its own
// registry entry ("code", "code:2", "code:3"), so everyone who scans the
// barcode finds the same things.
export const SCAN_DROPS = 1;

type UseDropGenerationArgs = {
  rollMode: RollMode;
  scanCounts: Record<string, number>;
  // Reward drops carry their gold amount; the receiver credits it.
  onDrop: (drop: Drop) => void;
  onScanCountUpdate: (code: string, newCount: number) => void;
  onScan?: (drops: Drop[]) => void; // everything one scan gave
  playerLevel?: number;              // your explorer level: how rare a creature you can find
  // A barcode whose creature is too rare for you yet: it stays sealed (the
  // scan doesn't count), so you can come back for it at level `need`.
  onSealed?: (rarity: Rarity, need: number) => void;
};

export function useDropGeneration({
  rollMode,
  scanCounts,
  onDrop,
  onScanCountUpdate,
  onScan,
  playerLevel = 1,
  onSealed,
}: UseDropGenerationArgs) {
  function generateDrop(code: string) {
    if (!/^[0-9]{6,20}$/.test(code)) return;

    const alreadyScanned = scanCounts[code] ?? 0;

    // ── TOO RARE FOR YOU YET → SEALED ─────────────────────
    if (rollMode === "deterministic" && alreadyScanned === 0) {
      const first = resolveBarcode(code);
      if (first.outcome === "creature" && !canFind(playerLevel, first.rarity)) {
        onSealed?.(first.rarity, SCAN_UNLOCK[first.rarity]);
        return;
      }
    }
    onScanCountUpdate(code, alreadyScanned + 1);

    // ── RESCAN → GOLD REWARD ──────────────────────────────
    if (rollMode === "deterministic" && alreadyScanned >= 1) {
      const tier = alreadyScanned === 1 ? "mid" : "low";
      const REWARD_RULES = {
        mid: { min: 25, max: 50 },
        low: { min: 1,  max: 25 },
      } as const;
      const { min, max } = REWARD_RULES[tier];
      const drop = goldDrop(min + Math.floor(Math.random() * (max - min + 1)), code);
      onDrop(drop);
      onScan?.([drop]);
      return;
    }

    // ── FIRST SCAN (for this player) → BARCODE OUTCOMES ───
    // Registry: same barcode gives everyone the same outcomes. Creature: the
    // barcode fixes WHICH creature, you usually get a card of it (20%: the
    // creature itself). Items: identity + rarity from the barcode, stats
    // roll fresh per player.
    const drops: Drop[] = [];
    for (let i = 0; i < SCAN_DROPS; i++) {
      const key = i === 0 ? code : `${code}:${i + 1}`;
      const result = rollMode === "deterministic" ? resolveBarcode(key) : rollBarcodeOutcome(playerLevel);
      const drop = dropFromOutcome(result, code);
      if (drop) drops.push(drop);
    }
    drops.forEach(onDrop);
    onScan?.(drops);
  }

  return { generateDrop };
}
