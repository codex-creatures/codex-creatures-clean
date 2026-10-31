"use client";
// app/duel/page.tsx
// A live duel with a friend (docs/design.md §12; the rules in lib/pvp). The
// player who sent the invite comes here first and waits for an answer; the
// friend comes here on accepting it (components/DuelInbox.tsx). Then:
// 1. Each picks a team (PICK_SECONDS): only creatures, and gear, within the
//    format's rarity can be picked, and all fight at the format's level.
// 2. The lead room: both teams stand in a dungeon room, and each picks who
//    goes out first (LEAD_SECONDS).
// 3. The battle, on the usual battle screen: each round waits for both
//    players' moves (TURN_SECONDS, then a steady move is made for you).
// Nothing here changes your save: no XP, gold or injuries (the duel goes in
// your battle history only). Leaving loses.
//
// The address says which duel: ?m=<match>&f=<format>&vs=<their name>, plus
// &to=<their account> for the one who invited (the host).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import PixelSprite from "@/components/PixelSprite";
import {
  BattleView, DuelClock, Token, loadOwnedCreatures, rarityColor, usePlayableBattle, historyMembers, MUTED,
  type Match, type OwnedCreature,
} from "@/components/BattleScreen";
import { onlineClient } from "@/lib/online/client";
import { readAccount } from "@/lib/online/account";
import { cancelInvite, openDuelChannel, sendInvite, type DuelLink } from "@/lib/online/duelChannel";
import { Duel, type DuelMember, type DuelTeam, type DuelView } from "@/lib/pvp/duel";
import { ineligibleReason, isFormatId, PVP_FORMATS, TURN_SECONDS, type PvpFormat } from "@/lib/pvp/formats";
import { saveBattle } from "@/lib/battleHistory";
import { createChamber, CW } from "@/lib/dungeon/chamber";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { flipToFace } from "@/lib/sprites/art";

const GOLD = "#f1d9a0";
// While waiting for an answer, the invite goes again this often (in case it
// arrived before their game was listening).
const INVITE_AGAIN_MS = 15_000;
// sessionStorage (per tab, never in saves): the last duel this tab joined.
const SEEN_KEY = "codex_creatures_duel_seen";
// The duel joined since this page loaded (React may run the joining twice in development: that's not a reload).
let joinedHere: string | null = null;

type Params = { matchId: string; format: PvpFormat; vs: string; to: string | null };

function readParams(): Params | null {
  const p = new URLSearchParams(window.location.search);
  const m = p.get("m"), f = p.get("f");
  if (!m || !isFormatId(f)) return null;
  return { matchId: m, format: PVP_FORMATS[f], vs: (p.get("vs") ?? "").slice(0, 16) || "your friend", to: p.get("to") };
}

const memberOf = (c: OwnedCreature): DuelMember => ({
  rarity: c.rarity, label: c.label, creatureId: c.creatureId,
  ...(c.weaponName ? { weaponName: c.weaponName } : {}), ...(c.armorName ? { armorName: c.armorName } : {}),
});
const teamOf = (list: OwnedCreature[]): DuelTeam => ({ fighters: list.map((c) => c.fighter), info: list.map(memberOf) });

export default function DuelPage() {
  const router = useRouter();
  const [params, setParams] = useState<Params | null | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedCreature[]>([]);
  const [view, setView] = useState<DuelView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [picked, setPicked] = useState<string[]>([]);
  const [lead, setLead] = useState(0);
  const duel = useRef<Duel | null>(null);
  const pickedRef = useRef<string[]>([]);
  useEffect(() => { pickedRef.current = picked; }, [picked]);
  const battle = usePlayableBattle();
  const shown = useRef<unknown>(null); // the last battle state handed to the screen

  // Who's fit to fight in this format (in the order they're listed).
  const fit = useMemo(() => params ? owned.filter((c) => !ineligibleReason(c, params.format)) : [], [owned, params]);

  // Join the duel.
  useEffect(() => {
    const p = readParams();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is read after mount
    setParams(p);
    const client = onlineClient();
    if (!p || !client) { setProblem(!client ? "Duels are part of the online game." : "This duel's link is broken."); return; }
    // A duel lives only in the page: coming back to one (a reload) can't pick it
    // up again, so it counts as having left (the other player wins once you've gone).
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === p.matchId && joinedHere !== p.matchId;
      window.sessionStorage.setItem(SEEN_KEY, p.matchId);
    } catch {}
    joinedHere = p.matchId;
    if (seen) { setProblem("That duel is over: leaving it (or reloading) ends it."); return; }
    const list = loadOwnedCreatures(p.format.level);
    setOwned(list);
    const fitNow = list.filter((c) => !ineligibleReason(c, p.format));
    let link: DuelLink | null = null, live = true, again: number | undefined;
    const isHost = !!p.to;

    (async () => {
      const acc = await readAccount(client);
      if (!live) return;
      if (acc.status !== "in" || !acc.name) { setProblem("Sign in on the title screen to duel."); return; }
      if (fitNow.length < p.format.size) {
        setProblem(`You need ${p.format.size} creatures that fit ${p.format.name} (you have ${fitNow.length}).`);
        return;
      }
      const me = { id: acc.id, name: acc.name };
      const d = new Duel({
        role: isHost ? "host" : "guest", format: p.format,
        send: (m) => link?.send(m),
        // Time's up: whoever you'd picked, then the first fit ones listed.
        autoTeam: () => {
          const chosen = pickedRef.current.map((id) => fitNow.find((c) => c.id === id)).filter((c): c is OwnedCreature => !!c);
          const rest = fitNow.filter((c) => !chosen.includes(c));
          return teamOf([...chosen, ...rest].slice(0, p.format.size));
        },
        onChange: (v) => { if (live) setView(v); },
      });
      duel.current = d;
      setView(d.view);
      link = openDuelChannel(client, p.matchId, me.id, {
        onMessage: (m) => d.receive(m),
        onPeer: (present) => d.peer(present),
        onReady: () => {
          d.start();
          if (!isHost) return;
          const invite = () => sendInvite(client, p.to!, { matchId: p.matchId, from: me, format: p.format.id, sentAt: Date.now() });
          invite();
          again = window.setInterval(() => { if (d.view.phase === "waiting") invite(); else window.clearInterval(again); }, INVITE_AGAIN_MS);
        },
      });
    })();

    const clock = window.setInterval(() => { duel.current?.tick(); setNow(Date.now()); }, 250);
    return () => {
      live = false;
      window.clearInterval(clock);
      window.clearInterval(again);
      const d = duel.current;
      // Leaving: an unanswered invite is called off; a duel under way is lost.
      if (d && d.view.phase === "waiting" && isHost && p?.to) cancelInvite(client!, p.to, p.matchId);
      else if (d && d.view.phase !== "over" && d.view.phase !== "cancelled") d.forfeit();
      setTimeout(() => link?.close(), 500); // (time for the last word to go)
      duel.current = null;
    };
  }, []);

  // The battle: the first state starts the screen, each one after is played out on it.
  useEffect(() => {
    if (!view || !params) return;
    const state = view.phase === "battle" || view.phase === "over" ? view.state : undefined;
    const info = view.phase === "battle" || view.phase === "over" ? view.info : undefined;
    if (!state || !info || shown.current === state) return;
    shown.current = state;
    if (!battle.match) {
      const m: Match = { state, info, teams: { A: state.sides.A.team, B: state.sides.B.team }, level: "normal", opponent: params.vs, title: `Duel vs ${params.vs}` };
      battle.resume(m);
    } else battle.show(state);
    if (view.phase === "over" && view.reason === "battle" && state.winner) {
      const m: Match = { state, info, teams: { A: state.sides.A.team, B: state.sides.B.team }, level: "normal", opponent: params.vs };
      saveBattle({ id: crypto.randomUUID(), date: new Date().toISOString(), winner: state.winner, rounds: state.round, title: `Duel vs ${params.vs}`,
        teams: { A: historyMembers(m, "A"), B: historyMembers(m, "B") }, log: state.log });
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = (deadline: number) => (deadline - now) / 1000;
  const vs = params?.vs ?? "your friend";
  const d = duel.current;
  const inDuel = view && (view.phase === "pick" || view.phase === "lead" || view.phase === "battle");
  const leave = () => {
    if (inDuel && !window.confirm("Leave the duel? You'll lose it.")) return;
    router.push("/board");
  };
  const frame = (children: React.ReactNode, dock?: React.ReactNode, fill = true) => (
    <DenFrame title={params ? `Duel · ${params.format.name}` : "Duel"} icon="⚔️" onBack={leave} backLabel={inDuel ? "Leave" : "Board"} fill={fill} dock={dock}>{children}</DenFrame>
  );

  if (problem || params === null) return frame(<Note text={problem ?? "This duel's link is broken."} />, <BackDock onClick={() => router.push("/board")} />);
  if (!view || !params) return frame(<Note text="Joining…" />);

  // ── Waiting for the other player ──
  if (view.phase === "waiting") {
    return frame(
      <Note text={params.to ? `Waiting for ${vs} to answer…` : `Joining ${vs}'s duel…`} sub={<DuelClock seconds={left(view.deadline)} />} />,
      <BackDock label="Cancel" onClick={() => router.push("/board")} />,
    );
  }
  if (view.phase === "cancelled") {
    return frame(<Note text={view.reason === "They said no." ? `${vs} said no.` : view.reason} />, <BackDock onClick={() => router.push("/board")} />);
  }

  // ── 1. Picking a team ──
  if (view.phase === "pick") {
    const size = params.format.size;
    const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < size ? [...p, id] : p);
    return frame(
      <div className="stone-panel" style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 8, padding: "10px 10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pixel-font" style={{ flex: 1, fontSize: 16, color: GOLD }}>Pick {size} · {picked.length}/{size}</span>
          <DuelClock seconds={view.sent ? 0 : left(view.deadline)} />
          <Help title="Duels">
            <ul>
              <li>Pick {size} creatures before the time runs out (or the first that fit are picked for you).</li>
              <li><b>{params.format.name}:</b> creatures and the gear they wear can be {params.format.maxRarity} at most. Moves learned from codexes are fine.</li>
              <li>Every creature fights at <b>Lv {params.format.level}</b>, whatever its own level.</li>
              <li>Next, both teams are shown and you pick who goes out first.</li>
              <li>Each round you have {TURN_SECONDS} seconds to choose. No potions or battle bag: gear only.</li>
              <li>Nothing changes in your game: no XP, gold or injuries. Leaving loses.</li>
            </ul>
          </Help>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gap: 6, alignContent: "start" }}>
          {owned.map((c) => {
            const why = ineligibleReason(c, params.format);
            const slot = picked.indexOf(c.id);
            return (
              <button key={c.id} className="card-btn" disabled={!!why || view.sent} onClick={() => toggle(c.id)}
                style={{ opacity: why ? 0.45 : 1, borderColor: slot >= 0 ? "#4EA1FF" : undefined, background: slot >= 0 ? "rgba(78,161,255,0.12)" : undefined, minHeight: 56 }}>
                <span className="pixel-font" style={{ width: 24, height: 24, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: slot >= 0 ? "#4EA1FF" : "rgba(255,255,255,0.08)", color: slot >= 0 ? "black" : MUTED }}>
                  {slot >= 0 ? slot + 1 : ""}
                </span>
                <Token name={c.name} rarity={c.rarity} creatureId={c.creatureId} />
                <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block", fontWeight: 600, color: rarityColor(c.rarity), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.roster ? "★ " : ""}{c.name}</span>
                  <span style={{ display: "block", fontSize: 12, color: why ? "#ff8a80" : MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={why ?? c.fighter.skills.map((s) => s.name).join(" · ")}>
                    {why ?? c.fighter.skills.map((s) => s.name).join(" · ")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>,
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        {view.sent
          ? <span className="pixel-font" style={{ color: GOLD, fontSize: 15 }}>Waiting for {vs}…</span>
          : <button className="pixel-btn" disabled={picked.length !== size} style={{ fontSize: 18, padding: "10px 28px" }}
              onClick={() => d?.pickTeam(teamOf(picked.map((id) => fit.find((c) => c.id === id)!)))}>⚔️ Lock in</button>}
      </div>,
    );
  }

  // ── 2. The lead room ──
  if (view.phase === "lead") {
    const mine = view.mine;
    return frame(
      <LeadRoom mine={mine} theirs={view.theirs} vs={vs} lead={lead} onLead={view.sent ? undefined : setLead} />,
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
        {view.sent
          ? <span className="pixel-font" style={{ color: GOLD, fontSize: 15 }}>Waiting for {vs}…</span>
          : <button className="pixel-btn" style={{ fontSize: 17, padding: "10px 18px", maxWidth: "70%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              onClick={() => d?.chooseLead(lead)}>Send out {mine.fighters[lead]?.name}</button>}
        <DuelClock seconds={view.sent ? 0 : left(view.deadline)} />
      </div>,
    );
  }

  // ── 3. The battle (and its end) ──
  // Won or lost by someone leaving: said in words (there's no battle result to show).
  if (view.phase === "over" && view.reason !== "battle") {
    const text = view.result !== "win" ? "You left the duel." : view.reason === "forfeit" ? `${vs} left the duel. You win!` : `${vs} is gone. You win!`;
    return frame(<Note text={text} />, <BackDock onClick={() => router.push("/board")} />);
  }
  if (!battle.match) return frame(<Note text="The battle is starting…" />);
  return frame(
    <BattleView
        battle={{ ...battle, act: async (a) => d?.act(a), replace: (i) => d?.replace(i) }}
        waiting={view.phase === "battle" && view.sent}
        clock={view.phase === "battle" && !view.sent ? left(view.deadline) : undefined}
        finishedActions={<button className="pixel-btn" onClick={() => router.push("/board")}>Back to the board</button>}
    />,
  );
}

// ── Small pieces ──────────────────────────────────────────────────────
function Note({ text, sub }: { text: string; sub?: React.ReactNode }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 16 }}>
      <div className="pixel-font" style={{ color: GOLD, fontSize: 18, lineHeight: 1.4 }}>{text}</div>
      {sub}
    </div>
  );
}

function BackDock({ label = "Back to the board", onClick }: { label?: string; onClick: () => void }) {
  return <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}><button className="pixel-btn" onClick={onClick}>{label}</button></div>;
}

// Both teams standing in a dungeon room: theirs at the back, yours at the
// front. Tap one of yours to send it out first.
function LeadRoom({ mine, theirs, vs, lead, onLead }: { mine: DuelTeam; theirs: DuelTeam; vs: string; lead: number; onLead?: (i: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chamber = useMemo(() => createChamber({ tunnels: ["unknown"], seed: 11 }), []);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    const draw = () => ctx.putImageData(chamber.render((performance.now() - start) / 1000, 0, false), 0, 0);
    draw();
    const timer = window.setInterval(draw, 1000 / 10);
    return () => window.clearInterval(timer);
  }, [chamber]);

  const row = (team: DuelTeam, side: "A" | "B") => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${team.fighters.length}, 1fr)`, gap: 4, alignItems: "end" }}>
      {team.fighters.map((f, i) => {
        const id = team.info[i]?.creatureId;
        const sprite = id ? CREATURE_SPRITES[id] : undefined;
        const chosen = side === "A" && i === lead;
        const body = (
          <>
            <div style={{ height: side === "A" ? "16cqw" : "12cqw", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {sprite
                ? <PixelSprite sprite={sprite} scale={3} title={f.name} style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", ...(flipToFace(sprite, side === "A") ? { transform: "scaleX(-1)" } : {}) }} />
                : <Token name={f.name} rarity={team.info[i]?.rarity ?? "common"} creatureId={id} />}
            </div>
            <div style={{ fontSize: 11, color: rarityColor(team.info[i]?.rarity), textShadow: "0 1px 0 #000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={f.name}>{f.name}</div>
            <div className="pixel-font" style={{ fontSize: 11, color: chosen ? "#ffd66e" : "transparent" }}>▲ first</div>
          </>
        );
        return side === "A"
          ? <button key={i} onClick={onLead ? () => onLead(i) : undefined} disabled={!onLead} aria-label={`Send out ${f.name} first`}
              style={{ background: chosen ? "rgba(255,214,110,0.15)" : "rgba(0,0,0,0.25)", border: `2px solid ${chosen ? "#ffd66e" : "transparent"}`, padding: 2, minHeight: 44, cursor: onLead ? "pointer" : "default", minWidth: 0 }}>{body}</button>
          : <div key={i} style={{ padding: 2, minWidth: 0 }}>{body}</div>;
      })}
    </div>
  );

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "#0b0c10" }}>
      <canvas ref={canvasRef} width={CW} height={chamber.height} aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px 8px 12px" }}>
        <div>
          <div className="pixel-font" style={{ fontSize: 14, color: "#ff8a80", textShadow: "0 2px 0 #000", marginBottom: 4 }}>{vs}&apos;s team</div>
          {row(theirs, "B")}
        </div>
        <div>
          <div className="pixel-font" style={{ fontSize: 14, color: "#9cc8ff", textShadow: "0 2px 0 #000", marginBottom: 4 }}>Yours: who goes out first?</div>
          {row(mine, "A")}
        </div>
      </div>
    </div>
  );
}
