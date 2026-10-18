"use client";
// app/chest/page.tsx — your Inventory (the chest in the Den): everything you
// own, in three parts you swap between from the dock at the bottom:
// - Items: weapons, armour, materials, consumables (and selling);
// - Creatures: your creatures, your roster, creature cards (as in the Pit);
// - Codex: the codexes on your bookcase's shelf.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGameState, type TabKey } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import SellConfirmModal from "@/components/SellConfirmModal";
import CodexShelf from "@/components/CodexShelf";

type Part = "items" | "creatures" | "codex";
const PART_TABS: Record<Exclude<Part, "codex">, TabKey[]> = {
  items: ["weapons", "armor", "materials", "consumables"],
  creatures: ["creatures", "roster", "cards"],
};

export default function InventoryPage() {
  const game = useGameState("weapons");
  const [part, setPart] = useState<Part>("items");
  // The first quest: Klutz sent you to look at his old gear. Seen it.
  const { hydrated, quest, questSawStorage } = game;
  useEffect(() => { if (hydrated && quest.stage === "stash") questSawStorage(); }, [hydrated, quest.stage, questSawStorage]);

  function show(p: Part) {
    setPart(p);
    if (p !== "codex") { game.setActiveTab(PART_TABS[p][0]); if (game.sellMode) game.toggleSellMode(); }
  }
  const codexCount = game.inventory.filter((d) => d.dropType === "item" && d.codexMove).length;
  const count = (p: Exclude<Part, "codex">) => PART_TABS[p].filter((t) => t !== "roster").reduce((n, t) => n + (game.tabCounts[t] ?? 0), 0);

  const dock = (
    <div className="dock-tabs">
      <button className="dock-tab" data-active={part === "items"} onClick={() => show("items")}>⚔️ Items <span className="count">{count("items")}</span></button>
      <button className="dock-tab" data-active={part === "creatures"} onClick={() => show("creatures")}>🐾 Creatures <span className="count">{count("creatures")}</span></button>
      <button className="dock-tab" data-active={part === "codex"} onClick={() => show("codex")}>📖 Codex <span className="count">{codexCount}</span></button>
    </div>
  );

  return (
    <DenFrame title="Inventory" icon="🧰" gold={game.gold} dock={dock}>
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
      {part === "codex" ? (
        <CodexShelf inventory={game.inventory} size={game.bookcaseSize} />
      ) : (
        <InventoryList
          title={part === "items" ? "Items" : "Creatures"}
          tabs={PART_TABS[part]}
          showSell={part === "items"}
          emptyText={part === "items" ? "No items of this kind yet — visit the Soul Altar."
            : game.activeTab === "roster" ? "Your roster is empty — ★ creatures in the Creatures tab to add them."
            : game.activeTab === "cards" ? "No creature cards yet. Collect 3 of one creature to summon it."
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
          sellMode={part === "items" && game.sellMode}
          selectedForSale={game.selectedForSale}
          onToggleSelectItem={game.toggleSelectItem}
          onSelectAll={game.selectAllInView}
          onDeselectAll={game.deselectAll}
          sellTotal={game.sellTotal}
          onOpenSellConfirm={() => game.setShowSellConfirm(true)}
          onToggleSellMode={game.toggleSellMode}
          unavailableItems={game.klutzAwayItems}
        />
      )}
    </DenFrame>
  );
}
