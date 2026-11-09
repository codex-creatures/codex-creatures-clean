// lib/dungeon/walkRooms.ts
// What's in the walkable Encampment's rooms (layout.ts campMap says which
// kind each is), rolled by the live game's own code so the numbers match its
// balance: makeRoom for each room (its foes, gold, a stash's sack), the
// chief's cages (campCages), and the loot a beaten room or an opened chest
// leaves (the same rolls as the Labyrinth screen, app/dungeon/page.tsx).
// Pure; not used by the game yet (previewed in app/lab/walk).
//
// - Every room is rolled at the start, not as you walk in (the live game
//   rolls on entering), because its foes stand in it where you can see them
//   before you're through the door. Same rolls, earlier.
// - A room's depth (how far in, for its foes' rarity and level) is the
//   number of rooms on the way to it from the entrance, going forward, as
//   the live game counts (routeLength); a room only reached sideways counts
//   by any route.

import { routeLength, type DungeonMap } from "./map";
import {
  makeRoom, campCages, minibossExtras, capSack, toolFinds, droppedPieceStats,
  CHEST_DROPS, CHEST_CODEX_CHANCE, CHEST_TOOLS, type Room, type SackItem, type DungeonId,
} from "./run";
import { CHEST_ODDS, rollBarcodeOutcome } from "../barcodeRegistry";
import { dropFromOutcome, weaponDrop, armorDrop, codexDrop, randomCodexMove, randomArmorSlot } from "../drops";
import type { Drop } from "../types";
import type { ItemKey } from "../items/ceilings";
import type { ArmorKey } from "../items/armor";

type Rng = () => number;

export const ENCAMPMENT: DungeonId = 0;

// Rooms on the way to `id` from the entrance (forward, as the live game
// counts; by any route if it can only be reached sideways).
export function roomDepth(map: DungeonMap, id: string): number {
  const forward = routeLength(map, id);
  if (forward !== Infinity) return forward;
  const seen = new Map<string, number>([[map.start, 0]]);
  const queue = [map.start];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const n of map.nodes[at].links) if (!seen.has(n)) { seen.set(n, seen.get(at)! + 1); queue.push(n); }
  }
  return seen.get(id) ?? Infinity;
}

// Every room but the entrance, rolled: the chief's camp with its cages
// (firstClear: the first time, the cages hold races your party hasn't got;
// partyRaces are the races to leave out).
// dungeon: the walkable Labyrinth's rooms are its own (no chief's cages);
// backpack: you're on the bindle (merchants and storehouses have the backpack).
// An ambush (a camp that looks empty till you open a cage) is off in walked runs for now (the user,
// 2026-11-09): one rolls as a plain camp, its foes guarding the cages. The rolls are otherwise unchanged.
export const WALK_AMBUSH = false;
export function rollWalkRooms(map: DungeonMap, rng: Rng = Math.random, firstClear = true, partyRaces: string[] = [], dungeon: DungeonId = ENCAMPMENT, backpack = false): Record<string, Room> {
  const rooms: Record<string, Room> = {};
  for (const n of Object.values(map.nodes)) {
    if (n.kind === "entrance") continue;
    const rolled = makeRoom(n.kind, rng, roomDepth(map, n.id), dungeon, backpack);
    const room: Room = rolled.variant === "ambush" && !WALK_AMBUSH ? { ...rolled, variant: "plain" } : rolled;
    rooms[n.id] = n.id === map.boss && dungeon === ENCAMPMENT ? { ...room, cages: campCages(firstClear, partyRaces, rng) } : room;
  }
  return rooms;
}

const goldDrop = (amount: number): Drop => ({ id: crypto.randomUUID(), barcode: "", dropType: "reward", rewardKind: "resource", amount, createdAt: new Date().toISOString() });

// What a beaten room leaves (the Labyrinth screen's finishFight): its gold,
// the gear its foes drop, and, for the Encampment's chief, a mini boss's
// extras (never the cage schematic from him).
export function fightSack(room: Room, rng: Rng = Math.random): SackItem[] {
  const drops: Drop[] = [goldDrop(room.gold ?? 0)];
  for (const e of room.enemies ?? []) for (const p of e.gear) {
    if (!p.drops) continue;
    const slot = p.dropSlot ?? randomArmorSlot();
    drops.push(p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey, p.rarity, "", droppedPieceStats(p, slot), slot));
  }
  const sack: SackItem[] = drops.map((d) => (d.dropType === "reward" ? { gold: d.amount } : { gear: d }));
  if (room.kind === "encampment") sack.push(...minibossExtras(rng, false));
  return sack;
}

// A chest, opened (the Labyrinth screen's openChest): CHEST_DROPS scan-style
// drops, now and then a codex in place of the last, and the chest's tools.
export function chestSack(): SackItem[] {
  const drops: Drop[] = [];
  while (drops.length < CHEST_DROPS) {
    const d = dropFromOutcome(rollBarcodeOutcome(CHEST_ODDS));
    if (d) drops.push(d);
  }
  if (Math.random() < CHEST_CODEX_CHANCE) drops[drops.length - 1] = codexDrop(randomCodexMove());
  return capSack([...drops.map((d): SackItem => (d.dropType === "reward" ? { gold: d.amount } : { gear: d })), ...toolFinds(CHEST_TOOLS)]);
}
