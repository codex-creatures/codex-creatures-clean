// lib/klutz.ts
// Klutz, your helper. He isn't one of your creatures: he wanders the Den,
// and you can send him into the Labyrinth to hunt.
//
// On an expedition he hunts until something beats him: he walks the
// Labyrinth until he runs into a wild creature — somewhere between
// WALK_MIN_MS and WALK_MAX_MS — fights it, and if he wins walks on to the
// next, with the HP he has left (he doesn't heal on the way). Past
// TOUGHER_AFTER_MS what he meets gets tougher, so a trip ends sooner or later
// (send him off at bedtime, see what he's caught in the morning). You can
// call him back at any time; he comes home with what he's got so far. The
// creatures are rolled like a scan (same rarity odds), wearing gear one
// rarity lower than themselves (commons wear common gear):
// - win: the creature goes in the Den's cage and its gear (the weapon and
//   one armour piece) goes into his crate;
// - lose: he's carried back to the pool, where he heals HEAL_MS_PER_HP per
//   HP. He can only set off again at full health (called back, he can be
//   hurt too).
//
// He also has a FIND_CHANCE on every walk (win or lose) to pick up a
// piece of gear for a slot he's wearing (any weapon, any helm…). It's never
// better than his piece there: SAME_RARITY_CHANCE of the same rarity,
// otherwise a lower one (spread evenly). In Common gear it's a coin flip
// between Common and Uncommon, to help new players get going. So Klutz is a
// way to find alternatives to gear you have, not to climb rarities.
//
// He levels up like a creature: a catch gives him the XP a creature would
// get for that KO (xpForEnemy) plus CAPTURE_XP (so a first catch takes him
// to level 2), each piece of gear he brings home (a catch's or a find) gives
// FIND_XP, and XP scrolls work on him too. His
// level makes him stronger, and decides what he meets:
// - wild creatures are around his level (HUNT_BELOW under to HUNT_ABOVE over),
//   and a catch keeps its level;
// - rarities open up with his level as they do for scans (SCAN_UNLOCK): until
//   then, a rarer roll is met as the best rarity he can handle;
// - his finds come at his own piece's rarity more often (FIND_SAME_PER_LEVEL).
//
// The whole trip is decided when he sets off (so it plays out even with the
// game closed); the screens reveal it as the time passes.

import { createBattle, resolveRound, sendInReplacement } from "./combat/battle";
import { chooseAiAction, chooseAiReplacement } from "./combat/thinkingAi";
import type { Fighter } from "./combat/engine";
import { makeEnemy, enemyFighter, droppedPieceStats, type Enemy } from "./dungeon/run";
import { RARITY_WEIGHTS, type Rarity } from "./items/budgets";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { makeCreatureDrop } from "./creatures/summon";
import { weaponDrop, armorDrop, randomArmorSlot } from "./drops";
import { ARMOR_KEYS, type ArmorKey, type ArmorSlot } from "./items/armor";
import { ITEM_KEYS, type ItemKey } from "./items/ceilings";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { isCreatureDrop, type Drop } from "./types";
import type { CreatureProficiency } from "./creatures/creatureData";
import { addXp, canFind, clampLevel, xpForEnemy } from "./creatures/levels";

export const WALK_MIN_MS = 20 * 60 * 1000; // how long he walks before he meets something (each time)
export const WALK_MAX_MS = 60 * 60 * 1000;
export const TOUGHER_AFTER_MS = 6 * 60 * 60 * 1000; // out longer than this, what he meets gets tougher:
export const TOUGHER_LEVELS_PER_HOUR = 1;           // a level for every hour past it (🧪 to tune)
export const MAX_ENCOUNTERS = 60;                   // a safety stop: after this many fights he comes home
export const HEAL_MS_PER_HP = 10_000;  // in the pool: 1 HP every 10 seconds
export const FIND_CHANCE = 0.35;       // each walk: a piece of gear like one he's wearing
export const SAME_RARITY_CHANCE = 0.05; // …the same rarity as his piece (otherwise lower)
export const COMMON_STEP_UP = 0.5;     // in Common gear: Uncommon half the time
export const HUNT_BELOW = 2;           // what he meets is his level, up to this many under…
export const HUNT_ABOVE = 1;           // …or this many over (and a catch keeps its level)
export const FIND_SAME_PER_LEVEL = 0.01; // each level over 1: this much likelier a same-rarity find
export const FIND_SAME_MAX = 0.3;
export const CAPTURE_XP = 50;          // on top of the KO's XP, for bringing a creature home
export const FIND_XP = 20;             // for each piece of gear he brings home (a catch's or a find)
// His %s are points you spend: POINTS_PER_LEVEL for each level over 1 (so at
// level 15 he has 84, about what a Rare creature has there), +1% each.
// A re-spec hands them all back for RESPEC_COST gold.
export const POINTS_PER_LEVEL = 6;
export const RESPEC_COST = 1000;

// What Klutz is wearing, slot by slot (for his finds).
export type WornPiece = { slot: "weapon" | ArmorSlot; rarity: Rarity };

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
type Rng = () => number;

export type KlutzEncounter = {
  at: number;            // when it happens (ms timestamp)
  creatureId: string;
  rarity: Rarity;
  gearRarity: Rarity;
  won: boolean;
  rounds: number;
  hpAfter: number;       // Klutz's HP after the fight
  xp?: number;           // XP he got for it (a win)
  loot: Drop[];          // won: the creature, then its gear
  find?: Drop;           // a piece of gear he picked up on the walk there
};

export type Expedition = {
  letGo?: boolean; // he caught something but the cage was full, so he let it go
  caged?: number;  // how many of his catches went in the cage (the first ones; the rest he let go)
  startedAt: number;
  endsAt: number;        // when the last fight is over (or you called him back) and he's home
  maxHp: number;
  encounters: KlutzEncounter[];
  find?: Drop;           // (older saves' trips: one find for the whole trip)
  recalled?: boolean;    // you called him back before anything beat him
  collected: boolean;    // its loot has been handed over
};

export type KlutzState = {
  level?: number;        // his level (missing = 1)
  xp?: number;           // …and XP towards the next
  hp?: number;           // HP when he got back (missing = full)
  hpAt?: number;         // when that was
  expedition?: Expedition;
  points?: Partial<CreatureProficiency>; // the % points you've spent on him (missing = none)
  learned?: string[];    // moves he's learned from codexes (missing = none)
};

// ── His points ──
const PROF_KEYS: (keyof CreatureProficiency)[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];
export const pointsEarned = (level?: number) => (clampLevel(level) - 1) * POINTS_PER_LEVEL;
export const pointsSpent = (p: Partial<CreatureProficiency> = {}) => PROF_KEYS.reduce((s, k) => s + (p[k] ?? 0), 0);
export const pointsFree = (k: KlutzState) => Math.max(0, pointsEarned(k.level) - pointsSpent(k.points));
// His %s: just the points spent (every stat 0 to start with).
export const klutzProficiency = (p: Partial<CreatureProficiency> = {}): CreatureProficiency =>
  Object.fromEntries(PROF_KEYS.map((k) => [k, p[k] ?? 0])) as CreatureProficiency;

// Spend points (whole ones, no more than he has free).
export function spendPoints(k: KlutzState, add: Partial<CreatureProficiency>): KlutzState {
  const n = pointsSpent(add);
  if (n <= 0 || n > pointsFree(k) || PROF_KEYS.some((s) => (add[s] ?? 0) < 0 || !Number.isInteger(add[s] ?? 0))) return k;
  const now = klutzProficiency(k.points);
  return { ...k, points: Object.fromEntries(PROF_KEYS.map((s) => [s, now[s] + (add[s] ?? 0)])) };
}

// A re-spec: every point back to spend again (the gold is paid by the caller).
export const respecKlutz = (k: KlutzState): KlutzState => ({ ...k, points: {} });

export type KlutzStatus =
  | { kind: "away"; expedition: Expedition; seen: KlutzEncounter[]; hp: number } // in the Labyrinth (hp: after his last fight)
  | { kind: "healing"; hp: number; maxHp: number; fullAt: number }     // soaking in the pool
  | { kind: "home" };                                                  // wandering the Den

function rollRarity(rng: Rng): Rarity {
  const total = RARITIES.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  let x = rng() * total;
  for (const r of RARITIES) { x -= RARITY_WEIGHTS[r]; if (x <= 0) return r; }
  return "common";
}
const oneLower = (r: Rarity): Rarity => RARITIES[Math.max(0, RARITIES.indexOf(r) - 1)];

// A won encounter's loot: the creature itself, its weapon and one armour piece.
function lootFrom(e: Enemy): Drop[] {
  const t = CREATURE_BY_ID[e.creatureId];
  const creature = { ...makeCreatureDrop(t, "creature", "", { proficiency: e.proficiency, moves: e.moves }), level: e.level ?? 1 };
  const gear = e.gear.map((p) => {
    if (p.slot === "weapon") return weaponDrop(p.key as ItemKey, p.rarity, "", p.stats);
    const slot = randomArmorSlot();
    return armorDrop(p.key as ArmorKey, p.rarity, "", droppedPieceStats(p, slot), slot);
  });
  return [creature, ...gear];
}

// One fight, Klutz (starting on hp) against a wild creature. Both sides play
// the simple AI.
function fight(klutz: Fighter, hp: number, foe: Fighter): { won: boolean; hpAfter: number; rounds: number } {
  const s = createBattle([klutz], [foe], { A: [hp] });
  while (!s.winner) {
    resolveRound(s, { A: chooseAiAction(s, "A", "easy"), B: chooseAiAction(s, "B", "easy") });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, "easy"));
  }
  return { won: s.winner === "A", hpAfter: Math.max(0, s.sides.A.team[0].hp), rounds: s.round };
}

// The rarity of a find, from the rarity of the piece he's wearing.
export const sameRarityChance = (level = 1) => Math.min(FIND_SAME_MAX, SAME_RARITY_CHANCE + FIND_SAME_PER_LEVEL * (clampLevel(level) - 1));
export function findRarity(worn: Rarity, rng: Rng = Math.random, level = 1): Rarity {
  const i = RARITIES.indexOf(worn);
  if (i <= 0) return rng() < COMMON_STEP_UP ? "uncommon" : "common";
  if (rng() < sameRarityChance(level)) return worn;
  return RARITIES[Math.floor(rng() * i)]; // one of the lower rarities, evenly
}

// A piece of gear like one he's wearing (or nothing, if he isn't wearing any).
export function rollFind(worn: WornPiece[], rng: Rng = Math.random, level = 1): Drop | undefined {
  if (worn.length === 0) return undefined;
  const piece = worn[Math.floor(rng() * worn.length)];
  const rarity = findRarity(piece.rarity, rng, level);
  if (piece.slot === "weapon") {
    const key = ITEM_KEYS[Math.floor(rng() * ITEM_KEYS.length)];
    return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
  }
  const key = ARMOR_KEYS[Math.floor(rng() * ARMOR_KEYS.length)];
  return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), piece.slot);
}

// Plan a whole expedition the moment he sets off: how long he walks, what
// he meets, how the fight goes, and anything he picks up.
// The rarest thing he can meet at his level (like scanning: SCAN_UNLOCK).
export function huntRarity(rolled: Rarity, level = 1): Rarity {
  let r = rolled;
  while (!canFind(clampLevel(level), r)) r = oneLower(r);
  return r;
}

// How many levels tougher what he meets is, this long into a trip.
export const toughening = (outFor: number) =>
  outFor <= TOUGHER_AFTER_MS ? 0 : Math.ceil((outFor - TOUGHER_AFTER_MS) / 3_600_000) * TOUGHER_LEVELS_PER_HOUR;

// One walk and the fight at the end of it, starting on hp.
function meet(klutz: Fighter, hp: number, from: number, startedAt: number, L: number, worn: WornPiece[], rng: Rng): KlutzEncounter {
  const at = Math.round(from + WALK_MIN_MS + rng() * (WALK_MAX_MS - WALK_MIN_MS));
  const rarity = huntRarity(rollRarity(rng), L), gearRarity = oneLower(rarity);
  const lo = Math.max(1, L - HUNT_BELOW), hi = clampLevel(L + HUNT_ABOVE);
  const foeLevel = clampLevel(lo + Math.floor(rng() * (hi - lo + 1)) + toughening(at - startedAt));
  const enemy = makeEnemy(rarity, gearRarity, [], rng, foeLevel);
  const r = fight(klutz, hp, enemyFighter(enemy));
  const find = rng() < FIND_CHANCE ? rollFind(worn, rng, L) : undefined;
  return {
    at, creatureId: enemy.creatureId, rarity, gearRarity, won: r.won, rounds: r.rounds, hpAfter: r.hpAfter, loot: r.won ? lootFrom(enemy) : [],
    ...(r.won ? { xp: xpForEnemy(foeLevel, rarity) + CAPTURE_XP } : {}),
    ...(find ? { find } : {}),
  };
}

export function planExpedition(klutz: Fighter, now = Date.now(), rng: Rng = Math.random, worn: WornPiece[] = [], level = 1): Expedition {
  const L = clampLevel(level);
  const encounters: KlutzEncounter[] = [];
  let hp = klutz.maxHp, at = now;
  do {
    const e = meet(klutz, hp, at, now, L, worn, rng);
    encounters.push(e);
    hp = e.hpAfter; at = e.at;
  } while (encounters[encounters.length - 1].won && encounters.length < MAX_ENCOUNTERS);
  return { startedAt: now, endsAt: at, maxHp: klutz.maxHp, encounters, collected: false };
}

// Call him back early: he comes home now with what he's won so far (fights
// still ahead of him never happen).
export function recallKlutz(k: KlutzState, now = Date.now()): KlutzState {
  const ex = k.expedition;
  if (!ex || ex.collected || now >= ex.endsAt) return k;
  return { ...k, expedition: { ...ex, endsAt: now, encounters: ex.encounters.filter((e) => e.at <= now), recalled: true } };
}

// Where Klutz is right now.
export function klutzStatus(k: KlutzState, maxHp: number, now = Date.now()): KlutzStatus {
  const ex = k.expedition;
  if (ex && now < ex.endsAt) {
    const seen = ex.encounters.filter((e) => e.at <= now);
    return { kind: "away", expedition: ex, seen, hp: seen.length ? seen[seen.length - 1].hpAfter : ex.maxHp };
  }
  const hp = currentHp(k, maxHp, now);
  if (hp < maxHp) return { kind: "healing", hp, maxHp, fullAt: (k.hpAt ?? now) + (maxHp - (k.hp ?? maxHp)) * HEAL_MS_PER_HP };
  return { kind: "home" };
}

export function currentHp(k: KlutzState, maxHp: number, now = Date.now()): number {
  if (k.hp === undefined) return maxHp;
  const healed = k.hp + Math.floor((now - (k.hpAt ?? now)) / HEAL_MS_PER_HP);
  return Math.min(maxHp, healed);
}

// Send him off (only from home, at full health).
export function sendKlutz(k: KlutzState, klutz: Fighter, now = Date.now(), rng: Rng = Math.random, worn: WornPiece[] = []): KlutzState {
  if (klutzStatus(k, klutz.maxHp, now).kind !== "home") return k;
  return { level: k.level, xp: k.xp, ...(k.points ? { points: k.points } : {}), expedition: planExpedition(klutz, now, rng, worn, k.level) };
}

// XP for Klutz (a hunt, or a scroll). Returns the new state and his level before.
export function klutzGainXp(k: KlutzState, gained: number): { state: KlutzState; from: number; to: number } {
  const from = clampLevel(k.level);
  const p = addXp({ level: from, xp: k.xp ?? 0 }, gained);
  return { state: { ...k, level: p.level, xp: p.xp }, from, to: p.level };
}

// Every piece of gear he carries home earns FIND_XP: a catch's weapon and
// armour as well as a find (counted at collection, so trips already under
// way get it too).
export const gearCount = (loot: Drop[]) => loot.filter((d) => !isCreatureDrop(d)).length;

// After an expedition ends: his HP when he got back, his XP, and the loot
// to hand over (once). Returns the new state, the loot and any level-up.
export function collectKlutz(k: KlutzState, now = Date.now()): { state: KlutzState; loot: Drop[]; levelUp?: { from: number; to: number } } {
  const ex = k.expedition;
  if (!ex || ex.collected || now < ex.endsAt) return { state: k, loot: [] };
  const last = ex.encounters[ex.encounters.length - 1];
  const hp = last ? last.hpAfter : ex.maxHp;
  const loot = [...ex.encounters.flatMap((e) => [...e.loot, ...(e.find ? [e.find] : [])]), ...(ex.find ? [ex.find] : [])];
  const xp = ex.encounters.reduce((s, e) => s + (e.xp ?? 0), 0) + FIND_XP * gearCount(loot);
  const { state, from, to } = klutzGainXp(k, xp);
  return {
    state: { ...state, hp: hp < ex.maxHp ? hp : undefined, hpAt: ex.endsAt, expedition: { ...ex, collected: true } },
    loot,
    ...(to > from ? { levelUp: { from, to } } : {}),
  };
}
