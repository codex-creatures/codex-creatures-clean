// lib/online/friends.ts
// Your friend list (docs/design.md §12, PvP): players added from the
// leaderboards, to challenge to a duel. It's one-sided, like following:
// adding someone doesn't put you on their list. The `friends` table and
// my_friends() are in supabase/migrations (…_friends.sql).
//
// Everything takes the client as an argument, so tests can hand in a stand-in.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Friend = { id: string; name: string };
export const FRIENDS_TIMEOUT_MS = 8_000;

function timeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), FRIENDS_TIMEOUT_MS)),
  ]);
}

export function parseFriends(data: unknown): Friend[] | null {
  if (!Array.isArray(data)) return null;
  const list: Friend[] = [];
  for (const x of data) {
    const o = x as Record<string, unknown> | null;
    if (!o || typeof o.id !== "string" || typeof o.name !== "string") return null;
    list.push({ id: o.id, name: o.name });
  }
  return list;
}

// Your friends, or null if they couldn't be fetched.
export async function fetchFriends(client: SupabaseClient): Promise<Friend[] | null> {
  try {
    const { data, error } = await timeout(client.rpc("my_friends"));
    return error ? null : parseFriends(data);
  } catch {
    return null;
  }
}

// Adding someone already on your list is fine (nothing changes).
export async function addFriend(client: SupabaseClient, me: string, friendId: string): Promise<boolean> {
  if (!friendId || friendId === me) return false;
  try {
    const { error } = await timeout(client.from("friends").upsert({ user_id: me, friend_id: friendId }, { onConflict: "user_id,friend_id", ignoreDuplicates: true }));
    return !error;
  } catch {
    return false;
  }
}

export async function removeFriend(client: SupabaseClient, me: string, friendId: string): Promise<boolean> {
  try {
    const { error } = await timeout(client.from("friends").delete().eq("user_id", me).eq("friend_id", friendId));
    return !error;
  } catch {
    return false;
  }
}
