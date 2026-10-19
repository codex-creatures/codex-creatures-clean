"use client";
// components/TeamDropRow.tsx
// Your creatures in a row, as drop targets: drag a weapon or armour piece
// onto one to equip it (each is data-drop="who:<id>"; see hooks/useDragDrop).

import CreaturePortrait from "./CreaturePortrait";
import { NAME } from "./ContainerLoot";

export type TeamMember = { id: string; name: string; creatureId?: string };

// over: the drop target under the finger; ready: gear is being dragged (light them up); pulse: a tutorial's nudge.
export default function TeamDropRow({ team, over, ready, pulse }: { team: TeamMember[]; over: string | null; ready?: boolean; pulse?: boolean }) {
  if (team.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${team.length}, 1fr)`, gap: 6 }}>
      {team.map((c) => {
        const hot = over === `who:${c.id}`;
        return (
          <div key={c.id} data-drop={`who:${c.id}`} className={`inv-slot${pulse && !ready ? " tutorial-pulse" : ""}`} title={c.name}
            style={{ padding: 4, display: "grid", gap: 2, justifyItems: "center",
              ...(hot ? { borderColor: "#ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : ready || pulse ? { borderColor: "#c9a24a" } : {}) }}>
            <span style={{ width: "100%", maxWidth: 56 }}><CreaturePortrait creatureId={c.creatureId} title={c.name} /></span>
            <span style={{ ...NAME, color: "#f1d9a0" }}>{c.name}</span>
          </div>
        );
      })}
    </div>
  );
}
