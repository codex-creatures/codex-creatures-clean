// lib/online/admin.ts
// Who gets the testing tools (the altar's typed barcodes, Random rolls, the
// resets, rubble and visitor; Start new is everyone's). Online, only the game's owner: a typed
// barcode reaches the global registry like a scan, so other players could
// claim "first to find" on numbers they never held. A copy without online
// (the offline Windows copy, a build with no config) is its owner's own, so
// the tools stay there.
//
// This only hides the tools in the game: it isn't a lock on the server.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "../saveFile";
import { readLastAccount } from "./cloudSave";

// Supabase account ids (auth.users), not emails, so nothing personal is in the build.
export const ADMIN_IDS: readonly string[] = [
  "46d89f7c-b8a3-4695-8484-481db93f491a", // the game's owner
];

export function isAdmin(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_IDS.includes(userId);
}

// Whether this browser gets the testing tools. Signed in, it's the account;
// offline with no session to read, the account that last played here (the
// only one allowed to play offline on this device).
export async function testingToolsAllowed(client: SupabaseClient | null, store: KeyValueStore): Promise<boolean> {
  if (!client) return true;
  let id: string | null = null;
  try { id = (await client.auth.getSession()).data.session?.user.id ?? null; } catch { /* offline */ }
  return isAdmin(id ?? readLastAccount(store));
}
