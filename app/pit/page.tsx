"use client";
// app/pit/page.tsx — the Pit: your creatures, their gear and moves. The
// buttons at the top flip to your items (as in the Inventory; selling stays
// at the chest). (VS AI is a testing battle against the computer, not a game
// feature.)

import { useState } from "react";
import Link from "next/link";
import { useGameState, type TabKey } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import RecentBattles from "@/components/RecentBattles";

type Part = "creatures" | "items";
const PART_TABS: Record<Part, TabKey[]> = {
  creatures: ["creatures", "roster", "cards"],
  items: ["weapons", "armor", "consumables", "codexes"],
};

export default function PitPage() {
  const game = useGameState("creatures");
  const [part, setPart] = useState<Part>("creatures");

  function show(p: Part) {
    setPart(p);
    game.setActiveTab(PART_TABS[p][0]);
  }
  const parts = (
    <div className="dock-tabs">
      <button className="dock-tab" data-active={part === "creatures"} onClick={() => show("creatures")}>🐾 Creatures</button>
      <button className="dock-tab" data-active={part === "items"} onClick={() => show("items")}>⚔️ Items</button>
    </div>
  );

  return (
    <DenFrame title="The Pit" icon="🐾" gold={game.gold}>
      <div className="stone-panel" style={{ padding: "14px 14px 22px" }}>
      <InventoryList
        title={parts}
        tabs={PART_TABS[part]}
        showSell={false}
        emptyText={part === "items" ? "No items of this kind yet — visit the Soul Altar."
          : game.activeTab === "roster"
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
        onSetSoulStone={game.setSoulStone}
        gold={game.gold}
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
