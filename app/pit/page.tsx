"use client";
// app/pit/page.tsx — the Pit: your creatures, their gear and moves. (VS AI is
// a testing battle against the computer, not a game feature.)

import Link from "next/link";
import { useGameState } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import RecentBattles from "@/components/RecentBattles";

export default function PitPage() {
  const game = useGameState("creatures");

  return (
    <DenFrame title="The Pit" icon="🐾" gold={game.gold}>
      <div className="stone-panel" style={{ padding: "14px 14px 22px" }}>
      <InventoryList
        title="Creatures"
        tabs={["creatures", "roster", "cards"]}
        showSell={false}
        emptyText={game.activeTab === "roster"
          ? "Your roster is empty — ★ creatures in the Creatures tab to add them."
          : game.activeTab === "cards"
            ? "No creature cards yet. Creature barcodes usually give a card — collect 3 of one creature to summon it."
            : "No creatures yet — visit the Soul Altar."}
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        onSetMoves={game.setMoves}
        onLearnCodex={game.learnCodex}
        onReadScroll={game.readScroll}
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
        headerExtra={<Link href="/battle" className="chip" title="Testing: a battle against an AI team">VS AI</Link>}
        unavailableItems={game.klutzAwayItems}
      />
      </div>

      <RecentBattles />
    </DenFrame>
  );
}
