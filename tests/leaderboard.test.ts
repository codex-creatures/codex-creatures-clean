import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { boardKey, boardValue, leaderboardStats, parseBoard, speciesPct } from "../lib/leaderboard";
import { fetchBoard } from "../lib/online/leaderboard";
import { TOTAL_CREATURES } from "../lib/items/gameHelpers";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";

const species = (i: number, dropType = "creature") => ({ id: `d${i}-${dropType}`, dropType, creatureId: CREATURE_TEMPLATES[i].id, name: CREATURE_TEMPLATES[i].name });

describe("leaderboard stats from a save", () => {
  it("counts each species once (creatures and cards), and each dungeon's runs and wins", () => {
    const progress = {
      inventory: [species(0), species(0, "card"), species(1, "card"), { id: "w", dropType: "item", itemKey: "void_scythe" }],
      labyrinth: { meta: { runs: 7, clears: 2, campRuns: 3, campClears: 3, deepRuns: 1, injuries: {}, bag: [] } },
    };
    expect(leaderboardStats(progress)).toEqual({
      species: 2,
      runs: { 0: 3, 1: 7, 2: 1, 3: 0 },
      wins: { 0: 3, 1: 2, 2: 0, 3: 0 },
    });
  });

  it("gives zeros for an empty or odd save", () => {
    const zero = { species: 0, runs: { 0: 0, 1: 0, 2: 0, 3: 0 }, wins: { 0: 0, 1: 0, 2: 0, 3: 0 } };
    expect(leaderboardStats(null)).toEqual(zero);
    expect(leaderboardStats({ inventory: "x", labyrinth: { meta: { runs: -4, clears: "9", deepRuns: NaN } } })).toEqual(zero);
  });
});

describe("boards", () => {
  it("names them as the server does", () => {
    expect(boardKey("species", 2)).toBe("species");
    expect(boardKey("runs", 0)).toBe("runs:0");
    expect(boardKey("wins", 3)).toBe("wins:3");
  });

  it("shows species as a share of every species", () => {
    expect(speciesPct(TOTAL_CREATURES)).toBe(100);
    expect(boardValue("species", 0)).toBe("0%");
    expect(boardValue("runs", 12)).toBe("12");
  });

  it("reads the server's answer, and refuses a malformed one", () => {
    const good = { season: 1, startedAt: "2026-10-31T12:00:00Z", top: [{ rank: 1, name: "Ada", value: 5, me: true }], me: { rank: 1, value: 5 } };
    expect(parseBoard(good)).toEqual(good);
    expect(parseBoard({ ...good, me: null })?.me).toBeNull();
    expect(parseBoard({ ...good, top: [{ rank: 1, value: 5 }] })).toBeNull();
    expect(parseBoard("nope")).toBeNull();
  });

  it("fetches a board, and gives null when the server can't be reached", async () => {
    const answer = { season: 2, startedAt: "2026-11-01T00:00:00Z", top: [], me: null };
    const asked: unknown[] = [];
    const ok = { rpc: async (fn: string, args: unknown) => { asked.push([fn, args]); return { data: answer, error: null }; } } as unknown as SupabaseClient;
    expect(await fetchBoard(ok, "wins:1")).toEqual(answer);
    expect(asked).toEqual([["leaderboard", { board: "wins:1" }]]);
    const offline = { rpc: async () => { throw new TypeError("Failed to fetch"); } } as unknown as SupabaseClient;
    expect(await fetchBoard(offline, "species")).toBeNull();
  });
});
