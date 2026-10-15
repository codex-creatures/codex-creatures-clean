"use client";
// components/RecentBattles.tsx — your last few battles, with full logs.

import { useEffect, useState } from "react";
import { loadBattles, type BattleRecord, type BattleMember } from "@/lib/battleHistory";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import BattleLog, { YOU, FOE } from "./BattleLog";

const MUTED = "rgba(255,255,255,0.5)";

export default function RecentBattles() {
  const [battles, setBattles] = useState<BattleRecord[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
  useEffect(() => setBattles(loadBattles()), []);

  if (battles.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <h2 className="pixel-font" style={{ margin: "0 0 8px", fontWeight: 600, color: "#f1d9a0" }}>Recent battles</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {battles.map((b) => (
          <div key={b.id}>
            <button className="card-btn" onClick={() => setOpen(open === b.id ? null : b.id)}>
              <span className="pixel-font" style={{ width: 70, flexShrink: 0, fontSize: 15, color: b.winner === "A" ? "#5ee08a" : b.winner === "B" ? FOE : "white" }}>
                {b.winner === "A" ? "Victory" : b.winner === "B" ? "Defeat" : "Draw"}
              </span>
              <span style={{ minWidth: 0, flex: 1, fontSize: 13 }}>
                <span style={{ color: YOU }}>{b.teams.A.map((m) => m.name).join(", ")}</span>
                <span style={{ color: MUTED }}> vs </span>
                <span style={{ color: FOE }}>{b.teams.B.map((m) => m.name).join(", ")}</span>
                <span style={{ display: "block", fontSize: 11, color: MUTED }}>
                  {b.rounds} rounds · {new Date(b.date).toLocaleString()}
                </span>
              </span>
              <span style={{ color: MUTED }}>{open === b.id ? "▲" : "▼"}</span>
            </button>
            {open === b.id && (
              <div className="stone-panel" style={{ marginTop: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 12 }}>
                  <Team title="Your team" color={YOU} members={b.teams.A} />
                  <Team title="Their team" color={FOE} members={b.teams.B} />
                </div>
                <BattleLog log={b.log} maxHeight={320} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Team({ title, color, members }: { title: string; color: string; members: BattleMember[] }) {
  return (
    <div>
      <div className="pixel-font" style={{ fontSize: 14, color, marginBottom: 4 }}>{title}</div>
      {members.map((m, i) => (
        <div key={i} style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.4 }}>
          <b style={{ color: RARITY_COLORS[m.rarity].text }}>{m.name}</b> <span style={{ color: MUTED }}>· {m.label}</span>
          <div style={{ color: MUTED }}>{m.weapon ?? "no weapon"} · {m.armor ?? "no armour"}</div>
          <div style={{ color: "#c9b48a" }}>{m.moves.join(" · ")}</div>
          <div style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
            HP {m.stats.hp} · Atk {m.stats.atk} · Rng {m.stats.rng} · Mag {m.stats.mag ?? 0} · Agi {m.stats.agil} · MDef {m.stats.mdef} · RDef {m.stats.rdef} · MgDef {m.stats.magdef ?? 0}
          </div>
        </div>
      ))}
    </div>
  );
}
