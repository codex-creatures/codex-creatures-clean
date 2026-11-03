"use client";
// components/GroundEffects.tsx
// What lies under a side's field (lib/combat/battle.ts: ground effects),
// drawn on the floor beneath its creatures. Built to take more kinds (the
// user's plan: poison clouds to ignite and the like); for now, the blood
// pool from Blood Sacrifice: a dark pool that ripples, with a drop for each
// creature it's still waiting on before it bursts (lit drops: already hit).

import type { GroundEffect } from "@/lib/combat/battle";

export default function GroundEffects({ ground, at }: { ground?: GroundEffect[]; at: React.CSSProperties }) {
  const blood = ground?.find((g) => g.kind === "blood");
  if (!blood) return null;
  return (
    <div aria-label={`Blood pool: bursts in ${blood.entries - blood.count} more`} className="ground-blood" style={at}>
      <div className="ground-blood-pool" />
      <div className="ground-blood-drops pixel-font">
        {Array.from({ length: blood.entries }, (_, i) => <span key={i} className={i < blood.count ? "on" : undefined} />)}
      </div>
    </div>
  );
}
