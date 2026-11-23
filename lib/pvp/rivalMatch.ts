// lib/pvp/rivalMatch.ts
// A battle played out by the AI on both sides, start to finish: the rivals'
// daily round (lib/pvp/elo.ts dailyPairs), their warm-up battles, and the
// simulator's dungeon fights (lib/pvp/rivalSim.ts). The game's own engine
// and AIs (lib/combat), nothing else: the same fight a player would see.

import { createBattle, resolveRound, sendInReplacement, type BattleState } from "../combat/battle";
import { chooseAiAction, chooseAiReplacement, type AiLevel } from "../combat/thinkingAi";
import type { PvpFormat } from "./formats";
import { chooseFighters, firstPicks } from "./duel";
import { rivalTeam, type Rival } from "./rivals";

// How well a rival plays in PvP (the user, 2026-11-24: hard).
export const RIVAL_PVP_AI: AiLevel = "hard";

// A battle to the end: side A by one AI, side B by another (a boss on B by its own script).
export function playBattle(state: BattleState, mine: AiLevel, theirs: AiLevel): BattleState {
  let st = state;
  for (let guard = 0; !st.winner && guard < 400; guard++) {
    if (st.needsReplacement.length) {
      for (const k of [...st.needsReplacement]) st = sendInReplacement(st, k, chooseAiReplacement(st, k, k === "A" ? mine : theirs));
      continue;
    }
    st = resolveRound(st, { A: chooseAiAction(st, "A", mine), B: st.sides.B.boss ? { kind: "pass" } : chooseAiAction(st, "B", theirs) });
  }
  return st;
}

export type RivalMatch = { a: string; b: string; format: string; winner: "a" | "b" | "draw"; rounds: number; state: BattleState };

// Two rivals fight in a format: each brings its team (the strongest that fit) and leads with the first of them.
export function playRivalMatch(a: Rival, b: Rival, f: PvpFormat, level: AiLevel = RIVAL_PVP_AI): RivalMatch | null {
  const ta = chooseFighters(rivalTeam(a, f), firstPicks(f.size), f.size), tb = chooseFighters(rivalTeam(b, f), firstPicks(f.size), f.size);
  if (ta.fighters.length < f.size || tb.fighters.length < f.size) return null;
  const end = playBattle(createBattle(ta.fighters, tb.fighters), level, level);
  return { a: a.id, b: b.id, format: f.id, winner: end.winner === "A" ? "a" : end.winner === "B" ? "b" : "draw", rounds: end.round, state: end };
}
