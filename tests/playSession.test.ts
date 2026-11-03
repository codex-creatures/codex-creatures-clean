import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "../lib/saveFile";
import { newPlaySession, playVerdict, readPlaySession } from "../lib/online/playSession";

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}

describe("one game at a time per account", () => {
  it("each tap of Play makes a fresh session for the tab, kept for its pages", () => {
    const tab = memoryStore();
    const a = newPlaySession(tab, 1000);
    expect(readPlaySession(tab)).toEqual(a);
    expect(a.claimed).toBe(false);
    expect(newPlaySession(tab, 2000).id).not.toBe(a.id);
  });

  it("the tab holding the claim plays on; one that held it and lost it stops", () => {
    const mine = { id: "a", at: 1000, claimed: true };
    expect(playVerdict(mine, { session: "a", at: 1000 })).toBe("ok");
    expect(playVerdict(mine, { session: "b", at: 500 })).toBe("kicked"); // (whatever the clocks say)
    expect(playVerdict(mine, null)).toBe("claim");
  });

  it("a game started offline claims once back online, unless another device started after it", () => {
    const offline = { id: "a", at: 5000, claimed: false };
    expect(playVerdict(offline, null)).toBe("claim");
    expect(playVerdict(offline, { session: "b", at: 4000 })).toBe("claim");
    expect(playVerdict(offline, { session: "b", at: 6000 })).toBe("kicked");
  });
});
