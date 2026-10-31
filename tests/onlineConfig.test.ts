import { describe, expect, it } from "vitest";
import { readOnlineConfig } from "../lib/online/config";

const REF = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";
const URL = `https://${REF}.supabase.co`;

// An old-style key with the given claims (the signature isn't checked here).
const jwt = (claims: object) =>
  ["x", btoa(JSON.stringify(claims)).replace(/=+$/, ""), "sig"].join(".");

describe("online config", () => {
  it("stays offline until the project ID is set", () => {
    expect(readOnlineConfig(URL, "sb_publishable_abc", "").ok).toBe(false);
  });

  it("stays offline with no address or key", () => {
    expect(readOnlineConfig(undefined, "sb_publishable_abc", REF).ok).toBe(false);
    expect(readOnlineConfig(URL, undefined, REF).ok).toBe(false);
  });

  it("accepts the Codex Creatures project with its public key", () => {
    expect(readOnlineConfig(URL + "/", " sb_publishable_abc ", REF))
      .toEqual({ ok: true, url: URL, key: "sb_publishable_abc" });
    expect(readOnlineConfig(URL, jwt({ ref: REF, role: "anon" }), REF).ok).toBe(true);
  });

  it("refuses any other project", () => {
    expect(readOnlineConfig(`https://${OTHER}.supabase.co`, "sb_publishable_abc", REF).ok).toBe(false);
    expect(readOnlineConfig(`https://${REF}.example.com`, "sb_publishable_abc", REF).ok).toBe(false);
    expect(readOnlineConfig(URL, jwt({ ref: OTHER, role: "anon" }), REF).ok).toBe(false);
  });

  it("refuses secret and service-role keys", () => {
    expect(readOnlineConfig(URL, "sb_secret_abc", REF).ok).toBe(false);
    expect(readOnlineConfig(URL, jwt({ ref: REF, role: "service_role" }), REF).ok).toBe(false);
    expect(readOnlineConfig(URL, "not-a-key", REF).ok).toBe(false);
  });
});
