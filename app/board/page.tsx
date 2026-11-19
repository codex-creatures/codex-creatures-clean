"use client";
// app/board/page.tsx
// The quest board in the Den, in three tabs. Campaign: the campaign's chapter
// you're on (lib/campaign.ts). Daily Quests: today's two (lib/daily.ts),
// and the Hydra quest, up once the Cyclops is beaten. They play offline. Leaderboards (lib/leaderboard.ts):
// species collected, runs and wins in each dungeon, and time played,
// ranked against every player online.
// Fixed frame: the board buttons sit in the dock, the dungeon buttons keep
// their place (hidden on the boards that aren't per dungeon), and the list scrolls inside its panel.
// Each player on a board can be added as a friend (➕); 👥 opens your friend
// list, where you can challenge one who's on to a duel (app/duel, lib/pvp).

import { useEffect, useRef, useState } from "react";
import DenFrame from "@/components/DenFrame";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { fetchBoard } from "@/lib/online/leaderboard";
import FriendList, { useFriends } from "@/components/FriendList";
import { BOARD_INFO, BOARD_KINDS, DUNGEON_SHORT, boardKey, perDungeon, boardValue, dungeonName, type Board, type BoardKind } from "@/lib/leaderboard";
import { DUNGEON_IDS, loadDungeon, type DungeonId } from "@/lib/dungeon/run";
import { useGameState } from "@/hooks/useGameState";
import { hasBookPlans } from "@/lib/tavern";
import Glyph from "@/components/Glyph";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { CHAPTERS, CRATE_NAMES, PLANS_TAKEN_GOLD, rewardBlocked, type CampaignReward, claimNext, claimedCount, currentChapter, loadCampaign, lookedAtCampaign, nextQuest, questDone, readCampaignCtx, rewardText, rollCampaignReward, updateCampaign } from "@/lib/campaign";
import { klutzHelping } from "@/lib/quest";
import { useRouter } from "next/navigation";
import { hydraStep } from "@/lib/trainingPit";
import { DAILY_ONLINE, canClaim, claimDaily, dailyCtx, dailyFor, dayKey, loadDaily, rollDailyReward, todayDaily, todaysQuests, updateDaily, waitsForTavern, type DailyQuest, type DailyReward } from "@/lib/daily";
import { CACHE_LIMIT } from "@/hooks/useGameState";
import CodeCache from "@/components/CodeCache";
import ClaimBurst, { type ClaimShow } from "@/components/ClaimBurst";
import { buzz } from "@/lib/haptics";
import type { Drop } from "@/lib/types";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const MEDALS = ["🥇", "🥈", "🥉"];

// "off": this copy has no online; "out": not signed in; "failed": couldn't reach the server.
type View = { status: "loading" | "off" | "out" | "failed" } | { status: "ok"; board: Board };

export default function QuestBoardPage() {
  // Opens on the campaign (the user, 2026-11-17), or on today's quests from the Den's daily popup (?tab=daily).
  // (Read as it mounts: the screen only shows once the page is in the browser, GameScreen.)
  const [tab, setTab] = useState<"campaign" | "quests" | "boards">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "daily" ? "quests" : "campaign");
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

  // The dock (the leaderboards) only on the Boards tab: an empty one is just a black strip (the user, 2026-11-17).
  return (
    <DenFrame title="Quest Board" icon={<Glyph icon="📜" art="ui_quests" />} fill dock={quests ? undefined : dock}>
      <div className="stone-panel" style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "8px 4px 6px" }}>
        {/* The tabs, in plain words, as an old filer's: the one you're on runs into its page (the same colour, no
            line between), the others sit back. Out to the panel's trim. No title or "?" row (the user, 2026-11-17). */}
        <div className="folder-tabs" role="tablist">
          {([["campaign", "Campaign"], ["quests", "Daily Quests"], ["boards", "Leaderboards"]] as const).map(([t, name]) => (
            <button key={t} role="tab" aria-selected={tab === t} className="folder-tab" data-active={tab === t} data-tone={t === "boards" ? "stone" : "wood"} onClick={() => setTab(t)}>{name}</button>
          ))}
        </div>
        {/* The page: the campaign and today's quests, notes pinned to a wooden board; the leaderboards, a plain list. */}
        <div className={`folder-page${quests ? " quest-board" : ""}`} data-tone={quests ? "wood" : "stone"}>
          {/* The leaderboards: the dungeon buttons (their space kept on the other boards, so nothing moves) and 👥 friends. */}
          {!quests && (
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, visibility: perDungeon(kind) && !showFriends ? "visible" : "hidden" }}>
                {DUNGEON_IDS.map((d) => (
                  <button key={d} className="chip" data-active={dungeon === d} onClick={() => setDungeon(d)} title={dungeonName(d)}
                    style={{ minHeight: 44, justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {DUNGEON_SHORT[d]}
                  </button>
                ))}
              </div>
              <button className="chip" data-active={showFriends} onClick={() => setShowFriends((v) => !v)} aria-label="Friends" title="Friends"
                style={{ minHeight: 44, minWidth: 44, justifyContent: "center", visibility: me ? "visible" : "hidden" }}>👥</button>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", borderRadius: quests ? 0 : 6, background: quests ? undefined : "rgba(0,0,0,0.25)", padding: quests ? "10px 10px" : "4px 8px" }}>
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

          {/* You, wherever you are on the board (always one line, so the list never shifts; not on the quest tabs). */}
          {!quests && <div className="pixel-font" style={{ fontSize: 14, color: GOLD, minHeight: 20, visibility: board && !showFriends ? "visible" : "hidden" }}>
            {board?.me ? `You: #${board.me.rank} · ${boardValue(kind, board.me.value)}` : "You're not on this board yet."}
          </div>}
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
  const [burst, setBurst] = useState<{ show: ClaimShow; drops: Drop[] | null } | null>(null); // a claim's celebration, then its box
  // Fix today's quests in the save the first time they're seen (lib/daily.ts todayDaily).
  useEffect(() => { if (game.hydrated) todayDaily(DAILY_ONLINE); }, [game.hydrated]);
  if (!game.hydrated) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;

  const daily = dailyFor(loadDaily(), dayKey(), dailyCtx(DAILY_ONLINE));
  const quests = todaysQuests(daily);
  // The merchant calls at the tavern, so that one waits for the repair.
  const waits = (q: DailyQuest) => waitsForTavern(q, !!game.tavern.repaired);
  // note: the quest's note (its reward picture is where the celebration starts).
  function claim(i: number, note: Element | null) {
    const q = quests[i];
    if (!canClaim(dailyFor(loadDaily(), dayKey(), dailyCtx(DAILY_ONLINE)), i) || waits(q)) return;
    const drops = rollDailyReward(q.reward);
    const codexes = drops.filter((d) => d.dropType === "item" && d.codexMove).length;
    // A reward always comes home, even into a full box (as a run's haul does: the user, 2026-11-17); a Code
    // Cache needs a space at the altar, and a codex a space on the bookcase.
    const room = q.reward === "cache" ? game.caches.length + game.sealed.length < CACHE_LIMIT : codexes === 0 || codexes <= game.shelfFree;
    if (!room) { setFull(i); return; }
    setFull(null);
    updateDaily(DAILY_ONLINE, (s) => claimDaily(s, i));
    let box: Drop[] | null = null;
    if (q.reward === "gold") game.addGold(q.gold ?? 0);
    else if (q.reward === "merchant") game.merchantVisits();
    else if (q.reward === "cache") drops.forEach(game.addCache);
    else { drops.forEach(game.addDrop); if (drops.length > 1) box = drops; } // (one thing: the celebration shows it, and it's yours)
    const look = dailyLook(q);
    setBurst({ show: { art: look.art, tint: look.tint, text: q.reward === "gold" ? `+${(q.gold ?? 0).toLocaleString()} gold` : q.pays,
      from: note?.querySelector(".reward-badge")?.getBoundingClientRect() ?? null }, drops: box });
    buzz("levelUp");
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
          : full === i ? (q.reward === "cache" ? "The scanner's full" : "Your bookcase is full") : ready ? "Ready to claim" : "";
        return (
          <div key={i} className="note" style={{ transform: `rotate(${TILT[i % TILT.length]}deg)`, display: "grid", gridTemplateColumns: "58px 1fr", alignItems: "center", gap: 10, padding: "14px 12px 10px 10px", opacity: done ? 0.75 : 1 }}>
            <span className="note-pin" />
            <Badge {...dailyLook(q)} title={q.pays} ready={ready && !waits(q)} />
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span className="note-label">{i === 0 ? "☀️ Today" : "🌙 Also today"}</span>
                <span className="note-label">{Math.min(daily.progress[i], q.goal).toLocaleString()}/{q.goal.toLocaleString()}</span>
              </div>
              <div className="pixel-font" style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.name}</div>
              <div title={text} style={CLAMP2}>{text}</div>
              <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 10 }}>
                <button className="pixel-btn" onClick={(e) => claim(i, e.currentTarget.closest(".note"))} disabled={!ready || waits(q)}
                  style={{ visibility: done ? "hidden" : "visible" }}>🎁 Claim</button>
                <span style={{ fontSize: 13, fontWeight: 600, color: ready && full !== i && !waits(q) ? "#2f7a3a" : full === i || waits(q) ? "#a8321e" : "#7a5a30", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</span>
              </div>
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

      {burst && <ClaimBurst show={burst.show} onDone={() => { const b = burst; setBurst(null); if (b.drops) setPrize(b.drops); }} />}
      {prize && <CodeCache title="Daily reward" items={prize} doneLabel="Take it all" intro="Tap a slot to see what's inside." onDone={() => setPrize(null)} />}
    </div>
  );
}
// The campaign (lib/campaign.ts): the chapter you're on, a row per quest, each
// of fixed lines (what to do, then its reward and how far along), with one
// button: Claim on the next reward when its quest is done, ➜ to go and do an
// unfinished one. Rewards are claimed in order.
const CAMPAIGN_GLIDE_MS = 450; // how long the campaign shows its top before gliding down to your quest
function CampaignList() {
  const game = useGameState();
  const router = useRouter();
  const [, reread] = useState(0);
  const [prize, setPrize] = useState<{ title: string; drops: Drop[] } | null>(null); // a reward's box, its "?"s to open
  const [blocked, setBlocked] = useState<string | null>(null); // why the last claim couldn't be taken
  // A claim's celebration (its picture flying up from the note), then its box (if it has one).
  const [burst, setBurst] = useState<{ show: ClaimShow; drops: Drop[] | null; title: string } | null>(null);
  // Opened, the list starts at the top, then glides down to the quest you're on (the user, 2026-11-17).
  const current = useRef<HTMLDivElement>(null), glided = useRef(false);
  // Seen: the Den's quest board loses its first ❗ (lib/campaign.ts campaignUnseen); the first quest's ➜ (do an
  // Encampment run) glows till its reward's claimed.
  useEffect(() => { if (game.hydrated && klutzHelping(game.quest)) updateCampaign(lookedAtCampaign); }, [game.hydrated, game.quest]);
  useEffect(() => {
    if (glided.current || !current.current) return;
    glided.current = true;
    const el = current.current; // (not cancelled by a re-render: it runs once)
    window.setTimeout(() => { if (el.isConnected) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, CAMPAIGN_GLIDE_MS);
  });
  if (!game.hydrated) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Loading…</p>;
  if (!klutzHelping(game.quest)) return <p style={{ color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24 }}>Finish Klutz&apos;s quest first.</p>;

  const state = loadCampaign(), ctx = readCampaignCtx();
  const claimed = claimedCount(state);
  const ch = currentChapter(state), chapter = CHAPTERS[ch];
  const first = CHAPTERS.slice(0, ch).reduce((n, c) => n + c.quests.length, 0); // the chapter's first quest, in the whole list
  const doneHere = Math.min(chapter.quests.length, Math.max(0, claimed - first));
  // note: the quest's note, tapped (its reward picture is where the celebration starts).
  function claim(note: HTMLElement) {
    const s = loadCampaign(), c = readCampaignCtx(), q = nextQuest(s);
    if (!q || !questDone(q, c)) return;
    const r = q.reward;
    const drops = rollCampaignReward(r);
    // (A full box never holds a reward back; only a full bookcase does: lib/campaign.ts rewardBlocked.)
    const why = rewardBlocked(drops, game.shelfFree);
    if (why) { setBlocked(why); return; }
    setBlocked(null);
    updateCampaign((x) => claimNext(x, c));
    let text = "crate" in r ? CRATE_NAMES[r.crate] : rewardText(r), box: Drop[] | null = null; // (a crate: its rarities are on the box)
    if ("gold" in r) { game.addGold(r.gold); text = `+${r.gold.toLocaleString()} gold`; }
    // The bookcase's plans: already yours (or built), and it pays gold instead.
    else if ("bookcasePlans" in r) {
      if (hasBookPlans(game.tavern) || game.bookcase >= 2) { game.addGold(PLANS_TAKEN_GOLD); text = `+${PLANS_TAKEN_GOLD} gold`; }
      else { game.findBookPlans(); text = "The Crooked Bookcase Schematic"; }
    }
    // Everything else: its box after, each "?" to open (or all at once), as Klutz's armoury box; one thing (the
    // Gold Key, an enchanted piece) goes straight in: the celebration showed it (the user, 2026-11-17).
    else { drops.forEach(game.addDrop); if (drops.length > 1) box = drops; }
    const look = rewardLook(r);
    setBurst({ show: { art: look.art, inside: look.inside, tint: look.tint, text, from: note.querySelector(".reward-badge")?.getBoundingClientRect() ?? null }, drops: box, title: rewardText(r) });
    buzz("levelUp");
    reread((n) => n + 1);
  }
  return (
    <div style={{ position: "relative", display: "grid", gap: 16, padding: "2px 0 12px" }}>
      {/* The chapter: its name, and how far through it you are. */}
      <div className="title-bar" style={{ padding: "8px 12px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span className="pixel-font" style={{ fontSize: 11, color: "#c9a46a", letterSpacing: "0.08em" }}>CHAPTER {ch + 1}</span>
          <span className="pixel-font" style={{ fontSize: 12, color: "#e9d6a8" }}>{doneHere}/{chapter.quests.length} claimed</span>
        </div>
        <div className="pixel-font" style={{ fontSize: 20, color: GOLD, margin: "2px 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chapter.name}</div>
        <div className="chapter-bar"><span style={{ width: `${(100 * doneHere) / chapter.quests.length}%` }} /></div>
      </div>
      {chapter.quests.map((q, i) => {
        // (The next to claim by its place in the whole list: CAMPAIGN holds copies of the chapters' quests, so
        // comparing the quests themselves never matched, and no reward could be claimed.)
        const at = first + i, got = at < claimed, done = questDone(q, ctx), ready = at === claimed && done;
        const wanted = i === chapter.quests.length - 1; // (the chapter's boss: a Wanted poster)
        const prog = got ? q.goal : Math.min(q.progress(ctx), q.goal); // (claimed: shown full, whatever counts now)
        return (
          <div key={q.id} ref={at === claimed ? current : undefined} className={`note${wanted ? " note-wanted" : ""}${ready ? " note-ready" : ""}`}
            onClick={ready ? (e) => claim(e.currentTarget) : undefined} role={ready ? "button" : undefined} tabIndex={ready ? 0 : undefined}
            onKeyDown={ready ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); claim(e.currentTarget); } } : undefined}
            aria-label={ready ? `Claim ${rewardText(q.reward)}` : undefined}
            style={{ transform: `rotate(${TILT[i % TILT.length]}deg)`, display: "grid", gridTemplateColumns: wanted ? "76px 1fr 44px" : "58px 1fr 44px", alignItems: "center", gap: 10, padding: "14px 10px 10px", opacity: got ? 0.6 : 1, cursor: ready ? "pointer" : undefined }}>
            <span className="note-pin" />
            {wanted ? <WantedPicture chapter={ch} /> : <RewardBadge r={q.reward} ready={ready} />}
            <div style={{ minWidth: 0 }}>
              <div className="note-label">{wanted ? "Wanted · final task" : `Quest ${i + 1}`}</div>
              <div title={q.task} style={NOTE_TASK}>{q.task}</div>
              <QuestProgress id={q.id} goal={q.goal} prog={prog} />
              {wanted && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}><RewardBadge r={q.reward} small ready={ready} /><span style={{ fontSize: 12, color: "#6e5232", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rewardText(q.reward)}</span></div>}
              {/* Where it stands; a claim that couldn't be taken says why here, on the note you tapped. */}
              <div style={{ fontSize: 12, fontWeight: 700, minHeight: 16, marginTop: 2, color: ready && blocked ? "#a8321e" : ready ? "#2f7a3a" : "#7a5a30", ...(ready && blocked ? {} : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) }}>
                {ready ? blocked ?? "Done! Tap to claim" : done && !got ? "Claim the ones above first" : ""}
              </div>
            </div>
            {got ? <span className="note-seal" title="Claimed" aria-label="Claimed">✓</span>
              : ready ? <span aria-hidden style={{ width: 44 }} />
              : <button className={`note-go${claimed === 0 && at === claimed ? " tutorial-pulse" : ""}`} onClick={(e) => { e.stopPropagation(); if (q.go) router.push(q.go); }} aria-label="Go there" title="Go there"
                  style={{ visibility: !done && q.go ? "visible" : "hidden" }}>➜</button>}
          </div>
        );
      })}
      {burst && <ClaimBurst show={burst.show} onDone={() => { const b = burst; setBurst(null); if (b.drops) setPrize({ title: b.title, drops: b.drops }); }} />}
      {prize && <CodeCache title={prize.title} items={prize.drops} doneLabel="Take it all" onDone={() => setPrize(null)} />}
    </div>
  );
}

// How far along a campaign quest is: nothing for a one-off (it's done or it isn't); for the
// camp cages, a cage each, opened and crossed out as you go; for a few steps, a box each; for
// more, a bar and the count.
const PIPS_UP_TO = 6;
function QuestProgress({ id, goal, prog }: { id: string; goal: number; prog: number }) {
  if (goal <= 1) return null;
  if (id.startsWith("cages")) return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      {Array.from({ length: goal }, (_, k) => (
        <span key={k} className={`note-cage${k < prog ? " note-cage-done" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={k < prog ? "/sprites/walk/cage-open.png" : "/sprites/walk/cage.png"} alt={k < prog ? "Opened" : "Still shut"} width={28} height={28} draggable={false} />
        </span>
      ))}
    </div>
  );
  if (goal <= PIPS_UP_TO) return (
    <div style={{ display: "flex", gap: 5, marginTop: 5 }} aria-label={`${prog} of ${goal}`}>
      {Array.from({ length: goal }, (_, k) => <span key={k} className="note-pip" data-on={k < prog} />)}
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
      <span className="note-bar"><span style={{ width: `${(100 * prog) / goal}%` }} /></span>
      <span className="note-label" style={{ fontSize: 10, whiteSpace: "nowrap" }}>{prog.toLocaleString()}/{goal.toLocaleString()}</span>
    </div>
  );
}

// A campaign reward, as a picture with its amount: gold coins and how many, the XP scroll ×n,
// a crate (what's in it on top) or the barrel with the rarities it holds, the Gold Key, an
// enchanted piece, the schematic. small: the size that sits in a line of text (the Wanted poster).
// ready: its quest is done and it's yours to claim: the picture jiggles (the user, 2026-11-17).
const SHORT_RARITY: Record<string, string> = { common: "Com", uncommon: "Unc", rare: "Rare", epic: "Epic", legendary: "Leg" };
function rewardLook(r: CampaignReward) {
  const art = "gold" in r ? "/sprites/items/gold.png" : "scrolls" in r ? "/sprites/items/xp_scroll.png" : "goldKey" in r ? "/sprites/items/tools/gold_key.png"
    : "enchanted" in r ? (r.enchanted === "weapon" ? "/sprites/items/void_scythe.png" : "/sprites/items/armor/chest_dragonscale_tunic.png")
    : "bookcasePlans" in r ? "/sprites/items/schematic.png"
    : r.crate === "gear" ? "/sprites/walk/decor/barrels.png" : r.crate === "codex" ? "/sprites/props/bookcase3d/front.png" : "/sprites/den/crate.png";
  // On a crate, what's inside: a plank for materials, a potion for supplies.
  const inside = "crate" in r && r.crate === "materials" ? "/sprites/items/materials/planks.png" : "crate" in r && r.crate === "supplies" ? "/sprites/items/potion.png" : null;
  const tint = "gold" in r || "goldKey" in r ? "#FFCC4D" : "scrolls" in r ? "#4EA1FF" : "enchanted" in r ? RARITY_COLORS[r.rarity].text : "crate" in r ? RARITY_COLORS[r.hi].text : "#c9a46a";
  const label = "gold" in r ? r.gold.toLocaleString() : "scrolls" in r ? `×${r.scrolls}` : "crate" in r && r.crate !== "supplies" ? (r.lo === r.hi ? SHORT_RARITY[r.lo] : `${SHORT_RARITY[r.lo]}–${SHORT_RARITY[r.hi]}`)
    : "enchanted" in r ? SHORT_RARITY[r.rarity] : "";
  return { art, inside, tint, label, gold: "gold" in r };
}
const RewardBadge = ({ r, small, ready }: { r: CampaignReward; small?: boolean; ready?: boolean }) => <Badge {...rewardLook(r)} title={rewardText(r)} small={small} ready={ready} />;

// A daily quest's reward, as a picture (and how much gold).
const DAILY_ART: Record<DailyReward, string> = {
  gold: "/sprites/items/gold.png", box: "/sprites/props/klutz_box.png", creature: "/sprites/icons/ui_creatures.png",
  gear: "/sprites/items/void_scythe.png", epic: "/sprites/items/armor/chest_dragonscale_tunic.png", scroll: "/sprites/items/xp_scroll.png",
  material: "/sprites/items/materials/planks.png", elixir: "/sprites/items/tools/revival.png", codex: "/sprites/items/codex.png",
  cache: "/sprites/props/treasure_chest.png", merchant: "/sprites/den/merchant.png",
};
function dailyLook(q: DailyQuest) {
  const tint = q.reward === "gold" ? "#FFCC4D" : q.reward === "scroll" ? "#4EA1FF" : q.reward === "epic" ? RARITY_COLORS.epic.text : q.reward === "box" || q.reward === "gear" ? RARITY_COLORS.rare.text : "#c9a46a";
  return { art: DAILY_ART[q.reward], inside: null, tint, label: q.reward === "gold" ? (q.gold ?? 0).toLocaleString() : "", gold: q.reward === "gold" };
}

// A reward's picture on a note: the art in a glow of its colour, its amount under it.
function Badge({ art, inside, tint, label, gold, title, small, ready }: { art: string; inside: string | null; tint: string; label: string; gold: boolean; title: string; small?: boolean; ready?: boolean }) {
  const size = small ? 22 : 40;
  return (
    <span className="reward-badge" title={title} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, flex: "none", width: small ? 24 : 58 }}>
      <span style={{ position: "relative", width: small ? 24 : 52, height: small ? 24 : 44, display: "flex", alignItems: "center", justifyContent: "center", background: small ? undefined : `radial-gradient(circle, ${tint}55, transparent 68%)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" draggable={false} className={ready ? "reward-ready" : undefined} style={{ maxWidth: size + 6, maxHeight: size, imageRendering: "pixelated", filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.45))" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {inside && !small && <img src={inside} alt="" draggable={false} style={{ position: "absolute", right: 0, bottom: -2, width: 22, height: 22, imageRendering: "pixelated", filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.6))" }} />}
      </span>
      {!small && label && <span className="pixel-font" style={{ fontSize: label.length > 6 ? 10 : 13, lineHeight: 1, color: gold ? "#8a5a00" : "#5a3f1c", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>}
    </span>
  );
}

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
