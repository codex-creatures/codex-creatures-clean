// hooks/useGameState.ts
import { useEffect, useMemo, useState } from "react";
import type { Drop } from "@/lib/types";
import { isRewardDrop, isItemDrop, isCreatureDrop, isCardDrop, isSellableItem } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { computeSellGold } from "@/lib/items/economy/sell";
import { getStatCapForDrop } from "@/lib/items/gameHelpers";
import { clearRegistry } from "@/lib/barcodeRegistry";
import { findCreatureTemplate, KLUTZ } from "@/lib/creatures/creatureData";
import { summonFromCards } from "@/lib/creatures/summon";
import { clearLab } from "@/lib/labyrinth/run";

// Klutz is every player's first creature (and always in the roster).
export const KLUTZ_DROP_ID = "klutz-companion";
function klutzDrop(): Drop {
  return {
    id: KLUTZ_DROP_ID, barcode: "", dropType: "creature", creatureId: KLUTZ.id,
    rarity: KLUTZ.rarity, roll: 0, name: KLUTZ.name, desc: KLUTZ.flavour,
    createdAt: new Date().toISOString(),
  };
}
const hasKlutz = (inv: Drop[]) => inv.some((d) => isCreatureDrop(d) && d.creatureId === KLUTZ.id);

const STORAGE_KEY = "codex_creatures_save_v2";

// What a creature has equipped — inventory drop ids — plus its 4 move slots
// (move names; missing = the creature's default moves).
export type Loadout = { weaponId?: string; armorId?: string; moves?: string[] };
export type EquipSlot = "weapon" | "armor";

type SaveState = {
  gold: number;
  inventory: Drop[];
  scanCounts: Record<string, number>;
  favoriteIds?: string[];
  equipment?: Record<string, Loadout>; // creature drop id → loadout
};

// Also used read-only by the battle screen.
export function loadSave(): SaveState | null {
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
      equipment:  parsed.equipment && typeof parsed.equipment === "object" ? parsed.equipment : {},
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

export type TabKey = "all" | "roster" | "creatures" | "cards" | "weapons" | "armor" | "materials" | "consumables";

export function useGameState(initialTab: TabKey = "all") {
  const [gold, setGold]               = useState(0);
  const [inventory, setInventory]     = useState<Drop[]>([]);
  const [scanCounts, setScanCounts]   = useState<Record<string, number>>({});
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [equipment, setEquipment]     = useState<Record<string, Loadout>>({});
  const [lastDrop, setLastDrop]     = useState<Drop | null>(null);
  const [activeTab, setActiveTab]     = useState<TabKey>(initialTab);

  // Sell mode
  const [sellMode, setSellMode]                 = useState(false);
  const [selectedForSale, setSelectedForSale]   = useState<Set<string>>(new Set());
  const [showSellConfirm, setShowSellConfirm]   = useState(false);

  // ── Persistence ──────────────────────────────────────
  // Don't save until the load has been applied. Otherwise the first save
  // writes the empty initial state, and under StrictMode (dev) the second
  // mount-load then reads that empty save back — wiping progress on refresh.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSave();
    // Everyone has Klutz (added to older saves and new games).
    const inv = saved?.inventory ?? [];
    const favs = new Set(saved?.favoriteIds ?? []);
    if (!hasKlutz(inv)) { inv.unshift(klutzDrop()); favs.add(KLUTZ_DROP_ID); }
    setInventory(inv);
    setFavoriteIds(favs);
    if (saved) {
      setGold(saved.gold);
      setScanCounts(saved.scanCounts);
      setEquipment(saved.equipment ?? {});
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    safeSave({ gold, inventory, scanCounts, favoriteIds: Array.from(favoriteIds), equipment });
  }, [hydrated, gold, inventory, scanCounts, favoriteIds, equipment]);

  // ── Equipment ─────────────────────────────────────────
  // item drop id → creature drop id it's equipped on
  const equippedOn = useMemo(() => {
    const map = new Map<string, string>();
    for (const [creatureId, l] of Object.entries(equipment)) {
      if (l.weaponId) map.set(l.weaponId, creatureId);
      if (l.armorId)  map.set(l.armorId, creatureId);
    }
    return map;
  }, [equipment]);

  // Items that can't be sold: favourited or currently equipped.
  const lockedIds = useMemo(
    () => new Set([...favoriteIds, ...equippedOn.keys()]),
    [favoriteIds, equippedOn]
  );

  // ── Inventory filters ─────────────────────────────────
  const creaturesOnly   = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "creature"), [inventory]);
  const weaponsOnly     = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "weapon"), [inventory]);
  const armorOnly       = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "armor"), [inventory]);
  const materialsOnly   = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "material"), [inventory]);
  const consumablesOnly = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "consumable"), [inventory]);
  const cardsOnly       = useMemo(() => inventory.filter(isCardDrop), [inventory]);
  // Roster = favourited creatures.
  const rosterOnly      = useMemo(() => creaturesOnly.filter((d) => favoriteIds.has(d.id)), [creaturesOnly, favoriteIds]);

  const tabCounts = useMemo(() => ({
    all:         inventory.length,
    roster:      rosterOnly.length,
    creatures:   creaturesOnly.length,
    cards:       cardsOnly.length,
    weapons:     weaponsOnly.length,
    armor:       armorOnly.length,
    materials:   materialsOnly.length,
    consumables: consumablesOnly.length,
  }), [inventory, rosterOnly, creaturesOnly, cardsOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly]);

  const filteredInventory = useMemo(() => {
    switch (activeTab) {
      case "roster":      return rosterOnly;
      case "creatures":   return creaturesOnly;
      case "cards":       return cardsOnly;
      case "weapons":     return weaponsOnly;
      case "armor":       return armorOnly;
      case "materials":   return materialsOnly;
      case "consumables": return consumablesOnly;
      default:            return inventory;
    }
  }, [activeTab, inventory, rosterOnly, creaturesOnly, cardsOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly]);

  // ── Discovery progress ────────────────────────────────
  const discoveredCreatures = useMemo(
    // Creatures and cards both count as discovered; companions (Klutz) don't.
    // Older saves stored names instead of ids.
    () => new Set(
      inventory.filter((d) => isCreatureDrop(d) || isCardDrop(d))
        .map((d) => findCreatureTemplate((d as CreatureOrItemDrop).creatureId, (d as CreatureOrItemDrop).name))
        .filter((t) => t && !t.companion)
        .map((t) => t!.id)
    ).size,
    [inventory]
  );
  const discoveredItems = useMemo(
    // Only weapons/armour count — TOTAL_ITEMS doesn't include materials/consumables.
    () => new Set(inventory.filter(isSellableItem).map((d) => d.itemKey ?? d.armorKey ?? d.name)).size,
    [inventory]
  );

  // ── Sell helpers ──────────────────────────────────────
  const sellableInView = useMemo(
    () => filteredInventory.filter((d) => isSellableItem(d) && !lockedIds.has(d.id)),
    [filteredInventory, lockedIds]
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

  // Gold that isn't a drop (labyrinth rewards, entry fees). spendGold
  // returns false (and spends nothing) if you can't afford it.
  function addGold(amount: number) {
    setGold((g) => g + amount);
  }
  function spendGold(amount: number): boolean {
    if (gold < amount) return false;
    setGold((g) => g - amount);
    return true;
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

  // Put an item on a creature (itemId = null to unequip). An item can only be
  // on one creature, so equipping it here removes it from anyone else.
  function equipItem(creatureId: string, slot: EquipSlot, itemId: string | null) {
    const key = slot === "weapon" ? "weaponId" : "armorId";
    setEquipment((prev) => {
      const next: Record<string, Loadout> = {};
      for (const [cid, l] of Object.entries(prev)) {
        next[cid] = itemId && l[key] === itemId ? { ...l, [key]: undefined } : l;
      }
      next[creatureId] = { ...next[creatureId], [key]: itemId ?? undefined };
      return next;
    });
  }

  function setMoves(creatureId: string, moves: string[]) {
    setEquipment((prev) => ({ ...prev, [creatureId]: { ...prev[creatureId], moves } }));
  }

  // Three cards of one creature → that creature. keepId = the card to keep
  // ("choose"), or null for a fresh random roll. Returns the new creature.
  function summon(cardIds: string[], keepId: string | null): CreatureOrItemDrop {
    const cards = inventory.filter((d) => cardIds.includes(d.id)) as CreatureOrItemDrop[];
    const creature = summonFromCards(cards, keepId);
    setInventory((prev) => [creature, ...prev.filter((d) => !cardIds.includes(d.id))]);
    setLastDrop(creature);
    return creature;
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

  // "New player": wipes this player's progress but keeps the barcode
  // registry — rescanning a known barcode acts like a friend scanning it.
  function resetAll() {
    clearLab();
    setInventory([klutzDrop()]);
    setGold(0);
    setScanCounts({});
    setFavoriteIds(new Set([KLUTZ_DROP_ID]));
    setEquipment({});
    setLastDrop(null);
    setSellMode(false);
    setSelectedForSale(new Set());
  }

  // "Global reset": every barcode rolls fresh again, and previously scanned
  // barcodes count as new. Players keep what they already own.
  function globalReset() {
    clearRegistry();
    setScanCounts({});
  }

  return {
    // State
    gold, inventory, scanCounts, favoriteIds, equipment, lastDrop,
    activeTab, setActiveTab,
    sellMode, selectedForSale, showSellConfirm, setShowSellConfirm,
    // Derived
    filteredInventory, tabCounts, equippedOn, lockedIds,
    weaponsOnly, armorOnly,
    discoveredCreatures, discoveredItems,
    sellableInView, sellTotal, selectedItemsForModal,
    // Actions
    addDrop, addGold, spendGold, updateScanCount, hydrated,
    toggleFavorite, equipItem, setMoves, summon, toggleSellMode, toggleSelectItem,
    selectAllInView, deselectAll, confirmSell, resetAll, globalReset,
  };
}