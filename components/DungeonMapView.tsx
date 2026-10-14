"use client";
// components/DungeonMapView.tsx
// The dungeon map: the archway at the bottom, the boss at the top. You see
// SIGHT rooms ahead along the passageways; further rooms are lost in fog.
// Rooms you can walk into next glow, and can be tapped (or picked from the
// buttons underneath). Some rooms are mysteries: "?" until you walk in.

import { DUNGEON_ROOMS, ROOM_INFO, runPosition, nextRooms, type DungeonRun } from "@/lib/dungeon/run";
import { MAP_COLS, SIGHT, visibleFrom, type MapNode } from "@/lib/dungeon/map";
import { YOU } from "@/components/BattleLog";
import { MUTED } from "@/components/BattleScreen";

const CW = 64;  // column width
const RH = 50;  // row height
const R = 17;   // room radius
const W = MAP_COLS * CW;

const x = (col: number) => col * CW + CW / 2;

// A mystery room shows as "?" until you've walked into it.
const roomLook = (n: MapNode, walked: Set<string>) =>
  n.mystery && !walked.has(n.id) ? { name: "Unknown room", icon: "❓" } : ROOM_INFO[n.kind];

export default function DungeonMapView({ run, onEnter }: { run: DungeonRun; onEnter?: (nodeId: string) => void }) {
  const { map, path } = run;
  const pos = runPosition(run);
  const here = pos ? map.nodes[pos].row : 0;
  const choices = new Set((onEnter ? nextRooms(run) : []).map((n) => n.id));
  const shown = visibleFrom(map, pos);
  path.forEach((id) => shown.add(id));
  const onPath = new Set(path);

  // Rows from the archway (0) up to what you can see; past that, one row of
  // fog, and the boss above it.
  const lastSeen = Math.min(here + SIGHT, DUNGEON_ROOMS - 1);
  const fogged = lastSeen < DUNGEON_ROOMS - 1;
  const top = fogged ? lastSeen + 2 : DUNGEON_ROOMS;
  const H = (top + 1) * RH;
  const y = (row: number) => (top - (row <= lastSeen ? row : top)) * RH + RH / 2;
  const ARCH = { x: x(Math.floor(MAP_COLS / 2)), y: y(0) };

  // Passageways: the one you took into each room, and every one ahead of you.
  const lines: { from: { x: number; y: number }; to: string; taken: boolean }[] = [];
  map.entrance.forEach((id) => {
    if (path[0] === id || (!pos && shown.has(id))) lines.push({ from: ARCH, to: id, taken: path[0] === id });
  });
  for (const id of shown) {
    const n = map.nodes[id];
    for (const m of n.next) {
      if (!shown.has(m)) continue;
      const taken = onPath.has(id) && onPath.has(m);
      if (onPath.has(id) && id !== pos && !taken) continue; // roads not taken stay behind you
      lines.push({ from: { x: x(n.col), y: y(n.row) }, to: m, taken });
    }
  }


  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto", background: "#0d0e13", border: "2px solid #000" }}
        role="img" aria-label={`Dungeon map: room ${run.room} of ${DUNGEON_ROOMS}`}>
        {fogged && (
          <g>
            <rect x={0} y={RH} width={W} height={RH} fill="#2a2c36" opacity={0.85} />
            <text x={W / 2} y={RH * 1.5} textAnchor="middle" dominantBaseline="middle"
              fill="#8a8d99" fontSize={13} className="pixel-font">~ fog — get closer to see ~</text>
          </g>
        )}

        {lines.map((l, i) => {
          const to = map.nodes[l.to];
          return (
            <line key={i} x1={l.from.x} y1={l.from.y} x2={x(to.col)} y2={y(to.row)}
              stroke={l.taken ? "#ffd66e" : "#5b5e6b"} strokeWidth={l.taken ? 3 : 2} strokeDasharray={l.taken ? undefined : "4 4"} />
          );
        })}

        <g>
          <rect x={ARCH.x - 22} y={ARCH.y - 14} width={44} height={28} fill={pos ? "#1a1b22" : "#5a3b1c"} stroke={pos ? "#000" : "#ffd66e"} strokeWidth={2} />
          <text x={ARCH.x} y={ARCH.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#f1d9a0" className="pixel-font">archway</text>
        </g>

        {[...shown].map((id) => {
          const n = map.nodes[id];
          const info = roomLook(n, onPath);
          const isHere = id === pos;
          const canGo = choices.has(id);
          const visited = onPath.has(id) && !isHere;
          const stroke = isHere ? "#ffd66e" : canGo ? YOU : visited ? "#3f6b45" : "#3a3c48";
          const go = canGo && onEnter ? () => onEnter(id) : undefined;
          return (
            <g key={id} onClick={go} style={{ cursor: go ? "pointer" : "default" }}
              role={go ? "button" : undefined} tabIndex={go ? 0 : undefined} aria-label={go ? `Go to ${info.name}` : undefined}
              onKeyDown={go ? (e) => { if (e.key === "Enter" || e.key === " ") go(); } : undefined}>
              <title>{info.name}{isHere ? " (you are here)" : ""}</title>
              {canGo && <circle cx={x(n.col)} cy={y(n.row)} r={R + 5} fill="none" stroke={YOU} strokeWidth={2} opacity={0.5}>
                <animate attributeName="opacity" values="0.15;0.7;0.15" dur="1.6s" repeatCount="indefinite" />
              </circle>}
              <circle cx={x(n.col)} cy={y(n.row)} r={n.kind === "boss" ? R + 4 : R} fill={visited ? "#16231a" : "#1a1b22"} stroke={stroke} strokeWidth={isHere || canGo ? 3 : 2} />
              <text x={x(n.col)} y={y(n.row) + 1} textAnchor="middle" dominantBaseline="middle" fontSize={n.kind === "boss" ? 20 : 16}
                opacity={visited ? 0.5 : 1}>{info.icon}</text>
            </g>
          );
        })}
      </svg>

      {onEnter && choices.size > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${choices.size}, 1fr)`, gap: 8, marginTop: 10 }}>
          {nextRooms(run).map((n) => (
            <button key={n.id} className="card-btn" onClick={() => onEnter(n.id)}
              style={{ display: "block", textAlign: "center", padding: "10px 4px", borderColor: YOU }}>
              <div style={{ fontSize: 24 }}>{roomLook(n, onPath).icon}</div>
              <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0" }}>{roomLook(n, onPath).name}</div>
            </button>
          ))}
        </div>
      )}
      {onEnter && choices.size === 0 && <p style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>Finish this room to move on.</p>}
    </div>
  );
}
