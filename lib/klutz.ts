// lib/klutz.ts
// Klutz, your helper. He isn't one of your creatures: he wanders the Den,
// and you can send him into the Labyrinth to hunt.
//
// An expedition lasts an hour, with ENCOUNTER_CHECKS chances (one in each
// stretch of the hour) to run into a wild creature. A creature is rolled
// like a scan (same rarity odds), wearing gear one rarity lower than itself
// (commons wear common gear). Klutz fights it 1v1 and his HP carries from one
// fight to the next:
// - win: the creature goes in the Den's cage and its gear (the weapon and
//   one armour piece) goes into your inventory;
// - lose: the expedition is over and he's carried back to the pool, where
//   he heals HEAL_MS_PER_HP per HP. He can only set off again at full health.
//
// The whole hour is decided when he sets off (so it plays out even with the
// game closed); the screens reveal it as the time passes.

import { createBattle, resolveRound, sendInReplacement } from "./combat/battle";
import { chooseAiAction, chooseAiReplacement } from "./combat/thinkingAi";
import type { Fighter } from "./combat/engine";
import { makeEnemy, enemyFighter, type Enemy } from "./dungeon/run";
import { RARITY_WEIGHTS, type Rarity } from "./items/budgets";
import { CREATURE_BY_ID } from "./creatures/creatureData";
import { makeCreatureDrop } from "./creatures/summon";
import { weaponDrop, armorDrop, randomArmorSlot } from "./drops";
import { pieceStats, type ArmorKey } from "./items/armor";
import type { ItemKey } from "./items/ceilings";
import type { Drop } from "./types";

export const EXPEDITION_MS = 60 * 60 * 1000;
export const ENCOUNTER_CHECKS = 3;
export const ENCOUNTER_CHANCE = 0.5;   // each check: the chance he meets something
export const HEAL_MS_PER_HP = 10_000;  // in the pool: 1 HP every 10 seconds

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
  endsAt: number;        // an hour later, or the moment he lost
  maxHp: number;
  encounters: KlutzEncounter[];
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

// Plan a whole expedition the moment he sets off.
export function planExpedition(klutz: Fighter, now = Date.now(), rng: Rng = Math.random): Expedition {
  const encounters: KlutzEncounter[] = [];
  const stretch = EXPEDITION_MS / ENCOUNTER_CHECKS;
  let hp = klutz.maxHp;
  let endsAt = now + EXPEDITION_MS;
  for (let i = 0; i < ENCOUNTER_CHECKS; i++) {
    const at = Math.round(now + (i + 0.1 + rng() * 0.8) * stretch);
    if (rng() >= ENCOUNTER_CHANCE) continue;
    const rarity = rollRarity(rng), gearRarity = oneLower(rarity);
    const enemy = makeEnemy(rarity, gearRarity, [], rng);
    const r = fight(klutz, hp, enemyFighter(enemy));
    hp = r.hpAfter;
    encounters.push({ at, creatureId: enemy.creatureId, rarity, gearRarity, won: r.won, rounds: r.rounds, hpAfter: r.hpAfter, loot: r.won ? lootFrom(enemy) : [] });
    if (!r.won) { endsAt = at; break; }
  }
  return { startedAt: now, endsAt, maxHp: klutz.maxHp, encounters, collected: false };
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
export function sendKlutz(k: KlutzState, klutz: Fighter, now = Date.now(), rng: Rng = Math.random): KlutzState {
  if (klutzStatus(k, klutz.maxHp, now).kind !== "home") return k;
  return { expedition: planExpedition(klutz, now, rng) };
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
    loot: ex.encounters.flatMap((e) => e.loot),
  };
}
