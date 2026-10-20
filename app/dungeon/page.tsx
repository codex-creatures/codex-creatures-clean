"use client";
// app/dungeon/page.tsx
// A run through dungeon 1: pick a party of up to 5, study the map scroll at
// the entrance, then step inside — from there you see only the room you're
// in and the tunnels leading on. Fight, heal and loot, and face the boss.
// The rules live in lib/dungeon/run.ts; the run is saved after every step,
// so a refresh never loses it. Going back to the Den ends it (you keep your
// bag), so a run can't be paused and picked up later.

import { Coin } from "@/components/GoldCount";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BagSlots, { slotLook, type SlotLook } from "@/components/BagSlots";
import LootWindow from "@/components/LootWindow";
import MerchantCart from "@/components/MerchantCart";
import MerchantBag from "@/components/MerchantBag";
import EquipPreview from "@/components/EquipPreview";
import TeamDropRow from "@/components/TeamDropRow";
import { useDragDrop } from "@/hooks/useDragDrop";
import { WEAPON_SPRITES } from "@/lib/sprites/items";
import LevelUpShow, { type LevelUpInfo } from "@/components/LevelUpShow";
import { RICKETY_CHEST_OPEN, BURLAP_SACK_OPEN, TREASURE_CHEST_OPEN, STRONGBOX_OPEN, TREASURE_PILE } from "@/lib/sprites/props";
import LootGrid from "@/components/LootGrid";
import GearCompare, { GearStatLine } from "@/components/GearCompare";
import PartySlots, { type PartyMember } from "@/components/PartySlots";
import { useGameState, SLOT_FIELD, type EquipSlot } from "@/hooks/useGameState";
import type { Drop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, CREATURE_BY_ID, MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import { PotionIcon } from "@/components/PixelSprite";
import CreaturePortrait from "@/components/CreaturePortrait";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { pickCreatureId, pickRarity } from "@/lib/items/gameHelpers";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { CHEST_ODDS, rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { itemToCombatStats } from "@/lib/combat/loadout";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "@/lib/types";
import { dropFromOutcome, weaponDrop, armorDrop, codexDrop, randomCodexMove, randomArmorSlot, scrollDrop, potionDrop } from "@/lib/drops";
import { clubRoom, klutzClub, isClub, thiefRoom, rollBox, wantsClub, wantsThief, TUTORIAL_MOVES } from "@/lib/quest";
import { guess as witchGuess, walkAway, sitDown, isSeated, type Guess, type WitchGame } from "@/lib/dungeon/witch";
import WitchWindow from "@/components/WitchWindow";
import { xpForEnemy, BOSS_XP, shareXp, impactsFromLog } from "@/lib/creatures/levels";
import { KLUTZ_DROP_ID } from "@/hooks/useGameState";
import { SECOND_WIND_HEAL, SET_BONUS } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import type { ArmorKey } from "@/lib/items/armor";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import {
  PARTY_SIZE, TEAM_SIZE, ENTRY_FEE, FREE_RUNS, CHEST_DROPS, CHEST_CODEX_CHANCE, CHEST_TOOLS, toolFinds, capSack, cyclopsChest, MINIBOSS_SCROLL_CHANCE, BOSS_SCROLL_CHANCE, DECK_CARDS, ROOM_INFO, POTIONS, addToBag, type PotionKey,
  hasFight, minibossExtras, codexPrice, wareName, ENCAMP_FUSE, ENCAMP_DRUNK_HP, type Ware,
  BACKPACK, BINDLE, onBindle, waresFor, bagSize, bagName, isPotionEntry, gearEntry, gearIdOf, lootEntry, lootIdOf, type BagEntry, type FloorItem,
  startRun, startQuestRun, stepInside, canMoveOn, moveOn, nextRooms, runPosition, leaveRoom, setTeam, fightingTeam, enemyFighter, gearName, endRun,
  loadDungeon, saveDungeon, freeHealing, usedUp, type SackItem, type GotItem, type DungeonSave, type DungeonRun, type Room,
  curse, illnessTick, dungeonOf, DUNGEONS, DEEP_ROUTE, witchPrize, ILLNESS_DAMAGE, ILLNESS_ACTIONS, CYCLOPS_LEVEL, WARDEN_LEVEL, type DungeonId,
  needsSlot, nextToTake, dropRank, sackRank, stowDrop, rareLeftBehind, isRareFind, wipedOut, merchantOffer, droppedPieceStats,
  dynamiteHere, takeDynamite,
} from "@/lib/dungeon/run";
import { comeHome, loadTavern, updateTavern, wantsStorehouse } from "@/lib/tavern";
import DenFrame from "@/components/DenFrame";
import {
  BattleView, SectionTitle, loadOwnedCreatures, rarityColor, usePlayableBattle, MUTED,
  type Match, type MemberInfo, type OwnedCreature, type BagItem,
} from "@/components/BattleScreen";
import { combatSummary } from "@/lib/combat/loadout";
import { CYCLOPS_PARTS, cyclopsTeam } from "@/lib/creatures/bosses";
import DungeonMapView from "@/components/DungeonMapView";
import DungeonRoomView from "@/components/DungeonRoomView";
import EncounterCards from "@/components/EncounterCards";
import GearViewModal from "@/components/GearViewModal";
import Sheet from "@/components/Sheet";
import Help from "@/components/Help";
import { TOOLS, materialDrop, toolDrop } from "@/lib/items/materials";
import { BOX_CAP, BOX_NAMES, fullBoxes, type CappedBox } from "@/lib/items/storage";

const GOLD = "#f5c542";
// Every Labyrinth screen keeps to one phone-sized column (the room picture is
// 518px; with the page's padding), so nothing jumps about from room to room.
const COLUMN = 552;

function combatLine(f: Parameters<typeof combatSummary>[0]): string {
  const s = combatSummary(f);
  return `${s.hp} HP · Atk ${Math.round(s.atk)} · Rng ${Math.round(s.rng)} · Mag ${Math.round(s.mag)} · Agi ${Math.round(s.agil)} · MDef ${Math.round(s.mdef)} · RDef ${Math.round(s.rdef)} · MgDef ${Math.round(s.magdef)}`;
}


function dropLabel(d: Drop): string {
  if (d.dropType === "item" && d.material) return `${d.name} ×${d.qty ?? 1}`;
  if (d.dropType === "reward") return `${d.amount} gold`;
  if (d.dropType === "card") return `${d.name} card`;
  return d.dropType === "item" ? `${d.name} (${d.rarity})` : d.name;
}

export default function DungeonPage() {
  const game = useGameState();
  const router = useRouter();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);
  const [lootOpen, setLootOpen] = useState(false); // an opened chest or sack, in its window with your bag
  const [notes, setNotes] = useState<string[]>([]);
  // Creatures that just levelled up: their show plays over the room (LevelUpShow).
  const [levelUps, setLevelUps] = useState<LevelUpInfo[]>([]);
  // Leaving for the Den: keep showing what's on screen until the Den loads
  // (otherwise the entrance flashes up for a moment on the way out).
  const [leaving, setLeaving] = useState(false);          // anything else that just happened (e.g. Second Wind)
  // The creature cards for the fight you've walked into (tap the creatures; see EncounterCards).
  const [cardsOpen, setCardsOpen] = useState(false);
  // A weapon or armour piece you just found, opened up (to compare and swap).
  const [viewGear, setViewGear] = useState<CreatureOrItemDrop | null>(null);
  // Gear about to go on a creature: compare first (EquipPreview), then equip.
  const [equipAsk, setEquipAsk] = useState<{ entry: BagEntry; creatureId: string } | null>(null);
  const askEquip = (entry: BagEntry, creatureId: string) => setEquipAsk({ entry, creatureId });
  // The roster or the bag, open over the screen (see Sheet).
  const [sheet, setSheet] = useState<"roster" | "bag" | null>(null);
  const [retreatArmed, setRetreatArmed] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false); // tapped back to the Den mid-run: it ends the run, so a word first
  // Bumped to shake the screen (the witch's stab, and the illness after it).
  const [shake, setShake] = useState(0);

  // Every change to the run is saved straight away.
  function update(next: DungeonSave) {
    saveDungeon(next);
    setLab(next);
  }
  // Nobody left standing means the run is over (you wake up in the Den).
  function updateRun(fn: (r: DungeonRun) => DungeonRun) {
    const cur = loadDungeon();
    if (!cur.run) return;
    const next = fn(cur.run);
    update({ ...cur, run: wipedOut(next) ? { ...next, status: "dead" } : next });
  }
  function updateBag(fn: (bag: BagEntry[]) => BagEntry[]) {
    const cur = loadDungeon();
    update({ ...cur, meta: { ...cur.meta, bag: fn(cur.meta.bag ?? []) } });
  }
  // A potion drunk: out of the bag, and (if it was found this run) out of the haul.
  const takeOne = (key: PotionKey) => {
    const cur = loadDungeon();
    const i = cur.meta.bag.indexOf(key);
    if (i < 0) return;
    update({ meta: { ...cur.meta, bag: [...cur.meta.bag.slice(0, i), ...cur.meta.bag.slice(i + 1)] }, run: cur.run && { ...cur.run, got: usedUp(cur.run.got, { potion: key }) } });
  };

  // What a bag entry holds: gear is one of your items (in storage); loot was
  // found this run and is kept in the bag until you get home.
  const itemsById = new Map(game.inventory.filter((x) => x.dropType === "item").map((x) => [x.id, x as CreatureOrItemDrop]));
  function itemOf(e: BagEntry, meta = lab?.meta): CreatureOrItemDrop | undefined {
    const g = gearIdOf(e);
    if (g) return itemsById.get(g);
    const l = lootIdOf(e);
    return l ? (meta?.loot?.[l] as CreatureOrItemDrop | undefined) : undefined;
  }
  const slotOf = (it: CreatureOrItemDrop): EquipSlot | null =>
    it.itemCategory === "weapon" ? "weapon" : it.itemCategory === "armor" && it.armorSlot ? it.armorSlot : null;

  // Put a weapon or armour piece from the bag on a creature. Loot joins your
  // storage first; whatever it replaces takes its place in the bag.
  function equipFromBag(entry: BagEntry, creatureId: string) {
    const cur = loadDungeon();
    const it = itemOf(entry, cur.meta);
    const slot = it && slotOf(it);
    if (!it || !slot) return;
    const loot = { ...(cur.meta.loot ?? {}) };
    if (lootIdOf(entry)) { game.addDrop(it); delete loot[it.id]; }
    const old = game.equipment[creatureId]?.[SLOT_FIELD[slot]];
    const bag = cur.meta.bag.map((e) => (e === entry ? (old ? gearEntry(old) : null) : e)).filter((e): e is BagEntry => e !== null);
    update({ ...cur, meta: { ...cur.meta, bag, loot } });
    game.equipItem(creatureId, slot, it.id);
  }

  // Used from the bag mid-fight: a potion, or a weapon for the creature on the field.
  function useFromBag(key: string, activeIndex: number) {
    const e = key as BagEntry;
    if (isPotionEntry(e)) { takeOne(e); return; }
    const creatureId = loadDungeon().run?.current?.fighters?.[activeIndex];
    if (creatureId) equipFromBag(e, creatureId);
  }

  // The bag's contents as the battle screen shows them.
  const bagForBattle = (bag: BagEntry[]): BagItem[] => [
    ...bagItems(bag.filter(isPotionEntry)),
    ...bag.flatMap((e) => {
      const w = itemOf(e);
      if (!w || w.itemCategory !== "weapon" || !w.itemKey) return [];
      const aff = DAMAGE_TYPE_INFO[WEAPON_AFFINITY[w.itemKey]];
      return [{ key: e, name: w.name, icon: "🗡️", count: 1, weapon: { ...itemToCombatStats(w.stats), affinity: WEAPON_AFFINITY[w.itemKey] },
        detail: `${aff.icon} ${aff.name} · ${w.rarity}` }];
    }),
  ];

  // Found something. Gold and creature cards take no space (and real
  // creatures aren't found lying about: they come as cards — an
  // encampment's cages are the exception, see openCage). Everything else
  // needs a slot (a material joins its stack if you have one); if the bag's
  // full it waits for you to make room. Materials join your tally at home.
  function carry(drops: Drop[]) {
    const cur = loadDungeon();
    let meta: DungeonSave["meta"] = { ...cur.meta, bag: [...(cur.meta.bag ?? [])], loot: { ...(cur.meta.loot ?? {}) } };
    const pending: Drop[] = [];
    for (const raw of drops) {
      const x = (raw.dropType === "creature" ? { ...raw, dropType: "card" } : raw) as Drop;
      if (x.dropType === "reward") { game.addGold(x.amount); continue; }
      if (x.dropType === "card") { game.addDrop(x); continue; }
      const next = stowDrop(meta, x); // (a potion goes straight in the bag, ready to drink)
      if (next) meta = next; else pending.push(x);
    }
    update({ meta, run: cur.run ? { ...cur.run, pending: [...(cur.run.pending ?? []), ...pending] } : null });
  }

  // Where you are, for things left on the floor.
  const here = (r: DungeonRun) => (r.current ? ROOM_INFO[r.current.kind].name : "the entrance");

  // Leave something from the bag on the floor, to make room. (Your own gear
  // leaves your storage too: it's down here now.)
  function leaveOnFloor(entry: BagEntry) {
    const cur = loadDungeon();
    if (!cur.run) return;
    const loot = { ...(cur.meta.loot ?? {}) };
    let item: FloorItem | null = null;
    if (isPotionEntry(entry)) item = { room: here(cur.run), potion: entry };
    else {
      const it = itemOf(entry, cur.meta);
      if (it) item = { room: here(cur.run), drop: it };
      if (it && gearIdOf(entry)) game.removeDrop(it.id);
      const l = lootIdOf(entry);
      if (l) delete loot[l];
    }
    const i = cur.meta.bag.indexOf(entry);
    const bag = i < 0 ? cur.meta.bag : [...cur.meta.bag.slice(0, i), ...cur.meta.bag.slice(i + 1)];
    // (If you picked it up this run, it's not part of your haul any more.)
    const got = [...(cur.run.got ?? [])];
    const gi = got.findIndex((g) => (item?.potion ? "potion" in g && g.potion === item.potion : "drop" in g && g.drop.id === item?.drop?.id));
    if (gi >= 0) got.splice(gi, 1);
    update({ meta: { ...cur.meta, bag, loot }, run: { ...cur.run, got, floor: [...(cur.run.floor ?? []), ...(item ? [item] : [])] } });
  }

  // Take something that was waiting for room.
  function takePending(id: string) {
    const cur = loadDungeon();
    const x = cur.run?.pending?.find((p) => p.id === id);
    const meta = x && stowDrop(cur.meta, x);
    if (!cur.run || !meta) return;
    update({ meta, run: { ...cur.run, pending: (cur.run.pending ?? []).filter((p) => p.id !== id) } });
  }

  // Whatever's still waiting stays on the floor.
  const leavePending = (r: DungeonRun): DungeonRun =>
    r.pending?.length ? { ...r, floor: [...(r.floor ?? []), ...r.pending.map((x) => ({ room: here(r), drop: x }))], pending: [] } : r;

  // ── The walk back (the boss is beaten) ──────────────────────────
  // Everything you left on the floors (and anything that was waiting for
  // room) is yours to take now — as much as your bag holds. Gold and
  // creature cards are picked up on the way; the rest you sort into your bag.
  const [walking, setWalking] = useState(false);
  function startWalkBack() {
    const cur = loadDungeon();
    if (!cur.run || cur.run.status !== "cleared") return;
    const all: FloorItem[] = [...(cur.run.floor ?? []), ...(cur.run.pending ?? []).map((x) => ({ room: "", drop: x }))];
    const free = all.filter((f) => f.drop && (f.drop.dropType === "reward" || f.drop.dropType === "card" || f.drop.dropType === "creature"));
    for (const f of free) {
      const d = f.drop!;
      if (d.dropType === "reward") game.addGold(d.amount);
      else game.addDrop({ ...d, dropType: "card" } as Drop);
    }
    update({ ...cur, run: { ...cur.run, floor: all.filter((f) => !free.includes(f)), pending: [], got: [...(cur.run.got ?? []), ...free.map((f) => ({ drop: f.drop! }))] } });
    setWalking(true);
  }
  // A thing on the floor: what it is (a potion as a stored-potion drop, for the bag).
  const floorDrop = (f: FloorItem): Drop => f.drop ?? potionDrop("", f.potion!);
  // Pick up something from the floor into your bag (if it fits).
  function floorTake(i: number) {
    const cur = loadDungeon();
    const f = cur.run?.floor?.[i];
    const meta = f && stowDrop(cur.meta, floorDrop(f));
    if (!cur.run || !f || !meta) return;
    const got: GotItem = f.drop ? { drop: f.drop } : { potion: f.potion! };
    update({ meta, run: { ...cur.run, floor: (cur.run.floor ?? []).filter((_, j) => j !== i), got: [...(cur.run.got ?? []), got] } });
  }
  // Put something from your bag down, to make room.
  function floorPut(bagIndex: number) {
    const e = loadDungeon().meta.bag[bagIndex];
    if (e) leaveOnFloor(e);
  }
  // Onto a bag slot: a full slot swaps (its thing goes on the floor, at the end, so i still points at the same thing).
  function floorSwap(i: number, bagIndex: number) {
    const cur = loadDungeon();
    const f = cur.run?.floor?.[i];
    if (!f) return;
    if (needsSlot(cur.meta, floorDrop(f)) && cur.meta.bag[bagIndex]) floorPut(bagIndex);
    floorTake(i);
  }
  function floorTakeAll() {
    for (let guard = 0; guard < 100; guard++) {
      const cur = loadDungeon();
      const full = cur.meta.bag.length >= bagSize(cur.meta);
      const floor = cur.run?.floor ?? [];
      const i = nextToTake(floor, (f) => !needsSlot(cur.meta, floorDrop(f)), (f) => (f.drop ? dropRank(f.drop) : -1), full);
      if (i < 0) break;
      floorTake(i);
      if ((loadDungeon().run?.floor ?? []).length === floor.length) break;
    }
  }

  const battle = usePlayableBattle((m) => updateRun((r) => ({ ...r, battle: m })));

  useEffect(() => {
    const saved = loadDungeon();
    setLab(saved);
    setOwned(loadOwnedCreatures());
    // Back in the middle of a fight? Carry on where you left off.
    if (saved.run?.battle && saved.run.current && !saved.run.current.done) battle.resume(saved.run.battle as Match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gear put on mid-run (Klutz's Club) shows up in the fight.
  useEffect(() => {
    if (game.hydrated) setOwned(loadOwnedCreatures());
  }, [game.hydrated, game.equipment, game.inventory]);

  const byId = (id: string) => owned.find((c) => c.id === id);
  const run = lab?.run ?? null;
  // No going back to the Den mid-fight, or from a room you haven't dealt with
  // yet (the same rule as taking a tunnel on).
  const denLocked = !!run && run.status === "exploring" && (!canMoveOn(run) || (!!battle.match && !battle.match.state.winner));
  const inRun = !!run;
  useEffect(() => {
    if (!inRun) return;
    // Esc would go back a page (EscapeBack), skipping the run's ending: the Den button does that.
    const stop = (e: KeyboardEvent) => { if (e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", stop);
    return () => window.removeEventListener("keydown", stop);
  }, [inRun]);

  // ── Starting and ending runs ──────────────────────────────────────
  function begin(party: string[], dungeon: DungeonId = 1) {
    if (!lab || fullBoxes(game.inventory).length > 0) return;
    const deep = dungeon === 2;
    const free = !deep && lab.meta.runs < FREE_RUNS;
    if (!free && !game.spendGold(ENTRY_FEE)) return;
    const hp = Object.fromEntries(party.map((id) => [id, lab.meta.injuries[id] ?? 1]));
    const team = party.slice(0, TEAM_SIZE).filter((id) => hp[id] > 0);
    // Klutz's dynamite quest: the large room is its storehouse (lib/tavern.ts).
    const dynamite = wantsStorehouse(loadTavern());
    if (deep) {
      const n = (lab.meta.deepRuns ?? 0) + 1;
      update({ meta: { ...lab.meta, deepRuns: n }, run: startRun(party, team, hp, n, Math.random, 2, dynamite, onBindle(lab.meta)) });
      return;
    }
    // Klutz's box: until it's back, runs are the quest's short run (club, then thief).
    const quest = wantsClub(game.quest) || wantsThief(game.quest);
    if (quest) game.acceptQuest();
    const r = quest ? startQuestRun(party, team, hp, lab.meta.runs + 1) : startRun(party, team, hp, lab.meta.runs + 1, Math.random, 1, dynamite, onBindle(lab.meta));
    update({ meta: { ...lab.meta, runs: lab.meta.runs + 1 }, run: r });
  }

  // Klutz's dynamite: yours for good as soon as you pick it up (no bag slot,
  // and it comes home whatever happens next: there isn't another).
  function grabDynamite() {
    if (!dynamiteHere(loadDungeon().run?.current ?? null)) return;
    updateTavern((t) => ({ ...t, dynamite: true }));
    updateRun(takeDynamite);
  }

  function goHome() {
    const cur = loadDungeon();
    let shelf = game.bookcaseSize - game.inventory.filter((x) => x.dropType === "item" && x.codexMove).length;
    const loot = { ...(cur.meta.loot ?? {}) };
    const bag: BagEntry[] = [];
    for (const e of cur.meta.bag ?? []) {
      const id = lootIdOf(e);
      const x = id ? loot[id] : undefined;
      if (!id || !x) { if (!id) bag.push(e); continue; }
      if (x.dropType === "item" && x.codexMove) {
        if (shelf <= 0) { bag.push(e); continue; } // the bookcase is full: it stays in the bag
        shelf--;
      }
      game.addDrop(x);
      delete loot[id];
    }
    update(endRun({ ...cur, meta: { ...cur.meta, bag, loot } }));
    updateTavern((t) => comeHome(t, Math.random, onBindle(cur.meta))); // home: a visitor may call at the tavern
    battle.clear();
    setNotes([]);
  }

  function healAll() {
    if (lab) update({ ...lab, meta: { ...lab.meta, injuries: {} } });
  }

  // ── Room rewards ──────────────────────────────────────────────────
  function give(drops: Drop[], also: (r: DungeonRun) => DungeonRun = (r) => r) {
    carry(drops);
    updateRun((r) => also({ ...r, loot: [...r.loot, ...drops.map(dropLabel)], got: [...(r.got ?? []), ...drops.map((drop) => ({ drop }))] }));
  }

  const goldOnly = (amount: number): Drop => ({ id: crypto.randomUUID(), barcode: "", dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() });
  const markDone = (r: DungeonRun): DungeonRun => (r.current ? { ...r, current: { ...r.current, done: true } } : r);

  function takeTreasure(room: Room) {
    give([goldOnly(room.gold ?? 0)], markDone);
  }

  function openChest() {
    // Barcode-style drops. (When the barcode merchant outcome arrives, it must be left out here.)
    const drops: Drop[] = [];
    while (drops.length < CHEST_DROPS) {
      const d = dropFromOutcome(rollBarcodeOutcome(CHEST_ODDS));
      if (d) drops.push(d);
    }
    if (Math.random() < CHEST_CODEX_CHANCE) drops[drops.length - 1] = codexDrop(randomCodexMove());
    const sack = capSack([...drops.map((d): SackItem => (d.dropType === "reward" ? { gold: d.amount } : { gear: d })), ...toolFinds(CHEST_TOOLS)]);
    updateRun((r) => (r.current ? { ...r, current: { ...r.current, sack, opened: true, done: true } } : r));
    setLootOpen(true);
  }

  function buyCodex(move: string) {
    const room = lab?.run?.current;
    if (!room?.offers?.includes(move) || room.bought?.includes(move) || !game.spendGold(codexPrice(move))) return;
    const codex = codexDrop(move);
    carry([codex]);
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, `Codex: ${move}`], got: [...(r.got ?? []), { drop: codex }], current: { ...r.current, bought: [...(r.current.bought ?? []), move] } } : r));
  }

  function healOne(id: string) {
    updateRun((r) => markDone({ ...r, hp: { ...r.hp, [id]: 1 } }));
  }

  // ── The battle bag ──────────────────────────────────────────────
  // The merchant's cart: one of each thing. Potions, scrolls and tools take
  // a bag slot; materials go in your pouch.
  function buyWare(w: Ware) {
    const cur = loadDungeon();
    if ("backpack" in w) {
      // The rugged backpack, off his cart: more room in your bag from now on.
      if (!onBindle(cur.meta) || cur.run?.current?.bought?.includes(w.key) || !game.spendGold(w.price)) return;
      update({ ...cur, meta: { ...cur.meta, bagSize: BACKPACK } });
      setNotes((n) => [...n, `🎒 A rugged backpack! You can carry ${BACKPACK} things now (your bindle held ${BINDLE}).`]);
      updateRun((r) => (r.current ? { ...r, bindle: undefined, loot: [...r.loot, wareName(w)], current: { ...r.current, bought: [...(r.current.bought ?? []), w.key] } } : r));
      return;
    }
    const d = "potion" in w ? undefined : "scroll" in w ? scrollDrop() : "tool" in w ? toolDrop(w.tool) : materialDrop(w.material, w.qty);
    const slot = d ? needsSlot(cur.meta, d) : true;
    if (cur.run?.current?.bought?.includes(w.key) || (slot && (cur.meta.bag ?? []).length >= bagSize(cur.meta)) || !game.spendGold(w.price)) return;
    let got: GotItem;
    if ("potion" in w) {
      updateBag((bag) => addToBag(bag, [w.potion], bagSize(cur.meta)));
      got = { potion: w.potion };
    } else {
      carry([d!]);
      got = { drop: d! };
    }
    updateRun((r) => (r.current
      ? { ...r, loot: [...r.loot, wareName(w)], got: [...(r.got ?? []), got], current: { ...r.current, bought: [...(r.current.bought ?? []), w.key] } }
      : r));
  }

  // Sell something from your bag to the merchant, to make room. Your own gear
  // leaves your collection; something found this run leaves the haul.
  const offerFor = (e: BagEntry, meta = lab?.meta) => merchantOffer(e, isPotionEntry(e) ? undefined : itemOf(e, meta), game.crateSellValue);
  function sellToMerchant(bagIndex: number) {
    const cur = loadDungeon();
    const entry = cur.meta.bag[bagIndex];
    if (cur.run?.current?.kind !== "merchant" || !entry) return;
    const price = offerFor(entry, cur.meta);
    if (price <= 0) return;
    const loot = { ...(cur.meta.loot ?? {}) };
    let got = cur.run.got;
    if (isPotionEntry(entry)) got = usedUp(got, { potion: entry });
    else {
      const it = itemOf(entry, cur.meta);
      if (!it) return;
      if (gearIdOf(entry)) game.removeDrop(it.id);
      const l = lootIdOf(entry);
      if (l) delete loot[l];
      got = usedUp(got, { dropId: it.id });
    }
    game.addGold(price);
    update({ meta: { ...cur.meta, bag: cur.meta.bag.filter((_, i) => i !== bagIndex), loot }, run: { ...cur.run, got } });
  }

  // ── Encampments ─────────────────────────────────────────────────
  // Open a cage: if a creature's in it, it's yours (it joins your
  // collection at level 1). In an ambush, opening the first cage springs it:
  // two of them jump you at once.
  function openCage(i: number) {
    const cur = loadDungeon();
    const room = cur.run?.current;
    const cage = room?.cages?.[i];
    if (!cur.run || !room || !cage || cage.opened) return;
    if (room.variant === "ambush" && !room.sprung) {
      const next = { ...cur.run, current: { ...room, sprung: true } };
      update({ ...cur, run: next });
      startFight(next);
      return;
    }
    if (hasFight(room) && !room.done) return; // beat them first
    const t = cage.creatureId ? CREATURE_BY_ID[cage.creatureId] : undefined;
    const creature = t ? makeCreatureDrop(t, "creature", "") : undefined;
    if (creature) game.addDrop(creature);
    if (creature) setNotes((n) => [...n, `🔓 A ${t!.name} creeps out of the cage — it's yours!`]);
    else setNotes((n) => [...n, "🔓 The cage is empty."]);
    updateRun((r) => (r.current ? {
      ...r, loot: [...r.loot, ...(creature ? [creature.name] : [])], got: [...(r.got ?? []), ...(creature ? [{ drop: creature }] : [])],
      current: { ...r.current, cages: (r.current.cages ?? []).map((c, j) => (j === i ? { ...c, opened: true } : c)) },
    } : r));
  }

  // ── Flares and clairvoyance scrolls (from the bag) ──────────────
  // A flare lights up where you stand (and shows you the map); a
  // clairvoyance scroll shows you the map to pick a room to look into.
  // ("view": the Scroll button, just looking at your map again)
  const [mapOpen, setMapOpen] = useState<"look" | "pick" | "view" | null>(null);
  function useTool(entry: BagEntry) {
    const cur = loadDungeon();
    const it = itemOf(entry, cur.meta);
    if (!cur.run || !it?.tool) return;
    if (it.tool === "clairvoyance") { setSheet(null); setMapOpen("pick"); return; }
    spendTool(entry);
    updateRun((r) => ({ ...r, lit: [...new Set([...(r.lit ?? []), runPosition(r)])] }));
    setSheet(null);
    setMapOpen("look");
  }
  function spendTool(entry: BagEntry) {
    const cur = loadDungeon();
    const id = lootIdOf(entry);
    const loot = { ...(cur.meta.loot ?? {}) };
    if (id) delete loot[id];
    const i = cur.meta.bag.indexOf(entry);
    update({ meta: { ...cur.meta, loot, bag: i < 0 ? cur.meta.bag : [...cur.meta.bag.slice(0, i), ...cur.meta.bag.slice(i + 1)] }, run: cur.run && id ? { ...cur.run, got: usedUp(cur.run.got, { dropId: id }) } : cur.run });
  }
  // The clairvoyance scroll: you picked a room.
  function foresee(nodeId: string) {
    const cur = loadDungeon();
    const entry = (cur.meta.bag ?? []).find((e) => itemOf(e, cur.meta)?.tool === "clairvoyance");
    if (!cur.run || !entry) return;
    spendTool(entry);
    updateRun((r) => ({ ...r, lit: [...new Set([...(r.lit ?? []), nodeId])], seen: [...new Set([...(r.seen ?? []), nodeId])] }));
    setMapOpen("look");
  }

  // A stash: open the sack…
  function openSack() {
    updateRun((r) => (r.current ? { ...r, current: { ...r.current, opened: true, done: true } } : r));
    setLootOpen(true);
  }
  // …and take something out: potions and gear need a slot in your bag, gold doesn't.
  function takeFromSack(index: number) {
    const cur = loadDungeon();
    const item = cur.run?.current?.sack?.[index];
    if (!cur.run?.current || !item) return;
    const full = (cur.meta.bag ?? []).length >= bagSize(cur.meta);
    if ("backpack" in item) {
      // The rugged backpack: more room in your bag from now on.
      update({ ...cur, meta: { ...cur.meta, bagSize: BACKPACK } });
      setNotes((n) => [...n, `🎒 A rugged backpack! You can carry ${BACKPACK} things now (your bindle held ${BINDLE}).`]);
      updateRun((r) => (r.current ? { ...r, bindle: undefined, loot: [...r.loot, "A rugged backpack"], current: { ...r.current, sack: (r.current.sack ?? []).filter((_, i) => i !== index) } } : r));
      return;
    }
    const roomless = "gear" in item && !needsSlot(cur.meta, item.gear);
    if ("gold" in item) game.addGold(item.gold);
    else if (full && !roomless) return;
    else if ("potion" in item) updateBag((bag) => addToBag(bag, [item.potion], bagSize(cur.meta)));
    else carry([item.gear]);
    if ("gear" in item && isClub(item.gear as CreatureOrItemDrop)) game.questFoundClub();
    const label = "gold" in item ? `${item.gold} gold` : "potion" in item ? POTIONS[item.potion].name : dropLabel(item.gear);
    const got: GotItem = "gold" in item ? { drop: goldOnly(item.gold) } : "potion" in item ? { potion: item.potion } : { drop: item.gear };
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, label], got: [...(r.got ?? []), got], current: { ...r.current, sack: (r.current.sack ?? []).filter((_, i) => i !== index) } } : r));
  }
  // From your bag into the open chest or sack (you can take it back while you're here).
  function putInSack(bagIndex: number) {
    const cur = loadDungeon();
    const entry = cur.meta.bag[bagIndex];
    if (!cur.run?.current || !entry) return;
    const loot = { ...(cur.meta.loot ?? {}) };
    let item: SackItem | null = null;
    if (isPotionEntry(entry)) item = { potion: entry };
    else {
      const it = itemOf(entry, cur.meta);
      if (!it) return;
      item = { gear: it };
      if (gearIdOf(entry)) game.removeDrop(it.id); // your own gear: it's down here now
      const l = lootIdOf(entry);
      if (l) delete loot[l];
    }
    const bag = cur.meta.bag.filter((_, i) => i !== bagIndex);
    // (If you picked it up this run, it's not part of your haul any more.)
    const got = [...(cur.run.got ?? [])];
    const gi = got.findIndex((g) => ("potion" in item! ? "potion" in g && g.potion === (item as { potion: PotionKey }).potion : "drop" in g && g.drop.id === (item as { gear: Drop }).gear.id));
    if (gi >= 0) got.splice(gi, 1);
    update({ meta: { ...cur.meta, bag, loot }, run: { ...cur.run, got, current: { ...cur.run.current, sack: [...(cur.run.current.sack ?? []), item] } } });
  }
  // Something from the chest into a bag slot: a full slot swaps (its thing goes in the chest).
  function swapFromSack(lootIndex: number, bagIndex: number) {
    const cur = loadDungeon();
    const item = cur.run?.current?.sack?.[lootIndex];
    if (!item) return;
    const roomless = "gold" in item || "backpack" in item || ("gear" in item && !needsSlot(cur.meta, item.gear));
    if (!roomless && cur.meta.bag[bagIndex]) putInSack(bagIndex); // (it goes on the end: lootIndex still points at the same thing)
    takeFromSack(lootIndex);
  }
  function takeAllFromSack() {
    // Whatever takes no space first (gold, the backpack, cards, materials
    // that join a stack), then the rarest things, while they fit.
    for (let guard = 0; guard < 100; guard++) {
      const cur = loadDungeon();
      const sack = cur.run?.current?.sack ?? [];
      const free = (x: SackItem) => "gold" in x || "backpack" in x || ("gear" in x && !needsSlot(cur.meta, x.gear));
      const full = cur.meta.bag.length >= bagSize(cur.meta);
      const i = nextToTake(sack, free, sackRank, full);
      if (i < 0) break;
      takeFromSack(i);
      if ((loadDungeon().run?.current?.sack ?? []).length === sack.length) break;
    }
  }
  // Whatever you leave in a sack or chest you opened stays on the floor (to
  // pick up on the walk back once the boss is beaten). One you never opened
  // keeps what's in it: loot only ever comes out of an opened chest or sack.
  const leaveSack = (r: DungeonRun): DungeonRun => {
    const sack = (r.current?.opened ? r.current.sack : undefined) ?? [];
    if (sack.length === 0) return r.current?.sack?.length ? { ...r, current: { ...r.current, sack: [] } } : r;
    const floor: FloorItem[] = sack.filter((x) => !("backpack" in x)).map((x) => ("potion" in x ? { room: here(r), potion: x.potion } : { room: here(r), drop: "gold" in x ? goldOnly(x.gold) : (x as { gear: Drop }).gear }));
    return { ...r, floor: [...(r.floor ?? []), ...floor], current: r.current ? { ...r.current, sack: [] } : r.current };
  };

  // Between rooms: drink a potion on anyone still standing.
  function drink(key: PotionKey, id: string) {
    const c = byId(id);
    const hp = run?.hp[id] ?? 1;
    if (!c || hp <= 0 || hp >= 1 || !(lab?.meta.bag ?? []).includes(key)) return;
    takeOne(key);
    updateRun((r) => ({ ...r, hp: { ...r.hp, [id]: Math.min(1, hp + POTIONS[key].heal / c.fighter.maxHp) } }));
  }
  // …or one straight out of the open chest or sack, without it going in your bag.
  function drinkFromSack(index: number, id: string) {
    const c = byId(id);
    const r0 = loadDungeon().run;
    const item = r0?.current?.sack?.[index];
    const key = !item ? undefined : "potion" in item ? item.potion : "gear" in item ? (item.gear as CreatureOrItemDrop).potion : undefined;
    const hp = r0?.hp[id] ?? 1;
    if (!c || !key || hp <= 0 || hp >= 1) return;
    updateRun((r) => (r.current ? { ...r, hp: { ...r.hp, [id]: Math.min(1, hp + POTIONS[key].heal / c.fighter.maxHp) },
      current: { ...r.current, sack: (r.current.sack ?? []).filter((_, i) => i !== index) } } : r));
  }

  // A deck of cards: DECK_CARDS creature cards, each rolled like a scan.
  function openDeck() {
    const drops = Array.from({ length: DECK_CARDS }, () =>
      makeCreatureDrop(CREATURE_BY_ID[pickCreatureId(pickRarity("", "random"))], "card", ""));
    give(drops, markDone);
  }

  // The boss is beaten: the run is over.
  function nextRoom() {
    setLootOpen(false);
    setNotes([]);
    battle.clear();
    updateRun((r) => leaveRoom(leaveSack(r)));
  }

  // Down a tunnel into the next room. Leaving rare (or better) things behind
  // in a chest or sack you opened? A word first (force: you said leave them).
  const [nudge, setNudge] = useState<{ nodeId: string; items: Drop[] } | null>(null);
  function goTo(nodeId: string, force = false) {
    const standing = loadDungeon().run;
    const rare = standing ? rareLeftBehind(standing) : [];
    if (!force && rare.length > 0) { setNudge({ nodeId, items: rare }); return; }
    setNudge(null);
    // Leaving the witch mid-game: you walk away with what you've won.
    const w = loadDungeon().run?.current?.witch;
    if (w?.state === "playing" && w.correct > 0) witchLeave();
    setLootOpen(false);
    setNotes([]);
    battle.clear();
    // On the quest's run: the club's room (empty once you've got it), then the thief.
    const club = wantsClub(game.quest);
    let hurt: string | undefined;
    updateRun((r) => {
      let n = moveOn(leaveSack(leavePending(r)), nodeId);
      if (n.path.length === r.path.length) return n;
      // The witch's illness: each room walked into is an action.
      const tick = illnessTick(n);
      n = tick.run;
      hurt = tick.hurt;
      if (!r.map.quest) return n;
      if (nodeId === "thief") return { ...n, current: thiefRoom() };
      return { ...n, current: club ? clubRoom() : { kind: "treasure", gold: 0, done: true } };
    });
    if (hurt) {
      setShake((s) => s + 1);
      setNotes([`🤢 Your ${byId(hurt)?.name ?? "creature"} suffers an illness: −${Math.round(ILLNESS_DAMAGE * 100)}% HP.`]);
    }
  }

  // ── The card witch ─────────────────────────────────────────────────
  function witchSit() {
    updateRun((r) => (r.current?.witch ? { ...r, current: { ...r.current, witch: sitDown(r.current.witch) } } : r));
  }
  function witchPlay(g: Guess) {
    let stabbed: string | undefined;
    updateRun((r) => {
      const w = r.current?.witch;
      if (!r.current || !w) return r;
      const next = witchGuess(w, g, Math.random, witchPrize);
      let n: DungeonRun = { ...r, current: { ...r.current, witch: next } };
      if (next.state === "lost") {
        n = markDone(curse(n));
        stabbed = n.illness?.id;
      }
      return n;
    });
    if (stabbed) {
      setShake((s) => s + 1);
      setNotes([`🗡️ The witch lunges and stabs your ${byId(stabbed)?.name ?? "creature"}! It suffers an illness: −${Math.round(ILLNESS_DAMAGE * 100)}% HP for each of the next ${ILLNESS_ACTIONS} actions (rooms or fight rounds).`]);
    }
    // Her deck's spent: you walk away with your winnings.
    const after = loadDungeon().run?.current;
    if (after?.witch?.state === "left" && !after.done) witchPayout(after.witch);
  }
  function witchLeave() {
    const w = loadDungeon().run?.current?.witch;
    if (!w || w.state !== "playing") return;
    updateRun((r) => (r.current?.witch ? { ...r, current: { ...r.current, witch: walkAway(r.current.witch) } } : r));
    witchPayout(w);
  }
  // The cards you won from her (the prizes you saw on the table).
  function witchPayout(w: WitchGame) {
    const ids = w.won ?? Array.from({ length: w.correct }, witchPrize); // (a game from before her prizes showed)
    if (ids.length === 0) { updateRun(markDone); return; }
    give(ids.map((id) => makeCreatureDrop(CREATURE_BY_ID[id], "card", "")), markDone);
  }

  // Klutz's box, picked up off the floor where the thief dropped it.
  function takeBox() {
    game.questBoxFound(rollBox());
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, "Klutz's box"], current: { ...r.current, boxTaken: true } } : r));
  }
  // …and straight home with it, to Klutz.
  function boxHome() {
    setLeaving(true);
    updateRun((x) => ({ ...x, status: "retreated", battle: undefined }));
    goHome();
    router.push("/");
  }

  // Back to the Den: the run ends there and then, as if you'd retreated (your
  // bag comes home; what's on the floors is lost).
  function leaveRun() {
    const r = loadDungeon().run;
    if (!r) return;
    setLeaveAsk(false);
    setLeaving(true);
    if (r.status === "exploring") {
      witchLeave(); // (mid-game with the witch: you walk away with the cards you've won)
      updateRun((x) => ({ ...leaveSack(x), status: "retreated", battle: undefined }));
    }
    if (r.status === "dead") game.noteLabyrinthDeath();
    goHome();
    router.push("/");
  }

  // Klutz's Club, picked up off the floor (a club room from an older save:
  // now it's in a chest, looted like any other).
  function takeClub() {
    give([klutzClub()], markDone);
    game.questFoundClub();
  }

  // ── Fights ────────────────────────────────────────────────────────
  function startFight(r: DungeonRun) {
    const room = r.current!;
    const own = fightingTeam(r).filter((id) => byId(id));
    const mine = own.map((id) => byId(id)!);
    // The thief: Klutz talks you through it from the side; your first
    // creature gets one move for each of his lessons (for this fight only).
    const tutorial = room.quest === "thief";
    const fighters = mine.map((c, i) => (tutorial && i === 0 ? { ...c.fighter, skills: TUTORIAL_MOVES.map((n) => MOVE_BY_NAME[n]) } : c.fighter));
    const ids = own;
    const sick = r.illness ? ids.indexOf(r.illness.id) : -1;
    const info: MemberInfo[] = room.boss
      ? CYCLOPS_PARTS.map((p) => ({ rarity: CREATURE_BY_ID[p.id].rarity, label: p.label, weaponName: p.weaponName, armorName: p.armorName, creatureId: p.id }))
      : room.enemies!.map((e) => ({
          rarity: CREATURE_BY_ID[e.creatureId].rarity,
          label: creatureTypeLabel(e.proficiency), creatureId: e.creatureId,
          weaponName: e.gear[0] ? gearName(e.gear[0]) : undefined,
          armorName: e.gear[1] ? gearName(e.gear[1]) : undefined,
        }));
    updateRun((x) => ({ ...x, current: { ...x.current!, fighters: ids } }));
    if (room.enemies) game.markSeen(room.enemies.map((e) => e.creatureId));
    battle.start(
      { A: fighters, B: room.boss ? cyclopsTeam(CYCLOPS_LEVEL) : room.enemies!.map(enemyFighter) },
      { A: mine, B: info },
      room.level ?? "hard",
      {
        startHp: mine.map((c, i) => Math.round((r.hp[own[i]] ?? 1) * c.fighter.maxHp)),
        title: room.boss ? "Labyrinth · the Cyclops" : `${DUNGEONS[dungeonOf(r)].name} · ${ROOM_INFO[room.kind].name}`,
        boss: room.boss,
        illness: sick >= 0 ? { index: sick, rounds: r.illness!.left } : undefined,
        tutorial,
        pair: room.kind === "encampment" && room.variant === "ambush",
        turnLimit: room.kind === "encampment" && room.variant === "rigged" ? ENCAMP_FUSE : undefined,
      },
    );
  }

  // The fight is over: HP comes back to the party, and the winner's rewards.
  function finishFight(r: DungeonRun, m: Match) {
    const ids = r.current?.fighters ?? [];
    const hp = { ...r.hp };
    const A = m.state.sides.A, B = m.state.sides.B;
    A.team.forEach((f, i) => { if (ids[i] && ids[i] !== KLUTZ_DROP_ID) hp[ids[i]] = f.hp / f.maxHp; });
    // Who was on the field at the end (the witch's next target), and what's left of any illness.
    const last = ids[A.active] && ids[A.active] !== KLUTZ_DROP_ID ? ids[A.active] : r.lastOnField;
    const sickAt = r.illness ? ids.indexOf(r.illness.id) : -1;
    const sickLeft = sickAt >= 0 ? (A.team[sickAt].statuses.find((s) => s.id === "illness")?.rounds ?? 0) : r.illness?.left ?? 0;
    const illness = r.illness && sickLeft > 0 && (hp[r.illness.id] ?? 1) > 0 ? { ...r.illness, left: sickLeft } : undefined;
    // XP (only for a win: no levelling up by throwing fights): every enemy
    // knocked out. You get all of it; your team shares it by how much each
    // did (at least 10% each, even from the bench).
    const room0 = r.current!;
    const xp = m.state.winner !== "A" ? 0 : B.team.reduce((sum, f, i) => {
      if (f.hp > 0) return sum;
      if (room0.boss) return sum + BOSS_XP;
      const e = room0.enemies?.[i];
      return sum + (e ? xpForEnemy(e.level ?? 15, CREATURE_BY_ID[e.creatureId].rarity) : 0);
    }, 0);
    const xpNotes: string[] = [];
    if (xp > 0) {
      const mineAt = ids.map((id, i) => (id && id !== KLUTZ_DROP_ID ? i : -1)).filter((i) => i >= 0);
      const impacts = impactsFromLog(m.state.log, "A", ids.length);
      const shares = shareXp(xp, mineAt.map((i) => impacts[i]));
      const gains: Record<string, number> = {};
      mineAt.forEach((i, k) => { gains[ids[i]] = shares[k]; });
      const parts = mineAt.map((i, k) => `${byId(ids[i])?.name} +${shares[k]}`);
      xpNotes.push(`✨ ${xp} XP — ${parts.join(", ")}`);
      const ups = game.gainXp(gains);
      for (const u of ups) xpNotes.push(`⬆️ ${u.name} reached level ${u.to}!`);
      setLevelUps(ups.flatMap((u) => {
        const c = byId(u.id);
        const drop = game.inventory.find((d) => d.id === u.id) as CreatureOrItemDrop | undefined;
        return c ? [{ ...u, creatureId: c.creatureId, template: c.template, rolled: drop?.proficiency }] : [];
      }));
      const you = game.gainPlayerXp(xp);
      if (you) xpNotes.push(`🌟 You reached explorer level ${you}!`);
    }
    const after = (x: DungeonRun): DungeonRun => ({ ...x, lastOnField: last, illness });
    // Second Wind (a full Frontier's Mail set): a won fight heals a little.
    const winds: string[] = [];
    if (m.state.winner === "A") {
      for (const id of ids) {
        const c = byId(id);
        if (c?.fighter.armorSet !== "frontiers_mail" || hp[id] <= 0 || hp[id] >= 1) continue;
        hp[id] = Math.min(1, hp[id] + SECOND_WIND_HEAL);
        winds.push(`🛡️ ${SET_BONUS.frontiers_mail.name}: ${c.name} recovers ${Math.round(SECOND_WIND_HEAL * 100)}% HP`);
      }
    }
    if (m.state.winner !== "A") {
      updateRun((x) => ({ ...after(x), hp, status: "dead", battle: undefined }));
      battle.clear();
      return;
    }
    const room = r.current!;
    if (room.quest === "thief") {
      // It runs off, and the box it was carrying drops to the floor (the box is the prize: no gold).
      updateRun((x) => markDone({ ...after(x), hp, battle: undefined }));
      setNotes(xpNotes);
      return;
    }
    const drops: Drop[] = [goldOnly(room.gold ?? 0)];
    for (const e of room.enemies ?? []) {
      for (const p of e.gear) {
        if (!p.drops) continue;
        // Enemies wear a whole set; one piece of it drops (chosen with the room; old saves: at random).
        const slot = p.dropSlot ?? randomArmorSlot();
        drops.push(p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey, p.rarity, "", droppedPieceStats(p, slot), slot));
      }
    }
    // Its loot lies on the floor: a rickety chest (bosses) or a sack. Open it and take what you want.
    const sack: SackItem[] = drops.map((d) => (d.dropType === "reward" ? { gold: d.amount } : { gear: d }));
    // A boss's chest (the Cyclops', the Warden's strongbox): gear, codexes and potions as well as its gold.
    if (room.kind === "boss") sack.push(...cyclopsChest());
    const miniboss = room.kind === "miniboss" || (room.kind === "storehouse" && room.guarded);
    // A mini boss's chest: potions (and now and then a clairvoyance scroll, or the cage schematic).
    if (miniboss) sack.push(...minibossExtras(Math.random, game.wantsCagePlan()));
    // Mini boss and boss chests sometimes hold an XP scroll.
    if (Math.random() < (room.kind === "boss" ? BOSS_SCROLL_CHANCE : miniboss ? MINIBOSS_SCROLL_CHANCE : 0)) sack.push({ gear: scrollDrop() });
    // A guarded storehouse: its stores are yours too, in the same haul.
    if (room.kind === "storehouse") sack.push(...(room.sack ?? []));
    // Until you've got a rugged backpack, the Cyclops' chest holds one.
    if (room.boss && bagSize(loadDungeon().meta) < BACKPACK) sack.unshift({ backpack: true });
    const container = room.kind === "boss" && !room.boss ? "strongbox" as const : miniboss || room.kind === "boss" ? "chest" as const : "sack" as const;
    updateRun((x) => markDone({ ...after(x), hp, battle: undefined, current: x.current ? { ...x.current, sack, container, opened: false } : x.current }));
    setNotes([...xpNotes, ...winds]);
  }

  // ── Screens ───────────────────────────────────────────────────────
  if (!lab || !game.hydrated) {
    return <DenFrame title="The Labyrinth" icon="🌀" width={COLUMN}><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  }

  // fill: the content gets the whole screen (a battle); dock: built into the bottom of the screen.
  const frame = (children: React.ReactNode, opts: { fill?: boolean; dock?: React.ReactNode } = {}) => (
    <DenFrame title={run?.dungeon === 2 ? DUNGEONS[2].name : "The Labyrinth"} icon="🌀" gold={game.gold} width={COLUMN} fill={opts.fill} dock={opts.dock}
      backLocked={denLocked ? (battle.match && !battle.match.state.winner ? "Not mid-fight" : "Deal with this room first") : undefined}
      onBack={!run || leaving ? undefined : run.status === "dead" || run.status === "retreated" ? leaveRun : () => setLeaveAsk(true)}>
      <Shaker shake={shake} fill={opts.fill}>{children}</Shaker>
      {leaveAsk && run && (
        <Sheet title="Leave the labyrinth?" onClose={() => setLeaveAsk(false)}>
          <p style={{ fontSize: 14, color: "#d8d4c8", margin: "0 0 8px" }}>
            {run.status === "cleared" ? "You head home. Anything still on the floors is lost." : "This run ends. Your bag comes home; anything on the floors is lost."}
          </p>
          <div className="dock-tabs">
            <button className="dock-tab" onClick={() => setLeaveAsk(false)}>Stay</button>
            <button className="dock-tab" style={{ color: "#ff8a80" }} onClick={leaveRun}>Leave</button>
          </div>
        </Sheet>
      )}
    </DenFrame>
  );

  if (leaving) return frame(<p className="pixel-font" style={{ color: MUTED, textAlign: "center", marginTop: 40 }}>Back to the Den…</p>);

  if (!run) {
    return frame(<Entrance lab={lab} owned={owned} gold={game.gold} full={fullBoxes(game.inventory)} onBegin={begin} onHeal={healAll} />);
  }


  // A fight in progress (or just finished).
  if (battle.match && run.current && hasFight(run.current) && !run.current.done && run.status === "exploring") {
    const m = battle.match;
    const over = !battle.view && m.state.winner;
    return frame(
      <>
        <BattleView
          battle={battle}
          showEstimates={lab.meta.clears === 0}
          bag={bagForBattle(lab.meta.bag ?? [])}
          onUseItem={useFromBag}
          finishedActions={over && (
            <button className="pixel-btn" onClick={() => finishFight(run, m)}>
              {m.state.winner === "A" ? "Collect your reward" : "Everything goes dark…"}
            </button>
          )}
        />
      </>,
      { fill: true },
    );
  }

  if (run.status === "cleared" && walking) {
    return frame(
      <WalkBack run={run} lab={lab} itemOf={itemOf}
        onTake={floorTake} onTakeAll={floorTakeAll} onSwap={floorSwap} onPut={floorPut}
        onHome={() => { setLeaving(true); setWalking(false); goHome(); router.push("/"); }} />,
    );
  }

  if (run.status !== "exploring") {
    return frame(<RunOver run={run} lab={lab} onWalkBack={startWalkBack} onHome={() => {
      // Knocked out (Klutz dragged you back) or retreated: back to the Den.
      const died = run.status === "dead";
      const toDen = died || run.status === "retreated";
      if (toDen) setLeaving(true);
      if (died) game.noteLabyrinthDeath();
      goHome();
      if (toDen) router.push("/");
    }} />);
  }

  // The club tutorial: it's in your bindle and not on anyone yet.
  const clubEntry = (lab.meta.bag ?? []).find((e) => itemOf(e)?.itemKey === "klutz_club");
  const clubTutorial = run.current?.quest === "club" && run.current.done && clubEntry ? clubEntry : undefined;
  // …or still on the floor: the way on stays shut until it's on someone.
  const clubOnFloor = run.current?.quest === "club" && (run.current.sack ?? []).some((x) => "gear" in x && isClub(x.gear as CreatureOrItemDrop));
  // Your creatures still standing: gear from the bag can be dragged onto them.
  const standingTeam = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0)
    .map((id) => ({ id, name: byId(id)!.name, creatureId: byId(id)!.creatureId, hp: run.hp[id] ?? 1 }));
  // The thief's room: once it's beaten, the way on is home (with the box).
  const boxRoom = run.current?.quest === "thief" && run.current.done;
  // A fight waiting here: the Fight! button sits on the room, and tapping the
  // creatures brings up their cards (with a Fight button of their own).
  const fightHere = !!run.current && hasFight(run.current) && !run.current.done;
  const enemyIds = fightHere && !run.current!.boss ? (run.current!.enemies ?? []).map((e) => e.creatureId) : [];
  const canFight = fightHere && fightingTeam(run).length > 0;
  const showCards = run.inside && enemyIds.length > 0 && cardsOpen;

  // A piece of gear you just found, opened up: compare it with what your
  // creatures (those still standing) wear, and swap it onto one. It can only
  // be swapped while it's in your bag.
  const gearView = (item: CreatureOrItemDrop) => {
    const slot = slotOf(item);
    if (!slot) return null;
    const entry = lootEntry(item.id);
    const inBag = (lab.meta.bag ?? []).includes(entry);
    const standing = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0);
    return (
      <GearViewModal item={item} slotName={slot} onClose={() => setViewGear(null)}
        creatures={standing.map((id) => ({ id, name: byId(id)!.name, creatureId: byId(id)!.creatureId, worn: itemsById.get(game.equipment[id]?.[SLOT_FIELD[slot]] ?? "") }))}
        onSwap={inBag ? (id) => { askEquip(entry, id); setViewGear(null); } : undefined}
        why={inBag ? undefined
          : (run.pending ?? []).some((d) => d.id === item.id) ? "Your bag's full, so it's still on the floor. Make room to swap it on."
          : "It's not in your bag any more."} />
    );
  };

  const partyView = <Party run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))} />;
  const bagView = (
    <Bag run={run} bag={lab.meta.bag ?? []} slots={bagSize(lab.meta)} name={bagName(lab.meta)} itemOf={itemOf} slotOf={slotOf}
      byId={byId} onDrink={drink} onEquip={askEquip} onLeave={leaveOnFloor} tutorial={clubTutorial} onTool={useTool}
      wornIn={(id, slot) => itemsById.get(game.equipment[id]?.[SLOT_FIELD[slot]] ?? "")} />
  );

  return frame(
    <>
      {!run.inside ? (
        <MapFirst run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))}
          onStep={() => updateRun(stepInside)} onEnter={(id) => { updateRun(stepInside); goTo(id); }} />
      ) : (
        <>
          <div className="room-bleed"><DungeonRoomView run={run} open={canMoveOn(run) && fightingTeam(run).length > 0 && !clubTutorial && !clubOnFloor && !boxRoom} onGo={goTo}
            onObject={run.current?.opened && (run.current.sack?.length ?? 0) > 0 ? () => setLootOpen(true)
              : run.current?.quest === "club" && !run.current.done ? (run.current.sack ? openSack : takeClub)
              : run.current?.kind === "chest" && !run.current.done ? openChest
              : run.current?.container && run.current.done && !run.current.opened ? openSack
              : run.current?.quest === "thief" && run.current.done && !run.current.boxTaken ? takeBox
              : run.current?.kind === "stash" && !run.current.opened ? openSack
              : (run.current?.kind === "storehouse" || run.current?.kind === "library") && !hasFight(run.current) && run.current.sack && !run.current.opened ? openSack
              : undefined}
            onFight={canFight ? () => startFight(run) : undefined}
            onEnemies={enemyIds.length > 0 ? () => setCardsOpen(true) : undefined} /></div>
          {viewGear && gearView(viewGear)}
          {lootOpen && run.current?.opened && (() => {
            const c = run.current!;
            const bag = lab.meta.bag ?? [];
            // The club teaches looting: into your bag, then onto a creature.
            const clubAt = (c.sack ?? []).findIndex((x) => "gear" in x && isClub(x.gear as CreatureOrItemDrop));
            const clubInBag = bag.findIndex((e) => isClub(itemOf(e)));
            const teach = c.quest !== "club" ? undefined
              : clubAt >= 0 ? { step: "take" as const, i: clubAt }
              : clubInBag >= 0 ? { step: "equip" as const, i: clubInBag }
              : { step: "done" as const, i: -1 };
            return (
              <LootWindow
                name={c.quest === "club" ? "On the floor" : c.kind === "chest" ? "The chest" : c.container === "strongbox" ? "The Warden's strongbox" : c.container === "chest" ? "The rickety chest" : c.kind === "stash" ? "The stash"
                  : c.kind === "library" ? "The shelves" : c.kind === "storehouse" ? "The stores" : "The sack"}
                sprite={c.quest === "club" ? WEAPON_SPRITES.klutz_club : c.kind === "chest" ? TREASURE_CHEST_OPEN : c.container === "strongbox" ? STRONGBOX_OPEN : c.container === "chest" ? RICKETY_CHEST_OPEN : BURLAP_SACK_OPEN}
                items={c.sack ?? []} bag={bag.map((e) => slotLook(e, isPotionEntry(e) ? undefined : itemOf(e)))}
                slots={bagSize(lab.meta)} bagName={bagName(lab.meta)}
                onTake={takeFromSack} onTakeAll={takeAllFromSack} onSwap={swapFromSack} onPutBack={putInSack}
                party={standingTeam} onEquip={(i, id) => { const e = loadDungeon().meta.bag[i]; if (e) askEquip(e, id); }}
                onDrink={(i, id) => { const e = loadDungeon().meta.bag[i]; if (e && isPotionEntry(e)) drink(e, id); }}
                onDrinkLoot={drinkFromSack}
                teach={teach} putLabel={c.quest === "club" ? "Drop it" : undefined}
                onClose={() => setLootOpen(false)} />
            );
          })()}
          {equipAsk && (() => {
            const it = itemOf(equipAsk.entry);
            const slot = it && slotOf(it);
            if (!it || !slot) return null;
            const team = standingTeam.flatMap(({ id }) => {
              const drop = game.inventory.find((x) => x.id === id) as CreatureOrItemDrop | undefined;
              return drop ? [{ creature: drop, loadout: game.equipment[id] }] : [];
            });
            return (
              <EquipPreview team={team} start={equipAsk.creatureId} find={(id) => itemsById.get(id)} item={it} slot={slot}
                teach={isClub(it) && run.current?.quest === "club"}
                onCancel={() => setEquipAsk(null)}
                onConfirm={(id) => { equipFromBag(equipAsk.entry, id); setEquipAsk(null); }} />
            );
          })()}
          {levelUps.length > 0 && <LevelUpShow ups={levelUps} onDone={() => setLevelUps([])} />}
          {showCards && <EncounterCards creatureIds={enemyIds} onClose={() => setCardsOpen(false)}
            onFight={canFight ? () => { setCardsOpen(false); startFight(run); } : undefined} />}
          {canMoveOn(run) && fightingTeam(run).length === 0 && (
            <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center" }}>Nobody in your team can still fight.</p>
          )}
          <div style={{ marginTop: 12 }}>
            {run.current
              ? <RoomScreen
                  run={run} room={run.current} notes={notes} byId={byId}
                  gold={game.gold} onTreasure={takeTreasure} onClub={takeClub} onChest={openChest}
                  clubEntry={clubEntry} onTakeBox={takeBox} onTakeBoxHome={boxHome} onDeck={openDeck} onOpenSack={openSack} onBuyWares={(ws) => ws.forEach(buyWare)} onCage={openCage} bagUsed={(lab.meta.bag ?? []).length} bagSlots={bagSize(lab.meta)} stacks={(lab.meta.bag ?? []).flatMap((e) => { const x = itemOf(e); return x?.material ? [x.material] : []; })} onHeal={healOne} onBuy={buyCodex} onNext={nextRoom} onWitch={witchPlay} onWitchSit={witchSit} onWitchLeave={witchLeave} onLook={() => setLootOpen(true)} onDynamite={grabDynamite}
                  bagLooks={(lab.meta.bag ?? []).map((e) => slotLook(e, isPotionEntry(e) ? undefined : itemOf(e)))} bagOffers={(lab.meta.bag ?? []).map((e) => offerFor(e))} onSell={sellToMerchant}
                />
              : <AtEntrance run={run} />}
          </div>
        </>
      )}

      {/* Your roster and your bag: two buttons that open over the screen.
          (During the club tutorial the bag stays open under the room, to teach it.) */}
      {clubTutorial ? (
        <>
          {bagView}
          {partyView}
        </>
      ) : null}
      {sheet === "roster" && !clubTutorial && <Sheet title="Your party" onClose={() => setSheet(null)}>{partyView}</Sheet>}
      {nudge && (
        <Sheet title="Leave these behind?" onClose={() => setNudge(null)}>
          <p style={{ fontSize: 14, color: "#d8d4c8", margin: "0 0 8px" }}>
            {nudge.items.length === 1 ? "Something rare is" : "Some rare things are"} still here. Once you move on, {nudge.items.length === 1 ? "it stays" : "they stay"} on the floor — unless you beat the boss and walk back for {nudge.items.length === 1 ? "it" : "them"}.
          </p>
          <LootGrid items={nudge.items.map((drop) => ({ drop }))} />
          <div className="dock-tabs" style={{ marginTop: 10 }}>
            <button className="dock-tab" onClick={() => { setNudge(null); if (run.current?.opened && (run.current.sack?.length ?? 0) > 0) setLootOpen(true); }}>Go back</button>
            <button className="dock-tab" style={{ color: "#ff8a80" }} onClick={() => goTo(nudge.nodeId, true)}>Leave {nudge.items.length === 1 ? "it" : "them"}</button>
          </div>
        </Sheet>
      )}
      {mapOpen && (
        <Sheet title={mapOpen === "pick" ? "🔮 Pick a room to look into" : mapOpen === "view" ? "📜 Your map" : "🧨 Your map, by flarelight"} onClose={() => setMapOpen(null)}>
          {mapOpen === "pick" && <p style={{ fontSize: 13, color: MUTED, margin: "0 0 8px" }}>Tap any room: you&apos;ll see what&apos;s in it, and the rooms around it.</p>}
          <DungeonMapView run={run} onPick={mapOpen === "pick" ? foresee : undefined} />
        </Sheet>
      )}
      {sheet === "bag" && !clubTutorial && <Sheet title={`Your ${bagName(lab.meta).toLowerCase()}`} onClose={() => setSheet(null)}>{bagView}</Sheet>}
      {(run.pending?.length ?? 0) > 0 && (
        <div className="stone-panel" style={{ marginTop: 12, borderColor: "#c9a24a" }}>
          <div className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>Your {bagName(lab.meta).toLowerCase()} is full</div>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "4px 0 8px" }}>
            Leave something below on the floor to make room — anything you don&apos;t take stays here when you move on.
          </p>
          {run.pending!.map((x) => (
            <div key={x.id} className="card-btn" style={{ cursor: "default", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <span>📦 <b style={{ color: x.dropType === "item" ? RARITY_COLORS[x.rarity].text : "white" }}>{dropLabel(x)}</b></span>
              <button className="chip" disabled={(lab.meta.bag ?? []).length >= bagSize(lab.meta)} onClick={() => takePending(x.id)}>Take it</button>
            </div>
          ))}
        </div>
      )}
    </>,
    {
      dock: (
        // Two by two: Party and Bag on top, Scroll and Retreat below.
        <div className="dock-tabs" style={{ gridAutoFlow: "row", gridTemplateColumns: "1fr 1fr" }}>
          <button className="dock-tab" onClick={() => setSheet("roster")} disabled={!!clubTutorial}>
            🐾 Party <span className="count">{fightingTeam(run).length}/{run.party.length}</span>
          </button>
          <button className="dock-tab" onClick={() => setSheet("bag")} disabled={!!clubTutorial}>
            🎒 Bag <span className="count">{(lab.meta.bag ?? []).length}/{bagSize(lab.meta)}</span>
            {(run.pending?.length ?? 0) > 0 && <span aria-label="Your bag is full" style={{ position: "absolute", top: 3, right: 3, width: 10, height: 10, borderRadius: 5, background: "#ff6b5e", border: "2px solid #1d1209" }} />}
          </button>
          <button className="dock-tab" onClick={() => { setSheet(null); setMapOpen("view"); }} disabled={!!clubTutorial}>📜 Scroll</button>
          {/* Retreat: tap twice (it ends the run). */}
          <button className="dock-tab" style={{ color: "#ff8a80", background: retreatArmed ? "#6e1f18" : undefined }}
            disabled={battle.match !== null && !battle.match.state.winner}
            onClick={() => {
              if (!retreatArmed) { setRetreatArmed(true); window.setTimeout(() => setRetreatArmed(false), 3000); return; }
              setRetreatArmed(false);
              witchLeave(); // (mid-game with the witch: you walk away with the cards you've won)
              updateRun((r) => ({ ...leaveSack(r), status: "retreated", battle: undefined }));
            }}>
            {retreatArmed ? "Tap: leave" : "🏃 Retreat"}
          </button>
        </div>
      ),
    },
  );
}

// ── The entrance: choose your party ─────────────────────────────────
function Entrance({ lab, owned, gold, full, onBegin, onHeal }: {
  lab: DungeonSave; owned: OwnedCreature[]; gold: number; full: CappedBox[]; onBegin: (party: string[], dungeon: DungeonId) => void; onHeal: () => void;
}) {
  const [party, setParty] = useState<string[]>(() =>
    owned.filter((c) => c.roster && (lab.meta.injuries[c.id] ?? 1) > 0).slice(0, PARTY_SIZE).map((c) => c.id));
  // The Deep Labyrinth opens once you've beaten the Cyclops.
  const deepOpen = lab.meta.clears > 0;
  const [dungeon, setDungeon] = useState<DungeonId>(1);
  const free = dungeon === 1 && lab.meta.runs < FREE_RUNS;
  const injured = owned.filter((c) => lab.meta.injuries[c.id] !== undefined);
  const canPay = free || gold >= ENTRY_FEE;

  function toggle(id: string) {
    setParty((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PARTY_SIZE ? [...p, id] : p));
  }

  return (
    <>
      {deepOpen && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {([1, 2] as DungeonId[]).map((d) => (
            <button key={d} className="card-btn" onClick={() => setDungeon(d)}
              style={{ flex: 1, display: "block", textAlign: "center", borderColor: dungeon === d ? "#f1d9a0" : undefined, background: dungeon === d ? "rgba(241,217,160,0.1)" : undefined }}>
              <b className="pixel-font" style={{ fontSize: 16, color: "#f1d9a0" }}>{d === 1 ? "🌀" : "🕳️"} {DUNGEONS[d].name}</b>
              <span style={{ display: "block", fontSize: 12, color: MUTED }}>
                {d === 1 ? `The Cyclops · creatures Lv 1–${DUNGEONS[1].maxLevel}` : `${DEEP_ROUTE} rooms deep · Lv ${DUNGEONS[2].levels[0][1]}–${DUNGEONS[2].maxLevel} · the Warden`}
                {d === 2 ? ` · beaten ${lab.meta.deepClears ?? 0}×` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="stone-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Beyond the archway</div>
          <Help title="The labyrinth">
            <ul>
              <li>Rooms and winding tunnels, with the <b>boss&apos;s lair</b> somewhere at the top.</li>
              <li>You get <b>one look at the map</b> at the entrance. Inside it&apos;s too dark to read: you pick your way tunnel by tunnel, and there&apos;s no going back.</li>
              <li>Some rooms are a <b>mystery</b> until you walk in.</li>
              <li>Bring up to <b>{PARTY_SIZE} creatures</b>. Once you&apos;ve seen the map you pick the <b>{TEAM_SIZE}</b> that go in — <b>no swapping</b> inside.</li>
              <li><b>Wounds carry</b> from room to room. If your team falls you wake up in the Den — <b>you keep everything you found</b>.</li>
            </ul>
          </Help>
        </div>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 0" }}>Find the lair. Choose tunnels in the dark. Fall, and you keep your loot.</p>
        <div className="pixel-font" style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          Runs {lab.meta.runs} · Lair beaten {lab.meta.clears}×
        </div>
      </div>

      {injured.length > 0 && (
        <div className="stone-panel" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: MUTED }}>⛲ {injured.length} hurt — healing in the Den&apos;s pool.</span>
          <button className="chip" onClick={onHeal} title="A shortcut for playtesting">Testing: heal now</button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <SectionTitle>Your party ({party.length}/{PARTY_SIZE})</SectionTitle>
        <span style={{ fontSize: 12, color: MUTED }}>{TEAM_SIZE} go in — you choose at the map</span>
      </div>
      {owned.length < PARTY_SIZE && (
        <p style={{ color: MUTED, fontSize: 13, margin: "0 0 8px" }}>
          More creatures make it easier — <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>scan</Link> or summon more.
        </p>
      )}
      {owned.length > 0 && (
        <div className="inv-panel" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
          {owned.map((c) => {
            const slot = party.indexOf(c.id);
            const hp = lab.meta.injuries[c.id] ?? 1;
            const cls = CLASS_INFO[c.template.cls];
            const picked = slot >= 0;
            const fights = picked;
            return (
              <button key={c.id} onClick={() => toggle(c.id)} disabled={hp <= 0} aria-pressed={picked}
                title={hp <= 0 ? `${c.name} is knocked out` : picked ? `Take ${c.name} out of the party` : `Add ${c.name} to the party`}
                style={{
                  position: "relative", minWidth: 0, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: picked ? (fights ? "rgba(241,217,160,0.1)" : "rgba(255,255,255,0.04)") : "none", border: "none", borderRadius: 8,
                  boxShadow: picked ? `inset 0 0 0 2px ${fights ? "#f1d9a0" : "#6b6350"}` : undefined,
                  color: "white", cursor: hp <= 0 ? "default" : "pointer", opacity: hp <= 0 ? 0.35 : 1,
                }}>
                <span className="pixel-font" style={{ maxWidth: "100%", fontSize: 12, color: rarityColor(c.rarity), textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.15 }}>
                  <span style={{ color: "#f1d9a0" }}>Lv {c.fighter.level ?? 1}</span> {c.name}
                </span>
                <CreaturePortrait creatureId={c.creatureId} title={c.name} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
                <span className="pixel-font" style={{ fontSize: 11, color: cls.color }}>{cls.name}</span>
                {hp < 1 && (
                  <span style={{ width: "80%", height: 4, background: "#1a0e0e", border: "1px solid #000" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.max(0, hp) * 100}%`, background: hp > 0.5 ? "#5ee08a" : hp > 0.25 ? "#f5c542" : "#ff6b5e" }} />
                  </span>
                )}
                {picked && (
                  <span className="pixel-font" style={{ position: "absolute", top: 20, left: 4, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, borderRadius: 10, background: fights ? "#f1d9a0" : "#6b6350", color: "#1a140c" }}>
                    {slot + 1}
                  </span>
                )}
                {c.roster && <span style={{ position: "absolute", top: 20, right: 6, fontSize: 13, color: "#f5c542" }}>★</span>}
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => onBegin(party, dungeon)} disabled={party.length === 0 || !canPay || full.length > 0} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        {dungeon === 2 ? "🕳️ Enter the Deep Labyrinth" : "🌀 Enter the labyrinth"} {free ? `(free · ${FREE_RUNS - lab.meta.runs} free run${FREE_RUNS - lab.meta.runs === 1 ? "" : "s"} left)` : `(${ENTRY_FEE} gold)`}
      </button>
      {full.length > 0 && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>
        Your {full.map((b) => BOX_NAMES[b]).join(" and ")} box{full.length > 1 ? "es are" : " is"} full ({BOX_CAP}). <Link href="/chest" style={{ color: "white", textDecoration: "underline" }}>Sell some</Link> to go back in.
      </p>}
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {ENTRY_FEE} gold — you have {gold}.</p>}
    </>
  );
}

// ── In the dungeon ────────────────────────────────────────────────
// At the entrance: one good look at the map before you go in.
// onEnter: tap one of the rooms off the entrance to step inside and head straight there.
function MapFirst({ run, byId, onTeam, onStep, onEnter }: {
  run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void; onStep: () => void; onEnter: (nodeId: string) => void;
}) {
  const ready = fightingTeam(run).length > 0;
  const firstRooms = nextRooms(run).length > 0 && ready;
  return (
    <div className="stone-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Your map of the labyrinth</div>
        <Help title="The map">
          <ul>
            <li><b>Study it now:</b> once you step inside it&apos;s too dark to read.</li>
            <li>Inside, you only see <b>the room you&apos;re in</b> and the tunnels out of it.</li>
            <li>Rooms you know are marked; the rest are a <b>&ldquo;?&rdquo;</b>.</li>
            <li>Every tunnel leads <b>onward, never back</b>.</li>
            <li>Tap a room next to the entrance to <b>head straight there</b>.</li>
            <li>Pick the <b>{TEAM_SIZE} creatures</b> that suit your route. The rest wait in the Den: <b>no swapping</b> once you&apos;re inside.</li>
          </ul>
        </Help>
      </div>
      <p style={{ fontSize: 15, color: MUTED, margin: "4px 0 12px", lineHeight: 1.5 }}>
        {run.map.quest ? "Just a short way in — it went this way." : "Remember the way to the lair: it's too dark to read inside."}
      </p>
      <DungeonMapView run={run} onEnter={firstRooms ? onEnter : undefined} />
      {run.party.length > TEAM_SIZE && <Party run={run} byId={byId} onTeam={onTeam} bench="Waits in the Den" />}
      <button className="pixel-btn" onClick={onStep} disabled={!ready} style={{ marginTop: 14, width: "100%", fontSize: 18, padding: "10px 0" }}>
        🔥 Put the map away and step inside
      </button>
    </div>
  );
}

function AtEntrance({ run }: { run: DungeonRun }) {
  const ways = run.map.nodes[runPosition(run)].links.length;
  return (
    <div className="stone-panel">
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: 0, lineHeight: 1.5 }}>
        Water drips somewhere in the dark. {ways > 1 ? "Tunnels lead off" : "A tunnel leads off"} into the gloom — the left-most heads furthest west.
        Tap one to go on.
      </p>
    </div>
  );
}

function RoomScreen({ run, room, notes, byId, gold, bagUsed, bagSlots, stacks, onLook, onTreasure, onClub, clubEntry, onTakeBox, onTakeBoxHome, onChest, onDeck, onOpenSack, onBuyWares, onCage, onHeal, onBuy, onNext, onWitch, onWitchSit, onWitchLeave, bagLooks, bagOffers, onSell, onDynamite }: {
  onWitch: (g: Guess) => void; onWitchSit: () => void; onWitchLeave: () => void; onLook: () => void; onDynamite: () => void;
  bagLooks: (SlotLook | null)[]; bagOffers: number[]; onSell: (bagIndex: number) => void;
  run: DungeonRun; room: Room; notes: string[]; byId: (id: string) => OwnedCreature | undefined; gold: number;
  onTreasure: (r: Room) => void; onClub: () => void; clubEntry?: BagEntry;
  onTakeBox: () => void; onTakeBoxHome: () => void; onChest: () => void; onDeck: () => void; onOpenSack: () => void; onBuyWares: (ws: Ware[]) => void; onCage: (i: number) => void; bagUsed: number; bagSlots: number; stacks: string[]; onHeal: (id: string) => void; onBuy: (move: string) => void; onNext: () => void;
}) {
  const info = room.quest === "club" ? { name: "A dropped club", icon: "🏏" } : room.quest === "thief" ? { name: "The thief", icon: "💀" } : ROOM_INFO[room.kind];
  // What's in a sack or chest (a stash, or a beaten fight's loot): tap to take.
  const sackPanel = (room.sack?.length ?? 0) > 0
    ? <button className="pixel-btn" style={{ marginTop: 8 }} onClick={onLook}>🔍 Look inside ({room.sack!.length})</button>
    : <p style={{ fontSize: 13, color: "#d8d4c8", margin: "8px 0 0" }}>Empty now.</p>;
  // A beaten fight's loot: the container, then what's in it once opened.
  const fightLoot = room.container && (room.opened ? sackPanel : (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
        {room.container === "strongbox" ? "Behind the Warden's throne sits its strongbox: black iron, chains, and a lock that glows cold." : room.container === "chest" ? "It leaves a rickety old chest behind, its lid hanging loose." : "It leaves a grubby sack behind."}
      </p>
      <button className="pixel-btn" onClick={onOpenSack}>{room.container === "strongbox" ? "🗝️ Open the strongbox" : room.container === "chest" ? "🧰 Loot the chest" : "💰 Loot the sack"}</button>
    </div>
  ));
  // The club on the floor: not looked at yet, or still lying there.
  const clubShut = room.quest === "club" && !!room.sack && !room.opened;
  const clubLeft = room.quest === "club" && !!room.opened && (room.sack ?? []).some((x) => "gear" in x && isClub(x.gear as CreatureOrItemDrop));
  const onward = <p className="pixel-font" style={{ fontSize: 13, color: "#c9b48a", margin: "12px 0 0" }}>↑ Take a tunnel to move on.</p>;
  const next = room.kind === "boss" ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onNext}>Finish →</button>
    : room.quest === "thief" ? (room.boxTaken ? (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 14, color: "#f1d9a0", fontStyle: "italic", margin: "0 0 10px" }}>
          &ldquo;This looks like the box Klutz was talking about. Let&apos;s take it to him.&rdquo;
        </p>
        <button className="pixel-btn" onClick={onTakeBoxHome}>Continue</button>
      </div>
    ) : (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
          The Baby Cyclops howls, drops what it was carrying and scampers off into the dark. A battered box thuds onto the floor, a sword hilt poking out of the lid.
        </p>
        <button className="pixel-btn" onClick={onTakeBox}>📦 Pick up the box</button>
      </div>
    )) : onward;

  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>{info.icon} {info.name}</div>

      {notes.map((n) => <div key={n} style={{ fontSize: 13, color: "#f1d9a0", marginTop: 4 }}>{n}</div>)}

      {clubShut ? (
        <>
          <p style={{ fontSize: 15, color: "#d8d4c8" }}>
            A battered old club with <i>KLUTZ</i> scratched into it. The thief dropped it — you can hear it clattering on ahead.
          </p>
          <button className="pixel-btn tutorial-pulse" onClick={onOpenSack}>Pick up the club</button>
        </>
      ) : clubLeft ? (
        <>
          <div className="tutorial-tip" style={{ marginTop: 10 }}>
            <b>Looting.</b> Klutz&apos;s Club is still on the floor. Pick it up, and give it to one of your creatures before you go on.
          </div>
          <button className="pixel-btn tutorial-pulse" style={{ marginTop: 8 }} onClick={onLook}>Pick up the club</button>
        </>
      ) : room.quest === "club" && (room.done ? (
        <>
          {clubEntry ? (
            <div className="tutorial-tip" style={{ marginTop: 10 }}>
              <b>Equipping gear.</b> Klutz&apos;s Club is in your bindle now. It&apos;s not much, but it&apos;s better than bare claws —
              give it to one of your creatures before you go on. Drag it onto one below, or tap it.
              <div style={{ textAlign: "center", fontSize: 22, marginTop: 4 }}><span className="tutorial-arrow">👇</span></div>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#d8d4c8", marginTop: 8 }}>Club in hand. Somewhere ahead, bones are rattling…</p>
              {onward}
            </>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 15, color: "#d8d4c8" }}>
            A battered old club with <i>KLUTZ</i> scratched into it. The thief dropped it — you can hear it clattering on ahead.
          </p>
          <button className="pixel-btn" onClick={onClub}>Pick up the club</button>
        </>
      ))}

      {room.kind === "treasure" && !room.quest && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A battered chest sits in the middle of the room, coins spilling from the lid.</p>
          <button className="pixel-btn" onClick={() => onTreasure(room)}>Take the gold</button>
        </>
      ))}

      {room.kind === "chest" && (room.done ? <>{sackPanel}{next}</> : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>An old chest, humming faintly — like the barcodes do. {CHEST_DROPS} things rattle inside.</p>
          <button className="pixel-btn" onClick={onChest}>Open it</button>
        </>
      ))}

      {room.kind === "witch" && room.witch && <WitchTable key={run.path.length} room={room} victim={byId(run.illness?.id ?? "")?.name} onSit={onWitchSit} onGuess={onWitch} onLeave={onWitchLeave} next={next} />}

      {room.kind === "cards" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A deck of cards lies face down on a stone table, each one faintly warm. {DECK_CARDS} creature cards — whatever they turn out to be.</p>
          <button className="pixel-btn" onClick={onDeck}>Turn them over</button>
        </>
      ))}

      {room.kind === "pool" && (room.done ? (
        <><p style={{ fontSize: 13, color: "#d8d4c8" }}>The water goes still.</p>{next}</>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Glowing water. It can fully restore <b>one</b> creature — even one that was knocked out.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.party.map((id) => {
              const c = byId(id);
              const hp = run.hp[id] ?? 1;
              return c && (
                <button key={id} className="card-btn" disabled={hp >= 1} onClick={() => onHeal(id)} style={{ opacity: hp >= 1 ? 0.45 : 1 }}>
                  <b style={{ color: rarityColor(c.rarity) }}>{c.name}</b>
                  <span style={{ fontSize: 12, color: MUTED }}>{hp <= 0 ? "knocked out" : `${Math.round(hp * 100)}% HP`}{hp >= 1 ? " · already full" : ""}</span>
                </button>
              );
            })}
          </div>
          {onward}
        </>
      ))}

      {room.kind === "stash" && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>A burlap sack slumps against the wall, tied at the neck. Something inside clinks.</p>
          <button className="pixel-btn" onClick={onOpenSack}>Open the sack</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}


      {room.kind === "merchant" && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A cart piled with odds and ends, and a merchant who smiles too much. &ldquo;One of each, friend. Everything takes a slot in your bag — the timber stacks, mind.&rdquo;
          </p>
          <MerchantCart key={run.path.length} wares={waresFor(room.wares ?? [], { bagSize: bagSlots })} bought={room.bought} gold={gold} bagUsed={bagUsed} bagSlots={bagSlots} stacks={stacks} onBuy={onBuyWares} />
          <MerchantBag key={`bag${run.path.length}`} slots={bagSlots} looks={bagLooks} offers={bagOffers} onSell={onSell} />
          {next}
        </>
      )}

      {(room.kind === "librarian" || (room.kind === "library" && room.librarian)) && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            {room.kind === "library" ? "Between the toppled shelves, a hooded figure is sorting what's left. " : "A hooded figure sits among towers of crumbling books. "}
            &ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move — once.&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(room.offers ?? []).map((name) => {
              const move = MOVE_BY_NAME[name];
              const sold = room.bought?.includes(name);
              const price = codexPrice(name);
              return (
                <button key={name} className="card-btn" disabled={sold || gold < price} onClick={() => onBuy(name)}
                  style={{ opacity: sold || gold < price ? 0.5 : 1 }}>
                  <span style={{ flex: 1 }}>
                    <b style={{ color: "#c7b8ff" }}>📖 Codex: {name}</b>
                    <span style={{ fontSize: 12, color: move?.race ? RACE_INFO[move.race].color : MUTED }}> · {move?.race ? `${RACE_INFO[move.race].name} only` : "any creature"}</span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>{move?.desc}</span>
                  </span>
                  <span className="pixel-font" style={{ color: GOLD, flexShrink: 0 }}>{sold ? "bought" : <><Coin /> {price}</>}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>You have {gold} gold.</p>
          {room.kind === "library" ? onward : next}
        </>
      )}

      {room.kind === "library" && !room.librarian && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Shelves to the ceiling, most of them toppled. Something bound in leather is still in there somewhere.</p>
          <button className="pixel-btn" onClick={onOpenSack}>🔍 Search the shelves</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}

      {room.kind === "storehouse" && !room.guarded && (!room.opened ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>Crates, sacks and barrels, stacked to the rafters. Someone was stocking up.</p>
          <button className="pixel-btn" onClick={onOpenSack}>🔍 Search the stores</button>
          {onward}
        </>
      ) : <>{sackPanel}{onward}</>)}

      {/* Klutz's dynamite (lib/tavern.ts): among the crates, once any guard is beaten. */}
      {dynamiteHere(room) && (
        <>
          <p style={{ fontSize: 13, color: "#ffb38a", margin: "8px 0 0" }}>Behind the barrels: a crate stamped <b>DANGER</b>. Dynamite!</p>
          <button className="pixel-btn tutorial-pulse" style={{ marginTop: 6 }} onClick={onDynamite}>🧨 Take the dynamite</button>
        </>
      )}
      {room.dynamite === false && <p style={{ fontSize: 13, color: "#7CFC9A", margin: "8px 0 0" }}>🧨 Klutz&apos;s dynamite is yours.</p>}

      {room.kind === "encampment" && (
        <EncampmentPanel room={room} onCage={onCage} />
      )}

      {hasFight(room) && room.done && fightLoot}
      {hasFight(room) && (room.done ? (room.kind === "encampment" ? onward : next) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 10px" }}>
            {room.quest === "thief" && "There it is: a Baby Cyclops, hunched over a battered box, picking through Klutz's weapons. Klutz ducks behind you: “Oi! That's mine! Go on — you fight, I'll tell you what to do.”"}
            {room.kind === "easy" && !room.quest && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "miniboss" && "Something big has made this room its lair. One creature — but a Rare one, well armed, and it fights smart. Its chest is worth it."}
            {room.kind === "storehouse" && "Crates and barrels to the rafters — and something big has made its lair among them. Beat it and the stores are yours."}
            {room.kind === "encampment" && room.variant === "ambush" && "They were hiding behind the cages! Two of them come at you at once."}
            {room.kind === "encampment" && room.variant !== "ambush" && "A camp: bedrolls, a cookfire, cages along the wall — and the creatures who live here."}
            {room.kind === "boss" && !room.boss && `The Warden of the Deep waits at the top of the climb, with two guards at its side. A Legendary and two Epics, all Lv ${WARDEN_LEVEL - 1}+ — and they fight smart.`}
            {room.boss && "A Cyclops fills the chamber — a mountain of muscle with one huge, rolling eye. It's a melee brute: tough to hurt up close (magic hits it hardest), and its Stomp can cripple you badly (swapping out shakes it off… eventually). Something tells you this won't be the whole fight."}
            {!room.boss && <> They play like the {AI_LEVEL_LABELS[room.level ?? "normal"]} AI.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {room.boss && (
              <div style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                <b style={{ color: rarityColor("legendary") }}>Cyclops</b>
                <span style={{ color: MUTED }}> · {CYCLOPS_PARTS[0].label} · {combatLine(cyclopsTeam(CYCLOPS_LEVEL)[0])}</span>
              </div>
            )}
            {(room.enemies ?? []).map((e, i) => {
              const t = CREATURE_BY_ID[e.creatureId];
              return (
                <div key={i} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                  <b style={{ color: rarityColor(t.rarity) }}>{t.name}</b>
                  <span className="pixel-font" style={{ color: "#f1d9a0" }}> Lv {e.level ?? 15}</span>
                  <span style={{ color: MUTED }}> · {t.race ? `${RACE_INFO[t.race].name} · ` : ""}{creatureTypeLabel(e.proficiency)} · {e.gear.length ? e.gear.map(gearName).join(", ") : "no gear"}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>
            Win: {room.quest === "thief" ? "Klutz's box" : <>{room.gold} gold</>}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}. Press <b>Fight!</b> on the room when you&apos;re ready.
          </p>
        </>
      ))}
    </div>
  );
}

// An encampment: what sort it is, and its cages.
function EncampmentPanel({ room, onCage }: { room: Room; onCage: (i: number) => void }) {
  const lurking = room.variant === "ambush" && !room.sprung;
  const locked = hasFight(room) && !room.done; // beat them first
  return (
    <div style={{ marginTop: 6 }}>
      {lurking && <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>A camp: bedrolls, a cold cookfire, cages along the wall. Nobody about.</p>}
      {room.variant === "drunk" && !room.done && (
        <p style={{ fontSize: 13, color: "#c7b8ff", margin: "0 0 8px" }}>🍺 Empty potion bottles everywhere: they&apos;ve <b>×{ENCAMP_DRUNK_HP} HP</b>. Arcane moves bite deeper.</p>
      )}
      {room.variant === "rigged" && !room.done && (
        <p style={{ fontSize: 13, color: "#ff8a5c", margin: "0 0 8px" }}>🧨 Barrels of blackpowder, fuse lit: win in <b>{ENCAMP_FUSE} rounds</b> or the room comes down on you.</p>
      )}
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", marginBottom: 6 }}>Cages {locked && <span style={{ color: MUTED }}>· beat them first</span>}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(room.cages ?? []).map((c, i) => {
          const t = c.creatureId ? CREATURE_BY_ID[c.creatureId] : undefined;
          return c.opened ? (
            <span key={i} className="card-btn" style={{ cursor: "default", opacity: 0.6, flex: "1 1 30%" }}>
              {t ? <b style={{ color: rarityColor(t.rarity) }}>🔓 {t.name}</b> : <span style={{ color: MUTED }}>🔓 empty</span>}
            </span>
          ) : (
            <button key={i} className="card-btn" disabled={locked} onClick={() => onCage(i)} style={{ flex: "1 1 30%", justifyContent: "center", opacity: locked ? 0.5 : 1 }}>
              🔒 Open cage {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Your party: three in the team (the first one leads), two on the bench.
// bench: at the map, the rest of the party (under this label); inside, just the team.
function Party({ run, byId, onTeam, bench }: { run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void; bench?: string }) {
  const member = (id: string): PartyMember[] => {
    const c = byId(id);
    return c ? [{ id, name: c.name, rarity: c.rarity, creatureId: c.creatureId, maxHp: c.fighter.maxHp, hp: run.hp[id] ?? 1 }] : [];
  };
  const team = fightingTeam(run);
  return (
    <>
      <PartySlots team={team.flatMap(member)} bench={bench ? run.party.filter((id) => !team.includes(id)).flatMap(member) : undefined} benchLabel={bench} onTeam={onTeam} />
      {bench && team.length === 0 && <p style={{ fontSize: 13, color: "#ff8a80", margin: "6px 0 0" }}>Pick someone to go in.</p>}
    </>
  );
}

function RunOver({ run, lab, onHome, onWalkBack }: { run: DungeonRun; lab: DungeonSave; onHome: () => void; onWalkBack: () => void }) {
  const floor: FloorItem[] = [...(run.floor ?? []), ...(run.pending ?? []).map((x) => ({ room: "", drop: x }))];
  const title = run.status === "cleared" ? "The labyrinth is beaten!" : run.status === "dead" ? "Everything goes dark…" : "You slip back out";
  const text = run.status === "cleared" && run.dungeon === 2
    ? `The Warden falls, and the deep goes quiet. You beat the Deep Labyrinth on run ${run.runNumber}!`
    : run.status === "cleared"
    ? `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! Its head comes home with you: a trophy, and a bounty if anyone's offering one.`
    : run.status === "dead"
      ? `…and you wake up in the Den, Klutz standing over you looking pleased with himself. He dragged you out after ${run.room} room${run.room === 1 ? "" : "s"}. ${freeHealing(lab.meta) ? "He's patched your creatures up, good as new." : "Your creatures are hurt — rest them at the healing pool."}`
      : run.loot.includes("Klutz's box")
        ? "You head back to the Den with Klutz's box under your arm. He'll be thrilled — go and find him."
        : `You find your way back out, ${run.room} room${run.room === 1 ? "" : "s"} explored.`;
  return (
    <div className="stone-panel" style={{ textAlign: "center" }}>
      <div className="pixel-font" style={{ fontSize: 26, color: run.status === "cleared" ? "#5ee08a" : run.status === "dead" ? "#ff8a80" : "#f1d9a0" }}>{title}</div>
      <p style={{ fontSize: 14, color: "#d8d4c8", lineHeight: 1.5 }}>{text}</p>
      <div style={{ textAlign: "left" }}>
        <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0", margin: "4px 0 8px" }}>Loot</div>
        <LootGrid items={run.got ?? []} grouped />
        {floor.length > 0 && (
          <>
            <div className="pixel-font" style={{ fontSize: 15, color: run.status === "cleared" ? "#f1d9a0" : "#ff8a80", margin: "16px 0 8px" }}>
              Left behind{run.status === "cleared" ? "" : " (lost)"}
            </div>
            <LootGrid items={floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }))} faded grouped />
          </>
        )}
      </div>
      <div style={{ height: 14 }} />
      {run.status === "cleared" ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            With the {run.dungeon === 2 ? "Warden" : "Cyclops"} gone, the way back is safe{floor.length > 0 ? ` — and the ${floor.length} thing${floor.length === 1 ? "" : "s"} you left behind are yours to take` : ""}.
          </p>
          <button className="pixel-btn" onClick={onWalkBack}>🚶 Walk back through</button>
        </>
      ) : (
        <button className="pixel-btn" onClick={onHome}>Continue</button>
      )}
    </div>
  );
}

// The walk back, once the boss is beaten: a summary of your loot — what you
// chose to carry, and what you left on the floors (yours to take now) — and
// your storage (just your bag for now), each with how much room is left.
// Open a container to sort it: take things off the floor, put things down
// to make room. Whatever's still on the floor when you head home is lost.
function WalkBack({ run, lab, itemOf, onTake, onTakeAll, onSwap, onPut, onHome }: {
  run: DungeonRun; lab: DungeonSave; itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined;
  onTake: (i: number) => void; onTakeAll: () => void; onSwap: (i: number, bagIndex: number) => void; onPut: (bagIndex: number) => void; onHome: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null); // a container, opened to sort
  const [sure, setSure] = useState(false);               // heading home, leaving rare things behind
  const floor = run.floor ?? [];
  const bag = lab.meta.bag ?? [];
  const carried: GotItem[] = bag.flatMap((e): GotItem[] => (isPotionEntry(e) ? [{ potion: e }] : itemOf(e) ? [{ drop: itemOf(e)! }] : []));
  const left: GotItem[] = floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }));
  const rareLeft = floor.filter((f) => f.drop && isRareFind(f.drop)).length;
  // Your storage. (One container for now: more will come.)
  const containers = [{ key: "bag", name: bagName(lab.meta), slots: bagSize(lab.meta), entries: bag }];
  const panel = (title: string, body: React.ReactNode, hint?: string) => (
    <div className="stone-panel" style={{ marginTop: 10 }}>
      <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: MUTED, margin: "2px 0 6px" }}>{hint}</div>}
      {body}
    </div>
  );
  const c = containers.find((x) => x.key === open);
  return (
    <>
      <div className="stone-panel" style={{ textAlign: "center" }}>
        <div className="pixel-font" style={{ fontSize: 22, color: "#5ee08a" }}>🚶 The walk back</div>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 0", lineHeight: 1.5 }}>
          The halls are quiet now. Here&apos;s what you chose to carry, and what you left behind — take what you can fit.
        </p>
      </div>

      {panel("Available loot", (
        <>
          <div style={{ fontSize: 12, color: MUTED, margin: "6px 0 4px" }}>Carrying</div>
          {carried.length > 0 ? <LootGrid items={carried} /> : <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing in your {bagName(lab.meta).toLowerCase()}.</p>}
          <div style={{ fontSize: 12, color: MUTED, margin: "12px 0 4px" }}>Left on the floors — yours to take</div>
          {left.length > 0 ? <LootGrid items={left} /> : <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nothing left behind.</p>}
        </>
      ))}

      {panel("Your storage", (
        <div style={{ display: "grid", gap: 8 }}>
          {containers.map((x) => (
            <div key={x.key} className="card-btn" style={{ cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <b className="pixel-font" style={{ color: x.entries.length >= x.slots ? "#ff8a80" : "#f1d9a0" }}>🎒 {x.name} · {x.slots - x.entries.length} free</b>
                <button className="chip" onClick={() => setOpen(x.key)}>Open</button>
              </div>
              <BagSlots slots={x.slots} looks={x.entries.map((e) => slotLook(e, isPotionEntry(e) ? undefined : itemOf(e)))} selected={null} onSelect={() => setOpen(x.key)} size={44} />
            </div>
          ))}
        </div>
      ), "Open one to take things off the floor, or put something down to make room.")}

      <div style={{ marginTop: 14 }}>
        {sure ? (
          <div className="stone-panel" style={{ borderColor: "#ff8a80" }}>
            <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>{rareLeft} rare thing{rareLeft === 1 ? " is" : "s are"} still on the floor. Leave {rareLeft === 1 ? "it" : "them"} for good?</p>
            <div className="dock-tabs">
              <button className="dock-tab" onClick={() => setSure(false)}>Keep sorting</button>
              <button className="dock-tab" style={{ color: "#ff8a80" }} onClick={onHome}>Head home</button>
            </div>
          </div>
        ) : (
          <button className="pixel-btn" style={{ width: "100%" }} onClick={() => (rareLeft > 0 ? setSure(true) : onHome())}>🏠 Head home{floor.length > 0 ? " (the rest stays here)" : ""}</button>
        )}
      </div>

      {c && (
        <LootWindow name="Left on the floors" sprite={TREASURE_PILE}
          items={floor.map((f): SackItem => (f.drop ? { gear: f.drop } : { potion: f.potion! }))}
          bag={c.entries.map((e) => slotLook(e, isPotionEntry(e) ? undefined : itemOf(e)))}
          slots={c.slots} bagName={c.name}
          onTake={onTake} onTakeAll={onTakeAll} onSwap={onSwap} onPutBack={onPut} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

// The potions in the bag, one entry per kind (for the battle screen).
function bagItems(bag: PotionKey[]): BagItem[] {
  return (Object.keys(POTIONS) as PotionKey[])
    .map((k) => ({ key: k, ...POTIONS[k], potion: k, count: bag.filter((b) => b === k).length }))
    .filter((it) => it.count > 0);
}

// Between rooms: your battle bag as slots. Tap one for what you can do with it.
// tutorial: the entry to walk the player through equipping (Klutz's Club).
function Bag({ run, bag, slots, name, itemOf, slotOf, byId, wornIn, onDrink, onEquip, onLeave, onTool, tutorial }: {
  run: DungeonRun; bag: BagEntry[]; slots: number; name: string;
  itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined; slotOf: (it: CreatureOrItemDrop) => EquipSlot | null;
  byId: (id: string) => OwnedCreature | undefined; onDrink: (k: PotionKey, id: string) => void;
  wornIn: (creatureId: string, slot: EquipSlot) => CreatureOrItemDrop | undefined; // what a creature wears in a slot
  onEquip: (e: BagEntry, creatureId: string) => void; onLeave: (e: BagEntry) => void; tutorial?: BagEntry;
  onTool?: (e: BagEntry) => void; // a flare or a clairvoyance scroll: use it
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const standing = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0);
  // Drag a weapon or armour piece onto one of your creatures to equip it.
  const wears = (i: number) => { const x = bag[i]; const w = x && !isPotionEntry(x) ? itemOf(x) : undefined; return !!w && !!slotOf(w); };
  // …or a potion onto a hurt one to heal it.
  const hurt = standing.filter((id) => (run.hp[id] ?? 1) < 1);
  const potionAt = (i: number) => { const x = bag[i]; return x && isPotionEntry(x) ? x : undefined; };
  const { box: dragBox, ...dnd } = useDragDrop<number>({ onDrop: (i, t) => {
    const id = t?.startsWith("who:") ? t.slice(4) : undefined;
    const p = potionAt(i);
    if (id && wears(i) && standing.includes(id)) { onEquip(bag[i], id); setSel(null); }
    else if (id && p && hurt.includes(id)) { onDrink(p, id); setSel(null); }
  } });
  // Everyone in the party, with their HP (a downed one shows 0%).
  const party = run.party.flatMap((id) => { const c = byId(id); return c ? [{ id, name: c.name, creatureId: c.creatureId, hp: Math.max(0, run.hp[id] ?? 1) }] : []; });
  const e = sel !== null ? bag[sel] : undefined;
  const it = e && !isPotionEntry(e) ? itemOf(e) : undefined;
  const slot = it ? slotOf(it) : null;
  const tutorialAt = tutorial ? bag.indexOf(tutorial) : -1;
  const teaching = tutorialAt >= 0 && e === tutorial;
  const done = (fn: () => void) => () => { fn(); setSel(null); setComparing(false); };
  const chip = (key: string, label: string, onClick: () => void, extra: React.CSSProperties = {}, pulse = false) => (
    <button key={key} className={`chip${pulse ? " tutorial-pulse" : ""}`} style={{ padding: "5px 10px", ...extra }} onClick={onClick}>{label}</button>
  );

  return (
    <div ref={dragBox} style={{ position: "relative" }}>
      <SectionTitle>{name} ({bag.length}/{slots})</SectionTitle>
      {tutorialAt >= 0 && sel !== tutorialAt && (
        <div className="tutorial-tip" style={{ marginBottom: 8 }}>
          <span className="tutorial-arrow">👇</span> Drag <b>Klutz&apos;s Club</b> onto a creature, or tap it to see what you can do with it.
        </div>
      )}
      <BagSlots slots={slots} looks={bag.map((x) => slotLook(x, isPotionEntry(x) ? undefined : itemOf(x)))}
        grab={(i, l) => (wears(i) || potionAt(i) ? { onPointerDown: dnd.press(i, l), ...dnd.handlers } : {})}
        selected={sel} onSelect={(i) => { if (dnd.wasDrag()) return; setSel(i); setComparing(false); }} pulse={tutorialAt >= 0 && sel !== tutorialAt ? tutorialAt : undefined} />
      {/* Your creatures and their health: drag gear onto one to equip it, or a potion to heal it. */}
      {party.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <TeamDropRow team={party} over={dnd.over} pulse={tutorialAt >= 0}
            ready={dnd.lifted === undefined ? false : potionAt(dnd.lifted) ? (c) => hurt.includes(c.id) : (c) => standing.includes(c.id)} />
        </div>
      )}
      {bag.length === 0 && <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Empty. Gold and creature cards take no space; gear, codexes, potions and materials take a slot each (materials stack).</p>}

      {e && (
        <div className="stone-panel" style={{ marginTop: 8, padding: "10px 12px" }}>
          {isPotionEntry(e) ? (
            <>
              <b><PotionIcon kind={e} />{POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>restores {POTIONS[e].heal} HP to one creature</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {hurt.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Nobody needs it right now.</span>}
                {hurt.map((id) => chip(id, `Give ${byId(id)!.name}`, done(() => onDrink(e, id))))}
                {chip("leave", "Leave it here", done(() => onLeave(e)), { color: "#ff8a80" })}
              </div>
            </>
          ) : it ? (
            <>
              <b style={{ color: RARITY_COLORS[it.rarity].text }}>{it.name}</b>
              <span style={{ fontSize: 12, color: MUTED }}> · {it.rarity}{lootIdOf(e) ? " · found this run" : " · yours"}</span>
              {slot && <GearStatLine item={it} />}
              {it.tool && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{TOOLS[it.tool].desc}</div>}
              {teaching && (
                <div className="tutorial-tip" style={{ margin: "8px 0 0" }}>
                  <span className="tutorial-arrow">👇</span> Now choose who carries it. Gear you find down here works the same way: tap it in your bag, then equip it.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {slot && standing.map((id) => chip(id, `Equip on ${byId(id)!.name}`, done(() => onEquip(e, id)), {}, teaching))}
                {it.tool && onTool && chip("use", it.tool === "flare" ? "🧨 Light it" : "🔮 Read it", done(() => onTool(e)))}
                {slot && !teaching && !comparing && chip("compare", "⚖️ Compare", () => setComparing(true))}
                {!teaching && chip("leave", "Leave it here", done(() => onLeave(e)), { color: "#ff8a80" })}
              </div>
              {slot && comparing && (
                <GearCompare item={it} slotName={slot}
                  creatures={run.party.flatMap((id) => { const c = byId(id); return c ? [{ id, name: c.name, creatureId: c.creatureId, worn: wornIn(id, slot) }] : []; })}
                  onEquip={(id) => { if ((run.hp[id] ?? 1) > 0) done(() => onEquip(e, id))(); }}
                  onClose={() => setComparing(false)} />
              )}
            </>
          ) : (
            <span style={{ color: MUTED }}>Something you no longer have.</span>
          )}
        </div>
      )}
      {dnd.ghost}
    </div>
  );
}

// Shakes its contents each time `shake` goes up (the witch's stab, an illness).
function Shaker({ shake, fill, children }: { shake: number; fill?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || shake === 0) return;
    el.classList.remove("screen-shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("screen-shake");
  }, [shake]);
  return <div ref={ref} style={fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>{children}</div>;
}

// The card witch: she offers a game of higher or lower, played in a window
// over her room (components/WitchWindow.tsx). Once it's over, the room says how it went.
function WitchTable({ room, victim, onSit, onGuess, onLeave, next }: {
  room: Room; victim?: string; onSit: () => void; onGuess: (g: Guess) => void; onLeave: () => void; next: React.ReactNode;
}) {
  const w = room.witch!;
  // The window stays up when the game ends, until you leave her table.
  const [shut, setShut] = useState(() => w.state !== "playing");
  const won = w.won?.length ?? w.correct;
  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ fontSize: 14, color: "#d8d4c8", margin: "0 0 10px" }}>
        {w.state === "playing" && <>A hunched witch shuffles a deck of bone cards. &ldquo;Fancy a game, dearie? Guess right and the creature&apos;s yours…&rdquo;</>}
        {w.state === "lost" && <b style={{ color: "#ff8a80" }}>She stabbed {victim ?? "your creature"}{won > 0 ? " and swept your cards back into her deck" : ""}.</b>}
        {w.state === "left" && <b style={{ color: "#f1d9a0" }}>You walked away with {w.correct} card{w.correct === 1 ? "" : "s"}.</b>}
      </p>
      {w.state === "playing" && !isSeated(w) ? <button className="pixel-btn" onClick={onSit}>🃏 Play her game</button>
        : w.state === "playing" ? null : next}
      {isSeated(w) && !shut && <WitchWindow game={w} victim={victim} onGuess={onGuess} onLeave={onLeave} onClose={() => setShut(true)} />}
    </div>
  );
}
