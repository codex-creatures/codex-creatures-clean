"use client";
// components/InventoryList.tsx

import { Coin } from "./GoldCount";
import { useMemo, useState } from "react";
import type { Drop } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { isRewardDrop, isItemDrop, isCreatureDrop, isCardDrop, isSellableItem } from "@/lib/types";
import { RARITY_COLORS, getStatCapForDrop } from "@/lib/items/gameHelpers";
import { computeSellGold } from "@/lib/items/economy/sell";
import { findCreatureTemplate } from "@/lib/creatures/creatureData";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import ItemDetailModal from "./ItemDetailModal";
import CreatureDetailModal from "./CreatureDetailModal";
import PixelSprite, { creatureSprite, itemSprite } from "./PixelSprite";
import CardModal from "./CardModal";
import CardGallery from "./CardGallery";
import TileGrid, { groupTiles, RARITY_ORDER } from "./TileGrid";
import { CARDS_TO_SUMMON } from "@/lib/creatures/summon";
import { CreatureToolbar, NO_INV_FILTER, passes, sortCreatures, type InventoryFilter } from "./CreatureMarks";
import { BOX_CAP } from "@/lib/items/storage";

// Tabs shown as a grid of sprite squares (sorted by rarity) rather than rows.
const GRID_TABS = new Set<GameTabKey>(["roster", "creatures", "weapons", "armor", "materials", "consumables", "codexes"]);
// Tabs that are a chest box of BOX_CAP (lib/items/storage.ts): shown in red once full.
const CAPPED_TABS = new Set<GameTabKey>(["weapons", "armor", "consumables"]);
import { KLUTZ_DROP_ID, type TabKey as GameTabKey, type Loadout, type EquipSlot } from "@/hooks/useGameState";

const hasArmor = (l?: Loadout) => !!(l?.helmetId || l?.chestId || l?.legsId);

type Props = {
  inventory: Drop[];
  filteredInventory: Drop[];
  equipment: Record<string, Loadout>;
  equippedOn: Map<string, string>;
  lockedIds: Set<string>; // favourited or equipped — can't be sold
  onEquip: (creatureId: string, slot: EquipSlot, itemId: string | null) => void;
  onSetMoves?: (creatureId: string, moves: string[]) => void;
  onLearnCodex?: (creatureId: string, codexId: string) => void;
  onReadScroll?: (creatureId: string, scrollId: string) => void;
  onSummon?: (cardIds: string[], keepId: string | null) => CreatureOrItemDrop;
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
  onResetAll?: () => void;
  onGlobalReset?: () => void;
  // Which tabs this screen shows (the chest shows items, the pit creatures).
  tabs?: GameTabKey[];
  title?: string;
  showSell?: boolean;
  emptyText?: string;
  headerExtra?: React.ReactNode; // e.g. the Pit's VS AI button
  unavailableItems?: Set<string>; // gear you can't take right now (Klutz has it in the Labyrinth)
};

const TABS: GameTabKey[] = ["all", "roster", "creatures", "weapons", "armor", "materials", "consumables", "codexes"];
const TAB_LABELS: Partial<Record<GameTabKey, string>> = { roster: "★ Roster" };

export default function InventoryList({
  inventory, filteredInventory, equipment, equippedOn, lockedIds, onEquip, onSetMoves, onLearnCodex, onReadScroll, onSummon,
  tabCounts, activeTab, onTabChange,
  favoriteIds, onToggleFavorite, sellMode, selectedForSale,
  onToggleSelectItem, onSelectAll, onDeselectAll,
  sellTotal, onOpenSellConfirm, onToggleSellMode, onResetAll, onGlobalReset,
  tabs = TABS, title = "Inventory", showSell = true, emptyText, headerExtra, unavailableItems,
}: Props) {
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [openCreatureId, setOpenCreatureId] = useState<string | null>(null);
  // Keep the card itself (not just its id): after summoning it's gone from
  // the inventory, but the window stays open to show what was summoned.
  const [openCard, setOpenCard] = useState<CreatureOrItemDrop | null>(null);

  const asGrid = GRID_TABS.has(activeTab);
  // Creature tabs can be filtered by race and class, and grouped.
  const creatureTab = activeTab === "creatures" || activeTab === "roster";
  const [filter, setFilter] = useState<InventoryFilter>(NO_INV_FILTER);
  const tplOf = (d: Drop) => (isCreatureDrop(d) ? findCreatureTemplate(d.creatureId, d.name) : undefined);
  const gridItems = filteredInventory.filter((d) => !isRewardDrop(d)) as CreatureOrItemDrop[];
  // Creatures: one flat grid, filtered and sorted; gear: grouped by rarity.
  const filtered = creatureTab
    ? sortCreatures(gridItems.filter((d) => !isCreatureDrop(d) || passes(filter, d.name, tplOf(d)?.race, tplOf(d)?.cls)), filter.sort,
        (d) => ({ name: d.name, rarity: d.rarity, race: tplOf(d)?.race, cls: tplOf(d)?.cls, createdAt: d.createdAt }))
    : gridItems;
  const groupBy = creatureTab ? "none" as const : "rarity" as const;
  // Browsing (flicking through creatures) follows the order shown.
  const shown: Drop[] = asGrid ? (groupBy === "none" ? filtered : groupTiles(filtered, groupBy).flatMap(([, , , g]) => g)) : filteredInventory;
  // Only item drops are navigable in the modal
  const navigableItems = shown.filter(isItemDrop) as CreatureOrItemDrop[];

  const allWeapons = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "weapon") as CreatureOrItemDrop[], [inventory]);
  const allArmors  = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "armor") as CreatureOrItemDrop[], [inventory]);
  const creatureNameById = useMemo(
    () => new Map([...inventory.filter(isCreatureDrop).map((c) => [c.id, c.name] as [string, string]), [KLUTZ_DROP_ID, "Klutz"]]),
    [inventory]
  );
  // The rarest creature you have enough cards to summon (its colour lights up the Cards tab).
  const summonable = useMemo(() => {
    const counts = new Map<string, { n: number; rarity: CreatureOrItemDrop["rarity"] }>();
    for (const d of inventory) {
      if (!isCardDrop(d)) continue;
      const t = findCreatureTemplate(d.creatureId, d.name);
      if (!t) continue;
      const c = counts.get(t.id) ?? { n: 0, rarity: t.rarity };
      counts.set(t.id, { ...c, n: c.n + 1 });
    }
    return RARITY_ORDER.find((r) => [...counts.values()].some((c) => c.rarity === r && c.n >= CARDS_TO_SUMMON));
  }, [inventory]);
  const openCreature = openCreatureId ? inventory.find((d) => d.id === openCreatureId) : undefined;
  // The creatures in the current list, to flick through (wrapping round).
  const creatureList = shown.filter(isCreatureDrop);
  const creatureIndex = creatureList.findIndex((d) => d.id === openCreatureId);
  const stepCreature = (by: number) => {
    if (creatureIndex < 0 || creatureList.length < 2) return;
    setOpenCreatureId(creatureList[(creatureIndex + by + creatureList.length) % creatureList.length].id);
  };

  function handleRowClick(d: Drop) {
    if (sellMode) {
      if (isSellableItem(d) && !lockedIds.has(d.id)) onToggleSelectItem(d.id);
      return;
    }
    if (isCardDrop(d)) {
      setOpenCard(d);
      return;
    }
    if (isCreatureDrop(d)) {
      setOpenCreatureId(d.id);
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
        <h2 className="pixel-font" style={{ margin: 0, fontWeight: 600, color: "#f1d9a0" }}>{title}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {headerExtra}
          {showSell && <button onClick={onToggleSellMode} style={{ padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", border: sellMode ? "none" : "1px solid rgba(255,80,80,0.5)", background: sellMode ? "#ff5050" : "transparent", color: sellMode ? "white" : "#ff5050", transition: "all 0.15s" }}>
            {sellMode ? "✕ Cancel Sell" : "💰 Sell Mode"}
          </button>}
          {onResetAll && <button onClick={onResetAll} title="Wipe your progress but keep registered barcodes — test scanning as a new player" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.3)", background: "transparent", color: "#ff5050", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Reset Player
          </button>}
          {onGlobalReset && <button onClick={onGlobalReset} title="Wipe the barcode registry — every barcode rolls fresh on its next scan. Inventory is kept." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.3)", background: "transparent", color: "#ff5050", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Global Reset
          </button>}
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

      {/* Tabs: one segmented control. */}
      <div role="tablist" style={{ marginTop: 14, display: "flex", border: "2px solid #2a2d38", borderRadius: 10, overflow: "hidden", background: "#101117" }}>
        {tabs.map((tab, i) => {
          const on = activeTab === tab;
          const glow = tab === "cards" && summonable ? RARITY_COLORS[summonable].text : undefined;
          return (
            <button key={tab} role="tab" aria-selected={on} onClick={() => onTabChange(tab)} className={`pixel-font${glow ? " tab-glow" : ""}`}
              title={glow ? `You can summon a ${summonable} creature` : undefined}
              style={{ flex: 1, minHeight: 44, padding: "6px 4px", fontSize: 14, cursor: "pointer", border: "none", ["--glow" as string]: glow,
                borderLeft: i ? "2px solid #2a2d38" : "none", background: on ? "#3a2c16" : "transparent", color: glow ? glow : on ? "#ffe9a8" : "rgba(255,255,255,0.6)" }}>
              {TAB_LABELS[tab] ?? tab.charAt(0).toUpperCase() + tab.slice(1)}{" "}
              {CAPPED_TABS.has(tab) && (tabCounts[tab] ?? 0) >= BOX_CAP
                ? <span style={{ color: "#ff8a80" }} title="Full: sell some to go back into the Labyrinth">{tabCounts[tab]}/{BOX_CAP}</span>
                : <span style={{ opacity: 0.6 }}>{tabCounts[tab] ?? 0}</span>}
            </button>
          );
        })}
      </div>

      {!sellMode && !creatureTab && activeTab !== "cards" && <p style={{ marginTop: 8, fontSize: 12, opacity: 0.35 }}>Tap any item for its full details.</p>}
      {sellMode && <p style={{ marginTop: 8, fontSize: 12, opacity: 0.45 }}>★ Favourited and equipped items are protected and cannot be sold.</p>}

      {/* Creature cards: a binder of trading cards. */}
      {activeTab === "cards" && filteredInventory.length > 0 && (
        <CardGallery cards={filteredInventory.filter(isCardDrop) as CreatureOrItemDrop[]} onOpen={(c) => !sellMode && setOpenCard(c)} />
      )}

      {/* Creature search, filter and sort. */}
      {asGrid && creatureTab && gridItems.length > 0 && (
        <CreatureToolbar value={filter} onChange={setFilter} shown={shown.length} total={gridItems.filter(isCreatureDrop).length} />
      )}
      {asGrid && creatureTab && gridItems.length > 0 && shown.length === 0 && (
        <p style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>No creatures match those filters.</p>
      )}

      {/* Creatures and gear: sprite squares. */}
      {asGrid && shown.length > 0 && (
        <TileGrid
          groupBy={groupBy}
          large={creatureTab}
          items={shown as CreatureOrItemDrop[]}
          favoriteIds={favoriteIds}
          badge={(d) => {
            if (isCreatureDrop(d)) { const l = equipment[d.id]; return `${l?.weaponId ? "⚔️" : ""}${hasArmor(l) ? "🛡️" : ""}` || undefined; }
            const owner = equippedOn.get(d.id);
            return owner ? `on ${creatureNameById.get(owner) ?? "creature"}` : undefined;
          }}
          sellMode={sellMode}
          sellable={(d) => isSellableItem(d) && !lockedIds.has(d.id)}
          selected={selectedForSale}
          onOpen={handleRowClick}
        />
      )}

      {/* Item rows */}
      {(activeTab !== "cards" && !asGrid) || filteredInventory.length === 0 ? <div style={{ marginTop: 8 }}>
        {filteredInventory.length === 0 && (
          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.5 }}>{emptyText ?? "Nothing here yet."}</p>
        )}
        {filteredInventory.map((d) => {
          const isItem     = d.dropType === "item";
          const isCreature = d.dropType === "creature";
          const isCard     = d.dropType === "card";
          const isFav      = favoriteIds.has(d.id);
          const sellable   = isSellableItem(d) && !lockedIds.has(d.id);
          const ownerId    = equippedOn.get(d.id);
          const loadout    = isCreature ? equipment[d.id] : undefined;
          const isSelected = selectedForSale.has(d.id);
          const sellVal    = (sellMode && sellable)
            ? computeSellGold({ drop: d as any, getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0 })
            : 0;

          return (
            <div key={d.id} style={{ marginTop: 4 }}>
              <div
                onClick={() => handleRowClick(d)}
                className="inv-row"
                style={{ padding: "8px 10px", borderLeftColor: isRewardDrop(d) ? "#5a4a1a" : RARITY_COLORS[(d as CreatureOrItemDrop).rarity]?.border, outline: sellMode && sellable ? (isSelected ? "2px solid rgba(245,197,66,0.8)" : "1px dashed rgba(255,255,255,0.15)") : "none", background: sellMode && isSelected ? "rgba(245,197,66,0.1)" : undefined, cursor: (sellMode && sellable) || (!sellMode && (isItem || isCreature)) ? "pointer" : "default", transition: "all 0.1s", display: "flex", alignItems: "center", justifyContent: "space-between", opacity: sellMode && !sellable && !isRewardDrop(d) ? 0.35 : 0.95 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {sellMode && sellable && (
                    <span style={{ fontSize: 15, color: isSelected ? "#f5c542" : "rgba(255,255,255,0.25)" }}>{isSelected ? "☑" : "☐"}</span>
                  )}
                  {(() => {
                    if (isRewardDrop(d)) return null;
                    const c = d as CreatureOrItemDrop;
                    const sp = isCreature || isCard ? creatureSprite(c.creatureId) : itemSprite(c);
                    return sp ? <PixelSprite sprite={sp} scale={isCreature || isCard ? 1.25 : 1.75} style={{ opacity: isCard ? 0.75 : 1 }} /> : null;
                  })()}
                  {isRewardDrop(d) ? (
                    <span style={{ opacity: 0.7 }}><Coin /> +{d.amount} Gold</span>
                  ) : (
                    <span style={{ color: RARITY_COLORS[(d as CreatureOrItemDrop).rarity]?.text ?? "white" }}>
                      {isCard ? "🃏 " : ""}{isItem ? (d as CreatureOrItemDrop).name ?? (d as any).itemKey ?? "Unknown" : (d as CreatureOrItemDrop).name}{isCard ? " card" : ""}
                    </span>
                  )}
                  {!sellMode && (isItem || isCreature) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(d.id); }}
                      title={isFav ? "Unfavorite" : "Favourite"}
                      style={{ cursor: "pointer", background: "transparent", border: "none", padding: 0, fontSize: 14, lineHeight: 1, color: isFav ? "#f5c542" : "rgba(255,255,255,0.18)" }}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  )}
                  {(isCreature || isCard) && (() => {
                    const c = d as CreatureOrItemDrop;
                    const t = findCreatureTemplate(c.creatureId, c.name);
                    return t ? <span style={{ fontSize: 11, opacity: 0.45 }}>{creatureTypeLabel(c.proficiency ?? t.proficiency)}</span> : null;
                  })()}
                  {isCreature && (loadout?.weaponId || hasArmor(loadout)) && (
                    <span style={{ fontSize: 12, opacity: 0.6 }} title="Has gear equipped">
                      {loadout?.weaponId ? "⚔️" : ""}{hasArmor(loadout) ? "🛡️" : ""}
                    </span>
                  )}
                  {ownerId && (
                    <span style={{ fontSize: 11, color: "#f5c542", opacity: 0.8 }}>on {creatureNameById.get(ownerId) ?? "creature"}</span>
                  )}
                </div>
                {sellMode && sellable && (
                  <span style={{ fontSize: 13, color: "#f5c542", opacity: 0.8 }}>+{sellVal.toLocaleString()}g</span>
                )}
              </div>
            </div>
          );
        })}
      </div> : null}

      {/* Creature Detail Modal */}
      {openCreature && isCreatureDrop(openCreature) && (
        <CreatureDetailModal
          key={openCreature.id}
          creature={openCreature}
          position={creatureIndex >= 0 ? { index: creatureIndex, count: creatureList.length } : undefined}
          onPrev={() => stepCreature(-1)}
          onNext={() => stepCreature(1)}
          isFavorite={favoriteIds.has(openCreature.id)}
          onToggleFavorite={onToggleFavorite}
          loadout={equipment[openCreature.id]}
          weapons={allWeapons}
          armors={allArmors}
          equippedOn={equippedOn}
          creatureNameById={creatureNameById}
          onEquip={(slot, itemId) => onEquip(openCreature.id, slot, itemId)}
          onSetMoves={onSetMoves ? (moves) => onSetMoves(openCreature.id, moves) : undefined}
          codexes={inventory.filter((d) => isItemDrop(d) && d.codexMove) as CreatureOrItemDrop[]}
          onLearnCodex={onLearnCodex ? (codexId) => onLearnCodex(openCreature.id, codexId) : undefined}
          scrolls={inventory.filter((d) => isItemDrop(d) && d.scroll) as CreatureOrItemDrop[]}
          onReadScroll={onReadScroll ? (scrollId) => onReadScroll(openCreature.id, scrollId) : undefined}
          onClose={() => setOpenCreatureId(null)}
          unavailable={unavailableItems}
        />
      )}

      {/* Card Modal */}
      {openCard && onSummon && (
        <CardModal
          key={openCard.id}
          card={openCard}
          sameKind={inventory.filter((d) => isCardDrop(d) && d.creatureId === openCard.creatureId) as CreatureOrItemDrop[]}
          onSummon={onSummon}
          onClose={() => setOpenCard(null)}
        />
      )}

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
