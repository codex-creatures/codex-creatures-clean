// lib/pvp/teams.ts
// PvP teams: line-ups saved at the PvP portal, in the tavern's room (the user,
// 2026-11-04), kept apart from the Labyrinth's teams (lib/teams.ts). Each holds
// up to what the biggest duel lets you bring (5v5 and 2 more). Picking your
// team in a duel, loading one taps its members that fit the format, in order.
// A creature can be in more than one team.

import type { Rarity } from "../items/budgets";
import { BRING_EXTRA, PVP_SIZES, bringMax, ineligibleReason, type PvpCandidate, type PvpFormat } from "./formats";

const ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const PVP_TEAM_SLOTS = 3;
export const PVP_TEAM_MAX = Math.max(...PVP_SIZES) + BRING_EXTRA;
export type PvpTeams = string[][]; // PVP_TEAM_SLOTS lists of creature ids

// Whatever the save holds, as PVP_TEAM_SLOTS lists of unique ids (an old save: all empty).
export function readPvpTeams(raw: unknown): PvpTeams {
  const lists = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PVP_TEAM_SLOTS }, (_, i) => {
    const l = Array.isArray(lists[i]) ? lists[i] : [];
    return [...new Set(l.filter((x: unknown): x is string => typeof x === "string"))].slice(0, PVP_TEAM_MAX);
  });
}

// Put a creature in a team, or take it out. A full team takes no more.
export function togglePvpTeam(teams: PvpTeams, team: number, id: string): PvpTeams {
  return teams.map((t, i) => {
    if (i !== team) return t;
    if (t.includes(id)) return t.filter((x) => x !== id);
    return t.length < PVP_TEAM_MAX ? [...t, id] : t;
  });
}

// The rarest thing in a team (a creature or the gear it wears): the lowest
// rarity a duel needs for the whole team to fit. undefined: an empty team.
export function teamRarity(members: (PvpCandidate | undefined)[]): Rarity | undefined {
  const all = members.flatMap((c) => (c ? [c.rarity, ...c.gear.map((g) => g.rarity)] : []));
  return all.length ? all.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a)) : undefined;
}

// Loading a team in a duel: its members you still have, in order, that fit the
// format and aren't away (in the pit), up to what you may bring.
export function teamPicks<C extends PvpCandidate & { id: string }>(ids: string[], fit: C[], f: PvpFormat): string[] {
  return ids.filter((id) => fit.some((c) => c.id === id && !ineligibleReason(c, f))).slice(0, bringMax(f));
}
