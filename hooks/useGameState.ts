// hooks/useGameState.ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { Drop } from "@/lib/types";
import { ARMOR_SLOTS, type ArmorSlot } from "@/lib/items/armor";
import { isRewardDrop, isItemDrop, isCreatureDrop, isCardDrop, isSellableItem } from "@/lib/types";
import type { CreatureOrItemDrop } from "@/lib/types";
import { computeSellGold } from "@/lib/items/economy/sell";
import { discoveredSpecies, getStatCapForDrop } from "@/lib/items/gameHelpers";
import { clearRegistry } from "@/lib/barcodeRegistry";
import { clearBattles } from "@/lib/battleHistory";
import { findCreatureTemplate, KLUTZ, CREATURE_TEMPLATES, renamedMove, type CreatureProficiency } from "@/lib/creatures/creatureData";
import { summonFromCards } from "@/lib/creatures/summon";
import { clearDungeon, loadDungeon, saveDungeon, gearEntry, gearIdOf, lootIdOf, codexPrice, onBindle, bagSize, wareDrop, BACKPACK, BAG_MAX, type Ware } from "@/lib/dungeon/run";
import { codexDrop, potionDrop } from "@/lib/drops";
import { collectKlutz, klutzGainXp, klutzProficiency, recallKlutz, respecKlutz, giveKlutzStone, spendPoints, RESPEC_COST, sendKlutz as sendKlutzOut, type KlutzState } from "@/lib/klutz";
import { NEW_QUEST, klutzHelping, type QuestState } from "@/lib/quest";
import { blast, forceOpen, callVisitor, buyFromVisitor, canTakeBounty, clearTavern, loadTavern, materialOffer, mountHead, repair, tavernPlan, tavernQuestDue, tavernSellables, updateTavern, type TavernQuest } from "@/lib/tavern";
import { fighterFor, upgradeMoveSet, upgradeStyle } from "@/lib/creatures/instance";
import { addXp, addPlayerXp, clampLevel, SCROLL_XP, type Progress } from "@/lib/creatures/levels";
import { starterCreature } from "@/lib/creatures/starter";
import { SCHEMATICS, STORAGE_PLANS, MATERIAL_KEYS, BOOKCASE_BUILT, bookcaseSize, cageSize, canAfford, addMaterials, countMaterial, materialDrop, type MaterialKey, type Materials, type StoragePlan } from "@/lib/items/materials";

// Klutz is your helper, not one of your creatures (lib/klutz.ts). This
// stand-in drop is what his gear and moves are stored under (equipment
// keyed by KLUTZ_DROP_ID) and what the creature window shows for him.
export const KLUTZ_DROP_ID = "klutz-companion";
export type LevelUp = { id: string; name: string; from: number; to: number };
// His level, XP and spent % points live in KlutzState (lib/klutz.ts); he starts at level 1.
export function klutzDrop(level = 1, xp = 0, points?: KlutzState["points"], learned?: string[], soulStone?: KlutzState["soulStone"]): CreatureOrItemDrop {
  return {
    id: KLUTZ_DROP_ID, barcode: "", dropType: "creature", creatureId: KLUTZ.id,
    rarity: KLUTZ.rarity, roll: 0, name: KLUTZ.name, desc: KLUTZ.flavour, level, xp,
    proficiency: klutzProficiency(points), learned, soulStone: soulStone ?? null,
    createdAt: new Date().toISOString(),
  };
}
const isKlutz = (d: Drop) => isCreatureDrop(d) && d.creatureId === KLUTZ.id;

import { readSave, writeMainSave } from "@/lib/save";
import { clearPlayTime } from "@/lib/playTime";
import { discoveredItemKeys, itemDiscoveryKey } from "@/lib/items/discovery";
import { fitInBoxes, forFullBox, type CappedBox } from "@/lib/items/storage";
import { setStoneIn, soulStoneOf } from "@/lib/creatures/soulStones";
export const RECENT_SCANS = 10; // how many recent scan drops the altar remembers
export const CACHE_LIMIT = 9;   // Code Caches the altar can hold (Storage mode): its 3×3 window
// Scanning: "loot" opens each scan's Code Cache straight away; "store"
// keeps them at the altar to open when you like.
export type ScanMode = "loot" | "store";
// A new player loots, unless they start offline (then their scans keep for later).
export const defaultScanMode = (): ScanMode => (typeof navigator !== "undefined" && navigator.onLine === false ? "store" : "loot");
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
  sealed?: string[];                   // barcodes scanned with the global registry out of reach: sealed Code Caches, opened once online
  crate?: Drop[];                      // Klutz's crate: gear he brought home, to keep or sell
  scanTipRead?: boolean;               // …and you've heard Klutz's tip about it
  player?: Progress;                   // your own level and XP (it decides what you can find when you scan)
  bookcase?: number;                   // the bookcase's level (1: the broken shelf; lib/items/materials.ts)
  cage?: number;                       // the cage's level (1: holds one; lib/items/materials.ts CAGE_LEVELS)
  materials?: Materials;               // your materials at home: a tally, like gold
  storage?: CappedBox[];               // chest boxes built bigger (the merchant's storage schematics; lib/items/storage.ts)
  found?: string[];                    // kinds of item you've ever had (lib/items/discovery.ts)
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
  const obj = (v: unknown) => (v && typeof v === "object" ? v : {});
  // Klutz used to be one of your creatures; older saves drop him (his gear
  // stays on him: it's stored under KLUTZ_DROP_ID).
  const inventory: Drop[] = (Array.isArray(parsed.inventory) ? parsed.inventory : []).filter((d: Drop) => !isKlutz(d));
  const favoriteIds: string[] = (Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds : []).filter((id: string) => id !== KLUTZ_DROP_ID);
  // Creatures and cards show their species' current rarity, name and
  // description (some species changed tier when races arrived; the Cave Bat
  // became the Cave Goblin).
  // Soul stones (lib/creatures/soulStones.ts): one from before them gets its
  // roll now (the same one every time: seeded by its id), and the old
  // abilities they replaced are dropped. One from before the 3 starting
  // moves goes back to them (upgradeMoveSet), its move slots cleared.
  const equipment = obj(parsed.equipment) as Record<string, Loadout>;
  const caged: Drop[] = Array.isArray(parsed.caged) ? parsed.caged : [starterCreature()];
  const caches: Drop[] = Array.isArray(parsed.caches) ? parsed.caches : [];
  for (const d of [...inventory, ...caged, ...caches]) {
    if (!isCreatureDrop(d) && !isCardDrop(d)) continue;
    const c = d as CreatureOrItemDrop & { ability?: unknown };
    const t = findCreatureTemplate(c.creatureId, c.name);
    if (t) { c.rarity = t.rarity; c.name = t.name; c.desc = t.flavour; }
    c.soulStone = soulStoneOf(c, t);
    delete c.ability;
    if (upgradeMoveSet(c, t) && equipment[c.id]?.moves) equipment[c.id] = { ...equipment[c.id], moves: undefined };
    if (upgradeStyle(c, t) && equipment[c.id]?.moves) equipment[c.id] = { ...equipment[c.id], moves: undefined };
    if (c.learned) c.learned = c.learned.map(renamedMove);
  }
  // Codexes of a renamed move (RENAMED_MOVES) carry its new name, and an old
  // Impale codex (that move was retired, 2026-10-27) is the new Impale's.
  for (const d of [...inventory, ...caches, ...(Array.isArray(parsed.crate) ? parsed.crate as Drop[] : [])]) {
    const x = d as CreatureOrItemDrop;
    if (x.codexMove && (renamedMove(x.codexMove) !== x.codexMove || (x.codexMove === "Impale" && x.rarity !== "epic"))) Object.assign(x, codexDrop(renamedMove(x.codexMove), x.barcode), { id: x.id, createdAt: x.createdAt });
  }
  // Klutz can't use the new Blink, so his old one is Quickcast too.
  const klutz = obj(parsed.klutz) as KlutzState;
  if (klutz.learned) klutz.learned = klutz.learned.map(renamedMove);
  const kl = equipment[KLUTZ_DROP_ID];
  if (kl?.moves) equipment[KLUTZ_DROP_ID] = { ...kl, moves: kl.moves.map(renamedMove) };
  return {
    gold:       typeof parsed.gold === "number" ? parsed.gold : 0,
    inventory,
    scanCounts: obj(parsed.scanCounts) as Record<string, number>,
    favoriteIds,
    equipment,
    recentScans: Array.isArray(parsed.recentScans) ? parsed.recentScans : [],
    // A save from before the cage gets the starter waiting in it once.
    caged,
    klutz,
    quest: parsed.quest && typeof parsed.quest === "object" ? (parsed.quest as QuestState) : { ...NEW_QUEST },
    seen: Array.isArray(parsed.seen) ? parsed.seen : [],
    deathsSinceScan: typeof parsed.deathsSinceScan === "number" ? parsed.deathsSinceScan : 0,
    scanTipRead: parsed.scanTipRead === true,
    player: parsed.player && typeof parsed.player === "object" ? (parsed.player as Progress) : { level: 1, xp: 0 },
    scanMode: parsed.scanMode === "store" || parsed.scanMode === "loot" ? parsed.scanMode : defaultScanMode(),
    caches,
    sealed: Array.isArray(parsed.sealed) ? parsed.sealed.filter((c: unknown) => typeof c === "string") : [],
    crate: Array.isArray(parsed.crate) ? parsed.crate : [],
    bookcase: typeof parsed.bookcase === "number" ? parsed.bookcase : 1,
    cage: typeof parsed.cage === "number" ? parsed.cage : 1,
    materials: obj(parsed.materials) as Materials,
    storage: Array.isArray(parsed.storage) ? parsed.storage : [],
    found: (Array.isArray(parsed.found) ? parsed.found as string[] : []).map((k) => (k.startsWith("c:") ? `c:${renamedMove(k.slice(2))}` : k)),
  };
}

// The ids of the gear packed in your bag.
const packedGear = () => new Set(loadDungeon().meta.bag.map(gearIdOf).filter((x): x is string => !!x));

function safeSave(state: SaveState) {
  writeMainSave(state); // (keeps the Labyrinth's part of the save)
}

export type TabKey = "all" | "roster" | "creatures" | "cards" | "weapons" | "armor" | "materials" | "consumables" | "codexes";

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
  const [tavern, setTavern]           = useState<TavernQuest>({}); // (its own save field: lib/tavern.ts)
  const [seen, setSeen]            = useState<string[]>([]);
  const [deathsSinceScan, setDeathsSinceScan] = useState(0);
  const [scanTipRead, setScanTipRead] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("loot");
  const [caches, setCaches] = useState<Drop[]>([]);
  const [sealed, setSealed] = useState<string[]>([]);
  const [crate, setCrate] = useState<Drop[]>([]);
  const [player, setPlayer] = useState<Progress>({ level: 1, xp: 0 });
  const [bookcase, setBookcase] = useState(1);
  const [cage, setCage] = useState(1);
  const [storage, setStorage] = useState<CappedBox[]>([]);
  const [materials, setMaterials] = useState<Materials>({});
  const [found, setFound] = useState<string[]>([]);
  // Gear packed in your bag (lib/dungeon/run.ts): it can't be sold.
  const [packedIds, setPackedIds] = useState<Set<string>>(new Set());
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
      setSealed(saved.sealed ?? []);
      setCrate(saved.crate ?? []);
      setPlayer(saved.player ?? { level: 1, xp: 0 });
      setBookcase(saved.bookcase ?? 1);
      setCage(saved.cage ?? 1);
      setStorage(saved.storage ?? []);
      setMaterials(saved.materials ?? {});
      setFound(saved.found ?? []);
    }
    setTavern(loadTavern());
    setPackedIds(packedGear());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    safeSave({ gold, inventory, scanCounts, favoriteIds: Array.from(favoriteIds), equipment, recentScans: recentScanIds, caged, klutz, quest, seen, deathsSinceScan, scanTipRead, scanMode, caches, sealed, crate, player, bookcase, cage, storage, materials, found });
  }, [hydrated, gold, inventory, scanCounts, favoriteIds, equipment, recentScanIds, caged, klutz, quest, seen, deathsSinceScan, scanTipRead, scanMode, caches, sealed, crate, player, bookcase, cage, storage, materials, found]);

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
    return fighterFor(klutzDrop(klutz.level, 0, klutz.points, undefined, klutz.soulStone), KLUTZ, w?.stats, armorPieces(l, (id) => byId.get(id)), l?.moves, w?.itemKey);
  }, [equipment, inventory, klutz.level, klutz.points, klutz.soulStone]);

  // While Klutz is out, the gear he's wearing goes with him: nobody can take
  // it off him (or put anything on him) until he's back.
  const klutzAwayItems = useMemo(() => {
    const ex = klutz.expedition;
    if (!ex || ex.collected) return new Set<string>(); // (collected within seconds of him getting back)
    const l = equipment[KLUTZ_DROP_ID];
    return new Set([l?.weaponId, l?.helmetId, l?.chestId, l?.legsId].filter((x): x is string => !!x));
  }, [klutz, equipment]);
  const klutzIsAway = () => { const ex = klutz.expedition; return !!ex && !ex.collected && Date.now() < ex.endsAt; };

  // ── The tavern questline (lib/tavern.ts) ──────────────
  // Klutz's quest is waiting (a ❗ over him) once a creature's Lv 6 and he's Lv 2
  // (and he's home: back from a trip once it's collected).
  const tavernDue = tavernQuestDue(tavern, klutzHelping(quest),
    inventory.filter(isCreatureDrop).map((d) => clampLevel((d as CreatureOrItemDrop).level)), clampLevel(klutz.level),
    !!klutz.expedition && !klutz.expedition.collected);
  const acceptTavernQuest = () => setTavern(updateTavern((t) => ({ ...t, accepted: true })));
  const blastRubble = () => setTavern(updateTavern(blast));
  const openRubbleForTesting = () => setTavern(updateTavern(forceOpen)); // the altar's testing tools
  // …and a visitor now: the merchant, or the librarian if he's already here.
  const callVisitorForTesting = () => setTavern(updateTavern((t) => callVisitor(t, t.visitor === "merchant" ? "librarian" : "merchant", Math.random, onBindle(loadDungeon().meta))));
  const seeTavern = () => setTavern(updateTavern((t) => ({ ...t, seen: true })));
  // The repair takes its materials once: the tavern's marked repaired as
  // they're taken, and a second go finds it already done.
  function repairTavern(): boolean {
    const done = repair(loadTavern(), materials);
    if (!done) return false;
    setTavern(updateTavern(() => done.tavern));
    setMaterials(done.materials);
    return true;
  }
  const takeBounty = () => setTavern(updateTavern((t) => (canTakeBounty(t) ? { ...t, bounty: true } : t)));
  // The head goes up once you've beaten the Cyclops (the Labyrinth's record).
  const mountCyclopsHead = () => setTavern(updateTavern((t) => mountHead(t, loadDungeon().meta.clears)));
  // Buying from whoever's calling at the tavern, one of each. You're home, so
  // it goes straight where it lives: potions, scrolls, flares and
  // clairvoyance scrolls to your Inventory (pack them in the bag from there),
  // materials to your tally.
  function buyTavernWare(w: Ware): boolean {
    const t = loadTavern();
    if (t.visitor !== "merchant" || !t.wares?.some((x) => x.key === w.key) || t.bought?.includes(w.key)) return false;
    if ("backpack" in w) {
      // The rugged backpack: your bag's bigger from your next run on.
      const lab = loadDungeon();
      if (!onBindle(lab.meta) || !spendGold(w.price)) return false;
      saveDungeon({ ...lab, meta: { ...lab.meta, bagSize: BACKPACK } });
      setTavern(updateTavern((x) => buyFromVisitor(x, w.key)));
      return true;
    }
    if ("bagUp" in w) {
      // A backpack upgrade: one more slot from your next run on.
      const lab = loadDungeon();
      const size = bagSize(lab.meta);
      if (onBindle(lab.meta) || size >= BAG_MAX || !spendGold(w.price)) return false;
      saveDungeon({ ...lab, meta: { ...lab.meta, bagSize: size + 1 } });
      setTavern(updateTavern((x) => buyFromVisitor(x, w.key)));
      return true;
    }
    if (!spendGold(w.price)) return false;
    addDrop("potion" in w ? potionDrop("", w.potion) : wareDrop(w)!);
    setTavern(updateTavern((x) => buyFromVisitor(x, w.key)));
    return true;
  }
  // A codex from the librarian goes on the bookcase, if there's room.
  const shelfFree = bookcaseSize(bookcase) - inventory.filter((x) => x.dropType === "item" && x.codexMove).length;
  function buyTavernCodex(move: string): boolean {
    const t = loadTavern();
    if (t.visitor !== "librarian" || !t.offers?.includes(move) || t.bought?.includes(move) || shelfFree <= 0 || !spendGold(codexPrice(move))) return false;
    addDrop(codexDrop(move));
    setTavern(updateTavern((x) => buyFromVisitor(x, move)));
    return true;
  }

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

  // Spend % points on him (from his stats window).
  function spendKlutzPoints(add: Partial<CreatureProficiency>) {
    setKlutz((k) => spendPoints(k, add));
  }
  // A re-spec: all his points back, for RESPEC_COST gold. Returns whether it happened.
  function respecKlutzPoints(): boolean {
    if (!klutz.points || Object.values(klutz.points).every((v) => !v) || !spendGold(RESPEC_COST)) return false;
    setKlutz((k) => respecKlutz(k));
    return true;
  }

  // Give him one of your loose soul stones, from his Equip window (lib/klutz.ts
  // giveKlutzStone: as for a creature). False if he can't take it or you can't afford it.
  function giveKlutzSoulStone(stoneId: string): boolean {
    const done = giveKlutzStone(klutz, inventory, stoneId, gold);
    if (!done || !spendGold(done.cost)) return false;
    setInventory(done.inventory);
    setKlutz(done.klutz);
    return true;
  }

  // Call him back from the Labyrinth now, with what he's won so far.
  function callKlutzBack() {
    setKlutz((k) => recallKlutz(k));
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
  const cageSizeRef = useRef(cageSize(cage));
  useEffect(() => { cageSizeRef.current = cageSize(cage); }, [cage]);
  useEffect(() => {
    if (!hydrated) return;
    const check = () => {
      const { state: collected, loot } = collectKlutz(klutzRef.current);
      if (collected === klutzRef.current) return;
      // The cage only holds so many (cageSize): anything that won't fit, he lets go.
      const size = cageSizeRef.current;
      const room = size - cagedRef.current.length;
      const caught = loot.filter(isCreatureDrop);
      const state = collected.expedition
        ? { ...collected, expedition: { ...collected.expedition, caged: Math.min(caught.length, Math.max(0, room)), ...(caught.length > room ? { letGo: true } : {}) } }
        : collected;
      klutzRef.current = state; // so a second check before the re-render can't collect twice
      setKlutz(state);
      setCaged((prev) => [...prev, ...caught.slice(0, Math.max(0, size - prev.length))]);
      setCrate((prev) => [...loot.filter((d) => !isCreatureDrop(d)), ...prev]); // his gear goes in his crate
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  // ── The cage ──────────────────────────────────────────
  // Capture: the creature in the cage becomes yours. It joins your creatures,
  // not your roster (★ it yourself), unless your roster is empty: a new
  // game's first creature, which the Labyrinth's party picks from the roster.
  function captureCaged(id: string) {
    const d = caged.find((c) => c.id === id);
    if (!d) return;
    setCaged((prev) => prev.filter((c) => c.id !== id));
    setInventory((prev) => [d, ...prev]);
    setFavoriteIds((prev) => (prev.size === 0 ? new Set([d.id]) : prev));
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

  // Items that can't be sold: favourited, equipped or packed in your bag.
  const lockedIds = useMemo(
    () => new Set([...favoriteIds, ...equippedOn.keys(), ...packedIds]),
    [favoriteIds, equippedOn, packedIds]
  );

  // ── Inventory filters ─────────────────────────────────
  const creaturesOnly   = useMemo(() => inventory.filter((d) => !isRewardDrop(d) && d.dropType === "creature"), [inventory]);
  const weaponsOnly     = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "weapon"), [inventory]);
  const armorOnly       = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "armor"), [inventory]);
  // Materials are a tally (like gold): shown as one stack each, with a stable id.
  const materialsOnly   = useMemo(() => MATERIAL_KEYS.filter((k) => (materials[k] ?? 0) > 0)
    .map((k): Drop => ({ ...materialDrop(k, materials[k]!), id: `material:${k}`, createdAt: "" })), [materials]);
  const consumablesOnly = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.itemCategory === "consumable" && !d.codexMove), [inventory]);
  const codexesOnly     = useMemo(() => inventory.filter((d) => isItemDrop(d) && d.codexMove), [inventory]);
  const cardsOnly       = useMemo(() => inventory.filter(isCardDrop), [inventory]);
  // Roster = favourited creatures.
  const rosterOnly      = useMemo(() => creaturesOnly.filter((d) => favoriteIds.has(d.id)), [creaturesOnly, favoriteIds]);

  const tabCounts = useMemo(() => ({
    all:         inventory.length + materialsOnly.length,
    roster:      rosterOnly.length,
    creatures:   creaturesOnly.length,
    cards:       cardsOnly.length,
    weapons:     weaponsOnly.length,
    armor:       armorOnly.length,
    materials:   materialsOnly.length,
    consumables: consumablesOnly.length,
    codexes:     codexesOnly.length,
  }), [inventory, rosterOnly, creaturesOnly, cardsOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly, codexesOnly]);

  const filteredInventory = useMemo(() => {
    switch (activeTab) {
      case "roster":      return rosterOnly;
      case "creatures":   return creaturesOnly;
      case "cards":       return cardsOnly;
      case "weapons":     return weaponsOnly;
      case "armor":       return armorOnly;
      case "materials":   return materialsOnly;
      case "consumables": return consumablesOnly;
      case "codexes":     return codexesOnly;
      default:            return [...inventory, ...materialsOnly];
    }
  }, [activeTab, inventory, rosterOnly, creaturesOnly, cardsOnly, weaponsOnly, armorOnly, materialsOnly, consumablesOnly, codexesOnly]);

  // Your last scans that you still have (sold or summoned ones drop out).
  const recentScans = useMemo(() => {
    const byId = new Map(inventory.map((d) => [d.id, d]));
    return recentScanIds.map((id) => byId.get(id)).filter((d): d is Drop => !!d);
  }, [inventory, recentScanIds]);

  // Every barcode scan you've made (repeats of the same barcode included).
  const totalScans = useMemo(() => Object.values(scanCounts).reduce((n, c) => n + c, 0), [scanCounts]);

  // ── Discovery progress ────────────────────────────────
  const discoveredCreatures = useMemo(() => discoveredSpecies(inventory).size, [inventory]);
  const discoveredItems = useMemo(
    // Every kind of item (lib/items/discovery.ts), used-up ones included.
    () => discoveredItemKeys(found, inventory, materials).size,
    [found, inventory, materials]
  );
  // Remember the kinds of item in these drops, for "Items discovered".
  function noteFound(drops: Drop[]) {
    const keys = drops.map(itemDiscoveryKey).filter((k): k is string => !!k);
    if (keys.length) setFound((prev) => (keys.every((k) => prev.includes(k)) ? prev : [...new Set([...prev, ...keys])]));
  }

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
    noteFound([drop]);
    // Materials join your tally.
    if (drop.dropType === "item" && drop.material) {
      depositMaterials([drop]);
      return;
    }
    setInventory((prev) => [drop, ...prev]);
    if (isRewardDrop(drop)) setGold((g) => g + drop.amount);
  }

  // Materials (stacks brought home, or found at home) join your tally.
  function depositMaterials(drops: Drop[]) {
    const more: Materials = {};
    for (const d of drops) if (d.dropType === "item" && d.material) more[d.material] = (more[d.material] ?? 0) + (d.qty ?? 1);
    if (Object.keys(more).length) setMaterials((m) => addMaterials(m, more));
  }

  // A drop from scanning a barcode — a Code Cache. Looting: opened at once
  // (added, and remembered in your recent scans). Storage, or a find for a
  // full chest box (lib/items/storage.ts): kept at the altar. Returns whether
  // it was kept. (The altar refuses scans once CACHE_LIMIT are kept; if one
  // slips past, it goes in over the cap rather than being lost.)
  function addScan(drop: Drop): boolean {
    setDeathsSinceScan(0);
    setScanTipRead(false);
    if ((scanMode === "store" || forFullBox(inventory, drop, storage)) && caches.length + sealed.length < CACHE_LIMIT) {
      setCaches((prev) => [...prev, drop]);
      return true;
    }
    addDrop(drop);
    setRecentScanIds((prev) => [drop.id, ...prev.filter((id) => id !== drop.id)].slice(0, RECENT_SCANS));
    return false;
  }

  // A new barcode scanned with the global registry out of reach: a sealed
  // Code Cache, opened once back online (it takes one of the altar's spaces).
  function sealScan(code: string) {
    setDeathsSinceScan(0);
    setScanTipRead(false);
    setSealed((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }
  // …and once the registry has answered: what's inside becomes an ordinary
  // Code Cache, and the scan counts. null: someone else's find too rare for
  // you yet, so it's gone (scan it again once your level can find it).
  function unsealScan(code: string, drops: Drop[] | null) {
    setSealed((prev) => prev.filter((c) => c !== code));
    if (!drops) return;
    setScanCounts((prev) => ({ ...prev, [code]: (prev[code] ?? 0) + 1 }));
    setCaches((prev) => [...prev, ...drops]);
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
  // Selling to the tavern's merchant: anything he'll take from your Inventory
  // (lib/tavern.ts tavernSellables), or materials one at a time.
  const tavernSells = () => tavernSellables(inventory, lockedIds, crateSellValue);
  function sellToTavern(id: string): boolean {
    const offer = loadTavern().visitor === "merchant" && tavernSells().find((x) => x.drop.id === id);
    if (!offer) return false;
    removeDrop(id);
    setGold((g) => g + offer.price);
    return true;
  }
  function sellMaterialToTavern(key: MaterialKey): boolean {
    if (loadTavern().visitor !== "merchant" || countMaterial(materials, key) < 1) return false;
    setMaterials((m) => addMaterials(m, { [key]: -1 }));
    setGold((g) => g + materialOffer(key));
    return true;
  }

  // Open stored Code Caches (by drop id): what's inside joins your things.
  // Ones for a full chest box stay shut.
  function openCaches(ids: string[]) {
    const opened = fitInBoxes(inventory, caches.filter((c) => ids.includes(c.id)), storage).fit;
    if (opened.length === 0) return;
    const gone = new Set(opened.map((d) => d.id));
    setCaches((prev) => prev.filter((c) => !gone.has(c.id)));
    noteFound(opened);
    depositMaterials(opened);
    setInventory((prev) => [...opened.filter((d) => !(d.dropType === "item" && d.material)), ...prev]);
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
    // Put on at home, a piece packed in your bag comes out of it.
    if (itemId && packedIds.has(itemId)) {
      const lab = loadDungeon();
      if (!lab.run) saveDungeon({ ...lab, meta: { ...lab.meta, bag: lab.meta.bag.filter((e) => e !== gearEntry(itemId)) } });
      setPackedIds(packedGear());
    }
  }

  // Mini bosses' chests can hold the Iron Cage Schematic until you've got one
  // (at home, or in your bag) or built the cage.
  const hasCagePlan = (d: Drop) => d.dropType === "item" && d.schematic === "iron_cage";
  const wantsCagePlan = () => cage < 2 && !inventory.some(hasCagePlan) && !Object.values(loadDungeon().meta.loot ?? {}).some(hasCagePlan);
  // The storage schematics you have (at home, or in your bag) or have built:
  // the merchant stops offering those.
  const heldStoragePlans = (): StoragePlan[] => {
    const lab = loadDungeon().meta;
    const inBag = lab.bag.map(lootIdOf).flatMap((id) => (id && lab.loot?.[id] ? [lab.loot[id]] : []));
    return (Object.keys(STORAGE_PLANS) as StoragePlan[]).filter((p) => storage.includes(STORAGE_PLANS[p])
      || [...inventory, ...inBag].some((d) => d.dropType === "item" && d.schematic === p));
  };

  // Build what a schematic shows, if you have the materials: the schematic
  // and the materials are used up. Returns whether it was built.
  // schematicId: one in your storage (an old save's Labyrinth find); without
  // it, the tavern bounty's bookcase plan.
  function buildSchematic(schematicId?: string): boolean {
    const plan = schematicId ? inventory.find((d) => d.id === schematicId) : undefined;
    const key = plan?.dropType === "item" ? plan.schematic : !schematicId && tavernPlan(tavern, bookcase) ? "crooked_bookcase" : undefined;
    if (!key) return false;
    const cost = SCHEMATICS[key].cost;
    if (!canAfford(materials, cost)) return false;
    if (plan) setInventory((prev) => prev.filter((d) => d.id !== schematicId));
    setMaterials((m) => addMaterials(m, Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, -n]))));
    if (key === "crooked_bookcase") setBookcase((b) => (b < 2 ? BOOKCASE_BUILT : b));
    if (key === "iron_cage") setCage((c) => Math.max(c, 2));
    if (key === "weapon_storage" || key === "armor_storage") setStorage((s) => [...new Set([...s, STORAGE_PLANS[key]])]);
    return true;
  }

  // An item leaves your storage (e.g. left behind on a Labyrinth floor).
  function removeDrop(id: string) {
    setInventory((prev) => prev.filter((d) => d.id !== id));
    setFavoriteIds((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
    // …and off whoever was wearing it.
    setEquipment((prev) => {
      if (!Object.values(prev).some((l) => EQUIP_SLOTS.some((s) => l[SLOT_FIELD[s]] === id))) return prev;
      return Object.fromEntries(Object.entries(prev).map(([cid, l]) =>
        [cid, Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v === id ? undefined : v])) as Loadout]));
    });
  }

  function setMoves(creatureId: string, moves: string[]) {
    setEquipment((prev) => ({ ...prev, [creatureId]: { ...prev[creatureId], moves } }));
  }

  // Read a codex: the creature learns its race move for good, and the codex is used up.
  function learnCodex(creatureId: string, codexId: string) {
    const codex = inventory.find((d) => d.id === codexId) as CreatureOrItemDrop | undefined;
    const move = codex?.codexMove;
    if (!move) return;
    if (creatureId === KLUTZ_DROP_ID) setKlutz((k) => ({ ...k, learned: [...new Set([...(k.learned ?? []), move])] }));
    setInventory((prev) => prev.filter((d) => d.id !== codexId).map((d) =>
      d.id === creatureId ? { ...d, learned: [...new Set([...((d as CreatureOrItemDrop).learned ?? []), move])] } : d));
  }

  // Set a loose soul stone in a creature: free into an empty slot, or
  // SOUL_STONE_REPLACE_COST gold to replace its stone (the old one is
  // destroyed). The stone is used up. False if you can't afford it.
  function setSoulStone(creatureId: string, stoneId: string): boolean {
    const done = setStoneIn(inventory, creatureId, stoneId, gold);
    if (!done || !spendGold(done.cost)) return false;
    setInventory(done.inventory);
    return true;
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

  // One piece sold from its detail window (the same price as Sell mode).
  // Favourited, worn or packed pieces aren't for sale.
  function sellOne(id: string) {
    const d = inventory.find((x) => x.id === id);
    if (!d || !isSellableItem(d) || lockedIds.has(id)) return;
    setGold((g) => g + crateSellValue(d));
    setInventory((prev) => prev.filter((x) => x.id !== id));
    setSelectedForSale((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
  }

  // "New player": wipes this player's progress but keeps the barcode
  // registry — rescanning a known barcode acts like a friend scanning it.
  function resetAll() {
    clearDungeon();
    clearTavern();
    clearPlayTime();
    setTavern({});
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
    setSealed([]);
    setCrate([]);
    setPlayer({ level: 1, xp: 0 });
    setBookcase(1);
    setCage(1);
    setStorage([]);
    setMaterials({});
    setFound([]);
    setScanMode(defaultScanMode());
    setPackedIds(new Set());
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
    gold, inventory, scanCounts, totalScans, favoriteIds, equipment, lastDrop, recentScans, caged, klutz, klutzFighter, klutzAwayItems, quest, tavern, tavernDue, acceptTavernQuest, blastRubble, openRubbleForTesting, callVisitorForTesting, seeTavern, repairTavern, takeBounty, mountCyclopsHead, buyTavernWare, buyTavernCodex, tavernSells, sellToTavern, sellMaterialToTavern, shelfFree, seenIds, scanTipDue, scanTipRead, noteLabyrinthDeath, readScanTip, scanMode, setScanMode, caches, openCaches, sealed, sealScan, unsealScan, crate, crateSellValue, keepFromCrate, sellFromCrate,
    activeTab, setActiveTab,
    sellMode, selectedForSale, showSellConfirm, setShowSellConfirm,
    // Derived
    filteredInventory, tabCounts, equippedOn, lockedIds,
    weaponsOnly, armorOnly,
    discoveredCreatures, discoveredItems,
    sellableInView, sellTotal, selectedItemsForModal,
    // Actions
    addDrop, addScan, addGold, spendGold, updateScanCount, hydrated, bookcase, bookcaseSize: bookcaseSize(bookcase), buildSchematic, storage, heldStoragePlans, cage, cageSize: cageSize(cage), wantsCagePlan,
    toggleFavorite, equipItem, setMoves, learnCodex, summon, toggleSellMode, toggleSelectItem,
    selectAllInView, deselectAll, confirmSell, sellOne,resetAll, globalReset, startNew, captureCaged, releaseCaged, sendKlutzOff, callKlutzBack, spendKlutzPoints, respecKlutzPoints, giveKlutzSoulStone, klutzSkipAhead, acceptQuest, questFoundClub, questBoxFound, handOverBox, questSawStorage, questLend, removeDrop, markSeen, gainXp, readScroll, setSoulStone, player, gainPlayerXp, materials, depositMaterials, refreshPacked: () => setPackedIds(packedGear()),
  };
}