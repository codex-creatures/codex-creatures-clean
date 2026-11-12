"use client";
// components/GroundEffects.tsx
// What lies under a side's field (lib/combat/battle.ts: ground effects),
// drawn on the floor beneath its creatures:
// - the blood pool from Blood Sacrifice: a dark pool that ripples, with a drop
//   for each creature it's still waiting on before it bursts (lit drops: already hit);
// - Haemorrhage's blood: a thinner smear;
// - a poison cloud (Choking Smog, Implode, the Hydra's breath): a green haze,
//   with the rounds it has left;
// - caltrops: spikes scattered on the floor.

import type { GroundEffect } from "@/lib/combat/battle";

export default function GroundEffects({ ground, at }: { ground?: GroundEffect[]; at: React.CSSProperties }) {
  if (!ground?.length) return null;
  const blood = ground.find((g) => g.kind === "blood");
  const gore = ground.find((g) => g.kind === "gore");
  const cloud = ground.find((g) => g.kind === "cloud");
  const trops = ground.find((g) => g.kind === "caltrops");
  return (
    <>
      {trops && <div aria-label="Caltrops" className="ground-caltrops" style={at} />}
      {gore && <div aria-label={`Blood: toxic damage +${Math.round(gore.amp * 100)}%`} className="ground-gore" style={at} />}
      {blood && (
        <div aria-label={`Blood pool: bursts in ${blood.entries - blood.count} more`} className="ground-blood" style={at}>
          <div className="ground-blood-pool" />
          <div className="ground-blood-drops pixel-font">
            {Array.from({ length: blood.entries }, (_, i) => <span key={i} className={i < blood.count ? "on" : undefined} />)}
          </div>
        </div>
      )}
      {cloud && (
        <div aria-label={`Poison cloud: ${cloud.rounds} rounds left`} className="ground-cloud" style={at}>
          <span className="pixel-font">☁ {cloud.rounds}</span>
        </div>
      )}
    </>
  );
}
