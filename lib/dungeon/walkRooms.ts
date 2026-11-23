// lib/dungeon/walkRooms.ts
// What's in the walkable Encampment's rooms (layout.ts campMap says which
// kind each is), rolled by the live game's own code so the numbers match its
// balance: makeRoom for each room (its foes, gold, a stash's sack), the
// chief's cages (campCages), and a golden chest's finds (goldenDrops). What a
// beaten room or an opened chest leaves is rolled by the Labyrinth screen
// (app/dungeon/page.tsx). Pure; the game's walked runs roll with it (walkRun.ts).
//
// - Every room is rolled at the start, not as you walk in (the live game
//   rolls on entering), because its foes stand in it where you can see them
//   before you're through the door. Same rolls, earlier.
// - A room's depth (how far in, for its foes' rarity and level) is the
//   number of rooms on the way to it from the entrance, going forward, as
//   the live game counts (routeLength); a room only reached sideways counts
//   by any route.

import { routeLength, type DungeonMap } from "./map";
import { makeRoom, campCages, GOLDEN_DROPS, GOLDEN_RARITY, GOLDEN_LEGENDARY_FROM, type Room, type DungeonId } from "./run";
import { CHEST_ODDS, REGISTRY_RULES, rollFromRules } from "../barcodeRegistry";
import { enchanted, GOLDEN_ENCHANT } from "../items/enchantments";
import { dropFromOutcome } from "../drops";
import type { Drop } from "../types";

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

// A golden chest's finds: GOLDEN_DROPS weapons and armour (as often as each turns up in a chest), at
// GOLDEN_RARITY. Before the Hydra (GOLDEN_LEGENDARY_FROM) Legendary is left out, so Rare and Epic
// share its odds.
export function goldenDrops(dungeon: DungeonId, rng: Rng = Math.random): Drop[] {
  const rules = {
    ...REGISTRY_RULES,
    odds: { weapon: CHEST_ODDS.weapon, armor: CHEST_ODDS.armor },
    rarity: Object.fromEntries(Object.entries(GOLDEN_RARITY).filter(([k]) => k !== "legendary" || dungeon >= GOLDEN_LEGENDARY_FROM)),
  };
  const drops: Drop[] = [];
  while (drops.length < GOLDEN_DROPS) {
    const d = enchanted(dropFromOutcome(rollFromRules(rules, rng)), GOLDEN_ENCHANT, rng);
    if (d) drops.push(d);
  }
  return drops;
}

