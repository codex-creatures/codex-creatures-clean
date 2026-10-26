// components/RaceTag.tsx
// A creature's race(s) as a small chip, each race in its own colour (two
// share the chip, edged in the first one's).

import { RACE_INFO, type Race } from "@/lib/creatures/creatureData";

export default function RaceTag({ race, races }: { race?: Race; races?: Race[] }) {
  const list = races?.length ? races : race ? [race] : [];
  if (list.length === 0) return null;
  const color = RACE_INFO[list[0]].color;
  const names = list.map((r) => RACE_INFO[r].name).join(" / ");
  return (
    <span className="pixel-font" title={`${list.length > 1 ? "Races" : "Race"}: ${names}`}
      style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color, border: `2px solid ${color}55`, whiteSpace: "nowrap" }}>
      {list.map((r, i) => <span key={r} style={{ color: RACE_INFO[r].color }}>{i > 0 && <span style={{ color: "rgba(255,255,255,0.4)" }}> / </span>}{RACE_INFO[r].icon} {RACE_INFO[r].name}</span>)}
    </span>
  );
}

// Just the race names (or icons), each in its race's colour, for tight lines
// like a fighter's name plate. Nothing for none (Klutz, the bosses).
export function RaceNames({ races, icons }: { races?: Race[]; icons?: boolean }) {
  if (!races?.length) return null;
  return (
    <span title={races.map((r) => RACE_INFO[r].name).join(" / ")}>
      {races.map((r, i) => <span key={r} style={{ color: RACE_INFO[r].color }}>{i > 0 && (icons ? "" : <span style={{ color: "rgba(255,255,255,0.4)" }}> / </span>)}{icons ? RACE_INFO[r].icon : RACE_INFO[r].name}</span>)}
    </span>
  );
}
