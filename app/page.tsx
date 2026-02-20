"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { rollItemStats } from "../lib/items/rollItemStats";
import type { ItemKey } from "../lib/items/ceilings";
import { ITEM_CEILINGS, ITEM_KEYS } from "../lib/items/ceilings";
import { RARITY_BUDGETS, RARITY_WEIGHTS } from "../lib/items/budgets";
import { ITEM_META } from "../lib/items/metadata";
import { ARMOR_KEYS, ARMOR_CEILINGS, ARMOR_META, type ArmorKey } from "../lib/items/armor";
import { rollArmorStats } from "../lib/items/rollArmorStats";
import { computeSellGold } from "@/lib/items/economy/sell";

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
      gold: typeof parsed.gold === "number" ? parsed.gold : 0,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      scanCounts:
        parsed.scanCounts && typeof parsed.scanCounts === "object"
          ? parsed.scanCounts
          : {},
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

/* =====================
   TYPES
===================== */

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type ItemCategory = "weapon" | "armor" | "material" | "consumable";
type DropType = "creature" | "item" | "reward";
type RewardKind = "resource";

const RARITY_COLORS: Record<Rarity, { text: string; border: string; glow: string }> = {
  common:    { text: "#9CA3AF", border: "rgba(156,163,175,0.35)", glow: "rgba(156,163,175,0.12)" },
  uncommon:  { text: "#22C55E", border: "rgba(34,197,94,0.35)",   glow: "rgba(34,197,94,0.15)"  },
  rare:      { text: "#4EA1FF", border: "rgba(78,161,255,0.45)",  glow: "rgba(78,161,255,0.18)" },
  epic:      { text: "#BB86FF", border: "rgba(184,107,255,0.45)", glow: "rgba(184,107,255,0.18)"},
  legendary: { text: "#FFCC4D", border: "rgba(255,204,77,0.55)",  glow: "rgba(255,204,77,0.22)" },
};

type CreatureOrItemDrop = {
  id: string;
  barcode: string;
  dropType: "creature" | "item";
  rarity: Rarity;
  roll: number;
  name: string;
  itemCategory?: ItemCategory;
  itemKey?: ItemKey;
  armorKey?: ArmorKey;
  stats?: {
    melee?: number;
    ranged?: number;
    mDef?: number;
    rDef?: number;
    agility?: number;
    hp?: number;
  };
  desc?: string;
  createdAt: string;
};

type RewardDrop = {
  id: string;
  barcode: string;
  dropType: "reward";
  rewardKind: RewardKind;
  amount: number;
  createdAt: string;
};

type Drop = CreatureOrItemDrop | RewardDrop;

/* =====================
   HELPERS
===================== */

function randomRoll() { return Math.floor(Math.random() * 100) + 1; }

function rarityFromRoll(roll: number): Rarity {
  if (roll >= 95) return "legendary";
  if (roll >= 80) return "epic";
  if (roll >= 60) return "rare";
  return "common";
}

function isRewardDrop(d: Drop): d is RewardDrop { return d.dropType === "reward"; }
function isCreatureOrItemDrop(d: Drop): d is CreatureOrItemDrop { return d.dropType === "creature" || d.dropType === "item"; }
function isCreatureDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "creature" } { return d.dropType === "creature"; }
function isItemDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "item" } { return d.dropType === "item"; }

function isSellableItem(d: Drop): d is CreatureOrItemDrop & { dropType: "item" } {
  return isItemDrop(d) && (d.itemCategory === "weapon" || d.itemCategory === "armor");
}

function pickArmorKey(code: string, rollMode: "random" | "deterministic"): ArmorKey {
  const idx =
    rollMode === "deterministic"
      ? deterministicRoll(`${code}:armorKey`) % ARMOR_KEYS.length
      : Math.floor(Math.random() * ARMOR_KEYS.length);
  return ARMOR_KEYS[idx];
}

function getStatCapForDrop(d: any, stat: string): number | null {
  if (d.dropType !== "item") return null;
  if (d.itemCategory === "weapon") {
    const ceilings = ITEM_CEILINGS[d.itemKey as ItemKey];
    if (!ceilings) return null;
    const rarityCeilings = ceilings[d.rarity as Rarity];
    if (!rarityCeilings) return null;
    return (rarityCeilings as any)[stat] ?? null;
  }
  if (d.itemCategory === "armor") {
    const ceilings = ARMOR_CEILINGS[d.armorKey as ArmorKey];
    if (!ceilings) return null;
    const rarityCeilings = ceilings[d.rarity as Rarity];
    if (!rarityCeilings) return null;
    return (rarityCeilings as any)[stat] ?? null;
  }
  return null;
}

/* =====================
   CREATURE / ITEM POOLS
===================== */

const CREATURES_BY_RARITY: Record<Rarity, string[]> = {
  common:    ["Forest Slime", "Cave Bat", "Rust Beetle"],
  uncommon:  ["Stone Toad", "Moss Wolf", "Amber Wasp"],
  rare:      ["Dire Wolf", "Crystal Golem"],
  epic:      ["Void Serpent", "Storm Phoenix"],
  legendary: ["Ancient Dragon"],
};

function pickCreatureName(rarity: Rarity, barcode: string, rollMode: "random" | "deterministic") {
  const pool = CREATURES_BY_RARITY[rarity];
  const index =
    rollMode === "deterministic"
      ? deterministicRoll(`${barcode}:creature:${rarity}`) % pool.length
      : Math.floor(Math.random() * pool.length);
  return pool[index];
}

const TOTAL_CREATURES = Object.values(CREATURES_BY_RARITY).flat().length;
const TOTAL_WEAPONS   = ITEM_KEYS.length;
const TOTAL_ARMOR     = Object.keys(ARMOR_CEILINGS).length;
const TOTAL_ITEMS     = TOTAL_WEAPONS + TOTAL_ARMOR;

function deterministicRoll(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) + 1;
}

function pickRarity(barcode: string, rollMode: "random" | "deterministic"): Rarity {
  const entries = Object.entries(RARITY_WEIGHTS) as Array<[Rarity, number]>;
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  const r =
    rollMode === "deterministic"
      ? (deterministicRoll(`${barcode}:rarity`) % total) + 1
      : Math.floor(Math.random() * total) + 1;
  let cumulative = 0;
  for (const [rarity, weight] of entries) {
    cumulative += weight;
    if (r <= cumulative) return rarity;
  }
  return "common";
}

function pickItemCategory(code: string, rollMode: "random" | "deterministic"): ItemCategory {
  const categories: ItemCategory[] = ["weapon", "armor", "material", "consumable"];
  if (rollMode === "deterministic") {
    return categories[deterministicRoll(`${code}:itemCategory`) % categories.length];
  }
  return categories[Math.floor(Math.random() * categories.length)];
}

/* =====================
   SELL MODE COMPONENTS
===================== */

function SellConfirmModal({
  items,
  totalGold,
  onConfirm,
  onCancel,
}: {
  items: Drop[];
  totalGold: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#1a1a2e",
          border: "1px solid rgba(255,80,80,0.4)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
        }}
      >
        <h3 style={{ margin: "0 0 12px", color: "#ff5050" }}>Confirm Sale</h3>
        <p style={{ margin: "0 0 16px", opacity: 0.85, fontSize: 14 }}>
          You are about to sell <strong>{items.length}</strong>{" "}
          {items.length === 1 ? "item" : "items"} for{" "}
          <strong style={{ color: "#f5c542" }}>+{totalGold}g</strong>.
        </p>

        {/* Item list preview */}
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            marginBottom: 20,
            fontSize: 13,
            opacity: 0.8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {items.map((d) => {
            if (!isCreatureOrItemDrop(d)) return null;
            const sellVal = computeSellGold({
              drop: d as any,
              getStatCapForDrop: (drop: any, statKey: string) =>
                getStatCapForDrop(drop, statKey) ?? 0,
            });
            const rarityColor =
              isItemDrop(d) ? RARITY_COLORS[d.rarity]?.text ?? "white" : "white";
            return (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 8px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 6,
                }}
              >
                <span style={{ color: rarityColor }}>{d.name}</span>
                <span style={{ color: "#f5c542" }}>+{sellVal}g</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: "#ff5050",
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Sell & Collect {totalGold}g
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "white",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* =====================
   PAGE
===================== */

export default function Home() {
  const [barcode, setBarcode]                   = useState("");
  const [rollMode, setRollMode]                 = useState<"random" | "deterministic">("random");
  const [inventory, setInventory]               = useState<Drop[]>([]);
  const [openInventoryItemId, setOpenInventoryItemId] = useState<string | null>(null);
  const videoRef                                = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef                         = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef                          = useRef(false);
  const [scannerOn, setScannerOn]               = useState(false);
  const [scanStatus, setScanStatus]             = useState("");

  type TabKey = "all" | "creatures" | "weapons" | "armor" | "materials" | "consumables";
  const [activeTab, setActiveTab]               = useState<TabKey>("all");

  const [pendingDrop, setPendingDrop]           = useState<Drop | null>(null);
  const [lastDrop, setLastDrop]                 = useState<Drop | null>(null);
  const [isLastDropOpen, setIsLastDropOpen]     = useState(false);
  const [gold, setGold]                         = useState<number>(0);
  const [favoriteIds, setFavoriteIds]           = useState<Set<string>>(new Set());
  const [scanCounts, setScanCounts]             = useState<Record<string, number>>({});

  // ── SELL MODE STATE ──────────────────────────
  const [sellMode, setSellMode]                 = useState(false);
  const [selectedForSale, setSelectedForSale]   = useState<Set<string>>(new Set());
  const [showSellConfirm, setShowSellConfirm]   = useState(false);

  /* ── PERSISTENCE ── */
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

  /* ── INVENTORY FILTERS ── */
  const creaturesOnly  = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "creature"), [inventory]);
  const weaponsOnly    = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "weapon"), [inventory]);
  const armorOnly      = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "armor"), [inventory]);
  const materialsOnly  = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "material"), [inventory]);
  const consumablesOnly= useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "consumable"), [inventory]);

  const tabCounts = useMemo(() => ({
    all:        inventory.length,
    creatures:  creaturesOnly.length,
    weapons:    weaponsOnly.length,
    armor:      armorOnly.length,
    materials:  materialsOnly.length,
    consumables:consumablesOnly.length,
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

  /* ── DISCOVERY PROGRESS ── */
  const displayInventory = useMemo(() => {
    if (!pendingDrop) return inventory;
    return [pendingDrop, ...inventory];
  }, [pendingDrop, inventory]);

  const discoveredCreatures = useMemo(() => new Set(displayInventory.filter(isCreatureDrop).map((d) => d.name)).size, [displayInventory]);
  const discoveredItems     = useMemo(() => new Set(displayInventory.filter(isItemDrop).map((d) => d.itemKey ?? d.name)).size, [displayInventory]);
  const creaturePct = TOTAL_CREATURES === 0 ? 0 : Math.round((discoveredCreatures / TOTAL_CREATURES) * 100);
  const itemPct     = Math.round((discoveredItems / TOTAL_ITEMS) * 100);

  const isValidBarcode = useMemo(() => /^[0-9]{6,20}$/.test(barcode.trim()), [barcode]);

  /* ── SELL MODE HELPERS ── */
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

  function toggleSellMode() {
    setSellMode((v) => !v);
    setSelectedForSale(new Set());
  }

  function toggleSelectItem(id: string) {
    setSelectedForSale((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInView() {
    setSelectedForSale((prev) => {
      const next = new Set(prev);
      for (const d of sellableInView) next.add(d.id);
      return next;
    });
  }

  function deselectAll() {
    setSelectedForSale(new Set());
  }

  function confirmSell() {
    // Award gold
    setGold((g) => g + sellTotal);
    // Remove sold items from inventory
    setInventory((prev) => prev.filter((d) => !selectedForSale.has(d.id)));
    // Cleanup
    setSelectedForSale(new Set());
    setShowSellConfirm(false);
    setSellMode(false);
  }

  /* ── SCANNER ── */
  useEffect(() => {
    if (!scannerOn || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    setScanStatus("Starting camera...");
    let stopped = false;
    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result: any) => {
            if (!result || stopped) return;
            if (scanHandledRef.current) return;
            scanHandledRef.current = true;
            const raw    = result.getText();
            const digits = raw.replace(/\D/g, "");
            if (digits.length >= 6 && digits.length <= 20) {
              setScanStatus(`Scanned: ${digits}`);
              setBarcode(digits);
              controls.stop();
              setScannerOn(false);
              setTimeout(() => generateDrop(digits), 0);
            } else {
              scanHandledRef.current = false;
            }
          }
        );
        scanControlsRef.current = controls;
        setScanStatus("Point camera at barcode...");
      } catch {
        setScanStatus("Camera error (check permissions).");
        setScannerOn(false);
      }
    })();
    return () => {
      stopped = true;
      scanControlsRef.current?.stop();
      scanControlsRef.current = null;
    };
  }, [scannerOn]);

  function resetAll() {
    setInventory([]);
    setGold(0);
    setScanCounts({});
    setLastDrop(null);
    setIsLastDropOpen(false);
    setPendingDrop(null);
    setSellMode(false);
    setSelectedForSale(new Set());
  }

  /* ── DROP GENERATION ── */
  function generateDrop(codeOverride?: string) {
    const code = (codeOverride ?? barcode).trim();
    if (!/^[0-9]{6,20}$/.test(code)) return;
    setPendingDrop(null);
    const alreadyScanned = scanCounts[code] ?? 0;
    setScanCounts((prev) => ({ ...prev, [code]: alreadyScanned + 1 }));

    if (rollMode === "deterministic" && alreadyScanned >= 1) {
      const tier = alreadyScanned === 1 ? "mid" : "low";
      const REWARD_RULES = { mid: { min: 25, max: 50 }, low: { min: 1, max: 25 } } as const;
      const { min, max } = tier === "mid" ? REWARD_RULES.mid : REWARD_RULES.low;
      const range = max - min + 1;
      const amount =
        alreadyScanned === 1
          ? min + (deterministicRoll(`${code}:reward:${tier}`) % range)
          : min + Math.floor(Math.random() * range);
      setGold((g) => g + amount);
      const drop: Drop = { id: crypto.randomUUID(), barcode: code, dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() };
      setLastDrop(drop);
      setInventory((prev) => [{ ...drop }, ...prev]);
      return;
    }

    const outcomeRoll =
      rollMode === "deterministic"
        ? (deterministicRoll(`${code}:outcome`) % 100) + 1
        : Math.floor(Math.random() * 100) + 1;
    const outcome: "creature" | "item" | "gold" =
      outcomeRoll <= 20 ? "creature" : outcomeRoll <= 80 ? "item" : "gold";

    if (outcome === "gold") {
      const amount =
        rollMode === "deterministic"
          ? 50 + (deterministicRoll(`${code}:gold`) % 101)
          : 50 + Math.floor(Math.random() * 101);
      setGold((g) => g + amount);
      const drop: Drop = { id: crypto.randomUUID(), barcode: code, dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() };
      setLastDrop(drop);
      setInventory((prev) => [{ ...drop }, ...prev]);
      return;
    }

    if (outcome === "creature") {
      const roll   = rollMode === "deterministic" ? deterministicRoll(code) : randomRoll();
      const rarity = rarityFromRoll(roll);
      const name   = pickCreatureName(rarity, code, rollMode);
      const drop: Drop = { id: crypto.randomUUID(), barcode: code, dropType: "creature", rarity, roll, name, createdAt: new Date().toISOString() };
      setLastDrop(drop);
      setInventory((prev) => [{ ...drop }, ...prev]);
      return;
    }

    if (outcome === "item") {
      const itemCategory = pickItemCategory(code, rollMode);
      const rarity       = pickRarity(code, rollMode);

      if (itemCategory === "weapon") {
        const idx     = rollMode === "deterministic" ? deterministicRoll(`${code}:itemKey`) % ITEM_KEYS.length : Math.floor(Math.random() * ITEM_KEYS.length);
        const itemKey = ITEM_KEYS[idx] as ItemKey;
        const rolledStats = rollItemStats(itemKey, rarity, Math.random);
        const meta    = ITEM_META[itemKey];
        const drop: Drop = {
          id: crypto.randomUUID(), barcode: code, dropType: "item", itemCategory: "weapon",
          itemKey, rarity,
          roll: rollMode === "deterministic" ? deterministicRoll(`${code}:item`) : Math.floor(Math.random() * 100),
          name: meta?.name ?? itemKey, desc: meta?.desc ?? "", stats: rolledStats.stats,
          createdAt: new Date().toISOString(),
        };
        setLastDrop(drop);
        setInventory((prev) => [{ ...drop }, ...prev]);
        return;
      }

      if (itemCategory === "armor") {
        const armorKey = pickArmorKey(code, rollMode);
        const rolled   = rollArmorStats(armorKey, rarity, Math.random);
        const meta     = ARMOR_META[armorKey];
        const drop: Drop = {
          id: crypto.randomUUID(), barcode: code, dropType: "item", itemCategory: "armor",
          armorKey, rarity,
          roll: rollMode === "deterministic" ? deterministicRoll(`${code}:armor`) : Math.floor(Math.random() * 100),
          name: meta?.name ?? armorKey, desc: meta?.desc ?? "", stats: rolled.stats,
          createdAt: new Date().toISOString(),
        };
        setLastDrop(drop);
        setInventory((prev) => [{ ...drop }, ...prev]);
        return;
      }
    }
  }

  /* ── RENDER ── */
  return (
    <main style={{ padding: 24, color: "white" }}>

      {/* SELL CONFIRM MODAL */}
      {showSellConfirm && (
        <SellConfirmModal
          items={selectedItemsForModal}
          totalGold={sellTotal}
          onConfirm={confirmSell}
          onCancel={() => setShowSellConfirm(false)}
        />
      )}

      <h1>Codex Creatures</h1>

      {/* DISCOVERY PROGRESS */}
      <div style={{ marginTop: 12, marginBottom: 18, maxWidth: 520 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9 }}>
            <span>Creatures discovered</span>
            <span>{discoveredCreatures}/{TOTAL_CREATURES} ({creaturePct}%)</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${creaturePct}%`, background: "rgba(78,161,255,0.9)" }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9 }}>
            <span>Items discovered</span>
            <span>{discoveredItems}/{TOTAL_ITEMS} ({itemPct}%)</span>
          </div>
          <div style={{ height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${itemPct}%`, background: "rgba(255,204,77,0.9)" }} />
          </div>
        </div>
      </div>

      {/* GOLD */}
      <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 18 }}>
        💰 Gold: {gold}
      </div>

      {/* SCAN INPUT */}
      <input
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder="Enter barcode"
        style={{ padding: 8, width: "100%" }}
      />

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => {
            if (!scannerOn) { scanHandledRef.current = false; setScanStatus("Starting camera..."); }
            else { scanHandledRef.current = false; }
            setScannerOn((s) => !s);
          }}
          style={{
            padding: "8px 12px", borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: scannerOn ? "white" : "transparent",
            color: scannerOn ? "black" : "white",
            cursor: "pointer", fontWeight: 600,
          }}
        >
          {scannerOn ? "Stop Scanner" : "Start Scanner"}
        </button>
        <div style={{ opacity: 0.8, fontSize: 14 }}>{scanStatus}</div>
      </div>

      {scannerOn && (
        <div style={{ marginTop: 12 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{ width: "100%", maxWidth: 520, borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)" }}
          />
        </div>
      )}

      <br />

      <button onClick={() => generateDrop()} disabled={!isValidBarcode}>
        Generate Drop
      </button>

      {/* ROLL MODE */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
        {(["random", "deterministic"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setRollMode(mode)}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: rollMode === mode ? "white" : "transparent",
              color: rollMode === mode ? "black" : "white",
              cursor: "pointer", fontWeight: 600,
            }}
          >
            {mode === "random" ? "🎲 Random" : "🔒 Repeatable"}
          </button>
        ))}
      </div>

      {/* LAST DROP */}
      {lastDrop && (
        <div style={{ marginTop: 16 }}>
          <strong>Last Drop:</strong>
          {isRewardDrop(lastDrop) ? (
            <div style={{ marginTop: 6 }}>🪙 +{lastDrop.amount} Gold</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <button
                onClick={() => setIsLastDropOpen((v) => !v)}
                style={{ background: "transparent", border: "none", padding: 0, color: "inherit", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ color: lastDrop.dropType === "item" ? RARITY_COLORS[lastDrop.rarity]?.text ?? "white" : "inherit" }}>
                  {lastDrop.dropType === "item" ? (lastDrop.name ?? (lastDrop as any).itemKey ?? "Unknown item") : lastDrop.name}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFavoriteIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(lastDrop.id)) next.delete(lastDrop.id); else next.add(lastDrop.id);
                    return next;
                  });
                }}
                title={favoriteIds.has(lastDrop.id) ? "Unfavorite (allow selling)" : "Favorite (protect from selling)"}
                style={{ marginLeft: 8, cursor: "pointer", background: "transparent", border: "none", fontSize: 18, lineHeight: 1, color: favoriteIds.has(lastDrop.id) ? "#f5c542" : "#aaa" }}
              >
                {favoriteIds.has(lastDrop.id) ? "★" : "☆"}
              </button>

              {isLastDropOpen && lastDrop.dropType === "item" && lastDrop.stats && (
                <div style={{ marginTop: 6, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, maxWidth: 520 }}>
                  {lastDrop.itemCategory === "armor" ? (
                    <>
                      <div>mDef: <b>{(lastDrop.stats as any).mDef ?? 0}</b></div>
                      <div>rDef: <b>{(lastDrop.stats as any).rDef ?? 0}</b></div>
                      <div>Agility: <b>{(lastDrop.stats as any).agility ?? 0}</b></div>
                      <div>Health: <b>{(lastDrop.stats as any).hp ?? 0}</b></div>
                    </>
                  ) : (
                    <>
                      <div>Attack: <b>{(lastDrop.stats as any).melee ?? 0}</b></div>
                      <div>Range: <b>{(lastDrop.stats as any).ranged ?? 0}</b></div>
                      <div>Agility: <b>{(lastDrop.stats as any).agility ?? 0}</b></div>
                      <div>Health: <b>{(lastDrop.stats as any).hp ?? 0}</b></div>
                    </>
                  )}
                  {lastDrop.desc && <div style={{ marginTop: 6, opacity: 0.85 }}>Desc: {lastDrop.desc}</div>}
                  {isItemDrop(lastDrop) && lastDrop.itemCategory !== "material" && (
                    <div style={{ marginTop: 8, color: "#f5c542" }}>
                      Sell value:{" "}
                      {computeSellGold({ drop: lastDrop as any, getStatCapForDrop: (d: any, statKey: string) => getStatCapForDrop(d, statKey) ?? 0 })}g
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          INVENTORY HEADER + SELL MODE TOGGLE
      ═══════════════════════════════════════ */}
      <div style={{ marginTop: 30, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Sell mode toggle */}
          <button
            onClick={toggleSellMode}
            style={{
              padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
              border: sellMode ? "none" : "1px solid rgba(255,80,80,0.5)",
              background: sellMode ? "#ff5050" : "transparent",
              color: sellMode ? "white" : "#ff5050",
              transition: "all 0.15s",
            }}
          >
            {sellMode ? "✕ Cancel Sell" : "💰 Sell Mode"}
          </button>

          {/* Reset */}
          <button
            onClick={resetAll}
            style={{
              padding: "8px 12px", borderRadius: 8,
              border: "1px solid rgba(255,80,80,0.3)",
              background: "transparent", color: "#ff5050",
              cursor: "pointer", fontWeight: 600, fontSize: 13,
            }}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* SELL MODE TOOLBAR */}
      {sellMode && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 16px",
            background: "rgba(255,80,80,0.08)",
            border: "1px solid rgba(255,80,80,0.25)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {/* Left: select controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={selectAllInView}
              style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 13,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent", color: "white", cursor: "pointer",
              }}
            >
              Select All
            </button>
            <button
              onClick={deselectAll}
              style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 13,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "transparent", color: "white", cursor: "pointer",
              }}
            >
              Deselect All
            </button>
            <span style={{ fontSize: 13, opacity: 0.7 }}>
              {selectedForSale.size} selected
            </span>
          </div>

          {/* Right: running total + confirm */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {selectedForSale.size > 0 && (
              <span style={{ color: "#f5c542", fontWeight: 700, fontSize: 15 }}>
                +{sellTotal}g
              </span>
            )}
            <button
              onClick={() => setShowSellConfirm(true)}
              disabled={selectedForSale.size === 0}
              style={{
                padding: "8px 18px", borderRadius: 8, fontWeight: 700,
                border: "none",
                background: selectedForSale.size > 0 ? "#f5c542" : "rgba(255,255,255,0.1)",
                color: selectedForSale.size > 0 ? "#1a1a1a" : "rgba(255,255,255,0.3)",
                cursor: selectedForSale.size > 0 ? "pointer" : "not-allowed",
                fontSize: 14,
                transition: "all 0.15s",
              }}
            >
              Sell Selected
            </button>
          </div>
        </div>
      )}

      {/* TAB FILTERS */}
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["all", "creatures", "weapons", "armor", "materials", "consumables"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 13,
              border: "1px solid rgba(255,255,255,0.2)",
              background: activeTab === tab ? "white" : "transparent",
              color: activeTab === tab ? "black" : "white",
              cursor: "pointer", fontWeight: activeTab === tab ? 700 : 400,
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab as keyof typeof tabCounts] ?? 0})
          </button>
        ))}
      </div>

      {/* SELL MODE HINT */}
      {sellMode && (
        <p style={{ marginTop: 8, fontSize: 12, opacity: 0.55 }}>
          ★ Favorited items are protected and cannot be selected for sale.
          Materials and consumables are not sellable.
        </p>
      )}

      {/* ═══════════════════
          INVENTORY LIST
      ═══════════════════ */}
      <div style={{ marginTop: 12 }}>
        {filteredInventory.map((d) => {
          const isItem     = d.dropType === "item";
          const isOpen     = openInventoryItemId === d.id;
          const isFav      = favoriteIds.has(d.id);
          const sellable   = isSellableItem(d) && !isFav;
          const isSelected = selectedForSale.has(d.id);

          const sellVal = (sellMode && sellable) || (!sellMode && isItemDrop(d) && d.itemCategory !== "material")
            ? computeSellGold({ drop: d as any, getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0 })
            : 0;

          return (
            <div key={d.id} style={{ marginTop: 6 }}>

              {/* ── ROW ── */}
              <div
                onClick={() => {
                  if (sellMode && sellable) { toggleSelectItem(d.id); return; }
                  if (!sellMode && isItem) { setOpenInventoryItemId(isOpen ? null : d.id); }
                }}
                style={{
                  padding: sellMode ? "8px 12px" : "4px 0",
                  borderRadius: sellMode ? 8 : 0,
                  border: sellMode && sellable
                    ? isSelected
                      ? "1px solid rgba(245,197,66,0.7)"
                      : "1px solid rgba(255,255,255,0.1)"
                    : "none",
                  background: sellMode && isSelected
                    ? "rgba(245,197,66,0.08)"
                    : sellMode && sellable
                      ? "rgba(255,255,255,0.03)"
                      : "transparent",
                  cursor: (sellMode && sellable) || (!sellMode && isItem) ? "pointer" : "default",
                  transition: "all 0.1s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: sellMode && !sellable ? 0.4 : 0.95,
                }}
              >
                {/* LEFT */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {sellMode && sellable && (
                    <span style={{ fontSize: 16, color: isSelected ? "#f5c542" : "rgba(255,255,255,0.3)" }}>
                      {isSelected ? "☑" : "☐"}
                    </span>
                  )}
                  {!sellMode && isItem && (
                    <span style={{ fontSize: 11, opacity: 0.4, marginRight: 2 }}>
                      {isOpen ? "▾" : "▸"}
                    </span>
                  )}
                  {isRewardDrop(d) ? (
                    <span>🪙 +{d.amount} Gold</span>
                  ) : (
                    <span style={{ color: isItem ? (RARITY_COLORS[(d as CreatureOrItemDrop).rarity]?.text ?? "white") : "inherit" }}>
                      {isItem ? ((d as CreatureOrItemDrop).name ?? (d as any).itemKey ?? "Unknown item") : (d as CreatureOrItemDrop).name}
                      {isFav && <span style={{ marginLeft: 6, color: "#f5c542" }} title="Favorited">★</span>}
                    </span>
                  )}
                </div>

                {/* RIGHT */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {sellMode && sellable && (
                    <span style={{ fontSize: 13, color: "#f5c542", opacity: 0.85 }}>+{sellVal}g</span>
                  )}
                  {!sellMode && isItem && !isRewardDrop(d) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFavoriteIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                          return next;
                        });
                      }}
                      title={isFav ? "Unfavorite (allow selling)" : "Favorite (protect from selling)"}
                      style={{ cursor: "pointer", background: "transparent", border: "none", padding: 0, fontSize: 18, lineHeight: 1, color: isFav ? "#f5c542" : "#555" }}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  )}
                </div>
              </div>

              {/* ── INLINE EXPANDED STATS (directly under this row) ── */}
              {!sellMode && isOpen && isItemDrop(d) && d.stats && (
                <div
                  style={{
                    margin: "4px 0 8px 16px",
                    padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 8,
                    maxWidth: 500,
                    fontSize: "0.9rem",
                  }}
                >
                  {/* Favorite inside expanded panel */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFavoriteIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                          return next;
                        });
                      }}
                      style={{ cursor: "pointer", background: "transparent", border: "none", padding: 0, fontSize: 18, lineHeight: 1, color: isFav ? "#f5c542" : "#aaa" }}
                    >
                      {isFav ? "★" : "☆"}
                    </button>
                  </div>

                  {d.itemCategory === "armor" ? (
                    <>
                      <div>mDef: <b>{(d.stats as any).mDef}</b> / {getStatCapForDrop(d, "mDef") ?? "—"}</div>
                      <div>rDef: <b>{(d.stats as any).rDef}</b> / {getStatCapForDrop(d, "rDef") ?? "—"}</div>
                      <div>Agility: <b>{(d.stats as any).agility}</b> / {getStatCapForDrop(d, "agility") ?? "—"}</div>
                      <div>Health: <b>{(d.stats as any).hp}</b> / {getStatCapForDrop(d, "hp") ?? "—"}</div>
                    </>
                  ) : (
                    <>
                      <div>Attack: <b>{(d.stats as any).melee}</b> / {getStatCapForDrop(d, "melee") ?? "—"}</div>
                      <div>Range: <b>{(d.stats as any).ranged}</b> / {getStatCapForDrop(d, "ranged") ?? "—"}</div>
                      <div>Agility: <b>{(d.stats as any).agility}</b> / {getStatCapForDrop(d, "agility") ?? "—"}</div>
                      <div>Health: <b>{(d.stats as any).hp}</b> / {getStatCapForDrop(d, "hp") ?? "—"}</div>
                    </>
                  )}

                  {d.desc && <div style={{ marginTop: 6, opacity: 0.75, fontStyle: "italic" }}>{d.desc}</div>}

                  {d.itemCategory !== "material" && (
                    <div style={{ marginTop: 8, color: "#f5c542", fontWeight: 600 }}>
                      Sell value: {sellVal}g
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>
    </main>
  );
}
