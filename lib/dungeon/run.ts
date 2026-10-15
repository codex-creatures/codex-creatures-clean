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
//   every way on reaches the lair. You study your map scroll at the
//   entrance; once you step inside it's too dark to read, and you find your
//   way by the tunnels leading out of each room.
// - Finish a room (win its fight, take its loot) before moving on. Pools,
//   stashes, merchants and librarians can be walked past.
// - Losing a fight ends the run: you wake up at home and keep all your loot.
//   Creatures come home hurt and are healed at the pool (instant for now).

import type { Drop, Rarity } from "../types";
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
import { rollMap, routeLength, waysOn, type DungeonMap } from "./map";
import { readSave, writeSaveField } from "../save";
import { ITEM_KEYS } from "../items/ceilings";
import { ARMOR_KEYS } from "../items/armor";
import { pickRarity } from "../items/gameHelpers";
import { weaponDrop, armorDrop } from "../drops";

export const PARTY_SIZE = 5;
export const TEAM_SIZE = 3;
export const ENTRY_FEE = 50;
export const FREE_RUNS = 5; // your first runs cost nothing
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
  stash:     { name: "Stash",              icon: "💰" },
  librarian: { name: "Wandering librarian", icon: "📚" },
  merchant:  { name: "Wandering merchant", icon: "🪙" },
  cards:     { name: "Deck of cards",      icon: "🃏" },
  miniboss:  { name: "Mini boss",          icon: "👹" },
  boss:      { name: "The boss",           icon: "👁️" },
};

// Fights.
// Creature dens grow with depth (a room's depth: rooms walked into on the
// shortest way to it from the entrance). Up to EARLY_DEPTH deep they hold
// 1–2 creatures; deeper, 2–3. Picked from the end of EASY_PACK, so one is
// an Uncommon, two a Common and an Uncommon, three adds another Common.
// (Hard rooms and mini bosses are a single creature at any depth.)
export const EARLY_DEPTH = 4;
export const EASY_SIZE_EARLY: [number, number] = [1, 2];
export const EASY_SIZE_DEEP: [number, number] = [2, 3];
export const EASY_PACK: Rarity[] = ["common", "common", "uncommon"];
export const EASY_GOLD: [number, number] = [10, 20];
export const HARD_GOLD: [number, number] = [30, 50];
export const BOSS_GOLD: [number, number] = [80, 120];
export const MINIBOSS_GOLD: [number, number] = [50, 80];
export const MINIBOSS_REVIVE_HP = 0.7; // beating a mini boss: heal one creature to full, or revive one to 70%
export const DECK_CARDS = 5;           // a deck of cards: 5 creature-card rolls

// ── The battle bag ───────────────────────────────────────────────────
// Your bag: what you carry in the Labyrinth, one thing per slot (they
// don't stack), kept between runs. You start with a BINDLE (3 slots); your
// first mini boss drops a RUGGED BACKPACK (5).
// A slot holds:
// - a potion (heals one creature; in a fight it costs your turn);
// - gear: a weapon or armour piece of yours (packed at home, or swapped
//   out). Between rooms you can put it on a creature; a weapon can also be
//   swapped in mid-fight (costs your turn). What it replaces takes the slot;
// - loot: something found this run (gear or a codex). It comes home with
//   you: it goes into storage (codexes onto the bookcase) when the run ends.
// Gold and creature cards take no space. When you're full you choose what
// to leave on the floor; what's left there is lost — unless you beat the
// boss, and walk back through to collect it.
export const BINDLE = 3;
export const BACKPACK = 5;
export type BagEntry = PotionKey | `gear:${string}` | `loot:${string}`;
export const bagSize = (meta: { bagSize?: number }) => meta.bagSize ?? BINDLE;
export const bagName = (meta: { bagSize?: number }) => (bagSize(meta) > BINDLE ? "Rugged backpack" : "Bindle");
export const isPotionEntry = (e: BagEntry): e is PotionKey => e === "potion" || e === "lesser";
export const gearEntry = (dropId: string): BagEntry => `gear:${dropId}`;
export const gearIdOf = (e: BagEntry): string | undefined => (e.startsWith("gear:") ? e.slice(5) : undefined);
export const lootEntry = (dropId: string): BagEntry => `loot:${dropId}`;
export const lootIdOf = (e: BagEntry): string | undefined => (e.startsWith("loot:") ? e.slice(5) : undefined);

// Something left on a room's floor (by name, for the walk back).
export type FloorItem = { room: string; potion?: PotionKey; drop?: Drop };
// Something you picked up this run (for the haul at the end).
export type GotItem = { potion: PotionKey } | { drop: Drop };

// The bookcase in the Den: where codexes are kept (a single shelf to start).
export const BOOKCASE_SIZE = 10;
export type PotionKey = "potion" | "lesser";
export const POTIONS: Record<PotionKey, { name: string; heal: number; price: number; icon: string }> = {
  potion: { name: "Healing Potion", heal: 100, price: 100, icon: "🧪" },
  lesser: { name: "Lesser Potion",  heal: 50,  price: 50,  icon: "🧴" },
};
// A stash: a burlap sack of STASH_ITEMS things. Open it and take what you
// want (one slot each, gold takes none); what you leave stays on the floor.
// - STASH_POTIONS potions (each a Healing Potion STASH_POTION_CHANCE of the
//   time, else a Lesser one);
// - the last thing is rolled: STASH_LAST_ROLL — another potion, some gold
//   (STASH_GOLD), or a weapon or armour piece rolled like a scan.
export const STASH_ITEMS = 3;
export const STASH_POTIONS = 2;
export const STASH_POTION_CHANCE = 0.3;
export const STASH_LAST_ROLL = { potion: 0.25, gold: 0.5, gear: 0.25 };
export const STASH_GOLD: [number, number] = [100, 250];
export type SackItem = { potion: PotionKey } | { gold: number } | { gear: Drop };

// Room for more in the bag? Adds what fits; returns the new bag.
export function addToBag(bag: BagEntry[], items: BagEntry[], size: number): BagEntry[] {
  return [...bag, ...items].slice(0, Math.max(bag.length, size));
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

export function makeEnemy(rarity: Rarity, gearRarity: Rarity, exclude: string[], rng: Rng = Math.random): Enemy {
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
  return buildFighter(t, w?.stats, a?.stats, e.moves, e.proficiency, undefined, w?.key as ItemKey | undefined);
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
  sack?: SackItem[];   // a stash, or a beaten fight's loot: what's (still) inside
  opened?: boolean;    // …and you've opened it
  container?: "sack" | "chest"; // a beaten fight's loot: a sack (ordinary fights) or a rickety chest (bosses)
  quest?: "club" | "rattlebones"; // part of the first quest (lib/quest.ts)
  boxTaken?: boolean;  // the Rattlebones' room: you've picked up Klutz's box
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

// What's inside a room, rolled as you walk in. depth: how deep it is (see
// EARLY_DEPTH); left out = deep.
export function makeRoom(kind: RoomKind, rng: Rng = Math.random, depth = Infinity): Room {
  switch (kind) {
    case "treasure":
      return { kind, gold: FIRST_TREASURE_GOLD, done: false };
    case "easy": {
      // 1–3 creatures (by depth) with Common gear.
      const size = randInt(...(depth <= EARLY_DEPTH ? EASY_SIZE_EARLY : EASY_SIZE_DEEP), rng);
      const enemies: Enemy[] = [];
      for (const r of EASY_PACK.slice(-size)) enemies.push(makeEnemy(r, "common", enemies.map((e) => e.creatureId), rng));
      if (rng() < UPGRADE_CHANCE) upgradeAndDrop(enemies, rng);
      return { kind, enemies, level: "easy", gold: randInt(...EASY_GOLD, rng), done: false };
    }
    case "hard": {
      // A single Rare with Rare gear.
      const enemies = [makeEnemy("rare", "rare", [], rng)];
      if (rng() < HARD_DROP_CHANCE) enemies[0].gear[Math.floor(rng() * 2)].drops = true;
      return { kind, enemies, level: "normal", gold: randInt(...HARD_GOLD, rng), done: false };
    }
    case "stash": {
      const potion = (): SackItem => ({ potion: rng() < STASH_POTION_CHANCE ? "potion" : "lesser" });
      const sack: SackItem[] = Array.from({ length: STASH_POTIONS }, potion);
      const last = rng();
      if (last < STASH_LAST_ROLL.potion) sack.push(potion());
      else if (last < STASH_LAST_ROLL.potion + STASH_LAST_ROLL.gold) sack.push({ gold: randInt(...STASH_GOLD, rng) });
      else {
        // Like a scan: any rarity at the usual odds; armour twice as likely as a weapon.
        const rarity = pickRarity("", "random");
        sack.push({ gear: rng() < 1 / 3 ? weaponDrop(pick(ITEM_KEYS, rng), rarity) : armorDrop(pick(ARMOR_KEYS, rng), rarity) });
      }
      return { kind, sack, done: false };
    }
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
  inside?: boolean;            // stepped in past the entrance (the map is put away)
  battle?: unknown;            // the fight in progress (saved by the screen)
  loot: string[];              // what you've found, for the summary
  pending?: Drop[];            // found, but the bag's full: take it or leave it
  floor?: FloorItem[];         // left behind on the floors of this run
  got?: GotItem[];             // everything picked up this run (gold, cards, gear, codexes, potions)
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
    loot: [], status: "exploring", inside: false,
  };
}

// Put the map away and step into the first room.
export const stepInside = (run: DungeonRun): DungeonRun => ({ ...run, inside: true });

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
  return { ...run, path: [...run.path, node.id], current: makeRoom(node.kind, rng, routeLength(run.map, node.id)), room: run.room + 1 };
}

// Rooms you can walk out of without doing anything.
const SKIPPABLE: RoomKind[] = ["pool", "stash", "merchant", "librarian"];

// Can you take a tunnel out of here yet? Not until the room is dealt with.
export const canMoveOn = (run: DungeonRun) =>
  run.status === "exploring" && (!run.current || run.current.done || SKIPPABLE.includes(run.current.kind));

// Take a tunnel: finish this room and walk into the next.
export function moveOn(run: DungeonRun, nodeId: string, rng: Rng = Math.random): DungeonRun {
  if (!canMoveOn(run) || run.current?.kind === "boss") return run;
  const next = enterRoom(leaveRoom(run), nodeId, rng);
  return next.path.length > run.path.length ? next : run;
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
  bag: BagEntry[];                   // your bindle / backpack (kept between runs)
  bagSize?: number;                  // slots (missing = BINDLE)
  loot?: Record<string, Drop>;       // loot in the bag (by drop id), not yet home
  poolLevel?: number;                // the Den's healing pool (1 = a soggy cave pool)
  soakedAt?: string;                 // when the pool last healed the injured (ISO time)
};

// ── The healing pool (in the Den) ──────────────────────────────────
// Hurt creatures heal slowly in real time while they're home. Upgrades
// will come later; each level heals faster.
export const POOL_LEVELS = [
  { name: "Soggy cave pool", healPerHour: 0.25, desc: "A murky puddle in the rock. It heals, slowly." },
];
export const poolLevel = (meta: DungeonMeta) => POOL_LEVELS[Math.min(POOL_LEVELS.length, Math.max(1, meta.poolLevel ?? 1)) - 1];

// Heal the injured for the time since the pool last ran. A creature at
// full health leaves the list.
export function soak(meta: DungeonMeta, now = Date.now()): DungeonMeta {
  const last = meta.soakedAt ? Date.parse(meta.soakedAt) : now;
  const hours = Math.max(0, (now - last) / 3_600_000);
  const rate = poolLevel(meta).healPerHour;
  const injuries: Record<string, number> = {};
  for (const [id, hp] of Object.entries(meta.injuries)) {
    const healed = hp + rate * hours;
    if (healed < 1) injuries[id] = healed;
  }
  return { ...meta, injuries, soakedAt: new Date(now).toISOString() };
}

// How long until a creature at this share of HP is back to full.
export const hoursToFull = (meta: DungeonMeta, hp: number) => Math.max(0, (1 - hp) / poolLevel(meta).healPerHour);

export type DungeonSave = { meta: DungeonMeta; run: DungeonRun | null };

// Part of the player's one save (lib/save.ts), in its own field.
const SAVE_FIELD = "labyrinth";
const EMPTY: DungeonSave = { meta: { runs: 0, clears: 0, injuries: {}, bag: [] }, run: null };

export function loadDungeon(): DungeonSave {
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = readSave()[SAVE_FIELD] as Partial<DungeonSave> | undefined;
    if (!parsed || typeof parsed !== "object" || !parsed.meta) return EMPTY;
    const loaded: DungeonSave = { meta: { ...EMPTY.meta, ...parsed.meta }, run: parsed.run ?? null };
    const save: DungeonSave = loaded.run ? loaded : { ...loaded, meta: soak(loaded.meta) };
    // A run from before the map (hidden doors) can't carry on: the party comes home.
    if (save.run && !save.run.map?.start) return endRun({ ...save, run: { ...save.run, status: "retreated" } });
    return save;
  } catch {
    return EMPTY;
  }
}

export function saveDungeon(save: DungeonSave) {
  writeSaveField(SAVE_FIELD, save);
}

// Until you first beat the Cyclops, everyone comes home from a run at full
// health (Klutz patches them up). After that, wounds come home with you and
// heal at the pool.
export const freeHealing = (meta: DungeonMeta) => meta.clears === 0;

// The run is over (any way): bring the hurt creatures home.
export function endRun(save: DungeonSave): DungeonSave {
  const run = save.run;
  if (!run) return save;
  const injuries = { ...save.meta.injuries };
  const healed = freeHealing(save.meta);
  for (const id of run.party) {
    if (!healed && (run.hp[id] ?? 1) < 1) injuries[id] = run.hp[id];
    else delete injuries[id];
  }
  const cleared = run.status === "cleared";
  return {
    meta: {
      ...save.meta, injuries, soakedAt: new Date().toISOString(),
      clears: save.meta.clears + (cleared ? 1 : 0),
      firstClearRun: save.meta.firstClearRun ?? (cleared ? run.runNumber : undefined),
    },
    run: null,
  };
}

// "Reset Player": dungeon progress goes too (runs, clears, injuries, any run in progress).
export function clearDungeon() {
  writeSaveField(SAVE_FIELD, undefined);
}
