"use client";
// components/InventoryList.tsx

import { useState } from "react";
import type { Drop } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { isRewardDrop, isItemDrop, isSellableItem } from "@/lib/types";
import { RARITY_COLORS, getStatCapForDrop } from "@/lib/items/gameHelpers";
import { computeSellGold } from "@/lib/items/economy/sell";
import ItemDetailModal from "./ItemDetailModal";
import type { TabKey as GameTabKey } from "@/hooks/useGameState";

type Props = {
  filteredInventory: Drop[];
  tabCounts: Record<GameTabKey, number>;
  activeTab: GameTabKey;
  onTabChange: (tab: GameTabKey) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  sellMode: boolean;
  selectedForSale: Set<string>;
  onToggleSelectItem: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  sellTotal: number;
  onOpenSellConfirm: () => void;
  onToggleSellMode: () => void;
  onResetAll: () => void;
  onGlobalReset: () => void;
};

const TABS: GameTabKey[] = ["all", "creatures", "weapons", "armor", "materials", "consumables"];

export default function InventoryList({
  filteredInventory, tabCounts, activeTab, onTabChange,
  favoriteIds, onToggleFavorite, sellMode, selectedForSale,
  onToggleSelectItem, onSelectAll, onDeselectAll,
  sellTotal, onOpenSellConfirm, onToggleSellMode, onResetAll, onGlobalReset,
}: Props) {
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  // Only item drops are navigable in the modal
  const navigableItems = filteredInventory.filter(isItemDrop) as CreatureOrItemDrop[];

  function handleRowClick(d: Drop) {
    if (sellMode) {
      if (isSellableItem(d) && !favoriteIds.has(d.id)) onToggleSelectItem(d.id);
      return;
    }
    if (isItemDrop(d)) {
      const idx = navigableItems.findIndex((i) => i.id === d.id);
      if (idx !== -1) setDetailIndex(idx);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginTop: 30, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={onToggleSellMode} style={{ padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", border: sellMode ? "none" : "1px solid rgba(255,80,80,0.5)", background: sellMode ? "#ff5050" : "transparent", color: sellMode ? "white" : "#ff5050", transition: "all 0.15s" }}>
            {sellMode ? "✕ Cancel Sell" : "💰 Sell Mode"}
          </button>
          <button onClick={onResetAll} title="Wipe your progress but keep registered barcodes — test scanning as a new player" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.3)", background: "transparent", color: "#ff5050", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Reset Player
          </button>
          <button onClick={onGlobalReset} title="Wipe the barcode registry — every barcode rolls fresh on its next scan. Inventory is kept." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.3)", background: "transparent", color: "#ff5050", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Global Reset
          </button>
        </div>
      </div>

      {/* Sell toolbar */}
      {sellMode && (
        <div style={{ marginTop: 10, padding: "12px 16px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={onSelectAll} style={smallBtnStyle}>Select All</button>
            <button onClick={onDeselectAll} style={smallBtnStyle}>Deselect All</button>
            <span style={{ fontSize: 13, opacity: 0.7 }}>{selectedForSale.size} selected</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {selectedForSale.size > 0 && <span style={{ color: "#f5c542", fontWeight: 700, fontSize: 15 }}>+{sellTotal.toLocaleString()}g</span>}
            <button onClick={onOpenSellConfirm} disabled={selectedForSale.size === 0} style={{ padding: "8px 18px", borderRadius: 8, fontWeight: 700, border: "none", background: selectedForSale.size > 0 ? "#f5c542" : "rgba(255,255,255,0.1)", color: selectedForSale.size > 0 ? "#1a1a1a" : "rgba(255,255,255,0.3)", cursor: selectedForSale.size > 0 ? "pointer" : "not-allowed", fontSize: 14 }}>
              Sell Selected
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button key={tab} onClick={() => onTabChange(tab)} style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, border: "1px solid rgba(255,255,255,0.2)", background: activeTab === tab ? "white" : "transparent", color: activeTab === tab ? "black" : "white", cursor: "pointer", fontWeight: activeTab === tab ? 700 : 400 }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab] ?? 0})
          </button>
        ))}
      </div>

      {!sellMode && <p style={{ marginTop: 8, fontSize: 12, opacity: 0.35 }}>Tap any weapon or armour to view full details. Use ← → to navigate.</p>}
      {sellMode && <p style={{ marginTop: 8, fontSize: 12, opacity: 0.45 }}>★ Favorited items are protected and cannot be sold.</p>}

      {/* Item rows */}
      <div style={{ marginTop: 8 }}>
        {filteredInventory.map((d) => {
          const isItem     = d.dropType === "item";
          const isFav      = favoriteIds.has(d.id);
          const sellable   = isSellableItem(d) && !isFav;
          const isSelected = selectedForSale.has(d.id);
          const sellVal    = (sellMode && sellable)
            ? computeSellGold({ drop: d as any, getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0 })
            : 0;

          return (
            <div key={d.id} style={{ marginTop: 4 }}>
              <div
                onClick={() => handleRowClick(d)}
                style={{ padding: "8px 10px", borderRadius: 8, border: sellMode && sellable ? (isSelected ? "1px solid rgba(245,197,66,0.7)" : "1px solid rgba(255,255,255,0.1)") : "1px solid transparent", background: sellMode && isSelected ? "rgba(245,197,66,0.08)" : "transparent", cursor: (sellMode && sellable) || (!sellMode && isItem) ? "pointer" : "default", transition: "all 0.1s", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: sellMode && !sellable && !isRewardDrop(d) ? 0.35 : 0.95 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {sellMode && sellable && (
                    <span style={{ fontSize: 15, color: isSelected ? "#f5c542" : "rgba(255,255,255,0.25)" }}>{isSelected ? "☑" : "☐"}</span>
                  )}
                  {isRewardDrop(d) ? (
                    <span style={{ opacity: 0.7 }}>🪙 +{d.amount} Gold</span>
                  ) : (
                    <span style={{ color: isItem ? RARITY_COLORS[(d as CreatureOrItemDrop).rarity]?.text ?? "white" : "white" }}>
                      {isItem ? (d as CreatureOrItemDrop).name ?? (d as any).itemKey ?? "Unknown" : (d as CreatureOrItemDrop).name}
                    </span>
                  )}
                  {!sellMode && isItem && !isRewardDrop(d) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(d.id); }}
                      title={isFav ? "Unfavorite" : "Favourite"}
                      style={{ cursor: "pointer", background: "transparent", border: "none", padding: 0, fontSize: 14, lineHeight: 1, color: isFav ? "#f5c542" : "rgba(255,255,255,0.18)" }}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  )}
                </div>
                {sellMode && sellable && (
                  <span style={{ fontSize: 13, color: "#f5c542", opacity: 0.8 }}>+{sellVal.toLocaleString()}g</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Item Detail Modal */}
      {detailIndex !== null && navigableItems[detailIndex] && (
        <ItemDetailModal
          item={navigableItems[detailIndex]}
          isFavorite={favoriteIds.has(navigableItems[detailIndex].id)}
          onToggleFavorite={(id) => onToggleFavorite(id)}
          onClose={() => setDetailIndex(null)}
          items={navigableItems}
          currentIndex={detailIndex}
          onNavigate={(idx) => setDetailIndex(idx)}
        />
      )}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, fontSize: 13,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent", color: "white", cursor: "pointer",
};
