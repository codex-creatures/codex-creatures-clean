"use client";
// app/dungeon/page.tsx
// A run through dungeon 1: pick a party of up to 5, study the map scroll at
// the entrance, then step inside — from there you see only the room you're
// in and the tunnels leading on. Fight, heal and loot, and face the boss.
// The rules live in lib/dungeon/run.ts; the run is saved after every step,
// so leaving the page (or refreshing) never loses it.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BagSlots, { slotLook } from "@/components/BagSlots";
import PartySlots, { type PartyMember } from "@/components/PartySlots";
import { useGameState, SLOT_FIELD, type EquipSlot } from "@/hooks/useGameState";
import type { Drop } from "@/lib/types";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CREATURE_BY_ID, MOVE_BY_NAME, RACE_INFO } from "@/lib/creatures/creatureData";
import { makeCreatureDrop } from "@/lib/creatures/summon";
import { pickCreatureId, pickRarity } from "@/lib/items/gameHelpers";
import { creatureTypeLabel } from "@/lib/creatures/creatureType";
import { rollBarcodeOutcome } from "@/lib/barcodeRegistry";
import { itemToCombatStats } from "@/lib/combat/loadout";
import { WEAPON_AFFINITY } from "@/lib/items/ceilings";
import { DAMAGE_TYPE_INFO } from "@/lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "@/lib/types";
import { dropFromOutcome, weaponDrop, armorDrop, codexDrop, randomCodexMove, randomArmorSlot } from "@/lib/drops";
import { clubRoom, klutzClub, rattlebonesRoom, rollBox, wantsClub, wantsThief } from "@/lib/quest";
import { pieceStats, SECOND_WIND_HEAL, SET_BONUS } from "@/lib/items/armor";
import type { ItemKey } from "@/lib/items/ceilings";
import type { ArmorKey } from "@/lib/items/armor";
import { AI_LEVEL_LABELS } from "@/lib/combat/thinkingAi";
import {
  PARTY_SIZE, TEAM_SIZE, ENTRY_FEE, FREE_RUNS, CHEST_DROPS, CHEST_CODEX_CHANCE, CODEX_PRICE, DECK_CARDS, MINIBOSS_REVIVE_HP, ROOM_INFO, POTIONS, addToBag, type PotionKey,
  BACKPACK, BOOKCASE_SIZE, bagSize, bagName, isPotionEntry, gearEntry, gearIdOf, lootEntry, lootIdOf, type BagEntry, type FloorItem,
  startRun, stepInside, canMoveOn, moveOn, runPosition, leaveRoom, setTeam, fightingTeam, isFight, enemyFighter, gearName, endRun,
  loadDungeon, saveDungeon, type DungeonSave, type DungeonRun, type Room,
} from "@/lib/dungeon/run";
import DenFrame from "@/components/DenFrame";
import { YOU } from "@/components/BattleLog";
import {
  BattleView, SectionTitle, StatsLine, loadOwnedCreatures, rarityColor, usePlayableBattle, MUTED,
  type Match, type MemberInfo, type OwnedCreature, type BagItem,
} from "@/components/BattleScreen";
import { combatSummary } from "@/lib/combat/loadout";
import { CYCLOPS_PARTS, cyclopsTeam } from "@/lib/creatures/bosses";
import DungeonMapView from "@/components/DungeonMapView";
import DungeonRoomView from "@/components/DungeonRoomView";

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
  const [found, setFound] = useState<Drop[] | null>(null); // what the current room just gave you
  const [notes, setNotes] = useState<string[]>([]);          // anything else that just happened (e.g. Second Wind)

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
    update({ meta: { ...cur.meta, bag, loot }, run: { ...cur.run, floor: [...(cur.run.floor ?? []), ...(item ? [item] : [])] } });
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
    update({ meta: { ...cur.meta, bag }, run: { ...cur.run, floor: [], pending: [], loot: [...cur.run.loot, `${floor.length} things gathered on the walk back`] } });
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
  function begin(party: string[]) {
    if (!lab) return;
    const free = lab.meta.runs < FREE_RUNS;
    if (!free && !game.spendGold(ENTRY_FEE)) return;
    const hp = Object.fromEntries(party.map((id) => [id, lab.meta.injuries[id] ?? 1]));
    let r = startRun(party, party.slice(0, TEAM_SIZE).filter((id) => hp[id] > 0), hp, lab.meta.runs + 1);
    // Klutz's box: his club lies in the first room until you've picked it up.
    if (wantsClub(game.quest)) {
      game.acceptQuest();
      r = { ...r, current: clubRoom(), cleared: [], room: Math.max(1, r.room) };
    }
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
    setFound(drops);
    updateRun((r) => also({ ...r, loot: [...r.loot, ...drops.map(dropLabel)] }));
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
    carry([codexDrop(move)]);
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, `Codex: ${move}`], current: { ...r.current, bought: [...(r.current.bought ?? []), move] } } : r));
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

  function takeStash() {
    const cur = loadDungeon();
    const items = cur.run?.current?.stash ?? [];
    const room = bagSize(cur.meta) - (cur.meta.bag ?? []).length;
    const taken = items.slice(0, Math.max(0, room)), left = items.slice(Math.max(0, room));
    updateBag((bag) => addToBag(bag, taken, bagSize(cur.meta)));
    updateRun((r) => markDone({ ...r, loot: [...r.loot, ...taken.map((k) => POTIONS[k].name)], floor: [...(r.floor ?? []), ...left.map((k) => ({ room: here(r), potion: k }))] }));
  }

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
    updateRun(leaveRoom);
  }

  // Down a tunnel into the next room.
  function goTo(nodeId: string) {
    setFound(null);
    setNotes([]);
    battle.clear();
    const thief = wantsThief(game.quest);
    updateRun((r) => {
      const n = moveOn(leavePending(r), nodeId);
      return thief ? { ...n, current: rattlebonesRoom() } : n;
    });
  }

  // Klutz's box, picked up off the floor where the Rattlebones dropped it.
  function takeBox() {
    game.questBoxFound(rollBox());
    updateRun((r) => (r.current ? { ...r, loot: [...r.loot, "Klutz's box"], current: { ...r.current, boxTaken: true } } : r));
  }
  // …and straight home with it, to Klutz.
  function boxHome() {
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
    const ids = fightingTeam(r).filter((id) => byId(id));
    const mine = ids.map((id) => byId(id)!);
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
      { A: mine.map((c) => c.fighter), B: room.boss ? cyclopsTeam() : room.enemies!.map(enemyFighter) },
      { A: mine, B: info },
      room.level ?? "hard",
      {
        startHp: mine.map((c, i) => Math.round((r.hp[ids[i]] ?? 1) * c.fighter.maxHp)),
        title: room.boss ? "Labyrinth · the Cyclops" : `Labyrinth · ${ROOM_INFO[room.kind].name}`,
        boss: room.boss,
      },
    );
  }

  // The fight is over: HP comes back to the party, and the winner's rewards.
  function finishFight(r: DungeonRun, m: Match) {
    const ids = r.current?.fighters ?? [];
    const hp = { ...r.hp };
    m.state.sides.A.team.forEach((f, i) => { if (ids[i]) hp[ids[i]] = f.hp / f.maxHp; });
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
      updateRun((x) => ({ ...x, hp, status: "dead", battle: undefined }));
      battle.clear();
      return;
    }
    const room = r.current!;
    if (room.quest === "rattlebones") {
      // It falls apart, and the box it was carrying drops to the floor.
      give([goldOnly(room.gold ?? 0)], (x) => markDone({ ...x, hp, battle: undefined }));
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
    give(drops, (x) => markDone({ ...x, hp, battle: undefined }));
    if (room.kind === "miniboss" && bagSize(loadDungeon().meta) < BACKPACK) {
      const cur = loadDungeon();
      update({ ...cur, meta: { ...cur.meta, bagSize: BACKPACK } });
      winds.push(`🎒 Among the mini boss's things: a rugged backpack! You can carry ${BACKPACK} things now (your bindle held 3).`);
    }
    setNotes(winds);
  }

  // ── Screens ───────────────────────────────────────────────────────
  if (!lab || !game.hydrated) {
    return <DenFrame title="The Labyrinth" icon="🌀"><p style={{ color: MUTED }}>Loading…</p></DenFrame>;
  }

  const frame = (children: React.ReactNode) => (
    <DenFrame title="The Labyrinth" icon="🌀" gold={game.gold}>{children}</DenFrame>
  );

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
    return frame(<RunOver run={run} lab={lab} onHome={goHome} onGather={gatherFloor} />);
  }

  // The club tutorial: it's in your bindle and not on anyone yet.
  const clubEntry = (lab.meta.bag ?? []).find((e) => itemOf(e)?.itemKey === "klutz_club");
  const clubTutorial = run.current?.quest === "club" && run.current.done && clubEntry ? clubEntry : undefined;
  // The Rattlebones' room: once it's beaten, the way on is home (with the box).
  const boxRoom = run.current?.quest === "rattlebones" && run.current.done;

  return frame(
    <>
      {!run.inside ? (
        <MapFirst run={run} onStep={() => updateRun(stepInside)} />
      ) : (
        <>
          <DungeonRoomView run={run} open={canMoveOn(run) && fightingTeam(run).length > 0 && !clubTutorial && !boxRoom} onGo={goTo}
            onObject={run.current?.quest === "club" && !run.current.done ? takeClub
              : run.current?.kind === "chest" && !run.current.done ? openChest
              : run.current?.quest === "rattlebones" && run.current.done && !run.current.boxTaken ? takeBox
              : undefined} />
          {canMoveOn(run) && fightingTeam(run).length === 0 && (
            <p style={{ fontSize: 13, color: "#ff8a80", textAlign: "center" }}>Pick at least one creature that can still fight before you go on.</p>
          )}
          <div style={{ marginTop: 12 }}>
            {run.current
              ? <RoomScreen
                  run={run} room={run.current} found={found} notes={notes} byId={byId}
                  gold={game.gold} onTreasure={takeTreasure} onClub={takeClub} onChest={openChest}
                  clubEntry={clubEntry} onTakeBox={takeBox} onTakeBoxHome={boxHome} onDeck={openDeck} onStash={takeStash} onBuyPotion={buyPotion} bag={(lab.meta.bag ?? []).filter(isPotionEntry)} bagUsed={(lab.meta.bag ?? []).length} bagSlots={bagSize(lab.meta)} onHeal={healOne} onBless={bless} onBuy={buyCodex} onFight={() => startFight(run)} onNext={nextRoom}
                />
              : <AtEntrance run={run} />}
          </div>
        </>
      )}

      {/* During the club tutorial the bindle comes first, right under the room. */}
      {!clubTutorial && <Party run={run} byId={byId} onTeam={(team) => updateRun((r) => setTeam(r, team))} />}
      <Bag run={run} bag={lab.meta.bag ?? []} slots={bagSize(lab.meta)} name={bagName(lab.meta)} itemOf={itemOf} slotOf={slotOf}
        byId={byId} onDrink={drink} onEquip={equipFromBag} onLeave={leaveOnFloor} tutorial={clubTutorial} />
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
          onClick={() => updateRun((r) => ({ ...r, status: "retreated", battle: undefined }))}
          disabled={battle.match !== null && !battle.match.state.winner}>
          🏃 Retreat — leave the labyrinth and keep your loot
        </button>
      </div>
    </>
  );
}

// ── The entrance: choose your party ─────────────────────────────────
function Entrance({ lab, owned, gold, onBegin, onHeal }: {
  lab: DungeonSave; owned: OwnedCreature[]; gold: number; onBegin: (party: string[]) => void; onHeal: () => void;
}) {
  const [party, setParty] = useState<string[]>(() =>
    owned.filter((c) => c.roster && (lab.meta.injuries[c.id] ?? 1) > 0).slice(0, PARTY_SIZE).map((c) => c.id));
  const free = lab.meta.runs < FREE_RUNS;
  const injured = owned.filter((c) => lab.meta.injuries[c.id] !== undefined);
  const canPay = free || gold >= ENTRY_FEE;

  function toggle(id: string) {
    setParty((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < PARTY_SIZE ? [...p, id] : p));
  }

  return (
    <>
      <div className="stone-panel">
        <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Beyond the archway</div>
        <p style={{ fontSize: 13, color: "#d8d4c8", lineHeight: 1.5, margin: "6px 0 0" }}>
          A labyrinth of rooms and winding tunnels, with the boss&apos;s lair somewhere at the top. You get one look at your map at the entrance — once you step inside it&apos;s too dark to read, so you find your way tunnel by tunnel. Some rooms are a mystery until you walk in, and there&apos;s no going back the way you came.
          Take up to {PARTY_SIZE} creatures: {TEAM_SIZE} fight, the rest wait in reserve (swap them between rooms).
          Wounds carry from room to room. If your team falls you wake up back here — <b>you keep everything you found</b>.
        </p>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          Runs: {lab.meta.runs} · Boss defeated: {lab.meta.clears}×
          {lab.meta.firstClearRun ? ` (first on run ${lab.meta.firstClearRun})` : ""}
        </div>
      </div>

      {injured.length > 0 && (
        <div className="stone-panel" style={{ marginTop: 12 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: "#f1d9a0" }}>⛲ Healing in the Den&apos;s pool</div>
          <div style={{ fontSize: 13, color: MUTED, margin: "4px 0 8px" }}>
            Hurt from your last run: {injured.map((c) => `${c.name} ${Math.round(lab.meta.injuries[c.id] * 100)}%`).join(", ")}.
            They heal slowly while they&apos;re home. Knocked-out creatures can&apos;t join a party until they&apos;re back above 0.
          </div>
          <button className="chip" onClick={onHeal} title="A shortcut for playtesting">Testing: heal everyone now</button>
        </div>
      )}

      <SectionTitle>Your party — pick up to {PARTY_SIZE} ({party.length}/{PARTY_SIZE})</SectionTitle>
      <p style={{ fontSize: 12, color: MUTED, margin: "0 0 10px" }}>
        The first {TEAM_SIZE} you pick fight; the rest are reserves. ★ = roster.
      </p>
      {owned.length < PARTY_SIZE && (
        <p style={{ color: MUTED, lineHeight: 1.5, fontSize: 13 }}>
          You have {owned.length} creature{owned.length === 1 ? "" : "s"}. You can go in with fewer than {PARTY_SIZE}, but it&apos;s much harder —{" "}
          <Link href="/altar" style={{ color: "white", textDecoration: "underline" }}>scan</Link> or summon more to grow your party.
        </p>
      )}
      {owned.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {owned.map((c) => {
            const slot = party.indexOf(c.id);
            const hp = lab.meta.injuries[c.id] ?? 1;
            return (
              <button key={c.id} onClick={() => toggle(c.id)} disabled={hp <= 0} className="card-btn"
                style={{ borderColor: slot >= 0 ? YOU : undefined, background: slot >= 0 ? "rgba(78,161,255,0.12)" : undefined, opacity: hp <= 0 ? 0.4 : 1 }}>
                <span className="pixel-font" style={{ width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: slot >= 0 ? YOU : "rgba(255,255,255,0.08)", color: slot >= 0 ? "black" : MUTED }}>
                  {slot >= 0 ? slot + 1 : ""}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 600, color: rarityColor(c.rarity) }}>{c.roster ? "★ " : ""}{c.name}</span>
                  <span style={{ fontSize: 12, color: MUTED }}> · {c.label}{slot >= 0 ? (slot < TEAM_SIZE ? " · fights" : " · reserve") : ""}</span>
                  {hp < 1 && <span style={{ fontSize: 12, color: "#ff8a80" }}> · {hp <= 0 ? "knocked out" : `${Math.round(hp * 100)}% HP`}</span>}
                  <StatsLine stats={combatSummary(c.fighter)} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => onBegin(party)} disabled={party.length === 0 || !canPay} className="pixel-btn" style={{ marginTop: 22, width: "100%", fontSize: 20, padding: "12px 0" }}>
        🌀 Enter the labyrinth {free ? `(free · ${FREE_RUNS - lab.meta.runs} free run${FREE_RUNS - lab.meta.runs === 1 ? "" : "s"} left)` : `(${ENTRY_FEE} gold)`}
      </button>
      {!canPay && <p style={{ fontSize: 12, color: "#ff8a80", textAlign: "center" }}>Entering costs {ENTRY_FEE} gold — you have {gold}.</p>}
    </>
  );
}

// ── In the dungeon ────────────────────────────────────────────────
// At the entrance: one good look at the map before you go in.
function MapFirst({ run, onStep }: { run: DungeonRun; onStep: () => void }) {
  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 18, color: "#f1d9a0" }}>Your map of the labyrinth</div>
      <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 12px", lineHeight: 1.5 }}>
        Study it while you can. Once you step inside it&apos;s too dark to read — you&apos;ll only see the room you&apos;re in and the tunnels leading out of it,
        so remember which way the lair lies. The rooms you know are marked; the rest are a &ldquo;?&rdquo;. Every tunnel leads onward, never back.
      </p>
      <DungeonMapView run={run} />
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

function RoomScreen({ run, room, found, notes, byId, gold, bagUsed, bagSlots, onTreasure, onClub, clubEntry, onTakeBox, onTakeBoxHome, onChest, onDeck, onStash, onBuyPotion, onHeal, onBless, onBuy, onFight, onNext }: {
  run: DungeonRun; room: Room; found: Drop[] | null; notes: string[]; byId: (id: string) => OwnedCreature | undefined; gold: number;
  onTreasure: (r: Room) => void; onClub: () => void; clubEntry?: BagEntry;
  onTakeBox: () => void; onTakeBoxHome: () => void; onChest: () => void; onDeck: () => void; onStash: () => void; onBuyPotion: (k: PotionKey) => void; bag: PotionKey[]; bagUsed: number; bagSlots: number; onHeal: (id: string) => void; onBless: (id: string) => void; onBuy: (move: string) => void; onFight: () => void; onNext: () => void;
}) {
  const info = room.quest === "club" ? { name: "A dropped club", icon: "🏏" } : room.quest === "rattlebones" ? { name: "The thief", icon: "💀" } : ROOM_INFO[room.kind];
  const onward = <p className="pixel-font" style={{ fontSize: 13, color: "#c9b48a", margin: "12px 0 0" }}>↑ Take a tunnel to move on.</p>;
  const next = room.kind === "boss" ? <button className="pixel-btn" style={{ marginTop: 12 }} onClick={onNext}>Finish →</button>
    : room.quest === "rattlebones" ? (room.boxTaken ? (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 14, color: "#f1d9a0", fontStyle: "italic", margin: "0 0 10px" }}>
          &ldquo;This looks like the box Klutz was talking about. Let&apos;s take it to him.&rdquo;
        </p>
        <button className="pixel-btn" onClick={onTakeBoxHome}>Continue</button>
      </div>
    ) : (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>
          The Rattlebones clatters into a heap of bones. Something heavy thuds onto the floor beside it: a battered box, a sword hilt poking out of the lid.
        </p>
        <button className="pixel-btn" onClick={onTakeBox}>📦 Pick up the box</button>
      </div>
    )) : onward;

  return (
    <div className="stone-panel">
      <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>{info.icon} {info.name}</div>

      {found && (
        <div style={{ margin: "10px 0 0", fontSize: 14 }}>
          <div style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>You found:</div>
          {found.map((d) => (
            <div key={d.id} style={{ color: d.dropType === "reward" ? GOLD : d.dropType === "item" ? RARITY_COLORS[d.rarity].text : "white" }}>
              {d.dropType === "reward" ? "🪙" : d.dropType === "card" ? "🃏" : d.dropType === "creature" ? "🐾" : "📦"} {dropLabel(d)}
            </div>
          ))}
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
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            Something lies on the floor just inside the entrance: a battered old club with <i>KLUTZ</i> scratched into the handle.
            The Rattlebones must have dropped it as it ran off — you can still hear it clattering away down the tunnels.
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

      {room.kind === "stash" && (room.done ? next : (
        <>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>
            A forgotten pack, half rotted through. Inside: {(room.stash ?? []).map((k) => `${POTIONS[k].icon} ${POTIONS[k].name}`).join(", ")}.
          </p>
          <p style={{ fontSize: 12, color: MUTED }}>You&apos;re carrying {bagUsed}/{bagSlots}{bagUsed + (room.stash?.length ?? 0) > bagSlots ? " — not everything will fit" : ""}.</p>
          <button className="pixel-btn" onClick={onStash} disabled={bagUsed >= bagSlots}>Take what fits</button>
          {onward}
        </>
      ))}

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
            {room.quest === "rattlebones" && "There it is: a Rattlebones, hunched over a battered box, picking through Klutz's weapons. It hasn't seen you yet."}
            {room.kind === "easy" && !room.quest && "A few creatures look up from their scraps. They don't look tough."}
            {room.kind === "hard" && "One creature, alone. Well fed. Well armed."}
            {room.kind === "miniboss" && "Something big has made this room its lair. One creature — but an Epic one, well armed, and it fights smart. Beat it and you can heal or revive one of your party."}
            {room.boss && "A Cyclops fills the chamber — a mountain of muscle with one huge, rolling eye. It's a melee brute: tough to hurt up close (magic hits it hardest), and its Stomp can cripple you badly (swapping out shakes it off… eventually). Something tells you this won't be the whole fight."}
            {!room.boss && <> They play like the {AI_LEVEL_LABELS[room.level ?? "normal"]} AI.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {room.boss && (
              <div style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                <b style={{ color: rarityColor("legendary") }}>Cyclops</b>
                <span style={{ color: MUTED }}> · {CYCLOPS_PARTS[0].label} · {combatLine(cyclopsTeam()[0])}</span>
              </div>
            )}
            {(room.enemies ?? []).map((e, i) => {
              const t = CREATURE_BY_ID[e.creatureId];
              return (
                <div key={i} style={{ fontSize: 13, padding: "6px 8px", background: "#12131a" }}>
                  <b style={{ color: rarityColor(t.rarity) }}>{t.name}</b>
                  <span style={{ color: MUTED }}> · {t.race ? `${RACE_INFO[t.race].name} · ` : ""}{creatureTypeLabel(e.proficiency)} · {e.gear.length ? e.gear.map(gearName).join(", ") : "no gear"}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>
            Win: {room.quest === "rattlebones" ? "Klutz's box" : <>{room.gold} gold{(room.enemies ?? []).some((e) => e.gear.some((p) => p.drops)) ? " and something shiny one of them is carrying" : ""}</>}.
            Your team: {fightingTeam(run).map((id) => byId(id)?.name).join(", ")}.
          </p>
          <button className="pixel-btn" onClick={onFight}>⚔️ Fight</button>
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
  const text = run.status === "cleared"
    ? `The Eye bursts in a shower of sparks. You beat the Cyclops on run ${run.runNumber}${lab.meta.firstClearRun ? "" : " — your first clear"}! (Its rewards — the Codex of Stances, the Tavern and your trophy — come in the next update.)`
    : run.status === "dead"
      ? `…and you wake up in the Den, Klutz standing over you looking pleased with himself. He dragged you out after ${run.room} room${run.room === 1 ? "" : "s"}. Your creatures are hurt — rest them at the healing pool.`
      : run.loot.includes("Klutz's box")
        ? "You head back to the Den with Klutz's box under your arm. He'll be thrilled — go and find him."
        : `You find your way back out, ${run.room} room${run.room === 1 ? "" : "s"} explored.`;
  return (
    <div className="stone-panel" style={{ textAlign: "center" }}>
      <div className="pixel-font" style={{ fontSize: 26, color: run.status === "cleared" ? "#5ee08a" : run.status === "dead" ? "#ff8a80" : "#f1d9a0" }}>{title}</div>
      <p style={{ fontSize: 14, color: "#d8d4c8", lineHeight: 1.5 }}>{text}</p>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>You bring home what&apos;s in your bag:</div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>{run.loot.length > 0 ? run.loot.join(" · ") : "nothing this time"}</div>
      {floor.length > 0 && (run.status === "cleared" ? (
        <div style={{ margin: "0 0 14px" }}>
          <p style={{ fontSize: 13, color: "#d8d4c8" }}>With the Cyclops gone, you can walk back through and pick up the {floor.length} thing{floor.length === 1 ? "" : "s"} you left behind.</p>
          <button className="pixel-btn" onClick={onGather}>🚶 Walk back and gather everything</button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#ff8a80" }}>Left behind on the floors (lost): {floor.map((f) => (f.drop ? dropLabel(f.drop) : POTIONS[f.potion!].name)).join(", ")}</p>
      ))}
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
function Bag({ run, bag, slots, name, itemOf, slotOf, byId, onDrink, onEquip, onLeave, tutorial }: {
  run: DungeonRun; bag: BagEntry[]; slots: number; name: string;
  itemOf: (e: BagEntry) => CreatureOrItemDrop | undefined; slotOf: (it: CreatureOrItemDrop) => EquipSlot | null;
  byId: (id: string) => OwnedCreature | undefined; onDrink: (k: PotionKey, id: string) => void;
  onEquip: (e: BagEntry, creatureId: string) => void; onLeave: (e: BagEntry) => void; tutorial?: BagEntry;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const standing = run.party.filter((id) => byId(id) && (run.hp[id] ?? 1) > 0);
  const hurt = standing.filter((id) => (run.hp[id] ?? 1) < 1);
  const e = sel !== null ? bag[sel] : undefined;
  const it = e && !isPotionEntry(e) ? itemOf(e) : undefined;
  const slot = it ? slotOf(it) : null;
  const tutorialAt = tutorial ? bag.indexOf(tutorial) : -1;
  const teaching = tutorialAt >= 0 && e === tutorial;
  const done = (fn: () => void) => () => { fn(); setSel(null); };
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
        selected={sel} onSelect={setSel} pulse={tutorialAt >= 0 && sel !== tutorialAt ? tutorialAt : undefined} />
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
              {teaching && (
                <div className="tutorial-tip" style={{ margin: "8px 0 0" }}>
                  <span className="tutorial-arrow">👇</span> Now choose who carries it. Gear you find down here works the same way: tap it in your bag, then equip it.
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {slot && standing.map((id) => chip(id, `Equip on ${byId(id)!.name}`, done(() => onEquip(e, id)), {}, teaching))}
                {!teaching && chip("leave", "Leave it here", done(() => onLeave(e)), { color: "#ff8a80" })}
              </div>
            </>
          ) : (
            <span style={{ color: MUTED }}>Something you no longer have.</span>
          )}
        </div>
      )}
    </>
  );
}
