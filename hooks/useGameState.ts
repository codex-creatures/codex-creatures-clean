// hooks/useGameState.ts
import { useEffect, useMemo, useState } from "react";
import type { Drop } from "@/lib/types";
import { isRewardDrop, isItemDrop, isCreatureDrop, isSellableItem } from "@/lib/types";
import { computeSellGold } from "@/lib/items/economy/sell";
import { getStatCapForDrop } from "@/lib/items/gameHelpers";

const STORAGE_KEY = "codex_creatures_save_v2";

type SaveState = {
  gold: number;
  inventory: Drop[];
  scanCounts: Record<string, number>;
  favoriteIds?: string[];
};

function safeLoad(): SaveState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      gold:       typeof parsed.gold === "number" ? parsed.gold : 0,
      inventory:  Array.isArray(parsed.inventory) ? parsed.inventory : [],
      scanCounts: parsed.scanCounts && typeof parsed.scanCounts === "object" ? parsed.scanCounts : {},
      favoriteIds: Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds : [],
    };
  } catch {
    return null;
  }
}

function safeSave(state: SaveState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export type TabKey = "all" | "creatures" | "weapons" | "armor" | "materials" | "consumables";

export function useGameState() {
  const [gold, setGold]               = useState(0);
  const [inventory, setInventory]     = useState<Drop[]>([]);
  const [scanCounts, setScanCounts]   = useState<Record<string, number>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [lastDrop, setLastDrop]       = useState<Drop | null>(null);
  const [activeTab, setActiveTab]     = useState<TabKey>("all");

  // Sell mode
  const [sellMode, setSellMode]                 = useState(false);
  const [selectedForSale, setSelectedForSale]   = useState<Set<string>>(new Set());
  const [showSellConfirm, setShowSellConfirm]   = useState(false);

  // ── Persistence ──────────────────────────────────────
  useEffect(() => {
    const saved = safeLoad();
    if (!saved) return;
    setGold(saved.gold);
    setInventory(saved.inventory);
    setScanCounts(saved.scanCounts);
    setFavoriteIds(new Set(saved.favoriteIds ?? []));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    safeSave({ gold, inventory, scanCounts, favoriteIds: Array.from(favoriteIds) });
  }, [gold, inventory, scanCounts, favoriteIds]);

  // ── Inventory filters ─────────────────────────────────
  const creaturesOnly   = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "creature"), [inventory]);
  const weaponsOnly     = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "weapon"), [inventory]);
  const armorOnly       = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "armor"), [inventory]);
  const materialsOnly   = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "material"), [inventory]);
  const consumablesOnly = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "consumable"), [inventory]);

  const tabCounts = useMemo(() => ({
    all:         inventory.length,
    creatures:   creaturesOnly.length,
    weapons:     weaponsOnly.length,
    armor:       armorOnly.length,
    materials:   materialsOnly.length,
    consumables: consumablesOnly.length,
  }), [inventory, creaturesOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly]);

  const filteredInventory = useMemo(() => {
    switch (activeTab) {
      case "creatures":   return creaturesOnly;
      case "weapons":     return weaponsOnly;
      case "armor":       return armorOnly;
      case "materials":   return materialsOnly;
      case "consumables": return consumablesOnly;
      default:            return inventory;
    }
  }, [activeTab, inventory, creaturesOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly]);

  // ── Discovery progress ────────────────────────────────
  const discoveredCreatures = useMemo(
    () => new Set(inventory.filter(isCreatureDrop).map((d) => d.name)).size,
    [inventory]
  );
  const discoveredItems = useMemo(
    () => new Set(inventory.filter(isItemDrop).map((d) => d.itemKey ?? d.name)).size,
    [inventory]
  );

  // ── Sell helpers ──────────────────────────────────────
  const sellableInView = useMemo(
    () => filteredInventory.filter((d) => isSellableItem(d) && !favoriteIds.has(d.id)),
    [filteredInventory, favoriteIds]
  );

  const sellTotal = useMemo(() => {
    let total = 0;
    for (const id of selectedForSale) {
      const d = inventory.find((x) => x.id === id);
      if (!d || !isSellableItem(d)) continue;
      total += computeSellGold({
        drop: d as any,
        getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0,
      });
    }
    return total;
  }, [selectedForSale, inventory]);

  const selectedItemsForModal = useMemo(
    () => inventory.filter((d) => selectedForSale.has(d.id)),
    [selectedForSale, inventory]
  );

  // ── Actions ───────────────────────────────────────────
  function addDrop(drop: Drop) {
    setLastDrop(drop);
    setInventory((prev) => [drop, ...prev]);
    if (isRewardDrop(drop)) setGold((g) => g + drop.amount);
  }

  function addGold(amount: number) {
    setGold((g) => g + amount);
  }

  function updateScanCount(code: string, count: number) {
    setScanCounts((prev) => ({ ...prev, [code]: count }));
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSellMode() {
    setSellMode((v) => !v);
    setSelectedForSale(new Set());
  }

  function toggleSelectItem(id: string) {
    setSelectedForSale((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllInView() {
    setSelectedForSale((prev) => {
      const next = new Set(prev);
      sellableInView.forEach((d) => next.add(d.id));
      return next;
    });
  }

  function deselectAll() {
    setSelectedForSale(new Set());
  }

  function confirmSell() {
    setGold((g) => g + sellTotal);
    setInventory((prev) => prev.filter((d) => !selectedForSale.has(d.id)));
    setSelectedForSale(new Set());
    setShowSellConfirm(false);
    setSellMode(false);
  }

  function resetAll() {
    setInventory([]);
    setGold(0);
    setScanCounts({});
    setLastDrop(null);
    setSellMode(false);
    setSelectedForSale(new Set());
  }

  return {
    // State
    gold, inventory, scanCounts, favoriteIds, lastDrop,
    activeTab, setActiveTab,
    sellMode, selectedForSale, showSellConfirm, setShowSellConfirm,
    // Derived
    filteredInventory, tabCounts,
    discoveredCreatures, discoveredItems,
    sellableInView, sellTotal, selectedItemsForModal,
    // Actions
    addDrop, addGold, updateScanCount,
    toggleFavorite, toggleSellMode, toggleSelectItem,
    selectAllInView, deselectAll, confirmSell, resetAll,
  };
}