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
// piece of gear like one he's wearing: the same slot (any weapon, any helm…)
// at the same rarity as his piece in that slot — with an UPGRADE_CHANCE of
// one tier better. Better gear on Klutz means better finds.
//
// The whole trip is decided when he sets off (so it plays out even with the
// game closed); the screens reveal it as the time passes.

import { createBattle, resolveRound, sendInReplacement } from "./combat/battle";
import { chooseAiAction, chooseAiReplacement } from "./combat/thinkingAi";
import type { Fighter } from "./combat/engine";
import { makeEnemy, enemyFighter, type Enemy } from "./dungeon/run";
import { RARITY_WEIGHTS, type Rarity } from "./items/budgets";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { makeCreatureDrop } from "./creatures/summon";
import { weaponDrop, armorDrop, randomArmorSlot } from "./drops";
import { ARMOR_KEYS, pieceStats, type ArmorKey, type ArmorSlot } from "./items/armor";
import { ITEM_KEYS, type ItemKey } from "./items/ceilings";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import type { Drop } from "./types";

export const WALK_MIN_MS = 20 * 60 * 1000; // how long he walks before he meets something
export const WALK_MAX_MS = 60 * 60 * 1000;
export const HEAL_MS_PER_HP = 10_000;  // in the pool: 1 HP every 10 seconds
export const FIND_CHANCE = 0.35;       // each trip: a piece of gear like one he's wearing
export const UPGRADE_CHANCE = 0.05;    // …one rarity tier better than his piece

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
  loot: Drop[];          // won: the creature, then its gear
};

export type Expedition = {
  startedAt: number;
  endsAt: number;        // when he meets something (the fight is quick) and heads home
  maxHp: number;
  encounters: KlutzEncounter[];
  find?: Drop;           // a piece of gear he picked up on the way
  collected: boolean;    // its loot has been handed over
};

export type KlutzState = {
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
  const creature = makeCreatureDrop(t, "creature", "", { proficiency: e.proficiency, moves: e.moves });
  const gear = e.gear.map((p) => {
    if (p.slot === "weapon") return weaponDrop(p.key as ItemKey, p.rarity, "", p.stats);
    const slot = randomArmorSlot();
    return armorDrop(p.key as ArmorKey, p.rarity, "", pieceStats(p.stats, slot), slot);
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

// A piece of gear like one he's wearing (or nothing, if he isn't wearing any).
export function rollFind(worn: WornPiece[], rng: Rng = Math.random): Drop | undefined {
  if (worn.length === 0) return undefined;
  const piece = worn[Math.floor(rng() * worn.length)];
  const up = rng() < UPGRADE_CHANCE;
  const rarity = RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(piece.rarity) + (up ? 1 : 0))];
  if (piece.slot === "weapon") {
    const key = ITEM_KEYS[Math.floor(rng() * ITEM_KEYS.length)];
    return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
  }
  const key = ARMOR_KEYS[Math.floor(rng() * ARMOR_KEYS.length)];
  return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, piece.slot, rng), piece.slot);
}

// Plan a whole expedition the moment he sets off: how long he walks, what
// he meets, how the fight goes, and anything he picks up.
export function planExpedition(klutz: Fighter, now = Date.now(), rng: Rng = Math.random, worn: WornPiece[] = []): Expedition {
  const at = Math.round(now + WALK_MIN_MS + rng() * (WALK_MAX_MS - WALK_MIN_MS));
  const rarity = rollRarity(rng), gearRarity = oneLower(rarity);
  const enemy = makeEnemy(rarity, gearRarity, [], rng);
  const r = fight(klutz, klutz.maxHp, enemyFighter(enemy));
  const encounter: KlutzEncounter = { at, creatureId: enemy.creatureId, rarity, gearRarity, won: r.won, rounds: r.rounds, hpAfter: r.hpAfter, loot: r.won ? lootFrom(enemy) : [] };
  const find = rng() < FIND_CHANCE ? rollFind(worn, rng) : undefined;
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
  return { expedition: planExpedition(klutz, now, rng, worn) };
}

// After an expedition ends: his HP when he got back, and the loot to hand
// over (once). Returns the new state and the loot.
export function collectKlutz(k: KlutzState, now = Date.now()): { state: KlutzState; loot: Drop[] } {
  const ex = k.expedition;
  if (!ex || ex.collected || now < ex.endsAt) return { state: k, loot: [] };
  const last = ex.encounters[ex.encounters.length - 1];
  const hp = last ? last.hpAfter : ex.maxHp;
  return {
    state: { ...k, hp: hp < ex.maxHp ? hp : undefined, hpAt: ex.endsAt, expedition: { ...ex, collected: true } },
    loot: [...ex.encounters.flatMap((e) => e.loot), ...(ex.find ? [ex.find] : [])],
  };
}
