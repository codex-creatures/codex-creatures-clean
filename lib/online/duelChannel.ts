// lib/online/duelChannel.ts
// The live side of duels (docs/design.md §12), over Supabase Realtime: no
// tables, just messages between browsers that are open at the time.
//
// - The lobby: every signed-in player's game joins it, so friend lists can
//   show who's on now.
// - Each player's inbox ("inbox:<account id>"): where duel invites arrive,
//   wherever they are in the game (components/DuelInbox.tsx).
// - A duel's own channel ("duel:<match id>"): the two players' messages
//   (lib/pvp/duel.ts), and whether the other one is still there.
//
// Not hardened: anyone signed in who knew an account id could send to its
// inbox (accepted for playtesting, like the rest of §12).

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { isFormatId, type PvpFormatId } from "../pvp/formats";
import type { DuelMsg } from "../pvp/duel";

export type Invite = { matchId: string; from: { id: string; name: string }; format: PvpFormatId; sentAt: number };

export function parseInvite(p: unknown): Invite | null {
  const o = p as Record<string, unknown> | null;
  const from = o?.from as Record<string, unknown> | undefined;
  if (!o || typeof o.matchId !== "string" || !from || typeof from.id !== "string" || typeof from.name !== "string") return null;
  if (!isFormatId(o.format) || typeof o.sentAt !== "number") return null;
  return { matchId: o.matchId, from: { id: from.id, name: from.name }, format: o.format, sentAt: o.sentAt };
}

const SEND_TIMEOUT_MS = 8_000;

// Join a channel and wait until it's ready (false: it couldn't be joined).
function joined(ch: RealtimeChannel, onReady?: () => void): Promise<boolean> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), SEND_TIMEOUT_MS);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(t); onReady?.(); resolve(true); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(t); resolve(false); }
    });
  });
}

// One message to another player's inbox (an invite, or calling it off).
async function toInbox(client: SupabaseClient, to: string, event: "invite" | "cancel", payload: unknown): Promise<boolean> {
  const ch = client.channel(`inbox:${to}`, { config: { broadcast: { ack: true } } });
  try {
    if (!(await joined(ch))) return false;
    const r = await ch.send({ type: "broadcast", event, payload });
    return r === "ok";
  } catch {
    return false;
  } finally {
    client.removeChannel(ch);
  }
}

export const sendInvite = (client: SupabaseClient, to: string, invite: Invite) => toInbox(client, to, "invite", invite);
export const cancelInvite = (client: SupabaseClient, to: string, matchId: string) => toInbox(client, to, "cancel", { matchId });

// ── Your inbox and the lobby (one of each per game, while signed in) ──
export type InboxHandlers = { onInvite: (i: Invite) => void; onCancel: (matchId: string) => void };

export function listenInbox(client: SupabaseClient, me: string, h: InboxHandlers): () => void {
  const ch = client.channel(`inbox:${me}`)
    .on("broadcast", { event: "invite" }, ({ payload }) => { const i = parseInvite(payload); if (i) h.onInvite(i); })
    .on("broadcast", { event: "cancel" }, ({ payload }) => { const id = (payload as { matchId?: unknown })?.matchId; if (typeof id === "string") h.onCancel(id); });
  ch.subscribe();
  return () => { client.removeChannel(ch); };
}

// Who's in the game right now (account ids), for the friend list's dots.
let onlineNow = new Set<string>();
const onlineListeners = new Set<(ids: Set<string>) => void>();
export const playersOnline = () => onlineNow;
export function onPlayersOnline(fn: (ids: Set<string>) => void): () => void {
  onlineListeners.add(fn);
  return () => { onlineListeners.delete(fn); };
}

export function joinLobby(client: SupabaseClient, me: string): () => void {
  const ch = client.channel("lobby", { config: { presence: { key: me } } });
  ch.on("presence", { event: "sync" }, () => {
    onlineNow = new Set(Object.keys(ch.presenceState()));
    for (const fn of onlineListeners) fn(onlineNow);
  });
  ch.subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ at: Date.now() }); });
  return () => {
    client.removeChannel(ch);
    onlineNow = new Set();
    for (const fn of onlineListeners) fn(onlineNow);
  };
}

// ── A duel's channel ───────────────────────────────────────────────────
export type DuelLink = { send: (m: DuelMsg) => void; close: () => void };

// onPeer: whether the other player is in the channel now.
// Messages sent before the channel is ready wait and go once it is.
export function openDuelChannel(client: SupabaseClient, matchId: string, me: string,
  h: { onMessage: (m: DuelMsg) => void; onPeer: (present: boolean) => void; onReady?: () => void }): DuelLink {
  const ch = client.channel(`duel:${matchId}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
  let ready = false, closed = false;
  const waiting: DuelMsg[] = [];
  ch.on("broadcast", { event: "m" }, ({ payload }) => { if (payload && typeof payload === "object") h.onMessage(payload as DuelMsg); });
  ch.on("presence", { event: "sync" }, () => h.onPeer(Object.keys(ch.presenceState()).some((k) => k !== me)));
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED" || closed) return;
    ready = true;
    ch.track({ at: Date.now() });
    for (const m of waiting.splice(0)) ch.send({ type: "broadcast", event: "m", payload: m });
    h.onReady?.();
  });
  return {
    send: (m) => { if (closed) return; if (ready) ch.send({ type: "broadcast", event: "m", payload: m }); else waiting.push(m); },
    close: () => { closed = true; client.removeChannel(ch); },
  };
}

// Saying no to an invite: a "decline" on the duel's channel, which the host is waiting on.
export function declineDuel(client: SupabaseClient, matchId: string, me: string) {
  const link = openDuelChannel(client, matchId, me, {
    onMessage: () => {}, onPeer: () => {},
    onReady: () => { link.send({ t: "decline" }); setTimeout(() => link.close(), 1500); },
  });
  setTimeout(() => link.close(), SEND_TIMEOUT_MS);
}
