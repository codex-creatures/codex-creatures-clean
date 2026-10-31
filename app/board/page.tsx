"use client";
// app/board/page.tsx
// The quest board in the Den. For now it holds the leaderboards
// (lib/leaderboard.ts): species collected, runs and wins in each dungeon, and time played,
// ranked against every player online. Daily quests will join them here.
// Fixed frame: the board buttons sit in the dock, the dungeon buttons keep
// their place (hidden on the boards that aren't per dungeon), and the list scrolls inside its panel.
// Each player on a board can be added as a friend (➕); 👥 opens your friend
// list, where you can challenge one who's on to a duel (app/duel, lib/pvp).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { fetchBoard } from "@/lib/online/leaderboard";
import { addFriend, fetchFriends, removeFriend, type Friend } from "@/lib/online/friends";
import { onPlayersOnline, playersOnline } from "@/lib/online/duelChannel";
import { PVP_FORMAT_IDS, PVP_FORMATS, eligibleCount, type PvpFormatId } from "@/lib/pvp/formats";
import { loadOwnedCreatures } from "@/components/BattleScreen";
import { BOARD_INFO, BOARD_KINDS, BOARD_TOP, DUNGEON_SHORT, boardKey, perDungeon, boardValue, dungeonName, type Board, type BoardKind } from "@/lib/leaderboard";
import { DUNGEON_IDS, type DungeonId } from "@/lib/dungeon/run";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const MEDALS = ["🥇", "🥈", "🥉"];

// "off": this copy has no online; "out": not signed in; "failed": couldn't reach the server.
type View = { status: "loading" | "off" | "out" | "failed" } | { status: "ok"; board: Board };

export default function QuestBoardPage() {
  const [kind, setKind] = useState<BoardKind>("species");
  const [dungeon, setDungeon] = useState<DungeonId>(1);
  const [tries, setTries] = useState(0);
  const key = boardKey(kind, dungeon);
  // What came back, and for which ask (a different board, or a retry, shows Loading… until its answer).
  const [got, setGot] = useState<{ ask: string; view: View } | null>(null);
  const ask = `${key}|${tries}`;
  const view: View = !onlineConfig.ok ? { status: "off" } : got?.ask === ask ? got.view : { status: "loading" };

  useEffect(() => {
    const client = onlineClient();
    if (!client) return;
    let live = true;
    (async () => {
      let signedIn = false;
      try { signedIn = !!(await client.auth.getSession()).data.session; } catch {}
      const board = signedIn ? await fetchBoard(client, key) : null;
      if (live) setGot({ ask, view: !signedIn ? { status: "out" } : board ? { status: "ok", board } : { status: "failed" } });
    })();
    return () => { live = false; };
  }, [key, ask]);

  // Who you are, and your friends (fetched again after each change).
  const [me, setMe] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendTries, setFriendTries] = useState(0);
  const [showFriends, setShowFriends] = useState(false);
  const [online, setOnline] = useState<Set<string>>(() => playersOnline());
  useEffect(() => onPlayersOnline(setOnline), []);
  useEffect(() => {
    const client = onlineClient();
    if (!client) return;
    let live = true;
    (async () => {
      let id: string | null = null;
      try { id = (await client.auth.getSession()).data.session?.user.id ?? null; } catch {}
      const list = id ? await fetchFriends(client) : null;
      if (live) { setMe(id); setFriends(list); }
    })();
    return () => { live = false; };
  }, [friendTries]);
  const friendIds = new Set((friends ?? []).map((f) => f.id));
  const add = async (id: string) => {
    const client = onlineClient();
    if (client && me && await addFriend(client, me, id)) setFriendTries((n) => n + 1);
  };
  const remove = async (id: string) => {
    const client = onlineClient();
    if (client && me && await removeFriend(client, me, id)) setFriendTries((n) => n + 1);
  };

  const board = view.status === "ok" ? view.board : null;
  const title = showFriends ? "Friends" : kind === "species" ? "Species collected" : kind === "time" ? "Time played" : kind === "scans" ? "Barcodes scanned" : `${BOARD_INFO[kind].name} · ${dungeonName(dungeon)}`;

  const dock = (
    <div className="dock-tabs">
      {BOARD_KINDS.map((k) => (
        <button key={k} className="dock-tab" data-active={!showFriends && kind === k} onClick={() => { setKind(k); setShowFriends(false); }}
          style={{ flexDirection: "column", gap: 0, fontSize: 12, lineHeight: 1.2 }}>{/* (icon over name: five fit across a phone) */}
          <span>{BOARD_INFO[k].icon}</span><span>{BOARD_INFO[k].name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <DenFrame title="Quest Board" icon="📜" fill dock={dock}>
      <div className="stone-panel" style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, padding: "12px 12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 17, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{showFriends ? "👥" : "🏆"} {title}</div>
            <div style={{ fontSize: 12, color: MUTED, visibility: board && !showFriends ? "visible" : "hidden" }}>
              Season {board?.season ?? 1}{board ? ` · since ${new Date(board.startedAt).toLocaleDateString()}` : ""}
            </div>
          </div>
          <button className="chip" data-active={showFriends} onClick={() => setShowFriends((v) => !v)} aria-label="Friends" title="Friends"
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center", marginLeft: "auto", visibility: me ? "visible" : "hidden" }}>👥</button>
          <Help title="Leaderboards">
            <ul>
              <li>Every player online, ranked. Your numbers go up with your online save, a few seconds after you play.</li>
              <li><b>🐾 Species:</b> how many of the creature species you have (as <b>Creatures discovered</b> at the altar).</li>
              <li><b>🏃 Runs:</b> runs started in that dungeon. <b>👑 Wins:</b> its final boss beaten.</li>
              <li><b>⏳ Time:</b> time played (as in Settings: idle time doesn&apos;t count).</li>
              <li><b>📷 Scans:</b> barcodes scanned (scanning one again counts too).</li>
              <li><b>Seasons:</b> when a new one starts, runs, wins, time and scans count again from 0. Species stay.</li>
              <li>Top {BOARD_TOP} are shown. Only players with a name and more than 0 are listed.</li>
              <li><b>➕</b> adds a player to your friends. <b>👥</b> shows them: challenge one who&apos;s on (🟢) to a duel.</li>
            </ul>
          </Help>
        </div>

        {/* The dungeon buttons keep their space on the other boards, so nothing moves. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, visibility: perDungeon(kind) && !showFriends ? "visible" : "hidden" }}>
          {DUNGEON_IDS.map((d) => (
            <button key={d} className="chip" data-active={dungeon === d} onClick={() => setDungeon(d)} title={dungeonName(d)}
              style={{ minHeight: 44, justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {DUNGEON_SHORT[d]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, background: "rgba(0,0,0,0.25)", padding: "4px 8px" }}>
          {showFriends ? (
            <FriendList friends={friends} online={online} onRemove={remove} />
          ) : view.status === "ok" ? (
            view.board.top.length === 0
              ? <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Nobody&apos;s on this board yet.</p>
              : view.board.top.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "3em 1fr auto 44px", alignItems: "center", gap: 8, minHeight: 44, borderBottom: "1px solid rgba(255,255,255,0.06)", color: r.me ? GOLD : "#d8d4c8", fontWeight: r.me ? 700 : 400 }}>
                  <span className="pixel-font" style={{ fontSize: 15 }}>{MEDALS[r.rank - 1] ?? `#${r.rank}`}</span>
                  <span style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.name}>{r.name}</span>
                  <span className="pixel-font" style={{ fontSize: 15 }}>{boardValue(kind, r.value)}</span>
                  {/* Add as a friend: ✓ once added; the space stays on your own row. */}
                  {r.id && !r.me && friendIds.has(r.id)
                    ? <span aria-label="Your friend" title="Your friend" style={{ textAlign: "center", color: "#5ee08a" }}>✓</span>
                    : <button className="chip" aria-label={`Add ${r.name} as a friend`} title="Add friend" onClick={() => r.id && add(r.id)}
                        style={{ minHeight: 40, minWidth: 40, padding: 0, justifyContent: "center", visibility: r.id && !r.me && friends ? "visible" : "hidden" }}>➕</button>}
                </div>
              ))
          ) : (
            <div style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>
              {view.status === "loading" ? "Loading…"
                : view.status === "off" ? "Leaderboards are part of the online game."
                : view.status === "out" ? "Sign in on the title screen to see the leaderboards."
                : <>Couldn&apos;t reach the server.<div style={{ marginTop: 12 }}><button className="pixel-btn" onClick={() => setTries((n) => n + 1)}>↻ Try again</button></div></>}
            </div>
          )}
        </div>

        {/* You, wherever you are on the board (always one line, so the list never shifts). */}
        <div className="pixel-font" style={{ fontSize: 14, color: GOLD, minHeight: 20, visibility: board && !showFriends ? "visible" : "hidden" }}>
          {board?.me ? `You: #${board.me.rank} · ${boardValue(kind, board.me.value)}` : "You're not on this board yet."}
        </div>
      </div>
    </DenFrame>
  );
}

// Your friends: who's on now (🟢), a duel for those who are, and ✕ to take
// one off. Duel opens the formats, each with how many of your creatures fit it.
function FriendList({ friends, online, onRemove }: { friends: Friend[] | null; online: Set<string>; onRemove: (id: string) => void }) {
  const router = useRouter();
  const [choosing, setChoosing] = useState<Friend | null>(null);
  if (!friends) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;
  if (choosing) {
    const duel = (f: PvpFormatId) => {
      const q = new URLSearchParams({ m: crypto.randomUUID(), f, vs: choosing.name, to: choosing.id });
      router.push(`/duel?${q}`);
    };
    return (
      <div style={{ display: "grid", gap: 8, padding: "8px 0" }}>
        <div className="pixel-font" style={{ fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>⚔️ Duel {choosing.name}</div>
        {PVP_FORMAT_IDS.map((f) => {
          const fmt = PVP_FORMATS[f];
          const fit = eligibleCount(loadOwnedCreatures(fmt.level), fmt);
          return (
            <button key={f} className="card-btn" disabled={fit < fmt.size} onClick={() => duel(f)} style={{ minHeight: 52, flexDirection: "column", alignItems: "flex-start" }}>
              <b>{fmt.name}</b>
              <span style={{ fontSize: 12, color: fit < fmt.size ? "#ff8a80" : MUTED }}>{fit} of your creatures fit{fit < fmt.size ? ` (needs ${fmt.size})` : ""}</span>
            </button>
          );
        })}
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
