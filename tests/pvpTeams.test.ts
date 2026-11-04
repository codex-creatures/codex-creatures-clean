import { describe, expect, it } from "vitest";
import { PVP_TEAM_MAX, PVP_TEAM_SLOTS, readPvpTeams, teamPicks, teamRarity, togglePvpTeam } from "../lib/pvp/teams";
import { DEFAULT_PVP, makeFormat } from "../lib/pvp/formats";

const c = (id: string, rarity: "common" | "rare" | "epic", gear: ("rare" | "epic" | "legendary")[] = []) =>
  ({ id, rarity, gear: gear.map((r) => ({ name: `${r} sword`, rarity: r })) });

describe("PvP teams", () => {
  it("an old save has empty teams; junk is cleaned up", () => {
    expect(readPvpTeams(undefined)).toEqual(Array.from({ length: PVP_TEAM_SLOTS }, () => []));
    expect(readPvpTeams([["a", "a", 3, "b"], "x"])[0]).toEqual(["a", "b"]);
    expect(readPvpTeams([[], [], [], ["d"]])).toHaveLength(PVP_TEAM_SLOTS);
  });
  it("holds as many as the biggest duel lets you bring (5v5 and 2 more)", () => {
    expect(PVP_TEAM_MAX).toBe(7);
    let t = readPvpTeams(undefined);
    for (let i = 0; i < PVP_TEAM_MAX + 2; i++) t = togglePvpTeam(t, 1, `c${i}`);
    expect(t[1]).toHaveLength(PVP_TEAM_MAX);
    t = togglePvpTeam(t, 1, "c0");
    expect(t[1]).not.toContain("c0");
    expect(t[0]).toEqual([]);
  });
  it("a team's rarity is its rarest creature or gear", () => {
    expect(teamRarity([])).toBeUndefined();
    expect(teamRarity([c("a", "common"), c("b", "rare")])).toBe("rare");
    expect(teamRarity([c("a", "common", ["epic"])])).toBe("epic");
  });
  it("loading a team in a duel taps the members that fit, in order, up to what you may bring", () => {
    const fit = [c("a", "rare"), c("b", "epic"), c("d", "common", ["legendary"]), c("e", "common"), c("f", "common"), c("g", "common"), c("h", "common")];
    const rare3 = makeFormat(DEFAULT_PVP); // 3v3 Rare: bring up to 5
    // b is too rare, d's gear is, x is gone (or in the pit: not in the list).
    expect(teamPicks(["x", "b", "a", "d", "e", "f", "g", "h"], fit, rare3)).toEqual(["a", "e", "f", "g", "h"]);
    expect(teamPicks(["b", "a"], fit, makeFormat({ ...DEFAULT_PVP, maxRarity: "epic" }))).toEqual(["b", "a"]);
  });
});
