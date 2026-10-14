"use client";
// components/AbilityTag.tsx
// A creature's ability (a rare passive some Epic+ creatures are born with).

import { ABILITIES, type AbilityKey } from "@/lib/creatures/abilities";

export default function AbilityTag({ ability, compact }: { ability?: AbilityKey; compact?: boolean }) {
  if (!ability) return null;
  const a = ABILITIES[ability];
  if (compact) return <span title={a.text} style={{ color: "#ffe9a8" }}>✦ {a.name}</span>;
  return (
    <div style={{ margin: "8px 0 0", padding: "6px 10px", fontSize: 12, lineHeight: 1.4, color: "#ffe9a8",
      background: "rgba(255,233,168,0.07)", border: "2px solid rgba(255,233,168,0.35)" }}>
      <b>✦ Ability: {a.name}</b> — {a.text}
    </div>
  );
}
