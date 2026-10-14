"use client";
// components/DungeonMapView.tsx
// The labyrinth map. You see a circle around where you stand; rooms you've
// seen before stay on the map (dimmed), and corridors leaving your circle
// fade into the fog, so you know which way they go but not where they end.
// Rooms you can walk to glow; tap one (or a corridor heading into the fog),
// or use the buttons underneath. Mystery rooms are "?" until you walk in.

import { useId } from "react";
import { ROOM_INFO, runPosition, nextRooms, type DungeonRun } from "@/lib/dungeon/run";
import { MAP_W, MAP_H, SIGHT_RADIUS, distance, heading, inSight, seenRooms, type MapNode } from "@/lib/dungeon/map";
import { YOU } from "@/components/BattleLog";
import { MUTED } from "@/components/BattleScreen";

const R = 5; // room radius (map units)

// What a room looks like to you: "?" for an unvisited mystery.
export function roomLook(n: MapNode, visited: Set<string>) {
  return n.mystery && !visited.has(n.id) ? { name: "Unknown room", icon: "❓" } : ROOM_INFO[n.kind];
}

// A choice of where to go next: the room, if you can see it; otherwise
// just the corridor and the way it heads.
export function corridorLabel(run: DungeonRun, n: MapNode): string {
  const here = run.map.nodes[runPosition(run)];
  if (!seenRooms(run.map, run.path).has(n.id)) return `Dark corridor (heads ${heading(here, n)})`;
  const look = roomLook(n, new Set(run.path));
  return run.cleared.includes(n.id) ? `${look.name} (cleared)` : look.name;
}

export default function DungeonMapView({ run, onEnter }: { run: DungeonRun; onEnter?: (nodeId: string) => void }) {
  const maskId = useId();
  const { map } = run;
  const pos = runPosition(run);
  const here = map.nodes[pos];
  const visited = new Set(run.path);
  const seen = seenRooms(map, run.path);
  const sight = inSight(map, pos);
  const choices = onEnter ? nextRooms(run) : [];
  const all = Object.values(map.nodes);
  const corridors = all.flatMap((a) => a.links.filter((b) => a.id < b).map((b) => [a, map.nodes[b]] as const));
  const walked = new Set(run.path.slice(1).map((id, i) => [run.path[i], id].sort().join("|")));

  const room = (n: MapNode, live: boolean) => {
    const look = roomLook(n, visited);
    const cleared = run.cleared.includes(n.id) && n.id !== pos;
    return (
      <g key={`${live ? "l" : "m"}-${n.id}`} opacity={live ? 1 : 0.45}>
        <circle cx={n.x} cy={n.y} r={n.kind === "boss" ? R + 1.5 : R} fill={cleared ? "#16231a" : "#1a1b22"}
          stroke={cleared ? "#3f6b45" : "#4a4d5a"} strokeWidth={0.8} />
        <text x={n.x} y={n.y + 0.4} textAnchor="middle" dominantBaseline="middle" fontSize={n.kind === "boss" ? 6 : 4.6}
          opacity={cleared ? 0.55 : 1}>{look.icon}</text>
      </g>
    );
  };
  const corridor = (a: MapNode, b: MapNode, live: boolean) => {
    const taken = walked.has([a.id, b.id].sort().join("|"));
    return (
      <line key={`${live ? "l" : "m"}-${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={taken ? "#ffd66e" : "#6b6e7b"} strokeWidth={taken ? 1 : 0.7} strokeDasharray={taken ? undefined : "1.6 1.2"}
        opacity={live ? 1 : 0.4} />
    );
  };

  // Where to draw the tap target for a corridor whose end you can't see.
  const edgePoint = (n: MapNode) => {
    const t = Math.min(1, (SIGHT_RADIUS - 4) / distance(here, n));
    return { x: here.x + (n.x - here.x) * t, y: here.y + (n.y - here.y) * t };
  };

  return (
    <div>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto", background: "#08090c", border: "2px solid #000" }}
        role="img" aria-label="Labyrinth map">
        <defs>
          <radialGradient id={`${maskId}-g`}>
            <stop offset="80%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <mask id={`${maskId}-m`} maskUnits="userSpaceOnUse" x={0} y={0} width={MAP_W} height={MAP_H}>
            <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="black" />
            <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS + 3} fill={`url(#${maskId}-g)`} />
          </mask>
        </defs>

        {/* What you remember, out in the fog. */}
        {corridors.filter(([a, b]) => seen.has(a.id) && seen.has(b.id)).map(([a, b]) => corridor(a, b, false))}
        {all.filter((n) => seen.has(n.id) && !sight.has(n.id)).map((n) => room(n, false))}

        {/* What's around you right now. */}
        <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS + 3} fill={`url(#${maskId}-g)`} opacity={0.08} />
        <g mask={`url(#${maskId}-m)`}>
          {corridors.map(([a, b]) => corridor(a, b, true))}
          {all.map((n) => room(n, true))}
        </g>

        {/* The lair is always marked. */}
        <text x={map.nodes[map.boss].x} y={map.nodes[map.boss].y + R + 5} textAnchor="middle" fontSize={3.6} fill="#f1d9a0" className="pixel-font">the lair</text>

        {/* Where you can go. */}
        {choices.map((n) => {
          const visible = sight.has(n.id);
          const p = visible ? n : edgePoint(n);
          const go = () => onEnter?.(n.id);
          return (
            <g key={`c-${n.id}`} onClick={go} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`Go to: ${corridorLabel(run, n)}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(); }}>
              <title>{corridorLabel(run, n)}</title>
              <circle cx={p.x} cy={p.y} r={R + 1.6} fill={visible ? "transparent" : "#1a1b22"} stroke={YOU} strokeWidth={0.9}>
                <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite" />
              </circle>
              {!visible && <text x={p.x} y={p.y + 0.4} textAnchor="middle" dominantBaseline="middle" fontSize={4.6} fill="#8fc1ff">?</text>}
            </g>
          );
        })}
        <circle cx={here.x} cy={here.y} r={R + 1.2} fill="none" stroke="#ffd66e" strokeWidth={1.1} />
      </svg>

      {onEnter && choices.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
          {choices.map((n) => (
            <button key={n.id} className="card-btn" onClick={() => onEnter(n.id)}
              style={{ display: "block", textAlign: "center", padding: "10px 4px", borderColor: YOU }}>
              <div style={{ fontSize: 22 }}>{sight.has(n.id) ? roomLook(n, visited).icon : "🌫️"}</div>
              <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0" }}>{corridorLabel(run, n)}</div>
            </button>
          ))}
        </div>
      )}
      {onEnter && choices.length === 0 && <p style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>Finish this room to move on.</p>}
    </div>
  );
}
