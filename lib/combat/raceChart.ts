// lib/combat/raceChart.ts
// Combat V2's race chart (live since 2026-10-26; the switch: LIVE_RULES in
// engine.ts). Each race is effective against 3 others and weak to 3. Some
// pairs are effective against each other, and that's intended.
//
// A move against one defending race:
// - effective (the move's race beats it): RACE_EFFECT.strong
// - resisted (the defender's race beats the move's race, and not both ways): RACE_EFFECT.resisted
// - otherwise neutral.
// Against two races the two multiply (1.25 × 1.25 ≈ 1.56 for a double weakness).
// A move of one of the attacker's own races gets MATCH_BONUS, once.

import type { Skill } from "../creatures/creatureData";
import { MOVE_RACES, type RaceV2 } from "../creatures/racesV2";
import { KIT_MOVE_RACE } from "../creatures/raceKitsV2";

export const RACE_EFFECT = { strong: 1.25, resisted: 0.8 }; // the user's option B for playtesting, 2026-10-26 (was 1.4 / 0.75)
export const MATCH_BONUS = 1.15;

export const RACE_BEATS: Record<RaceV2, RaceV2[]> = {
  undead:     ["geo", "toxic", "humanoid"],
  divine:     ["undead", "toxic", "underkin"],
  beast:      ["underkin", "humanoid", "undead"],
  underkin:   ["toxic", "geo", "divine"],
  geo:        ["beast", "divine", "undead"],
  humanoid:   ["geo", "underkin", "beast"],
  toxic:      ["beast", "humanoid", "divine"],
};

// One move race against one defending race.
export function raceVs(move: RaceV2, defender: RaceV2): number {
  if (RACE_BEATS[move].includes(defender)) return RACE_EFFECT.strong;
  if (RACE_BEATS[defender].includes(move)) return RACE_EFFECT.resisted;
  return 1;
}

// One move race against all the defender's races (none: neutral).
export const raceVsAll = (move: RaceV2, defender: RaceV2[] = []) => defender.reduce((m, r) => m * raceVs(move, r), 1);

// How a move's race is decided:
// - "own": the attacker's own race (two races: whichever lands better), so
//   the match bonus always applies. Stands in until moves have real races.
// - "drafted": the move's race from MOVE_RACES (none: neutral).
export type MoveRaceMode = "own" | "drafted";

type Side = { races?: RaceV2[] };

// A move's own race: a race-kit move's, or the draft race of an older move
// (MOVE_RACES); none for the bosses' moves.
export const raceOfMove = (skill: { name: string }): RaceV2 | undefined => MOVE_RACES[skill.name] ?? KIT_MOVE_RACE[skill.name];

// The move's race in this matchup, or none.
export function moveRace(skill: Skill, attacker: Side, defender: Side, mode: MoveRaceMode): RaceV2 | undefined {
  if (mode === "drafted") return raceOfMove(skill);
  const own = attacker.races ?? [];
  if (own.length === 0) return undefined;
  return own.reduce((best, r) => (raceVsAll(r, defender.races) > raceVsAll(best, defender.races) ? r : best));
}

// The whole race multiplier for a hit: effectiveness × match bonus.
export function raceMultiplier(skill: Skill, attacker: Side, defender: Side, mode: MoveRaceMode): number {
  const r = moveRace(skill, attacker, defender, mode);
  if (!r) return 1;
  const match = attacker.races?.includes(r) ? MATCH_BONUS : 1;
  return raceVsAll(r, defender.races) * match;
}
