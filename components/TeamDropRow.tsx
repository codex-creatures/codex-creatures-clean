"use client";
// components/TeamDropRow.tsx
// Your creatures in a row, as drop targets: drag a weapon or armour piece
// onto one to equip it, or a potion to heal it (each is data-drop="who:<id>";
// see hooks/useDragDrop). Given their HP, each shows it as a %.

import CreaturePortrait from "./CreaturePortrait";
import { NAME } from "./ContainerLoot";

export type TeamMember = { id: string; name: string; creatureId?: string; hp?: number }; // hp: 0–1

// over: the drop target under the finger; ready: something is being dragged that they can take
// (light them up), or a test of who can (a potion: the hurt ones); pulse: a tutorial's nudge.
export default function TeamDropRow({ team, over, ready, pulse }: { team: TeamMember[]; over: string | null; ready?: boolean | ((c: TeamMember) => boolean); pulse?: boolean }) {
  if (team.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${team.length}, 1fr)`, gap: 6 }}>
      {team.map((c) => {
        const hot = over === `who:${c.id}`;
        const lit = typeof ready === "function" ? ready(c) : ready;
        const pct = c.hp === undefined ? undefined : Math.round(c.hp * 100);
        return (
          <div key={c.id} data-drop={`who:${c.id}`} className={`inv-slot${pulse && !ready ? " tutorial-pulse" : ""}`} title={c.name}
            style={{ padding: 4, display: "grid", gap: 2, justifyItems: "center",
              ...(hot ? { borderColor: "#ffd66e", boxShadow: "0 0 12px rgba(255,214,110,0.55)" } : lit || pulse ? { borderColor: "#c9a24a" } : {}) }}>
            <span style={{ width: "100%", maxWidth: 56 }}><CreaturePortrait creatureId={c.creatureId} title={c.name} /></span>
            <span style={{ ...NAME, color: "#f1d9a0" }}>{c.name}</span>
            {pct !== undefined && (
              <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: pct >= 100 ? "#8fd18f" : pct > 40 ? "#ffd66e" : "#ff8a80" }}>❤ {pct}%</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
