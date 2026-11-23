// lib/pvp/rivalSim.ts
// Making the ranked ladder's rivals (docs/design/online.md §12; the user,
// 2026-11-24: "create 7 fake players ... run the game naturally"): a seeded
// player plays the game's own rules from the start. It takes its first scans
// (the ten calibration ones, then more as it goes), walks the dungeons in
// order on the scroll map (the Encampment, the Cyclops, then the Hydra),
// fights what's in each room with the real battle engine (its own moves
// picked by the Normal AI, the foes by theirs), heals at pools, drinks
// potions, carries home what its bag holds, then at home puts on the gear
// that suits each creature, learns the codexes that fit, summons from
// cards and sells what it won't wear. It stops once it has played about as
// far as the user's test account had on 2026-11-24 (TARGET: one Hydra
// clear, about 25 runs, 36 to 50 scans).
//
// Klutz goes too (the user, 2026-11-24: "Klutz is a core part"): between runs
// the rival sends him to the furthest dungeon it has beaten, with the real
// trip rules (lib/klutz.ts), spends his points and skills as he levels,
// gears him and teaches him codexes nobody else wants, and empties his pack
// into its bag when he's back. A sim clock runs (each run's estimated time,
// and a night's break every SESSION_RUNS runs) so his trips and healing take
// the time they take. He isn't in its PvP teams.
//
// What it leaves out (so it stays small): the campaign's rewards, the Den's
// building, the witch's game, the tavern, bag upgrades beyond the backpack,
// and merchants beyond potions. The walkable layouts aren't walked: the
// scroll map has the same rooms and foes.
//
// Each rival has a taste of its own (the user: melee attackers favour melee
// weapons and moves, hybrids may mix, some use utility), so seven seeds
// give seven different players. Everything random goes through one seeded
// dice (Math.random is swapped for it while a rival plays), so a seed
// always makes the same rival.
//
// Run by `npm run pvp:rivals` (tests/rivalSim.test.ts writes lib/pvp/rivals.json).

import type { CreatureOrItemDrop, Drop } from "../types";
import { isCreatureDrop, isItemDrop } from "../types";
import {
  CREATURE_BY_ID, MOVE_BY_NAME, MOVE_SLOTS, canLearnFromCodex, findCreatureTemplate, isSteadyMove, isUtility, movesAvailableTo,
  type CreatureTemplate, type Skill,
} from "../creatures/creatureData";
import { SPECIES_RACES } from "../creatures/racesV2";
import { addPlayerXp, addXp, canFind, impactsFromLog, shareXp, xpForEnemy, SCROLL_XP, MAX_LEVEL, type Progress } from "../creatures/levels";
import { fighterFor } from "../creatures/instance";
import { starterCreature } from "../creatures/starter";
import { CARDS_TO_SUMMON, makeCreatureDrop, summonFromCards } from "../creatures/summon";
import { bossTeam } from "../creatures/bosses";
import { creatureRoles } from "../creatures/creatureType";
import { NEW_FIRST_SCANS, calibrating, calibrationDrop, spendFirstScan, type FirstScans } from "../firstScans";
import { CHEST_ODDS, rollBarcodeOutcome } from "../barcodeRegistry";
import { scanDrop } from "../scanning";
import { armorDrop, codexDrop, dropFromOutcome, randomArmorSlot, randomCodexMove, scrollDrop, weaponDrop } from "../drops";
import { CHEST_ENCHANT, enchanted } from "../items/enchantments";
import { PRIMARY_STATS_BY_ITEMKEY } from "../items/itemPrimaries";
import { ARMOR_SLOTS, type ArmorSlot } from "../items/armor";
import type { ItemKey } from "../items/ceilings";
import { RARITIES } from "../items/gear";
import type { Rarity } from "../items/budgets";
import { computeSellGold } from "../items/economy/sell";
import { getStatCapForDrop } from "../items/gameHelpers";
import { createBattle } from "../combat/battle";
import type { AiLevel } from "../combat/thinkingAi";
import type { Fighter } from "../combat/engine";
import { playBattle, playRivalMatch } from "./rivalMatch";
import { ELO_START, eloUpdate } from "./elo";
import { RANKED_FORMATS } from "./ranked";
import {
  BACKPACK, BINDLE, BOSS_SCROLL_CHANCE, CHEST_CODEX_CHANCE, CHEST_DROPS, DUNGEONS, MINIBOSS_SCROLL_CHANCE, PARTY_SIZE, POTIONS,
  atTheTop, bossChest, bossLevel, bossLoot, campCages, codexPrice, droppedPieceStats, dungeonOf, enemyFighter, enterRoom, entryFee, fightEnemies,
  hasFight, healInPool, leaveRoom, minibossExtras, nextRooms, startRun, teamSize,
  type DungeonId, type DungeonMeta, type DungeonRun, type Room, type SackItem,
} from "../dungeon/run";
import type { Rival, RivalLoadout, RivalStats } from "./rivals";
import {
  KLUTZ_DESTS, NEW_KLUTZ, collectKlutz, destCost, destOpen, klutzGainXp, klutzProficiency, klutzStatus, pickTrait, canPickTrait, pointsFree, repairShack,
  sendKlutz, skillPointsFree, spendPoints, spendSkill, type KlutzDest, type KlutzState,
} from "../klutz";
import { KLUTZ } from "../creatures/creatureData";

// ── The target: about where the user's test account was (2026-11-24) ────
// A rival plays each dungeon until it has these clears (or has had these
// runs), then moves on; after a death it goes back a dungeon for a run, as
// a player does. Scans: the calibration ten first, then one most runs, and
// a batch once it's explorer Lv 12 (the user: "roughly 50 ... once level 12").
export const TARGET = {
  clears: { 0: 5, 1: 3, 2: 1 } as Record<DungeonId, number>,
  maxRuns: { 0: 9, 1: 16, 2: 12 } as Record<DungeonId, number>,
  scans: [36, 50] as [number, number],
  scanBatchAt: 12,
  totalRuns: 34,
};
// Their warm-up: battles among themselves before anyone meets them (the
// user, 2026-11-24), which set their first ratings (lib/pvp/elo.ts).
export const WARMUP_BATTLES = 10;
// Spare gear a rival keeps for the queues its best gear is too rare for (per creature and slot).
const SPARES_KEPT = 8;
export const RIVAL_NAMES = ["Blaze", "Cinder", "Dusk", "Ember", "Frost", "Gale", "Hollow"];
export const RIVAL_COUNT = RIVAL_NAMES.length;
// How well the rival plays its fights (the user: Normal walking the dungeons, Hard in PvP).
export const RIVAL_AI: AiLevel = "normal";
// Potions it carries at most, and when it drinks one (share of HP).
const POTIONS_MAX = 6, DRINK_AT = 0.45;
// Seconds of real play each thing stands for, to give a rival a play time (and to run Klutz's clock).
const SECONDS = { fight: 45, room: 12, scan: 25, home: 90 };
// A session is this many runs; then a night's break, while Klutz's trip goes on and he heals.
export const SESSION_RUNS = 5;
// XP scrolls go to Klutz until he's this level (lib/klutz.ts XP_SHARE: "so you use more books"), then to the team's lowest.
export const KLUTZ_SCROLLS_TO = 10;
const NIGHT_MS = 12 * 60 * 60 * 1000;
// Klutz's id in a save's equipment (hooks/useGameState.ts KLUTZ_DROP_ID; he isn't in the inventory).
const KLUTZ_ID = "klutz-companion";

type Rng = () => number;
const dice = (seed: number): Rng => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const order = (r?: Rarity) => RARITIES.indexOf(r ?? "common");
const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);

// A rival's taste: how it likes its moves and how careful it is.
export type Taste = {
  utility: number;  // 0..1: how much it values utility moves
  offStyle: number; // 0..1: how much a move of another style is worth to it (hybrids: more)
  caution: number;  // retreats when the team's HP share falls under this
  greed: number;    // 0..1: how far it goes out of its way for loot rooms
};
export const tasteFor = (rng: Rng): Taste => ({ utility: rng() * 0.6, offStyle: 0.35 + rng() * 0.45, caution: 0.25 + rng() * 0.25, greed: rng() });

type Sim = {
  name: string; seed: number; rng: Rng; taste: Taste;
  inventory: CreatureOrItemDrop[];
  equipment: Record<string, RivalLoadout>;
  gold: number; player: Progress;
  firstScans: FirstScans; scans: number; scanCodes: number;
  meta: DungeonMeta;
  potions: number;
  stats: RivalStats;
  log: string[];
  path: string[];
  klutz: KlutzState;
  klutzTrips: number;
  clock: number;      // the sim's time, ms (Klutz's trips and healing run on it)
  runsPlayed: number;
};

const creatures = (s: Sim) => s.inventory.filter(isCreatureDrop);
const items = (s: Sim) => s.inventory.filter(isItemDrop);
const templateOf = (d: CreatureOrItemDrop) => findCreatureTemplate(d.creatureId, d.name)!;
const power = (d: CreatureOrItemDrop) => (d.level ?? 1) * 10 + order(d.rarity) * 7;
// The creatures it fights with: the strongest, in order.
const roster = (s: Sim, n = PARTY_SIZE) => [...creatures(s)].sort((a, b) => power(b) - power(a)).slice(0, n);

// ── A new player ──────────────────────────────────────────────────────
export function newSim(seed: number, name: string): Sim {
  const rng = dice(seed);
  // (The starter rolls with the game's dice: this seed's, for the moment.)
  const real = Math.random;
  Math.random = rng;
  let starter: CreatureOrItemDrop;
  try { starter = starterCreature() as CreatureOrItemDrop; } finally { Math.random = real; }
  return {
    name, seed, rng, taste: tasteFor(rng),
    inventory: [starter], equipment: {}, gold: 0, player: { level: 1, xp: 0 },
    firstScans: { ...NEW_FIRST_SCANS }, scans: 0, scanCodes: 0,
    meta: { runs: 0, clears: 0, injuries: {}, bag: [], bagSize: BINDLE },
    potions: 0,
    stats: { scans: 0, runs: {}, clears: {}, fights: 0, wins: 0, playTime: 0, species: 0, gold: 0 },
    log: [], path: [],
    klutz: { ...NEW_KLUTZ }, klutzTrips: 0, clock: 1_700_000_000_000, runsPlayed: 0,
  };
}

// ── Klutz ─────────────────────────────────────────────────────────────
// Him as a creature of the rival's (for his gear, codexes and fights), as the game builds him.
const klutzDropOf = (s: Sim): CreatureOrItemDrop => ({
  id: KLUTZ_ID, barcode: "", dropType: "creature", creatureId: KLUTZ.id, rarity: KLUTZ.rarity, roll: 0, name: KLUTZ.name, desc: KLUTZ.flavour,
  level: s.klutz.level ?? 1, xp: s.klutz.xp ?? 0, proficiency: klutzProficiency(s.klutz.points), learned: s.klutz.learned, soulStone: s.klutz.soulStone ?? null,
  createdAt: new Date(s.clock).toISOString(),
});
const klutzFighterOf = (s: Sim) => fighterOf(s, klutzDropOf(s));

// Between runs: his pack emptied if he's back, his points and skills spent (a brawler: melee and melee
// defence; the Armourer and the Scholar; the Bigger Pack, then Selective), and off again to the furthest
// dungeon the rival has beaten, if he's fit and the fee's there.
function klutzStep(s: Sim) {
  let k = s.klutz;
  const maxHp = klutzFighterOf(s).maxHp;
  if (k.expedition && !k.expedition.collected && s.clock >= k.expedition.endsAt) {
    const r = collectKlutz(k, s.clock);
    k = r.state;
    s.klutzTrips++;
    for (const d of r.loot) take(s, d);
  }
  for (let n = pointsFree(k), i = 0; n > 0; n--, i++) k = spendPoints(k, i % 2 ? { mdef: 1 } : { atk: 1 });
  for (let n = skillPointsFree(k), i = 0; n > 0; n--, i++) k = spendSkill(k, i % 2 ? "scholar" : "armourer");
  for (const t of ["pack", "selective"] as const) if (canPickTrait(k, t)) k = pickTrait(k, t);
  s.klutz = k;
  if (klutzStatus(k, maxHp, s.clock).kind !== "home") return;
  const clears = { cyclops: s.stats.clears[1] ?? 0, hydra: s.stats.clears[2] ?? 0, abyss: 0 };
  const dests: KlutzDest[] = [2, 1, 0];
  const dest = dests.find((d) => destOpen(d, clears) && s.gold >= destCost(d) + 300);
  if (dest === undefined) return;
  s.gold -= destCost(dest);
  s.klutz = sendKlutz(k, klutzFighterOf(s), s.clock, s.rng, dest, s.player.level);
  void KLUTZ_DESTS;
}

// ── Scanning ──────────────────────────────────────────────────────────
// A barcode of its own each time (a sim player never rescans). Calibrating,
// the calibration finds; after, the registry's odds, and a creature too rare
// for its explorer level stays sealed (it scans something else instead).
export function simScan(s: Sim) {
  const code = `sim:${s.seed}:${++s.scanCodes}`;
  let drop: Drop | null = null;
  if (calibrating(s.firstScans)) {
    const owned = new Set(creatures(s).map((c) => c.creatureId!));
    drop = calibrationDrop(s.firstScans.used, s.firstScans.codes[0], owned, code, s.rng);
    s.firstScans = spendFirstScan(s.firstScans, code);
  } else {
    for (let tries = 0; tries < 20 && !drop; tries++) {
      const outcome = rollBarcodeOutcome();
      if (outcome.outcome === "creature" && !canFind(s.player.level, outcome.rarity)) continue;
      drop = scanDrop(outcome, code);
    }
  }
  s.scans++;
  s.stats.playTime += SECONDS.scan;
  if (drop) take(s, drop);
}

// Something found goes in the bag (gold in the purse, a potion in the flask rack).
function take(s: Sim, d: Drop) {
  if (d.dropType === "reward") { s.gold += d.amount; return; }
  if (d.potion) { s.potions = Math.min(POTIONS_MAX, s.potions + (d.potion === "potion" ? 2 : 1)); return; }
  if (d.material || d.tool || d.schematic) return; // (the Den's building is left out)
  s.inventory.push(d);
}
function takeSack(s: Sim, sack: SackItem[] | undefined) {
  for (const x of sack ?? []) {
    if ("gold" in x) s.gold += x.gold;
    else if ("potion" in x) s.potions = Math.min(POTIONS_MAX, s.potions + (x.potion === "potion" ? 2 : 1));
    else if ("backpack" in x) s.meta.bagSize = Math.max(s.meta.bagSize ?? BINDLE, BACKPACK);
    else take(s, x.gear);
  }
}

// ── Fighting ──────────────────────────────────────────────────────────
function fighterOf(s: Sim, d: CreatureOrItemDrop): Fighter {
  const byId = new Map(items(s).map((i) => [i.id, i]));
  const l = s.equipment[d.id] ?? {};
  const w = l.weaponId ? byId.get(l.weaponId) : undefined;
  const pieces = ARMOR_SLOTS.map((slot) => (l[SLOT_FIELD[slot]] ? byId.get(l[SLOT_FIELD[slot]]!) : undefined));
  return fighterFor(d, templateOf(d), w?.stats, pieces, l.moves, w?.itemKey as ItemKey | undefined, w);
}
const SLOT_FIELD: Record<ArmorSlot, "helmetId" | "chestId" | "legsId"> = { helmet: "helmetId", chest: "chestId", legs: "legsId" };

// The room's fight: who's standing from the run's HP shares, the foes as rolled. Returns the run after it.
function fightRoom(s: Sim, run: DungeonRun, room: Room): { run: DungeonRun; won: boolean } {
  const ids = run.team.filter((id) => (run.hp[id] ?? 0) > 0);
  const drops = ids.map((id) => s.inventory.find((d) => d.id === id) as CreatureOrItemDrop);
  // A potion first for anyone badly hurt.
  for (const id of ids) {
    if (s.potions > 0 && (run.hp[id] ?? 1) < DRINK_AT) { s.potions--; run = { ...run, hp: { ...run.hp, [id]: Math.min(1, run.hp[id] + POTIONS.lesser.heal / Math.max(1, fighterOf(s, s.inventory.find((d) => d.id === id) as CreatureOrItemDrop).maxHp)) } }; }
  }
  const A = drops.map((d) => fighterOf(s, d));
  const dungeon = dungeonOf(run);
  const B = room.boss ? bossTeam(room.boss, bossLevel(dungeon)) : fightEnemies(room).map(enemyFighter);
  const start = createBattle(A, B, { A: A.map((f, i) => Math.round(f.maxHp * (run.hp[ids[i]] ?? 1))) }, room.boss);
  const end = playBattle(start, RIVAL_AI, room.level ?? "hard");
  s.stats.fights++;
  s.stats.playTime += SECONDS.fight;
  const hp = { ...run.hp };
  end.sides.A.team.forEach((f, i) => { hp[ids[i]] = Math.max(0, f.hp / f.maxHp); });
  const won = end.winner === "A";
  if (!won) return { run: { ...run, hp, status: "dead" }, won };
  s.stats.wins++;
  // XP as the Labyrinth pays it (app/dungeon/page.tsx): every foe knocked out, shared by what each did; the explorer gets all of it.
  const xp = end.sides.B.team.reduce((t, f, i) => {
    if (f.hp > 0) return t;
    if (room.boss) return t + bossLoot(dungeon).partXp;
    const e = fightEnemies(room)[i];
    return t + (e ? xpForEnemy(e.level ?? 15, CREATURE_BY_ID[e.creatureId].rarity) : 0);
  }, 0);
  if (xp > 0) {
    const impacts = impactsFromLog(end.log, "A", ids.length).map((im, i) => ({ ...im, maxed: (drops[i].level ?? 1) >= MAX_LEVEL }));
    const shares = shareXp(xp, impacts);
    ids.forEach((id, i) => {
      const d = s.inventory.find((x) => x.id === id) as CreatureOrItemDrop;
      const p = addXp({ level: d.level ?? 1, xp: d.xp ?? 0 }, shares[i]);
      d.level = p.level; d.xp = p.xp;
    });
    s.player = addPlayerXp(s.player, xp);
  }
  // Its loot: the room's gold, any piece a foe drops, and what a boss's or mini boss's chest holds.
  s.gold += room.gold ?? 0;
  for (const e of room.enemies ?? []) for (const p of e.gear) {
    if (!p.drops) continue;
    const slot = p.dropSlot ?? randomArmorSlot();
    take(s, p.slot === "weapon" ? weaponDrop(p.key as ItemKey, p.rarity, "", p.stats) : armorDrop(p.key as ArmorKey_, p.rarity, "", droppedPieceStats(p, slot), slot));
  }
  const miniboss = room.kind === "miniboss" || (room.kind === "storehouse" && !!room.guarded) || (dungeon === 0 && room.kind === "encampment");
  if (room.kind === "boss") takeSack(s, bossChest(dungeon));
  else if (miniboss) takeSack(s, minibossExtras());
  if (Math.random() < (room.kind === "boss" ? BOSS_SCROLL_CHANCE : miniboss ? MINIBOSS_SCROLL_CHANCE : 0)) take(s, scrollDrop());
  if (room.boss === "cyclops") s.meta.bagSize = Math.max(s.meta.bagSize ?? BINDLE, BACKPACK);
  return { run: { ...run, hp }, won };
}
type ArmorKey_ = Parameters<typeof armorDrop>[0];

// ── A room, once any fight's won ──────────────────────────────────────
function lootRoom(s: Sim, run: DungeonRun, room: Room): DungeonRun {
  switch (room.kind) {
    case "treasure": s.gold += room.gold ?? 0; break;
    case "chest": {
      // Barcode-style drops, as the screen rolls them (app/dungeon/page.tsx openChest).
      const drops: Drop[] = [];
      while (drops.length < CHEST_DROPS) { const d = enchanted(dropFromOutcome(rollBarcodeOutcome(CHEST_ODDS)), CHEST_ENCHANT); if (d) drops.push(d); }
      if (Math.random() < CHEST_CODEX_CHANCE) drops[drops.length - 1] = codexDrop(randomCodexMove());
      for (const d of drops) take(s, d);
      break;
    }
    case "pool": {
      // The most hurt creature is healed.
      const hurt = run.team.filter((id) => (run.hp[id] ?? 1) < 1).sort((a, b) => (run.hp[a] ?? 1) - (run.hp[b] ?? 1));
      if (hurt[0]) run = healInPool(run, hurt[0]);
      break;
    }
    case "library": case "librarian": {
      takeSack(s, room.sack);
      // A codex for sale that someone on the team could learn, if the gold's there (keeping the next entry fee).
      const fee = 200;
      for (const move of room.offers ?? []) {
        if (s.gold < codexPrice(move) + fee) continue;
        if (!roster(s).some((c) => wouldLearn(s, c, move))) continue;
        s.gold -= codexPrice(move);
        take(s, codexDrop(move));
        break;
      }
      break;
    }
    case "merchant": {
      // Potions, two at a time, when it can afford them.
      while (s.potions < 2 && s.gold >= POTIONS.lesser.price + 200) { s.gold -= POTIONS.lesser.price; s.potions++; }
      break;
    }
    case "cards": for (const id of room.deck ?? []) take(s, makeCreatureDrop(CREATURE_BY_ID[id], "card", "")); break;
    case "encampment": {
      for (const c of room.cages ?? []) if (c.creatureId) take(s, { ...makeCreatureDrop(CREATURE_BY_ID[c.creatureId], "creature", ""), ...(c.level ? { level: c.level, xp: 0 } : {}) });
      break;
    }
    default: takeSack(s, room.sack); takeSack(s, room.crates?.flat());
  }
  return run;
}

// Where to go next: what the scroll shows of each way on, by what the rival
// wants (a pool when hurt, loot when greedy, fights it can take), with a
// little whim. A room marked "?" is a guess.
function chooseWay(s: Sim, run: DungeonRun): string {
  const ways = nextRooms(run);
  const hurt = run.team.some((id) => (run.hp[id] ?? 1) < 0.6);
  const strong = run.team.every((id) => (run.hp[id] ?? 1) > 0.7);
  const want: Partial<Record<Room["kind"], number>> = {
    pool: hurt ? 9 : 1, chest: 5 + 3 * s.taste.greed, stash: 4 + 3 * s.taste.greed, treasure: 6, library: 4 + s.taste.greed, librarian: 3,
    merchant: s.potions < 2 ? 5 : 1, cards: 3 + s.taste.greed, easy: 3, hard: strong ? 4 : 1.5, miniboss: strong ? 4.5 : 1, storehouse: 4, stockroom: 3,
    encampment: 3, witch: 1, empty: 1, boss: 3, entrance: 0,
  };
  const scored = ways.map((n) => ({ id: n.id, score: (n.mystery ? 3 : want[n.kind] ?? 2) + s.rng() * 2 }));
  return scored.sort((a, b) => b.score - a.score)[0].id;
}

// ── A run ─────────────────────────────────────────────────────────────
export function simRun(s: Sim, dungeon: DungeonId): "cleared" | "dead" | "retreated" | "skipped" {
  const fee = entryFee(dungeon, s.meta);
  if (s.gold < fee) return "skipped";
  s.gold -= fee;
  const team = roster(s, teamSize({ dungeon })).map((d) => d.id);
  const party = team;
  const runs = (s.stats.runs[dungeon] = (s.stats.runs[dungeon] ?? 0) + 1);
  if (dungeon === 0) s.meta.campRuns = (s.meta.campRuns ?? 0) + 1;
  else if (dungeon === 2) s.meta.deepRuns = (s.meta.deepRuns ?? 0) + 1;
  else s.meta.runs++;
  const cages = dungeon === 0 ? campCages(runs === 1, [...new Set(creatures(s).flatMap((c) => SPECIES_RACES[c.creatureId!] ?? []))]) : undefined;
  let run = startRun(party, team, {}, s.meta.runs + (s.meta.campRuns ?? 0) + (s.meta.deepRuns ?? 0), Math.random, dungeon, false, (s.meta.bagSize ?? BINDLE) < BACKPACK, cages);
  const bagBefore = s.inventory.length, timeBefore = s.stats.playTime;
  for (let guard = 0; run.status === "exploring" && guard < 80; guard++) {
    if (!run.current) {
      // Hurt and no potions: home, unless the top's a step away.
      const share = run.team.reduce((t, id) => t + (run.hp[id] ?? 0), 0) / run.team.length;
      if (share < s.taste.caution && s.potions === 0 && run.room > 2) { run = { ...run, status: "retreated" }; break; }
      const ways = nextRooms(run);
      if (ways.length === 0) { run = { ...run, status: "retreated" }; break; }
      run = enterRoom(run, chooseWay(s, run));
      s.stats.playTime += SECONDS.room;
      continue;
    }
    const room = run.current;
    if (hasFight(room) && !room.done) {
      const r = fightRoom(s, run, room);
      run = r.run;
      if (!r.won) break;
    }
    run = lootRoom(s, run, room);
    run = leaveRoom({ ...run, current: run.current ? { ...run.current, done: true } : null });
    if (run.status === "cleared") break;
  }
  // The bag: what it can carry home of the run's finds (the rarest first); the rest stays on the floor.
  const found = s.inventory.slice(bagBefore).filter((d) => d.dropType !== "creature");
  const room = s.meta.bagSize ?? BINDLE;
  if (found.length > room) {
    const keep = new Set([...found].sort((a, b) => order(b.rarity) - order(a.rarity)).slice(0, room).map((d) => d.id));
    s.inventory = s.inventory.filter((d, i) => i < bagBefore || d.dropType === "creature" || keep.has(d.id));
  }
  const cleared = run.status === "cleared" || atTheTop(run) && run.status !== "dead";
  if (cleared) s.stats.clears[dungeon] = (s.stats.clears[dungeon] ?? 0) + 1;
  if (cleared && dungeon === 0 && s.klutz.shack) s.klutz = repairShack(s.klutz); // (the shack's mended once the camp's beaten: planks and nails from the runs)
  const out = cleared ? "cleared" : run.status === "dead" ? "dead" : "retreated";
  s.log.push(`${DUNGEONS[dungeon].name}: ${out} after ${run.room} rooms`);
  s.path.push(`${"ECH"[dungeon] ?? dungeon}:${out}:${run.room}:L${s.player.level}`);
  // The clock: the run's time, and a night's break at each session's end.
  s.clock += (s.stats.playTime - timeBefore) * 1000;
  if (++s.runsPlayed % SESSION_RUNS === 0) s.clock += NIGHT_MS;
  return out;
}

// ── At home ───────────────────────────────────────────────────────────
// A move's worth to a creature: its damage, more in its own style and its own
// race, less (by taste) in another's; utility moves by taste.
function moveScore(s: Sim, t: CreatureTemplate, d: CreatureOrItemDrop, m: Skill): number {
  const races = SPECIES_RACES[t.id] ?? [];
  const roles = creatureRoles(d.proficiency ?? t.proficiency);
  const hybrid = roles.includes("Hybrid") || roles.includes("Balanced");
  if (isUtility(m)) return 6 + 14 * s.taste.utility;
  const own = m.type === t.cls || hybrid;
  const base = (m.damage * (m.mult ?? 1)) * (own ? 1 : s.taste.offStyle);
  const race = m.race && races.includes(m.race) ? 1.25 : 1;
  return base * race + (isSteadyMove(m) ? 2 : 0);
}

// Would learning this move put it in the creature's four?
function wouldLearn(s: Sim, d: CreatureOrItemDrop, move: string): boolean {
  const t = templateOf(d);
  if (!canLearnFromCodex(t, move) || d.learned?.includes(move) || !MOVE_BY_NAME[move]) return false;
  const have = movesAvailableTo(t, d.learned ?? [], d.moves).map((m) => moveScore(s, t, d, m)).sort((a, b) => b - a);
  const score = moveScore(s, t, d, MOVE_BY_NAME[move]);
  return have.length < MOVE_SLOTS || score > have[MOVE_SLOTS - 1];
}

// Its four moves: the best by score, always with a steady one.
function chooseMoves(s: Sim, d: CreatureOrItemDrop): string[] {
  const t = templateOf(d);
  const all = movesAvailableTo(t, d.learned ?? [], d.moves);
  const best = [...all].sort((a, b) => moveScore(s, t, d, b) - moveScore(s, t, d, a)).slice(0, MOVE_SLOTS);
  if (!best.some(isSteadyMove)) {
    const steady = all.filter(isSteadyMove).sort((a, b) => moveScore(s, t, d, b) - moveScore(s, t, d, a))[0];
    if (steady) best[best.length - 1] = steady;
  }
  return best.map((m) => m.name);
}

// Gear's worth to a creature: rarity first, then its numbers; a weapon of its own style is worth more.
const fitsStyle = (w: CreatureOrItemDrop, t: CreatureTemplate) => !!w.itemKey && (PRIMARY_STATS_BY_ITEMKEY[w.itemKey as ItemKey] as readonly string[]).includes(t.cls);
const gearScore = (g: CreatureOrItemDrop, t: CreatureTemplate, setWith?: string) =>
  order(g.rarity) * 10 + sum(g.stats) / 40 + (g.itemCategory === "weapon" ? (fitsStyle(g, t) ? 6 : 0) : g.armorKey && g.armorKey === setWith ? 3 : 0);

export function goHome(s: Sim) {
  s.stats.playTime += SECONDS.home;
  s.clock += SECONDS.home * 1000;
  klutzStep(s);
  // Cards: three of a kind summon the creature.
  for (;;) {
    const cards = s.inventory.filter((d) => d.dropType === "card");
    const by = new Map<string, CreatureOrItemDrop[]>();
    for (const c of cards) by.set(c.creatureId!, [...(by.get(c.creatureId!) ?? []), c]);
    const three = [...by.values()].find((xs) => xs.length >= CARDS_TO_SUMMON);
    if (!three) break;
    const used = three.slice(0, CARDS_TO_SUMMON);
    s.inventory = s.inventory.filter((d) => !used.includes(d));
    s.inventory.push(summonFromCards(used, null));
  }
  const team = roster(s, PARTY_SIZE + 2);
  // Loose soul stones go in a creature without one (the rarest first).
  for (const stone of items(s).filter((d) => d.stone)) {
    const to = team.find((c) => !c.soulStone && order(c.rarity) >= 2);
    if (!to) break;
    to.soulStone = stone.stone;
    s.inventory = s.inventory.filter((d) => d !== stone);
  }
  // XP scrolls: read to Klutz till he's KLUTZ_SCROLLS_TO, then to the team's lowest.
  for (const scroll of items(s).filter((d) => d.scroll)) {
    if ((s.klutz.level ?? 1) < KLUTZ_SCROLLS_TO) {
      s.klutz = klutzGainXp(s.klutz, SCROLL_XP).state;
    } else {
      const to = [...team].sort((a, b) => (a.level ?? 1) - (b.level ?? 1))[0];
      const p = addXp({ level: to.level ?? 1, xp: to.xp ?? 0 }, SCROLL_XP);
      to.level = p.level; to.xp = p.xp;
    }
    s.inventory = s.inventory.filter((d) => d !== scroll);
  }
  // Codexes: taught to whoever on the team they'd help most; one nobody wants goes to Klutz, who can learn any.
  const klutz = klutzDropOf(s);
  for (const codex of items(s).filter((d) => d.codexMove)) {
    const move = codex.codexMove!;
    const to = team.filter((c) => wouldLearn(s, c, move)).sort((a, b) => moveScore(s, templateOf(b), b, MOVE_BY_NAME[move]) - moveScore(s, templateOf(a), a, MOVE_BY_NAME[move]))[0]
      ?? (wouldLearn(s, klutz, move) ? klutz : undefined);
    if (!to) continue;
    to.learned = [...(to.learned ?? []), move];
    if (to === klutz) s.klutz = { ...s.klutz, learned: klutz.learned };
    s.inventory = s.inventory.filter((d) => d !== codex);
  }
  // Gear: the team, strongest first, each takes the best of what's not worn by someone above it; Klutz after them.
  const worn = new Set<string>();
  for (const c of [...team, klutz]) {
    const t = templateOf(c);
    const l: RivalLoadout = { ...(s.equipment[c.id] ?? {}) };
    const free = items(s).filter((g) => !worn.has(g.id));
    const weapon = free.filter((g) => g.itemCategory === "weapon" && g.itemKey !== "klutz_club").sort((a, b) => gearScore(b, t) - gearScore(a, t))[0];
    if (weapon) { l.weaponId = weapon.id; worn.add(weapon.id); } else delete l.weaponId;
    const current = ARMOR_SLOTS.map((slot) => items(s).find((g) => g.id === l[SLOT_FIELD[slot]])?.armorKey);
    const setWith = current.filter(Boolean).sort((a, b) => current.filter((k) => k === b).length - current.filter((k) => k === a).length)[0];
    for (const slot of ARMOR_SLOTS) {
      const piece = free.filter((g) => g.itemCategory === "armor" && g.armorSlot === slot && !worn.has(g.id)).sort((a, b) => gearScore(b, t, setWith) - gearScore(a, t, setWith))[0];
      if (piece) { l[SLOT_FIELD[slot]] = piece.id; worn.add(piece.id); } else delete l[SLOT_FIELD[slot]];
    }
    l.moves = chooseMoves(s, c);
    s.equipment[c.id] = l;
  }
  // Sells gear it won't wear: below the plainest piece the team has on. (Codexes nobody can learn too.)
  const floor = Math.min(...[...worn].map((id) => order(items(s).find((g) => g.id === id)?.rarity)), 4);
  for (const g of items(s)) {
    if (worn.has(g.id)) continue;
    const junkGear = (g.itemCategory === "weapon" || g.itemCategory === "armor") && order(g.rarity) < floor;
    const deadCodex = !!g.codexMove && !creatures(s).some((c) => canLearnFromCodex(templateOf(c), g.codexMove!));
    if (!junkGear && !deadCodex) continue;
    s.gold += junkGear ? computeSellGold({ drop: g as never, getStatCapForDrop: (d, k) => getStatCapForDrop(d as Drop, k) ?? 0 }) : Math.floor(codexPrice(g.codexMove!) / 2);
    s.inventory = s.inventory.filter((d) => d !== g);
  }
  s.stats.species = new Set(creatures(s).map((c) => c.creatureId)).size;
  s.stats.scans = s.scans;
  s.stats.gold = s.gold;
}

// ── A whole player ────────────────────────────────────────────────────
// Where it plays next: the first dungeon it hasn't got the target's clears
// in (within its runs); back a dungeon for a run after a death, as a player
// would, and when it can't pay the fee.
function nextDungeon(s: Sim, lastDied: boolean): DungeonId | null {
  const dungeons: DungeonId[] = [0, 1, 2];
  const room = (d: DungeonId) => (s.stats.runs[d] ?? 0) < TARGET.maxRuns[d];
  const open = dungeons.find((d) => (s.stats.clears[d] ?? 0) < TARGET.clears[d] && room(d));
  if (open === undefined) return null;
  const back = dungeons[Math.max(0, dungeons.indexOf(open) - 1)];
  if (back !== open && room(back) && ((lastDied && s.rng() < 0.6) || s.gold < entryFee(open, s.meta))) return back;
  return open;
}

export function simulateRival(seed: number, name: string, onLog?: (line: string) => void): Rival {
  const real = Math.random;
  const s = newSim(seed, name);
  Math.random = s.rng;
  try {
    const scansWanted = TARGET.scans[0] + Math.floor(s.rng() * (TARGET.scans[1] - TARGET.scans[0] + 1));
    const firstBatch = 10;
    for (let i = 0; i < firstBatch; i++) simScan(s);
    goHome(s);
    let died = false, total = 0, batched = false;
    for (; total < TARGET.totalRuns; total++) {
      const d = nextDungeon(s, died);
      if (d === null) break;
      const out = simRun(s, d);
      died = out === "dead";
      if (out === "skipped") { simScan(s); goHome(s); continue; }
      // A scan most times home, while they last; the batch once it's an explorer of TARGET.scanBatchAt.
      if (s.scans < Math.min(scansWanted, 36) && s.rng() < 0.8) simScan(s);
      if (!batched && s.player.level >= TARGET.scanBatchAt) { batched = true; while (s.scans < scansWanted) simScan(s); }
      goHome(s);
      onLog?.(`${name}: ${s.log[s.log.length - 1]} · explorer ${s.player.level} · ${s.gold}g · ${s.scans} scans`);
    }
    while (s.scans < scansWanted) simScan(s);
    goHome(s);
  } finally {
    Math.random = real;
  }
  return toRival(s);
}

// The rival as the game keeps it: its creatures, what they wear (and some
// spare gear within Rare, for the 3v3 queue), and its numbers.
function toRival(s: Sim): Rival {
  const keep = roster(s, 9);
  // (A creature below the team may remember gear it wore before someone better took it, or it was sold: cleaned off.)
  const have = new Set(items(s).map((g) => g.id));
  const claimed = new Set<string>();
  const equipment: Record<string, RivalLoadout> = {};
  for (const c of keep) {
    const l: RivalLoadout = { ...(s.equipment[c.id] ?? {}) };
    for (const k of ["weaponId", "helmetId", "chestId", "legsId"] as const) {
      const id = l[k];
      if (!id) continue;
      if (!have.has(id) || claimed.has(id)) delete l[k]; else claimed.add(id);
    }
    equipment[c.id] = l;
  }
  const wornIds = claimed;
  const spares = items(s).filter((g) => !wornIds.has(g.id) && (g.itemCategory === "weapon" || g.itemCategory === "armor") && order(g.rarity) <= order("rare"))
    .sort((a, b) => order(b.rarity) - order(a.rarity) || sum(b.stats) - sum(a.stats)).slice(0, SPARES_KEPT);
  const inventory = [...keep, ...items(s).filter((g) => wornIds.has(g.id)), ...spares];
  return {
    id: s.name.toLowerCase(), name: s.name, seed: s.seed, player: { level: s.player.level, xp: s.player.xp }, rating: ELO_START,
    stats: {
      ...s.stats, scans: s.scans, gold: s.gold, species: new Set(creatures(s).map((c) => c.creatureId)).size, path: [...s.path],
      klutz: { level: s.klutz.level ?? 1, trips: s.klutzTrips, learned: [...(s.klutz.learned ?? [])] },
    },
    inventory,
    equipment,
  };
}

// Their warm-up: WARMUP_BATTLES battles among them, in the two queues by turns, each moving both ratings.
export function warmUp(rivals: Rival[], seed = 1, onLog?: (line: string) => void): Rival[] {
  const rng = dice(seed);
  const out = rivals.map((r) => ({ ...r, rating: ELO_START }));
  const queues = Object.values(RANKED_FORMATS);
  for (let n = 0; n < WARMUP_BATTLES; n++) {
    const a = out[Math.floor(rng() * out.length)];
    const b = pick(rng, out.filter((r) => r !== a));
    const f = queues[n % queues.length];
    const m = playRivalMatch(a, b, f);
    if (!m) continue;
    const u = eloUpdate(a.rating, b.rating, m.winner === "a" ? "win" : m.winner === "b" ? "loss" : "draw");
    a.rating = u.a; b.rating = u.b;
    onLog?.(`warm-up ${n + 1}: ${a.name} v ${b.name} (${f.name}): ${m.winner === "draw" ? "a draw" : `${m.winner === "a" ? a.name : b.name} wins`} in ${m.rounds} rounds → ${a.name} ${a.rating}, ${b.name} ${b.rating}`);
  }
  return out;
}

// All seven, seeded apart, then warmed up.
export function simulateRivals(onLog?: (line: string) => void, names = RIVAL_NAMES, baseSeed = 20261124): Rival[] {
  return warmUp(names.map((name, i) => simulateRival(baseSeed + i * 7919, name, onLog)), baseSeed, onLog);
}
