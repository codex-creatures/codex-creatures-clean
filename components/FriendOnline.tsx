"use client";
// components/FriendOnline.tsx
// "X has come online": a green line across the top of the screen, wherever you are, when one of your
// friends comes into the game (the user, 2026-11-21; where the Labyrinth's notes go). Tap it, or it
// goes after FRIEND_NOTE_MS. Who's on comes from the lobby DuelInbox joins (lib/online/duelChannel.ts).

import { useEffect, useRef, useState } from "react";
import { onlineClient } from "@/lib/online/client";
import { lobbyAccount, onPlayersOnline } from "@/lib/online/duelChannel";
import { cameOnline, fetchFriends, type Friend } from "@/lib/online/friends";

export const FRIEND_NOTE_MS = 4000;
const REFETCH_MS = 30_000; // (a stranger coming on: your list's fetched again, at most this often, in case they're newly added)

export default function FriendOnline() {
  const [note, setNote] = useState<string | null>(null);
  const friends = useRef<Friend[]>([]);
  const prev = useRef<Set<string> | null>(null);
  const fetched = useRef(0);

  useEffect(() => {
    const client = onlineClient();
    if (!client) return;
    let live = true;
    const refresh = async () => {
      fetched.current = Date.now();
      const list = await fetchFriends(client);
      if (live && list) friends.current = list;
    };
    const off = onPlayersOnline((ids) => {
      const me = lobbyAccount();
      if (!me) { prev.current = null; friends.current = []; return; }
      if (!fetched.current) void refresh();
      const came = cameOnline(prev.current, ids, me, friends.current);
      if (came.length) setNote(`🟢 ${came.map((f) => f.name).join(", ")} ${came.length > 1 ? "have" : "has"} come online`);
      else if (prev.current?.has(me) && [...ids].some((id) => id !== me && !prev.current!.has(id)) && Date.now() - fetched.current > REFETCH_MS) void refresh();
      prev.current = new Set(ids);
    });
    return () => { live = false; off(); };
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), FRIEND_NOTE_MS);
    return () => window.clearTimeout(t);
  }, [note]);

  if (!note) return null;
  return (
    <div role="status" onPointerDown={() => setNote(null)} className="stone-panel"
      style={{ position: "absolute", top: 8, left: 8, right: 8, zIndex: 220, fontSize: 13, color: "#7CFC9A", borderColor: "#3f9a5a",
        padding: "6px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      {note}
    </div>
  );
}
