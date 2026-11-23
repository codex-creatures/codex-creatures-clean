"use client";
// app/chest/page.tsx — the Storehouse (tapped in the Den: lib/den3d/layout.ts): your weapons, armour and
// consumables, a tab each, with Sell mode in the dock at the bottom right and the storage schematics
// you've got to build on top. Codexes are on the bookcase, creatures in the Pit, Klutz's gear at his.
// (The old Den's three-part Inventory, Items, Creatures and Klutz, was here till 2026-11-24, and
// ?store=1 picked the Storehouse: every link now opens it, and the old query is simply ignored.)

import { useEffect } from "react";
import Link from "next/link";
import { useGameState, type TabKey } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import SellConfirmModal from "@/components/SellConfirmModal";
import { klutzHelping } from "@/lib/quest";
import { STORAGE_PLANS, STORAGE_TIER, type StoragePlan } from "@/lib/items/materials";
import PlanBuild, { heldOf } from "@/components/PlanBuild";
import { BOX_CAPS, BOX_NAMES, boxCap } from "@/lib/items/storage";

const STORE_TABS: TabKey[] = ["weapons", "armor", "consumables"];

// The storage schematics you've got (a chest, or a merchant: lib/items/plans.ts), to build here: each takes
// its box up a stage (lib/items/storage.ts BOX_CAPS: 50, 60, 75, 85, 100).
function StorageBuild({ game }: { game: ReturnType<typeof useGameState> }) {
  const plans = heldOf(game.inventory, Object.keys(STORAGE_PLANS) as StoragePlan[]);
  if (plans.length === 0) return null;
  return (
    <div className="stone-panel" style={{ marginBottom: 10, padding: "0 10px 8px" }}>
      {plans.map((p) => <PlanBuild key={p.id} plan={p.key} materials={game.materials} gold={game.gold} onBuild={() => game.buildSchematic(p.id)}
        note={boxCap(STORAGE_PLANS[p.key], game.storage) >= BOX_CAPS[STORAGE_TIER[p.key]] ? `Your ${BOX_NAMES[STORAGE_PLANS[p.key]]} box is bigger already.` : undefined} />)}
    </div>
  );
}

export default function InventoryPage() {
  const game = useGameState("weapons");
  // The first quest: Klutz sent you to look at his old gear. Seen it.
  const { hydrated, quest, questSawStorage } = game;
  useEffect(() => { if (hydrated && quest.stage === "stash") questSawStorage(); }, [hydrated, quest.stage, questSawStorage]);

  // Sell mode, bottom right; while selling, its controls sit beside it (one
  // row, so the dock never changes height).
  const selling = game.sellMode;
  const picked = game.selectedForSale.size;
  const dock = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
      {selling && <>
        <button className="dock-tab" onClick={game.selectAllInView} style={{ padding: "0 10px" }}>All</button>
        <button className="dock-tab" onClick={game.deselectAll} disabled={picked === 0} style={{ padding: "0 10px" }}>None</button>
        <button className="dock-tab" onClick={() => game.setShowSellConfirm(true)} disabled={picked === 0}
          style={{ flex: 1, minWidth: 0, color: picked ? "#f5c542" : undefined }}>
          Sell {picked}{picked > 0 && ` · +${game.sellTotal.toLocaleString()}g`}
        </button>
      </>}
      <button className="dock-tab" data-tour="sell" onClick={game.toggleSellMode} data-active={game.sellMode}
        style={{ color: game.sellMode ? "white" : "#ff8a80", padding: "0 16px" }}>
        {game.sellMode ? "✕" : "💰 Sell mode"}
      </button>
    </div>
  );

  return (
    <DenFrame title="Storehouse" icon="📦" gold={game.gold} materials={game.materials} dock={dock}>
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
      <StorageBuild game={game} />
      <InventoryList
        perRow={4}
        tabs={STORE_TABS}
        showSell={false}
        sellBar={false}
        emptyText="No items of this kind yet — scan some barcodes."
        inventory={game.inventory}
        filteredInventory={game.filteredInventory}
        equipment={game.equipment}
        equippedOn={game.equippedOn}
        lockedIds={game.lockedIds}
        onEquip={game.equipItem}
        onSetMoves={game.setMoves}
        onLearnCodex={game.learnCodex}
        onReadScroll={game.readScroll}
        klutzReads={klutzHelping(quest) ? game.klutz.level ?? 1 : undefined}
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
        />
    </DenFrame>
  );
}
