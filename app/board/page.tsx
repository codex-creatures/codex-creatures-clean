"use client";
// app/board/page.tsx
// The quest board in the Den. For now it holds the leaderboards
// (lib/leaderboard.ts): species collected, runs and wins in each dungeon, and time played,
// ranked against every player online. Daily quests will join them here.
// Fixed frame: the board buttons sit in the dock, the dungeon buttons keep
// their place (hidden on the boards that aren't per dungeon), and the list scrolls inside its panel.

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { fetchBoard } from "@/lib/online/leaderboard";
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

  const board = view.status === "ok" ? view.board : null;
  const title = kind === "species" ? "Species collected" : kind === "time" ? "Time played" : `${BOARD_INFO[kind].name} · ${dungeonName(dungeon)}`;

  const dock = (
    <div className="dock-tabs">
      {BOARD_KINDS.map((k) => (
        <button key={k} className="dock-tab" data-active={kind === k} onClick={() => setKind(k)}>{BOARD_INFO[k].icon} {BOARD_INFO[k].name}</button>
      ))}
    </div>
  );

  return (
    <DenFrame title="Quest Board" icon="📜" fill dock={dock}>
      <div className="stone-panel" style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, padding: "12px 12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 17, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🏆 {title}</div>
            <div style={{ fontSize: 12, color: MUTED, visibility: board ? "visible" : "hidden" }}>
              Season {board?.season ?? 1}{board ? ` · since ${new Date(board.startedAt).toLocaleDateString()}` : ""}
            </div>
          </div>
          <Help title="Leaderboards">
            <ul>
              <li>Every player online, ranked. Your numbers go up with your online save, a few seconds after you play.</li>
              <li><b>🐾 Species:</b> how many of the creature species you have (as <b>Creatures discovered</b> at the altar).</li>
              <li><b>🏃 Runs:</b> runs started in that dungeon. <b>👑 Wins:</b> its final boss beaten.</li>
              <li><b>⏳ Time:</b> time played (as in Settings: idle time doesn&apos;t count).</li>
              <li><b>Seasons:</b> when a new one starts, runs, wins and time count again from 0. Species stay.</li>
              <li>Top {BOARD_TOP} are shown. Only players with a name and more than 0 are listed.</li>
            </ul>
          </Help>
        </div>

        {/* The dungeon buttons keep their space on the other boards, so nothing moves. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, visibility: perDungeon(kind) ? "visible" : "hidden" }}>
          {DUNGEON_IDS.map((d) => (
            <button key={d} className="chip" data-active={dungeon === d} onClick={() => setDungeon(d)} title={dungeonName(d)}
              style={{ minHeight: 44, justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {DUNGEON_SHORT[d]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, background: "rgba(0,0,0,0.25)", padding: "4px 8px" }}>
          {view.status === "ok" ? (
            view.board.top.length === 0
              ? <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Nobody&apos;s on this board yet.</p>
              : view.board.top.map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "3em 1fr auto", alignItems: "center", gap: 8, minHeight: 36, borderBottom: "1px solid rgba(255,255,255,0.06)", color: r.me ? GOLD : "#d8d4c8", fontWeight: r.me ? 700 : 400 }}>
                  <span className="pixel-font" style={{ fontSize: 15 }}>{MEDALS[r.rank - 1] ?? `#${r.rank}`}</span>
                  <span style={{ fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.name}>{r.name}</span>
                  <span className="pixel-font" style={{ fontSize: 15 }}>{boardValue(kind, r.value)}</span>
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
        <div className="pixel-font" style={{ fontSize: 14, color: GOLD, minHeight: 20, visibility: board ? "visible" : "hidden" }}>
          {board?.me ? `You: #${board.me.rank} · ${boardValue(kind, board.me.value)}` : "You're not on this board yet."}
        </div>
      </div>
    </DenFrame>
  );
}
