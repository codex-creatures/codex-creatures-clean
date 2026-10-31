"use client";
// components/DuelInbox.tsx
// Duel invites (docs/design.md §12): while you're signed in, a friend's
// challenge pops up wherever you are in the game. Accept takes you to the
// duel (app/duel); No tells them. It also puts you in the lobby, so friend
// lists can show you're on (lib/online/duelChannel.ts).
// Not on the title screen or the privacy page, and not while you're already in a duel.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onlineClient } from "@/lib/online/client";
import { declineDuel, joinLobby, listenInbox, type Invite } from "@/lib/online/duelChannel";
import { eligibleCount, INVITE_SECONDS, PVP_FORMATS } from "@/lib/pvp/formats";
import { loadOwnedCreatures } from "@/components/BattleScreen";

export default function DuelInbox() {
  const path = usePathname();
  const router = useRouter();
  const off = path === "/start" || path === "/privacy";
  const [me, setMe] = useState<string | null>(null);
  // Invites waiting for an answer, newest last (each lapses INVITE_SECONDS after it arrived).
  const [invites, setInvites] = useState<(Invite & { until: number })[]>([]);

  useEffect(() => {
    const client = onlineClient();
    if (off || !client) return;
    let live = true, stopInbox = () => {}, stopLobby = () => {};
    const join = (id: string | null) => {
      stopInbox(); stopLobby();
      stopInbox = () => {}; stopLobby = () => {};
      setMe(id);
      if (!id) return;
      stopLobby = joinLobby(client, id);
      stopInbox = listenInbox(client, id, {
        onInvite: (i) => setInvites((list) => list.some((x) => x.matchId === i.matchId) ? list
          : [...list, { ...i, until: Date.now() + INVITE_SECONDS * 1000 }]),
        onCancel: (matchId) => setInvites((list) => list.filter((x) => x.matchId !== matchId)),
      });
    };
    client.auth.getSession().then(({ data }) => { if (live) join(data.session?.user.id ?? null); }).catch(() => {});
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (live && (event === "SIGNED_IN" || event === "SIGNED_OUT")) join(session?.user.id ?? null);
    });
    return () => { live = false; sub.subscription.unsubscribe(); stopInbox(); stopLobby(); };
  }, [off]);

  // Lapsed invites go.
  useEffect(() => {
    if (!invites.length) return;
    const t = window.setInterval(() => setInvites((list) => list.filter((x) => x.until > Date.now())), 1000);
    return () => window.clearInterval(t);
  }, [invites.length]);

  const invite = invites[invites.length - 1];
  if (off || !me || !invite || path === "/duel") return null;
  const format = PVP_FORMATS[invite.format];
  const fit = eligibleCount(loadOwnedCreatures(format.level), format);
  const enough = fit >= format.size;
  const drop = () => setInvites((list) => list.filter((x) => x.matchId !== invite.matchId));
  const no = () => { const client = onlineClient(); if (client) declineDuel(client, invite.matchId, me); drop(); };
  const yes = () => {
    drop();
    const q = new URLSearchParams({ m: invite.matchId, f: invite.format, vs: invite.from.name });
    router.push(`/duel?${q}`);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 230, background: "rgba(4,5,9,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Duel invite" className="stone-panel" style={{ width: "100%", maxWidth: 360, textAlign: "center", padding: "18px 16px" }}>
        <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0", marginBottom: 6, overflowWrap: "anywhere" }}>⚔️ {invite.from.name} challenges you!</div>
        <div style={{ fontSize: 15, color: "#d8d4c8", marginBottom: 6 }}>{format.name}</div>
        <div style={{ fontSize: 13, color: enough ? "rgba(255,255,255,0.5)" : "#ff8a80", minHeight: 36 }}>
          {enough ? `You have ${fit} creatures that fit.` : `You need ${format.size} creatures that fit (you have ${fit}).`}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
          <button className="pixel-btn" onClick={no} style={{ minWidth: 100 }}>No</button>
          <button className="pixel-btn" onClick={yes} disabled={!enough} style={{ minWidth: 100 }}>Accept</button>
        </div>
      </div>
    </div>
  );
}
