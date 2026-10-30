// components/RaceChart.tsx
// The race chart: which move races land well on which creature races. In the
// Bestiary, and behind a button in Labyrinth fights (components/BattleScreen.tsx).

import { RACES, RACE_INFO } from "@/lib/creatures/creatureData";
import { raceVs } from "@/lib/combat/raceChart";
import { RaceIcon } from "./Glyph";

const MUTED = "rgba(255,255,255,0.5)";

export default function RaceChart() {
  // Rows: the move's race; columns: the target's race. ▲ effective, ▼ resisted.
  const cell = (m: number) => (m > 1 ? { t: "▲", c: "#7fdc7f" } : m < 1 ? { t: "▼", c: "#ff8a80" } : { t: "·", c: MUTED });
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, margin: "0 auto" }}>
        <thead>
          <tr>
            <th style={{ padding: 4, color: MUTED, textAlign: "left", fontWeight: 400 }}>move ↓ · target →</th>
            {RACES.map((r) => <th key={r} title={RACE_INFO[r].name} style={{ padding: 4, fontSize: 16 }}><RaceIcon r={r} /></th>)}
          </tr>
        </thead>
        <tbody>
          {RACES.map((a) => (
            <tr key={a} style={{ borderTop: "1px solid #2a2d38" }}>
              <th style={{ padding: 4, textAlign: "left", color: RACE_INFO[a].color, whiteSpace: "nowrap" }}><RaceIcon r={a} /> {RACE_INFO[a].name}</th>
              {RACES.map((d) => {
                const v = cell(raceVs(a, d));
                return <td key={d} style={{ padding: 4, textAlign: "center", color: v.c, fontSize: 14 }}>{v.t}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: MUTED, textAlign: "center", marginTop: 4 }}>▲ effective · ▼ resisted · Neutral moves have no race</div>
    </div>
  );
}
