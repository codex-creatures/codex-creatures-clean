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
  } catch {
    // ignore write errors (private mode, storage full, etc.)
  }
}
/* =====================
   TYPES
===================== */

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type ItemCategory = "weapon" | "armor" | "material" | "consumable";
type DropType = "creature" | "item" | "reward";
type RewardKind = "resource";

const RARITY_COLORS: Record<
  Rarity,
  { text: string; border: string; glow: string }
> = {
  common: {
    text: "#9CA3AF",
    border: "rgba(156,163,175,0.35)",
    glow: "rgba(156,163,175,0.12)",
  },
  uncommon: {
    text: "#22C55E",
    border: "rgba(34,197,94,0.35)",
    glow: "rgba(34,197,94,0.15)",
  },
  rare: {
    text: "#4EA1FF",
    border: "rgba(78,161,255,0.45)",
    glow: "rgba(78,161,255,0.18)",
  },
  epic: {
    text: "#BB86FF",
    border: "rgba(184,107,255,0.45)",
    glow: "rgba(184,107,255,0.18)",
  },
  legendary: {
    text: "#FFCC4D",
    border: "rgba(255,204,77,0.55)",
    glow: "rgba(255,204,77,0.22)",
  },
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

function randomRoll() {
  return Math.floor(Math.random() * 100) + 1;
}

function rarityFromRoll(roll: number): Rarity {
  if (roll >= 95) return "legendary";
  if (roll >= 80) return "epic";
  if (roll >= 60) return "rare";
  return "common";
}

function defaultName(dropType: DropType, rarity: Rarity) {
  return `${rarity} ${dropType}`;
}
function isRewardDrop(d: Drop): d is RewardDrop {
  return d.dropType === "reward";
}

function isCreatureOrItemDrop(d: Drop): d is CreatureOrItemDrop {
  return d.dropType === "creature" || d.dropType === "item";
}
function isCreatureDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "creature" } {
  return d.dropType === "creature";
}

function isItemDrop(d: Drop): d is CreatureOrItemDrop & { dropType: "item" } {
  return d.dropType === "item";
}
function pickArmorKey(code: string, rollMode: "random" | "deterministic"): ArmorKey {
  const idx =
    rollMode === "deterministic"
      ? deterministicRoll(`${code}:armorKey`) % ARMOR_KEYS.length
      : Math.floor(Math.random() * ARMOR_KEYS.length);
  return ARMOR_KEYS[idx];
}
function getStatCapForDrop(
  d: any,
  stat: string
): number | null {
  if (d.dropType !== "item") return null;

  // weapon caps
  if (d.itemCategory === "weapon") {
    const ceilings = ITEM_CEILINGS[d.itemKey as ItemKey];
    if (!ceilings) return null;
    const rarityCeilings = ceilings[d.rarity as Rarity];
    if (!rarityCeilings) return null;
    return (rarityCeilings as any)[stat] ?? null;
  }

  // armor caps
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
   CREATURE POOLS
===================== */

const CREATURES_BY_RARITY: Record<Rarity, string[]> = {
  common: ["Forest Slime", "Cave Bat", "Rust Beetle"],
  uncommon: ["Stone Toad", "Moss Wolf", "Amber Wasp"],
  legendary: ["Ancient Dragon"],
  epic: ["Void Serpent", "Storm Phoenix"],
  rare: ["Dire Wolf", "Crystal Golem"],
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
const TOTAL_WEAPONS = ITEM_KEYS.length;
const TOTAL_ARMOR = Object.keys(ARMOR_CEILINGS).length;
const TOTAL_ITEMS = TOTAL_WEAPONS + TOTAL_ARMOR;
/* =====================
   ITEM POOLS
===================== */

function deterministicRoll(seed: string) {
  // simple hash -> gives 1..100
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 100) + 1;
}
function pickIndexDeterministic(seed: string, length: number) {
  // deterministicRoll returns 1..100, convert to 0..length-1
  const r = deterministicRoll(seed); 
  return Math.floor(((r - 1) / 100) * length);
}

/* =====================
   PAGE
===================== */
// ⬇️ PASTE STEP 1 RIGHT HERE

function renderItemStats(
  stats: { melee: number; ranged: number; agility: number; hp: number },
  itemKey: ItemKey,
  rarity: Rarity
) {
  const max = ITEM_CEILINGS[itemKey]?.[rarity] ?? {
    melee: 0,
    ranged: 0,
    agility: 0,
    hp: 0,
  };

  return (
    <div style={{ fontSize: "0.85rem", marginTop: 6, opacity: 0.85 }}>
      <div>Attack: {stats.melee} / {max.melee}</div>
      <div>Range: {stats.ranged} / {max.ranged}</div>
      <div>Agility: {stats.agility} / {max.agility}</div>
      <div>Health: {stats.hp} / {max.hp}</div>
      <div style={{ marginTop: 4, fontStyle: "italic", opacity: 0.7 }}>
        Max = this item’s ceiling at its rarity.
      </div>
    </div>
  );
}
function pickWeaponKey(barcode: string, rollMode: "random" | "deterministic"): ItemKey {
  const keys = Object.keys(ITEM_CEILINGS) as Array<keyof typeof ITEM_CEILINGS>;
  if (rollMode === "deterministic") {
    return keys[deterministicRoll(`${barcode}:weapon`) % keys.length];
  }
  return keys[Math.floor(Math.random() * keys.length)];
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
function pickItemCategory(
  code: string,
  rollMode: "random" | "deterministic"
): ItemCategory {
  const categories: ItemCategory[] = [
    "weapon",
    "armor",
    "material",
    "consumable",
  ];

  if (rollMode === "deterministic") {
    const roll = deterministicRoll(`${code}:itemCategory`);
    return categories[roll % categories.length];
  }

  return categories[Math.floor(Math.random() * categories.length)];
}
export default function Home() {
  const [barcode, setBarcode] = useState("");
  const [rollMode, setRollMode] = useState<"random" | "deterministic">("random");
  const [inventory, setInventory] = useState<Drop[]>([]);
  const [openInventoryItemId, setOpenInventoryItemId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef = useRef(false);
  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
const [scannerOn, setScannerOn] = useState(false);
const [scanStatus, setScanStatus] = useState("");
type TabKey =
  | "all"
  | "creatures"
  | "weapons"
  | "armor"
  | "materials"
  | "consumables";
const [activeTab, setActiveTab] = useState<TabKey>("all");
// ---------- Inventory views ----------
const creaturesOnly = useMemo(
  () => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "creature"),
  [inventory]
);

const armouryOnly = useMemo(
  () =>
    inventory.filter(
      (d) =>
        !isRewardDrop(d) &&
        d.dropType === "item" &&
        (d.itemCategory === "weapon" || d.itemCategory === "armor")
    ),
  [inventory]
);

// ITEMS (split by category)
const weaponsOnly = useMemo(
  () =>
    inventory.filter(
      (d) =>
        !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "weapon"
    ),
  [inventory]
);

const armorOnly = useMemo(
  () =>
    inventory.filter(
      (d) =>
        !isRewardDrop(d) && d.dropType === "item" && d.itemCategory === "armor"
    ),
  [inventory]
);

const materialsOnly = useMemo(
  () =>
    inventory.filter(
      (d) =>
        !isRewardDrop(d) &&
        d.dropType === "item" &&
        d.itemCategory === "material"
    ),
  [inventory]
);

const consumablesOnly = useMemo(
  () =>
    inventory.filter(
      (d) =>
        !isRewardDrop(d) &&
        d.dropType === "item" &&
        d.itemCategory === "consumable"
    ),
  [inventory]
);

const rewardsOnly = useMemo(() => inventory.filter(isRewardDrop), [inventory]);

const tabCounts = useMemo(() => {
  return {
    all: inventory.length,
    creatures: creaturesOnly.length,
    weapons: weaponsOnly.length,
    armor: armorOnly.length,
    materials: materialsOnly.length,
    consumables: consumablesOnly.length,
  };
}, [
  inventory,
  creaturesOnly,
  weaponsOnly,
  armorOnly,
  materialsOnly,
  consumablesOnly,
]);

const filteredInventory = useMemo(() => {
  switch (activeTab) {
    case "creatures":
      return creaturesOnly;
    case "weapons":
      return weaponsOnly;
    case "armor":
      return armorOnly;
    case "materials":
      return materialsOnly;
    case "consumables":
      return consumablesOnly;
    case "all":
    default:
      return inventory;
  }
}, [
  activeTab,
  inventory,
  creaturesOnly,
  weaponsOnly,
  armorOnly,
  materialsOnly,
  consumablesOnly,
]);

  // Progress: unique discovered names (ignore rewards)
  const [pendingDrop, setPendingDrop] = useState<Drop | null>(null);
  
// Use this for progress bars (shows the next drop immediately)
const displayInventory = useMemo(() => {
  if (!pendingDrop) return inventory;
  return [pendingDrop, ...inventory];
}, [pendingDrop, inventory]);

  const discoveredCreatures = useMemo(() => {
    const set = new Set(
      displayInventory
        .filter(isCreatureDrop)
        .map((d) => d.name)
    );
    return set.size;
  }, [displayInventory]);

  
  const discoveredItems = useMemo(() => {
    const set = new Set(
      displayInventory
        .filter(isItemDrop)
        .map((d) => d.itemKey ?? d.name)
    );
    
    return set.size;
  }, [displayInventory]);
  
const creaturePct =
  TOTAL_CREATURES === 0 ? 0 : Math.round((discoveredCreatures / TOTAL_CREATURES) * 100);
const itemPct = Math.round((discoveredItems / TOTAL_ITEMS) * 100);


const [lastDrop, setLastDrop] = useState<Drop | null>(null);
const [isLastDropOpen, setIsLastDropOpen] = useState(false);
const [gold, setGold] = useState<number>(0);
const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
const [scanCounts, setScanCounts] = useState<Record<string, number>>({}); 
  // Load saved game once on mount
useEffect(() => {
  const saved = safeLoad();
  if (!saved) return;

  setGold(saved.gold);
  setInventory(saved.inventory);
  setScanCounts(saved.scanCounts);
  setFavoriteIds(new Set(saved.favoriteIds ?? []));
}, []);
useEffect(() => {
  // Don’t try to save during SSR
  if (typeof window === "undefined") return;

  safeSave({
    gold,
    inventory,
    scanCounts,
    favoriteIds: Array.from(favoriteIds),
  });  
}, [gold, inventory, scanCounts, favoriteIds]);
// Save game whenever key state changes
  const isValidBarcode = useMemo(
    () => /^[0-9]{6,20}$/.test(barcode.trim()),
    [barcode]
  );
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
          
            const raw = result.getText();
            const digits = raw.replace(/\D/g, ""); // keep only numbers
          
            if (digits.length >= 6 && digits.length <= 20) {
              setScanStatus(`Scanned: ${digits}`);
              setBarcode(digits);
          
              controls.stop();
              setScannerOn(false);
          
              setTimeout(() => generateDrop(digits), 0);
            } else {
              // allow another attempt if scan wasn't usable
              scanHandledRef.current = false;
            }
          }
          
        
        );
  
        scanControlsRef.current = controls;
        setScanStatus("Point camera at barcode...");
      } catch (err) {
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
  }
  function generateDrop(codeOverride?: string) {
    const code = (codeOverride ?? barcode).trim();
  
    // validate barcode here (so scanner + manual both work)
    if (!/^[0-9]{6,20}$/.test(code)) return;
  
    setPendingDrop(null);
  
    const alreadyScanned = scanCounts[code] ?? 0; // 0 = first time, 1 = second, 2+ = later
    setScanCounts((prev) => ({ ...prev, [code]: alreadyScanned + 1 }));
  
  
    // ----------------------
    // RESCAN => REWARD (resource)
    // ----------------------
    if (rollMode === "deterministic" && alreadyScanned >= 1) {
      const tier = alreadyScanned === 1 ? "mid" : "low"; // 2nd scan => mid, 3rd+ => low
  
      const REWARD_RULES = {
        mid: { min: 25, max: 100 },
        low: { min: 5, max: 25 },
      } as const;
  
      const { min, max } = tier === "mid" ? REWARD_RULES.mid : REWARD_RULES.low;
      const range = max - min + 1;
  
      const amount =
        alreadyScanned === 1
          // 2nd scan => deterministic 25–100
          ? min + (deterministicRoll(`${code}:reward:${tier}`) % range)
          // 3rd+ scans => ALWAYS random 5–25
          : min + Math.floor(Math.random() * range);
  
      setGold((g) => g + amount);
  
      const drop: Drop = {
        id: crypto.randomUUID(),
        barcode: code,
        dropType: "reward",
        rewardKind: "resource",
        amount,
        createdAt: new Date().toISOString(),
      };
      setLastDrop(drop);
      setInventory((prev) => [{ ...drop }, ...prev]);
      return;
    }
  
    // ----------------------
    // FIRST SCAN => CREATURE / ITEM (existing logic)
    // ----------------------
    // Decide FIRST-SCAN outcome: Creature 20%, Item 60%, Gold 20%
const outcomeRoll =
rollMode === "deterministic"
  ? (deterministicRoll(`${code}:outcome`) % 100) + 1
  : Math.floor(Math.random() * 100) + 1;

const outcome: "creature" | "item" | "gold" =
outcomeRoll <= 20 ? "creature" : outcomeRoll <= 80 ? "item" : "gold";

// If FIRST-SCAN outcome is gold, award 100–300 and return
if (outcome === "gold") {
const amount =
  rollMode === "deterministic"
    ? 100 + (deterministicRoll(`${code}:gold`) % 201) // 100–300
    : 100 + Math.floor(Math.random() * 201);

setGold((g) => g + amount);

const drop: Drop = {
  id: crypto.randomUUID(),
  barcode: code,
  dropType: "reward",
  rewardKind: "resource",
  amount,
  createdAt: new Date().toISOString(),
};

setLastDrop(drop);
setInventory((prev) => [{ ...drop }, ...prev]);
return;
}

 // ----------------------
// CREATURE BRANCH
// ----------------------
if (outcome === "creature") {
  const roll =
    rollMode === "deterministic"
      ? deterministicRoll(code)
      : randomRoll();

  const rarity = rarityFromRoll(roll);
  const name = pickCreatureName(rarity, code, rollMode);

  const drop: Drop = {
    id: crypto.randomUUID(),
    barcode: code,
    dropType: "creature",
    rarity,
    roll,
    name,
    createdAt: new Date().toISOString(),
  };

  setLastDrop(drop);
  setInventory((prev) => [{ ...drop }, ...prev]);
  return;
}
// ITEM BRANCH (NEW SYSTEM)
if (outcome === "item") {
  const itemCategory = pickItemCategory(code, rollMode);
  const rarity = pickRarity(code, rollMode);

  // -----------------------
  // WEAPON
  // -----------------------
  if (itemCategory === "weapon") {
    const idx =
      rollMode === "deterministic"
        ? deterministicRoll(`${code}:itemKey`) % ITEM_KEYS.length
        : Math.floor(Math.random() * ITEM_KEYS.length);

    const itemKey = ITEM_KEYS[idx] as ItemKey;

    // roll weapon stats (this should already exist in your project)
    const rolledStats = rollItemStats(itemKey, rarity, Math.random);

    const meta = ITEM_META[itemKey];
    const name = meta?.name ?? itemKey;
    const desc = meta?.desc ?? "";

    const drop: Drop = {
      id: crypto.randomUUID(),
      barcode: code,
      dropType: "item",
      itemCategory: "weapon",
      itemKey,
      rarity,
      roll:
        rollMode === "deterministic"
          ? deterministicRoll(`${code}:item`)
          : Math.floor(Math.random() * 100),
      name,
      desc,
      stats: rolledStats.stats,
      createdAt: new Date().toISOString(),
    };

    setLastDrop(drop);
    setInventory((prev) => [{ ...drop }, ...prev]);
    return;
  }
          // -----------------
        // ARMOR
        // -----------------
        if (itemCategory === "armor") {
          const armorKey = pickArmorKey(code, rollMode);
          const rolled = rollArmorStats(armorKey, rarity, Math.random);

          const meta = ARMOR_META[armorKey];
          const name = meta?.name ?? armorKey;
          const desc = meta?.desc ?? "";

          const drop: Drop = {
              id: crypto.randomUUID(),
              barcode: code,
              dropType: "item",
              itemCategory: "armor",
              armorKey,
              rarity,
              roll:
                  rollMode === "deterministic"
                      ? deterministicRoll(`${code}:armor`)
                      : Math.floor(Math.random() * 100),
              name,
              desc,
              stats: rolled.stats,
              createdAt: new Date().toISOString(),
          };

          setLastDrop(drop);
          setInventory((prev) => [{ ...drop }, ...prev]);
          return;
      }
}
  }
  return (
      <main style={{ padding: 24, color: "white" }}>
      <h1>Codex Creatures</h1>
      <div style={{ marginTop: 12, marginBottom: 18, maxWidth: 520 }}>
  <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9 }}>
      <span>Creatures discovered</span>
      <span>
        {discoveredCreatures}/{TOTAL_CREATURES} ({creaturePct}%)
      </span>
    </div>
    <div style={{ height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${creaturePct}%`, background: "rgba(78,161,255,0.9)" }} />
    </div>
  </div>

  <div>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, opacity: 0.9 }}>
      <span>Items discovered</span>
      <span>
      {discoveredItems}/{TOTAL_ITEMS} ({itemPct}%)
      </span>
    </div>
    <div style={{ height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${itemPct}%`, background: "rgba(255,204,77,0.9)" }} />
    </div>
  </div>
</div>

      <div style={{ marginBottom: 12, fontWeight: 600 }}>
  💰 Gold: {gold}
</div>
<div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
  <button onClick={() => setActiveTab("all")}>
  All ({tabCounts.all})
</button>

<button onClick={() => setActiveTab("creatures")}>
  Creatures ({tabCounts.creatures})
</button>

<button onClick={() => setActiveTab("armor")}>
  Armor ({tabCounts.armor})
</button>

<button onClick={() => setActiveTab("weapons")}>
  Weapons ({tabCounts.weapons})
</button>
</div>

      <input
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder="Enter barcode"
        style={{ padding: 8, width: "100%" }}
      />
<div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
  <button
    onClick={() => {
      if (!scannerOn) {
        scanHandledRef.current = false;
        setScanStatus("Starting camera...");
      } else {
        scanHandledRef.current = false; // optional: also reset when stopping
      }
      setScannerOn((s) => !s);
    }}
    
    
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.2)",
      background: scannerOn ? "white" : "transparent",
      color: scannerOn ? "black" : "white",
      cursor: "pointer",
      fontWeight: 600,
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
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    />
  </div>
)}

      <br /><br />

      <button
        onClick={() => generateDrop()}
        disabled={!isValidBarcode}
      >
        Generate Drop
      </button>
      <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
  <button
    onClick={() => setRollMode("random")}
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.2)",
      background: rollMode === "random" ? "white" : "transparent",
      color: rollMode === "random" ? "black" : "white",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    🎲 Random
  </button>

  <button
    onClick={() => setRollMode("deterministic")}
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.2)",
      background: rollMode === "deterministic" ? "white" : "transparent",
      color: rollMode === "deterministic" ? "black" : "white",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    🔒 Repeatable
  </button>
</div>
{lastDrop && (
  <div style={{ marginTop: 16 }}>
    <strong>Last Drop:</strong>

    {isRewardDrop(lastDrop) ? (
      <div style={{ marginTop: 6 }}>
        🪙 +{lastDrop.amount} Gold
      </div>
    ) : (
      <div style={{ marginTop: 6 }}>
        <button
          onClick={() => setIsLastDropOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            color: "inherit",
            cursor: "pointer",
            textAlign: "left",
          }}
          title="Click to view stats"
        >
          <span
            style={{
              color:
                lastDrop.dropType === "item"
                  ? RARITY_COLORS[lastDrop.rarity]?.text ?? "white"
                  : "inherit",
            }}
          >
            {lastDrop.dropType === "item"
              ? (lastDrop.name ?? (lastDrop as any).itemKey ?? "Unknown item")
              : lastDrop.name}
          </span>
        </button>
        <button
  onClick={(e) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(lastDrop.id)) next.delete(lastDrop.id);
      else next.add(lastDrop.id);
      return next;
    });
  }}
  title={favoriteIds.has(lastDrop.id) ? "Unfavorite (allow selling)" : "Favorite (protect from selling)"}
  style={{
    marginLeft: 8,
    cursor: "pointer",
    background: "transparent",
    border: "none",
    fontSize: 18,
    lineHeight: 1,
    color: favoriteIds.has(lastDrop.id) ? "#f5c542" : "#aaa",
  }}
>
  {favoriteIds.has(lastDrop.id) ? "★" : "☆"}
</button>
        {isLastDropOpen && lastDrop.dropType === "item" && lastDrop.stats && (
          <div
            style={{
              marginTop: 6,
              padding: "8px 10px",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              maxWidth: 520,
              opacity: 0.95,
            }}
          >
            
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

            {lastDrop.desc && (
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                Desc: {lastDrop.desc}
              </div>
            )}
  {isItemDrop(lastDrop) && lastDrop.itemCategory !== "material" && (
  <div style={{ marginTop: 8, color: "#f5c542" }}>
    Sell value:{" "}
    {computeSellGold({
      drop: lastDrop as any,
      getStatCapForDrop: (d: any, statKey: string) =>
        getStatCapForDrop(d, statKey) ?? 0,
    })}
    g
  </div>
)}
          </div>
        )}
      </div>
    )}
  </div>
)}
<div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
  <button onClick={() => setActiveTab("all")}>
    All ({tabCounts.all})
  </button>

  <button onClick={() => setActiveTab("creatures")}>
    Creatures ({tabCounts.creatures})
  </button>

  <button onClick={() => setActiveTab("weapons")}>
    Weapons ({tabCounts.weapons})
  </button>

  <button onClick={() => setActiveTab("armor")}>
    Armor ({tabCounts.armor})
  </button>

  <button onClick={() => setActiveTab("materials")}>
    Materials ({tabCounts.materials})
  </button>

  <button onClick={() => setActiveTab("consumables")}>
    Consumables ({tabCounts.consumables})
  </button>

  <button
    onClick={resetAll}
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid rgba(255,80,80,0.5)",
      background: "transparent",
      color: "#ff5050",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Reset All
  </button>
</div>
 <h2 style={{ marginTop: 30 }}>Inventory</h2>
 {filteredInventory.map((d) => {
    const isItem = d.dropType === "item";
    const isOpen = openInventoryItemId === d.id;
    return (
      <div key={d.id} style={{ marginTop: 6, opacity: 0.95 }}>
        {isRewardDrop(d) ? (
          <span>🪙 +{d.amount} Gold</span>
        ) : (
          <div>
  <button
    onClick={() => setOpenInventoryItemId(isOpen ? null : d.id)}
    style={{
      background: "transparent",
      border: "none",
      padding: 0,
      color: "inherit",
      cursor: "pointer",
      textAlign: "left",
    }}
    title={isItem ? "Click to view stats" : "Creature"}
  >
<span
              style={{
                color: isItem ? (RARITY_COLORS[d.rarity]?.text ?? "white") : "inherit",
              }}
            >
            <span>
  {isItem ? (d.name ?? d.itemKey ?? "Unknown item") : d.name}
  {favoriteIds.has(d.id) && (
    <span style={{ marginLeft: 6, color: "#f5c542" }} title="Favorited">
      ★
    </span>
  )}
</span>
            </span>
            
            </button>

            {isItem && isOpen && d.stats && (
  <div
    style={{
      marginTop: 6,
      padding: "8px 10px",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 8,
      maxWidth: 520,
      opacity: 0.95,
    }}
  >
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
  <button
    onClick={(e) => {
      e.stopPropagation();
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(d.id)) next.delete(d.id);
        else next.add(d.id);
        return next;
      });
    }}
    title={
      favoriteIds.has(d.id)
        ? "Unfavorite (allow selling)"
        : "Favorite (protect from selling)"
    }
    style={{
      cursor: "pointer",
      background: "transparent",
      border: "none",
      padding: 0,
      fontSize: 18,
      lineHeight: 1,
      color: favoriteIds.has(d.id) ? "#f5c542" : "#aaa",
    }}
  >
    {favoriteIds.has(d.id) ? "★" : "☆"}
  </button>
</div>
{d.itemCategory === "armor" ? (
  <>
    <div>
      mDef: {(d.stats as any).mDef} / {getStatCapForDrop(d, "mDef") ?? "—"}
    </div>
    <div>
      rDef: {(d.stats as any).rDef} / {getStatCapForDrop(d, "rDef") ?? "—"}
    </div>
    <div>
      Agility: {(d.stats as any).agility} / {getStatCapForDrop(d, "agility") ?? "—"}
    </div>
    <div>
      Health: {(d.stats as any).hp} / {getStatCapForDrop(d, "hp") ?? "—"}
    </div>
  </>
) : (
  <>
    <div>
      Attack: {(d.stats as any).melee} / {getStatCapForDrop(d, "melee") ?? "—"}
    </div>
    <div>
      Range: {(d.stats as any).ranged} / {getStatCapForDrop(d, "ranged") ?? "—"}
    </div>
    <div>
      Agility: {(d.stats as any).agility} / {getStatCapForDrop(d, "agility") ?? "—"}
    </div>
    <div>
      Health: {(d.stats as any).hp} / {getStatCapForDrop(d, "hp") ?? "—"}
    </div>
  </>
)}
    {d.desc && (
      <div style={{ marginTop: 6, opacity: 0.85 }}>
        Desc: {d.desc}
      </div>
    )}
  </div>
)}
          </div>
        )}
      </div>
    );
  })}
</main>
);
}