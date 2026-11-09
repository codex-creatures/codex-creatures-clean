"use client";
// components/dungeon/MapFirst.tsx
// At the entrance: one good look at the map before you go in. Moved out of app/dungeon/page.tsx as it was.

import { nextRooms, fightingTeam, type DungeonRun } from "@/lib/dungeon/run";
import { MUTED, type OwnedCreature } from "@/components/BattleScreen";
import DungeonMapView from "@/components/DungeonMapView";
import { WalkFirstMap } from "@/components/WalkView";
import Help from "@/components/Help";
import Party from "./Party";

// ── In the dungeon ────────────────────────────────────────────────
// At the entrance: one good look at the map before you go in.
// onEnter: tap one of the rooms off the entrance to step inside and head straight there.
export default function MapFirst({ run, byId, onTeam, onStep, onEnter }: {
  run: DungeonRun; byId: (id: string) => OwnedCreature | undefined; onTeam: (team: string[]) => void; onStep: () => void; onEnter?: (nodeId: string) => void; // (none: the walkable Encampment, where you walk there)
}) {
  const ready = fightingTeam(run).length > 0;
  const firstRooms = !!onEnter && nextRooms(run).length > 0 && ready;
  return (
    <div className="stone-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="pixel-font" style={{ fontSize: 20, color: "#f1d9a0" }}>Your map of the labyrinth</div>
        <Help title="The map">
          <ul>
            <li><b>Study it now:</b> once you step inside it&apos;s too dark to read.</li>
            <li>Inside, you only see <b>the room you&apos;re in</b> and the tunnels out of it.</li>
            <li>Rooms you know are marked; the rest are a <b>&ldquo;?&rdquo;</b>.</li>
            <li>Every tunnel leads <b>onward, never back</b>.</li>
            <li>Tap a room next to the entrance to <b>head straight there</b>.</li>
          </ul>
        </Help>
      </div>
      <p style={{ fontSize: 15, color: MUTED, margin: "4px 0 12px", lineHeight: 1.5 }}>
        {run.map.quest ? "Just a short way in — it went this way." : "Remember the way to the lair: it's too dark to read inside."}
      </p>
      {/* The walkable Encampment: the way in first, where it's in reach on a phone (the scroll's tall). */}
      {run.walk && (
        <button className="pixel-btn" onClick={onStep} disabled={!ready} style={{ marginBottom: 12, width: "100%", fontSize: 18, padding: "10px 0" }}>
          📜 Put the scroll away and begin
        </button>
      )}
      {run.walk ? <WalkFirstMap walk={run.walk} map={run.map} /> : <DungeonMapView run={run} onEnter={firstRooms ? onEnter : undefined} />}
      <div style={{ marginTop: 12 }}><Party run={run} byId={byId} onTeam={onTeam} /></div>
      {!run.walk && (
        <button className="pixel-btn" onClick={onStep} disabled={!ready} style={{ marginTop: 14, width: "100%", fontSize: 18, padding: "10px 0" }}>
          🔥 Put the map away and step inside
        </button>
      )}
    </div>
  );
}
