"use client";
// app/pit/page.tsx — your creatures: roster, equipping, and the way into battle.

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DungeonFrame from "@/components/DungeonFrame";
import InventoryList from "@/components/InventoryList";

export default function PitPage() {
  const game = useGameState("roster");

  return (
    <DungeonFrame title="Fight Pit" icon="⚔️" gold={game.gold}>
      <div className="stone-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Ready to fight?</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>Pick 3 creatures and battle an AI team.</div>
        </div>
        <Link href="/battle" className="pixel-btn">⚔️ Enter the pit</Link>
      </div>

      <InventoryList
        title="Creatures"
        tabs={["roster", "creatures"]}
        showSell={false}
        emptyText={game.activeTab === "roster"
          ? "Your roster is empty — ★ creatures in the Creatures tab to add them."
          : "No creatures yet — visit the Scanning Altar."}
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
        sellMode={false}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={0}
        onOpenSellConfirm={() => {}}
        onToggleSellMode={() => {}}
      />
    </DungeonFrame>
  );
}
