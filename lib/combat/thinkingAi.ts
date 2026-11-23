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
  activeOf, affordableSkills, attackTargets, cloneBattle, fieldOf, other, resolveRound, sendInReplacement, swapTargets,
  type BattleAction, type BattleState, type SideKey,
} from "./battle";
import { aiChooseAction, aiChooseReplacement } from "./teamBattle";
import { OFF_RACE_USE, poisonImmune } from "./engine";

export type AiLevel = "easy" | "normal" | "hard";

type Thinking = { rollouts: number; depth: number; noise: number };
export const THINKING: Record<Exclude<AiLevel, "easy">, Thinking> = {
  normal: { rollouts: 12, depth: 5, noise: 0.01 },
  hard:   { rollouts: 48, depth: 8, noise: 0 }, // (32 until 2026-11-24: too few to tell a hazard's cost from the noise)
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
  // (A foe's off-race codex move: it doesn't always think of it; if it's all it can afford, it does.)
  const me = activeOf(side);
  const all = affordableSkills(me), others = all.filter((s) => s.name !== me.offRace);
  const moves = others.length && all.length > others.length && Math.random() >= OFF_RACE_USE ? others : all;
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
  // (Until none's needed: one can be knocked out stepping in, onto caltrops or blood.)
  for (let k = s.needsReplacement[0]; k && !s.winner; k = s.needsReplacement[0]) sendInReplacement(s, k, aiChooseReplacement(s, k));
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
//
// Three more since 2026-11-24 (the user, after watching the rivals walk into
// caltrops all match: "it should be considered", "not 100%, to be more
// human-like"). The lookahead already plays these out, but their worth is
// smaller than its noise, so on its own it ignored them:
// - a voluntary swap costs the entry damage of what lies under your field;
// - a foe that looks about to swap makes a debuff worth more (it sticks to
//   whoever comes in, while a kill shot hits the newcomer's full HP);
// - laying a hazard is worth more while the foe has creatures benched to
//   walk onto it.
// Each is scaled by a random 1 ± NUDGE_JITTER, so the AI sometimes misjudges.
const RUN_BONUS = 0.004;   // per hit in the current run (capped)
const SWAP_PENALTY = 0.01;
export const HAZARD_SWAP_WEIGHT = 1;  // × the entry damage's share of the team's HP (evaluate's units)
export const DEBUFF_BONUS = 0.03;     // × how likely the foe looks to swap this round
export const HAZARD_LAY_BONUS = 0.012; // × each foe standing on the bench
export const NUDGE_JITTER = 0.5;
const DEBUFFS = ["cripple", "weaken", "soak", "seal", "curse"];
const HAZARDS = ["caltrops", "cloud", "gore", "blood"];

const jitter = () => 1 + (Math.random() * 2 - 1) * NUDGE_JITTER;

// What side `key`'s creature `to` would lose stepping onto its own field now, in evaluate's units.
export function entryCost(state: BattleState, key: SideKey, to: number): number {
  const side = state.sides[key], f = side.team[to];
  let share = 0;
  for (const g of side.ground ?? []) {
    if (g.kind === "caltrops" || g.kind === "blood") share += g.entry;
    else if (g.kind === "cloud" && !poisonImmune(f)) share += g.tick;
  }
  return share / side.team.length;
}

// How likely the foe looks to swap this round, 0 to 1: hurt, or hopping lately.
export function foeSwapChance(state: BattleState, key: SideKey): number {
  const foe = state.sides[other(key)];
  if (foe.boss || !swapTargets(foe).length) return 0;
  const f = activeOf(foe), hp = f.hp / f.maxHp;
  let chance = hp < 0.3 ? 0.35 : hp < 0.5 ? 0.15 : 0;
  // Swapped in the last two rounds? (The log's rounds are marked.)
  let rounds = 0;
  for (let i = state.log.length - 1; i >= 0 && rounds < 2; i--) {
    const e = state.log[i];
    if (e.type === "round") rounds++;
    else if (e.type === "swap" && e.side === other(key)) { chance += 0.35; break; }
  }
  return Math.min(0.8, chance);
}

function nudge(state: BattleState, key: SideKey, a: BattleAction): number {
  if (a.kind === "swap") return -SWAP_PENALTY - HAZARD_SWAP_WEIGHT * entryCost(state, key, a.to) * jitter();
  if (a.kind !== "attack") return 0;
  let n = 0;
  const me = activeOf(state.sides[key]), run = me.streak;
  if (run?.move === a.skillName) n += RUN_BONUS * Math.min(run.hits, 8);
  const kind = me.skills.find((s) => s.name === a.skillName)?.effect?.kind;
  if (kind && DEBUFFS.includes(kind)) n += DEBUFF_BONUS * foeSwapChance(state, key) * jitter();
  if (kind && HAZARDS.includes(kind)) {
    const foe = state.sides[other(key)];
    const benched = foe.team.filter((f, i) => f.hp > 0 && !fieldOf(foe).includes(i)).length;
    if (benched && !foe.ground?.some((g) => g.kind === kind)) n += HAZARD_LAY_BONUS * benched * jitter();
  }
  return n;
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
