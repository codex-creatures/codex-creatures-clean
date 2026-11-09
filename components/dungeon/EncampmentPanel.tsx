"use client";
// components/dungeon/EncampmentPanel.tsx
// An encampment: what sort it is, and its cages. Moved out of app/dungeon/page.tsx as it was.

import { CREATURE_BY_ID } from "@/lib/creatures/creatureData";
import { damageTypesOn } from "@/lib/combat/engine";
import { hasFight, ENCAMP_DRUNK_HP, type Room } from "@/lib/dungeon/run";
import { rarityColor, MUTED } from "@/components/BattleScreen";

// An encampment: what sort it is, and its cages.
export default function EncampmentPanel({ room, fuse, onCage }: { room: Room; fuse: number; onCage: (i: number) => void }) {
  const lurking = room.variant === "ambush" && !room.sprung;
  const locked = hasFight(room) && !room.done; // beat them first
  return (
    <div style={{ marginTop: 6 }}>
      {lurking && <p style={{ fontSize: 13, color: "#d8d4c8", margin: "0 0 8px" }}>A camp: bedrolls, a cold cookfire, cages along the wall. Nobody about.</p>}
      {room.variant === "drunk" && !room.done && (
        <p style={{ fontSize: 13, color: "#c7b8ff", margin: "0 0 8px" }}>🍺 Empty potion bottles everywhere: they&apos;ve <b>×{ENCAMP_DRUNK_HP} HP</b>.{damageTypesOn() ? " Arcane moves bite deeper." : ""}</p>
      )}
      {room.variant === "rigged" && !room.done && (
        <p style={{ fontSize: 13, color: "#ff8a5c", margin: "0 0 8px" }}>🧨 Barrels of blackpowder, fuse lit: win in <b>{fuse} rounds</b> or the room comes down on you.</p>
      )}
      <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0", marginBottom: 6 }}>Cages {locked && <span style={{ color: MUTED }}>· beat them first</span>}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(room.cages ?? []).map((c, i) => {
          const t = c.creatureId ? CREATURE_BY_ID[c.creatureId] : undefined;
          return c.opened ? (
            <span key={i} className="card-btn" style={{ cursor: "default", opacity: 0.6, flex: "1 1 30%" }}>
              {t ? <b style={{ color: rarityColor(t.rarity) }}>🔓 {t.name}</b> : <span style={{ color: MUTED }}>🔓 empty</span>}
            </span>
          ) : (
            <button key={i} className="card-btn" disabled={locked} onClick={() => onCage(i)} style={{ flex: "1 1 30%", justifyContent: "center", opacity: locked ? 0.5 : 1 }}>
              🔒 Open cage {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
