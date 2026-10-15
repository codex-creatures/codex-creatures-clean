// components/RaceTag.tsx
// A creature's race as a small coloured chip.

import { RACE_INFO, type Race } from "@/lib/creatures/creatureData";

export default function RaceTag({ race }: { race?: Race }) {
  if (!race) return null;
  const r = RACE_INFO[race];
  return (
    <span className="pixel-font" title={`Race: ${r.name}`}
      style={{ padding: "1px 8px", fontSize: 12, textTransform: "uppercase", color: r.color, border: `2px solid ${r.color}55` }}>
      {r.icon} {r.name}
    </span>
  );
}
