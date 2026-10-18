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
import { findCreatureTemplate, KLUTZ, CREATURE_TEMPLATES } from "@/lib/creatures/creatureData";
import { summonFromCards } from "@/lib/creatures/summon";
import { clearDungeon } from "@/lib/dungeon/run";
import { collectKlutz, klutzGainXp, sendKlutz as sendKlutzOut, type KlutzState } from "@/lib/klutz";
import { NEW_QUEST, type QuestState } from "@/lib/quest";
import { fighterFor } from "@/lib/creatures/instance";
import { addXp, addPlayerXp, SCROLL_XP, type Progress } from "@/lib/creatures/levels";
import { starterCreature } from "@/lib/creatures/starter";

// Klutz is your helper, not one of your creatures (lib/klutz.ts). This
// stand-in drop is what his gear and moves are stored under (equipment
// keyed by KLUTZ_DROP_ID) and what the creature window shows for him.
export const KLUTZ_DROP_ID = "klutz-companion";
export type LevelUp = { id: string; name: string; from: number; to: number };
// His level and XP live in KlutzState (lib/klutz.ts); he starts at level 1.
export function klutzDrop(level = 1, xp = 0): CreatureOrItemDrop {
  return {
    id: KLUTZ_DROP_ID, barcode: "", dropType: "creature", creatureId: KLUTZ.id,
    rarity: KLUTZ.rarity, roll: 0, name: KLUTZ.name, desc: KLUTZ.flavour, level, xp,
    createdAt: new Date().toISOString(),
  };
}
const isKlutz = (d: Drop) => isCreatureDrop(d) && d.creatureId === KLUTZ.id;

import { readSave, writeMainSave } from "@/lib/save";
export const RECENT_SCANS = 10; // how many recent scan drops the altar remembers
export const CAGE_SIZE = 1;          // creatures the cage holds (upgrades later)
// Scanning: "loot" opens each scan's Code Cache straight away; "store"
// keeps them at the altar to open when you like.
export type ScanMode = "loot" | "store";
export const SCAN_TIP_DEATHS = 3; // Labyrinth deaths in a row, without a scan, before Klutz suggests scanning

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
  deathsSinceScan?: number;            // Labyrinth runs lost in a row without scanning a barcode
  scanMode?: ScanMode;                 // Looting or Storage
  caches?: Drop[];                     // Code Caches waiting at the altar (Storage mode): what each holds
  crate?: Drop[];                      // Klutz's crate: gear he brought home, to keep or sell
  scanTipRead?: boolean;               // …and you've heard Klutz's tip about it
  player?: Progress;                   // your own level and XP (it decides what you can find when you scan)
};

// A new player's first creature (a Lv 3 Rare): lib/creatures/starter.ts.
export { starterCreature, STARTER_LEVEL } from "@/lib/creatures/starter";

// Also used read-only by the battle and dungeon screens.
export function loadSave(): SaveState | null {
  if (typeof window === "undefined") return null;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = readSave();
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
    deathsSinceScan: typeof parsed.deathsSinceScan === "number" ? parsed.deathsSinceScan : 0,
    scanTipRead: parsed.scanTipRead === true,
    player: parsed.player && typeof parsed.player === "object" ? (parsed.player as Progress) : { level: 1, xp: 0 },
    scanMode: parsed.scanMode === "store" ? "store" : "loot",
    caches: Array.isArray(parsed.caches) ? parsed.caches : [],
    crate: Array.isArray(parsed.crate) ? parsed.crate : [],
  };
}

function safeSave(state: SaveState) {
  writeMainSave(state); // (keeps the Labyrinth's part of the save)
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
  const [deathsSinceScan, setDeathsSinceScan] = useState(0);
  const [scanTipRead, setScanTipRead] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("loot");
  const [caches, setCaches] = useState<Drop[]>([]);
  const [crate, setCrate] = useState<Drop[]>([]);
  const [player, setPlayer] = useState<Progress>({ level: 1, xp: 0 });
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
      setDeathsSinceScan(saved.deathsSinceScan ?? 0);
      setScanTipRead(saved.scanTipRead ?? false);
      setScanMode(saved.scanMode ?? "loot");
      setCaches(saved.caches ?? []);
      setCrate(saved.crate ?? []);
      setPlayer(saved.player ?? { level: 1, xp: 0 });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    safeSave({ gold, inventory, scanCounts, favoriteIds: Array.from(favoriteIds), equipment, recentScans: recentScanIds, caged, klutz, quest, seen, deathsSinceScan, scanTipRead, scanMode, caches, crate, player });
  }, [hydrated, gold, inventory, scanCounts, favoriteIds, equipment, recentScanIds, caged, klutz, quest, seen, deathsSinceScan, scanTipRead, scanMode, caches, crate, player]);

  // ── Klutz's scanning tip ──────────────────────────────
  // Lose SCAN_TIP_DEATHS Labyrinth runs in a row without scanning a barcode
  // and Klutz has a word (a ❗ over him): go and scan for Code Caches.
  // Scanning anything resets it.
  function noteLabyrinthDeath() { setDeathsSinceScan((n) => n + 1); }
  const scanTipDue = deathsSinceScan >= SCAN_TIP_DEATHS;
  const readScanTip = () => setScanTipRead(true);

  // ── The Bestiary: creatures you've come across ────────
  // Anything you own (or hold a card of) or have waiting in the cage counts,
  // plus anything you've fought in the Labyrinth. (What beats Klutz stays a
  // mystery: he only tells you about it.)
  // XP for your creatures (drop id → XP). Returns who levelled up.
  function gainXp(gains: Record<string, number>): LevelUp[] {
    const ups: LevelUp[] = [];
    for (const d of inventory) {
      if (!isCreatureDrop(d) || !gains[d.id]) continue;
      const from = d.level ?? 1;
      const p = addXp({ level: from, xp: d.xp ?? 0 }, gains[d.id]);
      if (p.level > from) ups.push({ id: d.id, name: d.name, from, to: p.level });
    }
    setInventory((prev) => prev.map((d) => {
      if (!isCreatureDrop(d) || !gains[d.id]) return d;
      const p = addXp({ level: d.level ?? 1, xp: d.xp ?? 0 }, gains[d.id]);
      return { ...d, level: p.level, xp: p.xp };
    }));
    return ups;
  }

  // XP for you, the explorer. Returns your new level if you went up.
  function gainPlayerXp(n: number): number | null {
    const p = addPlayerXp(player, n);
    setPlayer({ level: p.level, xp: p.xp });
    return p.gained > 0 ? p.level : null;
  }

  // Read an XP scroll on a creature or on Klutz (SCROLL_XP); the scroll is used up.
  function readScroll(targetId: string, scrollId: string): LevelUp | null {
    const scroll = inventory.find((d) => d.id === scrollId);
    if (!scroll || scroll.dropType !== "item" || !scroll.scroll) return null;
    setInventory((prev) => prev.filter((d) => d.id !== scrollId));
    if (targetId === KLUTZ_DROP_ID) {
      const r = klutzGainXp(klutz, SCROLL_XP);
      setKlutz((k) => klutzGainXp(k, SCROLL_XP).state);
      return r.to > r.from ? { id: KLUTZ_DROP_ID, name: "Klutz", from: r.from, to: r.to } : null;
    }
    return gainXp({ [targetId]: SCROLL_XP })[0] ?? null;
  }

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
  // Klutz puts what was in the box into your storage (and sends you to look).
  function handOverBox() {
    const box = quest.box ?? [];
    if (quest.stage !== "boxFound") return;
    setInventory((prev) => [...box, ...prev]);
    setQuest({ stage: "stash", clubFound: true });
  }
  // You've opened your storage: Klutz has something to ask.
  const questSawStorage = () => setQuest((q) => (q.stage === "stash" ? { ...q, stage: "lend" } : q));
  // …and you've agreed to lend him gear: he'll hunt for you.
  const questLend = () => setQuest((q) => (q.stage === "lend" ? { ...q, stage: "done" } : q));

  // ── Klutz ─────────────────────────────────────────────
  // What he fights as: his template with the gear and moves set on him.
  const klutzFighter = useMemo(() => {
    const l = equipment[KLUTZ_DROP_ID];
    const byId = new Map(inventory.map((d) => [d.id, d as CreatureOrItemDrop]));
    const w = l?.weaponId ? byId.get(l.weaponId) : undefined;
    return fighterFor(klutzDrop(klutz.level), KLUTZ, w?.stats, armorPieces(l, (id) => byId.get(id)), l?.moves, w?.itemKey);
  }, [equipment, inventory, klutz.level]);

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
  const cagedRef = useRef(caged);
  useEffect(() => { cagedRef.current = caged; }, [caged]);
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const { state: collected, loot } = collectKlutz(klutzRef.current);
      if (collected === klutzRef.current) return;
      // The cage only holds CAGE_SIZE: anything that won't fit, he lets go.
      const room = CAGE_SIZE - cagedRef.current.length;
      const caught = loot.filter(isCreatureDrop);
      const state = caught.length > room && collected.expedition ? { ...collected, expedition: { ...collected.expedition, letGo: true } } : collected;
      klutzRef.current = state; // so a second check before the re-render can't collect twice
      setKlutz(state);
      setCaged((prev) => [...prev, ...caught.slice(0, Math.max(0, CAGE_SIZE - prev.length))]);
      setCrate((prev) => [...loot.filter((d) => !isCreatureDrop(d)), ...prev]); // his gear goes in his crate
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  // ── The cage ──────────────────────────────────────────
  // Free a caged creature: it joins your creatures (and your roster).
  // Capture: the creature in the cage becomes yours (and joins your roster).
  function captureCaged(id: string) {
    const d = caged.find((c) => c.id === id);
    if (!d) return;
    setCaged((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => [d, ...prev]);
    setFavoriteIds((prev) => new Set([...prev, d.id]));
  }
  // Release: let it go back to the wild. It's gone for good (but stays in the Bestiary).
  function releaseCaged(id: string) {
    const d = caged.find((c) => c.id === id) as CreatureOrItemDrop | undefined;
    if (!d) return;
    if (d.creatureId) markSeen([d.creatureId]);
    setCaged((prev) => prev.filter((c) => c.id !== id));
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

  // A drop from scanning a barcode — a Code Cache. Looting: opened at once
  // (added, and remembered in your recent scans). Storage: kept at the altar.
  function addScan(drop: Drop) {
    setDeathsSinceScan(0);
    setScanTipRead(false);
    if (scanMode === "store") { setCaches((prev) => [...prev, drop]); return; }
    addDrop(drop);
    setRecentScanIds((prev) => [drop.id, ...prev.filter((id) => id !== drop.id)].slice(0, RECENT_SCANS));
  }

  // Klutz's crate: keep a piece (it joins your storage) or sell it.
  const crateSellValue = (d: Drop) => (isSellableItem(d)
    ? computeSellGold({ drop: d as any, getStatCapForDrop: (drop: any, statKey: string) => getStatCapForDrop(drop, statKey) ?? 0 })
    : 0);
  function keepFromCrate(ids: string[]) {
    const kept = crate.filter((d) => ids.includes(d.id));
    setCrate((prev) => prev.filter((d) => !ids.includes(d.id)));
    setInventory((prev) => [...kept, ...prev]);
  }
  function sellFromCrate(ids: string[]) {
    const sold = crate.filter((d) => ids.includes(d.id));
    setCrate((prev) => prev.filter((d) => !ids.includes(d.id)));
    setGold((gl) => gl + sold.reduce((s, d) => s + crateSellValue(d), 0));
  }

  // Open stored Code Caches (by drop id): what's inside joins your things.
  function openCaches(ids: string[]) {
    const opened = caches.filter((c) => ids.includes(c.id));
    if (opened.length === 0) return;
    setCaches((prev) => prev.filter((c) => !ids.includes(c.id)));
    setInventory((prev) => [...opened, ...prev]);
    setGold((g) => g + opened.reduce((s, d) => s + (isRewardDrop(d) ? d.amount : 0), 0));
    setRecentScanIds((prev) => [...opened.map((d) => d.id), ...prev].slice(0, RECENT_SCANS));
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
    setDeathsSinceScan(0);
    setScanTipRead(false);
    setCaches([]);
    setCrate([]);
    setPlayer({ level: 1, xp: 0 });
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
    gold, inventory, scanCounts, totalScans, favoriteIds, equipment, lastDrop, recentScans, caged, klutz, klutzFighter, klutzAwayItems, quest, seenIds, scanTipDue, scanTipRead, noteLabyrinthDeath, readScanTip, scanMode, setScanMode, caches, openCaches, crate, crateSellValue, keepFromCrate, sellFromCrate,
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
    selectAllInView, deselectAll, confirmSell, resetAll, globalReset, startNew, captureCaged, releaseCaged, sendKlutzOff, klutzSkipAhead, acceptQuest, questFoundClub, questBoxFound, handOverBox, questSawStorage, questLend, removeDrop, markSeen, gainXp, readScroll, player, gainPlayerXp,
  };
}