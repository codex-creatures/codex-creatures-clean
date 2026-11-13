// lib/teams.ts
// Teams: saved line-ups for the Labyrinth (the user, 2026-11-01). Three team
// slots, each up to a full party (PARTY_SIZE) of your creatures. At the
// entrance you either pick freely from all your creatures, or load a team.
// A creature can be in more than one team. You add one from its window
// ("Add to team"; the first time, that makes Team 1) or by tapping it at the
// entrance with a team chosen. Teams replaced the ★ roster.

import { PARTY_SIZE } from "./dungeon/run";

export const TEAM_SLOTS = 3;
export type Teams = string[][]; // TEAM_SLOTS lists of creature ids

// Whatever the save holds, as TEAM_SLOTS lists of unique ids (an old save: all empty).
export function readTeams(raw: unknown): Teams {
  const lists = Array.isArray(raw) ? raw : [];
  return Array.from({ length: TEAM_SLOTS }, (_, i) => {
    const l = Array.isArray(lists[i]) ? lists[i] : [];
    return [...new Set(l.filter((x: unknown): x is string => typeof x === "string"))].slice(0, PARTY_SIZE);
  });
}

export const hasTeams = (teams: Teams) => teams.some((t) => t.length > 0);
export const teamsWith = (teams: Teams, id: string) => teams.flatMap((t, i) => (t.includes(id) ? [i] : []));
export const teamFull = (teams: Teams, team: number) => (teams[team]?.length ?? 0) >= PARTY_SIZE;

// Teams without the creatures you no longer have (sold, fused, released).
// Left in, they'd still take a place: a team could look half empty yet be full.
export const keepOwned = (teams: Teams, owned: Set<string>): Teams => teams.map((t) => t.filter((id) => owned.has(id)));

// Put a creature in a team, or take it out. A full team takes no more.
// owned: the creatures you have; any others are dropped from the team first.
export function toggleInTeam(teams: Teams, team: number, id: string, owned?: Set<string>): Teams {
  return teams.map((t, i) => {
    if (i !== team) return t;
    if (owned) t = t.filter((x) => x === id || owned.has(x));
    if (t.includes(id)) return t.filter((x) => x !== id);
    return t.length < PARTY_SIZE ? [...t, id] : t;
  });
}

// A team's creatures you still have (released ones drop out).
export const teamMembers = (teams: Teams, team: number, owned: Set<string>) => (teams[team] ?? []).filter((id) => owned.has(id));
