"use client";
// app/pvp/page.tsx
// The PvP portal, in the tavern's room (the user, 2026-11-04; it appears once
// the rubble's blown open). Three tabs in the dock:
// - Friends: challenge a friend who's on to a duel (components/FriendList.tsx, app/duel).
// - Teams: build and save PvP line-ups (lib/pvp/teams.ts), loaded when you pick
//   your team in a duel. A creature training in the pit is greyed out.
// - Ranked (the user, 2026-11-24): two queues (3v3 Rare at Lv 15, 5v5 Legendary at Lv 25; lib/pvp/ranked.ts)
//   against the simulated rivals (lib/pvp/rivals.ts), matched by rating (lib/pvp/elo.ts), with the ladder
//   of players and rivals (lib/online/ranked.ts). Opening the portal signed in also starts the rivals'
//   daily round if nobody has run today's (lib/pvp/dailyRound.ts; it carries on in the background).
// Fixed frame: the panel's header and footer keep their place, the list scrolls inside.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import CreaturePortrait from "@/components/CreaturePortrait";
import { RaceNames } from "@/components/RaceTag";
import FriendList, { useFriends } from "@/components/FriendList";
import { loadOwnedCreatures, rarityColor, type OwnedCreature } from "@/components/BattleScreen";
import { gearMarks } from "@/components/CreatureMarks";
import { useGameState } from "@/hooks/useGameState";
import { onlineClient, onlineConfig } from "@/lib/online/client";
import { readAccount } from "@/lib/online/account";
import { fetchLadder, type Ladder } from "@/lib/online/ranked";
import { PVP_TEAM_MAX, PVP_TEAM_SLOTS, teamRarity } from "@/lib/pvp/teams";
import { BRING_EXTRA, eligibleCount, type PvpFormat } from "@/lib/pvp/formats";
import { QUEUE_SECONDS, RANKED_FORMATS, RANKED_QUEUES, type RankedQueue } from "@/lib/pvp/ranked";
import { ELO_START, pickRival, ratingChange } from "@/lib/pvp/elo";
import { AI_SUFFIX, RIVALS, rivalById, rivalName } from "@/lib/pvp/rivals";
import { startDailyRound, watchRound, type RoundPlayer, type RoundState } from "@/lib/pvp/dailyRound";
import type { RoundOut } from "@/lib/pvp/roundWorker";

// sessionStorage (per tab, never in saves): the rival you fought last, so the next match is someone else.
const LAST_RIVAL_KEY = "codex_creatures_ranked_last";

// The rivals' daily round, played in a worker so the game doesn't stall (lib/pvp/roundWorker.ts).
const playInWorker: RoundPlayer = (day, ids, onBattle) => new Promise((resolve, reject) => {
  try {
    const w = new Worker(new URL("../../lib/pvp/roundWorker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<RoundOut>) => {
      if ("done" in e.data) onBattle(e.data.done);
      else { resolve(e.data.results); w.terminate(); }
    };
    w.onerror = (e) => { reject(e); w.terminate(); };
    w.postMessage({ day, ids });
  } catch (e) { reject(e); }
});
// (Without workers, the battles play here, one a breath.)
const roundPlayer: RoundPlayer | undefined = typeof Worker === "undefined" ? undefined : playInWorker;

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
type Tab = "friends" | "teams" | "ranked";
const TABS: { id: Tab; icon: string; name: string }[] = [
  { id: "friends", icon: "⚔️", name: "Duel a friend" },
  { id: "teams", icon: "🛡️", name: "Teams" },
  { id: "ranked", icon: "🏆", name: "Ranked" },
];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function PvpPortalPage() {
  const [tab, setTab] = useState<Tab>("friends");
  // Opening the portal signed in starts the rivals' daily round if today's hasn't been run (it goes on in the background).
  useEffect(() => {
    const client = onlineClient();
    if (!client) return;
    let live = true;
    readAccount(client).then((acc) => { if (live && acc.status === "in") void startDailyRound(client, new Date(), roundPlayer); });
    return () => { live = false; };
  }, []);
  const dock = (
    <div className="dock-tabs">
      {TABS.map((t) => (
        <button key={t.id} className="dock-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}
          style={{ flexDirection: "column", gap: 0, fontSize: 12, lineHeight: 1.2 }}>
          <span>{t.icon}</span><span>{t.name}</span>
        </button>
      ))}
    </div>
  );
  return (
    <DenFrame title="PvP Portal" icon="🌀" fill dock={dock}>
      <div className="stone-panel" style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10, padding: "12px 12px 14px" }}>
        {tab === "friends" ? <Friends /> : tab === "teams" ? <Teams /> : <Ranked />}
      </div>
    </DenFrame>
  );
}

// The panel's top line: a title, and its "?".
function Head({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
      <span className="pixel-font" style={{ flex: 1, minWidth: 0, fontSize: 17, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
      {children}
    </div>
  );
}
const SCROLL: React.CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", borderRadius: 8, background: "rgba(0,0,0,0.25)", padding: "4px 8px" };
const NOTE: React.CSSProperties = { color: MUTED, fontSize: 14, textAlign: "center", marginTop: 24, lineHeight: 1.5 };

function Friends() {
  const { checked, me, friends, online, remove } = useFriends();
  return (
    <>
      <Head title="⚔️ Duel a friend">
        <Help title="Duels">
          <ul>
            <li>Challenge a friend who&apos;s on (🟢). You pick the size, rarity and level; they get the invite wherever they are in the game.</li>
            <li>Add friends with <b>➕</b> next to a player on the quest board&apos;s leaderboards.</li>
            <li>Duels change nothing in your game: no XP, gold or injuries.</li>
            <li>Save line-ups in <b>Teams</b> to bring them quickly.</li>
          </ul>
        </Help>
      </Head>
      <div style={SCROLL}>
        {!onlineConfig.ok ? <p style={NOTE}>Duels are part of the online game.</p>
          : !checked ? <p style={NOTE}>Loading…</p>
          : !me ? <p style={NOTE}>Sign in on the title screen to duel.</p>
          : <FriendList friends={friends} online={online} onRemove={remove} />}
      </div>
    </>
  );
}

// Your PvP teams: pick a slot, then tap creatures to add or take them out (in
// order: the first ones are brought first). Saved straight away.
function Teams() {
  const game = useGameState();
  const [slot, setSlot] = useState(0);
  // Every creature, the one in the pit too (greyed: it can't be added while it trains).
  const [all, setAll] = useState<OwnedCreature[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read from the save once it's loaded
  useEffect(() => { if (game.hydrated) setAll(loadOwnedCreatures(undefined, true, true)); }, [game.hydrated, game.inventory, game.equipment, game.tavern]);
  const byId = new Map(all.map((c) => [c.id, c]));
  const team = (game.pvpTeams[slot] ?? []).filter((id) => byId.has(id)); // (released ones drop out)
  const rarest = teamRarity(team.map((id) => byId.get(id)));
  return (
    <>
      <Head title={`🛡️ Team ${slot + 1} · ${team.length}/${PVP_TEAM_MAX}`}>
        <Help title="PvP teams">
          <ul>
            <li>Save up to {PVP_TEAM_SLOTS} line-ups for duels. Tap creatures to add or take them out; the first ones are brought first.</li>
            <li>A team holds {PVP_TEAM_MAX}: a 5v5 and {BRING_EXTRA} more. In a duel, tap a team to bring the ones that fit its rarity.</li>
            <li><b>Rarest</b>: the rarest creature or gear in the team. A duel for less leaves those out.</li>
            <li>A creature training in the pit can&apos;t be added (🏋️).</li>
            <li>PvP teams are separate from your Labyrinth teams.</li>
          </ul>
        </Help>
      </Head>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${PVP_TEAM_SLOTS}, 1fr)`, gap: 6 }}>
        {Array.from({ length: PVP_TEAM_SLOTS }, (_, i) => (
          <button key={i} className="chip" data-active={slot === i} onClick={() => setSlot(i)}
            style={{ minHeight: 44, padding: "2px 4px", justifyContent: "center", textTransform: "none", whiteSpace: "nowrap" }}>
            Team {i + 1} · {(game.pvpTeams[i] ?? []).filter((id) => byId.has(id)).length}
          </button>
        ))}
      </div>
      <div className="pixel-font" style={{ fontSize: 13, color: MUTED, minHeight: 18 }}>
        Rarest: <span style={{ color: rarest ? rarityColor(rarest) : MUTED }}>{rarest ? cap(rarest) : "-"}</span>
      </div>
      <div style={SCROLL}>
        {!game.hydrated ? <p style={NOTE}>Loading…</p>
          : all.length === 0 ? <p style={NOTE}>No creatures yet.</p>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10, padding: "6px 0" }}>
              {all.map((c) => {
                const at = team.indexOf(c.id);
                const picked = at >= 0;
                const full = team.length >= PVP_TEAM_MAX;
                // The pit's creature can leave a team, but not join one.
                const locked = (!!c.away || full) && !picked;
                return (
                  <button key={c.id} onClick={() => game.togglePvp(slot, c.id)} disabled={locked} aria-pressed={picked}
                    title={c.away ? `${c.name} is training in the pit` : picked ? `Take ${c.name} out of Team ${slot + 1}` : full ? `Team ${slot + 1} is full` : `Add ${c.name} to Team ${slot + 1}`}
                    style={{
                      position: "relative", minWidth: 0, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                      background: picked ? "rgba(241,217,160,0.1)" : "none", border: "none", borderRadius: 8,
                      boxShadow: picked ? `inset 0 0 0 2px ${c.away ? "#6b6350" : GOLD}` : undefined,
                      color: "white", cursor: locked ? "default" : "pointer", opacity: c.away ? 0.35 : 1,
                    }}>
                    <span className="pixel-font" style={{ maxWidth: "100%", fontSize: 12, color: rarityColor(c.rarity), textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", lineHeight: 1.15 }}>
                      <span style={{ color: GOLD }}>Lv {c.fighter.level ?? 1}</span> {c.name}
                    </span>
                    <CreaturePortrait creatureId={c.creatureId} title={c.name} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))" }} />
                    <span className="pixel-font" style={{ fontSize: 11 }}>{c.away ? "🏋️ In the pit" : <RaceNames races={c.template.races} />}</span>
                    {gearMarks(game.equipment[c.id]) && <span title="Wearing gear" style={{ position: "absolute", top: 20, right: 4, fontSize: 11 }}>{gearMarks(game.equipment[c.id])}</span>}
                    {picked && (
                      <span className="pixel-font" style={{ position: "absolute", top: 20, left: 4, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, borderRadius: 10, background: c.away ? "#6b6350" : GOLD, color: "#1a140c" }}>
                        {at + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
      </div>
    </>
  );
}

// The ranked ladder (docs/design/online.md §12): your rating, the two queues, and the ladder of players and
// rivals. Queue: a rival near your rating is chosen (pickRival), a short "searching" beat, then the duel
// screen with the rival as the other player (app/duel?rival=…).
type RankedView = { status: "loading" } | { status: "off" } | { status: "out" } | { status: "down" } | { status: "ok"; ladder: Ladder };
function Ranked() {
  const router = useRouter();
  const game = useGameState();
  const [view, setView] = useState<RankedView>({ status: onlineConfig.ok ? "loading" : "off" });
  const [queued, setQueued] = useState<RankedQueue | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // Who you could bring to each queue (creatures and gear within its rarity).
  const [fit, setFit] = useState<Record<RankedQueue, number>>({ "3v3": 0, "5v5": 0 });
  useEffect(() => {
    if (!game.hydrated) return;
    const owned = loadOwnedCreatures(undefined, true, false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read from the save once it's loaded
    setFit(Object.fromEntries(RANKED_QUEUES.map((q) => [q, eligibleCount(owned, RANKED_FORMATS[q])])) as Record<RankedQueue, number>);
  }, [game.hydrated, game.inventory, game.equipment, game.tavern]);
  useEffect(() => {
    const client = onlineClient();
    if (!client) return;
    let live = true;
    (async () => {
      const acc = await readAccount(client);
      if (!live) return;
      if (acc.status !== "in") { setView({ status: "out" }); return; }
      const ladder = await fetchLadder(client);
      if (live) setView(ladder ? { status: "ok", ladder } : { status: "down" });
    })();
    const stop = watchRound((s) => { if (live) setRound(s); });
    return () => { live = false; stop(); window.clearTimeout(timer.current); };
  }, []);

  const ladder = view.status === "ok" ? view.ladder : null;
  const myRating = ladder?.me?.rating ?? ELO_START;
  // The rivals as the ladder has them (a rival the ladder doesn't know yet starts at ELO_START).
  const rivals = RIVALS.map((r) => ({ id: r.id, rating: ladder?.rivals.find((x) => x.id === r.id)?.rating ?? ELO_START }));
  const queue = (q: RankedQueue) => {
    if (queued || !ladder) return;
    let last: string | undefined;
    try { last = window.sessionStorage.getItem(LAST_RIVAL_KEY) ?? undefined; } catch {}
    const rival = pickRival(rivals, myRating, last);
    if (!rival) return;
    try { window.sessionStorage.setItem(LAST_RIVAL_KEY, rival.id); } catch {}
    setQueued(q);
    timer.current = window.setTimeout(() => router.push(`/duel?m=ranked-${crypto.randomUUID()}&f=${RANKED_FORMATS[q].id}&rival=${rival.id}`), QUEUE_SECONDS * 1000);
  };
  const roundLine = !round ? "" : round.status === "playing" ? `Today's rival round: battle ${round.played} of ${round.of}…`
    : round.status === "posted" ? "Today's rival round: played here and posted." : round.status === "taken" ? "Today's rival round: already played." : "Today's rival round couldn't be posted.";

  return (
    <>
      <Head title={`🏆 Ranked · ${ladder ? myRating : "-"}`}>
        <Help title="Ranked">
          <ul>
            <li>Queue for a match and you&apos;re paired with a player near your <b>rating</b>. Win and it rises; lose and it drops (Elo: everyone starts at {ELO_START}).</li>
            <li>For now the other players are the game&apos;s own: seven <b>rivals</b> marked <b>{AI_SUFFIX.trim()}</b>, each played through the game by the computer, with creatures, gear and moves of their own. They fight with the hard AI.</li>
            <li><b>3v3:</b> Rare the rarest creature or gear, everyone at Lv 15. <b>5v5:</b> up to Legendary, everyone at Lv 25. Bring the size and {BRING_EXTRA} more, then pick who fights.</li>
            <li>A ranked match changes nothing in your game but your rating: no XP, gold or injuries. Leaving loses.</li>
            <li>The rivals fight each other once a day too, so their ratings move. Whoever opens the portal first runs those battles in the background.</li>
            <li>Each match is kept, with its moves, to teach a better AI later.</li>
          </ul>
        </Help>
      </Head>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${RANKED_QUEUES.length}, 1fr)`, gap: 6 }}>
        {RANKED_QUEUES.map((q) => {
          const f: PvpFormat = RANKED_FORMATS[q];
          const can = !!ladder && fit[q] >= f.size && !queued;
          return (
            <button key={q} className="pixel-btn" disabled={!can} onClick={() => queue(q)}
              title={fit[q] < f.size ? `You need ${f.size} creatures that fit ${f.name} (you have ${fit[q]})` : `Queue for ${f.name}`}
              style={{ minHeight: 56, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 15, lineHeight: 1.2, opacity: can || queued === q ? 1 : 0.5 }}>
              <span>{queued === q ? "Searching…" : `⚔️ Queue ${q}`}</span>
              <span className="pixel-font" style={{ fontSize: 11, color: MUTED, textTransform: "none" }}>{f.name.replace(`${q} · `, "")} · {fit[q]} fit</span>
            </button>
          );
        })}
      </div>
      <div className="pixel-font" style={{ fontSize: 12, color: MUTED, minHeight: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roundLine}</div>
      <div style={SCROLL}>
        {view.status === "off" ? <p style={NOTE}>Ranked is part of the online game.</p>
          : view.status === "loading" ? <p style={NOTE}>Loading…</p>
          : view.status === "out" ? <p style={NOTE}>Sign in on the title screen to play ranked.</p>
          : view.status === "down" ? <p style={NOTE}>The ladder couldn&apos;t be reached.</p>
          : view.ladder.top.length === 0 ? <p style={NOTE}>Nobody on the ladder yet.</p>
          : (
            <ol style={{ listStyle: "none", margin: 0, padding: "4px 0", display: "grid", gap: 2 }}>
              {view.ladder.top.map((row) => {
                const r = row.ai ? rivalById(row.id.replace(/^rival:/, "")) : undefined;
                const worth = row.ai ? ratingChange(myRating, row.rating, "win") : null;
                return (
                  <li key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 36, padding: "2px 6px", borderRadius: 6, background: row.me ? "rgba(241,217,160,0.12)" : "transparent" }}>
                    <span className="pixel-font" style={{ width: 28, textAlign: "right", color: GOLD, fontSize: 13 }}>{row.rank}</span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: row.me ? GOLD : row.ai ? "#9cc8ff" : "white", fontSize: 14 }}>
                      {r ? rivalName(r) : row.name}{row.me ? " (you)" : ""}
                    </span>
                    <span className="pixel-font" style={{ fontSize: 12, color: MUTED, minWidth: 40, textAlign: "right" }} title={worth !== null ? `A win over them is worth ${worth}` : undefined}>{row.games} 🗡️</span>
                    <span className="pixel-font" style={{ fontSize: 14, color: GOLD, minWidth: 44, textAlign: "right" }}>{row.rating}</span>
                  </li>
                );
              })}
            </ol>
          )}
      </div>
    </>
  );
}
