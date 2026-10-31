import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addFriend, fetchFriends, parseFriends, removeFriend } from "../lib/online/friends";
import { parseInvite } from "../lib/online/duelChannel";
import { parseBoard } from "../lib/leaderboard";

// A stand-in for the friends table: records what was asked.
function table(error: unknown = null) {
  const asked: unknown[] = [];
  const chain = {
    upsert: (row: unknown, opts: unknown) => { asked.push(["upsert", row, opts]); return Promise.resolve({ error }); },
    delete: () => ({ eq: (a: string, x: string) => ({ eq: (b: string, y: string) => { asked.push(["delete", a, x, b, y]); return Promise.resolve({ error }); } }) }),
  };
  return { asked, client: { from: (t: string) => { asked.push(["from", t]); return chain; } } as unknown as SupabaseClient };
}

describe("friends", () => {
  it("reads the server's list, and refuses a malformed one", () => {
    expect(parseFriends([{ id: "a", name: "Ada" }])).toEqual([{ id: "a", name: "Ada" }]);
    expect(parseFriends([{ id: "a" }])).toBeNull();
    expect(parseFriends("nope")).toBeNull();
  });

  it("fetches your friends, or null offline", async () => {
    const ok = { rpc: async (fn: string) => ({ data: fn === "my_friends" ? [{ id: "b", name: "Bo" }] : null, error: null }) } as unknown as SupabaseClient;
    expect(await fetchFriends(ok)).toEqual([{ id: "b", name: "Bo" }]);
    const offline = { rpc: async () => { throw new TypeError("Failed to fetch"); } } as unknown as SupabaseClient;
    expect(await fetchFriends(offline)).toBeNull();
  });

  it("adds (never yourself) and removes", async () => {
    const t = table();
    expect(await addFriend(t.client, "me", "me")).toBe(false);
    expect(await addFriend(t.client, "me", "you")).toBe(true);
    expect(await removeFriend(t.client, "me", "you")).toBe(true);
    expect(t.asked).toEqual([
      ["from", "friends"], ["upsert", { user_id: "me", friend_id: "you" }, { onConflict: "user_id,friend_id", ignoreDuplicates: true }],
      ["from", "friends"], ["delete", "user_id", "me", "friend_id", "you"],
    ]);
    expect(await addFriend(table({ message: "no" }).client, "me", "you")).toBe(false);
  });

  it("leaderboard rows carry the player's account id, for adding them", () => {
    const b = parseBoard({ season: 1, startedAt: "2026-11-01T00:00:00Z", top: [{ rank: 1, id: "u1", name: "Ada", value: 3, me: false }], me: null });
    expect(b?.top[0].id).toBe("u1");
  });
});

describe("duel invites", () => {
  it("reads an invite, and refuses a broken one or an unknown format", () => {
    const good = { matchId: "m1", from: { id: "u1", name: "Ada" }, format: "5v5-rare", sentAt: 5 };
    expect(parseInvite(good)).toEqual(good);
    expect(parseInvite({ ...good, format: "9v9" })).toBeNull();
    expect(parseInvite({ ...good, from: { id: "u1" } })).toBeNull();
    expect(parseInvite(null)).toBeNull();
  });
});
