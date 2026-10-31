import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "../lib/saveFile";
import { ADMIN_IDS, isAdmin, testingToolsAllowed } from "../lib/online/admin";
import { LAST_ACCOUNT_KEY } from "../lib/online/cloudSave";

const OWNER = ADMIN_IDS[0];
const PLAYER = "00000000-0000-0000-0000-000000000001";

function store(last?: string): KeyValueStore {
  const map = new Map<string, string>(last ? [[LAST_ACCOUNT_KEY, last]] : []);
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}
function client(userId: string | null, throws = false) {
  return { auth: { getSession: async () => {
    if (throws) throw new TypeError("Failed to fetch");
    return { data: { session: userId ? { user: { id: userId } } : null } };
  } } } as unknown as SupabaseClient;
}

describe("testing tools", () => {
  it("are only the owner's account online", async () => {
    expect(isAdmin(OWNER)).toBe(true);
    expect(isAdmin(PLAYER)).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(await testingToolsAllowed(client(OWNER), store())).toBe(true);
    expect(await testingToolsAllowed(client(PLAYER), store(OWNER))).toBe(false);
    expect(await testingToolsAllowed(client(null), store())).toBe(false);
  });

  it("offline, go by the account that last played on this device", async () => {
    expect(await testingToolsAllowed(client(null, true), store(OWNER))).toBe(true);
    expect(await testingToolsAllowed(client(null), store(PLAYER))).toBe(false);
  });

  it("stay in a copy without online", async () => {
    expect(await testingToolsAllowed(null, store())).toBe(true);
  });
});
