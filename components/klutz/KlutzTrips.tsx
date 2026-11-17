"use client";
// components/klutz/KlutzTrips.tsx
// Klutz's Den, the Trips tab: his trips, newest first (lib/klutz.ts tripLog,
// the last TRIP_LOG). A row each: where, when, why he came home and what it
// came to. Tap one to open it: what he set off with (level, HP, his %s, gear,
// soul stone, moves), every fight, and what he brought home.

import { useState } from "react";
import { KLUTZ_DESTS, tripLog, TRIP_LOG, type KlutzDest, type KlutzTrip } from "@/lib/klutz";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import { SOUL_STONES } from "@/lib/creatures/soulStones";
import type { KlutzState } from "@/lib/klutz";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";
const DEST_ICON: Record<KlutzDest, string> = { 0: "⛺", 1: "👁️", 2: "🐍", 3: "🕳️" };
const SHORT: Record<string, string> = { atk: "Mel", rng: "Rng", mag: "Mag", agil: "Agi", mdef: "MDef", rdef: "RDef", magdef: "MgDef" };

const why = (t: KlutzTrip) => (t.recalled ? "you called him back" : t.home === "pack" ? "his pack was full" : t.home === "hurt" ? "he was hurt"
  : t.home === "ko" ? "something beat him" : t.home === "limit" ? "he'd been out long enough" : "the hunt was over");
function when(ms: number, now = Date.now()) {
  const d = new Date(ms), today = new Date(now);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? `Today ${time}` : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}
const length = (t: KlutzTrip) => { const m = Math.max(1, Math.round((t.endsAt - t.startedAt) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

export default function KlutzTrips({ klutz }: { klutz: KlutzState }) {
  const trips = tripLog(klutz);
  const [open, setOpen] = useState<number | null>(0);
  if (trips.length === 0) {
    return <div className="stone-panel" style={{ marginTop: 10, color: MUTED, fontSize: 14 }}>No trips yet. Send him off from the Hunt tab, and each one is kept here.</div>;
  }
  return (
    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
      {trips.map((t, i) => {
        const won = t.fights.filter((f) => f.won).length, caught = t.fights.filter((f) => f.caught).length;
        const shut = open !== i;
        return (
          <div key={t.startedAt} className="stone-panel" style={{ padding: 0 }}>
            <button onClick={() => setOpen(shut ? i : null)} aria-expanded={!shut}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", color: "inherit", font: "inherit", cursor: "pointer", minHeight: 52 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className="pixel-font" style={{ flex: 1, minWidth: 0, fontSize: 15, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.dest !== undefined ? `${DEST_ICON[t.dest]} ${KLUTZ_DESTS[t.dest].name}` : "🌀 The Labyrinth"}
                </span>
                <span style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap" }}>{when(t.startedAt)} · {length(t)}</span>
                <span style={{ color: MUTED, fontSize: 12 }}>{shut ? "▸" : "▾"}</span>
              </div>
              <div style={{ fontSize: 12, color: "#c8c4b8", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {won}/{t.fights.length} won · {caught} caught · {t.finds.length} found · <span style={{ color: "#7CFC9A" }}>+{t.xp} XP</span> · {why(t)}
              </div>
            </button>
            {!shut && <TripDetail t={t} />}
          </div>
        );
      })}
      <p style={{ fontSize: 12, color: MUTED, margin: "2px 4px" }}>His last {TRIP_LOG} trips are kept.</p>
    </div>
  );
}

function TripDetail({ t }: { t: KlutzTrip }) {
  const head: React.CSSProperties = { fontSize: 12, color: GOLD, margin: "8px 0 4px", fontFamily: "inherit" };
  const k = t.kit;
  const stone = k?.soulStone ? SOUL_STONES[k.soulStone] : undefined;
  // What he brought home, counted by name.
  const finds = new Map<string, { rarity: KlutzTrip["finds"][number]["rarity"]; n: number }>();
  for (const f of t.finds) { const x = finds.get(f.name); finds.set(f.name, { rarity: f.rarity, n: (x?.n ?? 0) + (f.qty ?? 1) }); }
  return (
    <div style={{ padding: "0 12px 12px", fontSize: 13, borderTop: "1px solid #2a2d38" }}>
      <div className="pixel-font" style={head}>He set off with</div>
      {k ? (
        <div style={{ display: "grid", gap: 3 }}>
          <div>Lv {k.level} · ❤️ {t.startHp ?? k.maxHp}/{k.maxHp} <span style={{ color: MUTED }}>(home on {t.hpEnd})</span></div>
          <div style={{ color: "#c8c4b8" }}>{Object.entries(k.proficiency).filter(([, v]) => v).map(([key, v]) => `${SHORT[key] ?? key} +${v}%`).join(" · ") || "No % points spent"}</div>
          <div>{k.gear.length ? k.gear.map((g) => <span key={g.name} style={{ color: RARITY_COLORS[g.rarity].text, marginRight: 8 }}>{g.name}</span>) : <span style={{ color: MUTED }}>No gear</span>}</div>
          <div style={{ color: "#c8c4b8" }}>{stone ? <span style={{ color: "#b9e6ff" }}>{stone.icon} {stone.name} · </span> : null}{k.moves.join(" · ")}</div>
        </div>
      ) : <div style={{ color: MUTED }}>Not recorded: this trip was before his trips were kept. ❤️ home on {t.hpEnd}/{t.maxHp}.</div>}

      <div className="pixel-font" style={head}>Fights ({t.fights.length})</div>
      {t.fights.length ? (
        <div style={{ display: "grid", gap: 2 }}>
          {t.fights.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <span style={{ color: f.won ? "#7CFC9A" : "#ff8a80", width: 16 }}>{f.won ? "✓" : "✗"}</span>
              <span style={{ color: RARITY_COLORS[f.rarity].text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{CREATURE_BY_ID[f.creatureId]?.name ?? f.creatureId}</span>
              <span style={{ color: MUTED }}>{f.won ? (f.caught ? "caught" : "beaten") : "beat him"}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ color: MUTED }}>None.</div>}
      {(t.caged !== undefined || t.letGo) && <div style={{ color: MUTED, marginTop: 4 }}>{t.caged ?? 0} went in the cage{t.letGo ? "; the cage was full, so he let the rest go" : ""}.</div>}

      <div className="pixel-font" style={head}>Brought home ({t.finds.length})</div>
      {finds.size ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
          {[...finds].map(([name, f]) => <span key={name} style={{ color: name === "gold" ? "#f5c542" : RARITY_COLORS[f.rarity].text }}>{name === "gold" ? `${f.n} gold` : `${name}${f.n > 1 ? ` ×${f.n}` : ""}`}</span>)}
        </div>
      ) : <div style={{ color: MUTED }}>Nothing.</div>}
    </div>
  );
}
