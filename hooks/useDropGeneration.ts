// hooks/useDropGeneration.ts
import type { Drop } from "@/lib/types";
import { rollItemStats } from "@/lib/items/rollItemStats";
import { rollArmorStats } from "@/lib/items/rollArmorStats";
import { ITEM_META } from "@/lib/items/metadata";
import { ARMOR_META } from "@/lib/items/armor";
import { resolveBarcode, rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { creatureOrCard } from "@/lib/creatures/summon";

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
      const amount = min + Math.floor(Math.random() * (max - min + 1));

      onDrop({
        id: crypto.randomUUID(),
        barcode: code,
        dropType: "reward",
        rewardKind: "resource",
        amount,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    // ── FIRST SCAN (for this player) → BARCODE OUTCOME ────
    // Registry: same barcode gives everyone the same outcome.
    const result = rollMode === "deterministic" ? resolveBarcode(code) : rollBarcodeOutcome();

    // ── GOLD ─────────────────────────────────────────────
    if (result.outcome === "gold") {
      onDrop({
        id: crypto.randomUUID(),
        barcode: code,
        dropType: "reward",
        rewardKind: "resource",
        amount: result.amount,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    // ── CREATURE ─────────────────────────────────────────
    // The barcode fixes WHICH creature; you usually get a card of it (10%:
    // the creature itself), with this player's own % and move roll.
    if (result.outcome === "creature") {
      const creature = CREATURE_BY_ID[result.creatureId];
      if (creature) onDrop(creatureOrCard(creature, code));
      return;
    }

    // ── ITEM ─────────────────────────────────────────────
    // Identity + rarity come from the barcode; stats roll fresh per player.
    const { itemCategory, rarity, itemKey, armorKey } = result;

    if (itemCategory === "weapon" && itemKey) {
      const rolledStats = rollItemStats(itemKey, rarity, Math.random);
      const meta        = ITEM_META[itemKey];
      onDrop({
        id: crypto.randomUUID(),
        barcode: code,
        dropType: "item",
        itemCategory: "weapon",
        itemKey,
        rarity,
        roll: Math.floor(Math.random() * 100),
        name:  meta?.name ?? itemKey,
        desc:  meta?.desc ?? "",
        stats: rolledStats.stats,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (itemCategory === "armor" && armorKey) {
      const rolled = rollArmorStats(armorKey, rarity, Math.random);
      const meta   = ARMOR_META[armorKey];
      onDrop({
        id: crypto.randomUUID(),
        barcode: code,
        dropType: "item",
        itemCategory: "armor",
        armorKey,
        rarity,
        roll: Math.floor(Math.random() * 100),
        name:  meta?.name ?? armorKey,
        desc:  meta?.desc ?? "",
        stats: rolled.stats,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    // material / consumable — no stats
    onDrop({
      id: crypto.randomUUID(),
      barcode: code,
      dropType: "item",
      itemCategory,
      rarity,
      roll: 0,
      name: `${rarity} ${itemCategory}`,
      createdAt: new Date().toISOString(),
    });
  }

  return { generateDrop };
}
