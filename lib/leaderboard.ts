// lib/leaderboard.ts
// The leaderboards (docs/design.md §12), found at the Den's quest board.
// Each player's numbers are worked out here from their save and go up with
// their cloud save (lib/online/cloudSave.ts); the server ranks everyone
// (supabase/migrations: leaderboard()). Seasons are started by the user on
// the server: runs and wins then count again from 0, species stay.

import type { Drop } from "./types";
import { DUNGEON_IDS, DUNGEONS, type DungeonId } from "./dungeon/run";
import { discoveredSpecies, TOTAL_CREATURES } from "./items/gameHelpers";

// What goes up with a save. Keys are dungeon ids, as text (they're JSON).
export type LeaderboardStats = {
  species: number;                 // creature species you have (as "Creatures discovered" at the altar)
  runs: Record<string, number>;    // runs started, per dungeon
  wins: Record<string, number>;    // its final boss beaten, per dungeon
};

// Where each dungeon keeps its counts in the save's Labyrinth progress (DungeonMeta).
const META_FIELDS: Record<DungeonId, [runs: string, wins: string]> = {
  0: ["campRuns", "campClears"],
  1: ["runs", "clears"],
  2: ["deepRuns", "deepClears"],
  3: ["abyssRuns", "abyssClears"],
};

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// The numbers in a save's progress (the main save, as a save file holds it).
export function leaderboardStats(progress: Record<string, unknown> | null | undefined): LeaderboardStats {
  const inventory = Array.isArray(progress?.inventory) ? (progress.inventory as Drop[]) : [];
  const lab = progress?.labyrinth as { meta?: Record<string, unknown> } | undefined;
  const meta = lab?.meta ?? {};
  const runs: Record<string, number> = {}, wins: Record<string, number> = {};
  for (const d of DUNGEON_IDS) {
    runs[d] = count(meta[META_FIELDS[d][0]]);
    wins[d] = count(meta[META_FIELDS[d][1]]);
  }
  return { species: discoveredSpecies(inventory).size, runs, wins };
}

// ── The boards ────────────────────────────────────────────────────────
export type BoardKind = "species" | "runs" | "wins";
// The server's name for a board: "species", or "runs:1" / "wins:1" (a dungeon's).
export type BoardKey = "species" | `${"runs" | "wins"}:${DungeonId}`;
export const BOARD_KINDS: BoardKind[] = ["species", "runs", "wins"];
export const BOARD_INFO: Record<BoardKind, { icon: string; name: string }> = {
  species: { icon: "🐾", name: "Species" },
  runs:    { icon: "🏃", name: "Runs" },
  wins:    { icon: "👑", name: "Wins" },
};
export const boardKey = (kind: BoardKind, dungeon: DungeonId): BoardKey => (kind === "species" ? "species" : `${kind}:${dungeon}`);
export const dungeonName = (d: DungeonId) => DUNGEONS[d].name;
// For the board's dungeon buttons (the full names don't fit four across).
export const DUNGEON_SHORT: Record<DungeonId, string> = { 0: "Camp", 1: "Labyrinth", 2: "Deep", 3: "Abyss" };

// A board's number as shown: species as a share of every species there is.
export const speciesPct = (n: number) => (TOTAL_CREATURES === 0 ? 0 : Math.round((n / TOTAL_CREATURES) * 100));
export function boardValue(kind: BoardKind, value: number): string {
  return kind === "species" ? `${speciesPct(value)}%` : `${value}`;
}

// ── What the server sends ─────────────────────────────────────────────
export const BOARD_TOP = 50; // players listed on a board (the server's limit too)
export type BoardRow = { rank: number; name: string; value: number; me: boolean };
export type Board = { season: number; startedAt: string; top: BoardRow[]; me: { rank: number; value: number } | null };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseBoard(data: unknown): Board | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (!isNum(o.season) || typeof o.startedAt !== "string" || !Array.isArray(o.top)) return null;
  const top: BoardRow[] = [];
  for (const r of o.top.slice(0, BOARD_TOP)) {
    const x = r as Record<string, unknown> | null;
    if (!x || !isNum(x.rank) || !isNum(x.value) || typeof x.name !== "string") return null;
    top.push({ rank: x.rank, name: x.name, value: x.value, me: x.me === true });
  }
  const m = o.me as Record<string, unknown> | null | undefined;
  const me = m && isNum(m.rank) && isNum(m.value) ? { rank: m.rank, value: m.value } : null;
  return { season: o.season, startedAt: o.startedAt, top, me };
}
