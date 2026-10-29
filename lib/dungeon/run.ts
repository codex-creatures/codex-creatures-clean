// lib/dungeon/run.ts
// Dungeon runs (dungeon 1). The rules, kept separate from the screen:
//
// - Entering costs ENTRY_FEE gold; your very first run is free, and its first
//   room is a treasure with FIRST_TREASURE_GOLD in it.
// - You bring a party of up to PARTY_SIZE creatures (at least 1) to the
//   entrance. Looking at the map, you pick the teamSize that go in; the
//   rest wait in the Den. Once inside there's no swapping (only who leads).
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
import type { ArmorKey, ArmorSlot } from "../items/armor";
import { ITEM_META } from "../items/metadata";
import { ARMOR_META, wornArmor } from "../items/armor";
import { CREATURES_BY_RARITY, CREATURE_BY_ID, MOVE_BY_NAME, MOVE_SLOTS, RACE_MOVES, type CreatureProficiency, type CreatureTemplate } from "../creatures/creatureData";
import { BALANCED_MOVES, NEUTRAL_QUICK_MOVES, kitMoveFor } from "../creatures/raceKitsV2";
import { SPECIES_RACES } from "../creatures/racesV2";
import { rollCreature } from "../creatures/creatureRoll";
import { randomSoulStone, type SoulStoneKey } from "../creatures/soulStones";
import { buildFighter } from "../combat/loadout";
import type { Fighter } from "../combat/engine";
import type { AiLevel } from "../combat/thinkingAi";
import { rollGear, RARITIES } from "../balance/simulate";
import type { BossKind } from "../combat/bossAi";
import { questMap, rollMap, routeLength, waysOn, type DungeonMap, type MapSpec } from "./map";
import { newWitchGame, type WitchGame } from "./witch";
import { REF_LEVEL } from "../creatures/levels";
import { readSave, writeSaveField } from "../save";
import { ITEM_KEYS } from "../items/ceilings";
import { ARMOR_KEYS, ARMOR_SLOTS, ARMOR_V2 } from "../items/armor";
import { rollArmorPiece } from "../items/rollArmorStats";
import { pickRarity, pickCreatureId } from "../items/gameHelpers";
import { weaponDrop, armorDrop, codexDrop, scrollDrop, soulStoneDrop, randomCodexMove, randomLearnableMove, RACE_CODEX_MOVES } from "../drops";
import { LEARNABLE_MOVES } from "../creatures/creatureData";
import { TOOLS, MATERIALS, SCHEMATICS, STORAGE_PLANS, materialBundle, materialDrop, toolDrop, schematicDrop, type MaterialKey, type ToolKey, type StoragePlan } from "../items/materials";

export const PARTY_SIZE = 5;
export const TEAM_SIZE = 3;
export const ENTRY_FEE = 50;
export const FREE_RUNS = 5; // your first runs cost nothing
export const FIRST_TREASURE_GOLD = 50;
// The Scroll button (looking at your map again) works this many times a run;
// a flare still shows it on top.
export const SCROLL_LOOKS = 2;
export const scrollLooksLeft = (run: { scrollLooks?: number }) => Math.max(0, SCROLL_LOOKS - (run.scrollLooks ?? 0));

export type RoomKind = "entrance" | "treasure" | "easy" | "pool" | "hard" | "chest" | "stash" | "librarian" | "merchant" | "cards" | "miniboss" | "witch" | "boss"
  | "encampment" | "library" | "storehouse"; // (the large rooms: LARGE_MIX)

// ── The dungeons ─────────────────────────────────────────────────────
// 0: the Encampment, a new player's first labyrinth (the user, 2026-10-27):
// CAMP_ROUTE rooms to the top, where a camp's chief guards the cages (see
// campCages). The Labyrinth opens once you've beaten it (labyrinthOpen).
// 1: the Labyrinth (the Cyclops at the top). 2: the Deep Labyrinth, open
// once you've beaten the Cyclops: a longer climb (DEEP_ROUTE rooms to the
// lair), tougher and higher-level creatures, and the Hydra waiting at the
// top (the Warden's pack until 2026-10-30). 3: the Abyss, open once you've
// beaten the Deep Labyrinth: the same climb with the Warden's pack at the
// top, and higher-level creatures in rarer gear (the user, 2026-10-26). Enemy levels
// rise with depth (enemyLevel).
export type DungeonId = 0 | 1 | 2 | 3;
export const DUNGEON_IDS: DungeonId[] = [0, 1, 2, 3];
export const DEEP_ROUTE = 15;
export type DungeonInfo = {
  name: string;
  spec: MapSpec;
  foes: FoeBand[];     // how rare its creatures and their gear are, by depth (foeAt)
  levels: LevelBand[]; // how strong its creatures are, by depth (enemyLevel)
  maxLevel: number;    // no creature here (bar the boss) is stronger than this
  goldScale: number;
  pack?: [warden: Rarity, guards: Rarity]; // the Warden's pack's gear (the deeper dungeons' boss)
};
// How rare a room's creatures are (the user, 2026-10-19). Each kind of
// fight has a creature rarity and a gear rarity, by depth, and each enemy
// has its chance to step up one rarity, creature and gear together (a
// little surprise, never a big jump). Dens: creature dens; hard: lurking
// brutes; camp: encampments; miniboss: mini bosses (and a storehouse's guard).
export const STEP_UP = 0.2;
export type Foe = [creature: Rarity, gear: Rarity, stepUp: number];
export type FoeBand = { upTo: number; easy: Foe; hard: Foe; camp: Foe; miniboss: Foe };
export const DUNGEONS: Record<DungeonId, DungeonInfo> = {
  // Rooms 1–6 are dens and stashes (campRoomKind), the camp's chief at the top.
  0: { name: "The Encampment", spec: { h: 240, rooms: 15, minRoute: 7, maxRoute: 7, large: 0 },
       foes: [{ upTo: Infinity, easy: ["common", "common", 0], hard: ["common", "common", 0], camp: ["uncommon", "common", 0], miniboss: ["uncommon", "common", 0] }],
       levels: [[Infinity, 1, 4]], maxLevel: 5, goldScale: 1 },
  1: { name: "The Labyrinth", spec: { h: 500, rooms: 36, minRoute: 15, maxRoute: 15, large: 1 },
       foes: [
         { upTo: 3,        easy: ["common", "common", 0],       hard: ["uncommon", "uncommon", STEP_UP], camp: ["uncommon", "uncommon", 0], miniboss: ["rare", "rare", 0] },
         { upTo: 6,        easy: ["common", "common", STEP_UP], hard: ["uncommon", "uncommon", STEP_UP], camp: ["uncommon", "uncommon", 0], miniboss: ["rare", "rare", 0] },
         { upTo: Infinity, easy: ["common", "common", STEP_UP], hard: ["rare", "rare", STEP_UP],         camp: ["rare", "uncommon", 0],     miniboss: ["rare", "rare", 0] },
       ],
       levels: [[3, 1, 4], [6, 1, 7], [Infinity, 3, 7]], maxLevel: 7, goldScale: 1 },
  2: { name: "The Deep Labyrinth", spec: { h: 500, rooms: 40, minRoute: DEEP_ROUTE, maxRoute: DEEP_ROUTE, large: 2 },
       foes: [
         { upTo: Infinity, easy: ["uncommon", "uncommon", STEP_UP], hard: ["epic", "rare", STEP_UP], camp: ["epic", "rare", 0], miniboss: ["rare", "rare", 0.3] },
       ],
       levels: [[5, 7, 11], [10, 9, 14], [Infinity, 11, 15]], maxLevel: 17, goldScale: 2, pack: ["rare", "uncommon"] },
  // Every fight a level band higher than the Deep Labyrinth, and every piece of gear a rarity up.
  3: { name: "The Abyss", spec: { h: 500, rooms: 40, minRoute: DEEP_ROUTE, maxRoute: DEEP_ROUTE, large: 2 },
       foes: [
         { upTo: Infinity, easy: ["uncommon", "rare", STEP_UP], hard: ["epic", "epic", STEP_UP], camp: ["epic", "epic", 0], miniboss: ["rare", "epic", 0.3] },
       ],
       levels: [[5, 15, 19], [10, 17, 22], [Infinity, 19, 24]], maxLevel: 26, goldScale: 3, pack: ["epic", "rare"] },
};
// The creature and gear rarity for one enemy of this kind at this depth (its step-up rolled).
export function foeAt(dungeon: DungeonId, kind: "easy" | "hard" | "camp" | "miniboss", depth: number, rng: Rng = Math.random): [Rarity, Rarity] {
  const bands = DUNGEONS[dungeon].foes;
  const [creature, gear, stepUp] = (bands.find((b) => depth <= b.upTo) ?? bands[bands.length - 1])[kind];
  if (rng() >= stepUp) return [creature, gear];
  const up = (r: Rarity) => RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(r) + 1)];
  return [up(creature), up(gear)];
}
export const dungeonOf = (run: { dungeon?: DungeonId }): DungeonId => run.dungeon ?? 1;

// How strong (what level) a room's creatures are. Each dungeon has bands by
// depth (rooms walked into on the shortest way from the entrance):
// [up to this depth, lowest level, highest level], any level in between
// equally likely. The Labyrinth: rooms 1–3 hold Lv 1–4, rooms 4–6 Lv 1–7,
// and the rest Lv 3–7 — nothing over 7 until the Deep Labyrinth. (Bar its
// first FIRST_ROOMS rooms: Lv 1–3, weighted to Lv 1 — FIRST_ROOM_LEVELS.)
// Lurking brutes are HARD_LEVELS above a den, mini bosses MINIBOSS_LEVELS
// (both still capped at the dungeon's maxLevel).
export type LevelBand = [upTo: number, min: number, max: number];
export const HARD_LEVELS = 2;
export const MINIBOSS_LEVELS = 3;
// (A boss's strength is mostly its gear and its tricks; its level trims its HP and %s.)
export const CYCLOPS_LEVEL = 6;  // the Labyrinth's boss
export const WARDEN_LEVEL = 16;  // the Deep Labyrinth's boss, the Hydra (the Warden's pack's level when it was the boss here)
export const ABYSS_WARDEN_LEVEL = 25; // the Abyss's (the same pack, stronger)
export const bossLevel = (dungeon: DungeonId) => (dungeon === 1 ? CYCLOPS_LEVEL : dungeon === 2 ? WARDEN_LEVEL : ABYSS_WARDEN_LEVEL);
export function enemyLevel(dungeon: DungeonId, kind: RoomKind, depth: number, rng: Rng = Math.random): number {
  const D = DUNGEONS[dungeon];
  if (kind === "boss") return bossLevel(dungeon);
  const d = Number.isFinite(depth) ? depth : Infinity;
  const [, min, max] = D.levels.find(([upTo]) => d <= upTo) ?? D.levels[D.levels.length - 1];
  const den = dungeon <= 1 && d <= FIRST_ROOMS ? weighted(FIRST_ROOM_LEVELS, rng) : min + Math.floor(rng() * (max - min + 1));
  const bump = kind === "hard" ? HARD_LEVELS : kind === "miniboss" || kind === "storehouse" ? MINIBOSS_LEVELS : 0;
  return Math.min(D.maxLevel, den + bump);
}

// The Labyrinth eases you in (the Cyclops' Labyrinth only; the user, 2026-10-19):
// - no mini boss (nor a mini boss's lair, a guarded storehouse) before room MINIBOSS_FROM;
// - the first FIRST_ROOMS rooms are creature dens FIRST_ROOM_DENS of the time
//   (otherwise a room with no fight), and their creatures are Lv 1–3 at the
//   FIRST_ROOM_LEVELS odds (a level, its weight).
export const MINIBOSS_FROM = 7;
export const FIRST_ROOM_DENS = 0.9;
export const FIRST_ROOM_LEVELS: [number, number][] = [[1, 60], [2, 25], [3, 15]];
export const minibossAllowed = (dungeon: DungeonId, depth: number) => dungeon > 1 || depth >= MINIBOSS_FROM;

// The Encampment (dungeon 0; the user, 2026-10-27). Sims: scripts/sim-encampment.ts.
// - Its first rooms ease you in like the Labyrinth's (FIRST_ROOMS, FIRST_ROOM_LEVELS, LIGHT_GEAR).
// - Rooms 1–6 are creature dens (1–2 creatures however deep: EASY_SIZE_EARLY), or a stash
//   CAMP_STASH of the time, never two stashes in a row.
//   Every map has at least one stash, and stashes are always marked on the scroll (even on the
//   blind first step), so finding potions is a choice of route. It should be a struggle to reach
//   the chief without them (the user, 2026-10-27).
// - At the top, the camp's chief: an Uncommon in Common gear, Lv CAMP_CHIEF_LEVEL. Its chest is a
//   mini boss's, bar the Iron Cage Schematic (that's for the Labyrinth's mini bosses).
// - Beaten the first time, it guards CAMP_CAGES cages, each a Common or Uncommon (even odds) at
//   Lv CAMP_CAGE_LEVELS, of no race your party has, so you've a team of 3. After that, one cage
//   with a creature in it CAMP_REPEAT_CHANCE of the time.
// - The Labyrinth opens once you've beaten it, or scanned LABYRINTH_SCANS barcodes.
export const CAMP_ROUTE = 7;
export const CAMP_STASH = 0.3;
export const CAMP_CHIEF_LEVEL = 5;
export const CAMP_CAGES = 2;
export const CAMP_CAGE_LEVELS: [number, number] = [2, 4];
export const CAMP_REPEAT_CHANCE = 0.2;
export const LABYRINTH_SCANS = 25;
// (Anyone who'd already beaten the Cyclops keeps the way in.)
export const labyrinthOpen = (meta: DungeonMeta, scans: number) =>
  (meta.campClears ?? 0) > 0 || meta.clears > 0 || scans >= LABYRINTH_SCANS;
// A room on the way up: no two stashes in a row (lastStash: the room before was one).
export const campRoomKind = (lastStash: boolean, rng: Rng = Math.random): RoomKind => (!lastStash && rng() < CAMP_STASH ? "stash" : "easy");

// The chief's cages (rolled as the run starts). first: you've never beaten it. avoid: your party's races.
export function campCages(first: boolean, avoid: readonly string[], rng: Rng = Math.random): Cage[] {
  if (!first) return [rng() < CAMP_REPEAT_CHANCE ? campCreature(avoid, [], rng) : {}];
  const cages: Cage[] = [];
  for (let i = 0; i < CAMP_CAGES; i++) cages.push(campCreature(avoid, cages.flatMap((c) => (c.creatureId ? [c.creatureId] : [])), rng));
  return cages;
}
function campCreature(avoid: readonly string[], taken: string[], rng: Rng): Cage {
  const rarity: Rarity = rng() < 0.5 ? "common" : "uncommon";
  const fits = (t: CreatureTemplate) => !t.boss && !taken.includes(t.id) && !(SPECIES_RACES[t.id] ?? []).some((r) => avoid.includes(r));
  // (Should every race be taken, any creature of the rarity.)
  const pool = CREATURES_BY_RARITY[rarity].filter(fits);
  const t = pick(pool.length > 0 ? pool : CREATURES_BY_RARITY[rarity], rng);
  return { creatureId: t.id, level: randInt(...CAMP_CAGE_LEVELS, rng) };
}

// How often each kind of room appears on the map (every row but the boss's), in %.
export const ROOM_MIX: [RoomKind, number][] = [
  ["easy", 40], ["pool", 20], ["hard", 10], ["chest", 10], ["stash", 10], ["merchant", 5], ["witch", 5],
];

// Mystery rooms ("?" on the map) have their own mix: a gamble. Half are a
// mini boss; 15% are something good (a librarian — only ever found here —
// a deck of cards, or a merchant); the rest are ordinary rooms.
// The large rooms (lib/dungeon/map.ts: placeLarge): a run has one in the
// Labyrinth, two in the Deep Labyrinth. Mini objectives off the main route.
// - Encampment: 2–3 Rares (Epics in the Deep) and 1–3 cages, each of which
//   may hold a creature you can take home. One of three kinds
//   (ENCAMP_VARIANTS, equally likely): plain; ambush (it
//   looks empty, until you open a cage: two jump you at once); rigged
//   (barrels of blackpowder: beat them in ENCAMP_FUSE rounds or the room
//   comes down on you, and the run is over). (The drunk kind, foes on
//   ENCAMP_DRUNK_HP × HP, was taken out on 2026-10-26: without damage types
//   nothing answered it. A run saved with one still plays it.)
// - Library: LIBRARY_FIND of the time 1–3 codexes lying about; otherwise a
//   wandering librarian with LIBRARY_BOOKS books for sale.
// - Storehouse: materials mostly, some potions, now and then a weapon, a
//   flare or a clairvoyance scroll. STOREHOUSE_GUARD of the
//   time a mini boss has made it its lair.
export const LARGE_MIX: [RoomKind, number][] = [["encampment", 34], ["library", 33], ["storehouse", 33]];

export const MYSTERY_MIX: [RoomKind, number][] = [
  ["miniboss", 45], ["witch", 8], ["librarian", 5], ["cards", 5], ["merchant", 5],
  ["easy", 7], ["pool", 7], ["hard", 6], ["chest", 6], ["stash", 6],
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
  merchant:  { name: "Wandering merchant", icon: "💰" },
  cards:     { name: "Deck of cards",      icon: "🃏" },
  miniboss:  { name: "Mini boss",          icon: "👹" },
  witch:     { name: "The card witch",     icon: "🧙" },
  boss:      { name: "The boss",           icon: "👁️" },
  encampment: { name: "Encampment",        icon: "⛺" },
  library:   { name: "Library",            icon: "🏛️" },
  storehouse: { name: "Storehouse",        icon: "🏚️" },
};

// Fights.
// Creature dens grow with depth (a room's depth: rooms walked into on the
// shortest way to it from the entrance). Up to EARLY_DEPTH deep they hold
// 1–2 creatures; deeper, 2–3. Picked from the end of EASY_PACK, so one is
// an Uncommon, two a Common and an Uncommon, three adds another Common.
// (Hard rooms and mini bosses are a single creature at any depth.)
export const EARLY_DEPTH = 4;
export const FIRST_ROOMS = 2; // …and the first FIRST_ROOMS deep hold just one (a new player may have one creature)
export const EASY_SIZE_EARLY: [number, number] = [1, 2];
export const EASY_SIZE_DEEP: [number, number] = [2, 3];
export const EASY_PACK: Rarity[] = ["common", "common", "uncommon"];
export const EASY_GOLD: [number, number] = [10, 20];
export const HARD_GOLD: [number, number] = [30, 50];
export const BOSS_GOLD: [number, number] = [80, 120];
export const MINIBOSS_GOLD: [number, number] = [50, 80];
export const DECK_CARDS = 5;           // a deck of cards: 5 creature-card rolls
// The card witch's prizes: a creature card each, rolled like a scan.
export const witchPrize = () => pickCreatureId(pickRarity("", "random"));

// ── The battle bag ───────────────────────────────────────────────────
// Your bag: what you carry in the Labyrinth, one thing per slot (they
// don't stack), kept between runs. You start with a BINDLE (3 slots); a
// RUGGED BACKPACK (5) is in your first Cyclops's chest, on every wandering
// merchant's cart (BACKPACK_PRICE) and in STOREHOUSE_BACKPACK of storehouses,
// until you've got one.
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
export const BACKPACK_PRICE = 1000;
export const STOREHOUSE_BACKPACK = 0.5;
export type BagEntry = PotionKey | `gear:${string}` | `loot:${string}`;
export const bagSize = (meta: { bagSize?: number }) => meta.bagSize ?? BINDLE;
export const onBindle = (meta: { bagSize?: number }) => bagSize(meta) < BACKPACK; // the backpack's still to find
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
// Something found this run was used up (a potion drunk, a flare lit): it
// doesn't come home, so it leaves the haul. One of that potion, or that drop.
export function usedUp(got: GotItem[] = [], what: { potion: PotionKey } | { dropId: string }): GotItem[] {
  const i = got.findIndex((g) => ("potion" in what ? "potion" in g && g.potion === what.potion : "drop" in g && g.drop.id === what.dropId));
  return i < 0 ? got : [...got.slice(0, i), ...got.slice(i + 1)];
}

export type PotionKey = "potion" | "lesser";
export const POTIONS: Record<PotionKey, { name: string; heal: number; price: number; icon: string }> = {
  potion: { name: "Healing Potion", heal: 100, price: 100, icon: "⚗️" }, // (a round flask: the art is a red bottle)
  lesser: { name: "Lesser Potion",  heal: 50,  price: 50,  icon: "🧪" }, // (a little vial)
};
// A stash: a burlap sack of STASH_ITEMS things. Open it and take what you
// want (one slot each, gold takes none); what you leave stays on the floor.
// - STASH_POTIONS potions (each a Healing Potion STASH_POTION_CHANCE of the
//   time, else a Lesser one);
// - the last thing is rolled: STASH_LAST_ROLL — another potion, some gold
//   (STASH_GOLD), or a weapon or armour piece rolled like a scan;
// - now and then a flare or a clairvoyance scroll as well (STASH_TOOLS).
export const STASH_ITEMS = 3;
export const STASH_POTIONS = 2;
export const STASH_POTION_CHANCE = 0.3;
export const STASH_LAST_ROLL = { potion: 0.25, gold: 0.5, gear: 0.25 };
export const STASH_GOLD: [number, number] = [100, 250];
// The odds of a flare, and of a clairvoyance scroll, on top of what's in a
// stash or a chest (the user, 2026-10-20).
export const STASH_TOOLS = { flare: 0.1, clairvoyance: 0.05 };
export const CHEST_TOOLS = { flare: 0.2, clairvoyance: 0.1 };
export const toolFinds = (odds: { flare: number; clairvoyance: number }, rng: Rng = Math.random): SackItem[] => [
  ...(rng() < odds.flare ? [{ gear: toolDrop("flare") }] : []),
  ...(rng() < odds.clairvoyance ? [{ gear: toolDrop("clairvoyance") }] : []),
];
// The Cyclops' chest: CYCLOPS_GEAR rolls on the weapon & armour table,
// CYCLOPS_ITEMS on the item table and CYCLOPS_POTIONS on the potion table,
// at most CYCLOPS_CHEST_MAX rolls in all (its gold and the backpack come on
// top). Gear is rolled last, so it's what gets cut if the rolls run over.
// - weapon & armour: like a scan (any rarity at the usual odds; armour twice
//   as likely as a weapon), as in a stash;
// - items: a codex (CYCLOPS_RACE_CODEX of the time a race codex, else one any
//   creature can learn). Battle items join this table when they exist;
// - potions: a Healing Potion STASH_POTION_CHANCE of the time, else a Lesser one.
export const CYCLOPS_GEAR: [number, number] = [3, 5];
export const CYCLOPS_ITEMS: [number, number] = [1, 2];
export const CYCLOPS_POTIONS: [number, number] = [1, 2];
export const CYCLOPS_CHEST_MAX = 10;
export const CYCLOPS_RACE_CODEX = 0.25;
export function rollGearPiece(rng: Rng = Math.random): Drop {
  const rarity = pickRarity("", "random");
  return rng() < 1 / 3 ? weaponDrop(pick(ITEM_KEYS, rng), rarity) : armorDrop(pick(ARMOR_KEYS, rng), rarity);
}
export function cyclopsChest(rng: Rng = Math.random): SackItem[] {
  const times = (range: [number, number], roll: () => SackItem) => Array.from({ length: randInt(...range, rng) }, roll);
  const chest = [
    ...times(CYCLOPS_ITEMS, () => ({ gear: codexDrop(rng() < CYCLOPS_RACE_CODEX ? randomCodexMove() : randomLearnableMove()) })),
    ...times(CYCLOPS_POTIONS, (): SackItem => ({ potion: rng() < STASH_POTION_CHANCE ? "potion" : "lesser" })),
  ];
  const gear = Math.min(randInt(...CYCLOPS_GEAR, rng), CYCLOPS_CHEST_MAX - chest.length);
  return [...chest, ...Array.from({ length: gear }, (): SackItem => ({ gear: rollGearPiece(rng) }))];
}
// backpack: the rugged backpack (in the Cyclops' chest, the first time you beat it).
export type SackItem = { potion: PotionKey } | { gold: number } | { gear: Drop } | { backpack: true };

// Room for more in the bag? Adds what fits; returns the new bag.
export function addToBag(bag: BagEntry[], items: BagEntry[], size: number): BagEntry[] {
  return [...bag, ...items].slice(0, Math.max(bag.length, size));
}

// "Take all", one thing at a time: whatever takes no room first, then the
// rarest thing that needs a slot (a tie goes to the first one). -1 when
// nothing more can be taken. rank: higher is rarer.
export function nextToTake<T>(items: T[], free: (x: T) => boolean, rank: (x: T) => number, full: boolean): number {
  const f = items.findIndex(free);
  if (f >= 0 || full) return f;
  let best = -1;
  items.forEach((x, i) => { if (best < 0 || rank(x) > rank(items[best])) best = i; });
  return best;
}
// How rare a thing in a chest is, for "Take all": potions come after Commons.
export const dropRank = (d?: Drop) => (d && "rarity" in d ? RARITIES.indexOf(d.rarity) : -1);
export const sackRank = (x: SackItem) => ("gear" in x ? dropRank(x.gear) : -1);
// A chest holds at most CHEST_SLOTS things: rolled more, the least rare fall
// out (gold and potions first, then Commons, Uncommons…; a tie, the last one).
export const CHEST_SLOTS = 5;
export function capSack(sack: SackItem[], max = CHEST_SLOTS): SackItem[] {
  const out = [...sack];
  while (out.length > max) {
    let worst = 0;
    out.forEach((x, i) => { if (sackRank(x) <= sackRank(out[worst])) worst = i; });
    out.splice(worst, 1);
  }
  return out;
}

// Materials found down here are a stack in one bag slot; more of the same
// material joins it. They only join your tally at home (once you're back).
export function materialStackIn(meta: { bag: BagEntry[]; loot?: Record<string, Drop> }, d: Drop): string | undefined {
  if (d.dropType !== "item" || !d.material) return undefined;
  return meta.bag.map(lootIdOf).find((id) => {
    const x = id ? meta.loot?.[id] : undefined;
    return !!x && x.dropType === "item" && x.material === d.material;
  });
}
// Does it need a free slot? Gold and creature cards never do; a material
// doesn't if a stack of it is already in the bag.
export const needsSlot = (meta: DungeonMeta, d: Drop) =>
  d.dropType !== "reward" && d.dropType !== "card" && d.dropType !== "creature" && !materialStackIn(meta, d);
// Put a found thing (a potion, gear, a codex, a material…) in the bag: the
// new meta, or null if there's no room. (Gold and cards are handled by the screen.)
export function stowDrop(meta: DungeonMeta, d: Drop): DungeonMeta | null {
  const stack = materialStackIn(meta, d);
  if (stack) {
    const had = meta.loot![stack];
    return { ...meta, loot: { ...meta.loot, [stack]: { ...had, qty: (had.dropType === "item" ? had.qty ?? 1 : 1) + (d.dropType === "item" ? d.qty ?? 1 : 1) } as Drop } };
  }
  if (meta.bag.length >= bagSize(meta)) return null;
  const potion = d.dropType === "item" ? d.potion : undefined;
  if (potion) return { ...meta, bag: [...meta.bag, potion] };
  return { ...meta, bag: [...meta.bag, lootEntry(d.id)], loot: { ...(meta.loot ?? {}), [d.id]: d } };
}

// Rare or better: worth a word before you walk off and leave it.
const RARE_UP: Rarity[] = ["rare", "epic", "legendary"];
export const isRareFind = (d: Drop) => d.dropType !== "reward" && RARE_UP.includes(d.rarity);
// What you'd leave behind by moving on: rare-or-better things still in an
// opened chest or sack here, or waiting for room in your bag.
export function rareLeftBehind(run: DungeonRun): Drop[] {
  const sack = run.current?.opened ? run.current.sack ?? [] : [];
  return [...sack.flatMap((x) => ("gear" in x ? [x.gear] : [])), ...(run.pending ?? [])].filter(isRareFind);
}
export const UPGRADE_CHANCE = 0.05;   // easy fight: one enemy item is a tier higher, and drops if you win
export const ENEMY_DROP_CHANCE = 0.2;  // any enemy: one of its items (at random) drops if you win
export const CHEST_DROPS = 3;
export const CHEST_CODEX_CHANCE = 0.1; // a chest holds a codex (instead of one of its drops)
export const CODEX_PRICE = 500;       // wandering librarians sell codexes
export const LIBRARIAN_OFFERS = 3;
export const MERCHANT_SCROLL_CHANCE = 0.2; // a wandering merchant also has an XP scroll
export const SCROLL_PRICE = 200;
export const MINIBOSS_SCROLL_CHANCE = 0.25; // a beaten mini boss's chest holds an XP scroll
export const BOSS_SCROLL_CHANCE = 0.5;      // …and a boss's
// A mini boss's chest: potions instead of the heal it used to give, now and
// then a clairvoyance scroll or a Revival Elixir (MINIBOSS_REVIVAL), and the Iron Cage Schematic until you've found
// it. (The bookcase schematic used to drop here,
// from bosses and storehouses too; now only the tavern's bounty gives it:
// lib/tavern.ts.)
export const MINIBOSS_POTIONS: [number, number] = [1, 2];
export const MINIBOSS_CLAIRVOYANCE = 0.1;
export const CAGE_PLAN_CHANCE = 0.2; // …and the Iron Cage Schematic, until you've found one
// cagePlan: you haven't got the cage schematic yet (nor built the cage).
export function minibossExtras(rng: Rng = Math.random, cagePlan = false): SackItem[] {
  const potion = (): SackItem => ({ potion: rng() < STASH_POTION_CHANCE ? "potion" : "lesser" });
  return [
    ...Array.from({ length: randInt(...MINIBOSS_POTIONS, rng) }, potion),
    ...(rng() < MINIBOSS_CLAIRVOYANCE ? [{ gear: toolDrop("clairvoyance") }] : []),
    ...(rng() < MINIBOSS_REVIVAL ? [{ gear: toolDrop("revival") }] : []),
    ...(cagePlan && rng() < CAGE_PLAN_CHANCE ? [{ gear: schematicDrop("iron_cage") }] : []),
  ];
}

// ── The large rooms ─────────────────────────────────────────────────
export type EncampVariant = "plain" | "drunk" | "ambush" | "rigged";
export const ENCAMP_VARIANTS: EncampVariant[] = ["plain", "ambush", "rigged"];
export const ENCAMP_SIZE: [number, number] = [2, 3];
export const ENCAMP_AMBUSHERS = 2;
export const ENCAMP_DRUNK_HP = 3;
export const ENCAMP_FUSE = 20;
export const ENCAMP_GOLD: [number, number] = [60, 100];
export const ENCAMP_CAGES: [number, number] = [1, 3];
export const CAGE_CREATURE_CHANCE = 0.5;

// ── How many fight ──────────────────────────────────────────────────
// Your team, and the creatures you face in each kind of fight. The Abyss,
// the last dungeon, is fought 5 against 5 (the user, 2026-10-27: 5v5 is the
// level PvP should be), and its foes come in matching numbers, about 5/3 of
// the usual. 🧪 The Abyss's counts are Claude's numbers.
// first: dens in the first FIRST_ROOMS rooms; early: up to EARLY_DEPTH;
// deep: beyond. hard: lurking brutes. miniboss: mini bosses (and a
// storehouse's guard). camp/ambush: an encampment's foes (an ambush's
// fixed number). guards: the Warden's. fuse: a rigged encampment's rounds.
export type Squads = {
  team: number; first: [number, number]; early: [number, number]; deep: [number, number];
  hard: number; miniboss: number; camp: [number, number]; ambush: number; guards: number; fuse: number;
};
export const SQUADS: Squads = {
  team: TEAM_SIZE, first: [1, 1], early: EASY_SIZE_EARLY, deep: EASY_SIZE_DEEP,
  hard: 1, miniboss: 1, camp: ENCAMP_SIZE, ambush: ENCAMP_AMBUSHERS, guards: 2, fuse: ENCAMP_FUSE,
};
export const ABYSS_TEAM = 5;
export const ABYSS_SQUADS: Squads = {
  team: ABYSS_TEAM, first: [2, 2], early: [2, 3], deep: [3, 5],
  hard: 2, miniboss: 2, camp: [3, 5], ambush: 3, guards: 4, fuse: 30,
};
export const squadsOf = (dungeon: DungeonId): Squads => (dungeon === 3 ? ABYSS_SQUADS : SQUADS);
// How many of your party go in and fight (the rest wait in the Den).
export const teamSize = (run: { dungeon?: DungeonId }) => squadsOf(dungeonOf(run)).team;
// A cage in an encampment: maybe a creature (rolled like a scan), until you open it.
// level: the creature's level (missing = 1).
export type Cage = { creatureId?: string; level?: number; opened?: boolean };
export const LIBRARY_FIND = 0.75;
export const LIBRARY_CODEXES: [number, number] = [1, 3];
export const LIBRARY_BOOKS = 5;
export const LEARNABLE_CODEX_PRICE = 200; // a librarian's codex any creature can read, or a race-kit move's (Claude's draft, 2026-10-26; older race codexes: CODEX_PRICE)
// (Impale, the Epic special move, costs what the older race codexes do.)
export const codexPrice = (move: string) => (RACE_MOVES.some((m) => m.name === move) || MOVE_BY_NAME[move]?.codexRarity === "epic" ? CODEX_PRICE : LEARNABLE_CODEX_PRICE);
export const STOREHOUSE_GUARD = 0.35;
export const STOREHOUSE_MATERIALS: [number, number] = [3, 5];
export const STOREHOUSE_POTIONS: [number, number] = [1, 2];
export const STOREHOUSE_FINDS = { weapon: 0.15, flare: 0.3, clairvoyance: 0.08 };
// How rare a storehouse's materials are (out of 100).
const STORE_RARITY: [Rarity, number][] = [["common", 50], ["uncommon", 30], ["rare", 15], ["epic", 5]];

// ── The wandering merchant ───────────────────────────────────────────
// Up to MERCHANT_SLOTS things on the cart, one of each (the user, 2026-10-23):
// 1. always both potions and a flare;
// 2. rare wares, each rolled on its own: the rugged backpack until you've got
//    it (always), or once you have, a backpack upgrade (BAG_UPGRADE_CHANCE);
//    each storage schematic (STORAGE_PLAN_CHANCE, until you have it or built
//    it); a Revival Elixir (REVIVAL_CHANCE); an XP scroll
//    (MERCHANT_SCROLL_CHANCE) and a clairvoyance scroll (MERCHANT_CLAIRVOYANCE);
// then materials fill what's left (one stack of each kind).
// (Gear on the cart, the plan's step 3, isn't in yet.)
export const MERCHANT_SLOTS = 10;
export const MERCHANT_CLAIRVOYANCE = 0.4;
// Backpack upgrades: one more slot each, from the backpack's 5 up to
// BAG_MAX, at BAG_UPGRADE_PRICES (the first is for a 6th slot).
export const BAG_MAX = 10;
export const BAG_UPGRADE_PRICES = [1000, 1500, 2000, 2500, 3000];
export const BAG_UPGRADE_CHANCE = 0.2;
export const bagUpgradePrice = (size: number) => BAG_UPGRADE_PRICES[size - BACKPACK];
export const STORAGE_PLAN_CHANCE = 0.2;
export const STORAGE_PLAN_PRICE = 2000;
export const REVIVAL_CHANCE = 0.25;
// The Revival Elixir brings a knocked-out creature back with this share of
// its HP, between rooms. Also in mini-boss and boss chests.
export const REVIVE_HP = 0.5;
export const MINIBOSS_REVIVAL = 0.2;
export const BOSS_REVIVAL = 0.5;
// A boss's chest sometimes holds a soul stone (the user, 2026-10-25): the
// Cyclops' CYCLOPS_SOUL_STONE of the time, the strongbox (the Hydra's, the Warden's) WARDEN_SOUL_STONE.
export const CYCLOPS_SOUL_STONE = 0.02;
export const WARDEN_SOUL_STONE = 0.05;
export function bossSoulStone(cyclops: boolean, rng: Rng = Math.random): SackItem[] {
  return rng() < (cyclops ? CYCLOPS_SOUL_STONE : WARDEN_SOUL_STONE) ? [{ gear: soulStoneDrop(randomSoulStone(rng)) }] : [];
}
export const MERCHANT_MATERIALS: { material: MaterialKey; qty: number; price: number }[] = [
  { material: "planks", qty: 5, price: 40 },
  { material: "nails", qty: 5, price: 30 },
  { material: "metal_bars", qty: 2, price: 90 },
  { material: "essence_stones", qty: 1, price: 150 },
];
// bagUp: a backpack upgrade (its price is set by your bag's size when you see it).
export type Ware = { key: string; price: number } & (
  | { potion: PotionKey } | { scroll: true } | { tool: ToolKey } | { material: MaterialKey; qty: number } | { backpack: true }
  | { bagUp: true } | { schematic: StoragePlan });
// backpack: you're still on the bindle (the backpack's on the cart; once
// you've got it, an upgrade may be instead).
export function rollWares(rng: Rng = Math.random, backpack = false): Ware[] {
  const wares: Ware[] = [
    ...(backpack ? [{ key: "backpack", backpack: true as const, price: BACKPACK_PRICE }] : []), // (first, on the bindle)
    { key: "potion", potion: "potion", price: POTIONS.potion.price },
    { key: "lesser", potion: "lesser", price: POTIONS.lesser.price },
    { key: "flare", tool: "flare", price: TOOLS.flare.price },
  ];
  if (!backpack && rng() < BAG_UPGRADE_CHANCE) wares.push({ key: "bag_up", bagUp: true, price: BAG_UPGRADE_PRICES[0] });
  for (const plan of Object.keys(STORAGE_PLANS) as StoragePlan[])
    if (rng() < STORAGE_PLAN_CHANCE) wares.push({ key: plan, schematic: plan, price: STORAGE_PLAN_PRICE });
  if (rng() < REVIVAL_CHANCE) wares.push({ key: "revival", tool: "revival", price: TOOLS.revival.price });
  if (rng() < MERCHANT_SCROLL_CHANCE) wares.push({ key: "scroll", scroll: true, price: SCROLL_PRICE });
  if (rng() < MERCHANT_CLAIRVOYANCE) wares.push({ key: "clairvoyance", tool: "clairvoyance", price: TOOLS.clairvoyance.price });
  const mats = [...MERCHANT_MATERIALS];
  while (wares.length < MERCHANT_SLOTS && mats.length > 0) {
    const m = mats.splice(Math.floor(rng() * mats.length), 1)[0];
    wares.push({ key: m.material, ...m });
  }
  return wares.slice(0, MERCHANT_SLOTS);
}
// What's on a cart for you: not the backpack once you've got one (a cart
// rolled before you found it elsewhere); an upgrade only while the backpack
// can grow, priced for your bag's size; not a storage schematic you already
// have or have built (plans: those).
export function waresFor(wares: Ware[], meta: { bagSize?: number }, plans: readonly StoragePlan[] = []): Ware[] {
  const size = bagSize(meta);
  return wares.flatMap((w): Ware[] => {
    if ("backpack" in w) return onBindle(meta) ? [w] : [];
    if ("bagUp" in w) return size >= BACKPACK && size < BAG_MAX ? [{ ...w, price: bagUpgradePrice(size) }] : [];
    if ("schematic" in w) return plans.includes(w.schematic) ? [] : [w];
    return [w];
  });
}
// The thing a ware becomes once it's yours (undefined: it isn't a thing —
// a potion goes in the bag as itself; the backpack and an upgrade make your
// bag bigger).
export function wareDrop(w: Ware): Drop | undefined {
  return "scroll" in w ? scrollDrop() : "tool" in w ? toolDrop(w.tool) : "material" in w ? materialDrop(w.material, w.qty)
    : "schematic" in w ? schematicDrop(w.schematic) : undefined;
}
// The things picked off the cart, priced up: their total, the bag slots they
// need (a material joins a stack you already carry), and what's stopping you
// buying them all ("gold", "room"), if anything.
export function priceUp(wares: Ware[], picked: string[], gold: number, bagFree: number, stacks: string[]) {
  const chosen = wares.filter((w) => picked.includes(w.key));
  const total = chosen.reduce((s, w) => s + w.price, 0);
  const slots = chosen.filter((w) => !("backpack" in w) && !("bagUp" in w) && !("material" in w && stacks.includes(w.material))).length;
  const short: "gold" | "room" | null = total > gold ? "gold" : slots > bagFree ? "room" : null;
  return { chosen, total, slots, short };
}
export const wareName = (w: Ware) => ("backpack" in w ? "Rugged backpack" : "bagUp" in w ? "Backpack upgrade" : "potion" in w ? POTIONS[w.potion].name
  : "scroll" in w ? "Tattered XP Scroll" : "tool" in w ? TOOLS[w.tool].name : "schematic" in w ? SCHEMATICS[w.schematic].name
  : MATERIALS[w.material].name + " ×" + w.qty);

// Selling to the merchant, to make room in your bag. Weapons and armour go
// for what the crate at home pays (gearValue); the rest for MERCHANT_BUYBACK
// of what he (or a librarian, for a codex) would charge. 0: he won't take it
// (Klutz's club, a schematic).
export const MERCHANT_BUYBACK = 0.5;
// Where you can sell from your bag: the merchant's room, and a librarian's
// (at the same prices), so you can make room for what they sell.
export const buysHere = (room: Room | null | undefined) =>
  !!room && (room.kind === "merchant" || room.kind === "librarian" || (room.kind === "library" && !!room.librarian));
export function merchantOffer(entry: BagEntry, item: Drop | undefined, gearValue: (d: Drop) => number): number {
  const half = (price: number) => Math.floor(price * MERCHANT_BUYBACK);
  if (isPotionEntry(entry)) return half(POTIONS[entry].price);
  if (!item || item.dropType !== "item") return 0;
  if (item.itemKey === "klutz_club") return 0;
  if (item.potion) return half(POTIONS[item.potion].price); // a potion in your Inventory (the tavern)
  if (item.itemCategory === "weapon" || item.itemCategory === "armor") return gearValue(item);
  if (item.material) {
    const m = MERCHANT_MATERIALS.find((x) => x.material === item.material);
    return m ? half((m.price / m.qty) * (item.qty ?? 1)) : 0;
  }
  if (item.scroll) return half(SCROLL_PRICE);
  if (item.tool) return half(TOOLS[item.tool].price);
  if (item.codexMove) return half(codexPrice(item.codexMove));
  return 0;
}

type Rng = () => number;
// A weighted pick from [thing, weight] pairs.
function weighted<T>(mix: [T, number][], rng: Rng): T {
  let r = rng() * mix.reduce((s, [, w]) => s + w, 0);
  for (const [t, w] of mix) { if (r < w) return t; r -= w; }
  return mix[0][0];
}
const randInt = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(arr: readonly T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

// ── Enemies ──────────────────────────────────────────────────────────
// Armour is a set: stats is what it adds up to, pieces the helmet, chest
// and legs it wears (one of those is what drops). Some wear only part of a
// set (LIGHT_GEAR).
// dropSlot: a dropping armour set, which piece of it drops (missing = one at random, as old saves had).
// armorV: ARMOR_V2 = on the full-roll scale (older saves are upgraded on load, lib/save.ts).
export type GearPiece = {
  slot: "weapon" | "armor"; key: string; rarity: Rarity; stats: Record<string, number>; drops: boolean; dropSlot?: ArmorSlot;
  pieces?: Partial<Record<ArmorSlot, Record<string, number>>>; armorV?: number;
};

// The Labyrinth's first rooms send out lighter-armed creatures (the user,
// 2026-10-26): up to room 3 no weapon but all their armour (1–2 pieces was
// too easy to one-shot), up to room 7 a weapon and only 1–2 pieces of
// armour. Mini bosses and the Cyclops are armed as ever.
export const LIGHT_GEAR: { upTo: number; weapon: boolean; armorPieces: [number, number] }[] = [
  { upTo: 3, weapon: false, armorPieces: [ARMOR_SLOTS.length, ARMOR_SLOTS.length] },
  { upTo: 7, weapon: true,  armorPieces: [1, 2] },
];

// An armour set cut down to some of its pieces, its stats summed again.
function wornPieces(p: GearPiece, slots: ArmorSlot[]): GearPiece {
  const pieces = Object.fromEntries(slots.flatMap((s) => (p.pieces?.[s] ? [[s, p.pieces[s]]] : []))) as GearPiece["pieces"];
  return { ...p, pieces, stats: wornArmor(Object.values(pieces!).map((stats) => ({ stats }))).stats };
}
const piecesOf = (p: GearPiece): ArmorSlot[] => (p.pieces ? ARMOR_SLOTS.filter((s) => p.pieces![s]) : ARMOR_SLOTS);

// An enemy's gear at this depth of the Labyrinth (LIGHT_GEAR; deeper: as rolled).
export function lightenGear(e: Enemy, depth: number, rng: Rng = Math.random): Enemy {
  const band = LIGHT_GEAR.find((b) => depth <= b.upTo);
  if (!band) return e;
  const gear = e.gear.flatMap((p): GearPiece[] => {
    if (p.slot === "weapon") return band.weapon ? [p] : [];
    const slots = [...piecesOf(p)];
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    return [wornPieces(p, slots.slice(0, randInt(...band.armorPieces, rng)))];
  });
  return { ...e, gear };
}
// level: missing = REF_LEVEL (the species' listed %s).
// hpMult: its HP is multiplied (an encampment's potion-drunk foes).
// soulStone: rolled like anyone's (lib/creatures/soulStones.ts); missing = none (and runs saved before enemies had them).
// gentle: its hits never knock anyone out (the guided first fight's thief).
export type Enemy = { creatureId: string; proficiency: CreatureProficiency; moves: string[]; gear: GearPiece[]; level?: number; hpMult?: number; soulStone?: SoulStoneKey; gentle?: boolean };

// Enemies learn more of their race kits as they level (the user, 2026-10-26:
// the moveset scales with level), so deeper foes don't all fight with the
// same three starting moves. 🧪 The levels are Claude's draft:
// - ENEMY_MOVE_LEVELS.heavy: its empty fourth slot gets its race's heavy move
//   (its first race, its main style);
// - .light: its Neutral light move gives way to another move from its kits;
// - .quick: so does its Neutral priority move.
// It always keeps its race's 30-energy move, so it never has to rest.
export const ENEMY_MOVE_LEVELS = { heavy: 5, light: 12, quick: 20 };
export function enemyMoves(t: CreatureTemplate, moves: string[], level: number, rng: Rng = Math.random): string[] {
  const race = SPECIES_RACES[t.id]?.[0];
  if (!race) return moves; // the older species (tests) and bosses
  const out = [...moves];
  const kit = () => t.skills.map((m) => m.name).filter((n) => !out.includes(n) && n !== BALANCED_MOVES[t.cls].name && n !== NEUTRAL_QUICK_MOVES[t.cls].name);
  const swap = (name: string) => {
    const i = out.indexOf(name), options = kit();
    if (i >= 0 && options.length) out[i] = pick(options, rng);
  };
  const heavy = kitMoveFor(race, t.cls, "heavy").name;
  if (level >= ENEMY_MOVE_LEVELS.heavy && out.length < MOVE_SLOTS && !out.includes(heavy)) out.push(heavy);
  if (level >= ENEMY_MOVE_LEVELS.light) swap(BALANCED_MOVES[t.cls].name);
  if (level >= ENEMY_MOVE_LEVELS.quick) swap(NEUTRAL_QUICK_MOVES[t.cls].name);
  return out;
}

export function makeEnemy(rarity: Rarity, gearRarity: Rarity, exclude: string[], rng: Rng = Math.random, level?: number): Enemy {
  const pool = CREATURES_BY_RARITY[rarity].filter((c) => !exclude.includes(c.id));
  const t = pick(pool.length > 0 ? pool : CREATURES_BY_RARITY[rarity], rng);
  const roll = rollCreature(t, rng);
  const g = rollGear(gearRarity, t);
  return {
    creatureId: t.id, proficiency: roll.proficiency, moves: enemyMoves(t, roll.moves, level ?? REF_LEVEL, rng), ...(level ? { level } : {}), ...(roll.soulStone ? { soulStone: roll.soulStone } : {}),
    gear: [
      { slot: "weapon", key: g.weaponKey, rarity: gearRarity, stats: g.weapon, drops: false },
      { slot: "armor",  key: g.armorKey,  rarity: gearRarity, stats: g.armor,  drops: false, pieces: g.armorPieces, armorV: ARMOR_V2 },
    ],
  };
}

// The stats of the piece an enemy's armour drops: the one it wore (older
// saves didn't keep the pieces, so it rolls a fresh one).
export function droppedPieceStats(p: GearPiece, slot: ArmorSlot): Record<string, number> {
  return p.pieces?.[slot] ?? rollArmorPiece(p.key as ArmorKey, p.rarity);
}

// Which of an enemy's items could drop: its weapon or one of the armour
// pieces it wears, all equally likely. The gear index, and for armour which
// piece of the set.
function pickDropItem(e: Enemy, rng: Rng): { i: number; dropSlot?: ArmorSlot } {
  const items = e.gear.flatMap((p, i) => (p.slot === "weapon" ? [{ i }] : piecesOf(p).map((dropSlot) => ({ i, dropSlot }))));
  return items[Math.floor(rng() * items.length)];
}

// Re-rolls a piece one rarity tier higher and marks it as loot.
function upgradeAndDrop(enemies: Enemy[], rng: Rng) {
  const e = pick(enemies, rng);
  const { i, dropSlot } = pickDropItem(e, rng);
  const old = e.gear[i];
  const rarity = RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(old.rarity) + 1)];
  const t = CREATURE_BY_ID[e.creatureId];
  const g = rollGear(rarity, t);
  e.gear[i] = old.slot === "weapon"
    ? { slot: "weapon", key: g.weaponKey, rarity, stats: g.weapon, drops: true }
    : wornPieces({ slot: "armor", key: g.armorKey, rarity, stats: g.armor, drops: true, dropSlot, pieces: g.armorPieces, armorV: ARMOR_V2 }, piecesOf(old));
}

// The deeper dungeons' boss: the Warden, a Legendary, with Epic guards (the Deep
// Labyrinth: two, in Rare and Uncommon gear; the Abyss: four (squadsOf), in Epic and
// Rare, and higher level).
export function wardenPack(rng: Rng = Math.random, dungeon: DungeonId = 2): Enemy[] {
  const [wardenGear, guardGear] = DUNGEONS[dungeon].pack ?? DUNGEONS[2].pack!;
  const level = bossLevel(dungeon);
  const warden = makeEnemy("legendary", wardenGear, [], rng, level);
  // (No two the same species.)
  const pack = [warden];
  for (let i = 0; i < squadsOf(dungeon).guards; i++) pack.push(makeEnemy("epic", guardGear, pack.map((e) => e.creatureId), rng, level - 1));
  return pack;
}

export function enemyFighter(e: Enemy): Fighter {
  const t = CREATURE_BY_ID[e.creatureId];
  const w = e.gear.find((p) => p.slot === "weapon");
  const a = e.gear.find((p) => p.slot === "armor");
  const built = buildFighter(t, w?.stats, a?.stats, e.moves, e.proficiency, undefined, w?.key as ItemKey | undefined, e.level ?? REF_LEVEL);
  const f = { ...built, ...(e.soulStone ? { soulStone: e.soulStone } : {}), ...(e.gentle ? { gentle: true } : {}) };
  if (!e.hpMult) return f;
  const maxHp = Math.round(f.maxHp * e.hpMult);
  return { ...f, maxHp, hp: maxHp, hpMult: e.hpMult };
}

// An enemy's weapon or armour (some go without).
export const gearOf = (e: Enemy, slot: GearPiece["slot"]) => e.gear.find((p) => p.slot === slot);

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
  offers?: string[];   // a librarian: the codexes for sale
  bought?: string[];   // …and the ones you bought (librarian codexes; merchant wares, by key)
  wares?: Ware[];      // a merchant's cart
  librarian?: boolean; // a library: a wandering librarian is in (otherwise there are codexes to find)
  variant?: EncampVariant; // an encampment: which kind
  cages?: Cage[];      // …its cages
  sprung?: boolean;    // …an ambush: you opened a cage and they jumped you
  guarded?: boolean;   // a storehouse: a mini boss guards it
  dynamite?: boolean;  // …Klutz's dynamite is among its crates, still to take (lib/tavern.ts)
  sack?: SackItem[];   // a stash, or a beaten fight's loot: what's (still) inside
  opened?: boolean;    // …and you've opened it
  container?: "sack" | "chest" | "strongbox"; // a beaten fight's loot: a sack (ordinary fights), a rickety chest (mini bosses, the Cyclops) or a strongbox (the Hydra, the Warden)
  quest?: "club" | "thief"; // part of the first quest (lib/quest.ts)
  boxTaken?: boolean;  // the thief's room: you've picked up Klutz's box
  witch?: WitchGame;   // the card witch's game (lib/dungeon/witch.ts)
  done: boolean;
};

export const isFight = (k: RoomKind) => k === "easy" || k === "hard" || k === "miniboss" || k === "boss";
// Is there a fight in this room (now)? Fight rooms, an encampment (an
// ambush only once it's sprung), a guarded storehouse.
export const hasFight = (r: Room) => isFight(r.kind)
  || (r.kind === "encampment" && (r.variant !== "ambush" || !!r.sprung))
  || (r.kind === "storehouse" && !!r.guarded);

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

// Each enemy has ENEMY_DROP_CHANCE of dropping one of its 4 items when you
// win, each item equally likely. One at most: an upgraded piece already drops.
export function rollEnemyDrops(enemies: Enemy[], rng: Rng = Math.random) {
  for (const e of enemies) {
    if (e.gear.length === 0 || e.gear.some((p) => p.drops)) continue;
    if (rng() >= ENEMY_DROP_CHANCE) continue;
    const { i, dropSlot } = pickDropItem(e, rng);
    e.gear[i] = { ...e.gear[i], drops: true, ...(dropSlot ? { dropSlot } : {}) };
  }
}

// What's inside a room, rolled as you walk in. depth: how deep it is (see
// EARLY_DEPTH); left out = deep. backpack: you're still on the bindle (a
// merchant has the backpack, and a storehouse may).
export function makeRoom(kind: RoomKind, rng: Rng = Math.random, depth = Infinity, dungeon: DungeonId = 1, backpack = false): Room {
  const room = rollRoom(kind, rng, depth, dungeon, backpack);
  if (room.enemies) rollEnemyDrops(room.enemies, rng);
  return room;
}

function rollRoom(kind: RoomKind, rng: Rng, depth: number, dungeon: DungeonId, backpack: boolean): Room {
  const D = DUNGEONS[dungeon];
  const gold = (range: [number, number]) => Math.round(randInt(...range, rng) * D.goldScale);
  const level = enemyLevel(dungeon, kind, depth, rng);
  const N = squadsOf(dungeon);
  // One enemy of this kind, at this depth (foeAt), not the same species as those in `others`.
  // (Lighter-armed early in the Labyrinth, bar mini bosses: LIGHT_GEAR.)
  const foe = (k: "easy" | "hard" | "camp" | "miniboss", others: Enemy[] = []) => {
    const e = makeEnemy(...foeAt(dungeon, k, depth, rng), others.map((e) => e.creatureId), rng, level);
    return dungeon <= 1 && k !== "miniboss" && !(dungeon === 0 && k === "camp") ? lightenGear(e, depth, rng) : e;
  };
  // n of them, no two the same species.
  const foes = (k: "easy" | "hard" | "camp" | "miniboss", n: number) => {
    const enemies: Enemy[] = [];
    for (let i = 0; i < n; i++) enemies.push(foe(k, enemies));
    return enemies;
  };
  switch (kind) {
    case "treasure":
      return { kind, gold: FIRST_TREASURE_GOLD, done: false };
    case "easy": {
      // 1–3 creatures (by depth; more in the Abyss: squadsOf): Commons in Common gear (Uncommons deeper).
      const [lo, hi] = depth <= FIRST_ROOMS ? N.first : depth <= EARLY_DEPTH || dungeon === 0 ? N.early : N.deep;
      const size = lo === hi ? lo : randInt(lo, hi, rng);
      const enemies = foes("easy", size);
      if (rng() < UPGRADE_CHANCE) upgradeAndDrop(enemies, rng);
      return { kind, enemies, level: dungeon <= 1 ? "easy" : "normal", gold: gold(EASY_GOLD), done: false };
    }
    case "hard": {
      // A single brute (two in the Abyss): Uncommon early on, then a Rare in Rare gear (an Epic in the Deep Labyrinth).
      const enemies = foes("hard", N.hard);
      return { kind, enemies, level: "normal", gold: gold(HARD_GOLD), done: false };
    }
    case "stash": {
      const potion = (): SackItem => ({ potion: rng() < STASH_POTION_CHANCE ? "potion" : "lesser" });
      const sack: SackItem[] = Array.from({ length: STASH_POTIONS }, potion);
      const last = rng();
      if (last < STASH_LAST_ROLL.potion) sack.push(potion());
      else if (last < STASH_LAST_ROLL.potion + STASH_LAST_ROLL.gold) sack.push({ gold: randInt(...STASH_GOLD, rng) });
      else {
        // Like a scan: any rarity at the usual odds; armour twice as likely as a weapon.
        sack.push({ gear: rollGearPiece(rng) });
      }
      sack.push(...toolFinds(STASH_TOOLS, rng));
      return { kind, sack, done: false };
    }
    case "miniboss": {
      // One tough creature (two in the Abyss): a Rare in Rare gear, played by the Hard AI.
      // Beat it and you can heal or revive one of your party.
      const enemies = foes("miniboss", N.miniboss);
      return { kind, enemies, level: "hard", gold: gold(MINIBOSS_GOLD), done: false };
    }
    case "merchant":
      return { kind, wares: rollWares(rng, backpack), bought: [], done: false };
    case "encampment": {
      // The Encampment's top room: its chief, alone, guarding the cages (put in as you walk in: enterRoom).
      if (dungeon === 0) {
        const chief = makeEnemy(...foeAt(0, "camp", depth, rng), [], rng, CAMP_CHIEF_LEVEL);
        return { kind, variant: "plain", enemies: [chief], cages: [], level: "hard", gold: gold(MINIBOSS_GOLD), done: false };
      }
      const variant = pick(ENCAMP_VARIANTS, rng);
      const enemies = foes("camp", variant === "ambush" ? N.ambush : randInt(...N.camp, rng));
      if (variant === "drunk") for (const e of enemies) e.hpMult = ENCAMP_DRUNK_HP;
      const cages: Cage[] = Array.from({ length: randInt(...ENCAMP_CAGES, rng) }, () =>
        (rng() < CAGE_CREATURE_CHANCE ? { creatureId: pickCreatureId(pickRarity("", "random")) } : {}));
      return { kind, variant, enemies, cages, level: "normal", gold: gold(ENCAMP_GOLD), done: false };
    }
    case "library": {
      if (rng() < LIBRARY_FIND) {
        const sack: SackItem[] = Array.from({ length: randInt(...LIBRARY_CODEXES, rng) }, () =>
          ({ gear: codexDrop(rng() < CYCLOPS_RACE_CODEX ? randomCodexMove() : randomLearnableMove()) }));
        return { kind, sack, done: false };
      }
      const books = [...RACE_CODEX_MOVES, ...LEARNABLE_MOVES].map((m) => m.name);
      const offers: string[] = [];
      while (offers.length < Math.min(LIBRARY_BOOKS, books.length)) offers.push(books.splice(Math.floor(rng() * books.length), 1)[0]);
      return { kind, librarian: true, offers, bought: [], done: false };
    }
    case "storehouse": {
      const sack: SackItem[] = [
        ...Array.from({ length: randInt(...STOREHOUSE_MATERIALS, rng) }, () => ({ gear: materialBundle(weighted(STORE_RARITY, rng), rng) })),
        ...Array.from({ length: randInt(...STOREHOUSE_POTIONS, rng) }, (): SackItem => ({ potion: rng() < STASH_POTION_CHANCE ? "potion" : "lesser" })),
        ...(rng() < STOREHOUSE_FINDS.weapon ? [{ gear: weaponDrop(pick(ITEM_KEYS, rng), pickRarity("", "random")) }] : []),
        ...(rng() < STOREHOUSE_FINDS.flare ? [{ gear: toolDrop("flare") }] : []),
        ...(rng() < STOREHOUSE_FINDS.clairvoyance ? [{ gear: toolDrop("clairvoyance") }] : []),
        ...(backpack && rng() < STOREHOUSE_BACKPACK ? [{ backpack: true as const }] : []),
      ];
      if (rng() >= STOREHOUSE_GUARD || !minibossAllowed(dungeon, depth)) return { kind, sack, done: false };
      const enemies = foes("miniboss", N.miniboss);
      return { kind, guarded: true, sack, enemies, level: "hard", gold: gold(MINIBOSS_GOLD), done: false };
    }
    case "witch":
      return { kind, witch: newWitchGame(rng, witchPrize), done: false };
    case "boss":
      // Dungeon 1: the Cyclops; the Deep Labyrinth: the Hydra (lib/creatures/bosses.ts, lib/combat/bossAi.ts).
      if (dungeon === 1) return { kind, boss: "cyclops", gold: gold(BOSS_GOLD), done: false };
      if (dungeon === 2) return { kind, boss: "hydra", gold: gold(BOSS_GOLD), done: false };
      // The Abyss: the Warden (a Legendary) and his Epic guards.
      return { kind, enemies: wardenPack(rng, dungeon), level: "hard", gold: gold(BOSS_GOLD), done: false };
    case "librarian": {
      // A few different codexes, each for a different race.
      const offers: string[] = [];
      while (offers.length < Math.min(LIBRARIAN_OFFERS, RACE_CODEX_MOVES.length)) {
        const m = pick(RACE_CODEX_MOVES, rng).name;
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

// The witch's curse: a creature loses ILLNESS_DAMAGE of its max HP for each
// of the next ILLNESS_ACTIONS actions (each room you walk into, each round
// of a fight).
export const ILLNESS_DAMAGE = 0.15;
export const ILLNESS_ACTIONS = 3;
export type Illness = { id: string; left: number };

export type DungeonRun = {
  id: string;
  dungeon?: DungeonId;         // which dungeon (missing = 1)
  lastOnField?: string;        // the creature on the field when the last fight ended
  illness?: Illness;           // a creature the witch stabbed
  runNumber: number;           // 1 = your first ever run
  startedAt: string;
  party: string[];             // creature drop ids (1 to PARTY_SIZE)
  team: string[];              // the ones that fight (up to teamSize)
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
  lit?: string[];              // rooms a flare or a clairvoyance scroll lit up (see knownRooms)
  seen?: string[];             // rooms a clairvoyance scroll looked into
  scrollLooks?: number;        // times the Scroll button was used (missing = 0; see SCROLL_LOOKS)
  status: RunStatus;
  bindle?: boolean;            // you set out on the bindle: merchants and storehouses have the backpack
  campCages?: Cage[];          // the Encampment: its chief's cages (campCages)
};

// The room at the top: the boss's lair, or the Encampment's camp. Finishing it ends the run, cleared.
export const atTheTop = (run: DungeonRun) => run.current?.kind === "boss" || (dungeonOf(run) === 0 && run.current?.kind === "encampment");

// dynamite: Klutz's dynamite quest wants its storehouse (lib/tavern.ts: wantsStorehouse).
// bindle: you're still on the bindle (see onBindle).
// cages: the Encampment's (campCages).
export function startRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number, rng: Rng = Math.random, dungeon: DungeonId = 1, dynamite = false, bindle = false, cages?: Cage[]): DungeonRun {
  // The very first run opens in a treasure room; otherwise at an empty entrance.
  const first = runNumber === 1 && dungeon === 1;
  const map = rollMap(first, rng, DUNGEONS[dungeon].spec, dungeon, dynamite);
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(), ...(dungeon !== 1 ? { dungeon } : {}),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: first ? 1 : 0, map,
    path: [map.start],
    cleared: first ? [] : [map.start],
    current: first ? makeRoom("treasure", rng) : null,
    loot: [], status: "exploring", inside: false, ...(bindle ? { bindle } : {}), ...(cages ? { campCages: cages } : {}),
  };
}

// The first quest's run (lib/quest.ts): the short questMap, starting at the
// entrance. What's in its two rooms is set as you walk in (the club, then
// the thief).
export function startQuestRun(party: string[], team: string[], hp: Record<string, number>, runNumber: number): DungeonRun {
  const map = questMap();
  return {
    id: crypto.randomUUID(), runNumber, startedAt: new Date().toISOString(),
    party: [...party], team: [...team], hp: Object.fromEntries(party.map((id) => [id, hp[id] ?? 1])),
    room: 0, map, path: [map.start], cleared: [map.start], current: null,
    loot: [], status: "exploring", inside: false,
  };
}

// Put the map away and step into the first room. Only the team goes in (the
// rest of the party waits in the Den): no swapping creatures in after this.
export function stepInside(run: DungeonRun): DungeonRun {
  const team = fightingTeam(run);
  return { ...run, inside: true, party: team, team, hp: Object.fromEntries(team.map((id) => [id, run.hp[id]])) };
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
  const rolled = makeRoom(node.kind, rng, routeLength(run.map, node.id), dungeonOf(run), !!run.bindle);
  const room = dungeonOf(run) === 0 && node.id === run.map.boss ? { ...rolled, cages: run.campCages ?? [] } : rolled;
  return { ...run, path: [...run.path, node.id], current: node.dynamite ? { ...room, dynamite: true } : room, room: run.room + 1 };
}

// Klutz's dynamite, in its storehouse: there to take once any guard is beaten.
export const dynamiteHere = (r: Room | null) => !!r?.dynamite && (!hasFight(r) || r.done);
export function takeDynamite(run: DungeonRun): DungeonRun {
  if (!dynamiteHere(run.current)) return run;
  return { ...run, current: { ...run.current!, dynamite: false } };
}

// Rooms you can walk out of without doing anything (and the large rooms
// with no fight waiting: a library, an unguarded storehouse, an encampment
// that looks empty).
const SKIPPABLE: RoomKind[] = ["pool", "stash", "merchant", "librarian", "witch", "library", "storehouse", "encampment"];

// Can you take a tunnel out of here yet? Not until the room is dealt with.
export const canMoveOn = (run: DungeonRun) =>
  run.status === "exploring" && (!run.current || run.current.done || (SKIPPABLE.includes(run.current.kind) && !hasFight(run.current)));

// Take a tunnel: finish this room and walk into the next.
export function moveOn(run: DungeonRun, nodeId: string, rng: Rng = Math.random): DungeonRun {
  if (!canMoveOn(run) || atTheTop(run)) return run;
  const next = enterRoom(leaveRoom(run), nodeId, rng);
  return next.path.length > run.path.length ? next : run;
}

// The current room is finished: it's cleared, and you choose where to go.
export function leaveRoom(run: DungeonRun): DungeonRun {
  if (!run.current) return run;
  if (atTheTop(run)) return { ...run, current: { ...run.current, done: true }, status: "cleared", battle: undefined };
  return { ...run, current: null, battle: undefined, cleared: [...new Set([...run.cleared, runPosition(run)])] };
}

// Any time you're not mid-fight (between rooms, or after seeing who's in a
// room but before you start the fight). Only creatures still standing can
// fight. Order matters: the first one leads.
export function setTeam(run: DungeonRun, team: string[]): DungeonRun {
  if (run.battle || run.status !== "exploring") return run;
  const valid = team.filter((id) => run.party.includes(id) && isAlive(run, id)).slice(0, teamSize(run));
  // Anyone knocked out keeps their place (behind the rest, if there's room),
  // so a healing pool can bring them back into the fight.
  const downed = run.team.filter((id) => !valid.includes(id) && run.party.includes(id) && !isAlive(run, id));
  return { ...run, team: [...valid, ...downed].slice(0, teamSize(run)) };
}

// A healing pool restores one creature fully. One that had dropped out of
// the team (knocked out) rejoins it if there's a free place.
export function healInPool(run: DungeonRun, id: string): DungeonRun {
  if (!run.party.includes(id)) return run;
  const team = run.team.includes(id) || run.team.length >= teamSize(run) ? run.team : [...run.team, id];
  return { ...run, hp: { ...run.hp, [id]: 1 }, team };
}

// The fighting team, minus anyone knocked out.
export const fightingTeam = (run: DungeonRun) => run.team.filter((id) => isAlive(run, id));

// Nobody left standing (outside a fight: a lost fight ends the run itself):
// the run is over, and you wake up in the Den.
export const wipedOut = (run: DungeonRun) =>
  run.status === "exploring" && !run.battle && run.party.length > 0 && run.party.every((id) => !isAlive(run, id));

// ── The witch's curse ────────────────────────────────────────────────
// Who she stabs: whoever was last on the field in a fight this run, or (no
// fight yet, or it's down) the first of your team.
export function stabTarget(run: DungeonRun): string | undefined {
  const last = run.lastOnField;
  if (last && run.party.includes(last) && isAlive(run, last)) return last;
  return fightingTeam(run)[0];
}
export function curse(run: DungeonRun): DungeonRun {
  const id = stabTarget(run);
  return id ? { ...run, illness: { id, left: ILLNESS_ACTIONS } } : run;
}
// One action passes (a room walked into): the sick creature loses its share.
// Returns the run and who was hurt (if anyone).
export function illnessTick(run: DungeonRun): { run: DungeonRun; hurt?: string } {
  const ill = run.illness;
  if (!ill || ill.left <= 0) return { run: { ...run, illness: undefined } };
  const left = ill.left - 1;
  const next = { ...run, illness: left > 0 ? { ...ill, left } : undefined };
  if (!isAlive(run, ill.id)) return { run: next };
  return { run: { ...next, hp: { ...run.hp, [ill.id]: Math.max(0, (run.hp[ill.id] ?? 1) - ILLNESS_DAMAGE) } }, hurt: ill.id };
}

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
  deepRuns?: number;                 // the Deep Labyrinth: runs started…
  deepClears?: number;               // …and its Warden beaten
  abyssRuns?: number;                // the Abyss: runs started…
  abyssClears?: number;              // …and its Warden beaten
  soakedAt?: string;                 // when the pool last healed the injured (ISO time)
  campRuns?: number;                 // the Encampment: runs started…
  campClears?: number;               // …and its chief beaten
};

// ── The healing pool (in the Den) ──────────────────────────────────
// Hurt creatures heal slowly in real time, on one clock for everyone: it
// keeps ticking whatever you're doing (a run in progress included). The
// creatures out on a run come home with their wounds from the run instead
// (endRun). Upgrades will come later; each level heals faster.
export const POOL_LEVELS = [
  { name: "Soggy cave pool", healPerHour: 0.25, desc: "A murky puddle in the rock. It heals, slowly." },
];
// Testing shortcut: everyone's back to full health as soon as you're home,
// instead of waiting on the pool. Turn off to bring the pool's slow healing back.
export const HEAL_AT_HOME = true;
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
    const soaked = soak(loaded.meta);
    const save: DungeonSave = { ...loaded, meta: HEAL_AT_HOME ? { ...soaked, injuries: {} } : soaked };
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
export const freeHealing = (meta: DungeonMeta) => HEAL_AT_HOME || meta.clears === 0;

// The run is over (any way): bring the hurt creatures home.
export function endRun(save0: DungeonSave, now = Date.now()): DungeonSave {
  const run = save0.run;
  if (!run) return save0;
  // The pool catches up first (everyone left at home has been healing all along).
  const save = { ...save0, meta: soak(save0.meta, now) };
  const injuries = { ...save.meta.injuries };
  const healed = freeHealing(save.meta);
  for (const id of run.party) {
    if (!healed && (run.hp[id] ?? 1) < 1) injuries[id] = run.hp[id];
    else delete injuries[id];
  }
  const cleared = run.status === "cleared";
  if (dungeonOf(run) === 0) {
    return { meta: { ...save.meta, injuries, campClears: (save.meta.campClears ?? 0) + (cleared ? 1 : 0) }, run: null };
  }
  if (dungeonOf(run) === 2) {
    return { meta: { ...save.meta, injuries, deepClears: (save.meta.deepClears ?? 0) + (cleared ? 1 : 0) }, run: null };
  }
  if (dungeonOf(run) === 3) {
    return { meta: { ...save.meta, injuries, abyssClears: (save.meta.abyssClears ?? 0) + (cleared ? 1 : 0) }, run: null };
  }
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
  writeSaveField(SAVE_FIELD, undefined);
}
