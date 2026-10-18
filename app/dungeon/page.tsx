"use client";
// app/dungeon/page.tsx
// A run through dungeon 1: pick a party of up to 5, study the map scroll at
// the entrance, then step inside — from there you see only the room you're
// in and the tunnels leading on. Fight, heal and loot, and face the boss.
// The rules live in lib/dungeon/run.ts; the run is saved after every step,
// so leaving the page (or refreshing) never loses it.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BagSlots, { slotLook } from "@/components/BagSlots";
import ContainerLoot from "@/components/ContainerLoot";
import { RICKETY_CHEST_OPEN, BURLAP_SACK_OPEN } from "@/lib/sprites/props";
import LootGrid from "@/components/LootGrid";
import GearCompare, { GearStatLine } from "@/components/GearCompare";
import PartySlots, { type PartyMember } from "@/components/PartySlots";
import { useGameState, SLOT_FIELD, type EquipSlot } from "@/hooks/useGameState";
import type { Drop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CLASS_INFO, CREATURE_BY_ID, MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import PixelSprite, { creatureSprite } from "@/components/PixelSprite";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { pickCreatureId, pickRarity } from "@/lib/items/gameHelpers";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { itemToCombatStats } from "@/lib/combat/loadout";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "@/lib/types";
import { dropFromOutcome, weaponDrop, armorDrop, codexDrop, randomCodexMove, randomArmorSlot } from "@/lib/drops";
import { clubRoom, klutzClub, thiefRoom, rollBox, wantsClub, wantsThief, TUTORIAL_MOVES } from "@/lib/quest";
import { guess as witchGuess, walkAway, SUIT_INFO, MAX_CORRECT, type Guess, type WitchCard, type WitchGame } from "@/lib/dungeon/witch";
import { CardFace } from "@/components/CardGallery";
import { xpForEnemy, BOSS_XP, shareXp, impactsFromLog } from "@/lib/creatures/levels";
import { KLUTZ_DROP_ID } from "@/hooks/useGameState";
import { pieceStats, SECOND_WIND_HEAL, SET_BONUS } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import type { ArmorKey } from "@/lib/items/armor";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import {
  PARTY_SIZE, TEAM_SIZE, ENTRY_FEE, FREE_RUNS, CHEST_DROPS, CHEST_CODEX_CHANCE, CODEX_PRICE, DECK_CARDS, MINIBOSS_REVIVE_HP, ROOM_INFO, POTIONS, addToBag, type PotionKey,
  BACKPACK, BOOKCASE_SIZE, bagSize, bagName, isPotionEntry, gearEntry, gearIdOf, lootEntry, lootIdOf, type BagEntry, type FloorItem,
  startRun, startQuestRun, stepInside, canMoveOn, moveOn, nextRooms, runPosition, leaveRoom, setTeam, fightingTeam, isFight, enemyFighter, gearName, endRun,
  loadDungeon, saveDungeon, freeHealing, type SackItem, type GotItem, type DungeonSave, type DungeonRun, type Room,
  curse, illnessTick, dungeonOf, DUNGEONS, DEEP_ROUTE, witchPrize, ILLNESS_DAMAGE, ILLNESS_ACTIONS, CYCLOPS_LEVEL, WARDEN_LEVEL, type DungeonId,
} from "@/lib/dungeon/run";
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
import Help from "@/components/Help";

const GOLD = "#f5c542";

function combatLine(f: Parameters<typeof combatSummary>[0]): string {
  const s = combatSummary(f);
  return `${s.hp} HP · Atk ${Math.round(s.atk)} · Rng ${Math.round(s.rng)} · Mag ${Math.round(s.mag)} · Agi ${Math.round(s.agil)} · MDef ${Math.round(s.mdef)} · RDef ${Math.round(s.rdef)} · MgDef ${Math.round(s.magdef)}`;
}

function dropLabel(d: Drop): string {
  if (d.dropType === "reward") return `${d.amount} gold`;
  if (d.dropType === "card") return `${d.name} card`;
  return d.dropType === "item" ? `${d.name} (${d.rarity})` : d.name;
}

export default function DungeonPage() {
  const game = useGameState();
  const router = useRouter();
  const [lab, setLab] = useState<DungeonSave | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);
  const [found, setFound] = useState<GotItem[] | null>(null); // what the current room just gave you
  const [notes, setNotes] = useState<string[]>([]);
  // Leaving for the Den: keep showing what's on screen until the Den loads
  // (otherwise the entrance flashes up for a moment on the way out).
  const [leaving, setLeaving] = useState(false);          // anything else that just happened (e.g. Second Wind)
  // The creature cards for the fight you've walked into (tap the creatures; see EncounterCards).
  const [cardsOpen, setCardsOpen] = useState(false);
  // A weapon or armour piece you just found, opened up (to compare and swap).
  const [viewGear, setViewGear] = useState<CreatureOrItemDrop | null>(null);
  // Bumped to shake the screen (the witch's stab, and the illness after it).
  const [shake, setShake] = useState(0);

  // Every change to the run is saved straight away.
  function update(next: DungeonSave) {
    saveDungeon(next);
    setLab(next);
  }
  function updateRun(fn: (r: DungeonRun) => DungeonRun) {
    const cur = loadDungeon();
    if (cur.run) update({ ...cur, run: fn(cur.run) });
  }
  function updateBag(fn: (bag: BagEntry[]) => BagEntry[]) {
    const cur = loadDungeon();
    update({ ...cur, meta: { ...cur.meta, bag: fn(cur.meta.bag ?? []) } });
  }
  const takeOne = (key: BagEntry) => updateBag((bag) => {
    const i = bag.indexOf(key);
    return i < 0 ? bag : [...bag.slice(0, i), ...bag.slice(i + 1)];
  });

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
  // creatures aren't found down here: they come as cards). Everything else
  // needs a slot; if the bag's full it waits for you to make room.
  function carry(drops: Drop[]) {
    const cur = loadDungeon();
    const bag = [...(cur.meta.bag ?? [])];
    const loot = { ...(cur.meta.loot ?? {}) };
    const pending: Drop[] = [];
    for (const raw of drops) {
      const x = (raw.dropType === "creature" ? { ...raw, dropType: "card" } : raw) as Drop;
      if (x.dropType === "reward") { game.addGold(x.amount); continue; }
      if (x.dropType === "card") { game.addDrop(x); continue; }
      const potion = x.dropType === "item" ? x.potion : undefined;
      if (bag.length >= bagSize(cur.meta)) pending.push(x);
      else if (potion) bag.push(potion); // a potion found down here goes straight in the bag, ready to drink
      else { loot[x.id] = x; bag.push(lootEntry(x.id)); }
    }
    update({ meta: { ...cur.meta, bag, loot }, run: cur.run ? { ...cur.run, pending: [...(cur.run.pending ?? []), ...pending] } : null });
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
    if (!cur.run || !x || cur.meta.bag.length >= bagSize(cur.meta)) return;
    const potion = x.dropType === "item" ? x.potion : undefined;
    update({
      meta: potion ? { ...cur.meta, bag: [...cur.meta.bag, potion] }
        : { ...cur.meta, bag: [...cur.meta.bag, lootEntry(x.id)], loot: { ...(cur.meta.loot ?? {}), [x.id]: x } },
      run: { ...cur.run, pending: (cur.run.pending ?? []).filter((p) => p.id !== id) },
    });
  }

  // Whatever's still waiting stays on the floor.
  const leavePending = (r: DungeonRun): DungeonRun =>
    r.pending?.length ? { ...r, floor: [...(r.floor ?? []), ...r.pending.map((x) => ({ room: here(r), drop: x }))], pending: [] } : r;

  // The boss is beaten: walk back through and pick up everything you left.
  function gatherFloor() {
    const cur = loadDungeon();
    if (!cur.run || cur.run.status !== "cleared") return;
    const floor: FloorItem[] = [...(cur.run.floor ?? []), ...(cur.run.pending ?? []).map((x) => ({ room: "", drop: x }))];
    let bag = [...cur.meta.bag];
    for (const f of floor) {
      if (f.drop) game.addDrop(f.drop);
      else if (f.potion && bag.length < bagSize(cur.meta)) bag = [...bag, f.potion];
    }
    const gathered: GotItem[] = floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }));
    update({ meta: { ...cur.meta, bag }, run: { ...cur.run, floor: [], pending: [], got: [...(cur.run.got ?? []), ...gathered], loot: [...cur.run.loot, `${floor.length} things gathered on the walk back`] } });
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

  // ── Starting and ending runs ──────────────────────────────────────
  function begin(party: string[], dungeon: DungeonId = 1) {
    if (!lab) return;
    const deep = dungeon === 2;
    const free = !deep && lab.meta.runs < FREE_RUNS;
    if (!free && !game.spendGold(ENTRY_FEE)) return;
    const hp = Object.fromEntries(party.map((id) => [id, lab.meta.injuries[id] ?? 1]));
    const team = party.slice(0, TEAM_SIZE).filter((id) => hp[id] > 0);
    if (deep) {
      const n = (lab.meta.deepRuns ?? 0) + 1;
      update({ meta: { ...lab.meta, deepRuns: n }, run: startRun(party, team, hp, n, Math.random, 2) });
      return;
    }
    // Klutz's box: until it's back, runs are the quest's short run (club, then thief).
    const quest = wantsClub(game.quest) || wantsThief(game.quest);
    if (quest) game.acceptQuest();
    const r = quest ? startQuestRun(party, team, hp, lab.meta.runs + 1) : startRun(party, team, hp, lab.meta.runs + 1);
    update({ meta: { ...lab.meta, runs: lab.meta.runs + 1 }, run: r });
  }

  function goHome() {
    const cur = loadDungeon();
    let shelf = BOOKCASE_SIZE - game.inventory.filter((x) => x.dropType === "item" && x.codexMove).length;
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
    battle.clear();
    setFound(null);
    setNotes([]);
  }

  function healAll() {
    if (lab) update({ ...lab, meta: { ...lab.meta, injuries: {} } });
  }

  // ── Room rewards ──────────────────────────────────────────────────
  function give(drops: Drop[], also: (r: DungeonRun) => DungeonRun = (r) => r) {
    carry(drops);
    setFound(drops.map((drop) => ({ drop })));
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
      const d = dropFromOutcome(rollBarcodeOutcome());
      if (d) drops.push(d);
    }
    if (Math.random() < CHEST_CODEX_CHANCE) drops[drops.length - 1] = codexDrop(randomCodexMove());
    give(drops, markDone);
  }

  function buyCodex(move: string) {
    const room = lab?.run?.current;
    if (!room?.offers?.includes(move) || room.bought?.includes(move) || !game.spendGold(CODEX_PRICE)) return;
    const codex = codexDrop(move);
    carry([codex]);
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, `Codex: ${move}`], got: [...(r.got ?? []), { drop: codex }], current: { ...r.current, bought: [...(r.current.bought ?? []), move] } } : r));
  }

  function healOne(id: string) {
    updateRun((r) => markDone({ ...r, hp: { ...r.hp, [id]: 1 } }));
  }

  // Beating a mini boss: heal one creature to full, or revive one that was knocked out.
  function bless(id: string) {
    updateRun((r) => {
      if (!r.current) return r;
      const team = fightingTeam(r);
      // A revived creature steps back into the team if there's room.
      const back = (r.hp[id] ?? 1) <= 0 && team.length < TEAM_SIZE ? [...team, id] : team;
      return { ...r, team: back, hp: { ...r.hp, [id]: (r.hp[id] ?? 1) <= 0 ? MINIBOSS_REVIVE_HP : 1 }, current: { ...r.current, blessed: true } };
    });
  }

  // ── The battle bag ──────────────────────────────────────────────
  // A merchant has one of each potion.
  function buyPotion(key: PotionKey) {
    const cur = loadDungeon();
    if (cur.run?.current?.bought?.includes(key) || (cur.meta.bag ?? []).length >= bagSize(cur.meta) || !game.spendGold(POTIONS[key].price)) return;
    updateBag((bag) => addToBag(bag, [key], bagSize(cur.meta)));
    updateRun((r) => (r.current
      ? { ...r, loot: [...r.loot, POTIONS[key].name], current: { ...r.current, bought: [...(r.current.bought ?? []), key] } }
      : r));
  }

  // A stash: open the sack…
  function openSack() {
    updateRun((r) => (r.current ? { ...r, current: { ...r.current, opened: true, done: true } } : r));
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
      setNotes((n) => [...n, `🎒 A rugged backpack! You can carry ${BACKPACK} things now (your bindle held 3).`]);
      updateRun((r) => (r.current ? { ...r, loot: [...r.loot, "A rugged backpack"], current: { ...r.current, sack: (r.current.sack ?? []).filter((_, i) => i !== index) } } : r));
      return;
    }
    if ("gold" in item) game.addGold(item.gold);
    else if (full) return;
    else if ("potion" in item) updateBag((bag) => addToBag(bag, [item.potion], bagSize(cur.meta)));
    else carry([item.gear]);
    const label = "gold" in item ? `${item.gold} gold` : "potion" in item ? POTIONS[item.potion].name : dropLabel(item.gear);
    const got: GotItem = "gold" in item ? { drop: goldOnly(item.gold) } : "potion" in item ? { potion: item.potion } : { drop: item.gear };
    setFound((f) => [...(f ?? []), got]);
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, label], got: [...(r.got ?? []), got], current: { ...r.current, sack: (r.current.sack ?? []).filter((_, i) => i !== index) } } : r));
  }
  function takeAllFromSack() {
    // Gold and the backpack first (they take no space), then whatever fits, in order.
    const sack = loadDungeon().run?.current?.sack ?? [];
    const free = (x: SackItem) => "gold" in x || "backpack" in x;
    // Take from the back so earlier indices stay valid.
    for (const i of sack.map((_, i) => i).reverse().filter((i) => free(sack[i]))) takeFromSack(i);
    let left = loadDungeon().run?.current?.sack ?? [];
    while (left.length > 0 && (loadDungeon().meta.bag ?? []).length < bagSize(loadDungeon().meta)) {
      takeFromSack(0);
      const next = loadDungeon().run?.current?.sack ?? [];
      if (next.length === left.length) break;
      left = next;
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

  // A deck of cards: DECK_CARDS creature cards, each rolled like a scan.
  function openDeck() {
    const drops = Array.from({ length: DECK_CARDS }, () =>
      makeCreatureDrop(CREATURE_BY_ID[pickCreatureId(pickRarity("", "random"))], "card", ""));
    give(drops, markDone);
  }

  // The boss is beaten: the run is over.
  function nextRoom() {
    setFound(null);
    setNotes([]);
    battle.clear();
    updateRun((r) => leaveRoom(leaveSack(r)));
  }

  // Down a tunnel into the next room.
  function goTo(nodeId: string) {
    // Leaving the witch mid-game: you walk away with what you've won.
    const w = loadDungeon().run?.current?.witch;
    if (w?.state === "playing" && w.correct > 0) witchLeave();
    setFound(null);
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

  // Klutz's Club, picked up off the floor.
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
    // XP (won or lost): every enemy knocked out. You get all of it; your
    // team shares it by how much each did (at least 10% each, even from the bench).
    const room0 = r.current!;
    const xp = B.team.reduce((sum, f, i) => {
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
      for (const u of game.gainXp(gains)) xpNotes.push(`⬆️ ${u.name} reached level ${u.to}!`);
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
        // Enemies wear a whole set; one piece of it drops.
        const slot = randomArmorSlot();
        drops.push(p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey, p.rarity, "", pieceStats(p.stats, slot), slot));
      }
    }
    // Its loot lies on the floor: a rickety chest (bosses) or a sack. Open it and take what you want.
    const sack: SackItem[] = drops.map((d) => (d.dropType === "reward" ? { gold: d.amount } : { gear: d }));
    // The first time you beat the Cyclops, its chest holds a rugged backpack.
    if (room.boss && bagSize(loadDungeon().meta) < BACKPACK) sack.unshift({ backpack: true });
    const container = room.kind === "miniboss" || room.kind === "boss" ? "chest" as const : "sack" as const;
    updateRun((x) => markDone({ ...after(x), hp, battle: undefined, current: x.current ? { ...x.current, sack, container, opened: false } : x.current }));
    setNotes([...xpNotes, ...winds]);
  }

  // ── Screens ───────────────────────────────────────────────────────
  if (!lab || !game.hydrated) {
    return <DenFrame title="The Labyrinth" icon="🌀"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  }

  const frame = (children: React.ReactNode) => (
    <DenFrame title={run?.dungeon === 2 ? DUNGEONS[2].name : "The Labyrinth"} icon="🌀" gold={game.gold}><Shaker shake={shake}>{children}</Shaker></DenFrame>
  );

  if (leaving) return frame(<p className="pixel-font" style={{ color: MUTED, textAlign: "center", marginTop: 40 }}>Back to the Den…</p>);

  if (!run) {
    return frame(<Entrance lab={lab} owned={owned} gold={game.gold} onBegin={begin} onHeal={healAll} />);
  }


  // A fight in progress (or just finished).
  if (battle.match && run.current && isFight(run.current.kind) && !run.current.done && run.status === "exploring") {
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
      </>
    );
  }

  if (run.status !== "exploring") {
    return frame(<RunOver run={run} lab={lab} onGather={gatherFloor} onHome={() => {
      // Knocked out: Klutz dragged you back to the Den.
      const died = run.status === "dead";
      if (died) { setLeaving(true); game.noteLabyrinthDeath(); }
      goHome();
      if (died) router.push("/");
    }} />);
  }

  // The club tutorial: it's in your bindle and not on anyone yet.
  const clubEntry = (lab.meta.bag ?? []).find((e) => itemOf(e)?.itemKey === "klutz_club");
  const clubTutorial = run.current?.quest === "club" && run.current.done && clubEntry ? clubEntry : undefined;
  // The thief's room: once it's beaten, the way on is home (with the box).
  const boxRoom = run.current?.quest === "thief" && run.current.done;
  // A fight waiting here: the Fight! button sits on the room, and tapping the
  // creatures brings up their cards (with a Fight button of their own).
  const fightHere = !!run.current && isFight(run.current.kind) && !run.current.done;
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
        onSwap={inBag ? (id) => { equipFromBag(entry, id); setViewGear(null); } : undefined}
        why={inBag ? undefined
          : (run.pending ?? []).some((d) => d.id === item.id) ? "Your bag's full, so it's still on the floor. Make room to swap it on."
          : "It's not in your bag any more."} />
    );
  };

  return frame(
    <>
      {!run.inside ? (
        <MapFirst run={run} onStep={() => updateRun(stepInside)} onEnter={(id) => { updateRun(stepInside); goTo(id); }} />
      ) : (
        <>
          <DungeonRoomView run={run} open={canMoveOn(run) && fightingTeam(run).length > 0 && !clubTutorial && !boxRoom} onGo={goTo}
            onObject={run.current?.quest === "club" && !run.current.done ? takeClub
              : run.current?.kind === "chest" && !run.current.done ? openChest
              : run.current?.container && run.current.done && !run.current.opened ? openSack
              : run.current?.quest === "thief" && run.current.done && !run.current.boxTaken ? takeBox
              : run.current?.kind === "stash" && !run.current.opened ? openSack
              : undefined}
            onFight={canFight ? () => startFight(run) : undefined}
            onEnemies={enemyIds.length > 0 ? () => setCardsOpen(true) : undefined} />
          {viewGear && gearView(viewGear)}
          {showCards && <EncounterCards creatureIds={enemyIds} onClose={() => setCardsOpen(false)}
            onFight={canFight ? () => { setCardsOpen(false); startFight(run); } : undefined} />}
          {canMoveOn(run) && fightingTeam(run).length === 0 && (
            <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center" }}>Pick at least one creature that can still fight before you go on.</p>
          )}
          <div style={{ marginTop: 12 }}>
            {run.current
              ? <RoomScreen
                  run={run} room={run.current} found={found} notes={notes} byId={byId}
                  gold={game.gold} onTreasure={takeTreasure} onClub={takeClub} onChest={openChest}
                  clubEntry={clubEntry} onTakeBox={takeBox} onTakeBoxHome={boxHome} onDeck={openDeck} onOpenSack={openSack} onTakeSack={takeFromSack} onTakeAllSack={takeAllFromSack} onBuyPotion={buyPotion} bag={(lab.meta.bag ?? []).filter(isPotionEntry)} bagUsed={(lab.meta.bag ?? []).length} bagSlots={bagSize(lab.meta)} onHeal={healOne} onBless={bless} onBuy={buyCodex} onNext={nextRoom} onWitch={witchPlay} onWitchLeave={witchLeave} onGear={setViewGear}
                />
              : <AtEntrance run={run} />}
          </div>
        </>
      )}

      {/* During the club tutorial the bindle comes first, right under the room. */}
      {!clubTutorial && <Party run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))} />}
      <Bag run={run} bag={lab.meta.bag ?? []} slots={bagSize(lab.meta)} name={bagName(lab.meta)} itemOf={itemOf} slotOf={slotOf}
        byId={byId} onDrink={drink} onEquip={equipFromBag} onLeave={leaveOnFloor} tutorial={clubTutorial}
        wornIn={(id, slot) => itemsById.get(game.equipment[id]?.[SLOT_FIELD[slot]] ?? "")} />
      {clubTutorial && <Party run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))} />}
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

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button className="card-btn" style={{ width: "auto", display: "inline-flex", color: "#ff8a80" }}
          onClick={() => updateRun((r) => ({ ...leaveSack(r), status: "retreated", battle: undefined }))}
          disabled={battle.match !== null && !battle.match.state.winner}>
          🏃 Retreat — leave the labyrinth and keep your loot
        </button>
      </div>
    </>
  );
}

// ── The entrance: choose your party ─────────────────────────────────
function Entrance({ lab, owned, gold, onBegin, onHeal }: {
  lab: DungeonSave; owned: OwnedCreature[]; gold: number; onBegin: (party: string[], dungeon: DungeonId) => void; onHeal: () => void;
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
              <li>Take up to <b>{PARTY_SIZE} creatures</b>: the first {TEAM_SIZE} fight, the rest wait in reserve (swap them between rooms).</li>
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
        <span style={{ fontSize: 12, color: MUTED }}>1–{TEAM_SIZE} fight · {TEAM_SIZE + 1}–{PARTY_SIZE} reserve</span>
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
            const fights = picked && slot < TEAM_SIZE;
            return (
              <button key={c.id} onClick={() => toggle(c.id)} disabled={hp <= 0} aria-pressed={picked}
                title={hp <= 0 ? `${c.name} is knocked out` : picked ? `Take ${c.name} out of the party` : `Add ${c.name} to the party`}
                style={{
                  position: "relative", minWidth: 0, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: picked ? (fights ? "rgba(241,217,160,0.1)" : "rgba(255,255,255,0.04)") : "none", border: "none", borderRadius: 8,
                  boxShadow: picked ? `inset 0 0 0 2px ${fights ? "#f1d9a0" : "#6b6350"}` : undefined,
                  color: "white", cursor: hp <= 0 ? "default" : "pointer", opacity: hp <= 0 ? 0.35 : 1,
                }}>
                <span className="pixel-font" style={{ maxWidth: "100%", fontSize: 12, color: rarityColor(c.rarity), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: "#f1d9a0" }}>Lv {c.fighter.level ?? 1}</span> {c.name}
                </span>
                <span style={{ width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", padding: "6%" }}>
                  <PixelSprite sprite={creatureSprite(c.creatureId)} scale={3}
                    style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
                </span>
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

      <button onClick={() => onBegin(party, dungeon)} disabled={party.length === 0 || !canPay} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        {dungeon === 2 ? "🕳️ Enter the Deep Labyrinth" : "🌀 Enter the labyrinth"} {free ? `(free · ${FREE_RUNS - lab.meta.runs} free run${FREE_RUNS - lab.meta.runs === 1 ? "" : "s"} left)` : `(${ENTRY_FEE} gold)`}
      </button>
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {ENTRY_FEE} gold — you have {gold}.</p>}
    </>
  );
}

// ── In the dungeon ────────────────────────────────────────────────
// At the entrance: one good look at the map before you go in.
// onEnter: tap one of the rooms off the entrance to step inside and head straight there.
function MapFirst({ run, onStep, onEnter }: { run: DungeonRun; onStep: () => void; onEnter: (nodeId: string) => void }) {
  const firstRooms = nextRooms(run).length > 0;
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
          </ul>
        </Help>
      </div>
      <p style={{ fontSize: 15, color: MUTED, margin: "4px 0 12px", lineHeight: 1.5 }}>
        {run.map.quest ? "Just a short way in — it went this way." : "Remember the way to the lair: it's too dark to read inside."}
      </p>
      <DungeonMapView run={run} onEnter={firstRooms ? onEnter : undefined} />
      <button className="pixel-btn" onClick={onStep} style={{ marginTop: 14, width: "100%", fontSize: 18, padding: "10px 0" }}>
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
        Tap one to go on. You can change your team below first.
      </p>
    </div>
  );
}

function RoomScreen({ run, room, found, notes, byId, gold, bagUsed, bagSlots, onTreasure, onClub, clubEntry, onTakeBox, onTakeBoxHome, onChest, onDeck, onOpenSack, onTakeSack, onTakeAllSack, onBuyPotion, onHeal, onBless, onBuy, onNext, onWitch, onWitchLeave, onGear }: {
  onWitch: (g: Guess) => void; onWitchLeave: () => void; onGear: (item: CreatureOrItemDrop) => void;
  run: DungeonRun; room: Room; found: GotItem[] | null; notes: string[]; byId: (id: string) => OwnedCreature | undefined; gold: number;
  onTreasure: (r: Room) => void; onClub: () => void; clubEntry?: BagEntry;
  onTakeBox: () => void; onTakeBoxHome: () => void; onChest: () => void; onDeck: () => void; onOpenSack: () => void; onTakeSack: (i: number) => void; onTakeAllSack: () => void; onBuyPotion: (k: PotionKey) => void; bag: PotionKey[]; bagUsed: number; bagSlots: number; onHeal: (id: string) => void; onBless: (id: string) => void; onBuy: (move: string) => void; onNext: () => void;
}) {
  const info = room.quest === "club" ? { name: "A dropped club", icon: "🏏" } : room.quest === "thief" ? { name: "The thief", icon: "💀" } : ROOM_INFO[room.kind];
  // What's in a sack or chest (a stash, or a beaten fight's loot): tap to take.
  const sackPanel = (
    <ContainerLoot name={room.container === "chest" ? "The rickety chest" : room.kind === "stash" ? "The stash" : "The sack"}
      sprite={room.container === "chest" ? RICKETY_CHEST_OPEN : BURLAP_SACK_OPEN}
      items={room.sack ?? []} bagUsed={bagUsed} bagSlots={bagSlots} onTake={onTakeSack} onTakeAll={onTakeAllSack} />
  );
  // A beaten fight's loot: the container, then what's in it once opened.
  const fightLoot = room.container && (room.opened ? sackPanel : (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
        {room.container === "chest" ? "It leaves a rickety old chest behind, its lid hanging loose." : "It leaves a grubby sack behind."}
      </p>
      <button className="pixel-btn" onClick={onOpenSack}>{room.container === "chest" ? "🧰 Loot the chest" : "💰 Loot the sack"}</button>
    </div>
  ));
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

      {found && found.length > 0 && (
        <div style={{ margin: "10px 0 0" }}>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>You got:</div>
          <LootGrid items={found} onGear={onGear} />
        </div>
      )}
      {notes.map((n) => <div key={n} style={{ fontSize: 13, color: "#f1d9a0", marginTop: 4 }}>{n}</div>)}

      {room.quest === "club" && (room.done ? (
        <>
          {clubEntry ? (
            <div className="tutorial-tip" style={{ marginTop: 10 }}>
              <b>Equipping gear.</b> Klutz&apos;s Club is in your bindle now. It&apos;s not much, but it&apos;s better than bare claws —
              give it to one of your creatures before you go on. Tap the club in your bindle below.
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

      {room.kind === "chest" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>An old chest, humming faintly — like the barcodes do. {CHEST_DROPS} things rattle inside.</p>
          <button className="pixel-btn" onClick={onChest}>Open it</button>
        </>
      ))}

      {room.kind === "witch" && room.witch && <WitchTable room={room} victim={byId(run.illness?.id ?? "")?.name} onGuess={onWitch} onLeave={onWitchLeave} next={next} />}

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
            A cart with two dusty bottles, and a merchant who smiles too much. &ldquo;One of each, friend — that&apos;s all I&apos;ve got. One per slot in your bag, mind; they don&apos;t stack.&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(Object.keys(POTIONS) as PotionKey[]).map((k) => {
              const p = POTIONS[k];
              const sold = room.bought?.includes(k);
              const can = !sold && gold >= p.price && bagUsed < bagSlots;
              return (
                <button key={k} className="card-btn" disabled={!can} onClick={() => onBuyPotion(k)} style={{ opacity: can ? 1 : 0.5 }}>
                  <span style={{ flex: 1 }}>
                    <b>{p.icon} {p.name}</b>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>Restores {p.heal} HP to one creature. In a fight it uses your turn.</span>
                  </span>
                  <span className="pixel-font" style={{ color: GOLD, flexShrink: 0 }}>{sold ? "sold" : `🪙 ${p.price}`}</span>
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>You&apos;re carrying {bagUsed}/{bagSlots} · {gold} gold.</p>
          {next}
        </>
      )}

      {room.kind === "librarian" && (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A hooded figure sits among towers of crumbling books. &ldquo;Codexes,&rdquo; it whispers. &ldquo;Each teaches one creature a move of its blood — once. {CODEX_PRICE} gold apiece.&rdquo;
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(room.offers ?? []).map((name) => {
              const move = MOVE_BY_NAME[name];
              const sold = room.bought?.includes(name);
              return (
                <button key={name} className="card-btn" disabled={sold || gold < CODEX_PRICE} onClick={() => onBuy(name)}
                  style={{ opacity: sold || gold < CODEX_PRICE ? 0.5 : 1 }}>
                  <span style={{ flex: 1 }}>
                    <b style={{ color: "#c7b8ff" }}>📖 Codex: {name}</b>
                    <span style={{ fontSize: 12, color: move?.race ? RACE_INFO[move.race].color : MUTED }}> · {move?.race ? RACE_INFO[move.race].name : ""} only</span>
                    <span style={{ display: "block", fontSize: 12, color: MUTED }}>{move?.desc}</span>
                  </span>
                  <span className="pixel-font" style={{ color: GOLD, flexShrink: 0 }}>{sold ? "bought" : `🪙 ${CODEX_PRICE}`}</span>
                </button>
              );
            })}
          </div>
          {gold < CODEX_PRICE && <p style={{ fontSize: 12, color: MUTED }}>You have {gold} gold.</p>}
          {next}
        </>
      )}

      {isFight(room.kind) && room.done && fightLoot}
      {isFight(room.kind) && (room.done ? (room.kind === "miniboss" && !room.blessed ? (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            As it falls, something warm washes over your party. Choose one creature: heal it to full, or bring a knocked-out one back with {Math.round(MINIBOSS_REVIVE_HP * 100)}% HP.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.party.map((id) => {
              const c = byId(id);
              const hp = run.hp[id] ?? 1;
              return c && (
                <button key={id} className="card-btn" disabled={hp >= 1} onClick={() => onBless(id)} style={{ opacity: hp >= 1 ? 0.45 : 1 }}>
                  <b style={{ color: rarityColor(c.rarity) }}>{c.name}</b>
                  <span style={{ fontSize: 12, color: MUTED }}>
                    {hp <= 0 ? `knocked out → revive to ${Math.round(MINIBOSS_REVIVE_HP * 100)}%` : hp < 1 ? `${Math.round(hp * 100)}% HP → heal to full` : "already full"}
                  </span>
                </button>
              );
            })}
          </div>
          {onward}
        </>
      ) : next) : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8", margin: "6px 0 10px" }}>
            {room.quest === "thief" && "There it is: a Baby Cyclops, hunched over a battered box, picking through Klutz's weapons. Klutz ducks behind you: “Oi! That's mine! Go on — you fight, I'll tell you what to do.”"}
            {room.kind === "easy" && !room.quest && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "miniboss" && "Something big has made this room its lair. One creature — but an Epic one, well armed, and it fights smart. Beat it and you can heal or revive one of your party."}
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
            Win: {room.quest === "thief" ? "Klutz's box" : <>{room.gold} gold{(room.enemies ?? []).some((e) => e.gear.some((p) => p.drops)) ? " and something shiny one of them is carrying" : ""}</>}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}. Press <b>Fight!</b> on the room when you&apos;re ready.
          </p>
        </>
      ))}
    </div>
  );
}

// Your party: three in the team (the first one leads), two on the bench.
function Party({ run, byId, onTeam }: { run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void }) {
  const member = (id: string): PartyMember[] => {
    const c = byId(id);
    return c ? [{ id, name: c.name, rarity: c.rarity, creatureId: c.creatureId, maxHp: c.fighter.maxHp, hp: run.hp[id] ?? 1 }] : [];
  };
  const team = fightingTeam(run);
  return (
    <>
      <PartySlots team={team.flatMap(member)} bench={run.party.filter((id) => !team.includes(id)).flatMap(member)} onTeam={onTeam} />
      {team.length === 0 && <p style={{ fontSize: 13, color: "#ff8a80", margin: "6px 0 0" }}>Nobody is set to fight — move someone from the bench into the team.</p>}
    </>
  );
}

function RunOver({ run, lab, onHome, onGather }: { run: DungeonRun; lab: DungeonSave; onHome: () => void; onGather: () => void }) {
  const floor: FloorItem[] = [...(run.floor ?? []), ...(run.pending ?? []).map((x) => ({ room: "", drop: x }))];
  const title = run.status === "cleared" ? "The labyrinth is beaten!" : run.status === "dead" ? "Everything goes dark…" : "You slip back out";
  const text = run.status === "cleared" && run.dungeon === 2
    ? `The Warden falls, and the deep goes quiet. You beat the Deep Labyrinth on run ${run.runNumber}!`
    : run.status === "cleared"
    ? `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! (Its rewards — the Codex of Stances, the Tavern and your trophy — come in the next update.)`
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
        <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0", margin: "4px 0 8px" }}>What you got</div>
        <LootGrid items={run.got ?? []} grouped />
        {floor.length > 0 && (
          <>
            <div className="pixel-font" style={{ fontSize: 15, color: run.status === "cleared" ? "#f1d9a0" : "#ff8a80", margin: "16px 0 8px" }}>
              Left behind{run.status === "cleared" ? "" : " (lost)"}
            </div>
            <LootGrid items={floor.map((f) => (f.drop ? { drop: f.drop } : { potion: f.potion! }))} faded grouped />
            {run.status === "cleared" && (
              <div style={{ margin: "10px 0 0" }}>
                <p style={{ fontSize: 13, color: "#d8d4c8" }}>With the Cyclops gone, you can walk back through and pick up the {floor.length} thing{floor.length === 1 ? "" : "s"} you left behind.</p>
                <button className="pixel-btn" onClick={onGather}>🚶 Walk back and gather everything</button>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ height: 14 }} />
      <button className="pixel-btn" onClick={onHome}>Continue</button>
    </div>
  );
}

// The potions in the bag, one entry per kind (for the battle screen).
function bagItems(bag: PotionKey[]): BagItem[] {
  return (Object.keys(POTIONS) as PotionKey[])
    .map((k) => ({ key: k, ...POTIONS[k], count: bag.filter((b) => b === k).length }))
    .filter((it) => it.count > 0);
}

// Between rooms: your battle bag as slots. Tap one for what you can do with it.
// tutorial: the entry to walk the player through equipping (Klutz's Club).
function Bag({ run, bag, slots, name, itemOf, slotOf, byId, wornIn, onDrink, onEquip, onLeave, tutorial }: {
  run: DungeonRun; bag: BagEntry[]; slots: number; name: string;
  itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined; slotOf: (it: CreatureOrItemDrop) => EquipSlot | null;
  byId: (id: string) => OwnedCreature | undefined; onDrink: (k: PotionKey, id: string) => void;
  wornIn: (creatureId: string, slot: EquipSlot) => CreatureOrItemDrop | undefined; // what a creature wears in a slot
  onEquip: (e: BagEntry, creatureId: string) => void; onLeave: (e: BagEntry) => void; tutorial?: BagEntry;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const standing = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0);
  const hurt = standing.filter((id) => (run.hp[id] ?? 1) < 1);
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
    <>
      <SectionTitle>{name} ({bag.length}/{slots})</SectionTitle>
      {tutorialAt >= 0 && sel !== tutorialAt && (
        <div className="tutorial-tip" style={{ marginBottom: 8 }}>
          <span className="tutorial-arrow">👇</span> Tap <b>Klutz&apos;s Club</b> to see what you can do with it.
        </div>
      )}
      <BagSlots slots={slots} looks={bag.map((x) => slotLook(x, isPotionEntry(x) ? undefined : itemOf(x)))}
        selected={sel} onSelect={(i) => { setSel(i); setComparing(false); }} pulse={tutorialAt >= 0 && sel !== tutorialAt ? tutorialAt : undefined} />
      {bag.length === 0 && <p style={{ fontSize: 12, color: MUTED, margin: "6px 0 0" }}>Empty. Gold and creature cards take no space; gear, codexes and potions take a slot each.</p>}

      {e && (
        <div className="stone-panel" style={{ marginTop: 8, padding: "10px 12px" }}>
          {isPotionEntry(e) ? (
            <>
              <b>{POTIONS[e].icon} {POTIONS[e].name}</b> <span style={{ fontSize: 12, color: MUTED }}>restores {POTIONS[e].heal} HP to one creature</span>
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
              {teaching && (
                <div className="tutorial-tip" style={{ margin: "8px 0 0" }}>
                  <span className="tutorial-arrow">👇</span> Now choose who carries it. Gear you find down here works the same way: tap it in your bag, then equip it.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {slot && standing.map((id) => chip(id, `Equip on ${byId(id)!.name}`, done(() => onEquip(e, id)), {}, teaching))}
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
    </>
  );
}

// Shakes its contents each time `shake` goes up (the witch's stab, an illness).
function Shaker({ shake, children }: { shake: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || shake === 0) return;
    el.classList.remove("screen-shake");
    void el.offsetWidth; // restart the animation
    el.classList.add("screen-shake");
  }, [shake]);
  return <div ref={ref}>{children}</div>;
}

// One of the witch's cards.
function WitchCardView({ card, small }: { card: WitchCard; small?: boolean }) {
  const s = SUIT_INFO[card.suit];
  return (
    <div className="witch-card" style={{ borderColor: s.color, width: small ? 34 : 86, height: small ? 48 : 120, fontSize: small ? 14 : 44 }}>
      <span className="pixel-font" style={{ color: s.color }}>{card.n}</span>
      <span style={{ fontSize: small ? 11 : 22 }}>{s.icon}</span>
    </div>
  );
}

// The card witch: higher or lower, for creature cards.
function WitchTable({ room, victim, onGuess, onLeave, next }: {
  room: Room; victim?: string; onGuess: (g: Guess) => void; onLeave: () => void; next: React.ReactNode;
}) {
  const w = room.witch!;
  const result = w.last?.result;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <p style={{ fontSize: 14, color: "#d8d4c8", margin: 0, flex: 1 }}>
          {w.state === "playing" && w.history.length === 0 && <>A hunched witch shuffles a deck of bone cards, a creature card face up beside them. &ldquo;Higher or lower, dearie? Guess right and it&apos;s yours…&rdquo;</>}
          {w.state === "playing" && result === "right" && <b style={{ color: "#5ee08a" }}>Right! </b>}
          {w.state === "playing" && result === "stick" && <b style={{ color: "#f1d9a0" }}>Stick — the same number. Guess again. </b>}
          {w.state === "lost" && <b style={{ color: "#ff8a80" }}>Wrong! She lunges — {victim ?? "your creature"} is stabbed and falls ill.{(w.won?.length ?? w.correct) > 0 && " She sweeps your cards back into her deck."}</b>}
          {w.state === "left" && <b style={{ color: "#f1d9a0" }}>You walk away with {w.correct} card{w.correct === 1 ? "" : "s"}.</b>}
        </p>
        <Help title="The card witch">
          <ul>
            <li>Cards go from <b>1 to 11</b>, in Melee ⚔️, Ranged 🏹 and Magic 🔮.</li>
            <li>The next card is <b>higher, lower or the same</b> — equal odds.</li>
            <li>Right: you win <b>the creature card on the table</b>, and she turns over another. Same (&ldquo;stick&rdquo;): guess again.</li>
            <li>Wrong: she stabs the creature that was <b>last on the field</b> (or your first). It loses <b>{Math.round(ILLNESS_DAMAGE * 100)}% HP</b> each of the next <b>{ILLNESS_ACTIONS} actions</b> — rooms, or rounds of a fight.</li>
            <li>Walk away any time and keep your cards — lose, and she takes them all back. Her deck runs out after {MAX_CORRECT}.</li>
          </ul>
        </Help>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, margin: "12px 0", justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 180 }}>
          {w.history.slice(-8).map((c, i) => <WitchCardView key={i} card={c} small />)}
        </div>
        <WitchCardView card={w.card} />
      </div>
      {w.state === "playing" && w.prize && CREATURE_BY_ID[w.prize] && (
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div className="pixel-font" style={{ fontSize: 14, color: "#f1d9a0", marginBottom: 6 }}>{w.correct > 0 ? "Her next prize" : "Her prize"} — guess right to win it:</div>
          <div style={{ width: 150, margin: "0 auto" }}>
            <CardFace key={`${w.prize}-${w.correct}`} t={CREATURE_BY_ID[w.prize]} creatureId={w.prize} glow footer="🃏 On the table" />
          </div>
        </div>
      )}
      <div className="pixel-font" style={{ textAlign: "center", fontSize: 15, color: "#f1d9a0", marginBottom: 8 }}>
        🃏 Won so far: {(w.won ?? []).length === 0 ? (w.correct > 0 ? w.correct : "nothing yet") : (w.won ?? []).map((id, i) => (
          <span key={i} style={{ color: rarityColor(CREATURE_BY_ID[id]?.rarity ?? "common") }}>{i > 0 ? ", " : ""}{CREATURE_BY_ID[id]?.name ?? "?"}</span>
        ))}
      </div>
      {w.state === "playing" ? (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pixel-btn" style={{ flex: 1, fontSize: 18 }} disabled={w.card.n >= 11} onClick={() => onGuess("higher")}>⬆️ Higher</button>
            <button className="pixel-btn" style={{ flex: 1, fontSize: 18 }} disabled={w.card.n <= 1} onClick={() => onGuess("lower")}>⬇️ Lower</button>
          </div>
          <button className="card-btn" style={{ marginTop: 8, justifyContent: "center" }} onClick={onLeave}>
            {w.correct > 0 ? `🚶 Walk away with ${w.correct} card${w.correct === 1 ? "" : "s"}` : "🚶 Walk away"}
          </button>
        </>
      ) : next}
    </div>
  );
}
