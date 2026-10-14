"use client";
// components/DungeonRoomView.tsx
// The room you're standing in, as pixel art (drawn by lib/dungeon/chamber.ts):
// a damp stone chamber with a tunnel for every way on, west to east. You
// can't tell what's down a tunnel (that's what the map at the entrance was
// for). Once the room is dealt with, tap a tunnel to walk down it. What's in
// the room (enemies, a chest, a merchant…) stands on the floor in the middle.

import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_INFO, runPosition, isFight, type DungeonRun } from "@/lib/dungeon/run";
import { waysOn } from "@/lib/dungeon/map";
import { createChamber, CW, CH, type Chamber, type TunnelLook } from "@/lib/dungeon/chamber";
import PixelSprite, { creatureSprite } from "./PixelSprite";

const FPS = 12;

// A short stable number from a room id, so each room looks a bit different.
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export default function DungeonRoomView({ run, open, onGo }: { run: DungeonRun; open: boolean; onGo: (nodeId: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chamberRef = useRef<Chamber | null>(null);
  const hoverRef = useRef(0);
  const openRef = useRef(open);
  const [hover, setHover] = useState(0);
  openRef.current = open;

  const pos = runPosition(run);
  const node = run.map.nodes[pos];
  const ways = [...waysOn(run.map, pos)].sort((a, b) => a.x - b.x); // west to east
  const looks: TunnelLook[] = ways.map(() => "unknown"); // every tunnel looks the same from here
  const room = run.current;
  const pool = node.kind === "pool" ? (room && !room.done ? "glow" : "still") : undefined;
  const key = `${pos}|${looks.join(",")}|${pool ?? ""}`;

  const chamber = useMemo(() => createChamber({ tunnels: looks, pool, seed: seedOf(pos) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    chamberRef.current = chamber;
    const start = performance.now();
    const draw = () => ctx.putImageData(chamber.render((performance.now() - start) / 1000, hoverRef.current, openRef.current), 0, 0);
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [chamber]);

  function tunnelAt(e: React.PointerEvent | React.MouseEvent): number {
    const c = canvasRef.current, ch = chamberRef.current;
    if (!c || !ch) return 0;
    const r = c.getBoundingClientRect();
    return ch.idAt(((e.clientX - r.left) / r.width) * CW, ((e.clientY - r.top) / r.height) * CH);
  }
  function setHovered(id: number) {
    hoverRef.current = id;
    setHover(id);
  }
  function go(id: number) {
    if (open && id > 0 && ways[id - 1]) onGo(ways[id - 1].id);
  }

  const title = pos === run.map.start && !room ? "The entrance" : ROOM_INFO[node.kind].name;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 640, margin: "0 auto", aspectRatio: `${CW} / ${CH}`, border: "3px solid #1a1d20", boxShadow: "0 4px 0 rgba(0,0,0,0.6)" }}>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        onPointerMove={(e) => setHovered(tunnelAt(e))}
        onPointerLeave={() => setHovered(0)}
        onClick={(e) => go(tunnelAt(e))}
        style={{ width: "100%", height: "100%", imageRendering: "pixelated", cursor: open && hover ? "pointer" : "default", display: "block" }}
        aria-label={`${title}: a dark stone chamber with ${ways.length} tunnel${ways.length === 1 ? "" : "s"} leading on`}
        role="img"
      />

      {/* Where you are. */}
      <div className="pixel-font" style={{
        position: "absolute", top: "2%", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap",
        fontSize: "clamp(11px, 2.6vw, 15px)", color: "#c9d3d6", textShadow: "0 2px 0 #000", letterSpacing: "0.04em",
      }}>
        {title}
      </div>

      {/* What's in the room. */}
      <RoomContents run={run} />
    </div>
  );
}

function RoomContents({ run }: { run: DungeonRun }) {
  const room = run.current;
  if (!room || room.kind === "pool" || room.kind === "entrance") return null;
  const at: React.CSSProperties = { position: "absolute", left: "50%", top: "80%", transform: "translate(-50%, -100%)", display: "flex", gap: "3%", alignItems: "flex-end", pointerEvents: "none" };

  if (isFight(room.kind)) {
    if (room.done) return null;
    if (room.boss) {
      return (
        <div style={{ ...at, filter: "drop-shadow(0 0 10px rgba(255,59,42,0.7)) drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>
          <div className="boss-breathe"><PixelSprite sprite={creatureSprite("cyclops")} scale={4} /></div>
        </div>
      );
    }
    return (
      <div style={at}>
        {(room.enemies ?? []).map((e, i) => {
          const sprite = creatureSprite(e.creatureId);
          const w = sprite[0]?.length ?? 16;
          return (
            <div key={i} style={{ filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.7)) brightness(0.85)" }}>
              <PixelSprite sprite={sprite} scale={Math.max(3, Math.floor(56 / w))} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ ...at, fontSize: "clamp(28px, 8vw, 46px)", opacity: room.done ? 0.4 : 1, filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>
      {ROOM_INFO[room.kind].icon}
    </div>
  );
}
