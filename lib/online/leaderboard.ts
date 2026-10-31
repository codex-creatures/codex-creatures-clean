// lib/online/leaderboard.ts
// Reading a leaderboard from the server (supabase/migrations: leaderboard()).
// Each player's numbers go up with their cloud save (lib/online/cloudSave.ts);
// the boards themselves are in lib/leaderboard.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBoard, type Board, type BoardKey } from "../leaderboard";

export const BOARD_TIMEOUT_MS = 8_000;

// The board, or null if it couldn't be fetched (offline, or the server said no).
export async function fetchBoard(client: SupabaseClient, board: BoardKey): Promise<Board | null> {
  try {
    const call = Promise.resolve(client.rpc("leaderboard", { board }));
    const { data, error } = await Promise.race([
      call,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), BOARD_TIMEOUT_MS)),
    ]);
    return error ? null : parseBoard(data);
  } catch {
    return null;
  }
}
