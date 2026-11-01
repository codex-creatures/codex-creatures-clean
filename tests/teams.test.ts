import { describe, expect, it } from "vitest";
import { readTeams, hasTeams, teamsWith, teamFull, toggleInTeam, teamMembers, TEAM_SLOTS } from "../lib/teams";
import { PARTY_SIZE } from "../lib/dungeon/run";

describe("teams", () => {
  it("an old save has three empty teams; junk is cleaned up", () => {
    expect(readTeams(undefined)).toEqual([[], [], []]);
    expect(readTeams([["a", "a", 3, "b"], "x"])).toEqual([["a", "b"], [], []]);
    expect(readTeams([[], [], [], ["d"]])).toHaveLength(TEAM_SLOTS);
    expect(hasTeams(readTeams(undefined))).toBe(false);
  });
  it("adds and removes a creature; a full team takes no more", () => {
    let t = readTeams(undefined);
    t = toggleInTeam(t, 0, "a");
    t = toggleInTeam(t, 2, "a");
    expect(teamsWith(t, "a")).toEqual([0, 2]);
    expect(hasTeams(t)).toBe(true);
    t = toggleInTeam(t, 0, "a");
    expect(teamsWith(t, "a")).toEqual([2]);
    for (let i = 0; i < PARTY_SIZE + 2; i++) t = toggleInTeam(t, 1, `c${i}`);
    expect(t[1]).toHaveLength(PARTY_SIZE);
    expect(teamFull(t, 1)).toBe(true);
  });
  it("a released creature drops out of its team", () => {
    const t = [["a", "b", "c"], [], []];
    expect(teamMembers(t, 0, new Set(["a", "c"]))).toEqual(["a", "c"]);
  });
});
