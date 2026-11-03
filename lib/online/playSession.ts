// lib/online/playSession.ts
// One game at a time per account (docs/design.md §12): the `play_sessions`
// table holds which browser tab is playing each account. Tapping Play on the
// title screen claims it; any other device (or tab) playing that account
// hears about it (Realtime, or its next check) and goes back to the title
// screen, so two games never run side by side and overwrite each other.
//
// - Each tab has its own play session (PLAY_SESSION_KEY in sessionStorage: a
//   random id, and whether the server has it yet). The title screen makes a
//   fresh one each time you tap Play.
// - Playing offline can't claim: the tab claims once back online, unless
//   another device claimed after this one started (then it's this one that
//   stops).
// - Whatever the kicked game played since its last upload stays on that
//   device as the backup when the newer save loads there (cloudSave.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueStore } from "../saveFile";

export const PLAY_SESSION_KEY = "codex_creatures_play_session";
export const PLAY_TABLE = "play_sessions";
const TIMEOUT_MS = 8_000;

// This tab's session. at: when it started (ms); claimed: the server has it.
export type PlaySession = { id: string; at: number; claimed: boolean };
// The server's claim: which session, and when (ms).
export type PlayClaim = { session: string; at: number };

export function newPlaySession(tab: KeyValueStore, now = Date.now()): PlaySession {
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${now}-${Math.random().toString(36).slice(2)}`;
  const s = { id, at: now, claimed: false };
  writeSession(tab, s);
  return s;
}

export function readPlaySession(tab: KeyValueStore): PlaySession | null {
  try {
    const s = JSON.parse(tab.getItem(PLAY_SESSION_KEY) ?? "null");
    return s && typeof s.id === "string" && typeof s.at === "number" ? { id: s.id, at: s.at, claimed: !!s.claimed } : null;
  } catch {
    return null;
  }
}

function writeSession(tab: KeyValueStore, s: PlaySession) {
  try { tab.setItem(PLAY_SESSION_KEY, JSON.stringify(s)); } catch {}
}

// What this tab should do, given the server's claim (null: nobody's).
// "kicked": another device started playing after this one.
export function playVerdict(mine: PlaySession, claim: PlayClaim | null): "ok" | "claim" | "kicked" {
  if (claim?.session === mine.id) return "ok";
  if (!claim) return "claim";
  // Claimed here once, and someone else has it now: they came later.
  if (mine.claimed) return "kicked";
  // Never claimed (started offline): whoever started last plays on.
  return claim.at > mine.at ? "kicked" : "claim";
}

function timeout<T>(p: PromiseLike<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

const toClaim = (row: unknown): PlayClaim | null => {
  const r = row as { session?: unknown; claimed_at?: unknown } | null;
  if (!r || typeof r.session !== "string") return null;
  const at = Date.parse(String(r.claimed_at ?? ""));
  return { session: r.session, at: Number.isNaN(at) ? 0 : at };
};

// The account's claim (undefined: couldn't ask).
export async function fetchClaim(client: SupabaseClient, userId: string): Promise<PlayClaim | null | undefined> {
  try {
    const { data, error } = await timeout(client.from(PLAY_TABLE).select("session, claimed_at").eq("user_id", userId).maybeSingle());
    return error ? undefined : toClaim(data);
  } catch {
    return undefined;
  }
}

// Make this tab the one playing the account.
export async function claimPlay(client: SupabaseClient, tab: KeyValueStore, userId: string, s: PlaySession): Promise<boolean> {
  try {
    const { error } = await timeout(client.from(PLAY_TABLE).upsert({ user_id: userId, session: s.id }));
    if (error) return false;
    writeSession(tab, { ...s, claimed: true });
    return true;
  } catch {
    return false;
  }
}

// Check (and claim, if it's this tab's turn). True: another device has it.
export async function checkPlay(client: SupabaseClient, tab: KeyValueStore, userId: string): Promise<boolean> {
  const mine = readPlaySession(tab) ?? newPlaySession(tab);
  const claim = await fetchClaim(client, userId);
  if (claim === undefined) return false; // (no answer: carry on)
  const v = playVerdict(mine, claim);
  if (v === "claim") await claimPlay(client, tab, userId, mine);
  return v === "kicked";
}

// Hear straight away when another device claims the account. Returns the
// way to stop listening.
export function watchPlay(client: SupabaseClient, tab: KeyValueStore, userId: string, onKicked: () => void): () => void {
  const ch = client.channel(`play:${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: PLAY_TABLE, filter: `user_id=eq.${userId}` }, (p) => {
      const mine = readPlaySession(tab);
      const claim = toClaim(p.new);
      if (mine && claim && playVerdict(mine, claim) === "kicked") onKicked();
    })
    .subscribe();
  return () => { client.removeChannel(ch); };
}
