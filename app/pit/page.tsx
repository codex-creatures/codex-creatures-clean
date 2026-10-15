"use client";
// app/pit/page.tsx — your creatures: roster, equipping, and the way into battle.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import RecentBattles from "@/components/RecentBattles";

export default function PitPage() {
  const game = useGameState("roster");

  return (
    <DenFrame title="Fight Pit" icon="⚔️" gold={game.gold}>
      <Link href="/battle" className="pixel-btn" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, width: "100%" }}>
        ⚔️ Enter the pit <span style={{ fontSize: 12, opacity: 0.7 }}>· 3 of yours vs an AI team</span>
      </Link>

      <InventoryList
        title="Creatures"
        tabs={["roster", "creatures", "cards"]}
        showSell={false}
        emptyText={game.activeTab === "roster"
          ? "Your roster is empty — ★ creatures in the Creatures tab to add them."
          : game.activeTab === "cards"
            ? "No creature cards yet. Creature barcodes usually give a card — collect 3 of one creature to summon it."
            : "No creatures yet — visit the Scanning Altar."}
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        onSetMoves={game.setMoves}
        onLearnCodex={game.learnCodex}
        onSummon={game.summon}
        tabCounts={game.tabCounts}
        activeTab={game.activeTab}
        onTabChange={game.setActiveTab}
        favoriteIds={game.favoriteIds}
        onToggleFavorite={game.toggleFavorite}
        sellMode={false}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={0}
        onOpenSellConfirm={() => {}}
        onToggleSellMode={() => {}}
      />

      <RecentBattles />
    </DenFrame>
  );
}
