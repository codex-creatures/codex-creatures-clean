"use client";
// app/board/page.tsx
// The quest board in the Den, in three tabs. Campaign: the campaign's chapter
// you're on (lib/campaign.ts). Quests: today's two (lib/daily.ts),
// and the Hydra quest, up once the Cyclops is beaten. They play offline. Leaderboards (lib/leaderboard.ts):
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
import { hasBookPlans } from "@/lib/tavern";
import Glyph from "@/components/Glyph";
import RewardReveal from "@/components/RewardReveal";
import { CHAPTERS, PLANS_TAKEN_GOLD, rewardModel, type RewardModel, claimNext, claimedCount, currentChapter, loadCampaign, nextQuest, questDone, readCampaignCtx, rewardText, rollCampaignReward, updateCampaign } from "@/lib/campaign";
import { klutzHelping } from "@/lib/quest";
import { useRouter } from "next/navigation";
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
  const [tab, setTab] = useState<"campaign" | "quests" | "boards">("campaign"); // (opens on the campaign: the user, 2026-11-17)
  const quests = tab !== "boards"; // (the campaign too: neither shows the leaderboards' parts)
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
  const title = tab === "campaign" ? "Campaign" : quests ? "Quests" : showFriends ? "Friends" : kind === "species" ? "Species collected" : kind === "time" ? "Time played" : kind === "scans" ? "Barcodes scanned" : `${BOARD_INFO[kind].name} · ${dungeonName(dungeon)}`;

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <button className="chip" data-active={tab === "campaign"} onClick={() => setTab("campaign")} style={TAB}><Glyph icon="📖" art="ui_campaign" size={18} /> Campaign</button>
          <button className="chip" data-active={tab === "quests"} onClick={() => setTab("quests")} style={TAB}><Glyph icon="📜" art="ui_quests" size={18} /> Quests</button>
          <button className="chip" data-active={tab === "boards"} onClick={() => setTab("boards")} style={TAB}><Glyph icon="🏆" art="ui_leaderboards" size={18} /> Boards</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pixel-font" style={{ fontSize: 17, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tab === "campaign" ? "📖" : quests ? "📜" : showFriends ? "👥" : "🏆"} {title}</div>
            <div style={{ fontSize: 12, color: MUTED, visibility: board && !showFriends && !quests ? "visible" : "hidden" }}>
              Season {board?.season ?? 1}{board ? ` · since ${new Date(board.startedAt).toLocaleDateString()}` : ""}
            </div>
          </div>
          <button className="chip" data-active={showFriends} onClick={() => setShowFriends((v) => !v)} aria-label="Friends" title="Friends"
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center", marginLeft: "auto", visibility: me && !quests ? "visible" : "hidden" }}>👥</button>
          {tab === "campaign" ? (
            <Help title="Campaign">
              <ul>
                <li>Quests that lead you through the game, a chapter at a time. Each chapter ends with a dungeon&apos;s boss.</li>
                <li>Everything you do counts, whenever you do it. But rewards are claimed <b>in order</b>: claim the one above to claim the next.</li>
                <li>➜ takes you to where a quest is done. A ❗ on the board in the Den means a reward is ready.</li>
                <li><b>Crates</b> open as you claim them: materials, gear, codexes or supplies (potions, a Revival Elixir and a torch).</li>
              </ul>
            </Help>
          ) : quests ? (
            <Help title="Quests">
              <ul>
                <li>A ❗ on the board in the Den means a quest has a step for you.</li>
                <li><b>☀️ Today:</b> two quests a day, a big one and a smaller one, the same for everyone and new at midnight. Only what you do that day counts. Finish one, then claim its reward.</li>
                <li>A boss you&apos;ve never beaten is swapped for an easier one (the Abyss for the Hydra, then the Cyclops, then the Encampment).</li>
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

        {/* The campaign and today's quests: notes pinned to a wooden board. The leaderboards: a plain list. */}
        <div className={quests ? "quest-board" : undefined} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", borderRadius: quests ? 2 : 8, background: quests ? undefined : "rgba(0,0,0,0.25)", padding: quests ? "10px 12px" : "4px 8px" }}>
          {tab === "campaign" ? (
            <CampaignList />
          ) : quests ? (
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
// secondary, then the Hydra quest once it's up. Each is a card of fixed
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

  const meta = loadDungeon().meta;
  // The Hydra quest: up once the Cyclops is beaten; its reward, the Training Pit's plans (lib/trainingPit.ts).
  const hydra = hydraStep(game.tavern, meta.clears, meta.deepClears ?? 0);
  const hydraSay = hydra === "hunt" ? "Beat the Hydra. Reward: the Training Pit Schematic."
    : hydra === "claim" ? "You beat the Hydra! Claim the Training Pit Schematic."
    : `Claimed: the Training Pit Schematic.${game.tavern.pit ? "" : " Build it at the Sparring Pit, in the tavern's room."}`;
  return (
    <div style={{ display: "grid", gap: 18, padding: "10px 0" }}>
      {quests.map((q, i) => {
        const done = daily.claimed[i];
        const ready = canClaim(daily, i);
        const text = `${q.task}. Reward: ${q.pays}.`;
        const note = done ? "New quests at midnight" : waits(q) ? "Repair the tavern to claim"
          : full === i ? (q.reward === "cache" ? "The altar's full" : "No room for it") : ready ? "Ready to claim" : "";
        return (
          <div key={i} className="note" style={{ transform: `rotate(${TILT[i % TILT.length]}deg)`, display: "grid", gap: 4, padding: "14px 12px 10px", opacity: done ? 0.75 : 1 }}>
            <span className="note-pin" />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="note-label">{i === 0 ? "☀️ Today" : "🌙 Also today"}</span>
              <span className="note-label">{Math.min(daily.progress[i], q.goal).toLocaleString()}/{q.goal.toLocaleString()}</span>
            </div>
            <div className="pixel-font" style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</div>
            <div title={text} style={CLAMP2}>{text}</div>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 10 }}>
              <button className="pixel-btn" onClick={() => claim(i)} disabled={!ready || waits(q)}
                style={{ visibility: done ? "hidden" : "visible" }}>🎁 Claim</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: ready && full !== i && !waits(q) ? "#2f7a3a" : full === i || waits(q) ? "#a8321e" : "#7a5a30", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</span>
            </div>
            {done && <span className="note-stamp" style={{ right: 14 }}>CLAIMED</span>}
          </div>
        );
      })}

      {hydra !== "closed" && (
        <div className="note note-wanted" style={{ transform: `rotate(${TILT[2]}deg)`, display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 10, padding: "14px 12px 10px", opacity: hydra === "paid" ? 0.75 : 1 }}>
          <span className="note-pin" />
          <WantedPicture chapter={2} />
          <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
            <span className="note-label">Wanted</span>
            <div className="pixel-font" style={{ fontSize: 18, fontWeight: 700 }}>Slay the Hydra</div>
            <div title={hydraSay} style={CLAMP2}>{hydraSay}</div>
            <div style={{ minHeight: 44, display: "flex", alignItems: "center" }}>
              {hydra === "claim" ? <button className="pixel-btn" onClick={game.claimHydraPlans}>📐 Claim the schematic</button>
                : <span style={{ fontSize: 13, fontWeight: 600, color: hydra === "paid" ? "#2f7a3a" : "#7a5a30" }}>{hydra === "paid" ? "Done" : "Not beaten yet"}</span>}
            </div>
          </div>
          {hydra === "paid" && <span className="note-stamp" style={{ right: 14 }}>CLAIMED</span>}
        </div>
      )}

      {prize && <CodeCache title="Daily reward" items={prize} doneLabel="Take it all" intro="Tap a slot to see what's inside." onDone={() => setPrize(null)} />}
    </div>
  );
}
// The campaign (lib/campaign.ts): the chapter you're on, a row per quest, each
// of fixed lines (what to do, then its reward and how far along), with one
// button: Claim on the next reward when its quest is done, ➜ to go and do an
// unfinished one. Rewards are claimed in order.
function CampaignList() {
  const game = useGameState();
  const router = useRouter();
  const [, reread] = useState(0);
  const [prize, setPrize] = useState<{ title: string; drops: Drop[] } | null>(null);
  const [reveal, setReveal] = useState<{ title: string; model: RewardModel; drops: Drop[] } | null>(null); // a crate reward, in 3D before its loot
  const [full, setFull] = useState(false); // the last claim had no room for its reward
  if (!game.hydrated) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;
  if (!klutzHelping(game.quest)) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Finish Klutz&apos;s quest first.</p>;

  const state = loadCampaign(), ctx = readCampaignCtx();
  const claimed = claimedCount(state);
  const ch = currentChapter(state), chapter = CHAPTERS[ch];
  const first = CHAPTERS.slice(0, ch).reduce((n, c) => n + c.quests.length, 0); // the chapter's first quest, in the whole list
  function claim() {
    const s = loadCampaign(), c = readCampaignCtx(), q = nextQuest(s);
    if (!q || !questDone(q, c)) return;
    const r = q.reward;
    const drops = rollCampaignReward(r);
    const codexes = drops.filter((d) => d.dropType === "item" && d.codexMove).length;
    if (drops.length && (fitInBoxes(game.inventory, drops, game.storage).fit.length < drops.length || codexes > game.shelfFree)) { setFull(true); return; }
    setFull(false);
    updateCampaign((x) => claimNext(x, c));
    if ("gold" in r) game.addGold(r.gold);
    // The bookcase's plans: already yours (or built), and it pays gold instead.
    else if ("bookcasePlans" in r) { if (hasBookPlans(game.tavern) || game.bookcase >= 2) game.addGold(PLANS_TAKEN_GOLD); else game.findBookPlans(); }
    else {
      drops.forEach(game.addDrop);
      const model = rewardModel(r);
      if (model) setReveal({ title: rewardText(r), model, drops }); else setPrize({ title: rewardText(r), drops });
    }
    reread((n) => n + 1);
  }
  return (
    <div style={{ display: "grid", gap: 18, padding: "4px 0 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span className="pixel-font title-bar" style={{ fontSize: 14, color: GOLD, padding: "4px 12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Chapter {ch + 1} · {chapter.name}</span>
        <span className="pixel-font" style={{ fontSize: 12, color: "#e9d6a8", whiteSpace: "nowrap" }}>{Math.min(chapter.quests.length, Math.max(0, claimed - first))}/{chapter.quests.length} done</span>
      </div>
      {chapter.quests.map((q, i) => {
        // (The next to claim by its place in the whole list: CAMPAIGN holds copies of the chapters' quests, so
        // comparing the quests themselves never matched, and no reward could be claimed.)
        const at = first + i, got = at < claimed, done = questDone(q, ctx), isNext = at === claimed;
        const wanted = i === chapter.quests.length - 1; // (the chapter's boss: a Wanted poster)
        const prog = Math.min(q.progress(ctx), q.goal);
        const status = got ? "" : done ? (isNext ? (full ? "No room for it" : "Ready to claim") : "Claim the ones above first") : "";
        return (
          <div key={q.id} className={`note${wanted ? " note-wanted" : ""}`} style={{ transform: `rotate(${TILT[i % TILT.length]}deg)`, display: "grid", gridTemplateColumns: wanted ? "auto 1fr 44px" : "1fr 44px", alignItems: "center", gap: 10, padding: "14px 10px 10px 12px", opacity: got ? 0.75 : 1 }}>
            <span className="note-pin" />
            {wanted && <WantedPicture chapter={ch} />}
            <div style={{ minWidth: 0 }}>
              <div className="note-label">{wanted ? "Wanted · final task" : `Quest ${i + 1}`}</div>
              <div title={q.task} style={NOTE_TASK}>{q.task}</div>
              {/* How far along: a box per step for a short goal, else the count; then where it stands. */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 18, marginTop: 4 }}>
                {q.goal > 1 && q.goal <= 6
                  ? Array.from({ length: q.goal }, (_, k) => <span key={k} className="note-pip" data-on={k < prog} />)
                  : <span className="note-label" style={{ fontSize: 11 }}>{prog.toLocaleString()}/{q.goal.toLocaleString()}</span>}
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: isNext && done && !full ? "#2f7a3a" : isNext && full ? "#a8321e" : "#7a5a30", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status}</span>
              </div>
              <div title={rewardText(q.reward)} style={{ fontSize: 12, color: "#6e5232", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🎁 {rewardText(q.reward)}</div>
            </div>
            {isNext && done
              ? <button className="pixel-btn" onClick={claim} aria-label="Claim" title="Claim" style={{ minWidth: 44, minHeight: 44, padding: 0 }}>🎁</button>
              : <button className="note-go" onClick={() => q.go && router.push(q.go)} aria-label="Go there" title="Go there"
                  style={{ visibility: !got && !done && q.go ? "visible" : "hidden" }}>➜</button>}
            {got && <span className="note-stamp">CLAIMED</span>}
          </div>
        );
      })}
      {reveal && <RewardReveal title={reveal.title} model={reveal.model} onOpen={() => { setPrize({ title: reveal.title, drops: reveal.drops }); setReveal(null); }} />}
      {prize && <CodeCache title={prize.title} items={prize.drops} doneLabel="Take it all" intro="Tap a slot to see what's inside." onDone={() => setPrize(null)} />}
    </div>
  );
}

const TAB: React.CSSProperties = { minHeight: 44, justifyContent: "center", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
// Two lines whatever the words, so every note is the same height.
const CLAMP2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35, height: "2.7em", fontSize: 13, color: "#3a2a18" };
// A campaign quest's task, in ink: two lines at most, the space for two always kept.
const NOTE_TASK: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.2, height: "2.4em", fontSize: 15, fontWeight: 700, marginTop: 2 };
// How crooked each note hangs, in turn (degrees).
const TILT = [-1, 1.1, -0.5, 0.7];

// A Wanted poster's picture: the chapter's boss in sepia (the Cyclops, the Hydra), else a
// shadow of whoever it'll be (the camp's chief and the Warden are different every time).
function WantedPicture({ chapter }: { chapter: number }) {
  const art = chapter === 1 ? "/sprites/creatures/cyclops.png" : chapter === 2 ? "/sprites/creatures/hydra/hydra-000.png" : "/sprites/creatures/dire_wolf.png";
  const shadow = chapter !== 1 && chapter !== 2;
  return (
    <div style={{ width: 76, height: 64, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden", boxShadow: "inset 0 0 0 2px rgba(122,90,48,0.5)", background: "radial-gradient(ellipse at 50% 80%, rgba(122,90,48,0.25), transparent 70%)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art} alt="" draggable={false} style={{ maxWidth: 72, maxHeight: 60, imageRendering: "pixelated", filter: shadow ? "brightness(0) opacity(0.55)" : "sepia(0.6) contrast(1.1)" }} />
    </div>
  );
}
