"use client";
// components/WalkParts.tsx
// The walked Labyrinth's on-screen parts, round the 3D view (components/WalkView3D.tsx; its play in
// hooks/useWalkPlay.ts): the stick (or WASD / the arrows, and E uses what you're beside), the window
// over a campfire showing your team healing, the scroll (the treasure map), and the maps the
// Labyrinth screen shows before and between rooms. (The 2D walk view was here as WalkView.tsx till
// 2026-11-24, when the 3D view became the only one: the user, "it's now the actual game".)

import { useEffect, useMemo, useRef, useState } from "react";
import { ROCK, type Pt } from "@/lib/dungeon/floorplan";
import { layoutFloorplan, scrollMarks, foreseen, type Progress, type ScrollMark } from "@/lib/dungeon/layout";
import { fallenSoFar } from "@/lib/dungeon/torch";
import { CAMPFIRE_HEAL } from "@/lib/dungeon/campfire";
import { ROOM_INFO } from "@/lib/dungeon/run";
import type { WalkRun } from "@/lib/dungeon/walkRun";
import type { Person } from "@/lib/dungeon/people";
import type { DungeonMap } from "@/lib/dungeon/map";
import { fromRuns } from "@/lib/world/walkWorld";
import type { WalkState, Warming } from "@/lib/world/walkSim";
import { ROOM_ART } from "@/components/DungeonMapView";
import { CreatureArt } from "@/components/CreaturePortrait";
import { RARITY_COLORS } from "@/lib/items/gameHelpers";
import type { PartyMember } from "@/components/PartySlots";
import { useLeftHanded } from "@/lib/handedness";

// (Faded browns on the old paper: SCROLL_SHEET.)
const INK = { edge: "#6b4f2a", floor: "#c4a874", wall: "#5e4024", trail: "#7a4a1a", cut: "#b02a1e", mark: "#e8d6a8", text: "#3a2a14", you: "#e0483e" };

export type { WalkState };


// The stick, bottom right (above the dock's Bag; the user, 2026-11-09; bottom left in left-handed mode): press
// anywhere on the ring and drag, and you walk that way while it's held; the
// knob follows your thumb. Tap a thing to use it (the ✋ button over it was
// taken out: the user, 2026-11-09). Tapping the floor to walk works as before.
const STICK_SIZE = "min(28cqw, 120px)";
const STICK_KNOB = 0.42; // the knob's share of the ring
export function Stick({ onPush }: { onPush: (push: Pt | null) => void }) {
  const left = useLeftHanded(); // (left-handed mode: bottom left: lib/handedness.ts)
  const ring = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Pt>({ x: 0, y: 0 });
  const push = (e: React.PointerEvent) => {
    const box = ring.current!.getBoundingClientRect(), r = box.width / 2;
    let x = (e.clientX - box.left - r) / r, y = (e.clientY - box.top - r) / r;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    onPush({ x, y });
    setKnob({ x, y });
  };
  const letGo = () => { onPush(null); setKnob({ x: 0, y: 0 }); };
  const travel = ((1 - STICK_KNOB) / 2) * 100; // % of the ring the knob sits in from the edge, centred
  return (
    <div style={{ position: "absolute", ...(left ? { left: 10 } : { right: 10 }), bottom: 10, zIndex: 4 }}>
      <div ref={ring} aria-label="Walk"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); push(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) push(e); }}
        onPointerUp={letGo} onPointerCancel={letGo} onLostPointerCapture={letGo}
        style={{ position: "relative", width: STICK_SIZE, height: STICK_SIZE, borderRadius: "50%", background: "rgba(10,10,16,0.45)", border: "2px solid rgba(241,217,160,0.5)", touchAction: "none" }}>
        <span aria-hidden style={{ position: "absolute", width: `${STICK_KNOB * 100}%`, height: `${STICK_KNOB * 100}%`, left: `${travel + knob.x * travel}%`, top: `${travel + knob.y * travel}%`,
          borderRadius: "50%", background: "rgba(241,217,160,0.75)", border: "2px solid #6b4f2a", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// By a campfire: a thin bar of what the fire has left (burnt down: embers),
// then your team in a column down from the top left (under any news:
// app/dungeon/page.tsx), out of the way (the
// user, 2026-11-09), small (the size of the Abyss's five team cards), a
// health bar under each going up and a "+" rising by each one getting some.
// Taps go through it to the walk.
const WARM_CELL = 56; // px across a creature
export function Warmth({ team, warming }: { team: Omit<PartyMember, "hp">[]; warming: Warming }) {
  return (
    <div style={{ position: "absolute", left: 8, top: 60, zIndex: 3, width: WARM_CELL, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span aria-hidden style={{ fontSize: 11, filter: warming.left > 0 ? undefined : "grayscale(1) brightness(0.6)" }}>🔥</span>
        <span style={{ flex: 1, height: 4, background: "rgba(0,0,0,0.6)", borderRadius: 2, overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(warming.left / CAMPFIRE_HEAL) * 100}%`, background: "#ff9a2e", transition: "width 0.1s linear" }} />
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {team.map((m) => {
          const hp = warming.hp[m.id] ?? 1, gets = warming.giving.includes(m.id), ko = hp <= 0;
          return (
            <div key={m.id} title={m.name} style={{ width: WARM_CELL, position: "relative" }}>
              <span style={{ position: "relative", display: "block", width: WARM_CELL, height: WARM_CELL, borderRadius: 8, border: `2px solid ${RARITY_COLORS[m.rarity].border}`, background: "rgba(10,10,16,0.75)", opacity: ko ? 0.4 : 1, filter: ko ? "grayscale(1)" : undefined, overflow: "hidden" }}>
                <CreatureArt creatureId={m.creatureId} title={m.name} />
              </span>
              <span style={{ display: "block", height: 6, marginTop: 3, background: "rgba(0,0,0,0.75)", borderRadius: 3, overflow: "hidden", boxShadow: gets ? "0 0 6px rgba(120,255,140,0.8)" : undefined }}>
                <span style={{ display: "block", height: "100%", width: `${Math.max(0, hp) * 100}%`, background: hp > 0.5 ? "#22c55e" : hp > 0.25 ? "#f5c542" : "#ef4444", transition: "width 0.1s linear" }} />
              </span>
              <span className="fire-heal" aria-hidden style={{ visibility: gets ? "visible" : "hidden", bottom: 12 }}>+</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The scroll, like a treasure map (layout.ts scrollMarks): what your torch has
// lit, your trail, a red line across each tunnel that fell in this run,
// a mark per room (crossed once cleared). A room a clairvoyance scroll looked
// into is drawn in, and the rooms it and a flare showed are marked (foreseen).
// As wide as the rooms' walls reach, scrolling up and down, opened at you
// (the user, 2026-11-06). Tap to put it away, or (onPick) tap a room to pick it.
const SCROLL_ROOM = 1 / 0.9; // zoomed out 10% past the walls, paper either side to look round (the user, 2026-11-09)
// Its paper (the user, 2026-11-09: a classic tea-stained scroll that looks like one): rolled at the top
// and bottom (PixelLab: PIXELLAB.md), cut nine ways round the map (its edges SCROLL_EDGE px of the sheet:
// top, right, bottom, left; drawn SCROLL_PX screen px a sheet px), the map scrolling between the rolls.
const SCROLL_SHEET = "/sprites/walk/scroll-frame.png", SCROLL_EDGE = [36, 12, 34, 12], SCROLL_PX = 1.6;
const SCROLL_BORDER = SCROLL_EDGE.map((e) => `${e * SCROLL_PX}px`).join(" ");
// people: who your locators find (decision 39), each shown by their icon where they stand, and nothing else.
export function WalkScroll({ map, layout, plan, known, trail, progress, cuts = [], been, here, at, cleared, lit, seen, people = [], onClose, onPick }: {
  map: DungeonMap; layout: WalkRun["layout"]; plan: ReturnType<typeof layoutFloorplan>; known: Uint8Array; trail: Pt[]; progress?: Progress; cuts?: number[];
  been: string[]; here: string | null; at?: Pt; cleared: string[]; lit?: string[]; seen?: string[]; people?: Person[]; onClose?: () => void; onPick?: (id: string) => void;
}) {
  const [shown] = useState(() => {
    // What's drawn: what you've seen, and the rooms a clairvoyance scroll looked into (walls and all).
    const drawn = known.length === plan.w * plan.h ? known.slice() : new Uint8Array(plan.w * plan.h);
    for (const id of seen ?? []) for (const f of plan.rooms[id] ?? []) {
      for (let y = Math.max(0, f.y - 1); y <= Math.min(plan.h - 1, f.y + f.h); y++) drawn.fill(1, y * plan.w + Math.max(0, f.x - 1), y * plan.w + Math.min(plan.w, f.x + f.w + 1));
    }
    const fell = new Set(!progress ? [] : fallenSoFar(plan, layout, progress, cuts, drawn));
    // A tunnel across that fell in is drawn as rock, as if there'd never been one (the user, 2026-11-09).
    const gone = new Set(layout.tunnels.filter((t) => !t.up && fell.has(t.key)).flatMap((t) => (plan.tunnels[t.key] ?? []).map((q) => q.y * plan.w + q.x)));
    const tile = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h || gone.has(y * plan.w + x) ? ROCK : plan.tiles[y * plan.w + x]);
    const isWall = (x: number, y: number) => [-1, 0, 1].some((dy) => [-1, 0, 1].some((dx) => tile(x + dx, y + dy) !== ROCK));
    const ink: { x: number; y: number; w: number; wall: boolean }[] = [];
    let left = plan.w, right = 0;
    for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) {
      if (tile(x, y) !== ROCK) { left = Math.min(left, x); right = Math.max(right, x); }
      if (!drawn[y * plan.w + x]) continue;
      const wall = tile(x, y) === ROCK;
      if (wall && !isWall(x, y)) continue;
      const run = ink[ink.length - 1];
      if (run && run.y === y && run.wall === wall && run.x + run.w === x) run.w++;
      else ink.push({ x, y, w: 1, wall });
    }
    // Tunnels up that fell in behind you this run (fallenSoFar): a red line across the middle, a tile past each side.
    const shut = layout.tunnels.filter((t) => t.up && fell.has(t.key))
      .map(({ rect: { x, y, w, h } }) => ({ x1: x - 1, y1: y + h / 2, x2: x + w + 1, y2: y + h / 2 }));
    const marks: ScrollMark[] = scrollMarks(map, layout, been, here, foreseen(map, layout, lit, seen));
    // Across: the furthest walls, with a tile of paper either side, then zoomed out (SCROLL_ROOM) for paper to spare.
    const fit = right + 3 - (left - 2), vw = fit * SCROLL_ROOM;
    return { ink, shut, marks, people: people.map((q) => ({ ...q, at: { ...q.at } })), trail: trail.slice(), x0: left - 2 - (vw - fit) / 2, vw };
  });
  // Opened at you (or your room).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current, mark = shown.marks.find((m) => m.here);
    const y = at ? (at.y + 0.5) / plan.h : mark?.y;
    if (el && y !== undefined) el.scrollTop = y * el.scrollHeight - el.clientHeight / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div onClick={onPick ? undefined : onClose} style={{ position: "absolute", inset: 0, zIndex: 5, borderStyle: "solid", borderWidth: SCROLL_BORDER,
      borderImage: `url(${SCROLL_SHEET}) ${SCROLL_EDGE.join(" ")} fill / ${SCROLL_BORDER} stretch`, imageRendering: "pixelated", background: "transparent" }}>
    <div ref={box} style={{ position: "absolute", inset: 0, overflowX: "hidden", overflowY: "auto", touchAction: "pan-y" }}>
      <svg viewBox={`${shown.x0} 0 ${shown.vw} ${plan.h}`} style={{ display: "block", width: "100%", aspectRatio: `${shown.vw} / ${plan.h}` }}>
        {shown.ink.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={1.05} fill={r.wall ? INK.wall : INK.floor} />)}
        {shown.shut.map((l, i) => <line key={i} {...l} stroke={INK.cut} strokeWidth={0.9} strokeLinecap="round" />)}
        <polyline points={shown.trail.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ")} fill="none" stroke={INK.trail} strokeWidth={0.7} strokeDasharray="1.2 1.2" strokeLinejoin="round" />
        {shown.marks.map((m) => {
          const x = m.x * plan.w, y = m.y * plan.h, art = m.kind && ROOM_ART[m.kind];
          return (
            <g key={m.id} onClick={onPick ? () => onPick(m.id) : undefined} style={{ cursor: onPick ? "pointer" : undefined }}>
              {onPick && <circle cx={x} cy={y} r={6} fill="transparent" />}
              <circle cx={x} cy={y} r={3.6} fill={INK.mark} stroke={m.here ? INK.you : INK.edge} strokeWidth={m.here ? 0.9 : 0.5} />
              {art
                ? <image href={art} x={x - 2.6} y={y - 2.6} width={5.2} height={5.2} style={{ imageRendering: "pixelated" }} />
                : <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fontWeight="bold" fill={INK.text}>{m.kind ? ROOM_INFO[m.kind].icon : "?"}</text>}
              {cleared.includes(m.id) && <path d={`M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`} stroke={INK.cut} strokeWidth={0.9} />}
            </g>
          );
        })}
        {shown.people.map((q) => (
          <g key={q.id}>
            <circle cx={q.at.x + 0.5} cy={q.at.y + 0.5} r={3.6} fill={INK.mark} stroke={INK.you} strokeWidth={0.9} strokeDasharray="1.4 0.8" />
            <text x={q.at.x + 0.5} y={q.at.y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={4.2} fill={INK.text}>{ROOM_INFO[q.kind].icon}</text>
          </g>
        ))}
      </svg>
    </div>
    </div>
  );
}

// The scroll in a window (the Labyrinth screen's map sheet, while walking): to
// pick a room for a clairvoyance scroll (onPick), or to see what one or a
// flare showed. Your walk as last kept.
export function WalkMap({ walk, map, here, been, cleared, lit, seen, onPick }: {
  walk: WalkRun; map: DungeonMap; here: string; been: string[]; cleared: string[]; lit?: string[]; seen?: string[]; onPick?: (id: string) => void;
}) {
  const plan = useMemo(() => layoutFloorplan(walk.layout), [walk.layout]);
  return (
    <div style={{ position: "relative", width: "100%", height: "60cqh" }}>
      <WalkScroll map={map} layout={walk.layout} plan={plan} known={fromRuns(walk.known, plan.w * plan.h)} trail={walk.trail ?? [walk.at]}
        progress={{ room: walk.room, line: walk.line ?? Infinity }} cuts={walk.cuts} been={been} here={here} at={walk.at} cleared={cleared} lit={lit} seen={seen} onPick={onPick} />
    </div>
  );
}

// The map at the entrance (the Labyrinth screen's MapFirst): the scroll before
// you've walked anywhere, its marks only (no rooms or tunnels drawn yet).
export function WalkFirstMap({ walk, map }: { walk: WalkRun; map: DungeonMap }) {
  const plan = useMemo(() => layoutFloorplan(walk.layout), [walk.layout]);
  return (
    <div style={{ position: "relative", width: "100%", height: "45cqh", margin: "0 auto" }}>
      <WalkScroll map={map} layout={walk.layout} plan={plan} known={new Uint8Array(0)} trail={[]}
        been={[map.start]} here={map.start} cleared={[]} />
    </div>
  );
}
