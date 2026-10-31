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

export const AUTH_STORAGE_KEY = "codex_creatures_auth_v1";

let client: SupabaseClient | null = null;

// The Supabase client, made on first use; null when online isn't available.
export function onlineClient(): SupabaseClient | null {
  if (!onlineConfig.ok) return null;
  client ??= createClient(onlineConfig.url, onlineConfig.key, {
    auth: {
      // Kept per device, alongside the game's other keys (never in save files).
      storageKey: AUTH_STORAGE_KEY,
      // The email link carries the sign-in itself, so it still works when the
      // phone's mail app opens it in a different browser from the one that
      // asked (that browser is the one signed in). "pkce" would refuse it.
      flowType: "implicit",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
