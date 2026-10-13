// lib/labyrinth/run.ts
// Labyrinth runs (labyrinth 1). The rules, kept separate from the screen:
//
// - Entering costs ENTRY_FEE gold; your very first run is free, and its first
//   room is a treasure with FIRST_TREASURE_GOLD in it.
// - You take a party of PARTY_SIZE creatures: TEAM_SIZE fight, the rest wait
//   in reserve. Team and reserves can only be changed between rooms.
// - HP carries over from room to room (energy is full at each fight).
// - There are LAB_ROOMS rooms; the last is the boss. Every room has 2 doors,
//   hidden from the player. Any room can come up again, but you never go
//   more than MAX_QUIET_ROOMS rooms in a row without a fight. So a room's
//   doors are rolled when you reach it, then stay fixed.
// - Losing a fight ends the run: you wake up at home and keep all your loot.
//   Creatures come home hurt and are healed at the pool (instant for now).

import type { Rarity } from "../types";
import type { ItemKey } from "../items/ceilings";
import type { ArmorKey } from "../items/armor";
import { ITEM_META } from "../items/metadata";
import { ARMOR_META } from "../items/armor";
import { CREATURES_BY_RARITY, CREATURE_BY_ID, type CreatureProficiency } from "../creatures/creatureData";
import { rollCreature } from "../creatures/creatureRoll";
import { buildFighter } from "../combat/loadout";
import type { Fighter } from "../combat/engine";
import type { AiLevel } from "../combat/thinkingAi";
import { rollGear, RARITIES } from "../balance/simulate";
import type { BossKind } from "../combat/bossAi";

export const LAB_ROOMS = 8;
export const PARTY_SIZE = 5;
export const TEAM_SIZE = 3;
export const ENTRY_FEE = 50;
export const FIRST_TREASURE_GOLD = 50;

export type RoomKind = "treasure" | "easy" | "pool" | "hard" | "chest" | "stash" | "librarian" | "merchant" | "boss";

// How often each room appears behind a door (rooms 1–7), in %.
export const ROOM_MIX: [RoomKind, number][] = [
  ["easy", 40], ["pool", 20], ["hard", 10], ["chest", 10], ["stash", 10], ["librarian", 5], ["merchant", 5],
];

export const ROOM_INFO: Record<RoomKind, { name: string; icon: string }> = {
  treasure:  { name: "Treasure",           icon: "💰" },
  easy:      { name: "Creature den",       icon: "🐾" },
  pool:      { name: "Healing pool",       icon: "⛲" },
  hard:      { name: "Lurking brute",      icon: "💀" },
  chest:     { name: "Chest",              icon: "🧰" },
  stash:     { name: "Stash",              icon: "🎒" },
  librarian: { name: "Wandering librarian", icon: "📚" },
  merchant:  { name: "Wandering merchant", icon: "🪙" },
  boss:      { name: "The boss",           icon: "👁️" },
};

// Fights.
export const EASY_GOLD: [number, number] = [10, 20];
export const HARD_GOLD: [number, number] = [30, 50];
export const BOSS_GOLD: [number, number] = [80, 120];
export const UPGRADE_CHANCE = 0.05;   // easy fight: one enemy item is a tier higher, and drops if you win
export const HARD_DROP_CHANCE = 0.05; // hard enemy: one of its items drops if you win
export const CHEST_DROPS = 3;
export const MAX_QUIET_ROOMS = 2;     // rooms in a row without a fight before both doors must be fights

type Rng = () => number;
const randInt = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(arr: readonly T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

// ── Enemies ──────────────────────────────────────────────────────────
export type GearPiece = { slot: "weapon" | "armor"; key: string; rarity: Rarity; stats: Record<string, number>; drops: boolean };
export type Enemy = { creatureId: string; proficiency: CreatureProficiency; moves: string[]; gear: GearPiece[] };

function makeEnemy(rarity: Rarity, gearRarity: Rarity, exclude: string[], rng: Rng): Enemy {
  const pool = CREATURES_BY_RARITY[rarity].filter((c) => !exclude.includes(c.id));
  const t = pick(pool.length > 0 ? pool : CREATURES_BY_RARITY[rarity], rng);
  const roll = rollCreature(t, rng);
  const g = rollGear(gearRarity, t);
  return {
    creatureId: t.id, proficiency: roll.proficiency, moves: roll.moves,
    gear: [
      { slot: "weapon", key: g.weaponKey, rarity: gearRarity, stats: g.weapon, drops: false },
      { slot: "armor",  key: g.armorKey,  rarity: gearRarity, stats: g.armor,  drops: false },
    ],
  };
}

// Re-rolls a piece one rarity tier higher and marks it as loot.
function upgradeAndDrop(enemies: Enemy[], rng: Rng) {
  const e = pick(enemies, rng);
  const i = Math.floor(rng() * e.gear.length);
  const old = e.gear[i];
  const rarity = RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(old.rarity) + 1)];
  const t = CREATURE_BY_ID[e.creatureId];
  const g = rollGear(rarity, t);
  e.gear[i] = old.slot === "weapon"
    ? { slot: "weapon", key: g.weaponKey, rarity, stats: g.weapon, drops: true }
    : { slot: "armor", key: g.armorKey, rarity, stats: g.armor, drops: true };
}

export function enemyFighter(e: Enemy): Fighter {
  const t = CREATURE_BY_ID[e.creatureId];
  const w = e.gear.find((p) => p.slot === "weapon");
  const a = e.gear.find((p) => p.slot === "armor");
  return buildFighter(t, w?.stats, a?.stats, e.moves, e.proficiency);
}

export function gearName(p: GearPiece): string {
  const name = p.slot === "weapon" ? ITEM_META[p.key as ItemKey]?.name : ARMOR_META[p.key as ArmorKey]?.name;
  return `${name ?? p.key} (${p.rarity})`;
}

// ── Rooms ────────────────────────────────────────────────────────────
export type Room = {
  kind: RoomKind;
  enemies?: Enemy[];
  level?: AiLevel;  // how well the enemies play
  gold?: number;    // gold for winning (fights) or finding (treasure)
  fighters?: string[]; // your creatures in the fight, in battle order
  boss?: BossKind;     // the boss in this room (instead of enemies)
  done: boolean;
};

export const isFight = (k: RoomKind) => k === "easy" || k === "hard" || k === "boss";
export const isSpecial = (k: RoomKind) => !isFight(k) && k !== "treasure";

// A room from the mix, leaving out the given kinds (their share goes to the rest).
export function rollRoomKind(rng: Rng = Math.random, exclude: RoomKind[] = []): RoomKind {
  const mix = ROOM_MIX.filter(([k]) => !exclude.includes(k));
  let r = rng() * mix.reduce((sum, [, pct]) => sum + pct, 0);
  for (const [kind, pct] of mix) {
    if (r < pct) return kind;
    r -= pct;
  }
  return mix[0][0];
}

// The 2 doors into a room (room is 1-based). The last room's both lead to
// the boss. After MAX_QUIET_ROOMS rooms without a fight, both doors are
// fights. The two doors never hide the same special room.
export function rollDoorPair(room: number, visited: RoomKind[], rng: Rng = Math.random): RoomKind[] {
  if (room === LAB_ROOMS) return ["boss", "boss"];
  let quiet = 0;
  for (let i = visited.length - 1; i >= 0 && !isFight(visited[i]); i--) quiet++;
  const specials = ROOM_MIX.map(([k]) => k).filter(isSpecial);
  const exclude = quiet >= MAX_QUIET_ROOMS ? specials : [];
  const first = rollRoomKind(rng, exclude);
  return [first, rollRoomKind(rng, isSpecial(first) ? [...exclude, first] : exclude)];
}

// What's inside a room, rolled as you walk in.
export function makeRoom(kind: RoomKind, rng: Rng = Math.random): Room {
  switch (kind) {
    case "treasure":
      return { kind, gold: FIRST_TREASURE_GOLD, done: false };
    case "easy": {
      // 2 Commons and an Uncommon with Common gear.
      const enemies: Enemy[] = [];
      for (const r of ["common", "common", "uncommon"] as Rarity[]) enemies.push(makeEnemy(r, "common", enemies.map((e) => e.creatureId), rng));
      if (rng() < UPGRADE_CHANCE) upgradeAndDrop(enemies, rng);
      return { kind, enemies, level: "easy", gold: randInt(...EASY_GOLD, rng), done: false };
    }
    case "hard": {
      // A single Rare with Rare gear.
      const enemies = [makeEnemy("rare", "rare", [], rng)];
      if (rng() < HARD_DROP_CHANCE) enemies[0].gear[Math.floor(rng() * 2)].drops = true;
      return { kind, enemies, level: "normal", gold: randInt(...HARD_GOLD, rng), done: false };
    }
    case "boss":
      // Labyrinth 1: the Cyclops (lib/creatures/bosses.ts, lib/combat/bossAi.ts).
      return { kind, boss: "cyclops", gold: randInt(...BOSS_GOLD, rng), done: false };
    default:
      return { kind, done: false };
  }
}

// ── A run ────────────────────────────────────────────────────────────
export type RunStatus = "exploring" | "dead" | "cleared" | "retreated";

export type LabRun = {
  id: string;
  runNumber: number;           // 1 = your first ever run
  startedAt: string;
  party: string[];             // creature drop ids (PARTY_SIZE)
  team: string[];              // the ones that fight (up to TEAM_SIZE)
  hp: Record<string, number>;  // share of max HP left, 0–1 (0 = knocked out)
  room: number;                // the room you're in, or about to choose (1-based)
  doors: RoomKind[][];         // doors[room - 1]: the doors into each room reached so far
  visited?: RoomKind[];        // every room walked into this run
  current: Room | null;        // null = standing in front of the doors
  battle?: unknown;            // the fight in progress (saved by the screen)
  loot: string[];              // what you've found, for the summary
  status: RunStatus;
};

export function startRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, rng: Rng = Math.random): LabRun {
  // The very first run opens in a treasure room; otherwise at room 1's doors.
  const first = runNumber === 1;
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: 1,
    doors: first ? [["treasure", "treasure"]] : [rollDoorPair(1, [], rng)],
    visited: first ? ["treasure"] : [],
    current: first ? makeRoom("treasure", rng) : null,
    loot: [], status: "exploring",
  };
}

export const isAlive = (run: LabRun, id: string) => (run.hp[id] ?? 0) > 0;

// Walk through one of the two doors into the current room.
export function enterDoor(run: LabRun, door: 0 | 1, rng: Rng = Math.random): LabRun {
  if (run.status !== "exploring" || run.current) return run;
  const kind = run.doors[run.room - 1][door];
  return { ...run, visited: [...(run.visited ?? []), kind], current: makeRoom(kind, rng) };
}

// The current room is finished: on to the doors of the next one (or the end).
export function leaveRoom(run: LabRun, rng: Rng = Math.random): LabRun {
  if (!run.current) return run;
  if (run.current.kind === "boss") return { ...run, current: { ...run.current, done: true }, status: "cleared", battle: undefined };
  const room = run.room + 1;
  const doors = [...run.doors];
  doors[room - 1] ??= rollDoorPair(room, run.visited ?? [], rng);
  return { ...run, current: null, battle: undefined, room, doors };
}

// Only between rooms; only creatures still standing can fight.
export function setTeam(run: LabRun, team: string[]): LabRun {
  if (run.current) return run;
  const valid = team.filter((id) => run.party.includes(id) && isAlive(run, id)).slice(0, TEAM_SIZE);
  return { ...run, team: valid };
}

// The fighting team, minus anyone knocked out.
export const fightingTeam = (run: LabRun) => run.team.filter((id) => isAlive(run, id));

// ── Saved progress (separate from the main save) ─────────────────────
export type LabMeta = {
  runs: number;                      // runs started
  clears: number;
  firstClearRun?: number;            // the run you first beat the boss on (for the trophy)
  injuries: Record<string, number>;  // creature id → share of HP left after a run (missing = full)
};

export type LabSave = { meta: LabMeta; run: LabRun | null };

const STORAGE_KEY = "codex_creatures_labyrinth_v1";
const EMPTY: LabSave = { meta: { runs: 0, clears: 0, injuries: {} }, run: null };

export function loadLab(): LabSave {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return EMPTY;
    return { meta: { ...EMPTY.meta, ...parsed.meta }, run: parsed.run ?? null };
  } catch {
    return EMPTY;
  }
}

export function saveLab(save: LabSave) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {}
}

// The run is over (any way): bring the hurt creatures home.
export function endRun(save: LabSave): LabSave {
  const run = save.run;
  if (!run) return save;
  const injuries = { ...save.meta.injuries };
  for (const id of run.party) {
    if ((run.hp[id] ?? 1) < 1) injuries[id] = run.hp[id];
    else delete injuries[id];
  }
  const cleared = run.status === "cleared";
  return {
    meta: {
      ...save.meta, injuries,
      clears: save.meta.clears + (cleared ? 1 : 0),
      firstClearRun: save.meta.firstClearRun ?? (cleared ? run.runNumber : undefined),
    },
    run: null,
  };
}
