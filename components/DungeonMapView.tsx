"use client";
// components/DungeonMapView.tsx
// The labyrinth as a map scroll: every room is inked on old parchment, but
// what's in a room is a "?" until you know it. A few rooms are marked from
// the start; rooms near where you've stood fill in as you go (mysteries stay
// "?" until you walk in). Fog of war covers everything outside your
// torchlight, and the corridors only show up close to the flame. Your route
// is traced in red. Rooms you can walk to pulse; tap one, or use the
// buttons underneath. Fights are marked with crossed swords: ink for a
// creature den, red for a lurking brute.

import { useId } from "react";
import { ROOM_INFO, runPosition, nextRooms, type DungeonRun } from "@/lib/dungeon/run";
import { MAP_W, MAP_H, SIGHT_RADIUS, distance, heading, knownRooms, type MapNode } from "@/lib/dungeon/map";
import type { RoomKind } from "@/lib/dungeon/run";
import { MUTED } from "@/components/BattleScreen";

const R = 5.6;              // room radius (map units)
const INK = "#4a2f17";
const RED_INK = "#9b2a1d";
const PAPER = "#e9d6a6";
const SERIF = "Georgia, 'Times New Roman', serif";

// Crossed swords, the battle sign: drawn in a 24×24 box.
function Swords({ color }: { color: string }) {
  const sword = (
    <g stroke={color} strokeLinecap="round" fill="none">
      <line x1={7} y1={17} x2={20.5} y2={3.5} strokeWidth={2.2} />
      <line x1={5} y1={13.5} x2={10.5} y2={19} strokeWidth={1.7} />
      <line x1={7.6} y1={16.4} x2={4} y2={20} strokeWidth={1.9} />
      <circle cx={3.3} cy={20.7} r={1.2} fill={color} stroke="none" />
    </g>
  );
  return <>{sword}<g transform="translate(24 0) scale(-1 1)">{sword}</g></>;
}

const SWORDS: Partial<Record<RoomKind, { ink: string; light: string }>> = {
  easy: { ink: "#4a2f17", light: "#e9d6a6" },
  hard: { ink: "#9b2a1d", light: "#ff8a80" },
};

// A room's icon at a size (px), for the buttons under the map.
function RoomIcon({ kind, size }: { kind: RoomKind; size: number }) {
  const sw = SWORDS[kind];
  if (!sw) return <>{ROOM_INFO[kind].icon}</>;
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ verticalAlign: "middle" }}><Swords color={sw.light} /></svg>;
}

// What a room looks like on your scroll: "?" until you know what's there.
export function roomLook(n: MapNode, known: Set<string>) {
  return known.has(n.id) ? ROOM_INFO[n.kind] : { name: "Unknown room", icon: "?" };
}

// A choice of where to go next, named if you know what's there.
export function corridorLabel(run: DungeonRun, n: MapNode): string {
  if (knownRooms(run.map, run.path).has(n.id)) return ROOM_INFO[n.kind].name;
  return `Unknown room (${heading(run.map.nodes[runPosition(run)], n)})`;
}

const flicker = (base: number) => (
  <animate attributeName="r" values={`${base};${base + 1.4};${base - 0.8};${base + 0.9};${base}`} dur="1.4s" repeatCount="indefinite" />
);

export default function DungeonMapView({ run, onEnter }: { run: DungeonRun; onEnter?: (nodeId: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const { map } = run;
  const pos = runPosition(run);
  const here = map.nodes[pos];
  const visited = new Set(run.path);
  const known = knownRooms(map, run.path);
  const choices = onEnter ? nextRooms(run) : [];
  const choiceIds = new Set(choices.map((n) => n.id));
  const all = Object.values(map.nodes);
  const corridors = all.flatMap((a) => a.links.filter((b) => a.id < b).map((b) => [a, map.nodes[b]] as const));
  const walked = new Set(run.path.slice(1).map((id, i) => [run.path[i], id].sort().join("|")));
  const isWalked = (a: MapNode, b: MapNode) => walked.has([a.id, b.id].sort().join("|"));
  const isWayOn = (a: MapNode, b: MapNode) => (a.id === pos && choiceIds.has(b.id)) || (b.id === pos && choiceIds.has(a.id));

  // The scroll: parchment between two wooden rollers.
  const PAD_X = 7, TOP = -9, BOTTOM = MAP_H + 9;
  const view = { x: -PAD_X - 4, y: TOP - 8, w: MAP_W + 2 * PAD_X + 8, h: BOTTOM - TOP + 16 };
  const roller = (y: number) => (
    <g>
      <rect x={-PAD_X - 4} y={y - 3.6} width={MAP_W + 2 * PAD_X + 8} height={7.2} rx={3.6} fill={`url(#${uid}-wood)`} stroke="#2a1708" strokeWidth={0.5} />
      <circle cx={-PAD_X - 4} cy={y} r={3.2} fill="#5a3518" stroke="#2a1708" strokeWidth={0.5} />
      <circle cx={MAP_W + PAD_X + 4} cy={y} r={3.2} fill="#5a3518" stroke="#2a1708" strokeWidth={0.5} />
    </g>
  );

  return (
    <div>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} style={{ width: "100%", maxWidth: 400, display: "block", margin: "0 auto" }}
        role="img" aria-label="Labyrinth map scroll">
        <defs>
          <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a5a2b" />
            <stop offset="45%" stopColor="#c08a4f" />
            <stop offset="100%" stopColor="#5a3518" />
          </linearGradient>
          <radialGradient id={`${uid}-age`} cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor="#7a5226" stopOpacity="0" />
            <stop offset="100%" stopColor="#7a5226" stopOpacity="0.55" />
          </radialGradient>
          {/* Paper grain. */}
          <filter id={`${uid}-paper`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="3" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.28  0 0 0 0 0.12  0 0 0 0.5 -0.12" result="grain" />
            <feComposite in="grain" in2="SourceGraphic" operator="in" result="spots" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="spots" /></feMerge>
          </filter>
          {/* A slight wobble, so the ink looks hand-drawn. */}
          <filter id={`${uid}-ink`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <clipPath id={`${uid}-sheet`}>
            <rect x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP} />
          </clipPath>
          {/* Torchlight: clear in the middle, fading out at the edge. */}
          <radialGradient id={`${uid}-light`}>
            <stop offset="70%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor="#ffb257" stopOpacity="0.35" />
            <stop offset="65%" stopColor="#ff9a3c" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff9a3c" stopOpacity="0" />
          </radialGradient>
          {/* Fog of war: everything but the light. */}
          <mask id={`${uid}-fogmask`} maskUnits="userSpaceOnUse" x={view.x} y={view.y} width={view.w} height={view.h}>
            <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="white" />
            <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS + 3} fill={`url(#${uid}-hole)`}>{flicker(SIGHT_RADIUS + 3)}</circle>
          </mask>
          <radialGradient id={`${uid}-hole`}>
            <stop offset="65%" stopColor="black" />
            <stop offset="100%" stopColor="white" />
          </radialGradient>
          {/* Corridors only show near the flame. */}
          <mask id={`${uid}-lit`} maskUnits="userSpaceOnUse" x={view.x} y={view.y} width={view.w} height={view.h}>
            <circle cx={here.x} cy={here.y} r={SIGHT_RADIUS + 3} fill={`url(#${uid}-light)`}>{flicker(SIGHT_RADIUS + 3)}</circle>
          </mask>
          <filter id={`${uid}-fog`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" result="cloud" />
            <feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.11  0 0 0 0 0.06  0 0 0 0.5 0.55" />
          </filter>
        </defs>

        {/* Parchment. */}
        <rect x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP} fill={PAPER} filter={`url(#${uid}-paper)`} />
        <rect x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP} fill={`url(#${uid}-age)`} />

        {/* Your torch's glow. */}
        <circle clipPath={`url(#${uid}-sheet)`} cx={here.x} cy={here.y} r={SIGHT_RADIUS + 3} fill={`url(#${uid}-glow)`}>{flicker(SIGHT_RADIUS + 3)}</circle>

        {/* Corridors near the flame: dashed ink, the ways on darker. */}
        <g filter={`url(#${uid}-ink)`} mask={`url(#${uid}-lit)`}>
          {corridors.filter(([a, b]) => !isWalked(a, b)).map(([a, b]) => {
            const on = isWayOn(a, b);
            return (
              <line key={`c-${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={INK} strokeWidth={on ? 1.1 : 0.7} strokeDasharray="2.2 1.6" strokeOpacity={on ? 0.95 : 0.6} strokeLinecap="round" />
            );
          })}
        </g>

        {/* Fog of war over everything outside the light. */}
        <rect clipPath={`url(#${uid}-sheet)`} x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP}
          filter={`url(#${uid}-fog)`} mask={`url(#${uid}-fogmask)`} />

        <g filter={`url(#${uid}-ink)`}>
          {/* Your route, in red. */}
          {corridors.filter(([a, b]) => isWalked(a, b)).map(([a, b]) => (
            <line key={`w-${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={RED_INK} strokeWidth={1.3} strokeLinecap="round" />
          ))}

          {/* Rooms. */}
          {all.map((n) => {
            const look = roomLook(n, known);
            const isKnown = known.has(n.id);
            const been = visited.has(n.id) && n.id !== pos;
            const boss = n.kind === "boss";
            const r = boss ? R + 2 : R;
            const sw = SWORDS[n.kind];
            const lit = distance(n, here) <= SIGHT_RADIUS;
            return (
              <g key={`r-${n.id}`} opacity={lit || boss ? 1 : 0.8}>
                <circle cx={n.x} cy={n.y} r={r} fill={been ? "#d6bd86" : "#f2e3bb"} stroke={boss ? RED_INK : INK} strokeWidth={boss ? 1.1 : 0.8} />
                {boss && <circle cx={n.x} cy={n.y} r={r + 1.6} fill="none" stroke={RED_INK} strokeWidth={0.4} />}
                {isKnown && sw ? (
                  <g transform={`translate(${n.x - 5} ${n.y - 5}) scale(0.42)`} opacity={been ? 0.45 : 1}><Swords color={sw.ink} /></g>
                ) : isKnown ? (
                  <text x={n.x} y={n.y + 0.4} textAnchor="middle" dominantBaseline="middle" fontSize={boss ? 7 : 5.4} opacity={been ? 0.45 : 1}>{look.icon}</text>
                ) : (
                  <text x={n.x} y={n.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontFamily={SERIF} fontWeight={700} fill={INK} opacity={0.8}>?</text>
                )}
                {been && <path d={`M${n.x - 3} ${n.y - 3} L${n.x + 3} ${n.y + 3} M${n.x + 3} ${n.y - 3} L${n.x - 3} ${n.y + 3}`} stroke={RED_INK} strokeWidth={0.7} opacity={0.6} />}
              </g>
            );
          })}
        </g>

        <text x={map.nodes[map.boss].x} y={map.nodes[map.boss].y + R + 6.5} textAnchor="middle" fontSize={4} fontFamily={SERIF} fontStyle="italic" fill={RED_INK}>the lair</text>
        <text x={map.nodes[map.start].x} y={map.nodes[map.start].y + R + 4.6} textAnchor="middle" fontSize={3.4} fontFamily={SERIF} fontStyle="italic" fill={INK}>entrance</text>

        {/* Compass. */}
        <g transform={`translate(${MAP_W - 2} 6)`} fill={INK} fontFamily={SERIF}>
          <path d="M0 -4 L1.4 1.5 L0 0.6 L-1.4 1.5 Z" />
          <text y={-5} textAnchor="middle" fontSize={3.4} fontWeight={700}>N</text>
        </g>

        {/* Where you can go. */}
        {choices.map((n) => {
          const go = () => onEnter?.(n.id);
          return (
            <g key={`go-${n.id}`} onClick={go} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`Go to: ${corridorLabel(run, n)}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(); }}>
              <title>{corridorLabel(run, n)}</title>
              <circle cx={n.x} cy={n.y} r={R + 3} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={R + 1.8} fill="none" stroke={RED_INK} strokeWidth={0.9}>
                <animate attributeName="r" values={`${R + 1.4};${R + 2.6};${R + 1.4}`} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.35;1;0.35" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* You. */}
        <circle cx={here.x} cy={here.y} r={R + 1.6} fill="none" stroke={RED_INK} strokeWidth={1.3} />

        {roller(TOP)}
        {roller(BOTTOM)}
      </svg>

      {onEnter && choices.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
          {choices.map((n) => {
            const isKnown = known.has(n.id);
            return (
              <button key={n.id} className="card-btn" onClick={() => onEnter(n.id)}
                style={{ display: "block", textAlign: "center", padding: "10px 4px", borderColor: RED_INK }}>
                <div style={{ fontSize: 22, fontFamily: SERIF, fontWeight: 700, color: "#e9d6a6" }}>{isKnown ? <RoomIcon kind={n.kind} size={24} /> : "?"}</div>
                <div className="pixel-font" style={{ fontSize: 13, color: "#f1d9a0" }}>{corridorLabel(run, n)}</div>
              </button>
            );
          })}
        </div>
      )}
      {onEnter && choices.length === 0 && run.current && <p style={{ fontSize: 12, color: MUTED, textAlign: "center" }}>Finish this room to move on.</p>}
    </div>
  );
}
