"use client";
// app/board/page.tsx
// The quest board in the Den, in two tabs. Quests: today's two (lib/daily.ts),
// and the Cyclops bounty, up once the tavern's repaired (lib/tavern.ts
// bountyStep): take it, beat the Cyclops, hand in the head. They play offline. Leaderboards (lib/leaderboard.ts):
// species collected, runs and wins in each dungeon, and time played,
// ranked against every player online.
// Fixed frame: the board buttons sit in the dock, the dungeon buttons keep
// their place (hidden on the boards that aren't per dungeon), and the list scrolls inside its panel.
// Each player on a board can be added as a friend (➕); 👥 opens your friend
// list, where you can challenge one who's on to a duel (app/duel, lib/pvp).

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { fetchBoard } from "@/lib/online/leaderboard";
import FriendList, { useFriends } from "@/components/FriendList";
import { BOARD_INFO, BOARD_KINDS, BOARD_TOP, DUNGEON_SHORT, boardKey, perDungeon, boardValue, dungeonName, type Board, type BoardKind } from "@/lib/leaderboard";
import { DUNGEON_IDS, loadDungeon, type DungeonId } from "@/lib/dungeon/run";
import { useGameState } from "@/hooks/useGameState";
import { bountyStep } from "@/lib/tavern";
import { hydraStep } from "@/lib/trainingPit";
import { DAILY_ONLINE, canClaim, claimDaily, dailyCtx, dailyFor, dayKey, loadDaily, rollDailyReward, todayDaily, todaysQuests, updateDaily, type DailyQuest } from "@/lib/daily";
import { CACHE_LIMIT } from "@/hooks/useGameState";
import { fitInBoxes } from "@/lib/items/storage";
import CodeCache from "@/components/CodeCache";
import type { Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const MEDALS = ["🥇", "🥈", "🥉"];

// "off": this copy has no online; "out": not signed in; "failed": couldn't reach the server.
type View = { status: "loading" | "off" | "out" | "failed" } | { status: "ok"; board: Board };

export default function QuestBoardPage() {
  const [tab, setTab] = useState<"quests" | "boards">("quests");
  const quests = tab === "quests";
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

  // Who you are, and your friends.
  const { me, friends, online, add, remove } = useFriends();
  const [showFriends, setShowFriends] = useState(false);
  const friendIds = new Set((friends ?? []).map((f) => f.id));

  const board = view.status === "ok" ? view.board : null;
  const title = quests ? "Quests" : showFriends ? "Friends" : kind === "species" ? "Species collected" : kind === "time" ? "Time played" : kind === "scans" ? "Barcodes scanned" : `${BOARD_INFO[kind].name} · ${dungeonName(dungeon)}`;

  // (Kept on the Quests tab too, hidden, so the panel doesn't change size.)
  const dock = (
    <div className="dock-tabs" style={{ visibility: quests ? "hidden" : "visible" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button className="chip" data-active={quests} onClick={() => setTab("quests")} style={{ minHeight: 44, justifyContent: "center" }}>📜 Quests</button>
          <button className="chip" data-active={!quests} onClick={() => setTab("boards")} style={{ minHeight: 44, justifyContent: "center" }}>🏆 Leaderboards</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 17, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{quests ? "📜" : showFriends ? "👥" : "🏆"} {title}</div>
            <div style={{ fontSize: 12, color: MUTED, visibility: board && !showFriends && !quests ? "visible" : "hidden" }}>
              Season {board?.season ?? 1}{board ? ` · since ${new Date(board.startedAt).toLocaleDateString()}` : ""}
            </div>
          </div>
          <button className="chip" data-active={showFriends} onClick={() => setShowFriends((v) => !v)} aria-label="Friends" title="Friends"
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center", marginLeft: "auto", visibility: me && !quests ? "visible" : "hidden" }}>👥</button>
          {quests ? (
            <Help title="Quests">
              <ul>
                <li>A ❗ on the board in the Den means a quest has a step for you.</li>
                <li><b>☀️ Today:</b> two quests a day, a big one and a smaller one, the same for everyone and new at midnight. Only what you do that day counts. Finish one, then claim its reward.</li>
                <li>A boss you&apos;ve never beaten is swapped for an easier one (the Abyss for the Hydra, then the Cyclops, then the Encampment).</li>
                <li><b>The Cyclops bounty:</b> it goes up once the tavern&apos;s repaired. Take it, beat the Cyclops (a win from before counts) and hand in its head: it&apos;s mounted on the tavern wall. The reward: the <b>Crooked Bookcase Schematic</b>, the only way to get one.</li>
                <li><b>Slay the Hydra:</b> it goes up once you&apos;ve beaten the Cyclops. Beat the Hydra dungeon and claim the <b>Training Pit Schematic</b>: it builds the Sparring Pit up into the Training Pit, twice as fast.</li>
              </ul>
            </Help>
          ) : <Help title="Leaderboards">
            <ul>
              <li>Every player online, ranked. Your numbers go up with your online save, a few seconds after you play.</li>
              <li><b>🐾 Species:</b> every creature species you&apos;ve owned, even ones you&apos;ve let go (as <b>Creatures discovered</b> at the altar).</li>
              <li><b>🏃 Runs:</b> runs started in that dungeon. <b>👑 Wins:</b> its final boss beaten.</li>
              <li><b>⏳ Time:</b> time played (as in Settings: idle time doesn&apos;t count).</li>
              <li><b>📷 Scans:</b> barcodes scanned (scanning one again counts too).</li>
              <li><b>Seasons:</b> when a new one starts, runs, wins, time and scans count again from 0. Species stay.</li>
              <li>Top {BOARD_TOP} are shown. Only players with a name and more than 0 are listed.</li>
              <li><b>➕</b> adds a player to your friends. <b>👥</b> shows them: challenge one who&apos;s on (🟢) to a duel.</li>
            </ul>
          </Help>}
        </div>

        {/* The dungeon buttons keep their space on the other boards, so nothing moves. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, visibility: perDungeon(kind) && !showFriends && !quests ? "visible" : "hidden" }}>
          {DUNGEON_IDS.map((d) => (
            <button key={d} className="chip" data-active={dungeon === d} onClick={() => setDungeon(d)} title={dungeonName(d)}
              style={{ minHeight: 44, justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {DUNGEON_SHORT[d]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, background: "rgba(0,0,0,0.25)", padding: "4px 8px" }}>
          {quests ? (
            <QuestList />
          ) : showFriends ? (
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
        <div className="pixel-font" style={{ fontSize: 14, color: GOLD, minHeight: 20, visibility: board && !showFriends && !quests ? "visible" : "hidden" }}>
          {board?.me ? `You: #${board.me.rank} · ${boardValue(kind, board.me.value)}` : "You're not on this board yet."}
        </div>
      </div>
    </DenFrame>
  );
}

// The quests on the board: today's two (lib/daily.ts), the primary and the
// secondary, then the Cyclops bounty once it's up. Each is a card of fixed
// lines (name, two lines on what to do, then its button or where you're at),
// so a step changes only the words.
function QuestList() {
  const game = useGameState();
  const [, reread] = useState(0);              // read the daily quests again after a claim
  const [prize, setPrize] = useState<Drop[] | null>(null); // what a claim gave, shown as it opens
  const [full, setFull] = useState<number | null>(null);   // a claim with no room for it (which quest)
  // Fix today's quests in the save the first time they're seen (lib/daily.ts todayDaily).
  useEffect(() => { if (game.hydrated) todayDaily(DAILY_ONLINE); }, [game.hydrated]);
  if (!game.hydrated) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;

  const daily = dailyFor(loadDaily(), dayKey(), dailyCtx(DAILY_ONLINE));
  const quests = todaysQuests(daily);
  // The merchant calls at the tavern, so that one waits for the repair.
  const waits = (q: DailyQuest) => q.reward === "merchant" && !game.tavern.repaired;
  function claim(i: number) {
    const q = quests[i];
    if (!canClaim(dailyFor(loadDaily(), dayKey(), dailyCtx(DAILY_ONLINE)), i) || waits(q)) return;
    const drops = rollDailyReward(q.reward);
    const codexes = drops.filter((d) => d.dropType === "item" && d.codexMove).length;
    const room = q.reward === "cache" ? game.caches.length + game.sealed.length < CACHE_LIMIT
      : fitInBoxes(game.inventory, drops, game.storage).fit.length === drops.length && codexes <= game.shelfFree;
    if (!room) { setFull(i); return; }
    setFull(null);
    updateDaily(DAILY_ONLINE, (s) => claimDaily(s, i));
    if (q.reward === "gold") game.addGold(q.gold ?? 0);
    else if (q.reward === "merchant") game.merchantVisits();
    else if (q.reward === "cache") drops.forEach(game.addCache);
    else { drops.forEach(game.addDrop); if (drops.length) setPrize(drops); }
    reread((n) => n + 1);
  }

  // The Cyclops: how often you've beaten it, and the run you first did (the Labyrinth's record).
  const meta = loadDungeon().meta;
  const step = bountyStep(game.tavern, meta.clears);
  const say = step === "offer" ? "Beat the Cyclops and bring back its head. Pays the Crooked Bookcase Schematic."
    : step === "hunt" ? "Beat the Cyclops and bring back its head."
    : step === "head" ? `You have the Cyclops Head${meta.firstClearRun ? ` (run ${meta.firstClearRun})` : ""}. Hand it in to be paid.`
    : `Paid: the Crooked Bookcase Schematic.${game.bookcase < 2 ? " Build it at the bookcase." : ""}`;
  // The Hydra quest: up once the Cyclops is beaten; its reward, the Training Pit's plans (lib/trainingPit.ts).
  const hydra = hydraStep(game.tavern, meta.clears, meta.deepClears ?? 0);
  const hydraSay = hydra === "hunt" ? "Beat the Hydra. Reward: the Training Pit Schematic."
    : hydra === "claim" ? "You beat the Hydra! Claim the Training Pit Schematic."
    : `Claimed: the Training Pit Schematic.${game.tavern.pit ? "" : " Build it at the Sparring Pit, in the tavern's room."}`;
  return (
    <div style={{ display: "grid", gap: 8, padding: "8px 0" }}>
      {quests.map((q, i) => {
        const done = daily.claimed[i];
        const ready = canClaim(daily, i);
        const text = `${q.task}. Reward: ${q.pays}.`;
        const note = done ? "Claimed: new quests at midnight" : waits(q) ? "Repair the tavern to claim"
          : full === i ? (q.reward === "cache" ? "The altar's full" : "No room for it") : `${Math.min(daily.progress[i], q.goal)}/${q.goal}`;
        return (
          <div key={i} className="stone-panel" style={{ display: "grid", gap: 6, padding: "10px 12px", opacity: done ? 0.7 : 1 }}>
            <div className="pixel-font" style={{ fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {done ? "✓" : ready ? "❗" : i === 0 ? "☀️" : "🌙"} {i === 0 ? "Today" : "Also today"}: {q.name}
            </div>
            <div title={text} style={CLAMP2}>{text}</div>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 10 }}>
              <button className="pixel-btn" onClick={() => claim(i)} disabled={!ready || waits(q)}
                style={{ visibility: done ? "hidden" : "visible" }}>🎁 Claim</button>
              <span className="pixel-font" style={{ fontSize: 13, color: done ? "#5ee08a" : full === i || waits(q) ? "#ff8a80" : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</span>
            </div>
          </div>
        );
      })}

      {step !== "closed" && (
        <div className="stone-panel" style={{ display: "grid", gap: 6, padding: "10px 12px", opacity: step === "paid" ? 0.7 : 1 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {step === "paid" ? "✓" : step === "offer" || step === "head" ? "❗" : "🗿"} The Cyclops bounty
          </div>
          <div title={say} style={CLAMP2}>{say}</div>
          <div style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
            {step === "offer" ? <button className="pixel-btn" onClick={game.takeBounty}>📜 Take the bounty</button>
              : step === "head" ? <button className="pixel-btn" onClick={game.mountCyclopsHead}>🗿 Hand in the head</button>
              : <span className="pixel-font" style={{ fontSize: 13, color: step === "paid" ? "#5ee08a" : MUTED }}>{step === "paid" ? "Done" : "Cyclops: not beaten yet"}</span>}
          </div>
        </div>
      )}

      {hydra !== "closed" && (
        <div className="stone-panel" style={{ display: "grid", gap: 6, padding: "10px 12px", opacity: hydra === "paid" ? 0.7 : 1 }}>
          <div className="pixel-font" style={{ fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {hydra === "paid" ? "✓" : hydra === "claim" ? "❗" : "🐉"} Slay the Hydra
          </div>
          <div title={hydraSay} style={CLAMP2}>{hydraSay}</div>
          <div style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
            {hydra === "claim" ? <button className="pixel-btn" onClick={game.claimHydraPlans}>📐 Claim the schematic</button>
              : <span className="pixel-font" style={{ fontSize: 13, color: hydra === "paid" ? "#5ee08a" : MUTED }}>{hydra === "paid" ? "Done" : "Hydra: not beaten yet"}</span>}
          </div>
        </div>
      )}

      {prize && <CodeCache title="Daily reward" items={prize} doneLabel="Take it all" intro="Tap a slot to see what's inside." onDone={() => setPrize(null)} />}
    </div>
  );
}
// Two lines whatever the words, so every card is the same height.
const CLAMP2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35, height: "2.7em", fontSize: 13, color: "#d8d4c8" };
