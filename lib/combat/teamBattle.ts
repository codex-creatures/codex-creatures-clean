// lib/combat/teamBattle.ts
// The auto-battler for team battles: decides a side's action (thinkingAi.ts
// builds on it). The rules themselves live in battle.ts, so AI battles and
// battles played by hand follow exactly the same rules.
//
// The AI swaps when its matchup is clearly losing and a teammate would
// clearly win it, even after taking the free hit.

import { ENERGY_REGEN, calcDamage, chooseSkill, effectiveAgil, type Fighter } from "./engine";
import {
  activeOf, affordableSkills, attackTargets, currentAgility, isCrippled, other,
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
    if (i === s.active || i === s.partner || f.hp <= 0) continue; // (an ambush partner is already on the field)
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
  if (s.boss) return { kind: "pass" }; // bosses are played by their script
  const me = activeOf(s);
  const foe = state.sides[other(key)];
  // Two enemies on the field? Focus the one closest to going down.
  const targets = attackTargets(state, key);
  const targetIdx = targets.length > 1
    ? targets.reduce((a, b) => (foe.team[b].hp / foe.team[b].maxHp < foe.team[a].hp / foe.team[a].maxHp ? b : a))
    : undefined;
  const them = targetIdx !== undefined ? foe.team[targetIdx] : activeOf(foe);

  // A creature that just came in stays at least one round (stops ping-ponging).
  const justSwapped = s.lastSwapRound === state.round;
  if (opts.canSwap && !justSwapped && matchupAdvantage(me, them) < (opts.swapWhenBelow ?? SWAP_WHEN_ADVANTAGE_BELOW)) {
    const best = bestReplacement(s, them, true);
    if (best && best.adv >= (opts.swapToAtLeast ?? SWAP_TO_ADVANTAGE_AT_LEAST)) return { kind: "swap", to: best.index };
  }

  const skill = aiChooseSkill(me, them);
  return skill ? { kind: "attack", skillName: skill.name, target: targetIdx } : { kind: "pass" };
}

// Move choice with the special moves in mind. Plain moves are valued by the
// damage they'd do (so without special moves this picks what chooseSkill
// picks); special moves add what a sensible player would see in them:
// - Precise: expected damage = hit chance × precise-hit damage (good vs tanks).
// - Cripple: worth an extra hit when it would make me faster than them.
// - Dash: worth their whole next hit when going first lets me knock them out before it lands.
export function aiChooseSkill(me: Combatant, them: Combatant): Skill | undefined {
  // Utility moves (Mirage, Corpsify) are left to the thinking AI's lookahead.
  const usable = affordableSkills(me);
  if (usable.length === 0) return undefined;
  const attacks = usable.filter((s) => !s.self);
  const affordable = attacks.length > 0 ? attacks : usable;
  // Any style: the value below already weighs races and armour.
  const pool = affordable;

  const myAgil = currentAgility(me), theirAgil = currentAgility(them);
  const theirHit = expectedDamage(them, me);
  // Damage past a knockout is worth nothing (overkill = false only for the walled check).
  const value = (s: Skill, overkill = false) => {
    const fx = s.effect;
    const hit = calcDamage(s, me, them, fx?.kind === "precise").damage;
    const counted = overkill ? hit : Math.min(hit, them.hp);
    let v = fx?.kind === "precise" ? counted * fx.hitChance : counted;
    if (fx?.kind === "cripple" && !isCrippled(them) && theirAgil >= myAgil && theirAgil * (1 - CRIPPLE_AGILITY_LOSS) < myAgil) {
      v += fx.chance * expectedDamage(me, them);
    }
    // Haste is this round only, so going first is only worth it for a knockout.
    if (fx?.kind === "dash" && hit >= them.hp && theirAgil >= myAgil && myAgil * (1 + fx.agilityBonus) > theirAgil) {
      v += theirHit;
    }
    return v;
  };

  // Walled (nothing gets through)? Then hammer the same spot: keep the
  // current run going with a move that pays for itself (it can't run dry).
  if (Math.max(...pool.map((s) => value(s, true))) <= WALLED_DAMAGE) {
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
