// lib/combat/teamBattle.ts
// The auto-battler for team battles: decides each side's action, and runs
// whole battles for the Balance Lab. The rules themselves live in battle.ts,
// so AI battles and battles played by hand follow exactly the same rules.
//
// The AI swaps when its matchup is clearly losing and a teammate would
// clearly win it, even after taking the free hit.

import { AUTO_BATTLE, ENERGY_REGEN, calcDamage, chooseSkill, combatStyle, effectiveAgil, type Fighter } from "./engine";
import {
  activeOf, affordableSkills, createBattle, currentAgility, isCrippled, other, resolveRound, sendInReplacement,
  CRIPPLE_AGILITY_LOSS,
  type BattleAction, type BattleSide, type BattleState, type Combatant, type SideKey,
} from "./battle";
import type { Skill } from "../creatures/creatureData";

export { SWAP_ENERGY_RESTORE, MAX_ROUNDS } from "./battle";

// Swap when my matchup advantage is below this (0.5 = they'd KO me in
// half the hits I need)...
export const SWAP_WHEN_ADVANTAGE_BELOW = 0.5;
// ...and a teammate's advantage, after taking the free hit, is at least this.
export const SWAP_TO_ADVANTAGE_AT_LEAST = 1;

export type AiOptions = {
  canSwap: boolean;
  swapWhenBelow?: number;
  swapToAtLeast?: number;
  // false = send in the next creature in team order after a faint
  // instead of the best matchup.
  smartReplace?: boolean;
};

export type TeamBattleOptions = {
  swapsA: boolean;
  swapsB: boolean;
  // Overrides for balance experiments (defaults above).
  swapWhenBelow?: number;
  swapToAtLeast?: number;
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

// Best teammate to send in vs `them`; `takesFreeHit` models a voluntary swap.
function bestReplacement(s: BattleSide, them: Fighter, takesFreeHit: boolean): { index: number; adv: number } | null {
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

// ── AI decisions ───────────────────────────────────────────────────
export function aiChooseAction(state: BattleState, key: SideKey, opts: AiOptions): BattleAction {
  const s = state.sides[key];
  const me = activeOf(s);
  const them = activeOf(state.sides[other(key)]);

  // A creature that just came in stays at least one round (stops ping-ponging).
  const justSwapped = s.lastSwapRound === state.round;
  if (opts.canSwap && !justSwapped && matchupAdvantage(me, them) < (opts.swapWhenBelow ?? SWAP_WHEN_ADVANTAGE_BELOW)) {
    const best = bestReplacement(s, them, true);
    if (best && best.adv >= (opts.swapToAtLeast ?? SWAP_TO_ADVANTAGE_AT_LEAST)) return { kind: "swap", to: best.index };
  }

  const skill = aiChooseSkill(me, them);
  return skill ? { kind: "attack", skillName: skill.name } : { kind: "pass" };
}

// Move choice with the special moves in mind. Plain moves are valued by the
// damage they'd do (so without special moves this picks what chooseSkill
// picks); special moves add what a sensible player would see in them:
// - Precise: expected damage = hit chance × precise-hit damage (good vs tanks).
// - Cripple: worth an extra hit when it would make me faster than them.
// - Dash: worth their next hit when going first lets me knock them out.
export function aiChooseSkill(me: Combatant, them: Combatant): Skill | undefined {
  const affordable = affordableSkills(me);
  if (affordable.length === 0) return undefined;
  const style = combatStyle(me);
  const own = style === "hybrid" || AUTO_BATTLE.policy === "maxDamage" ? affordable : affordable.filter((s) => s.type === style);
  const pool = own.length > 0 ? own : affordable;

  const myAgil = currentAgility(me), theirAgil = currentAgility(them);
  const theirHit = expectedDamage(them, me);
  const value = (s: Skill) => {
    const fx = s.effect;
    const hit = calcDamage(s, me, them, fx?.kind === "precise").damage;
    let v = fx?.kind === "precise" ? hit * fx.hitChance : hit;
    if (fx?.kind === "cripple" && !isCrippled(them) && theirAgil >= myAgil && theirAgil * (1 - CRIPPLE_AGILITY_LOSS) < myAgil) {
      v += fx.chance * expectedDamage(me, them);
    }
    if (fx?.kind === "dash" && theirAgil >= myAgil && myAgil * (1 + fx.agilityBonus) > theirAgil && hit >= them.hp) {
      v += theirHit;
    }
    return v;
  };

  // Walled (nothing gets through)? Then hammer the same spot: keep the
  // current run going with a move that pays for itself, so the armour gap opens.
  if (Math.max(...pool.map(value)) <= WALLED_DAMAGE) {
    const sustainable = pool.filter((s) => s.energyCost <= ENERGY_REGEN);
    const run = sustainable.find((s) => s.name === me.streak?.move);
    if (run) return run;
    if (sustainable.length > 0) return sustainable.reduce((best, s) => (s.damage > best.damage ? s : best));
  }

  return pool.reduce((best, s) => {
    const d = value(s) - value(best);
    return d > 0 || (d === 0 && s.damage > best.damage) ? s : best;
  });
}

// A hit this small means the defender has walled the attacker.
export const WALLED_DAMAGE = 3;

export function aiChooseReplacement(state: BattleState, key: SideKey, smart = true): number {
  const s = state.sides[key];
  if (smart) {
    const best = bestReplacement(s, activeOf(state.sides[other(key)]), false);
    if (best) return best.index;
  }
  return s.team.findIndex((f) => f.hp > 0);
}

// ── Whole battle, both sides AI (Balance Lab) ──────────────────────
// Balance experiments can plug in another AI (e.g. the thinking AI from
// thinkingAi.ts) for both sides; the per-side swap options then don't apply.
export const TEAM_AI: {
  choose?: (state: BattleState, key: SideKey) => BattleAction;
  replace?: (state: BattleState, key: SideKey) => number;
} = {};

export function runTeamBattle(teamA: Fighter[], teamB: Fighter[], opts: TeamBattleOptions): TeamBattleResult {
  const state = createBattle(teamA, teamB);
  const ai: Record<SideKey, AiOptions> = {
    A: { canSwap: opts.swapsA, swapWhenBelow: opts.swapWhenBelow, swapToAtLeast: opts.swapToAtLeast, smartReplace: opts.smartReplaceA },
    B: { canSwap: opts.swapsB, swapWhenBelow: opts.swapWhenBelow, swapToAtLeast: opts.swapToAtLeast, smartReplace: opts.smartReplaceB },
  };

  while (!state.winner) {
    const choose = (k: SideKey) => (TEAM_AI.choose ? TEAM_AI.choose(state, k) : aiChooseAction(state, k, ai[k]));
    resolveRound(state, { A: choose("A"), B: choose("B") });
    for (const k of [...state.needsReplacement]) {
      sendInReplacement(state, k, TEAM_AI.replace ? TEAM_AI.replace(state, k) : aiChooseReplacement(state, k, ai[k].smartReplace ?? true));
    }
  }

  const alive = (k: SideKey) => state.sides[k].team.filter((f) => f.hp > 0).length;
  return {
    winner: state.winner ?? "draw",
    rounds: state.round,
    swapsA: state.sides.A.swaps,
    swapsB: state.sides.B.swaps,
    hits: state.hits,
    minDamageHits: state.minDamageHits,
    survivorsA: alive("A"),
    survivorsB: alive("B"),
  };
}
