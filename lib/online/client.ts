// lib/online/client.ts
// The one door to Supabase. Every online feature goes through here, so the
// rest of the game (and every test) runs without it: when the build has no
// valid config (lib/online/config.ts), there is no client and the game plays
// offline as before.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readOnlineConfig, type OnlineConfig } from "./config";

// (Written out in full so Next.js can fill them in at build time.)
export const onlineConfig: OnlineConfig = readOnlineConfig(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY,
);

let client: SupabaseClient | null = null;

// The Supabase client, made on first use; null when online isn't available.
export function onlineClient(): SupabaseClient | null {
  if (!onlineConfig.ok) return null;
  client ??= createClient(onlineConfig.url, onlineConfig.key);
  return client;
}
