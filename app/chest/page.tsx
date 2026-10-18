"use client";
// app/chest/page.tsx — your items: weapons, armour, materials, consumables.

import { useEffect } from "react";
import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import SellConfirmModal from "@/components/SellConfirmModal";

export default function ChestPage() {
  const game = useGameState("weapons");
  // The first quest: Klutz sent you to look at his old gear. Seen it.
  const { hydrated, quest, questSawStorage } = game;
  useEffect(() => { if (hydrated && quest.stage === "stash") questSawStorage(); }, [hydrated, quest.stage, questSawStorage]);

  return (
    <DenFrame title="Chest" icon="🧰" gold={game.gold}>
      {game.showSellConfirm && (
        <SellConfirmModal
          items={game.selectedItemsForModal}
          totalGold={game.sellTotal}
          onConfirm={game.confirmSell}
          onCancel={() => game.setShowSellConfirm(false)}
        />
      )}
      {quest.stage === "lend" && (
        <div className="stone-panel" style={{ marginBottom: 12, borderColor: "#8a6a3a", fontSize: 15 }}>
          Klutz&apos;s old gear is all here. <Link href="/klutz" style={{ textDecoration: "underline", color: "#f1d9a0" }}>Klutz</Link> has something to ask you.
        </div>
      )}
      <InventoryList
        title="Items"
        tabs={["weapons", "armor", "materials", "consumables"]}
        emptyText="No items of this kind yet — visit the Soul Altar."
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        tabCounts={game.tabCounts}
        activeTab={game.activeTab}
        onTabChange={game.setActiveTab}
        favoriteIds={game.favoriteIds}
        onToggleFavorite={game.toggleFavorite}
        sellMode={game.sellMode}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={game.sellTotal}
        onOpenSellConfirm={() => game.setShowSellConfirm(true)}
        onToggleSellMode={game.toggleSellMode}
      />
    </DenFrame>
  );
}
