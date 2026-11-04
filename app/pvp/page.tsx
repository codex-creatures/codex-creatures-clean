"use client";
// app/pvp/page.tsx
// The PvP portal, in the tavern's room (the user, 2026-11-04; it appears once
// the rubble's blown open). Three tabs in the dock:
// - Friends: challenge a friend who's on to a duel (components/FriendList.tsx, app/duel).
// - Teams: build and save PvP line-ups (lib/pvp/teams.ts), loaded when you pick
//   your team in a duel. A creature training in the pit is greyed out.
// - Ranked: the ladder with Elo ratings, still to come.
// Fixed frame: the panel's header and footer keep their place, the list scrolls inside.

import { useEffect, useState } from "react";
import DenFrame from "@/components/DenFrame";
import Help from "@/components/Help";
import CreaturePortrait from "@/components/CreaturePortrait";
import { RaceNames } from "@/components/RaceTag";
import FriendList, { useFriends } from "@/components/FriendList";
import { loadOwnedCreatures, rarityColor, type OwnedCreature } from "@/components/BattleScreen";
import { useGameState } from "@/hooks/useGameState";
import { onlineConfig } from "@/lib/online/client";
import { PVP_TEAM_MAX, PVP_TEAM_SLOTS, teamRarity } from "@/lib/pvp/teams";
import { BRING_EXTRA } from "@/lib/pvp/formats";

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

// The ranked ladder: planned (docs/design.md §12), not built yet.
function Ranked() {
  return (
    <>
      <Head title="🏆 Ranked ladder">
        <Help title="Ranked">
          <ul>
            <li>Coming soon: duel players near your rating and climb the ladder. Win to gain rating (Elo), lose to drop.</li>
          </ul>
        </Help>
      </Head>
      <div style={SCROLL}>
        <p style={NOTE}>🔒 Coming soon.</p>
      </div>
    </>
  );
}
