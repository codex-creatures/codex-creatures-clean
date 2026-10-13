// lib/combat/teamBattle.ts
// 3v3 team battles: one active creature per side, swapping allowed.
//
// Rules (confirmed by design):
// - Each round, both sides either ATTACK or SWAP.
// - Swaps resolve first, then attacks in Agility order — so a side that swaps
//   gives the opponent a free hit on the creature coming in.
// - The creature swapped out restores 50% of its missing energy.
// - A fainted creature is replaced straight away (free); the replacement
//   doesn't act until next round.
// - A side loses when all its creatures have fainted.
//
// The auto-battler swaps when its matchup is clearly losing and a teammate
// would clearly win it, even after taking the free hit.

import {
  calcDamage, chooseSkill, effectiveAgil,
  MAX_ENERGY, ENERGY_REGEN, PRECISE_CHANCE,
  type Fighter,
} from "./engine";

export const SWAP_ENERGY_RESTORE = 0.5; // share of MISSING energy restored on swap-out
export const MAX_ROUNDS = 100;

// Swap when my matchup advantage is below this (0.5 = they'd KO me in
// half the hits I need)...
export const SWAP_WHEN_ADVANTAGE_BELOW = 0.5;
// ...and a teammate's advantage, after taking the free hit, is at least this.
export const SWAP_TO_ADVANTAGE_AT_LEAST = 1;

export type TeamBattleOptions = {
  swapsA: boolean;
  swapsB: boolean;
  // Overrides for balance experiments (defaults above).
  swapWhenBelow?: number;
  swapToAtLeast?: number;
  swapEnergyRestore?: number;
  // false = send in the next creature in team order after a faint
  // instead of the best matchup (to measure how much matchup choice matters).
  smartReplaceA?: boolean;
  smartReplaceB?: boolean;
};

export type TeamBattleResult = {
  winner: "A" | "B" | "draw";
  rounds: number;
  swapsA: number;
  swapsB: number;
  hits: number;
  minDamageHits: number;
  survivorsA: number;
  survivorsB: number;
};

type Side = {
  key: "A" | "B";
  team: Fighter[];
  active: number;
  canSwap: boolean;
  swaps: number;
  lastSwapRound: number;
};

// ── Matchup reading (what the auto-battler "thinks") ───────────────
function expectedDamage(atk: Fighter, def: Fighter): number {
  const s = chooseSkill(atk, def);
  return s ? calcDamage(s, atk, def, false).damage : 0;
}

function hitsToKo(atk: Fighter, def: Fighter): number {
  const d = expectedDamage(atk, def);
  return d <= 0 ? Infinity : Math.ceil(def.hp / d);
}

// > 1: I knock them out before they knock me out.
// The faster creature strikes first, worth roughly half a hit's head start.
export function matchupAdvantage(me: Fighter, them: Fighter): number {
  const theyNeed = hitsToKo(them, me);
  const iNeed = hitsToKo(me, them);
  if (!isFinite(theyNeed) && !isFinite(iNeed)) return 1;
  if (!isFinite(iNeed)) return 0;
  if (!isFinite(theyNeed)) return Infinity;
  const meFirst = effectiveAgil(me) >= effectiveAgil(them);
  return (theyNeed + (meFirst ? 0.5 : 0)) / (iNeed + (meFirst ? 0 : 0.5));
}

const alive = (s: Side) => s.team.filter((f) => f.hp > 0);
const activeOf = (s: Side) => s.team[s.active];

// Best teammate to send in vs `them`; `takesFreeHit` models a voluntary swap.
function bestReplacement(s: Side, them: Fighter, takesFreeHit: boolean): { index: number; adv: number } | null {
  let best: { index: number; adv: number } | null = null;
  for (let i = 0; i < s.team.length; i++) {
    const f = s.team[i];
    if (i === s.active || f.hp <= 0) continue;
    const incoming = takesFreeHit ? { ...f, hp: f.hp - expectedDamage(them, f) } : f;
    if (incoming.hp <= 0) continue;
    const adv = matchupAdvantage(incoming, them);
    if (!best || adv > best.adv) best = { index: i, adv };
  }
  return best;
}

function decideSwap(s: Side, them: Fighter, round: number, opts: TeamBattleOptions): number | null {
  if (!s.canSwap) return null;
  if (s.lastSwapRound === round - 1) return null; // a creature that just came in stays a round
  const me = activeOf(s);
  if (matchupAdvantage(me, them) >= (opts.swapWhenBelow ?? SWAP_WHEN_ADVANTAGE_BELOW)) return null;
  const best = bestReplacement(s, them, true);
  return best && best.adv >= (opts.swapToAtLeast ?? SWAP_TO_ADVANTAGE_AT_LEAST) ? best.index : null;
}

function sendInReplacement(s: Side, them: Fighter, smart: boolean) {
  if (!smart) {
    const next = s.team.findIndex((f) => f.hp > 0);
    if (next !== -1) s.active = next;
    return;
  }
  const best = bestReplacement(s, them, false);
  if (best) s.active = best.index;
}

export function runTeamBattle(teamA: Fighter[], teamB: Fighter[], opts: TeamBattleOptions): TeamBattleResult {
  const fresh = (t: Fighter[]) => t.map((f) => ({ ...f, hp: f.maxHp, energy: MAX_ENERGY }));
  const A: Side = { key: "A", team: fresh(teamA), active: 0, canSwap: opts.swapsA, swaps: 0, lastSwapRound: -99 };
  const B: Side = { key: "B", team: fresh(teamB), active: 0, canSwap: opts.swapsB, swaps: 0, lastSwapRound: -99 };

  let round = 0, hits = 0, minDamageHits = 0;

  while (alive(A).length > 0 && alive(B).length > 0 && round < MAX_ROUNDS) {
    round++;

    // 1. Both sides decide (based on the board at the start of the round).
    const swapA = decideSwap(A, activeOf(B), round, opts);
    const swapB = decideSwap(B, activeOf(A), round, opts);

    // 2. Swaps resolve first.
    for (const [side, target] of [[A, swapA], [B, swapB]] as const) {
      if (target === null) continue;
      const leaving = activeOf(side);
      leaving.energy += (MAX_ENERGY - leaving.energy) * (opts.swapEnergyRestore ?? SWAP_ENERGY_RESTORE);
      side.active = target;
      side.swaps++;
      side.lastSwapRound = round;
    }

    // 3. Attacks in Agility order (ties random). Swappers don't attack.
    const attackers = [
      ...(swapA === null ? [{ side: A, foe: B, actor: activeOf(A) }] : []),
      ...(swapB === null ? [{ side: B, foe: A, actor: activeOf(B) }] : []),
    ].sort((x, y) => (effectiveAgil(y.actor) - effectiveAgil(x.actor)) || (Math.random() - 0.5));

    for (const { side, foe, actor } of attackers) {
      if (actor.hp <= 0 || activeOf(side) !== actor) continue; // fainted before acting
      const target = activeOf(foe);
      if (target.hp <= 0) continue;
      const skill = chooseSkill(actor, target);
      if (!skill) continue;

      const { damage } = calcDamage(skill, actor, target, Math.random() < PRECISE_CHANCE);
      hits++;
      if (damage <= 1) minDamageHits++;
      actor.energy = Math.min(MAX_ENERGY, actor.energy - skill.energyCost + ENERGY_REGEN);
      target.hp = Math.max(0, target.hp - damage);

      if (target.hp <= 0 && alive(foe).length > 0) {
        sendInReplacement(foe, actor, (foe.key === "A" ? opts.smartReplaceA : opts.smartReplaceB) ?? true);
      }
    }
  }

  const aAlive = alive(A).length, bAlive = alive(B).length;
  return {
    winner: aAlive > 0 && bAlive === 0 ? "A" : bAlive > 0 && aAlive === 0 ? "B" : "draw",
    rounds: round,
    swapsA: A.swaps,
    swapsB: B.swaps,
    hits,
    minDamageHits,
    survivorsA: aAlive,
    survivorsB: bAlive,
  };
}
