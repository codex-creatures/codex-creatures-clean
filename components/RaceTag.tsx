// components/RaceTag.tsx
// A creature's race(s) as a small coloured chip: two races share one chip,
// in the first race's colour.

import { RACE_INFO, type Race } from "@/lib/creatures/creatureData";

export default function RaceTag({ race, races }: { race?: Race; races?: Race[] }) {
  const list = races?.length ? races : race ? [race] : [];
  if (list.length === 0) return null;
  const color = RACE_INFO[list[0]].color;
  const names = list.map((r) => RACE_INFO[r].name).join(" / ");
  return (
    <span className="pixel-font" title={`${list.length > 1 ? "Races" : "Race"}: ${names}`}
      style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color, border: `2px solid ${color}55`, whiteSpace: "nowrap" }}>
      {list.map((r) => RACE_INFO[r].icon).join("")} {names}
    </span>
  );
}
