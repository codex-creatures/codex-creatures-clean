"use client";
// components/SideArrow.tsx
// The previous / next buttons on the screen's sides (a creature's window, a codex's): a pixel
// chevron drawn square by square on a brass button. They sit where the screen's middle third
// meets its bottom third, off the middle of the window you're working in (the user, 2026-11-24,
// and 2026-11-26: a bit higher than the very bottom). Press and hold either to lift both, then
// drag them up or down; the spot is kept on this device (lib/sideArrow.ts). Styles: .side-arrow
// in globals.css.

import { useRef, useState } from "react";
import { SIDE_ARROW_HOLD_MS, SIDE_ARROW_SLOP, useSideArrowAt, writeSideArrow } from "@/lib/sideArrow";

// The chevron's squares, pointing left: two thick, tip at the left, 7 wide by 11 tall.
const CELLS = Array.from({ length: 11 }, (_, r) => Math.abs(r - 5)).flatMap((d, r) => [[d, r], [d + 1, r]]);

export default function SideArrow({ dir, label, onClick }: { dir: "prev" | "next"; label: string; onClick: (e: React.MouseEvent) => void }) {
  const at = useSideArrowAt();
  const [lifted, setLifted] = useState(false);
  // A press: where it started, the hold's timer, and whether it became a drag (so its click is dropped).
  const press = useRef<{ x: number; y: number; at: number; timer: number; dragged: boolean; screenH: number } | null>(null);
  const end = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    setLifted(false);
  };
  return (
    <button className={`side-arrow ${dir}${lifted ? " lifted" : ""}`} aria-label={label} style={{ top: `${at * 100}%` }}
      onPointerDown={(e) => {
        // The screen's height as drawn (GameScreen scales it), so a drag moves the arrows with the finger.
        const screenH = (e.currentTarget.closest(".screen-scale") as HTMLElement | null)?.getBoundingClientRect().height ?? window.innerHeight;
        const p = { x: e.clientX, y: e.clientY, at, dragged: false, screenH, timer: 0 };
        const el = e.currentTarget, id = e.pointerId;
        p.timer = window.setTimeout(() => {
          p.dragged = true;
          setLifted(true);
          try { el.setPointerCapture(id); } catch { /* the press already ended */ }
        }, SIDE_ARROW_HOLD_MS);
        press.current = p;
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p) return;
        if (!p.dragged) {
          // Moved before the hold: not a hold (a swipe, or a shaky tap).
          if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > SIDE_ARROW_SLOP) window.clearTimeout(p.timer);
          return;
        }
        writeSideArrow(window.localStorage, p.at + (e.clientY - p.y) / p.screenH);
      }}
      onPointerUp={end} onPointerCancel={() => { end(); press.current = null; }}
      onContextMenu={(e) => e.preventDefault()} // (a long press would open the phone's menu)
      onClick={(e) => {
        const dragged = press.current?.dragged;
        press.current = null;
        if (dragged) { e.stopPropagation(); return; }
        onClick(e);
      }}>
      <svg width={21} height={33} viewBox="0 0 8 12" shapeRendering="crispEdges" aria-hidden
        style={{ transform: dir === "next" ? "scaleX(-1)" : undefined }}>
        {CELLS.map(([x, y]) => <rect key={`s${x},${y}`} x={x + 1} y={y + 1} width={1} height={1} fill="#1c140b" />)}
        {CELLS.map(([x, y]) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill="#f1d9a0" />)}
      </svg>
    </button>
  );
}
