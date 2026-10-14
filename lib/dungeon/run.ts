// lib/dungeon/run.ts
// Dungeon runs (dungeon 1). The rules, kept separate from the screen:
//
// - Entering costs ENTRY_FEE gold; your very first run is free, and its first
//   room is a treasure with FIRST_TREASURE_GOLD in it.
// - You take a party of up to PARTY_SIZE creatures (at least 1): the first
//   TEAM_SIZE fight, the rest wait in reserve. You can change them any time
//   you're not mid-fight.
// - HP carries over from room to room (energy is full at each fight).
// - The dungeon is a labyrinth (lib/dungeon/map.ts): rooms joined by
//   corridors, the entrance at the bottom and the boss's lair at the top.
//   Corridors only lead onward (never back), and there are no dead ends:
//   every way on reaches the lair. Torchlight shows only the area around you.
// - Finish a room (win its fight, take its loot, or leave it) before moving on.
// - Losing a fight ends the run: you wake up at home and keep all your loot.
//   Creatures come home hurt and are healed at the pool (instant for now).

import type { Rarity } from "../types";
import type { ItemKey } from "../items/ceilings";
import type { ArmorKey } from "../items/armor";
import { ITEM_META } from "../items/metadata";
import { ARMOR_META } from "../items/armor";
import { CREATURES_BY_RARITY, CREATURE_BY_ID, RACE_MOVES, type CreatureProficiency } from "../creatures/creatureData";
import { rollCreature } from "../creatures/creatureRoll";
import { buildFighter } from "../combat/loadout";
import type { Fighter } from "../combat/engine";
import type { AiLevel } from "../combat/thinkingAi";
import { rollGear, RARITIES } from "../balance/simulate";
import type { BossKind } from "../combat/bossAi";
import { rollMap, waysOn, type DungeonMap } from "./map";

export const PARTY_SIZE = 5;
export const TEAM_SIZE = 3;
export const ENTRY_FEE = 50;
export const FIRST_TREASURE_GOLD = 50;

export type RoomKind = "entrance" | "treasure" | "easy" | "pool" | "hard" | "chest" | "stash" | "librarian" | "merchant" | "cards" | "miniboss" | "boss";

// How often each kind of room appears on the map (every row but the boss's), in %.
export const ROOM_MIX: [RoomKind, number][] = [
  ["easy", 45], ["pool", 20], ["hard", 10], ["chest", 10], ["stash", 10], ["merchant", 5],
];

// Mystery rooms ("?" on the map) have their own mix: a gamble. Half are a
// mini boss; 15% are something good (a librarian — only ever found here —
// a deck of cards, or a merchant); the rest are ordinary rooms.
export const MYSTERY_MIX: [RoomKind, number][] = [
  ["miniboss", 50], ["librarian", 5], ["cards", 5], ["merchant", 5],
  ["easy", 7], ["pool", 7], ["hard", 7], ["chest", 7], ["stash", 7],
];

export const ROOM_INFO: Record<RoomKind, { name: string; icon: string }> = {
  entrance:  { name: "Entrance",           icon: "🚪" },
  treasure:  { name: "Treasure",           icon: "💰" },
  easy:      { name: "Creature den",       icon: "⚔️" },
  pool:      { name: "Healing pool",       icon: "⛲" },
  hard:      { name: "Lurking brute",      icon: "⚔️" },
  chest:     { name: "Chest",              icon: "🧰" },
  stash:     { name: "Stash",              icon: "🎒" },
  librarian: { name: "Wandering librarian", icon: "📚" },
  merchant:  { name: "Wandering merchant", icon: "🪙" },
  cards:     { name: "Deck of cards",      icon: "🃏" },
  miniboss:  { name: "Mini boss",          icon: "👹" },
  boss:      { name: "The boss",           icon: "👁️" },
};

// Fights.
export const EASY_GOLD: [number, number] = [10, 20];
export const HARD_GOLD: [number, number] = [30, 50];
export const BOSS_GOLD: [number, number] = [80, 120];
export const MINIBOSS_GOLD: [number, number] = [50, 80];
export const MINIBOSS_REVIVE_HP = 0.7; // beating a mini boss: heal one creature to full, or revive one to 70%
export const DECK_CARDS = 5;           // a deck of cards: 5 creature-card rolls

// ── The battle bag ───────────────────────────────────────────────────
// Up to BAG_SIZE items, one per slot (they don't stack). It stays with you
// between runs. Merchants sell potions; stashes hold a few.
// A potion heals one creature: in a fight it costs your turn and heals the
// creature on the field; between rooms, tap it on anyone still standing.
export const BAG_SIZE = 10;
export type PotionKey = "potion" | "lesser";
export const POTIONS: Record<PotionKey, { name: string; heal: number; price: number; icon: string }> = {
  potion: { name: "Healing Potion", heal: 100, price: 100, icon: "🧪" },
  lesser: { name: "Lesser Potion",  heal: 50,  price: 50,  icon: "🧴" },
};
export const STASH_ITEMS = 3;
export const STASH_POTION_CHANCE = 0.3; // each stash item: a Healing Potion (else a Lesser one)

// Room for more in the bag? Adds what fits; returns the new bag.
export function addToBag(bag: PotionKey[], items: PotionKey[]): PotionKey[] {
  return [...bag, ...items].slice(0, BAG_SIZE);
}
export const UPGRADE_CHANCE = 0.05;   // easy fight: one enemy item is a tier higher, and drops if you win
export const HARD_DROP_CHANCE = 0.05; // hard enemy: one of its items drops if you win
export const CHEST_DROPS = 3;
export const CHEST_CODEX_CHANCE = 0.1; // a chest holds a codex (instead of one of its drops)
export const CODEX_PRICE = 500;       // wandering librarians sell codexes
export const LIBRARIAN_OFFERS = 3;

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
  offers?: string[];   // a librarian: the codexes (race moves) for sale
  bought?: string[];   // …and the ones you bought (librarian codexes; merchant potions)
  blessed?: boolean;   // a mini boss's heal/revive has been used
  stash?: PotionKey[]; // a stash: the potions inside
  done: boolean;
};

export const isFight = (k: RoomKind) => k === "easy" || k === "hard" || k === "miniboss" || k === "boss";

// A room from a mix, leaving out the given kinds (their share goes to the rest).
export function rollRoomKind(rng: Rng = Math.random, exclude: RoomKind[] = [], from: [RoomKind, number][] = ROOM_MIX): RoomKind {
  const mix = from.filter(([k]) => !exclude.includes(k));
  let r = rng() * mix.reduce((sum, [, pct]) => sum + pct, 0);
  for (const [kind, pct] of mix) {
    if (r < pct) return kind;
    r -= pct;
  }
  return mix[0][0];
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
    case "stash":
      return { kind, stash: Array.from({ length: STASH_ITEMS }, (): PotionKey => (rng() < STASH_POTION_CHANCE ? "potion" : "lesser")), done: false };
    case "miniboss": {
      // One tough creature: an Epic with Rare gear, played by the Hard AI.
      // Beat it and you can heal or revive one of your party.
      const enemies = [makeEnemy("epic", "rare", [], rng)];
      return { kind, enemies, level: "hard", gold: randInt(...MINIBOSS_GOLD, rng), done: false };
    }
    case "boss":
      // Dungeon 1: the Cyclops (lib/creatures/bosses.ts, lib/combat/bossAi.ts).
      return { kind, boss: "cyclops", gold: randInt(...BOSS_GOLD, rng), done: false };
    case "librarian": {
      // A few different codexes, each for a different race.
      const offers: string[] = [];
      while (offers.length < Math.min(LIBRARIAN_OFFERS, RACE_MOVES.length)) {
        const m = pick(RACE_MOVES, rng).name;
        if (!offers.includes(m)) offers.push(m);
      }
      return { kind, offers, bought: [], done: false };
    }
    default:
      return { kind, done: false };
  }
}

// ── A run ────────────────────────────────────────────────────────────
export type RunStatus = "exploring" | "dead" | "cleared" | "retreated";

export type DungeonRun = {
  id: string;
  runNumber: number;           // 1 = your first ever run
  startedAt: string;
  party: string[];             // creature drop ids (1 to PARTY_SIZE)
  team: string[];              // the ones that fight (up to TEAM_SIZE)
  hp: Record<string, number>;  // share of max HP left, 0–1 (0 = knocked out)
  room: number;                // rooms explored so far (each new room you walk into)
  map: DungeonMap;
  path: string[];              // every room you've stood in, in order (starts at the entrance)
  cleared: string[];           // rooms finished: walking back through them is free
  current: Room | null;        // the room you're in, still to finish; null = choosing a corridor
  battle?: unknown;            // the fight in progress (saved by the screen)
  loot: string[];              // what you've found, for the summary
  status: RunStatus;
};

export function startRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, rng: Rng = Math.random): DungeonRun {
  // The very first run opens in a treasure room; otherwise at an empty entrance.
  const first = runNumber === 1;
  const map = rollMap(first, rng);
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: first ? 1 : 0, map,
    path: [map.start],
    cleared: first ? [] : [map.start],
    current: first ? makeRoom("treasure", rng) : null,
    loot: [], status: "exploring",
  };
}

export const isAlive = (run: DungeonRun, id: string) => (run.hp[id] ?? 0) > 0;

// Where you stand on the map.
export const runPosition = (run: DungeonRun): string => run.path[run.path.length - 1];

// The rooms you can walk to: none until you've finished the room you're in,
// then any corridor leading on (never back).
export const nextRooms = (run: DungeonRun) => (run.current ? [] : waysOn(run.map, runPosition(run)));

// Walk down a corridor into a new room; its contents are rolled as you walk in.
export function enterRoom(run: DungeonRun, nodeId: string, rng: Rng = Math.random): DungeonRun {
  if (run.status !== "exploring") return run;
  const node = nextRooms(run).find((n) => n.id === nodeId);
  if (!node) return run;
  return { ...run, path: [...run.path, node.id], current: makeRoom(node.kind, rng), room: run.room + 1 };
}

// The current room is finished: it's cleared, and you choose where to go.
export function leaveRoom(run: DungeonRun): DungeonRun {
  if (!run.current) return run;
  if (run.current.kind === "boss") return { ...run, current: { ...run.current, done: true }, status: "cleared", battle: undefined };
  return { ...run, current: null, battle: undefined, cleared: [...new Set([...run.cleared, runPosition(run)])] };
}

// Any time you're not mid-fight (between rooms, or after seeing who's in a
// room but before you start the fight). Only creatures still standing can
// fight. Order matters: the first one leads.
export function setTeam(run: DungeonRun, team: string[]): DungeonRun {
  if (run.battle || run.status !== "exploring") return run;
  const valid = team.filter((id) => run.party.includes(id) && isAlive(run, id)).slice(0, TEAM_SIZE);
  return { ...run, team: valid };
}

// The fighting team, minus anyone knocked out.
export const fightingTeam = (run: DungeonRun) => run.team.filter((id) => isAlive(run, id));

// ── Saved progress (separate from the main save) ─────────────────────
export type DungeonMeta = {
  runs: number;                      // runs started
  clears: number;
  firstClearRun?: number;            // the run you first beat the boss on (for the trophy)
  injuries: Record<string, number>;  // creature id → share of HP left after a run (missing = full)
  bag: PotionKey[];                  // the battle bag (kept between runs)
};

export type DungeonSave = { meta: DungeonMeta; run: DungeonRun | null };

// Kept from when dungeons were called labyrinths, so old progress still loads.
const STORAGE_KEY = "codex_creatures_labyrinth_v1";
const EMPTY: DungeonSave = { meta: { runs: 0, clears: 0, injuries: {}, bag: [] }, run: null };

export function loadDungeon(): DungeonSave {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const save: DungeonSave = { meta: { ...EMPTY.meta, ...parsed.meta }, run: parsed.run ?? null };
    // A run from before the map (hidden doors) can't carry on: the party comes home.
    if (save.run && !save.run.map?.start) return endRun({ ...save, run: { ...save.run, status: "retreated" } });
    return save;
  } catch {
    return EMPTY;
  }
}

export function saveDungeon(save: DungeonSave) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {}
}

// The run is over (any way): bring the hurt creatures home.
export function endRun(save: DungeonSave): DungeonSave {
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

// "Reset Player": dungeon progress goes too (runs, clears, injuries, any run in progress).
export function clearDungeon() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
