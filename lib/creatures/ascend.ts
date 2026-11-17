// lib/creatures/ascend.ts
// The ascension ritual at the Soul Altar (the user, 2026-11-18): give up
// creatures of a species to raise one of them a rarity.
// - The first step takes ASCEND_FIRST of the species (the one you keep and
//   the rest), each step after ASCEND_AFTER. All the same species and the same
//   rarity at the time (so an Uncommon Moss Wolf is raised with two more
//   Uncommon Moss Wolves, each from its own ritual), and every one of them at
//   ASCEND_MIN_LEVEL or more. Up to Legendary.
// - The kept one keeps its level, XP, roll, moves, codex moves and soul stone,
//   and gains its new rarity's budget (ascendStats.ts). The others are gone,
//   with what they knew and their soul stones; only their gear comes back.
// - A creature on a run or in the pit is away, and can't take part. One in a
//   team (a PvP one too) can be the one kept, but not given up: take it out first.

import type { CreatureOrItemDrop, Rarity } from "../types";
import { codexRarityOf } from "../drops";
import { clampLevel } from "./levels";
import { findCreatureTemplate } from "./creatureData";
import { maxSteps, rarityAfter, stepsOf, RARITY_ORDER } from "./ascendStats";

export const ASCEND_FIRST = 5;
export const ASCEND_AFTER = 3;
export const ASCEND_MIN_LEVEL = 5;
// Codex moves at or above this rarity are worth a warning before they're given up.
export const WARN_CODEX_FROM: Rarity = "epic";

const templateOf = (c: CreatureOrItemDrop) => findCreatureTemplate(c.creatureId, c.name);
export const stepsOfCreature = (c: CreatureOrItemDrop) => { const t = templateOf(c); return t ? stepsOf(t, c.ascended) : 0; };
export const rarityOfCreature = (c: CreatureOrItemDrop): Rarity => { const t = templateOf(c); return t ? rarityAfter(t, c.ascended) : c.rarity; };

// How many to give up alongside the kept one for its next step.
export const othersNeeded = (kept: CreatureOrItemDrop) => (stepsOfCreature(kept) === 0 ? ASCEND_FIRST : ASCEND_AFTER) - 1;

// Can it be raised at all (not counting the others)? A reason if not.
export function keepProblem(kept: CreatureOrItemDrop, away: ReadonlySet<string> = new Set()): string | null {
  const t = templateOf(kept);
  if (kept.dropType !== "creature" || !t) return "Not a creature";
  if (stepsOf(t, kept.ascended) >= maxSteps(t)) return "Already Legendary";
  if (away.has(kept.id)) return "Away";
  if (clampLevel(kept.level) < ASCEND_MIN_LEVEL) return `Needs Lv ${ASCEND_MIN_LEVEL}`;
  return null;
}

// Can this one be given up for the kept one? A reason if not.
// busy: creatures away (a run, the pit) or in a team.
export function giveProblem(kept: CreatureOrItemDrop, other: CreatureOrItemDrop, busy: ReadonlySet<string> = new Set()): string | null {
  if (other.id === kept.id || other.dropType !== "creature") return "Not this one";
  if (other.creatureId !== kept.creatureId) return "Another species";
  if (rarityOfCreature(other) !== rarityOfCreature(kept)) return `Must be ${rarityOfCreature(kept)}`;
  if (busy.has(other.id)) return "In a team or away";
  if (clampLevel(other.level) < ASCEND_MIN_LEVEL) return `Needs Lv ${ASCEND_MIN_LEVEL}`;
  return null;
}

// The whole ritual's check. away: on a run or in the pit; busy: away or in a team.
export function ritualProblem(kept: CreatureOrItemDrop, others: CreatureOrItemDrop[], away: ReadonlySet<string> = new Set(), busy: ReadonlySet<string> = away): string | null {
  const k = keepProblem(kept, away);
  if (k) return k;
  if (new Set(others.map((o) => o.id)).size !== others.length) return "The same creature twice";
  if (others.length !== othersNeeded(kept)) return `Needs ${othersNeeded(kept)} more`;
  for (const o of others) { const p = giveProblem(kept, o, busy); if (p) return p; }
  return null;
}

// The kept one, a rarity up. Throws if the ritual can't be done.
export function ascend(kept: CreatureOrItemDrop, others: CreatureOrItemDrop[], away?: ReadonlySet<string>, busy?: ReadonlySet<string>): CreatureOrItemDrop {
  const problem = ritualProblem(kept, others, away, busy);
  if (problem) throw new Error(problem);
  const steps = stepsOfCreature(kept) + 1;
  const t = templateOf(kept)!;
  return { ...kept, ascended: steps, rarity: rarityAfter(t, steps) };
}

// What's lost with the others that's worth a warning: soul stones, and codex
// moves of WARN_CODEX_FROM or rarer. Empty: no warning needed.
export type Loss = { id: string; name: string; soulStone?: string; codexes: string[] };
export function lossesOf(others: CreatureOrItemDrop[]): Loss[] {
  const from = RARITY_ORDER.indexOf(WARN_CODEX_FROM);
  return others.flatMap((o) => {
    const codexes = (o.learned ?? []).filter((m) => RARITY_ORDER.indexOf(codexRarityOf(m)) >= from);
    return o.soulStone || codexes.length ? [{ id: o.id, name: o.name, ...(o.soulStone ? { soulStone: o.soulStone } : {}), codexes }] : [];
  });
}
