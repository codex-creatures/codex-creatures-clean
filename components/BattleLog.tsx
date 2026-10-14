"use client";
// components/BattleLog.tsx — a battle's events, round by round, newest first.

import { useMemo } from "react";
import type { BattleEvent, SideKey } from "@/lib/combat/battle";

export const YOU = "#4EA1FF";
export const FOE = "#ff6b6b";
const MUTED = "rgba(255,255,255,0.45)";

export default function BattleLog({ log, maxHeight = 360 }: { log: BattleEvent[]; maxHeight?: number }) {
  const rounds = useMemo(() => {
    const out: { round: number; events: BattleEvent[] }[] = [];
    for (const e of log) {
      if (e.type === "round") out.push({ round: e.round, events: [] });
      else if (out.length > 0) out[out.length - 1].events.push(e);
    }
    return out.reverse();
  }, [log]);

  if (rounds.length === 0) return <p style={{ fontSize: 13, color: MUTED }}>Nothing yet — pick your first move.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight, overflowY: "auto" }}>
      {rounds.map(({ round, events }) => (
        <div key={round} style={{ fontSize: 13, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderLeft: "3px solid #3a3e4b" }}>
          <div className="pixel-font" style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Round {round}</div>
          {events.map((e, i) => <LogLine key={i} e={e} />)}
        </div>
      ))}
    </div>
  );
}

// "Your X" / "Their X" — both teams can field the same creature.
function Who({ side, name, plain }: { side: SideKey; name: string; plain?: boolean }) {
  return <>{plain ? "" : side === "A" ? "Your " : "Their "}<b style={{ color: side === "A" ? YOU : FOE }}>{name}</b></>;
}

function LogLine({ e }: { e: BattleEvent }) {
  switch (e.type) {
    case "swap":
      return <div>⇄ <Who side={e.side} name={e.from} /> swaps out for <Who side={e.side} name={e.to} plain /> <span style={{ color: MUTED }}>(+{e.energyRestored}⚡)</span></div>;
    case "attack":
      return (
        <div>
          <Who side={e.side} name={e.attacker} /> uses {e.skill.name}{" "}
          {e.missed ? <span style={{ color: MUTED }}>→ {e.evaded ? "it shimmers away (mirage)!" : e.armorFx?.includes("turns it aside") ? "deflected!" : "misses!"}</span> : <>→ <b>{e.damage}</b> dmg</>}
          {e.armorFx && <span style={{ color: "#f1d9a0" }}> · 🛡️ {e.armorFx}</span>}
          {e.pounced && <span style={{ color: "#d89a5b" }}> · pounces on the wounded!</span>}
          {e.venom && <span style={{ color: "#9be15d" }}> · envenomed!</span>}
          {e.precise && <span style={{ color: e.defenceIgnored > 0.25 ? "#ff9f43" : "#f5c542" }}> · precise hit{e.defenceIgnored > 0.25 ? ` (armour gap: ignores ${Math.round(e.defenceIgnored * 100)}% defence)` : ""}!</span>}
          {e.hasted && <span style={{ color: "#7fe0ff" }}> · hasted!</span>}
          {e.crippled && <span style={{ color: "#c792ea" }}> · crippled!</span>}
          <span style={{ color: MUTED }}> ({e.side === "A" ? "their" : "your"} {e.target}: {e.targetHpAfter} HP left)</span>
        </div>
      );
    case "pass":
      return <div><Who side={e.side} name={e.name} /> is out of energy and rests (+30⚡).</div>;
    case "effect":
      return <div style={{ color: e.kind === "venom" ? "#9be15d" : e.kind === "revive" ? "#9fd3a8" : e.kind === "item" ? "#5ee08a" : e.kind === "set" ? "#f1d9a0" : "#c7b8ff" }}>
        {e.kind === "venom" ? "☠️ " : e.kind === "revive" ? "⚰️ " : e.kind === "item" ? "🧪 " : e.kind === "set" ? "🛡️ " : "✨ "}<Who side={e.side} name={e.name} /> {e.text} <span style={{ color: MUTED }}>({e.hp} HP)</span>
      </div>;
    case "faint":
      return <div>💀 <Who side={e.side} name={e.name} /> fainted!</div>;
    case "sendIn":
      return <div>→ <Who side={e.side} name={e.name} /> is sent in.</div>;
    case "lineup":
      return e.text ? <div style={{ color: "#ffd66e", fontWeight: 600 }}>⚠️ {e.text}</div> : null;
    case "end":
      return <div style={{ fontWeight: 700 }}>{e.winner === "A" ? "You win!" : e.winner === "B" ? "The opponent wins." : "Draw (round limit)."}</div>;
    default:
      return null;
  }
}
