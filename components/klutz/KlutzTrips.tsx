"use client";
// components/klutz/KlutzTrips.tsx
// Klutz's Den, the Trips tab: his trips, newest first (lib/klutz.ts tripLog,
// the last TRIP_LOG). A row each: where, when, why he came home and what it
// came to. Tap one to open it: each fight and what it cost him, and what he
// brought home as small pictures (as his pack shows them). Simpler since
// 2026-11-24 (the user): what he wore, his %s and his moves are still recorded
// on the trip (kit), just not shown.

import { useState } from "react";
import { KLUTZ_DESTS, lookByName, tripLog, TRIP_LOG, type KlutzTrip } from "@/lib/klutz";
import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { RARITY_COLORS, rarityGlow } from "@/lib/items/gameHelpers";
import PixelSprite, { itemSprite } from "@/components/PixelSprite";
import { GOLD_SPRITE } from "@/lib/sprites/items";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { KlutzState } from "@/lib/klutz";
import DungeonHead from "@/components/DungeonHead";

const MUTED = "rgba(255,255,255,0.5)";
const GOLD = "#f1d9a0";

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
                  {t.dest !== undefined ? <><DungeonHead d={t.dest} size={22} /> {KLUTZ_DESTS[t.dest].name}</> : "🌀 The Labyrinth"}
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
  // What he brought home, counted by name (gold as one line).
  const finds = new Map<string, { find: KlutzTrip["finds"][number]; n: number }>();
  for (const f of t.finds) { const x = finds.get(f.name); finds.set(f.name, { find: f, n: (x?.n ?? 0) + (f.qty ?? 1) }); }
  const start = t.startHp ?? t.maxHp;
  return (
    <div style={{ padding: "0 12px 12px", fontSize: 13, borderTop: "1px solid #2a2d38" }}>
      <div style={{ marginTop: 8, color: "#c8c4b8" }}>❤️ {start} → <b style={{ color: t.hpEnd <= 0 ? "#ff8a80" : "#e8e2d0" }}>{t.hpEnd}</b> <span style={{ color: MUTED }}>of {t.maxHp}</span></div>

      <div className="pixel-font" style={head}>Fights ({t.fights.length})</div>
      {t.fights.length ? (
        <div style={{ display: "grid", gap: 2 }}>
          {t.fights.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
              <span style={{ color: f.won ? "#7CFC9A" : "#ff8a80", width: 16 }}>{f.won ? "✓" : "✗"}</span>
              <span style={{ color: RARITY_COLORS[f.rarity].text, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{CREATURE_BY_ID[f.creatureId]?.name ?? f.creatureId}</span>
              {/* What the fight cost him (older trips didn't keep it). */}
              <span style={{ color: f.hpLost ? "#ff8a80" : MUTED, fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right" }}>{f.hpLost !== undefined ? `−${f.hpLost} HP` : ""}</span>
              <span style={{ color: MUTED, minWidth: 52, textAlign: "right" }}>{f.won ? (f.caught ? "caught" : "beaten") : "beat him"}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ color: MUTED }}>None.</div>}
      {(t.caged !== undefined || t.letGo) && <div style={{ color: MUTED, marginTop: 4 }}>{t.caged ?? 0} went in the cage{t.letGo ? "; the cage was full, so he let the rest go" : ""}.</div>}

      <div className="pixel-font" style={head}>Brought home ({t.finds.length})</div>
      {finds.size ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 5 }}>
          {[...finds].map(([name, { find: f, n }]) => {
            const gold = name === "gold";
            // (A trip from before looks were kept: its look from its name.)
            const look = f.itemKey || f.armorKey || f.material || f.tool || f.potion || f.stone || f.codexMove || f.scroll || f.schematic ? f : { ...f, ...lookByName(name) };
            const sprite = gold ? GOLD_SPRITE : itemSprite(look as unknown as CreatureOrItemDrop);
            const col = gold ? "#f5c542" : RARITY_COLORS[f.rarity]?.border ?? "#3a3e4b";
            const glow = gold ? "rgba(245,197,66,0.35)" : rarityGlow(f.rarity);
            return (
              <div key={name} title={gold ? `${n} gold` : `${name}${n > 1 ? ` ×${n}` : ""}`}
                style={{ position: "relative", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${glow}, #101117 75%)`, border: `2px solid ${col}` }}>
                {/* Just its picture, lit in its rarity (the name's on hover); 🎁 for one with no art, as in his pack. */}
                {sprite ? <PixelSprite sprite={sprite} scale={1.4} /> : <span style={{ fontSize: 16 }}>🎁</span>}
                {n > 1 && <span className="pixel-font" style={{ position: "absolute", right: 2, bottom: 0, fontSize: 11, color: "#f1d9a0", textShadow: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000" }}>×{n}</span>}
              </div>
            );
          })}
        </div>
      ) : <div style={{ color: MUTED }}>Nothing.</div>}
    </div>
  );
}
