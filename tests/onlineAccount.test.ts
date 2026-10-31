import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanEmail, cleanPlayerName, readAccount, returnProblem, saveName, sendLoginLink, signInWithGoogle,
  LOGIN_RETURN_PATH, MAX_PLAYER_NAME,
} from "../lib/online/account";

// A stand-in for Supabase: records what was asked, answers as told.
function fake(opts: { session?: { user: { id: string; email: string } } | null; name?: string | null; error?: object | null; throws?: boolean } = {}) {
  const calls: { otp?: unknown; oauth?: unknown; upsert?: unknown } = {};
  const client = {
    auth: {
      signInWithOtp: async (args: unknown) => {
        if (opts.throws) throw new TypeError("Failed to fetch");
        calls.otp = args;
        return { error: opts.error ?? null };
      },
      signInWithOAuth: async (args: unknown) => {
        if (opts.throws) throw new TypeError("Failed to fetch");
        calls.oauth = args;
        return { error: opts.error ?? null };
      },
      getSession: async () => ({ data: { session: opts.session ?? null } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.name ? { name: opts.name } : null }) }) }),
      upsert: async (row: unknown) => { calls.upsert = row; return { error: opts.error ?? null }; },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("player names", () => {
  it("tidies spaces and keeps names within the table's limit", () => {
    expect(cleanPlayerName("  Moss   Wren ")).toEqual({ ok: true, name: "Moss Wren" });
    expect(cleanPlayerName("   ").ok).toBe(false);
    expect(cleanPlayerName("x".repeat(MAX_PLAYER_NAME)).ok).toBe(true);
    expect(cleanPlayerName("x".repeat(MAX_PLAYER_NAME + 1)).ok).toBe(false);
  });

  it("saves the tidied name to the player's own profile", async () => {
    const { client, calls } = fake();
    expect(await saveName(client, "u1", " Bramble ")).toEqual({ ok: true, name: "Bramble" });
    expect(calls.upsert).toEqual({ id: "u1", name: "Bramble" });
  });

  it("doesn't send a bad name", async () => {
    const { client, calls } = fake();
    expect((await saveName(client, "u1", "")).ok).toBe(false);
    expect(calls.upsert).toBeUndefined();
  });
});

describe("email sign-in", () => {
  it("checks the address before sending", async () => {
    expect(cleanEmail(" Me@Example.com ")).toBe("me@example.com");
    expect(cleanEmail("not an email")).toBeNull();
    const { client, calls } = fake();
    expect((await sendLoginLink(client, "nope", "https://x")).ok).toBe(false);
    expect(calls.otp).toBeUndefined();
  });

  it("sends a link back to the title screen", async () => {
    const { client, calls } = fake();
    expect(await sendLoginLink(client, "me@example.com", "http://localhost:3000")).toEqual({ ok: true });
    expect(calls.otp).toEqual({
      email: "me@example.com",
      options: { emailRedirectTo: "http://localhost:3000" + LOGIN_RETURN_PATH, shouldCreateUser: true },
    });
  });

  it("explains rate limits and lost connections", async () => {
    const limited = await sendLoginLink(fake({ error: { status: 429, message: "x" } }).client, "me@example.com", "o");
    expect(limited.ok === false && limited.error).toMatch(/Too many/);
    const offline = await sendLoginLink(fake({ throws: true }).client, "me@example.com", "o");
    expect(offline.ok === false && offline.error).toMatch(/connection/);
  });
});

describe("Google sign-in", () => {
  it("goes to Google and comes back to the title screen", async () => {
    const { client, calls } = fake();
    expect(await signInWithGoogle(client, "https://codex-creatures-clean.vercel.app")).toEqual({ ok: true });
    expect(calls.oauth).toEqual({
      provider: "google",
      options: { redirectTo: "https://codex-creatures-clean.vercel.app" + LOGIN_RETURN_PATH },
    });
  });

  it("says so when it can't start", async () => {
    const r = await signInWithGoogle(fake({ throws: true }).client, "o");
    expect(r.ok === false && r.error).toMatch(/connection/);
  });
});

describe("coming back from signing in", () => {
  it("is quiet when it worked", () => {
    expect(returnProblem("", "#access_token=abc&type=bearer")).toBe("");
    expect(returnProblem("", "")).toBe("");
  });

  it("explains what went wrong, from either part of the address", () => {
    expect(returnProblem("?error=access_denied", "")).toMatch(/cancelled/);
    expect(returnProblem("", "#error=access_denied&error_code=otp_expired")).toMatch(/expired/);
    expect(returnProblem("", "#error=server_error")).toMatch(/didn't work/);
  });
});

describe("who's signed in", () => {
  it("is signed out with no session", async () => {
    expect(await readAccount(fake().client)).toEqual({ status: "out" });
  });

  it("reads the name, or none yet", async () => {
    const user = { id: "u1", email: "me@example.com" };
    expect(await readAccount(fake({ session: { user }, name: "Bramble" }).client))
      .toEqual({ status: "in", id: "u1", email: "me@example.com", name: "Bramble" });
    expect(await readAccount(fake({ session: { user } }).client))
      .toMatchObject({ status: "in", name: null });
  });
});
