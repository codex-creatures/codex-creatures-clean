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
// Starting moves: the species' own (3 in Combat V2), and a small chance
// (RARE_MOVE_CHANCE) of a rare learnable move in the empty fourth slot.

import { LEARNABLE_MOVES, MOVE_SLOTS, defaultMoveNames, type CreatureProficiency, type CreatureTemplate } from "./creatureData";
import { rollSoulStone, type SoulStoneKey } from "./soulStones";

export const ROLL_SPREAD_SHARE = 0.04;    // max ± per stat, as a share of the species' total %s
export const ROLL_SPREAD_MIN = 2;
export const ROLL_TRANSFER_SHARE = 0.08;  // most 1-point moves, as a share of the total
export const ROLL_TRANSFERS_MIN = 4;
export const RARE_MOVE_CHANCE = 0.1;   // per move slot
// A move some species are always born knowing, in the fourth slot (in place of the rare roll): its signature move.
// The Labyrinth Sprite's Mirage (the user, 2026-11-26: "good utility move (I pick)").
export const BORN_MOVES: Record<string, string> = { labyrinth_sprite: "Mirage" };

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
  // Its HP % can take part too (a species with one), though the spread
  // stays sized by its other %s.
  const keys: ProfKey[] = base.hp === undefined ? KEYS : [...KEYS, "hp"];
  for (let i = 0; i < transfers; i++) {
    const from = keys.filter((k) => (p[k] ?? 0) > Math.max(0, (base[k] ?? 0) - spread));
    const fromKey = pick(from, rng);
    const to = keys.filter((k) => k !== fromKey && (p[k] ?? 0) < (base[k] ?? 0) + spread);
    if (!fromKey || to.length === 0) continue;
    const toKey = pick(to, rng);
    p[fromKey] = (p[fromKey] ?? 0) - 1;
    p[toKey] = (p[toKey] ?? 0) + 1;
  }
  return p;
}

export function rollMoves(c: CreatureTemplate, rng: Rng = Math.random): string[] {
  // Its species' starting moves (Combat V2: its main style's 3 core moves;
  // the rest come from codexes).
  const own = defaultMoveNames(c);
  // A rare move fills the empty slot, never replacing a starting move (the
  // user, 2026-10-26). Older species (all 4 slots full) have no room for one.
  // (A born move takes the slot; the roll is still made, so what's rolled after it is as it always was.)
  if (own.length >= MOVE_SLOTS) return own;
  const lucky = rng() < RARE_MOVE_CHANCE;
  const born = BORN_MOVES[c.id];
  if (born && !own.includes(born)) return [...own, born];
  if (!lucky) return own;
  const options = LEARNABLE_MOVES.filter((m) => m.type === c.cls && !own.includes(m.name));
  return options.length > 0 ? [...own, pick(options, rng).name] : own;
}

// soulStone: the passive power some Rare+ creatures are born with (lib/creatures/soulStones.ts); null: none.
export type CreatureRoll = { proficiency: CreatureProficiency; moves: string[]; soulStone?: SoulStoneKey | null };

export function rollCreature(c: CreatureTemplate, rng: Rng = Math.random): CreatureRoll {
  const proficiency = rollProficiency(c.proficiency, rng);
  const moves = rollMoves(c, rng);
  return { proficiency, moves, soulStone: rollSoulStone(c, rng) ?? null };
}
