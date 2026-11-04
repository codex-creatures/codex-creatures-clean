"use client";
// components/FriendList.tsx
// Your friends (lib/online/friends.ts): who's on now (🟢, Realtime presence),
// ⚔️ Duel for those who are, and ✕ to take one off. Duel opens the formats,
// each with how many of your creatures fit it, and sends the invite (app/duel).
// Shown at the PvP portal (app/pvp) and behind 👥 on the quest board (app/board).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Help from "@/components/Help";
import { onlineClient } from "@/lib/online/client";
import { addFriend, fetchFriends, removeFriend, type Friend } from "@/lib/online/friends";
import { onPlayersOnline, playersOnline } from "@/lib/online/duelChannel";
import { BRING_EXTRA, DEFAULT_PVP, PVP_LEVELS, PVP_RARITIES, PVP_SIZES, eligibleCount, makeFormat, type PvpOptions } from "@/lib/pvp/formats";
import { loadOwnedCreatures } from "@/components/BattleScreen";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

// Who you are (null: signed out, or no online), your friends (null: loading or
// signed out), who's on now, and adding or removing one (the list's fetched again after).
// checked: the sign-in's been looked at (or this copy has no online).
export function useFriends() {
  const [checked, setChecked] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [tries, setTries] = useState(0);
  const [online, setOnline] = useState<Set<string>>(() => playersOnline());
  useEffect(() => onPlayersOnline(setOnline), []);
  useEffect(() => {
    const client = onlineClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- no online in this copy: nothing to wait for
    if (!client) { setChecked(true); return; }
    let live = true;
    (async () => {
      let id: string | null = null;
      try { id = (await client.auth.getSession()).data.session?.user.id ?? null; } catch {}
      const list = id ? await fetchFriends(client) : null;
      if (live) { setMe(id); setFriends(list); setChecked(true); }
    })();
    return () => { live = false; };
  }, [tries]);
  const add = async (id: string) => {
    const client = onlineClient();
    if (client && me && await addFriend(client, me, id)) setTries((n) => n + 1);
  };
  const remove = async (id: string) => {
    const client = onlineClient();
    if (client && me && await removeFriend(client, me, id)) setTries((n) => n + 1);
  };
  return { checked, me, friends, online, add, remove };
}

// Your friends: who's on now (🟢), a duel for those who are, and ✕ to take
// one off. Duel opens the formats, each with how many of your creatures fit it.
export default function FriendList({ friends, online, onRemove }: { friends: Friend[] | null; online: Set<string>; onRemove: (id: string) => void }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState<Friend | null>(null);
  const [opts, setOpts] = useState<PvpOptions>(DEFAULT_PVP);
  if (!friends) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;
  if (choosing) {
    const fmt = makeFormat(opts);
    const fit = eligibleCount(loadOwnedCreatures(fmt.level, fmt.scaleUp), fmt);
    const duel = () => {
      const q = new URLSearchParams({ m: crypto.randomUUID(), f: fmt.id, vs: choosing.name, to: choosing.id });
      router.push(`/duel?${q}`);
    };
    // One row of choices: a label, then a chip for each.
    const row = <T,>(label: string, values: T[], on: (v: T) => boolean, text: (v: T) => string, pick: (v: T) => void) => (
      <div style={{ display: "grid", gridTemplateColumns: "4.5em 1fr", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {values.map((v) => <button key={String(v)} className="chip" data-active={on(v)} onClick={() => pick(v)} style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>{text(v)}</button>)}
        </div>
      </div>
    );
    return (
      <div style={{ display: "grid", gap: 8, padding: "8px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pixel-font" style={{ flex: 1, fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>⚔️ Duel {choosing.name}</span>
          <Help title="Duel options">
            <ul>
              <li><b>Size:</b> how many fight on each side. You each bring up to {BRING_EXTRA} more: both line-ups are shown, then you each pick who fights.</li>
              <li><b>Rarity:</b> the rarest creatures, and gear, allowed.</li>
              <li><b>Level:</b> creatures above it fight at it; those below keep their own level.</li>
              <li><b>Scale everyone:</b> every creature fights at exactly that level, below it or not.</li>
            </ul>
          </Help>
        </div>
        {row("Size", PVP_SIZES, (v) => v === opts.size, (v) => `${v}v${v}`, (size) => setOpts({ ...opts, size }))}
        {row("Rarity", PVP_RARITIES, (v) => v === opts.maxRarity, (v) => v[0].toUpperCase() + v.slice(1), (maxRarity) => setOpts({ ...opts, maxRarity }))}
        {row("Level", PVP_LEVELS, (v) => v === opts.level, (v) => `Lv ${v}`, (level) => setOpts({ ...opts, level }))}
        {row("Scale", [false, true], (v) => v === opts.scaleUp, (v) => (v ? "Everyone" : "Only down"), (scaleUp) => setOpts({ ...opts, scaleUp }))}
        <button className="card-btn" disabled={fit < fmt.size} onClick={duel} style={{ minHeight: 52, flexDirection: "column", alignItems: "flex-start" }}>
          <b>⚔️ Duel · {fmt.name}</b>
          <span style={{ fontSize: 12, color: fit < fmt.size ? "#ff8a80" : MUTED }}>{fit} of your creatures fit{fit < fmt.size ? ` (needs ${fmt.size})` : ""}</span>
        </button>
        <button className="chip" onClick={() => setChoosing(null)} style={{ minHeight: 44, justifyContent: "center" }}>Back</button>
      </div>
    );
  }
  if (!friends.length) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>No friends yet. Tap ➕ next to a player on any board.</p>;
  return (
    <>
      {friends.map((f) => {
        const on = online.has(f.id);
        return (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1.5em 1fr auto 44px", alignItems: "center", gap: 8, minHeight: 48, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#d8d4c8" }}>
            <span aria-label={on ? "On now" : "Not on"} title={on ? "On now" : "Not on"}>{on ? "🟢" : "⚫"}</span>
            <span style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={f.name}>{f.name}</span>
            <button className="chip" disabled={!on} onClick={() => setChoosing(f)} style={{ minHeight: 40, padding: "2px 12px" }}>⚔️ Duel</button>
            <button className="chip" aria-label={`Remove ${f.name}`} title="Remove friend" onClick={() => onRemove(f.id)} style={{ minHeight: 40, minWidth: 40, padding: 0, justifyContent: "center" }}>✕</button>
          </div>
        );
      })}
    </>
  );
}
