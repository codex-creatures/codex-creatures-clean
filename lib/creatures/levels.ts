// lib/creatures/levels.ts
// Creature levels (1 to MAX_LEVEL for the closed beta).
//
// A creature's %s have two parts:
// - its species' %s, which grow with level: none at level 1, the species'
//   full values at REF_LEVEL (what every creature used to be), and on up
//   past that to MAX_LEVEL;
// - its own roll (the ±s it was born with), which never changes.
// So at level 1 a creature is little more than its rolls — two Legendaries
// of the same species in the same gear are almost the same, bar their HP —
// and the higher it climbs, the more its species (and its rarity) shows.
//
// HP grows too, from HP_AT_LEVEL_1 of its level-REF_LEVEL HP. Everyone's HP
// is HP_SCALE times what it used to be.
//
// XP: every enemy knocked out adds to the fight's XP, which is shared across
// your team by how much each creature did (shareXp; won or lost). Levelling
// needs xpToNext(level) XP.

import type { CreatureProficiency, CreatureTemplate } from "./creatureData";
import type { Rarity } from "../types";

export const MAX_LEVEL = 30;
export const REF_LEVEL = 15;      // the level a creature's species %s are "as listed"
export const HP_SCALE = 1.5;      // HP is bigger in general
export const HP_AT_LEVEL_1 = 0.6; // share of its level-15 HP a creature has at level 1

const KEYS: (keyof CreatureProficiency)[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];

export const clampLevel = (level: number | undefined) => Math.max(1, Math.min(MAX_LEVEL, Math.round(level ?? 1)));

// How much of its species' %s a creature has at this level (0 at level 1, 1 at REF_LEVEL).
export const levelFactor = (level: number) => (clampLevel(level) - 1) / (REF_LEVEL - 1);

// Its rolls: how its %s differ from its species' (the zero-sum ±s).
export function rollsOf(t: CreatureTemplate, rolled?: CreatureProficiency): CreatureProficiency {
  const out = {} as CreatureProficiency;
  for (const k of KEYS) out[k] = (rolled?.[k] ?? t.proficiency[k] ?? 0) - (t.proficiency[k] ?? 0);
  return out;
}

// Its %s at a level: the species' share for that level, plus its own rolls.
// rolled: its saved %s (species + rolls); missing = no rolls.
export function proficiencyAt(t: CreatureTemplate, rolled: CreatureProficiency | undefined, level: number): CreatureProficiency {
  const f = levelFactor(level);
  const rolls = rollsOf(t, rolled);
  const out = {} as CreatureProficiency;
  for (const k of KEYS) out[k] = Math.round((t.proficiency[k] ?? 0) * f) + rolls[k];
  return out;
}

// Its HP at a level (before gear).
export function hpAt(t: CreatureTemplate, level: number): number {
  const f = levelFactor(level);
  return Math.round(t.baseHp * HP_SCALE * (HP_AT_LEVEL_1 + (1 - HP_AT_LEVEL_1) * f));
}

// ── XP ────────────────────────────────────────────────────────────
// Gets steeper as you climb (the L² part), so the last levels take a while.
// XP_PACE slows the whole climb (1.5 = half as much XP again per level).
export const XP_PACE = 1.5;
export const xpToNext = (level: number) => { const L = clampLevel(level); return Math.round(XP_PACE * (25 + 15 * L + (L * L) / 2)); };
const RARITY_XP: Record<Rarity, number> = { common: 1, uncommon: 1.2, rare: 1.5, epic: 2, legendary: 3 };

// XP for knocking out one enemy.
export const xpForEnemy = (level: number, rarity: Rarity) => Math.round((8 + 4 * clampLevel(level)) * RARITY_XP[rarity]);
export const BOSS_XP = 200; // each part of a boss

export type Progress = { level: number; xp: number }; // xp: towards the next level

// Add XP; returns the new level and leftover XP (and how many levels it gained).
export function addXp(p: Progress, gained: number): Progress & { gained: number } {
  let level = clampLevel(p.level), xp = Math.max(0, p.xp) + Math.max(0, gained), up = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    up++;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp, gained: up };
}

// ── Sharing a fight's XP ──────────────────────────────────────────
// A fight's XP (every enemy knocked out) is shared across your team by how
// much each creature did: damage dealt, plus half the damage it soaked up.
// Everyone on the team gets at least MIN_SHARE of it — even one that never
// left the bench — so a weak creature can be levelled up by tagging along.
export const MIN_SHARE = 0.1;
export const TANK_WEIGHT = 0.5;

export type Impact = { dealt: number; taken: number };
export const impactOf = (i: Impact) => Math.max(0, i.dealt) + TANK_WEIGHT * Math.max(0, i.taken);

// Each member's XP from a pool (rounded; the floor is MIN_SHARE each).
export function shareXp(pool: number, impacts: Impact[]): number[] {
  const n = impacts.length;
  if (n === 0 || pool <= 0) return impacts.map(() => 0);
  const floor = Math.min(MIN_SHARE, 1 / n);
  const rest = 1 - floor * n;
  const scores = impacts.map(impactOf);
  const total = scores.reduce((a, b) => a + b, 0);
  return scores.map((s) => Math.round(pool * (floor + rest * (total > 0 ? s / total : 1 / n))));
}

// Who did what in a fight, from its log (attack entries carry indices).
export function impactsFromLog(
  log: readonly { type: string; side?: string; damage?: number; missed?: boolean; attackerIndex?: number; targetIndex?: number }[],
  side: "A" | "B", teamSize: number,
): Impact[] {
  const out: Impact[] = Array.from({ length: teamSize }, () => ({ dealt: 0, taken: 0 }));
  for (const e of log) {
    if (e.type !== "attack" || e.missed || !e.damage) continue;
    if (e.side === side && e.attackerIndex != null && out[e.attackerIndex]) out[e.attackerIndex].dealt += e.damage;
    if (e.side !== side && e.targetIndex != null && out[e.targetIndex]) out[e.targetIndex].taken += e.damage;
  }
  return out;
}

// ── The player's own level ────────────────────────────────────────
// You (the explorer) level up too, from every fight's full XP. Your level
// decides how rare a creature you can find when you scan (SCAN_UNLOCK):
// anything rarer stays sealed in its barcode until you're strong enough.
export const PLAYER_MAX_LEVEL = 30;
export const playerXpToNext = (level: number) => 60 + 40 * Math.max(1, Math.round(level));
// (Sim: explorer Lv 2 comes on run 2–3, Lv 6 around run 7, Lv 12 around the first Cyclops kill.)
export const SCAN_UNLOCK: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 2, epic: 6, legendary: 12 };
export const canFind = (playerLevel: number, rarity: Rarity) => playerLevel >= SCAN_UNLOCK[rarity];

export function addPlayerXp(p: Progress, gained: number): Progress & { gained: number } {
  let level = Math.max(1, Math.round(p.level)), xp = Math.max(0, p.xp) + Math.max(0, gained), up = 0;
  while (level < PLAYER_MAX_LEVEL && xp >= playerXpToNext(level)) {
    xp -= playerXpToNext(level);
    level++;
    up++;
  }
  if (level >= PLAYER_MAX_LEVEL) xp = 0;
  return { level, xp, gained: up };
}

// Total XP needed to get from level 1 to this level.
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < clampLevel(level); l++) total += xpToNext(l);
  return total;
}

// An XP scroll: read it to give one creature (or Klutz) the XP that takes a
// creature from level 1 to SCROLL_LEVEL, so it's big early on and fades as
// a creature climbs. Found in mini boss and boss chests; sometimes sold by
// a wandering merchant (lib/dungeon/run.ts).
export const SCROLL_LEVEL = 5;
export const SCROLL_XP = xpToReach(SCROLL_LEVEL);
