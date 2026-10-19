"use client";
// hooks/useDragDrop.tsx
// Drag and drop for touch and mouse: press on something, drag it, and let go
// over a drop target (any element with data-drop="<name>"). A ghost of what
// you're dragging follows your finger. Small moves (under 8px) are taps.
// - press(payload, look): spread its result on the thing you can pick up,
//   together with handlers.
// - box: a callback ref for the positioned element (fixed or relative) the
//   ghost is drawn in (destructure it: `const { box, ...dnd } = useDragDrop()`);
//   the ghost goes inside it, as {ghost}.
// - onDrop(payload, target): target is the data-drop name under the finger
//   (null if none). onTap(payload): it was a tap, not a drag.

import { useRef, useState } from "react";
import type { Sprite } from "@/lib/sprites/pixels";
import PixelSprite from "@/components/PixelSprite";
import { ICON } from "@/components/ContainerLoot";

export type DragLook = { sprite?: Sprite; icon?: string };
export type Dragging<T> = DragLook & { payload: T; x: number; y: number; sx: number; sy: number; ox: number; oy: number; on: boolean };

// What's under a point (the ghost doesn't catch the pointer).
export const dropTargetAt = (x: number, y: number) =>
  (document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null)?.dataset.drop ?? null;

export function useDragDrop<T>({ onDrop, onTap }: { onDrop: (payload: T, target: string | null) => void; onTap?: (payload: T) => void }) {
  const [drag, setDrag] = useState<Dragging<T> | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [box, setBox] = useState<HTMLElement | null>(null); // (a callback ref: pass setBox as ref=)
  // Read and written in the pointer handlers: the drag as it is right now, and
  // whether the last press was a drag (so the click that follows it is ignored).
  const live = useRef({ drag: null as Dragging<T> | null, dragged: false }).current;

  const press = (payload: T, look: DragLook) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    live.dragged = false;
    const r = box?.getBoundingClientRect();
    const d = { payload, ...look, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, ox: r?.left ?? 0, oy: r?.top ?? 0, on: false };
    live.drag = d; setDrag(d);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = live.drag;
    if (!d) return;
    const on = d.on || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8;
    const next = { ...d, x: e.clientX, y: e.clientY, on };
    live.drag = next; setDrag(next);
    if (on) setOver(dropTargetAt(e.clientX, e.clientY));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = live.drag;
    live.drag = null; setDrag(null); setOver(null);
    if (!d) return;
    if (!d.on) { onTap?.(d.payload); return; }
    live.dragged = true;
    onDrop(d.payload, dropTargetAt(e.clientX, e.clientY));
  };
  const onPointerCancel = () => { live.drag = null; setDrag(null); setOver(null); };

  const ghost = drag?.on ? (
    <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 64, height: 64, pointerEvents: "none", zIndex: 300,
      transform: `translate(${drag.x - drag.ox - 32}px, ${drag.y - drag.oy - 44}px) scale(1.15)`, filter: "drop-shadow(0 6px 6px rgba(0,0,0,0.6))",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      {drag.sprite ? <PixelSprite sprite={drag.sprite} scale={4} style={ICON} /> : <span style={{ fontSize: 32 }}>{drag.icon}</span>}
    </div>
  ) : null;

  return {
    drag, over, box: setBox, press, ghost,
    handlers: { onPointerMove, onPointerUp, onPointerCancel },
    // Was the last press a drag? (a click straight after one should do nothing)
    wasDrag: () => live.dragged,
    // What's being dragged right now (only once it has moved).
    lifted: drag?.on ? drag.payload : undefined,
  };
}
