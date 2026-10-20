"use client";
// components/DungeonMapView.tsx
// The labyrinth as a map scroll: every room is inked on old parchment, but
// what's in a room is a "?" until you know it. A few rooms are marked from
// the start; rooms near where you've stood fill in as you go (mysteries stay
// "?" until you walk in). Fog of war covers everything outside your
// torchlight (and any spot a flare or a clairvoyance scroll lit), and the
// corridors only show up close to the flame. Your route is traced in red.
// Rooms you can walk to pulse: tap one. The corridors from the entrance to
// the first and second rooms are always inked. Fights are marked with
// crossed swords: ink for a creature den, red for a lurking brute. Large
// rooms are drawn bigger, with a second ring.
//
// The scroll is bigger than the window: drag it (or scroll) to look around.
// It opens on where you stand.
// onPick: a clairvoyance scroll is being read — tap any room to look into it.

import { useId, useLayoutEffect, useRef } from "react";
import { ROOM_INFO, runPosition, nextRooms, type DungeonRun } from "@/lib/dungeon/run";
import { MAP_W, MAP_H, SIGHT_RADIUS, litRadius, distance, heading, knownRooms, linkKey, type MapNode } from "@/lib/dungeon/map";
import type { RoomKind } from "@/lib/dungeon/run";

const R = 5.6;              // room radius (map units)
const LARGE_R = R * 1.8;    // a large room's
const INK = "#4a2f17";
const RED_INK = "#9b2a1d";
const PAPER = "#e9d6a6";
const SERIF = "Georgia, 'Times New Roman', serif";
const VISIBLE_W = 100;      // map units across the window (the scroll is wider: drag to see the rest)
const PAN_HOLD = 600;       // ms the scroll rests on the lair before panning down to the entrance
const PAN_MS = 2600;        // ms the pan takes
const panned = new Set<string>(); // runs whose opening pan has played

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

const knownOf = (run: DungeonRun) => knownRooms(run.map, run.path, run.lit, run.seen);

// What a room looks like on your scroll: "?" until you know what's there.
export function roomLook(n: MapNode, known: Set<string>) {
  return known.has(n.id) ? ROOM_INFO[n.kind] : { name: n.large ? "Unknown large room" : "Unknown room", icon: "?" };
}

// A choice of where to go next, named if you know what's there.
export function corridorLabel(run: DungeonRun, n: MapNode): string {
  if (knownOf(run).has(n.id)) return ROOM_INFO[n.kind].name;
  return `Unknown ${n.large ? "large room" : "room"} (${heading(run.map.nodes[runPosition(run)], n)})`;
}

const flicker = (base: number) => (
  <animate attributeName="r" values={`${base};${base + 1.4};${base - 0.8};${base + 0.9};${base}`} dur="1.4s" repeatCount="indefinite" />
);

export default function DungeonMapView({ run, onEnter, onPick }: { run: DungeonRun; onEnter?: (nodeId: string) => void; onPick?: (nodeId: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const { map } = run;
  const pos = runPosition(run);
  const here = map.nodes[pos];
  const visited = new Set(run.path);
  const known = knownOf(run);
  const choices = onEnter && !onPick ? nextRooms(run) : [];
  const choiceIds = new Set(choices.map((n) => n.id));
  const all = Object.values(map.nodes);
  const corridors = all.flatMap((a) => a.links.filter((b) => a.id < b).map((b) => [a, map.nodes[b]] as const));
  const walked = new Set(run.path.slice(1).map((id, i) => [run.path[i], id].sort().join("|")));
  const isWalked = (a: MapNode, b: MapNode) => walked.has([a.id, b.id].sort().join("|"));
  const marked = new Set(map.knownLinks ?? []); // corridors inked on the scroll from the start
  const isMarked = (a: MapNode, b: MapNode) => marked.has(linkKey(a.id, b.id));
  const isWayOn = (a: MapNode, b: MapNode) => (a.id === pos && choiceIds.has(b.id)) || (b.id === pos && choiceIds.has(a.id));
  // Light: your torch, and anywhere a flare or a clairvoyance scroll lit (a flare reaches further).
  const lit = (run.lit ?? []).filter((id) => map.nodes[id]);
  const lights = [
    ...(lit.includes(pos) ? [] : [{ ...here, r: SIGHT_RADIUS }]),
    ...lit.map((id) => ({ ...map.nodes[id], r: litRadius(id, run.seen) })),
  ];
  const inLight = (n: MapNode) => lights.some((l) => distance(n, l) <= l.r);

  // The scroll: parchment between two wooden rollers.
  const PAD_X = 7, TOP = -9, BOTTOM = (map.h ?? MAP_H) + 9;
  const view = { x: -PAD_X - 4, y: TOP - 8, w: MAP_W + 2 * PAD_X + 8, h: BOTTOM - TOP + 16 };
  const roller = (y: number) => (
    <g>
      <rect x={-PAD_X - 4} y={y - 3.6} width={MAP_W + 2 * PAD_X + 8} height={7.2} rx={3.6} fill={`url(#${uid}-wood)`} stroke="#2a1708" strokeWidth={0.5} />
      <circle cx={-PAD_X - 4} cy={y} r={3.2} fill="#5a3518" stroke="#2a1708" strokeWidth={0.5} />
      <circle cx={MAP_W + PAD_X + 4} cy={y} r={3.2} fill="#5a3518" stroke="#2a1708" strokeWidth={0.5} />
    </g>
  );

  // The window onto the scroll: opens on where you stand; drag to look around.
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const small = !map.h || map.h < 200; // a short scroll (the first quest's) fits the window as it is
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const centre = (n: MapNode) => [
      ((n.x - view.x) / view.w) * el.scrollWidth - el.clientWidth / 2,
      ((n.y - view.y) / view.h) * el.scrollHeight - el.clientHeight / 2,
    ];
    const [toX, toY] = centre(here);
    // A fresh run: the scroll opens at the lair and pans down to the entrance
    // (once per run; touching the scroll stops it).
    const lair = map.nodes[map.boss];
    if (run.path.length === 1 && !small && lair && !panned.has(run.id)) {
      panned.add(run.id);
      const [fromX, fromY] = centre(lair);
      const t0 = performance.now();
      let frame = 0;
      const step = (now: number) => {
        const k = Math.min(1, Math.max(0, now - t0 - PAN_HOLD) / PAN_MS);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in and out
        el.scrollLeft = fromX + (toX - fromX) * e;
        el.scrollTop = fromY + (toY - fromY) * e;
        if (k < 1) frame = requestAnimationFrame(step);
      };
      const stop = () => cancelAnimationFrame(frame);
      el.addEventListener("pointerdown", stop);
      el.addEventListener("wheel", stop, { passive: true });
      frame = requestAnimationFrame(step);
      return () => { stop(); el.removeEventListener("pointerdown", stop); el.removeEventListener("wheel", stop); };
    }
    el.scrollLeft = toX;
    el.scrollTop = toY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const tap = (fn: () => void) => () => { if (!drag.current?.moved) fn(); };

  return (
    <div ref={box} className="map-window"
      style={small ? undefined : { height: "min(62vh, 560px)", overflow: "auto", cursor: "grab", touchAction: "pan-x pan-y", borderRadius: 6, background: "#1d140b" }}
      onPointerDown={(e) => {
        if (small || e.pointerType !== "mouse") return;
        const el = box.current!;
        drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        box.current!.scrollLeft = d.left - dx;
        box.current!.scrollTop = d.top - dy;
      }}
      onPointerUp={() => { window.setTimeout(() => { drag.current = null; }, 0); }}
      onPointerLeave={() => { drag.current = null; }}>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={small ? { width: "100%", maxWidth: 400, display: "block", margin: "0 auto" } : { width: `${(view.w / VISIBLE_W) * 100}%`, display: "block" }}
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
            {lights.map((l) => <circle key={l.id} cx={l.x} cy={l.y} r={l.r + 3} fill={`url(#${uid}-hole)`}>{flicker(l.r + 3)}</circle>)}
          </mask>
          <radialGradient id={`${uid}-hole`}>
            <stop offset="65%" stopColor="black" />
            <stop offset="100%" stopColor="white" />
          </radialGradient>
          {/* Corridors only show near the flame. */}
          <mask id={`${uid}-lit`} maskUnits="userSpaceOnUse" x={view.x} y={view.y} width={view.w} height={view.h}>
            {lights.map((l) => <circle key={l.id} cx={l.x} cy={l.y} r={l.r + 3} fill={`url(#${uid}-light)`}>{flicker(l.r + 3)}</circle>)}
          </mask>
          <filter id={`${uid}-fog`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" result="cloud" />
            <feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.11  0 0 0 0 0.06  0 0 0 0.5 0.55" />
          </filter>
        </defs>

        {/* Parchment. */}
        <rect x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP} fill={PAPER} filter={`url(#${uid}-paper)`} />
        <rect x={-PAD_X} y={TOP} width={MAP_W + 2 * PAD_X} height={BOTTOM - TOP} fill={`url(#${uid}-age)`} />

        {/* Your torch's glow (and any flare's). */}
        {lights.map((l) => <circle key={l.id} clipPath={`url(#${uid}-sheet)`} cx={l.x} cy={l.y} r={l.r + 3} fill={`url(#${uid}-glow)`}>{flicker(l.r + 3)}</circle>)}

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
          {/* Corridors marked on the scroll from the start: dashed ink, out in the dark too. */}
          {corridors.filter(([a, b]) => isMarked(a, b) && !isWalked(a, b)).map(([a, b]) => (
            <line key={`m-${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={INK} strokeWidth={0.8} strokeDasharray="2.2 1.6" strokeOpacity={0.75} strokeLinecap="round" />
          ))}
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
            const r = boss ? R + 2 : n.large ? LARGE_R : R;
            const sw = SWORDS[n.kind];
            const k = n.large ? 1.6 : 1; // a large room's marks are bigger too
            return (
              <g key={`r-${n.id}`} opacity={inLight(n) || boss || n.large ? 1 : 0.8}>
                <circle cx={n.x} cy={n.y} r={r} fill={been ? "#d6bd86" : "#f2e3bb"} stroke={boss ? RED_INK : INK} strokeWidth={boss || n.large ? 1.1 : 0.8} />
                {(boss || n.large) && <circle cx={n.x} cy={n.y} r={r + 1.6} fill="none" stroke={boss ? RED_INK : INK} strokeWidth={0.4} strokeDasharray={n.large ? "1.2 1" : undefined} />}
                {isKnown && sw ? (
                  <g transform={`translate(${n.x - 5} ${n.y - 5}) scale(0.42)`} opacity={been ? 0.45 : 1}><Swords color={sw.ink} /></g>
                ) : isKnown ? (
                  <text x={n.x} y={n.y + 0.4} textAnchor="middle" dominantBaseline="middle" fontSize={(boss ? 7 : 5.4) * k} opacity={been ? 0.45 : 1}>{look.icon}</text>
                ) : (
                  <text x={n.x} y={n.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={7 * k} fontFamily={SERIF} fontWeight={700} fill={INK} opacity={0.8}>?</text>
                )}
                {n.large && (
                  <text x={n.x} y={n.y + r + 4.2} textAnchor="middle" fontSize={3.4} fontFamily={SERIF} fontStyle="italic" fill={INK}>
                    {isKnown ? look.name.toLowerCase() : "a large room"}
                  </text>
                )}
                {been && <path d={`M${n.x - 3} ${n.y - 3} L${n.x + 3} ${n.y + 3} M${n.x + 3} ${n.y - 3} L${n.x - 3} ${n.y + 3}`} stroke={RED_INK} strokeWidth={0.7} opacity={0.6} />}
              </g>
            );
          })}
        </g>

        {!map.quest && <text x={map.nodes[map.boss].x} y={map.nodes[map.boss].y + R + 6.5} textAnchor="middle" fontSize={4} fontFamily={SERIF} fontStyle="italic" fill={RED_INK}>the lair</text>}
        <text x={map.nodes[map.start].x} y={map.nodes[map.start].y + R + 4.6} textAnchor="middle" fontSize={3.4} fontFamily={SERIF} fontStyle="italic" fill={INK}>entrance</text>

        {/* Compass. */}
        <g transform={`translate(${MAP_W - 2} 6)`} fill={INK} fontFamily={SERIF}>
          <path d="M0 -4 L1.4 1.5 L0 0.6 L-1.4 1.5 Z" />
          <text y={-5} textAnchor="middle" fontSize={3.4} fontWeight={700}>N</text>
        </g>

        {/* Where you can go. */}
        {choices.map((n) => {
          const go = tap(() => onEnter?.(n.id));
          const r = n.large ? LARGE_R : R;
          return (
            <g key={`go-${n.id}`} onClick={go} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label={`Go to: ${corridorLabel(run, n)}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEnter?.(n.id); }}>
              <title>{corridorLabel(run, n)}</title>
              <circle cx={n.x} cy={n.y} r={r + 3} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={r + 1.8} fill="none" stroke={RED_INK} strokeWidth={0.9}>
                <animate attributeName="r" values={`${r + 1.4};${r + 2.6};${r + 1.4}`} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.35;1;0.35" dur="1.6s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* Reading a clairvoyance scroll: any room you can't see into yet. */}
        {onPick && all.filter((n) => !known.has(n.id) || n.mystery).filter((n) => !visited.has(n.id)).map((n) => {
          const r = n.large ? LARGE_R : R;
          return (
            <g key={`pick-${n.id}`} onClick={tap(() => onPick(n.id))} style={{ cursor: "pointer" }} role="button" tabIndex={0} aria-label="Look into this room"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPick(n.id); }}>
              <circle cx={n.x} cy={n.y} r={r + 3} fill="transparent" />
              <circle cx={n.x} cy={n.y} r={r + 1.6} fill="none" stroke="#6b3fa0" strokeWidth={0.8}>
                <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* You. */}
        <circle cx={here.x} cy={here.y} r={(here.large ? LARGE_R : R) + 1.6} fill="none" stroke={RED_INK} strokeWidth={1.3} />

        {roller(TOP)}
        {roller(BOTTOM)}
      </svg>
    </div>
  );
}
