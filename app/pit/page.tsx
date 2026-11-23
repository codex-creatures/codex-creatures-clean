"use client";
// app/pit/page.tsx — the Pit: your creatures, their gear and moves. The
// buttons at the top flip to your items, four a row as in the Storehouse,
// with its Sell mode in the dock too (the user, 2026-11-24). (The old "VS AI"
// testing battle went on 2026-11-24: ranked matches against the AI are at the PvP portal.)

import { useState } from "react";
import Link from "next/link";
import { useGameState, type TabKey } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import KlutzHead from "@/components/klutz/KlutzHead";
import InventoryList from "@/components/InventoryList";
import SellConfirmModal from "@/components/SellConfirmModal";
import { klutzHelping, needsGearUp } from "@/lib/quest";

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
    if (game.sellMode) game.toggleSellMode(); // (Sell mode is for the items)
  }
  // Sell mode (the items only), bottom right, as in the Storehouse: one row, so the dock never changes height.
  const selling = part === "items" && game.sellMode;
  const picked = game.selectedForSale.size;
  const dock = part === "items" ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
      {selling && <>
        <button className="dock-tab" onClick={game.selectAllInView} style={{ padding: "0 10px" }}>All</button>
        <button className="dock-tab" onClick={game.deselectAll} disabled={picked === 0} style={{ padding: "0 10px" }}>None</button>
        <button className="dock-tab" onClick={() => game.setShowSellConfirm(true)} disabled={picked === 0}
          style={{ flex: 1, minWidth: 0, color: picked ? "#f5c542" : undefined }}>
          Sell {picked}{picked > 0 && ` · +${game.sellTotal.toLocaleString()}g`}
        </button>
      </>}
      <button className="dock-tab" onClick={game.toggleSellMode} data-active={selling}
        style={{ color: selling ? "white" : "#ff8a80", padding: "0 16px" }}>
        {selling ? "✕" : "💰 Sell mode"}
      </button>
    </div>
  ) : undefined;
  // Klutz wants armour on a creature first: the way to it glows (and, once it's on, the way back to him).
  const loadouts = game.inventory.filter((d) => d.dropType === "creature").map((c) => game.equipment[c.id]);
  const gearUp = needsGearUp(game.quest, loadouts);
  const backToKlutz = game.quest.stage === "lend" && !gearUp;
  const parts = (
    <div className="dock-tabs" data-tour="parts">
      <button className={`dock-tab${gearUp && part !== "creatures" ? " tutorial-pulse" : ""}`} data-active={part === "creatures"} onClick={() => show("creatures")}>🐾 Creatures</button>
      <button className="dock-tab" data-active={part === "items"} onClick={() => show("items")}>⚔️ Items</button>
    </div>
  );

  return (
    <DenFrame title="The Pit" icon="🐾" gold={game.gold} dock={dock}>
      {game.showSellConfirm && (
        <SellConfirmModal items={game.selectedItemsForModal} totalGold={game.sellTotal} worn={game.wornBy}
          onConfirm={game.confirmSell} onCancel={() => game.setShowSellConfirm(false)} />
      )}
      {backToKlutz && (
        <div className="tutorial-tip" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span>Kitted out! Klutz is waiting.</span>
          <Link href="/klutz" className="pixel-btn tutorial-pulse"><KlutzHead size={18} /> Back to Klutz</Link>
        </div>
      )}
      <div className="stone-panel" style={{ padding: "14px 14px 22px" }}>
      <InventoryList
        title={parts}
        perRow={4}
        materials={game.materials}
        onRename={game.renameCreature}
        tabs={PART_TABS[part]}
        showSell={false}
        emptyText={part === "items" ? "No items of this kind yet — scan some barcodes."
          : game.activeTab === "roster"
          ? "No creatures in a team yet — open one and tap Add to team."
          : game.activeTab === "cards"
            ? "No creature cards yet. Creature barcodes usually give a card — collect 3 of one creature to summon it at the Soul Altar."
            : "No creatures yet — scan some barcodes."}
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        onSetMoves={game.setMoves}
        onLearnCodex={game.learnCodex}
        onReadScroll={game.readScroll}
        klutzReads={klutzHelping(game.quest) ? game.klutz.level ?? 1 : undefined}
        onSetSoulStone={game.setSoulStone}
        gold={game.gold}
        tabCounts={game.tabCounts}
        activeTab={game.activeTab}
        onTabChange={game.setActiveTab}
        favoriteIds={game.favoriteIds}
        onToggleFavorite={game.toggleFavorite}
        teams={game.teams}
        onToggleTeam={game.toggleTeam}
        sellMode={selling}
        wornBy={game.wornBy}
        selectedForSale={game.selectedForSale}
        onToggleSelectItem={game.toggleSelectItem}
        onSelectAll={game.selectAllInView}
        onDeselectAll={game.deselectAll}
        sellTotal={game.sellTotal}
        onOpenSellConfirm={() => game.setShowSellConfirm(true)}
        onToggleSellMode={game.toggleSellMode}
        onSellOne={game.sellOne}
        unavailableItems={game.klutzAwayItems}
        bigBoxes={game.storage}
        guideGearUp={gearUp && part === "creatures"}
      />
      </div>

    </DenFrame>
  );
}
