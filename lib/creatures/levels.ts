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
// XP: every enemy knocked out gives XP to each of your creatures that took
// part in the fight (won or lost). Levelling needs xpToNext(level) XP.

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
export const xpToNext = (level: number) => 25 + 15 * clampLevel(level);
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

// Total XP needed to get from level 1 to this level.
export function xpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < clampLevel(level); l++) total += xpToNext(l);
  return total;
}
