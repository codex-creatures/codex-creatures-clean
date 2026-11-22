// lib/challenge.ts
// The Challenge (the user, 2026-11-23; docs/design/den.md §9): "the chase one", a quest on the quest
// board beside the two dailies, and the one that can pay the most. A boss to beat with a quirk:
// - race: with a full team that are all of one race (a creature of two races counts for both);
// - clean: without using a potion or a Revival Elixir on the run;
// - rarity: with a full team, none of them above a rarity (as it is now: an ascended creature counts
//   as what it has become).
// Each lasts CHALLENGE_DAYS days, the same for everyone (picked from the date). It opens once you've
// beaten the Cyclops; a boss you've never beaten steps down to the deepest one you have (as the daily
// boss quests do), and what you got is fixed the first time it's seen, so a first win doesn't swap it.
// The reward grows with the boss and with how hard the quirk makes it (CHALLENGE_GRADES, from a sim):
// enchanted weapons and armour, and essence crystals (the user's picks of what it pays).
//
// Kept in its own field of the save (lib/save.ts: OWN_FIELDS), as both the quest board and the
// Labyrinth write it.

import { readSave, writeSaveField } from "./save";
import type { Drop, Rarity } from "./types";
import type { DungeonId } from "./dungeon/run";
import { RACES_V2, type RaceV2 } from "./creatures/racesV2";
import { RACE_INFO } from "./creatures/creatureData";
import { gearPiece } from "./daily";
import { enchanted } from "./items/enchantments";
import { materialDrop } from "./items/materials";

type Rng = () => number;
export const CHALLENGE_DAYS = 2;
// The bosses it can name, easiest first (the Minotaur is dungeon 4, the Abyss 3).
export type ChallengeBoss = 1 | 2 | 4 | 3;
export const CHALLENGE_BOSSES: ChallengeBoss[] = [1, 2, 4, 3];
export const BOSS_NAMES: Record<ChallengeBoss, string> = { 1: "the Cyclops", 2: "the Hydra", 4: "the Minotaur", 3: "the Abyss" };

export type Quirk = { kind: "race"; race: RaceV2 } | { kind: "clean" } | { kind: "rarity"; top: Rarity };
export type Challenge = { dungeon: ChallengeBoss; quirk: Quirk };
const QUIRK_KINDS: Quirk["kind"][] = ["race", "clean", "rarity"];
const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

// How hard each quirk makes each boss: 1 (under one and a half times as hard), 2 (up to two and a half
// times), 3 (a long shot). 🧪 From a sim of 50 to 120 runs each (docs/design/den.md has its table: a party
// a player at that boss might have, up the whole dungeon, with the quirk and without).
// rarity: the caps that boss's Challenge can name, each with its grade.
export type Grade = 1 | 2 | 3;
export const CHALLENGE_GRADES: Record<ChallengeBoss, { race: Grade; clean: Grade; rarity: Partial<Record<Rarity, Grade>> }> = {
  1: { race: 1, clean: 2, rarity: { uncommon: 2, common: 3 } },
  2: { race: 1, clean: 1, rarity: { rare: 2, uncommon: 2, common: 3 } },
  4: { race: 2, clean: 1, rarity: { rare: 2, uncommon: 3 } }, // (race: 1 by the sim; 2 as it takes five of one race)
  3: { race: 2, clean: 2, rarity: { epic: 1, rare: 3 } },
};
export const gradeOf = (c: Challenge): Grade => {
  const g = CHALLENGE_GRADES[c.dungeon];
  return c.quirk.kind === "rarity" ? g.rarity[c.quirk.top] ?? 2 : g[c.quirk.kind];
};

// What it pays, by boss and grade: enchanted weapons and armour between lo and hi (always enchanted),
// and essence crystals. 🧪 Claude's numbers: one good piece, better the deeper and the harder.
export type ChallengeReward = { pieces: number; lo: Rarity; hi: Rarity; crystals: number };
const pay = (pieces: number, lo: Rarity, hi: Rarity, crystals = 0): ChallengeReward => ({ pieces, lo, hi, crystals });
export const CHALLENGE_REWARDS: Record<ChallengeBoss, Record<Grade, ChallengeReward>> = {
  1: { 1: pay(1, "rare", "epic"),          2: pay(1, "epic", "epic"),              3: pay(1, "epic", "epic", 1) },
  2: { 1: pay(1, "epic", "epic"),          2: pay(1, "epic", "epic", 1),           3: pay(2, "epic", "epic", 1) },
  4: { 1: pay(1, "epic", "epic", 1),       2: pay(1, "legendary", "legendary"),    3: pay(1, "legendary", "legendary", 2) },
  3: { 1: pay(1, "legendary", "legendary"), 2: pay(1, "legendary", "legendary", 2), 3: pay(2, "legendary", "legendary", 2) },
};
export const rewardOf = (c: Challenge): ChallengeReward => CHALLENGE_REWARDS[c.dungeon][gradeOf(c)];
const WORD: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
export function rewardText(r: ChallengeReward): string {
  const what = r.lo === r.hi ? WORD[r.lo] : `${WORD[r.lo]} or ${WORD[r.hi]}`;
  const gear = r.pieces === 1 ? `An enchanted ${what} piece` : `${r.pieces} enchanted ${what} pieces`;
  return r.crystals ? `${gear} and ${r.crystals === 1 ? "an essence crystal" : `${r.crystals} essence crystals`}` : gear;
}
export function rollChallengeReward(r: ChallengeReward, rng: Rng = Math.random): Drop[] {
  const gear = Array.from({ length: r.pieces }, () => enchanted(gearPiece(r.lo, r.hi, rng), 1, rng));
  return [...gear, ...(r.crystals ? [materialDrop("essence", r.crystals)] : [])];
}

// ── Which one it is ─────────────────────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
// The window a date falls in (by the clock on this device, like the dailies' day), and when it ends.
const dayNumber = (now: Date) => Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
export const challengeKey = (now = new Date()) => `c${Math.floor(dayNumber(now) / CHALLENGE_DAYS)}`;
export const daysLeft = (now = new Date()) => CHALLENGE_DAYS - (dayNumber(now) % CHALLENGE_DAYS);
// Bosses beaten, by dungeon (run.ts meta: clears, deepClears, minoClears, abyssClears).
export type BossWins = Partial<Record<DungeonId, number>>;
// The window's Challenge for someone with these wins: the boss named, or the deepest below it they've
// beaten; null until the Cyclops is beaten.
export function pickChallenge(key: string, wins: BossWins): Challenge | null {
  let i = hash(`${key}:boss`) % CHALLENGE_BOSSES.length;
  while (i >= 0 && !((wins[CHALLENGE_BOSSES[i]] ?? 0) > 0)) i--;
  if (i < 0) return null;
  const dungeon = CHALLENGE_BOSSES[i];
  const kind = QUIRK_KINDS[hash(`${key}:quirk`) % QUIRK_KINDS.length];
  if (kind === "race") return { dungeon, quirk: { kind, race: RACES_V2[hash(`${key}:race`) % RACES_V2.length] } };
  if (kind === "clean") return { dungeon, quirk: { kind } };
  const caps = Object.keys(CHALLENGE_GRADES[dungeon].rarity) as Rarity[];
  return { dungeon, quirk: { kind, top: caps[hash(`${key}:cap`) % caps.length] } };
}

export const challengeName = (c: Challenge) => (c.quirk.kind === "race" ? "One of a kind" : c.quirk.kind === "clean" ? "Nothing to drink" : "Humble company");
export function challengeTask(c: Challenge): string {
  const boss = `Beat ${BOSS_NAMES[c.dungeon]}`;
  // (Short: the note has two lines for this and its reward.)
  if (c.quirk.kind === "race") return `${boss} with a full ${RACE_INFO[c.quirk.race].name} team`;
  if (c.quirk.kind === "clean") return `${boss} with no potions or elixirs`;
  return `${boss} with a full team, none above ${WORD[c.quirk.top]}`;
}

// ── Was it done? ────────────────────────────────────────────────────
// A won run: its dungeon, who went in (each one's races and rarity now), how many the dungeon takes,
// and whether a potion or an elixir was used on it.
export type WonRun = { dungeon: DungeonId; team: { races: readonly string[]; rarity: Rarity }[]; teamSize: number; usedItem: boolean };
export function meetsChallenge(c: Challenge, run: WonRun): boolean {
  if (run.dungeon !== c.dungeon) return false;
  const q = c.quirk;
  if (q.kind === "clean") return !run.usedItem;
  if (run.team.length < run.teamSize) return false;
  if (q.kind === "race") return run.team.every((m) => m.races.includes(q.race));
  return run.team.every((m) => ORDER.indexOf(m.rarity) <= ORDER.indexOf(q.top));
}

// ── Saved progress ──────────────────────────────────────────────────
// key: the window it's for; challenge: the one you got (null: locked, the Cyclops still stands);
// done, claimed; spoiled: the run (its id) a potion or an elixir was last used on.
export type ChallengeState = { key?: string; challenge?: Challenge | null; done?: boolean; claimed?: boolean; spoiled?: string };
// The state for this window: a new window gets its Challenge (for your wins). One that was locked
// when the window began opens as soon as the Cyclops falls.
export function challengeFor(s: ChallengeState, key: string, wins: BossWins): ChallengeState {
  if (s.key === key && s.challenge) return s;
  return { key, challenge: pickChallenge(key, wins), ...(s.spoiled ? { spoiled: s.spoiled } : {}) };
}
export const noteItemUsed = (s: ChallengeState, runId: string): ChallengeState => (s.spoiled === runId ? s : { ...s, spoiled: runId });
export const usedItemOn = (s: ChallengeState, runId: string) => s.spoiled === runId;
// A run won: done, if it's this window's and it met the quirk.
export const noteWin = (s: ChallengeState, run: WonRun): ChallengeState =>
  (s.challenge && !s.done && meetsChallenge(s.challenge, run) ? { ...s, done: true } : s);
export const canClaimChallenge = (s: ChallengeState) => !!s.challenge && !!s.done && !s.claimed;
export const claimChallenge = (s: ChallengeState): ChallengeState => (canClaimChallenge(s) ? { ...s, claimed: true } : s);

export const CHALLENGE_FIELD = "challenge";
export function loadChallenge(): ChallengeState {
  const c = readSave()[CHALLENGE_FIELD];
  return c && typeof c === "object" ? (c as ChallengeState) : {};
}
export function bossWins(): BossWins {
  const meta = ((readSave().labyrinth as { meta?: Record<string, number | undefined> } | undefined)?.meta ?? {});
  return { 1: meta.clears ?? 0, 2: meta.deepClears ?? 0, 3: meta.abyssClears ?? 0, 4: meta.minoClears ?? 0 };
}
// This window's, fixed in the save the first time it's seen. (Nothing's saved while it's locked: there's
// nothing to keep till the Cyclops is beaten.)
export function currentChallenge(now = new Date()): ChallengeState {
  const s = loadChallenge(), t = challengeFor(s, challengeKey(now), bossWins());
  if (t !== s && t.challenge) writeSaveField(CHALLENGE_FIELD, t);
  return t;
}
// Change it (read, change, write: whoever else wrote it meanwhile is kept). Locked, nothing changes.
export function updateChallenge(fn: (s: ChallengeState) => ChallengeState): ChallengeState {
  const s = currentChallenge();
  if (!s.challenge) return s;
  const next = fn(s);
  if (next !== s) writeSaveField(CHALLENGE_FIELD, next);
  return next;
}
// "Reset Player": it starts over.
export const clearChallenge = () => writeSaveField(CHALLENGE_FIELD, undefined);
