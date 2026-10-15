// lib/creatures/creatureRoll.ts
// Every creature (and creature card) is an individual: its proficiency %s
// are rolled around its species' values, and it starts with its own moves.
//
// % roll: points move between stats one at a time, so the total never
// changes. How far a roll can stray grows with the species' total %s, so
// rarer creatures (with more to play with) vary more:
// - no stat ends up more than rollSpread() away from the species value
//   (ROLL_SPREAD_SHARE of the total, at least ROLL_SPREAD_MIN);
// - 1 to rollTransfers() points move (ROLL_TRANSFER_SHARE of the total, at
//   least ROLL_TRANSFERS_MIN).
// E.g. a Common (~40 total): ±2, up to 4 points moved. A Legendary (~200):
// ±8, up to 16.
//
// Starting moves: picked from the species' own moves; each slot has a small
// chance to be a rare (learnable) move instead.

import { LEARNABLE_MOVES, MOVE_SLOTS, type CreatureProficiency, type CreatureTemplate } from "./creatureData";
import { rollAbility, type AbilityKey } from "./abilities";

export const ROLL_SPREAD_SHARE = 0.04;    // max ± per stat, as a share of the species' total %s
export const ROLL_SPREAD_MIN = 2;
export const ROLL_TRANSFER_SHARE = 0.08;  // most 1-point moves, as a share of the total
export const ROLL_TRANSFERS_MIN = 4;
export const RARE_MOVE_CHANCE = 0.1;   // per move slot

type Rng = () => number;
type ProfKey = keyof CreatureProficiency;
const KEYS: ProfKey[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];

const randInt = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

const total = (p: CreatureProficiency) => KEYS.reduce((s, k) => s + (p[k] ?? 0), 0);
export const rollSpread = (base: CreatureProficiency) => Math.max(ROLL_SPREAD_MIN, Math.round(total(base) * ROLL_SPREAD_SHARE));
export const rollTransfers = (base: CreatureProficiency) => Math.max(ROLL_TRANSFERS_MIN, Math.round(total(base) * ROLL_TRANSFER_SHARE));

export function rollProficiency(base: CreatureProficiency, rng: Rng = Math.random): CreatureProficiency {
  const p = { ...base };
  const spread = rollSpread(base);
  const transfers = randInt(1, rollTransfers(base), rng);
  for (let i = 0; i < transfers; i++) {
    const from = KEYS.filter((k) => (p[k] ?? 0) > Math.max(0, (base[k] ?? 0) - spread));
    const fromKey = pick(from, rng);
    const to = KEYS.filter((k) => k !== fromKey && p[k] < base[k] + spread);
    if (!fromKey || to.length === 0) continue;
    const toKey = pick(to, rng);
    p[fromKey]--;
    p[toKey]++;
  }
  return p;
}

export function rollMoves(c: CreatureTemplate, rng: Rng = Math.random): string[] {
  // Species moves in a random order, first MOVE_SLOTS of them.
  const own = [...c.skills].sort(() => rng() - 0.5).slice(0, MOVE_SLOTS).map((m) => m.name);
  const fitting = LEARNABLE_MOVES.filter((m) => m.type === c.cls);
  const moves = [...own];
  for (let i = 0; i < MOVE_SLOTS; i++) {
    if (rng() >= RARE_MOVE_CHANCE) continue;
    const options = fitting.filter((m) => !moves.includes(m.name));
    if (options.length > 0) moves[i] = pick(options, rng).name; // fills an empty slot too
  }
  // Keep species moves first, then rare ones (only for display order).
  return moves.filter(Boolean).sort((a, b) => Number(!own.includes(a)) - Number(!own.includes(b)));
}

// ability: a rare passive some Epic+ creatures are born with (lib/creatures/abilities.ts).
export type CreatureRoll = { proficiency: CreatureProficiency; moves: string[]; ability?: AbilityKey };

export function rollCreature(c: CreatureTemplate, rng: Rng = Math.random): CreatureRoll {
  const proficiency = rollProficiency(c.proficiency, rng);
  const moves = rollMoves(c, rng);
  const ability = rollAbility(c, rng);
  return ability ? { proficiency, moves, ability } : { proficiency, moves };
}

// How a roll differs from the species: { rng: +2, rdef: -2 } etc. (0s left out).
export function rollDiff(c: CreatureTemplate, p: CreatureProficiency): Partial<Record<ProfKey, number>> {
  const out: Partial<Record<ProfKey, number>> = {};
  for (const k of KEYS) if (p[k] !== c.proficiency[k]) out[k] = p[k] - c.proficiency[k];
  return out;
}
