// lib/dungeon/map.ts
// The dungeon map, Slay the Spire style: rows of rooms from the archway up
// to the boss, joined by passageways. The whole map is rolled when the run
// starts, but you only see SIGHT rooms ahead of you; the rest is fog.
//
// - Every room (and the archway) has 1 to MAX_PASSAGES passageways up to the
//   next row; every room in the last row before the boss leads to the boss.
// - A room only connects to the column straight above it or one either side,
//   and passageways never cross, so the map reads cleanly.
// - Room kinds follow the quiet-room rules (lib/dungeon/run.ts) along every
//   path, and two passageways out of one room never lead to the same kind of
//   quiet room.

import {
  DUNGEON_ROOMS, MAX_QUIET_ROOMS, ROOM_MIX, WANDERERS, isFight, isSpecial, rollRoomKind, type RoomKind,
} from "./run";

export const MAP_COLS = 5;
export const MAX_PASSAGES = 3;
export const SIGHT = 3;
export const MYSTERY_CHANCE = 0.3; // a room whose kind you can't see until you walk in

export type MapNode = {
  id: string;     // "row-col"
  row: number;    // 1-based room number (DUNGEON_ROOMS = the boss)
  col: number;
  kind: RoomKind;
  next: string[]; // ids in the row above, left to right
  mystery?: boolean; // shown as "?" until you walk in
};

export type DungeonMap = {
  entrance: string[];             // the rooms the archway leads to
  nodes: Record<string, MapNode>;
};

type Rng = () => number;

const nodeId = (row: number, col: number) => `${row}-${col}`;

// 1–MAX_PASSAGES columns out of col-1..col+1, none left of `floor`.
function pickTargets(col: number, floor: number, rng: Rng): number[] {
  const options = [col - 1, col, col + 1].filter((c) => c >= 0 && c < MAP_COLS && c >= floor);
  const count = Math.min(options.length, 1 + Math.floor(rng() * MAX_PASSAGES));
  const chosen = [...options];
  while (chosen.length > count) chosen.splice(Math.floor(rng() * chosen.length), 1);
  return chosen;
}

export function rollMap(firstRun: boolean, rng: Rng = Math.random): DungeonMap {
  const centre = Math.floor(MAP_COLS / 2);
  const cols: number[][] = []; // cols[row - 1]: the columns used in that row
  const links: Record<string, number[]> = {}; // node id → target columns in the next row

  // The archway. On your very first run it leads to a single treasure room.
  const entranceCols = firstRun ? [centre] : pickTargets(centre, 0, rng);
  cols[0] = entranceCols;

  // Rows 1 .. DUNGEON_ROOMS - 2 branch upwards; left to right, each room's
  // passageways start where the previous room's ended, so none cross.
  for (let row = 1; row <= DUNGEON_ROOMS - 2; row++) {
    const above = new Set<number>();
    let floor = 0;
    for (const col of cols[row - 1]) {
      const targets = pickTargets(col, floor, rng);
      links[nodeId(row, col)] = targets;
      targets.forEach((t) => above.add(t));
      floor = Math.max(...targets);
    }
    cols[row] = [...above].sort((a, b) => a - b);
  }
  // The last row before the boss all leads to the boss.
  for (const col of cols[DUNGEON_ROOMS - 2]) links[nodeId(DUNGEON_ROOMS - 1, col)] = [centre];
  cols[DUNGEON_ROOMS - 1] = [centre];

  // Room kinds, row by row, so every room knows what could come before it.
  const nodes: Record<string, MapNode> = {};
  const quiet: Record<string, number> = {}; // longest run of quiet rooms ending here
  const parents: Record<string, string[]> = {};
  const entrance = entranceCols.map((c) => nodeId(1, c));
  for (const id of entrance) parents[id] = [];
  for (let row = 1; row <= DUNGEON_ROOMS; row++) {
    const siblingsTaken: Record<string, RoomKind[]> = {}; // parent id → quiet kinds already behind its passageways
    for (const col of cols[row - 1]) {
      const id = nodeId(row, col);
      const from = (parents[id] ?? []).map((p) => nodes[p]);
      let kind: RoomKind;
      if (row === DUNGEON_ROOMS) kind = "boss";
      else if (firstRun && row === 1) kind = "treasure";
      else {
        const streak = Math.max(0, ...from.map((p) => quiet[p.id]));
        const before = from.map((p) => p.kind).filter(isSpecial);
        const specials = ROOM_MIX.map(([k]) => k).filter(isSpecial);
        const exclude: RoomKind[] = streak > MAX_QUIET_ROOMS ? specials                               // only fights now
          : streak === MAX_QUIET_ROOMS ? specials.filter((k) => !WANDERERS.includes(k) || before.includes(k)) // fights or a wanderer
          : before;                                                                                // not the same as last time
        const siblings = from.length > 0 ? from.flatMap((p) => siblingsTaken[p.id] ?? []) : (siblingsTaken.entrance ?? []);
        kind = rollRoomKind(rng, [...exclude, ...siblings]);
      }
      for (const p of from.length > 0 ? from.map((f) => f.id) : ["entrance"]) {
        if (isSpecial(kind)) (siblingsTaken[p] ??= []).push(kind);
      }
      quiet[id] = isFight(kind) ? 0 : Math.max(0, ...from.map((p) => quiet[p.id])) + 1;
      const next = (links[id] ?? []).map((c) => nodeId(row + 1, c));
      for (const n of next) (parents[n] ??= []).push(id);
      const mystery = kind !== "boss" && !(firstRun && row === 1) && rng() < MYSTERY_CHANCE;
      nodes[id] = { id, row, col, kind, next, ...(mystery ? { mystery } : {}) };
    }
  }
  return { entrance, nodes };
}

// The rooms you can walk into from where you stand (null = the archway).
export function passagesFrom(map: DungeonMap, at: string | null): MapNode[] {
  return (at ? map.nodes[at].next : map.entrance).map((id) => map.nodes[id]);
}

// Rooms you can see from where you stand: up to SIGHT rooms ahead, along
// the passageways (plus the boss, whose lair you always know is there).
export function visibleFrom(map: DungeonMap, at: string | null): Set<string> {
  const seen = new Set<string>();
  let frontier = passagesFrom(map, at).map((n) => n.id);
  for (let step = 1; step <= SIGHT && frontier.length > 0; step++) {
    frontier.forEach((id) => seen.add(id));
    frontier = [...new Set(frontier.flatMap((id) => map.nodes[id].next))];
  }
  const boss = Object.values(map.nodes).find((n) => n.kind === "boss");
  if (boss) seen.add(boss.id);
  return seen;
}
