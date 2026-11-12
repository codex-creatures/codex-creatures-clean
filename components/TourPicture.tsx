"use client";
// components/TourPicture.tsx
// The pictures in Klutz's bubble on his combat tour (lib/tour.ts, a step's
// `show`): the races and their colours, sample move tablets, an energy bar,
// the race chart. Real moves, drawn as in a fight (MoveTile).

import RaceChart from "./RaceChart";
import Glyph, { RaceIcon } from "./Glyph";
import { MoveTile } from "./MoveTile";
import { BALANCED_INFO, CLASS_INFO, MOVE_BY_NAME, RACES, RACE_INFO, type CombatClass } from "@/lib/creatures/creatureData";
import { coreMove } from "@/lib/creatures/raceKitsV2";
import type { TourPicture as Picture } from "@/lib/tour";

const STYLES: CombatClass[] = ["melee", "ranged", "magic"];
const ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 8 };
const CELL: React.CSSProperties = { height: 64 };
const CAPTION: React.CSSProperties = { fontSize: 12, textAlign: "center", marginTop: 3 };
// A move, by name (codex moves carry their race's stone).
const named = (name: string) => MOVE_BY_NAME[name];

export default function TourPicture({ show }: { show: Picture }) {
  if (show === "races") return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", marginTop: 8, fontSize: 13 }}>
      {RACES.map((r) => <span key={r} style={{ color: RACE_INFO[r].color, whiteSpace: "nowrap" }}><RaceIcon r={r} /> {RACE_INFO[r].name}</span>)}
      <span style={{ color: BALANCED_INFO.color, whiteSpace: "nowrap" }}><Glyph icon={BALANCED_INFO.icon} art={BALANCED_INFO.art} /> {BALANCED_INFO.name}</span>
    </div>
  );
  if (show === "tablets") {
    const moves = [coreMove("melee", "light"), named("Smite"), named("Bone Javelin")];
    return <div style={ROW}>{moves.map((m) => <div key={m.name} style={CELL}><MoveTile m={m} fill /></div>)}</div>;
  }
  if (show === "styles") return (
    <div style={ROW}>
      {STYLES.map((s) => (
        <div key={s}>
          <div style={CELL}><MoveTile m={coreMove(s, "light")} fill /></div>
          <div style={{ ...CAPTION, color: CLASS_INFO[s].color }}>{CLASS_INFO[s].icon} {CLASS_INFO[s].name}</div>
        </div>
      ))}
    </div>
  );
  if (show === "flip") return (
    <div style={{ width: "60%", margin: "8px auto 0" }}><MoveTile m={named("Soul Snatch")} /></div>
  );
  if (show === "energy") return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="pixel-font" style={{ fontSize: 12, color: "#9cc8ff" }}>⚡ 70</span>
        <div style={{ flex: 1, height: 7, background: "#0d0e12", border: "1px solid #000" }}><div style={{ height: "100%", width: "70%", background: "#4EA1FF" }} /></div>
      </div>
      <div style={{ ...ROW, gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[coreMove("ranged", "light"), coreMove("ranged", "heavy")].map((m) => <div key={m.name} style={CELL}><MoveTile m={m} fill /></div>)}
      </div>
    </div>
  );
  return <RaceChart />;
}
