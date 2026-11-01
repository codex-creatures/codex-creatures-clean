// lib/daily.ts
// The daily quest, on the quest board's Quests tab (docs/design.md §9): one a
// day, the same for everyone (picked from the date), new at local midnight.
// Progress counts from midnight: barcodes scanned, a dungeon's final boss
// beaten, gold from selling. Once it's done you claim the reward, once.
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the
// Den (scans, sales) and the Labyrinth (wins, its merchant) write it.

import { readSave, writeSaveField } from "./save";
import type { Drop } from "./types";
import type { Rarity } from "./items/budgets";
import { RARITY_WEIGHTS } from "./items/budgets";
import { ITEM_KEYS } from "./items/ceilings";
import { ARMOR_KEYS, ARMOR_SLOTS } from "./items/armor";
import { weaponDrop, armorDrop } from "./drops";
import { rollItemStats } from "./items/rollItemStats";
import { rollArmorPiece } from "./items/rollArmorStats";
import { CREATURES_BY_RARITY } from "./creatures/creatureData";
import { makeCreatureDrop } from "./creatures/summon";
import { BOX_ROLLS } from "./quest";
import type { DungeonId } from "./dungeon/run";

type Rng = () => number;

// What counts towards a quest: a new barcode scanned (a Code Cache, sealed or
// not; a rescan's gold doesn't count), a dungeon's final boss beaten, or gold
// from selling things (at home or to the Labyrinth's merchant).
export type DailyEvent = "scan" | "sell" | `win:${DungeonId}`;
// What it pays: gold, Klutz's box but Rare or better, a creature (Rare at
// most), Rare or Epic gear, or the travelling merchant calling at the tavern.
export type DailyReward = "gold" | "box" | "creature" | "gear" | "merchant";
export type DailyQuest = {
  id: string;
  name: string;
  task: string;     // what to do (one line)
  event: DailyEvent;
  goal: number;
  reward: DailyReward;
  pays: string;     // the reward, in words
};

export const DAILY_GOLD = 500;
export const DAILY_GEAR = 3;
export const DAILY_QUESTS: DailyQuest[] = [
  { id: "scans",   name: "Barcode hunter",     task: "Scan 5 new barcodes",          event: "scan",  goal: 5,   reward: "gold",     pays: `${DAILY_GOLD} gold` },
  { id: "cyclops", name: "Cyclops slayer",     task: "Beat the Cyclops",             event: "win:1", goal: 1,   reward: "box",      pays: "A box of Rare or better gear" },
  { id: "camp",    name: "Camp raider",        task: "Beat the Encampment twice",    event: "win:0", goal: 2,   reward: "creature", pays: "A creature (up to Rare)" },
  { id: "hydra",   name: "Hydra hunter",       task: "Beat the Hydra",               event: "win:2", goal: 1,   reward: "gear",     pays: `${DAILY_GEAR} Rare or Epic weapons or armour` },
  { id: "sell",    name: "Good trade",         task: "Sell 300 gold's worth of items", event: "sell", goal: 300, reward: "merchant", pays: "The travelling merchant calls" },
];

// Today, by the clock on this device: "2026-11-02".
export function dayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// The day's quest: the same for everyone on that date.
export function questOfDay(day: string): DailyQuest {
  let h = 2166136261;
  for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return DAILY_QUESTS[(h >>> 0) % DAILY_QUESTS.length];
}

// Saved: which day it's for, how far along, and whether it's been claimed.
export type DailyState = { day?: string; progress?: number; claimed?: boolean };
// The state for today (a new day starts at 0).
export const dailyFor = (s: DailyState, day: string): DailyState => (s.day === day ? s : { day, progress: 0 });

// Something happened that may count (amount: 1, or the gold a sale made).
export function noteDaily(s: DailyState, event: DailyEvent, amount: number, day: string): DailyState {
  const t = dailyFor(s, day);
  if (questOfDay(day).event !== event || amount <= 0 || t.claimed) return t;
  return { ...t, progress: (t.progress ?? 0) + amount };
}
export const dailyDone = (s: DailyState, day: string) => (dailyFor(s, day).progress ?? 0) >= questOfDay(day).goal;
export const canClaim = (s: DailyState, day: string) => dailyDone(s, day) && !dailyFor(s, day).claimed;
export const claimDaily = (s: DailyState, day: string): DailyState => (canClaim(s, day) ? { ...dailyFor(s, day), claimed: true } : dailyFor(s, day));

// ── The rewards ──────────────────────────────────────────────────────
const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
// A rarity at the usual odds (RARITY_WEIGHTS), held between lo and hi.
export function rollRarity(rng: Rng, lo: Rarity = "common", hi: Rarity = "legendary"): Rarity {
  const total = ORDER.reduce((n, r) => n + RARITY_WEIGHTS[r], 0);
  let x = rng() * total, r: Rarity = "legendary";
  for (const k of ORDER) { if (x < RARITY_WEIGHTS[k]) { r = k; break; } x -= RARITY_WEIGHTS[k]; }
  const i = Math.min(Math.max(ORDER.indexOf(r), ORDER.indexOf(lo)), ORDER.indexOf(hi));
  return ORDER[i];
}
const pick = <T,>(xs: readonly T[], rng: Rng) => xs[Math.floor(rng() * xs.length)];

// A weapon a third of the time, otherwise an armour piece (as in Klutz's box).
function gearPiece(lo: Rarity, hi: Rarity, rng: Rng): Drop {
  const rarity = rollRarity(rng, lo, hi);
  if (rng() < 1 / 3) {
    const key = pick(ITEM_KEYS, rng);
    return weaponDrop(key, rarity, "", rollItemStats(key, rarity, rng).stats);
  }
  const key = pick(ARMOR_KEYS, rng), slot = pick(ARMOR_SLOTS, rng);
  return armorDrop(key, rarity, "", rollArmorPiece(key, rarity, rng), slot);
}

// The things a reward gives (gold and the merchant give none: they're paid directly).
export function rollDailyReward(reward: DailyReward, rng: Rng = Math.random): Drop[] {
  if (reward === "box") return Array.from({ length: BOX_ROLLS }, () => gearPiece("rare", "legendary", rng));
  if (reward === "gear") return Array.from({ length: DAILY_GEAR }, () => gearPiece("rare", "epic", rng));
  if (reward === "creature") {
    const pool = CREATURES_BY_RARITY[rollRarity(rng, "common", "rare")];
    return pool.length ? [makeCreatureDrop(pick(pool, rng), "creature", "")] : [];
  }
  return [];
}

// ── Saved progress ───────────────────────────────────────────────────
export const DAILY_FIELD = "daily";

export function loadDaily(): DailyState {
  const d = readSave()[DAILY_FIELD];
  return d && typeof d === "object" ? (d as DailyState) : {};
}
// Change it (read, change, write: whoever else wrote it meanwhile is kept).
export function updateDaily(fn: (s: DailyState) => DailyState): DailyState {
  const next = fn(loadDaily());
  writeSaveField(DAILY_FIELD, next);
  return next;
}
// Count something towards today's quest.
export const countDaily = (event: DailyEvent, amount = 1) => updateDaily((s) => noteDaily(s, event, amount, dayKey()));
// "Reset Player": it starts over.
export const clearDaily = () => writeSaveField(DAILY_FIELD, undefined);
