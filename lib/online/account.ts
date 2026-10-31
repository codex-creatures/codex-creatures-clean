// lib/online/account.ts
// Signing in (docs/design.md §12): the player types their email, gets a link,
// and tapping it signs this browser in (no password). After the first sign-in
// they pick a name, kept in the profiles table (supabase/migrations).
//
// Everything here takes the client as an argument, so tests can hand in a
// stand-in and nothing needs the internet.

import type { SupabaseClient } from "@supabase/supabase-js";

// The same limits as the profiles table's check (1 to 16 letters, trimmed).
export const MAX_PLAYER_NAME = 16;
// Where signing in brings the player back to: the title screen.
export const LOGIN_RETURN_PATH = "/start";
// Email links are built but hidden: Supabase's own mailer only reaches the
// project's team, and a mail service (Resend) needs a domain the game doesn't
// have yet. Until then players sign in with Google.
export const EMAIL_LOGIN = false;

// Who's signed in. "off" means this build can't go online at all.
export type Account =
  | { status: "off" | "loading" | "out" }
  | { status: "in"; id: string; email: string; name: string | null; offline?: boolean }; // (offline: the name couldn't be checked)

export type Result = { ok: true } | { ok: false; error: string };

// A name as it'll be stored (spaces tidied), or the reason it can't be used.
export function cleanPlayerName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Pick a name first." };
  if ([...name].length > MAX_PLAYER_NAME) return { ok: false, error: `${MAX_PLAYER_NAME} letters at most.` };
  return { ok: true, name };
}

// Only a quick check for typos: the email itself is the real test.
export function cleanEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// Supabase's errors, in the game's words.
function explain(error: { message?: string; status?: number } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.status === 429 || /rate limit/i.test(error.message ?? "")) {
    return "Too many emails sent. Wait a few minutes and try again.";
  }
  if (/fetch|network/i.test(error.message ?? "")) return "Couldn't reach the server. Check your connection.";
  return fallback;
}

export async function sendLoginLink(client: SupabaseClient, rawEmail: string, origin: string): Promise<Result> {
  const email = cleanEmail(rawEmail);
  if (!email) return { ok: false, error: "That doesn't look like an email address." };
  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: origin + LOGIN_RETURN_PATH, shouldCreateUser: true },
    });
    return error ? { ok: false, error: explain(error, "The email couldn't be sent. Try again.") } : { ok: true };
  } catch (e) {
    return { ok: false, error: explain(e as Error, "The email couldn't be sent. Try again.") };
  }
}

// Off to Google's sign-in page; it sends the player back to the title screen.
// Only returns if the trip couldn't start.
export async function signInWithGoogle(client: SupabaseClient, origin: string): Promise<Result> {
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin + LOGIN_RETURN_PATH },
    });
    return error ? { ok: false, error: explain(error, "Google sign-in couldn't start. Try again.") } : { ok: true };
  } catch (e) {
    return { ok: false, error: explain(e as Error, "Google sign-in couldn't start. Try again.") };
  }
}

// A sign-in that didn't work comes back with the reason in the address
// (?error=… or #error=…), or "" if all's well.
export function returnProblem(search: string, hash: string): string {
  for (const part of [hash.replace(/^#/, ""), search.replace(/^\?/, "")]) {
    const p = new URLSearchParams(part);
    if (!p.get("error")) continue;
    if (p.get("error_code") === "otp_expired") return "That link has expired or was already used. Send a new one.";
    if (p.get("error") === "access_denied") return "Sign-in was cancelled.";
    return "Sign-in didn't work. Try again.";
  }
  return "";
}

// Who this browser is signed in as (with their name, if they've picked one).
export async function readAccount(client: SupabaseClient): Promise<Account> {
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return { status: "out" };
  let name: string | null = null, offline = false;
  try {
    const { data: row, error } = await client.from("profiles").select("name").eq("id", user.id).maybeSingle();
    name = (row as { name?: string } | null)?.name ?? null;
    offline = !!error;
  } catch { offline = true; } // (no connection: they aren't asked for a name they may already have)
  return { status: "in", id: user.id, email: user.email ?? "", name, ...(offline ? { offline } : {}) };
}

export async function saveName(client: SupabaseClient, id: string, raw: string): Promise<Result & { name?: string }> {
  const clean = cleanPlayerName(raw);
  if (!clean.ok) return clean;
  try {
    const { error } = await client.from("profiles").upsert({ id, name: clean.name });
    if (error) return { ok: false, error: explain(error, "The name couldn't be saved. Try again.") };
    return { ok: true, name: clean.name };
  } catch (e) {
    return { ok: false, error: explain(e as Error, "The name couldn't be saved. Try again.") };
  }
}

export async function signOut(client: SupabaseClient): Promise<void> {
  // "local": only this browser signs out, not the player's other devices.
  try { await client.auth.signOut({ scope: "local" }); } catch {}
}
