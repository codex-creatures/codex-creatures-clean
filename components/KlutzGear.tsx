"use client";
// components/KlutzGear.tsx — Klutz's gear and moves window, opened from his
// page and from the Inventory's dock. While he's away hunting you can look,
// but his gear's with him, so no swapping.

import CreatureDetailModal from "./CreatureDetailModal";
import { useGameState, klutzDrop, KLUTZ_DROP_ID } from "@/hooks/useGameState";
import { klutzStatus, pointsFree, pointsSpent, RESPEC_COST } from "@/lib/klutz";
import { isCreatureDrop, isItemDrop, type CreatureOrItemDrop } from "@/lib/types";

export default function KlutzGear({ game, onClose }: { game: ReturnType<typeof useGameState>; onClose: () => void }) {
  const away = klutzStatus(game.klutz, game.klutzFighter.maxHp).kind === "away";
  const items = game.inventory.filter(isItemDrop) as CreatureOrItemDrop[];
  const names = new Map<string, string>([...game.inventory.filter(isCreatureDrop).map((c) => [c.id, c.name] as [string, string]), [KLUTZ_DROP_ID, "Klutz"]]);
  return (
    <CreatureDetailModal
      creature={klutzDrop(game.klutz.level, game.klutz.xp, game.klutz.points)}
      points={{
        free: pointsFree(game.klutz), onSpend: game.spendKlutzPoints,
        respec: { cost: RESPEC_COST, can: pointsSpent(game.klutz.points) > 0 && game.gold >= RESPEC_COST, run: game.respecKlutzPoints },
      }}
      isFavorite={false}
      loadout={game.equipment[KLUTZ_DROP_ID]}
      weapons={items.filter((d) => d.itemCategory === "weapon")}
      armors={items.filter((d) => d.itemCategory === "armor")}
      equippedOn={game.equippedOn}
      creatureNameById={names}
      onEquip={(slot, itemId) => game.equipItem(KLUTZ_DROP_ID, slot, itemId)}
      onSetMoves={away ? undefined : (moves) => game.setMoves(KLUTZ_DROP_ID, moves)}
      locked={away ? "He's got his gear with him: swap it when he's home." : undefined}
      scrolls={items.filter((d) => d.scroll)}
      onReadScroll={(scrollId) => game.readScroll(KLUTZ_DROP_ID, scrollId)}
      onClose={onClose}
    />
  );
}
