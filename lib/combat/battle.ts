// lib/combat/battle.ts
// Turn-by-turn team battle engine (3v3 by default). It is used both for
// playing by hand (each round's actions are supplied one round at a time) and
// by the auto-battler / Balance Lab (lib/combat/teamBattle.ts), so the rules
// live in one place.
//
// Rules (confirmed by design):
// - One active creature per side. Each round both sides pick ONE action.
// - Swaps resolve first, then attacks in Agility order (ties random). A side
//   that swaps gives the opponent a free hit on the creature coming in.
// - The creature swapped out restores 50% of its missing energy.
// - Attacking costs the move's energy, then +30 energy (max 100).
// - A fainted creature is replaced at the end of the round (free). The
//   replacement doesn't act until next round.
// - A side loses when all its creatures have fainted.
//
// Built to grow: new kinds of action (e.g. a battle-bag item or weapon
// swap) are added to BattleAction, and per-creature status effects
// (cripple, fear, blind, …) live in Combatant.statuses with a duration.

import {
  calcDamage, effectiveAgil,
  MAX_ENERGY, ENERGY_REGEN, PRECISE_CHANCE,
  type Fighter,
} from "./engine";
import type { Skill } from "../creatures/creatureData";

export const SWAP_ENERGY_RESTORE = 0.5; // share of MISSING energy restored on swap-out
export const MAX_ROUNDS = 100;

// Cripple (from Cripple / Crippling Shot): the target loses agility for the
// next few rounds. Re-crippling refreshes the duration; it doesn't stack.
// It keeps counting down while the creature is on the bench.
export const CRIPPLE_AGILITY_LOSS = 0.25;
export const CRIPPLE_ROUNDS = 3;

export type SideKey = "A" | "B";

// Future: { kind: "item"; bagIndex: number } for the battle bag.
export type BattleAction =
  | { kind: "attack"; skillName: string }
  | { kind: "swap"; to: number }
  | { kind: "pass" }; // nothing affordable / no action

// Placeholder for status effects (cripple, fear, blind, vampirism…).
// `rounds` counts down at the end of each round; at 0 the status ends.
export type StatusEffect = { id: string; rounds: number };

export type Combatant = Fighter & { statuses: StatusEffect[] };

export type BattleSide = {
  key: SideKey;
  team: Combatant[];
  active: number;
  swaps: number;
  lastSwapRound: number;
};

export type BattleEvent =
  | { type: "round"; round: number }
  | { type: "swap"; side: SideKey; from: string; to: string; toIndex: number; energyRestored: number }
  | { type: "attack"; side: SideKey; attacker: string; target: string; skill: Skill; damage: number; precise: boolean; missed: boolean;
      crippled: boolean; targetHpAfter: number; attackerEnergyAfter: number }
  | { type: "pass"; side: SideKey; name: string }
  | { type: "faint"; side: SideKey; name: string }
  | { type: "sendIn"; side: SideKey; name: string; index: number }
  | { type: "end"; winner: SideKey | "draw" };

export type BattleState = {
  round: number;
  sides: Record<SideKey, BattleSide>;
  // Sides whose active creature fainted and must send in a replacement
  // before the next round.
  needsReplacement: SideKey[];
  winner: SideKey | "draw" | null;
  log: BattleEvent[];
  // Running totals for the Balance Lab.
  hits: number;
  minDamageHits: number;
};

export const other = (k: SideKey): SideKey => (k === "A" ? "B" : "A");
export const activeOf = (s: BattleSide) => s.team[s.active];
export const aliveCount = (s: BattleSide) => s.team.filter((f) => f.hp > 0).length;

export function createBattle(teamA: Fighter[], teamB: Fighter[]): BattleState {
  const fresh = (t: Fighter[]): Combatant[] =>
    t.map((f) => ({ ...f, hp: f.maxHp, energy: MAX_ENERGY, statuses: [] }));
  const side = (key: SideKey, team: Fighter[]): BattleSide =>
    ({ key, team: fresh(team), active: 0, swaps: 0, lastSwapRound: -99 });
  return {
    round: 0,
    sides: { A: side("A", teamA), B: side("B", teamB) },
    needsReplacement: [],
    winner: null,
    log: [],
    hits: 0,
    minDamageHits: 0,
  };
}

// ── Status effects ─────────────────────────────────────────────────
export const isCrippled = (f: Combatant) => f.statuses.some((s) => s.id === "cripple");

// Agility right now (cripple included).
export function currentAgility(f: Combatant): number {
  return effectiveAgil(f) * (isCrippled(f) ? 1 - CRIPPLE_AGILITY_LOSS : 1);
}

// Agility used for this round's turn order (adds a dash move's bonus).
export function turnAgility(f: Combatant, action: BattleAction): number {
  const skill = action.kind === "attack" ? f.skills.find((s) => s.name === action.skillName) : undefined;
  const dash = skill?.effect?.kind === "dash" ? skill.effect.agilityBonus : 0;
  return currentAgility(f) * (1 + dash);
}

// ── What a side is allowed to do right now ─────────────────────────
export function affordableSkills(f: Combatant): Skill[] {
  return f.skills.filter((s) => s.energyCost <= f.energy);
}

// Bench creatures this side could swap to. (Future: fear blocks this.)
export function swapTargets(s: BattleSide): number[] {
  return s.team.map((f, i) => i).filter((i) => i !== s.active && s.team[i].hp > 0);
}

export function isValidAction(state: BattleState, key: SideKey, a: BattleAction): boolean {
  const s = state.sides[key];
  const me = activeOf(s);
  switch (a.kind) {
    case "attack": return affordableSkills(me).some((sk) => sk.name === a.skillName);
    case "swap":   return swapTargets(s).includes(a.to);
    case "pass":   return affordableSkills(me).length === 0;
  }
}

// Damage this move would do to the opponent's current creature (no precise hit).
export function previewDamage(state: BattleState, key: SideKey, skill: Skill): number {
  const me = activeOf(state.sides[key]);
  const them = activeOf(state.sides[other(key)]);
  return calcDamage(skill, me, them, false).damage;
}

// ── Resolving a round ──────────────────────────────────────────────
// Mutates and returns `state` (clone first if you need the old one).
export function resolveRound(state: BattleState, actions: Record<SideKey, BattleAction>): BattleState {
  if (state.winner || state.needsReplacement.length > 0) return state;
  for (const k of ["A", "B"] as SideKey[]) {
    if (!isValidAction(state, k, actions[k])) throw new Error(`Invalid action for side ${k}: ${JSON.stringify(actions[k])}`);
  }

  state.round++;
  state.log.push({ type: "round", round: state.round });

  // 1. Swaps resolve first.
  for (const k of ["A", "B"] as SideKey[]) {
    const a = actions[k];
    if (a.kind !== "swap") continue;
    const s = state.sides[k];
    const leaving = activeOf(s);
    const restored = Math.round((MAX_ENERGY - leaving.energy) * SWAP_ENERGY_RESTORE);
    leaving.energy = Math.min(MAX_ENERGY, leaving.energy + restored);
    s.active = a.to;
    s.swaps++;
    s.lastSwapRound = state.round;
    state.log.push({ type: "swap", side: k, from: leaving.name, to: activeOf(s).name, toIndex: a.to, energyRestored: restored });
  }

  // 2. Attacks in Agility order (ties random). Dash moves add agility for
  //    this round; a crippled creature is slower.
  const attackers = (["A", "B"] as SideKey[])
    .filter((k) => actions[k].kind !== "swap")
    .map((k) => {
      const actor = activeOf(state.sides[k]);
      return { key: k, actor, action: actions[k], agil: turnAgility(actor, actions[k]) };
    })
    .sort((x, y) => (y.agil - x.agil) || (Math.random() - 0.5));

  for (const { key, actor, action } of attackers) {
    if (actor.hp <= 0) continue; // fainted before acting
    if (action.kind === "pass") {
      state.log.push({ type: "pass", side: key, name: actor.name });
      continue;
    }
    if (action.kind !== "attack") continue;
    const target = activeOf(state.sides[other(key)]);
    if (target.hp <= 0) continue;
    const skill = actor.skills.find((sk) => sk.name === action.skillName)!;

    // Precise moves can miss, but every hit is precise; other moves have
    // the normal small chance of a precise hit.
    const fx = skill.effect;
    const missed = fx?.kind === "precise" && Math.random() >= fx.hitChance;
    const precise = !missed && (fx?.kind === "precise" || Math.random() < PRECISE_CHANCE);
    const damage = missed ? 0 : calcDamage(skill, actor, target, precise).damage;
    if (!missed) {
      state.hits++;
      if (damage <= 1) state.minDamageHits++;
    }
    actor.energy = Math.min(MAX_ENERGY, actor.energy - skill.energyCost + ENERGY_REGEN);
    target.hp = Math.max(0, target.hp - damage);

    // Cripple lasts for the next CRIPPLE_ROUNDS rounds (+1: it ticks at the end of this one).
    const crippled = fx?.kind === "cripple" && target.hp > 0 && Math.random() < fx.chance;
    if (crippled) {
      target.statuses = [...target.statuses.filter((s) => s.id !== "cripple"), { id: "cripple", rounds: CRIPPLE_ROUNDS + 1 }];
    }
    state.log.push({ type: "attack", side: key, attacker: actor.name, target: target.name, skill, damage, precise, missed, crippled, targetHpAfter: target.hp, attackerEnergyAfter: actor.energy });
    if (target.hp <= 0) state.log.push({ type: "faint", side: other(key), name: target.name });
  }

  // 3. End of round: status effects tick down.
  for (const k of ["A", "B"] as SideKey[]) {
    for (const f of state.sides[k].team) {
      f.statuses = f.statuses.map((st) => ({ ...st, rounds: st.rounds - 1 })).filter((st) => st.rounds > 0);
    }
  }

  // 4. Win check, then who must send in a replacement.
  checkWinner(state);
  if (!state.winner) {
    state.needsReplacement = (["A", "B"] as SideKey[]).filter((k) => activeOf(state.sides[k]).hp <= 0);
  }
  return state;
}

export function sendInReplacement(state: BattleState, key: SideKey, index: number): BattleState {
  const s = state.sides[key];
  if (!state.needsReplacement.includes(key)) return state;
  if (index === s.active || !s.team[index] || s.team[index].hp <= 0) throw new Error(`Invalid replacement ${index} for side ${key}`);
  s.active = index;
  state.needsReplacement = state.needsReplacement.filter((k) => k !== key);
  state.log.push({ type: "sendIn", side: key, name: activeOf(s).name, index });
  return state;
}

function checkWinner(state: BattleState) {
  const a = aliveCount(state.sides.A), b = aliveCount(state.sides.B);
  if (a > 0 && b > 0 && state.round < MAX_ROUNDS) return;
  state.winner = a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : "draw";
  state.log.push({ type: "end", winner: state.winner });
}

// Deep-enough copy for React state updates.
export function cloneBattle(state: BattleState): BattleState {
  const side = (s: BattleSide): BattleSide => ({
    ...s,
    team: s.team.map((f) => ({ ...f, statuses: f.statuses.map((st) => ({ ...st })) })),
  });
  return {
    ...state,
    sides: { A: side(state.sides.A), B: side(state.sides.B) },
    needsReplacement: [...state.needsReplacement],
    log: [...state.log],
  };
}
