// lib/klutz.ts
// Klutz, your helper. He isn't one of your creatures: he wanders the Den,
// and you can send him into the Labyrinth to hunt.
//
// On an expedition he walks the Labyrinth until he runs into a wild
// creature — somewhere between WALK_MIN_MS and WALK_MAX_MS — fights it, and
// comes home. The creature is rolled like a scan (same rarity odds), wearing
// gear one rarity lower than itself (commons wear common gear):
// - win: the creature goes in the Den's cage and its gear (the weapon and
//   one armour piece) goes into your inventory;
// - lose: he's carried back to the pool, where he heals HEAL_MS_PER_HP per
//   HP. He can only set off again at full health (a win can leave him hurt
//   too).
//
// He also has a FIND_CHANCE on every trip (win or lose) to bring back a
// piece of gear for a slot he's wearing (any weapon, any helm…). It's never
// better than his piece there: SAME_RARITY_CHANCE of the same rarity,
// otherwise a lower one (spread evenly). In Common gear it's a coin flip
// between Common and Uncommon, to help new players get going. So Klutz is a
// way to find alternatives to gear you have, not to climb rarities.
//
// He levels up like a creature: a catch gives him the XP a creature would
// get for that KO (xpForEnemy) plus CAPTURE_XP (so a first catch takes him
// to level 2), a find gives FIND_XP, and XP scrolls work on him too. His
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
import type { Drop } from "./types";
import { addXp, canFind, clampLevel, xpForEnemy } from "./creatures/levels";

export const WALK_MIN_MS = 20 * 60 * 1000; // how long he walks before he meets something
export const WALK_MAX_MS = 60 * 60 * 1000;
export const HEAL_MS_PER_HP = 10_000;  // in the pool: 1 HP every 10 seconds
export const FIND_CHANCE = 0.35;       // each trip: a piece of gear like one he's wearing
export const SAME_RARITY_CHANCE = 0.05; // …the same rarity as his piece (otherwise lower)
export const COMMON_STEP_UP = 0.5;     // in Common gear: Uncommon half the time
export const HUNT_BELOW = 2;           // what he meets is his level, up to this many under…
export const HUNT_ABOVE = 1;           // …or this many over (and a catch keeps its level)
export const FIND_SAME_PER_LEVEL = 0.01; // each level over 1: this much likelier a same-rarity find
export const FIND_SAME_MAX = 0.3;
export const CAPTURE_XP = 50;          // on top of the KO's XP, for bringing a creature home
export const FIND_XP = 20;             // for bringing home a piece of gear

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
};

export type Expedition = {
  letGo?: boolean; // he caught something but the cage was full, so he let it go
  startedAt: number;
  endsAt: number;        // when he meets something (the fight is quick) and heads home
  maxHp: number;
  encounters: KlutzEncounter[];
  find?: Drop;           // a piece of gear he picked up on the way
  collected: boolean;    // its loot has been handed over
};

export type KlutzState = {
  level?: number;        // his level (missing = 1)
  xp?: number;           // …and XP towards the next
  hp?: number;           // HP when he got back (missing = full)
  hpAt?: number;         // when that was
  expedition?: Expedition;
};

export type KlutzStatus =
  | { kind: "away"; expedition: Expedition; seen: KlutzEncounter[] }   // in the Labyrinth
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

export function planExpedition(klutz: Fighter, now = Date.now(), rng: Rng = Math.random, worn: WornPiece[] = [], level = 1): Expedition {
  const L = clampLevel(level);
  const at = Math.round(now + WALK_MIN_MS + rng() * (WALK_MAX_MS - WALK_MIN_MS));
  const rarity = huntRarity(rollRarity(rng), L), gearRarity = oneLower(rarity);
  const lo = Math.max(1, L - HUNT_BELOW), hi = clampLevel(L + HUNT_ABOVE);
  const foeLevel = lo + Math.floor(rng() * (hi - lo + 1));
  const enemy = makeEnemy(rarity, gearRarity, [], rng, foeLevel);
  const r = fight(klutz, klutz.maxHp, enemyFighter(enemy));
  const encounter: KlutzEncounter = {
    at, creatureId: enemy.creatureId, rarity, gearRarity, won: r.won, rounds: r.rounds, hpAfter: r.hpAfter, loot: r.won ? lootFrom(enemy) : [],
    ...(r.won ? { xp: xpForEnemy(foeLevel, rarity) + CAPTURE_XP } : {}),
  };
  const find = rng() < FIND_CHANCE ? rollFind(worn, rng, L) : undefined;
  return { startedAt: now, endsAt: at, maxHp: klutz.maxHp, encounters: [encounter], ...(find ? { find } : {}), collected: false };
}

// Where Klutz is right now.
export function klutzStatus(k: KlutzState, maxHp: number, now = Date.now()): KlutzStatus {
  const ex = k.expedition;
  if (ex && now < ex.endsAt) return { kind: "away", expedition: ex, seen: ex.encounters.filter((e) => e.at <= now) };
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
  return { level: k.level, xp: k.xp, expedition: planExpedition(klutz, now, rng, worn, k.level) };
}

// XP for Klutz (a hunt, or a scroll). Returns the new state and his level before.
export function klutzGainXp(k: KlutzState, gained: number): { state: KlutzState; from: number; to: number } {
  const from = clampLevel(k.level);
  const p = addXp({ level: from, xp: k.xp ?? 0 }, gained);
  return { state: { ...k, level: p.level, xp: p.xp }, from, to: p.level };
}

// After an expedition ends: his HP when he got back, his XP, and the loot
// to hand over (once). Returns the new state, the loot and any level-up.
export function collectKlutz(k: KlutzState, now = Date.now()): { state: KlutzState; loot: Drop[]; levelUp?: { from: number; to: number } } {
  const ex = k.expedition;
  if (!ex || ex.collected || now < ex.endsAt) return { state: k, loot: [] };
  const last = ex.encounters[ex.encounters.length - 1];
  const hp = last ? last.hpAfter : ex.maxHp;
  const xp = ex.encounters.reduce((s, e) => s + (e.xp ?? 0), 0) + (ex.find ? FIND_XP : 0);
  const { state, from, to } = klutzGainXp(k, xp);
  return {
    state: { ...state, hp: hp < ex.maxHp ? hp : undefined, hpAt: ex.endsAt, expedition: { ...ex, collected: true } },
    loot: [...ex.encounters.flatMap((e) => e.loot), ...(ex.find ? [ex.find] : [])],
    ...(to > from ? { levelUp: { from, to } } : {}),
  };
}
