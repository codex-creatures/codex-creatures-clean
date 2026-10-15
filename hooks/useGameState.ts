// hooks/useGameState.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Drop } from "@/lib/types";
import { ARMOR_SLOTS, type ArmorSlot } from "@/lib/items/armor";
import { isRewardDrop, isItemDrop, isCreatureDrop, isCardDrop, isSellableItem } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { computeSellGold } from "@/lib/items/economy/sell";
import { getStatCapForDrop } from "@/lib/items/gameHelpers";
import { clearRegistry } from "@/lib/barcodeRegistry";
import { clearBattles } from "@/lib/battleHistory";
import { findCreatureTemplate, KLUTZ, CREATURE_TEMPLATES, CREATURES_BY_RARITY } from "@/lib/creatures/creatureData";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { summonFromCards } from "@/lib/creatures/summon";
import { clearDungeon } from "@/lib/dungeon/run";
import { collectKlutz, sendKlutz as sendKlutzOut, type KlutzState } from "@/lib/klutz";
import { NEW_QUEST, type QuestState } from "@/lib/quest";
import { fighterFor } from "@/lib/creatures/instance";

// Klutz is your helper, not one of your creatures (lib/klutz.ts). This
// stand-in drop is what his gear and moves are stored under (equipment
// keyed by KLUTZ_DROP_ID) and what the creature window shows for him.
export const KLUTZ_DROP_ID = "klutz-companion";
export function klutzDrop(): CreatureOrItemDrop {
  return {
    id: KLUTZ_DROP_ID, barcode: "", dropType: "creature", creatureId: KLUTZ.id,
    rarity: KLUTZ.rarity, roll: 0, name: KLUTZ.name, desc: KLUTZ.flavour,
    createdAt: new Date().toISOString(),
  };
}
const isKlutz = (d: Drop) => isCreatureDrop(d) && d.creatureId === KLUTZ.id;

const STORAGE_KEY = "codex_creatures_save_v2";
export const RECENT_SCANS = 10; // how many recent scan drops the altar remembers

// What a creature has equipped — inventory drop ids — plus its 4 move slots
// (move names; missing = the creature's default moves).
export type Loadout = { weaponId?: string; helmetId?: string; chestId?: string; legsId?: string; moves?: string[] };
export type EquipSlot = "weapon" | ArmorSlot;

// Where each slot's item id lives in a loadout.
export const SLOT_FIELD: Record<EquipSlot, "weaponId" | "helmetId" | "chestId" | "legsId"> = {
  weapon: "weaponId", helmet: "helmetId", chest: "chestId", legs: "legsId",
};
export const EQUIP_SLOTS: EquipSlot[] = ["weapon", ...ARMOR_SLOTS];

// The armour pieces in a loadout (helmet, chest, legs), looked up by id.
export function armorPieces<T>(l: Loadout | undefined, find: (id: string) => T | undefined): (T | undefined)[] {
  return ARMOR_SLOTS.map((s) => { const id = l?.[SLOT_FIELD[s]]; return id ? find(id) : undefined; });
}

type SaveState = {
  gold: number;
  inventory: Drop[];
  scanCounts: Record<string, number>;
  favoriteIds?: string[];
  equipment?: Record<string, Loadout>; // creature drop id → loadout
  recentScans?: string[];              // drop ids of your last scans, newest first
  caged?: Drop[];                      // creatures waiting in the Den's cage (tap to free them)
  klutz?: KlutzState;                  // your helper: his health and any expedition
  quest?: QuestState;                  // the first quest (lib/quest.ts)
  seen?: string[];                     // creature ids you've come across (the Bestiary fills in as you explore)
};

// A new player's first creature: a random Rare, waiting in the cage.
export function starterCreature(): Drop {
  const pool = CREATURES_BY_RARITY.rare;
  const t = pool[Math.floor(Math.random() * pool.length)];
  return makeCreatureDrop(t, "creature", "");
}

// Also used read-only by the battle and dungeon screens.
export function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {}
  // Klutz used to be one of your creatures; older saves drop him (his gear
  // stays on him: it's stored under KLUTZ_DROP_ID).
  const inventory: Drop[] = (Array.isArray(parsed.inventory) ? parsed.inventory : []).filter((d: Drop) => !isKlutz(d));
  const favoriteIds: string[] = (Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds : []).filter((id: string) => id !== KLUTZ_DROP_ID);
  // Creatures and cards show their species' current rarity (some species
  // changed tier when races arrived).
  for (const d of inventory) {
    if (!isCreatureDrop(d) && !isCardDrop(d)) continue;
    const t = findCreatureTemplate((d as CreatureOrItemDrop).creatureId, (d as CreatureOrItemDrop).name);
    if (t) (d as CreatureOrItemDrop).rarity = t.rarity;
  }
  const obj = (v: unknown) => (v && typeof v === "object" ? v : {});
  return {
    gold:       typeof parsed.gold === "number" ? parsed.gold : 0,
    inventory,
    scanCounts: obj(parsed.scanCounts) as Record<string, number>,
    favoriteIds,
    equipment:  obj(parsed.equipment) as Record<string, Loadout>,
    recentScans: Array.isArray(parsed.recentScans) ? parsed.recentScans : [],
    // A save from before the cage gets the starter waiting in it once.
    caged: Array.isArray(parsed.caged) ? parsed.caged : [starterCreature()],
    klutz: obj(parsed.klutz) as KlutzState,
    quest: parsed.quest && typeof parsed.quest === "object" ? (parsed.quest as QuestState) : { ...NEW_QUEST },
    seen: Array.isArray(parsed.seen) ? parsed.seen : [],
  };
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
  const [recentScanIds, setRecentScanIds] = useState<string[]>([]);
  const [caged, setCaged]             = useState<Drop[]>([]);
  const [klutz, setKlutz]             = useState<KlutzState>({});
  const [quest, setQuest]             = useState<QuestState>({ ...NEW_QUEST });
  const [seen, setSeen]               = useState<string[]>([]);
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
    const saved = loadSave(); // includes Klutz
    setInventory(saved?.inventory ?? []);
    setFavoriteIds(new Set(saved?.favoriteIds ?? []));
    if (saved) {
      setGold(saved.gold);
      setScanCounts(saved.scanCounts);
      setEquipment(saved.equipment ?? {});
      setRecentScanIds(saved.recentScans ?? []);
      setCaged(saved.caged ?? []);
      setKlutz(saved.klutz ?? {});
      setQuest(saved.quest ?? { ...NEW_QUEST });
      setSeen(saved.seen ?? []);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    safeSave({ gold, inventory, scanCounts, favoriteIds: Array.from(favoriteIds), equipment, recentScans: recentScanIds, caged, klutz, quest, seen });
  }, [hydrated, gold, inventory, scanCounts, favoriteIds, equipment, recentScanIds, caged, klutz, quest, seen]);

  // ── The Bestiary: creatures you've come across ────────
  // Anything you own (or hold a card of) or have waiting in the cage counts,
  // plus anything you've met in the Labyrinth or Klutz has run into.
  function markSeen(ids: string[]) {
    setSeen((prev) => (ids.every((id) => prev.includes(id)) ? prev : [...new Set([...prev, ...ids])]));
  }
  const seenIds = useMemo(() => new Set<string>([
    ...seen,
    ...[...inventory, ...caged].flatMap((d) => (d.dropType === "creature" || d.dropType === "card") && (d as CreatureOrItemDrop).creatureId ? [(d as CreatureOrItemDrop).creatureId!] : []),
  ]), [seen, inventory, caged]);

  // ── The first quest (Klutz's box) ─────────────────────
  const acceptQuest = () => setQuest((q) => (q.stage === "start" ? { ...q, stage: "hunt" } : q));
  const questFoundClub = () => setQuest((q) => ({ ...q, stage: q.stage === "start" ? "hunt" : q.stage, clubFound: true }));
  const questBoxFound = (box: Drop[]) => setQuest((q) => ({ ...q, stage: "boxFound", box }));
  // Klutz puts what was in the box into your storage.
  function handOverBox() {
    const box = quest.box ?? [];
    if (quest.stage !== "boxFound") return;
    setInventory((prev) => [...box, ...prev]);
    setQuest({ stage: "done", clubFound: true });
  }

  // ── Klutz ─────────────────────────────────────────────
  // What he fights as: his template with the gear and moves set on him.
  const klutzFighter = useMemo(() => {
    const l = equipment[KLUTZ_DROP_ID];
    const byId = new Map(inventory.map((d) => [d.id, d as CreatureOrItemDrop]));
    const w = l?.weaponId ? byId.get(l.weaponId) : undefined;
    return fighterFor(klutzDrop(), KLUTZ, w?.stats, armorPieces(l, (id) => byId.get(id)), l?.moves, w?.itemKey);
  }, [equipment, inventory]);

  // While Klutz is out, the gear he's wearing goes with him: nobody can take
  // it off him (or put anything on him) until he's back.
  const klutzAwayItems = useMemo(() => {
    const ex = klutz.expedition;
    if (!ex || ex.collected) return new Set<string>(); // (collected within seconds of him getting back)
    const l = equipment[KLUTZ_DROP_ID];
    return new Set([l?.weaponId, l?.helmetId, l?.chestId, l?.legsId].filter((x): x is string => !!x));
  }, [klutz, equipment]);
  const klutzIsAway = () => { const ex = klutz.expedition; return !!ex && !ex.collected && Date.now() < ex.endsAt; };

  function sendKlutzOff() {
    // What he's wearing decides what he might find.
    const l = equipment[KLUTZ_DROP_ID];
    const byId = new Map(inventory.map((d) => [d.id, d as CreatureOrItemDrop]));
    const worn = EQUIP_SLOTS.flatMap((slot) => {
      const it = l?.[SLOT_FIELD[slot]] ? byId.get(l[SLOT_FIELD[slot]]!) : undefined;
      return it ? [{ slot, rarity: it.rarity }] : [];
    });
    setKlutz((k) => sendKlutzOut(k, klutzFighter, Date.now(), Math.random, worn));
  }

  // Testing: skip to the end of his expedition, or heal him at once.
  function klutzSkipAhead() {
    setKlutz((k) => {
      const ex = k.expedition;
      if (ex && !ex.collected && Date.now() < ex.endsAt) {
        const by = ex.endsAt - Date.now() + 1;
        return { ...k, expedition: { ...ex, startedAt: ex.startedAt - by, endsAt: ex.endsAt - by, encounters: ex.encounters.map((e) => ({ ...e, at: e.at - by })) } };
      }
      return { ...k, hp: undefined, hpAt: undefined };
    });
  }

  // When an expedition is over, hand over what he caught: creatures to the
  // cage, their gear to your inventory. Checked every few seconds.
  const klutzRef = useRef(klutz);
  useEffect(() => { klutzRef.current = klutz; }, [klutz]);
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const { state, loot } = collectKlutz(klutzRef.current);
      if (state === klutzRef.current) return;
      klutzRef.current = state; // so a second check before the re-render can't collect twice
      setKlutz(state);
      const met = (state.expedition?.encounters ?? []).map((e) => e.creatureId);
      if (met.length) setSeen((prev) => [...new Set([...prev, ...met])]);
      setCaged((prev) => [...prev, ...loot.filter(isCreatureDrop)]);
      setInventory((prev) => [...loot.filter((d) => !isCreatureDrop(d)), ...prev]);
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  // ── The cage ──────────────────────────────────────────
  // Free a caged creature: it joins your creatures (and your roster).
  function releaseCaged(id: string) {
    const d = caged.find((c) => c.id === id);
    if (!d) return;
    setCaged((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => [d, ...prev]);
    setFavoriteIds((prev) => new Set([...prev, d.id]));
  }

  // ── Equipment ─────────────────────────────────────────
  // item drop id → creature drop id it's equipped on
  const equippedOn = useMemo(() => {
    const map = new Map<string, string>();
    for (const [creatureId, l] of Object.entries(equipment)) {
      for (const s of EQUIP_SLOTS) { const id = l[SLOT_FIELD[s]]; if (id) map.set(id, creatureId); }
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

  // Your last scans that you still have (sold or summoned ones drop out).
  const recentScans = useMemo(() => {
    const byId = new Map(inventory.map((d) => [d.id, d]));
    return recentScanIds.map((id) => byId.get(id)).filter((d): d is Drop => !!d);
  }, [inventory, recentScanIds]);

  // Every barcode scan you've made (repeats of the same barcode included).
  const totalScans = useMemo(() => Object.values(scanCounts).reduce((n, c) => n + c, 0), [scanCounts]);

  // ── Discovery progress ────────────────────────────────
  const discoveredCreatures = useMemo(
    // Creatures and cards both count as discovered; companions (Klutz) and
    // retired species don't.
    // Older saves stored names instead of ids.
    () => new Set(
      inventory.filter((d) => isCreatureDrop(d) || isCardDrop(d))
        .map((d) => findCreatureTemplate((d as CreatureOrItemDrop).creatureId, (d as CreatureOrItemDrop).name))
        .filter((t) => t && CREATURE_TEMPLATES.includes(t))
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

  // A drop from scanning a barcode: added, and remembered in your recent scans.
  function addScan(drop: Drop) {
    addDrop(drop);
    setRecentScanIds((prev) => [drop.id, ...prev.filter((id) => id !== drop.id)].slice(0, RECENT_SCANS));
  }

  // Gold that isn't a drop (dungeon rewards, entry fees). spendGold
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
    const key = SLOT_FIELD[slot];
    // Klutz's gear is in the Labyrinth with him.
    if (klutzIsAway() && (creatureId === KLUTZ_DROP_ID || (itemId && klutzAwayItems.has(itemId)))) return;
    setEquipment((prev) => {
      const next: Record<string, Loadout> = {};
      for (const [cid, l] of Object.entries(prev)) {
        next[cid] = itemId && l[key] === itemId ? { ...l, [key]: undefined } : l;
      }
      next[creatureId] = { ...next[creatureId], [key]: itemId ?? undefined };
      return next;
    });
  }

  // An item leaves your storage (e.g. left behind on a Labyrinth floor).
  function removeDrop(id: string) {
    setInventory((prev) => prev.filter((d) => d.id !== id));
    setFavoriteIds((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
  }

  function setMoves(creatureId: string, moves: string[]) {
    setEquipment((prev) => ({ ...prev, [creatureId]: { ...prev[creatureId], moves } }));
  }

  // Read a codex: the creature learns its race move for good, and the codex is used up.
  function learnCodex(creatureId: string, codexId: string) {
    const codex = inventory.find((d) => d.id === codexId) as CreatureOrItemDrop | undefined;
    const move = codex?.codexMove;
    if (!move) return;
    setInventory((prev) => prev.filter((d) => d.id !== codexId).map((d) =>
      d.id === creatureId ? { ...d, learned: [...new Set([...((d as CreatureOrItemDrop).learned ?? []), move])] } : d));
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
    clearDungeon();
    setInventory([]);
    setGold(0);
    setScanCounts({});
    setFavoriteIds(new Set());
    setKlutz({});
    setQuest({ ...NEW_QUEST });
    setSeen([]);
    setEquipment({});
    setRecentScanIds([]);
    setCaged([starterCreature()]);
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

  // A brand-new game, as if you'd never played: your progress, the
  // Labyrinth, Klutz, the quest, your battle history, and the barcode
  // registry (so every barcode rolls fresh on its next scan).
  function startNew() {
    resetAll();
    globalReset();
    clearBattles();
  }

  return {
    // State
    gold, inventory, scanCounts, totalScans, favoriteIds, equipment, lastDrop, recentScans, caged, klutz, klutzFighter, klutzAwayItems, quest, seenIds,
    activeTab, setActiveTab,
    sellMode, selectedForSale, showSellConfirm, setShowSellConfirm,
    // Derived
    filteredInventory, tabCounts, equippedOn, lockedIds,
    weaponsOnly, armorOnly,
    discoveredCreatures, discoveredItems,
    sellableInView, sellTotal, selectedItemsForModal,
    // Actions
    addDrop, addScan, addGold, spendGold, updateScanCount, hydrated,
    toggleFavorite, equipItem, setMoves, learnCodex, summon, toggleSellMode, toggleSelectItem,
    selectAllInView, deselectAll, confirmSell, resetAll, globalReset, startNew, releaseCaged, sendKlutzOff, klutzSkipAhead, acceptQuest, questFoundClub, questBoxFound, handOverBox, removeDrop, markSeen,
  };
}