// lib/combat/thinkingAi.ts
// The "thinking" AI: for each action it could take this turn, it plays the
// battle forward a few rounds in its head, many times over, and picks the
// action that turns out best on average (Monte Carlo lookahead).
//
// It plays those imagined rounds with the real battle engine, so it
// understands every mechanic automatically (cripple, dash, soul stones, and
// anything added later) without move-specific rules. Inside its imagined
// futures both sides play the simple greedy AI from teamBattle.ts.
//
// Levels:
// - easy:   the greedy AI (biggest move, swaps only when clearly losing)
// - normal: short lookahead plus a little noise, so it sometimes misjudges
// - hard:   deeper lookahead, no noise

import {
  activeOf, affordableSkills, attackTargets, cloneBattle, createBattle, other, resolveRound, sendInReplacement, swapTargets,
  type BattleAction, type BattleState, type SideKey,
} from "./battle";
import { aiChooseAction, aiChooseReplacement } from "./teamBattle";
import type { Fighter } from "./engine";

export type AiLevel = "easy" | "normal" | "hard";

type Thinking = { rollouts: number; depth: number; noise: number };
export const THINKING: Record<Exclude<AiLevel, "easy">, Thinking> = {
  normal: { rollouts: 12, depth: 5, noise: 0.01 },
  hard:   { rollouts: 32, depth: 8, noise: 0 },
};

export const AI_LEVEL_LABELS: Record<AiLevel, string> = { easy: "Easy", normal: "Normal", hard: "Hard" };

// ── Entry points ──────────────────────────────────────────────────
export function chooseAiAction(state: BattleState, key: SideKey, level: AiLevel): BattleAction {
  if (state.sides[key].boss) return { kind: "pass" }; // bosses are played by their script
  return level === "easy" ? aiChooseAction(state, key, { canSwap: true }) : think(state, key, THINKING[level]);
}

export function chooseAiReplacement(state: BattleState, key: SideKey, level: AiLevel): number {
  return level === "easy" ? aiChooseReplacement(state, key) : thinkReplacement(state, key, THINKING[level]);
}

// ── Lookahead ─────────────────────────────────────────────────────
function candidates(state: BattleState, key: SideKey): BattleAction[] {
  const side = state.sides[key];
  const moves = affordableSkills(activeOf(side));
  // Two enemies on the field: every move against each of them.
  const targets = attackTargets(state, key);
  const acts: BattleAction[] = targets.length > 1
    ? moves.flatMap((s) => targets.map((target): BattleAction => ({ kind: "attack", skillName: s.name, target })))
    : moves.map((s) => ({ kind: "attack", skillName: s.name }));
  for (const i of swapTargets(side)) acts.push({ kind: "swap", to: i });
  if (moves.length === 0) acts.push({ kind: "pass" });
  return acts;
}

// How good the position is for `key`: a win/loss outweighs any HP lead.
function evaluate(state: BattleState, key: SideKey): number {
  if (state.winner) return state.winner === key ? 2 : state.winner === "draw" ? 0 : -2;
  const hp = (k: SideKey) => {
    const team = state.sides[k].team;
    return team.reduce((t, f) => t + f.hp / f.maxHp, 0) / team.length;
  };
  return hp(key) - hp(other(key));
}

// A cheap copy for imagined futures (no need to copy the log).
const scratch = (state: BattleState) => cloneBattle({ ...state, log: [] });

const greedy = (s: BattleState, k: SideKey) => aiChooseAction(s, k, { canSwap: true });

function fillReplacements(s: BattleState) {
  for (const k of [...s.needsReplacement]) sendInReplacement(s, k, aiChooseReplacement(s, k));
}

// Play `rounds` more rounds with the greedy AI on both sides.
function playOn(s: BattleState, rounds: number) {
  for (let d = 0; d < rounds && !s.winner; d++) {
    resolveRound(s, { A: greedy(s, "A"), B: greedy(s, "B") });
    fillReplacements(s);
  }
}

// Small nudges for near-equal options, as a player would: keep a run of
// the same move going (a Perfectionist's grows), and don't swap for nothing
// (stops swap ping-pong).
const RUN_BONUS = 0.004;   // per hit in the current run (capped)
const SWAP_PENALTY = 0.01;

function nudge(state: BattleState, key: SideKey, a: BattleAction): number {
  if (a.kind === "swap") return -SWAP_PENALTY;
  const run = activeOf(state.sides[key]).streak;
  if (a.kind === "attack" && run?.move === a.skillName) return RUN_BONUS * Math.min(run.hits, 8);
  return 0;
}

function pickBest<T>(options: T[], score: (o: T) => number, noise: number): T {
  let best = options[0], bestScore = -Infinity;
  for (const o of options) {
    const v = score(o) + (Math.random() - 0.5) * 2 * noise;
    if (v > bestScore) { best = o; bestScore = v; }
  }
  return best;
}

function think(state: BattleState, key: SideKey, t: Thinking): BattleAction {
  const options = candidates(state, key);
  if (options.length === 1) return options[0];
  return pickBest(options, (action) => {
    let total = 0;
    for (let r = 0; r < t.rollouts; r++) {
      const s = scratch(state);
      const theirs = greedy(s, other(key));
      resolveRound(s, key === "A" ? { A: action, B: theirs } : { A: theirs, B: action });
      fillReplacements(s);
      playOn(s, t.depth - 1);
      total += evaluate(s, key);
    }
    return total / t.rollouts + nudge(state, key, action);
  }, t.noise);
}

function thinkReplacement(state: BattleState, key: SideKey, t: Thinking): number {
  const side = state.sides[key];
  const options = side.team.map((f, i) => i).filter((i) => i !== side.active && side.team[i].hp > 0);
  if (options.length <= 1) return options[0];
  return pickBest(options, (index) => {
    let total = 0;
    for (let r = 0; r < t.rollouts; r++) {
      const s = scratch(state);
      sendInReplacement(s, key, index);
      fillReplacements(s); // the other side, if it also needs one
      playOn(s, t.depth);
      total += evaluate(s, key);
    }
    return total / t.rollouts;
  }, t.noise);
}

// ── Whole battle, both sides AI (Balance Lab / sims) ──────────────
export function runAiBattle(teamA: Fighter[], teamB: Fighter[], levelA: AiLevel, levelB: AiLevel): BattleState {
  const s = createBattle(teamA, teamB);
  while (!s.winner) {
    resolveRound(s, { A: chooseAiAction(s, "A", levelA), B: chooseAiAction(s, "B", levelB) });
    for (const k of [...s.needsReplacement]) sendInReplacement(s, k, chooseAiReplacement(s, k, k === "A" ? levelA : levelB));
  }
  return s;
}
