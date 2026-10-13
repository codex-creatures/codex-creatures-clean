// hooks/useDropGeneration.ts
import type { Drop } from "@/lib/types";
import { resolveBarcode, rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { dropFromOutcome, goldDrop } from "@/lib/drops";

// "deterministic" (Repeatable): outcomes come from the barcode registry,
//   rolled once on first-ever scan; your own rescans give gold.
// "random": dev testing — every scan rolls a fresh outcome, nothing registered.
type RollMode = "random" | "deterministic";

type UseDropGenerationArgs = {
  rollMode: RollMode;
  scanCounts: Record<string, number>;
  // Reward drops carry their gold amount; the receiver credits it.
  onDrop: (drop: Drop) => void;
  onScanCountUpdate: (code: string, newCount: number) => void;
};

export function useDropGeneration({
  rollMode,
  scanCounts,
  onDrop,
  onScanCountUpdate,
}: UseDropGenerationArgs) {
  function generateDrop(code: string) {
    if (!/^[0-9]{6,20}$/.test(code)) return;

    const alreadyScanned = scanCounts[code] ?? 0;
    onScanCountUpdate(code, alreadyScanned + 1);

    // ── RESCAN → GOLD REWARD ──────────────────────────────
    if (rollMode === "deterministic" && alreadyScanned >= 1) {
      const tier = alreadyScanned === 1 ? "mid" : "low";
      const REWARD_RULES = {
        mid: { min: 25, max: 50 },
        low: { min: 1,  max: 25 },
      } as const;
      const { min, max } = REWARD_RULES[tier];
      onDrop(goldDrop(min + Math.floor(Math.random() * (max - min + 1)), code));
      return;
    }

    // ── FIRST SCAN (for this player) → BARCODE OUTCOME ────
    // Registry: same barcode gives everyone the same outcome. Creature: the
    // barcode fixes WHICH creature, you usually get a card of it (10%: the
    // creature itself). Items: identity + rarity from the barcode, stats
    // roll fresh per player.
    const result = rollMode === "deterministic" ? resolveBarcode(code) : rollBarcodeOutcome();
    const drop = dropFromOutcome(result, code);
    if (drop) onDrop(drop);
  }

  return { generateDrop };
}
