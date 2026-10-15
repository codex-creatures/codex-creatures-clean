// lib/creatures/creatureRoll.ts
// Every creature (and creature card) is an individual: its proficiency %s
// are rolled around its species' values, and it starts with its own moves.
//
// % roll: points move between stats one at a time, so the total never
// changes, and no stat ends up more than ROLL_SPREAD away from the species
// value. E.g. Ranged +2 / Ranged Defence −2, or a spread of ±1s.
//
// Starting moves: picked from the species' own moves; each slot has a small
// chance to be a rare (learnable) move instead.

import { LEARNABLE_MOVES, MOVE_SLOTS, type CreatureProficiency, type CreatureTemplate } from "./creatureData";
import { rollAbility, type AbilityKey } from "./abilities";

export const ROLL_SPREAD = 2;          // max ± per stat
export const ROLL_TRANSFERS = [1, 4];  // how many 1-point moves (min, max)
export const RARE_MOVE_CHANCE = 0.1;   // per move slot

type Rng = () => number;
type ProfKey = keyof CreatureProficiency;
const KEYS: ProfKey[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef"];

const randInt = (min: number, max: number, rng: Rng) => min + Math.floor(rng() * (max - min + 1));
const pick = <T,>(arr: T[], rng: Rng) => arr[Math.floor(rng() * arr.length)];

export function rollProficiency(base: CreatureProficiency, rng: Rng = Math.random): CreatureProficiency {
  const p = { ...base };
  const transfers = randInt(ROLL_TRANSFERS[0], ROLL_TRANSFERS[1], rng);
  for (let i = 0; i < transfers; i++) {
    const from = KEYS.filter((k) => (p[k] ?? 0) > Math.max(0, (base[k] ?? 0) - ROLL_SPREAD));
    const fromKey = pick(from, rng);
    const to = KEYS.filter((k) => k !== fromKey && p[k] < base[k] + ROLL_SPREAD);
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
