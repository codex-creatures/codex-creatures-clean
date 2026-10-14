"use client";
// components/DungeonMapView.tsx
// The labyrinth, drawn as a dungeon: stone chambers joined by tunnels on a
// flagstone floor, in darkness. Your torch lights a flickering circle around
// you; chambers you've seen before stay faintly visible, and tunnels leaving
// the light vanish into the dark, so you know which way they go but not
// where they end. Chambers you can walk to glow; tap one (or a tunnel
// heading into the dark), or use the buttons underneath. Mystery rooms are
// "?" until you walk in.

import { useId } from "react";
import { ROOM_INFO, runPosition, nextRooms, type DungeonRun } from "@/lib/dungeon/run";
import { MAP_W, MAP_H, SIGHT_RADIUS, distance, heading, inSight, seenRooms, type MapNode } from "@/lib/dungeon/map";
import { YOU } from "@/components/BattleLog";
import { MUTED } from "@/components/BattleScreen";

const S = 11;          // chamber size (map units)
const TUNNEL = 3.6;    // tunnel width
const REMEMBERED = "#b8b8b8"; // how dark remembered places stay (mask: white = fully dark)

// What a room looks like to you: "?" for an unvisited mystery.
export function roomLook(n: MapNode, visited: Set<string>) {
  return n.mystery && !visited.has(n.id) ? { name: "Unknown room", icon: "❓" } : ROOM_INFO[n.kind];
}

// A choice of where to go next: the room, if you can see it; otherwise
// just the tunnel and the way it heads.
export function corridorLabel(run: DungeonRun, n: MapNode): string {
  const here = run.map.nodes[runPosition(run)];
  if (!seenRooms(run.map, run.path).has(n.id)) return `Dark tunnel (heads ${heading(here, n)})`;
  return roomLook(n, new Set(run.path)).name;
}

export default function DungeonMapView({ run, onEnter }: { run: DungeonRun; onEnter?: (nodeId: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const { map } = run;
  const pos = runPosition(run);
  const here = map.nodes[pos];
  const visited = new Set(run.path);
  const seen = seenRooms(map, run.path);
  const sight = inSight(map, pos);
  const choices = onEnter ? nextRooms(run) : [];
  const all = Object.values(map.nodes);
  const tunnels = all.flatMap((a) => a.links.filter((b) => a.id < b).map((b) => [a, map.nodes[b]] as const));
  const walked = new Set(run.path.slice(1).map((id, i) => [run.path[i], id].sort().join("|")));
  const isWalked = (a: MapNode, b: MapNode) => walked.has([a.id, b.id].sort().join("|"));
  const boss = map.nodes[map.boss];

  // Where to draw the tap target for a tunnel whose end is in the dark.
  const edgePoint = (n: MapNode) => {
    const t = Math.min(1, (SIGHT_RADIUS - 5) / distance(here, n));
    return { x: here.x + (n.x - here.x) * t, y: here.y + (n.y - here.y) * t };
  };

  const flicker = (base: number) => (
    <animate attributeName="r" values={`${base};${base + 1.6};${base - 0.8};${base + 1};${base}`} dur="1.3s" repeatCount="indefinite" />
  );

  return (
    <div>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "0 auto", border: "3px solid #000", background: "#050506" }}
        role="img" aria-label="Labyrinth map">
        <defs>
          {/* Flagstone floor. */}
          <pattern id={`${uid}-floor`} width="8" height="6" patternUnits="userSpaceOnUse">
            <rect width="8" height="6" fill="#17151a" />
            <rect x="0.2" y="0.2" width="3.6" height="2.6" fill="#1d1b20" />
            <rect x="4.2" y="0.2" width="3.6" height="2.6" fill="#1a181d" />
            <rect x="-1.8" y="3.2" width="3.6" height="2.6" fill="#1b191e" />
            <rect x="2.2" y="3.2" width="3.6" height="2.6" fill="#1e1c21" />
            <rect x="6.2" y="3.2" width="3.6" height="2.6" fill="#19171c" />
          </pattern>
          {/* Chamber flagstones (warmer). */}
          <pattern id={`${uid}-stone`} width="3.6" height="3.6" patternUnits="userSpaceOnUse">
            <rect width="3.6" height="3.6" fill="#3a332b" />
            <rect x="0.15" y="0.15" width="1.6" height="1.6" fill="#453c32" />
            <rect x="1.85" y="1.85" width="1.6" height="1.6" fill="#40372e" />
          </pattern>
          <radialGradient id={`${uid}-hole`}>
            <stop offset="55%" stopColor="black" />
            <stop offset="100%" stopColor="white" />
          </radialGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor="#ffb257" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#ff8a2a" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ff8a2a" stopOpacity="0" />
          </radialGradient>
          {/* The dark: everything except your torchlight, and a faint memory of places you've seen. */}
          <mask id={`${uid}-dark`} maskUnits="userSpaceOnUse" x={0} y={0} width={MAP_W} height={MAP_H}>
            <rect width={MAP_W} height={MAP_H} fill="white" />
            {tunnels.filter(([a, b]) => seen.has(a.id) && seen.has(b.id)).map(([a, b]) => (
              <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={REMEMBERED} strokeWidth={TUNNEL + 1.5} />
            ))}
            {all.filter((n) => seen.has(n.id)).map((n) => (
              <rect key={n.id} x={n.x - S / 2 - 1} y={n.y - S / 2 - 1} width={S + 2} height={S + 2} fill={REMEMBERED} />
            ))}
            <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS + 4} fill={`url(#${uid}-hole)`}>{flicker(SIGHT_RADIUS + 4)}</circle>
          </mask>
        </defs>

        <rect width={MAP_W} height={MAP_H} fill={`url(#${uid}-floor)`} />

        {/* Tunnels: dark walls with a floor between them. */}
        {tunnels.map(([a, b]) => (
          <g key={`t-${a.id}-${b.id}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#050506" strokeWidth={TUNNEL + 1.6} strokeLinecap="round" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isWalked(a, b) ? "#5a4630" : "#2e2924"} strokeWidth={TUNNEL} strokeLinecap="round" />
            {isWalked(a, b) && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c9873e" strokeWidth={0.5} strokeDasharray="1 1.5" opacity={0.8} />}
          </g>
        ))}

        {/* Chambers. */}
        {all.map((n) => {
          const look = roomLook(n, visited);
          const been = visited.has(n.id) && n.id !== pos;
          const big = n.kind === "boss" ? 3 : 0;
          return (
            <g key={`r-${n.id}`}>
              <rect x={n.x - S / 2 - 0.9 - big / 2} y={n.y - S / 2 - 0.9 - big / 2} width={S + 1.8 + big} height={S + 1.8 + big} rx={1} fill="#050506" />
              <rect x={n.x - S / 2 - big / 2} y={n.y - S / 2 - big / 2} width={S + big} height={S + big} rx={0.6} fill={`url(#${uid}-stone)`}
                stroke={n.kind === "boss" ? "#7a2a2a" : "#1a1612"} strokeWidth={0.6} />
              <text x={n.x} y={n.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={n.kind === "boss" ? 7 : 5.6}
                opacity={been ? 0.45 : 1}>{look.icon}</text>
            </g>
          );
        })}

        {/* Torchlight, then the dark over everything else. */}
        <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS} fill={`url(#${uid}-glow)`}>{flicker(SIGHT_RADIUS)}</circle>
        <rect width={MAP_W} height={MAP_H} fill="#030304" mask={`url(#${uid}-dark)`} />

        {/* The lair is always marked. */}
        <text x={boss.x} y={boss.y + S / 2 + 5.5} textAnchor="middle" fontSize={3.6} fill="#c96a5a" className="pixel-font">the lair</text>

        {/* Where you can go. */}
        {choices.map((n) => {
          const lit = sight.has(n.id);
          const p = lit ? n : edgePoint(n);
          const go = () => onEnter?.(n.id);
          return (
            <g key={`c-${n.id}`} onClick={go} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`Go to: ${corridorLabel(run, n)}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(); }}>
              <title>{corridorLabel(run, n)}</title>
              {lit ? (
                <rect x={n.x - S / 2 - 1.6} y={n.y - S / 2 - 1.6} width={S + 3.2} height={S + 3.2} rx={1.2} fill="transparent" stroke={YOU} strokeWidth={0.9}>
                  <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite" />
                </rect>
              ) : (
                <>
                  <circle cx={p.x} cy={p.y} r={4.2} fill="#0b0b0e" stroke={YOU} strokeWidth={0.8}>
                    <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                  <text x={p.x} y={p.y + 0.4} textAnchor="middle" dominantBaseline="middle" fontSize={4.4} fill="#8fc1ff">?</text>
                </>
              )}
            </g>
          );
        })}

        {/* You, with your torch. */}
        <rect x={here.x - S / 2 - 1.3} y={here.y - S / 2 - 1.3} width={S + 2.6} height={S + 2.6} rx={1.2} fill="none" stroke="#ffd66e" strokeWidth={1} />
        <text x={here.x + S / 2 + 0.6} y={here.y - S / 2 + 0.6} textAnchor="middle" dominantBaseline="middle" fontSize={4.6}>🔥</text>
      </svg>

      {onEnter && choices.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
          {choices.map((n) => (
            <button key={n.id} className="card-btn" onClick={() => onEnter(n.id)}
              style={{ display: "block", textAlign: "center", padding: "10px 4px", borderColor: YOU }}>
              <div style={{ fontSize: 22 }}>{sight.has(n.id) ? roomLook(n, visited).icon : "🌑"}</div>
              <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0" }}>{corridorLabel(run, n)}</div>
            </button>
          ))}
        </div>
      )}
      {onEnter && choices.length === 0 && run.current && <p style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>Finish this room to move on.</p>}
    </div>
  );
}
