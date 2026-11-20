"use client";
// app/chest/page.tsx — your Inventory (the chest in the Den): everything you
// own, in three parts you swap between from the buttons at the top (Sell
// mode sits in the dock at the bottom right):
// - Items: weapons, armour, consumables, codexes (and selling); your gold
//   and materials sit in a strip at the top;
// - Creatures: your creatures, your roster, creature cards (as in the Pit);
// - Klutz: a shortcut to his gear and moves (once he's helping you).
// 🧪 ?store=1: the new Den's Storehouse (lib/den3d/layout.ts): just weapons, armour and consumables
// (codexes are on the bookcase, creatures in the Pit), no parts to swap between.

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useGameState, type TabKey } from "@/hooks/useGameState";
import DenFrame from "@/components/DenFrame";
import InventoryList from "@/components/InventoryList";
import SellConfirmModal from "@/components/SellConfirmModal";
import KlutzGear from "@/components/KlutzGear";
import { klutzHelping } from "@/lib/quest";
import { STORAGE_PLANS, STORAGE_TIER, type StoragePlan } from "@/lib/items/materials";
import PlanBuild, { heldOf } from "@/components/PlanBuild";
import { BOX_CAPS, BOX_NAMES, boxCap } from "@/lib/items/storage";

type Part = "items" | "creatures";
const PART_TABS: Record<Part, TabKey[]> = {
  items: ["weapons", "armor", "consumables", "codexes"],
  creatures: ["creatures", "roster", "cards"],
};
const STORE_TABS: TabKey[] = ["weapons", "armor", "consumables"];
const noChange = () => () => {}; // (the address doesn't change while the page is open)

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
  const [part, setPart] = useState<Part>("items");
  const [klutzOpen, setKlutzOpen] = useState(false);
  // (the new Den's Storehouse: ?store=1)
  const store = useSyncExternalStore(noChange, () => new URLSearchParams(window.location.search).get("store") === "1", () => false);
  // The first quest: Klutz sent you to look at his old gear. Seen it.
  const { hydrated, quest, questSawStorage } = game;
  useEffect(() => { if (hydrated && quest.stage === "stash") questSawStorage(); }, [hydrated, quest.stage, questSawStorage]);

  function show(p: Part) {
    setPart(p);
    game.setActiveTab(PART_TABS[p][0]);
    if (game.sellMode) game.toggleSellMode();
  }
  // The three parts, along the top.
  const parts = (
    <div className="dock-tabs">
      <button className="dock-tab" data-active={part === "items"} onClick={() => show("items")}>⚔️ Items</button>
      <button className="dock-tab" data-active={part === "creatures"} onClick={() => show("creatures")}>🐾 Creatures</button>
      <button className="dock-tab" onClick={() => setKlutzOpen(true)} disabled={!klutzHelping(quest)}
        title={klutzHelping(quest) ? "Klutz's gear and moves" : "Klutz isn't helping you yet"}>Klutz</button>
    </div>
  );
  // Sell mode, bottom right; while selling, its controls sit beside it (one
  // row, so the dock never changes height). The dock stays (empty) on
  // Creatures so nothing moves.
  const selling = part === "items" && game.sellMode;
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
        style={{ visibility: part === "items" ? "visible" : "hidden", color: game.sellMode ? "white" : "#ff8a80", padding: "0 16px" }}>
        {game.sellMode ? "✕" : "💰 Sell mode"}
      </button>
    </div>
  );

  // The dock (Sell mode) only on the Items tab: an empty one is just a black strip (the user, 2026-11-17).
  return (
    <DenFrame title={store ? "Storehouse" : "Inventory"} icon={store ? "📦" : "🧰"} gold={game.gold} materials={game.materials} dock={part === "items" ? dock : undefined}>
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
      {klutzOpen && <KlutzGear game={game} onClose={() => setKlutzOpen(false)} />}
      {part === "items" && <StorageBuild game={game} />}
      <InventoryList
        perRow={4}
        title={store ? undefined : parts}
        tabs={store ? STORE_TABS : PART_TABS[part]}
        showSell={false}
        sellBar={false}
        emptyText={part === "items" ? "No items of this kind yet — scan some barcodes."
          : game.activeTab === "roster" ? "Your roster is empty — ★ creatures in the Creatures tab to add them."
          : game.activeTab === "cards" ? "No creature cards yet. Collect 3 of one creature to summon it at the Soul Altar."
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
