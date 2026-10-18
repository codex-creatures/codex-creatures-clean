"use client";
// components/DungeonRoomView.tsx
// The room you're standing in: a painted chamber (PixelLab art in
// public/sprites/rooms, one of a few themes) with a tunnel for every way on,
// west to east. You can't tell what's down a tunnel (that's what the map at
// the entrance was for). Once the room is dealt with, tap a tunnel to walk
// down it. What's in the room (enemies, a chest, a merchant…) stands on the
// floor in the middle.
// - The painting was made over the code-drawn chamber (lib/dungeon/chamber.ts),
//   so the chamber's tunnels line up with it: it still decides what a tap
//   hits, and draws the moving parts on top (drips, mist, eyes in the dark,
//   the healing pool, the hovered tunnel). With no painting for a room (or
//   while one fails to load) the chamber draws the whole room itself.
// - A den with several creatures (and the boss's lair) is a large room: the
//   back wall further off, more floor.
// - Everything standing in the room is drawn at the same pixel size as the
//   room itself, so a big creature looks big and a bat looks small.
// Some things on the floor can be tapped (onObject): Klutz's club, a chest,
// the box the thief dropped. A fight waiting here gets a big Fight! button
// at the bottom (onFight), and its creatures can be tapped for their cards
// (onEnemies).

import { useEffect, useMemo, useRef, useState } from "react";
import { ROOM_INFO, runPosition, isFight, type DungeonRun, type RoomKind } from "@/lib/dungeon/run";
import { waysOn } from "@/lib/dungeon/map";
import { createChamber, CW, CH, type Chamber, type ChamberSize, type ChamberView, type TunnelLook } from "@/lib/dungeon/chamber";
import { spriteWidth } from "@/lib/sprites/pixels";
import { artFor } from "@/lib/sprites/art";
import PixelSprite, { creatureSprite } from "./PixelSprite";
import { WEAPON_SPRITES } from "@/lib/sprites/items";
import { TREASURE_CHEST, TREASURE_CHEST_OPEN, ARMOURY_BOX, BURLAP_SACK, BURLAP_SACK_OPEN, RICKETY_CHEST, RICKETY_CHEST_OPEN, MERCHANT, LIBRARIAN, CARD_WITCH, TREASURE_PILE, CARD_DECK, HEALING_POOL } from "@/lib/sprites/props";
import type { Sprite } from "@/lib/sprites/pixels";

const FPS = 12;

// Who (or what) stands in the rooms that aren't fights or chests.
const WANDERERS: Partial<Record<RoomKind, Sprite>> = { merchant: MERCHANT, librarian: LIBRARIAN, witch: CARD_WITCH, treasure: TREASURE_PILE, cards: CARD_DECK };

// The painted rooms: public/sprites/rooms/<theme>-<size>-<tunnels>.png.
const THEMES = ["hall", "crypt", "cave"] as const;
const PAINTED_TUNNELS = 3; // paintings exist for 1–3 tunnels
// Those painted (at the creatures' own pixel size) for the far camera, in rooms/far.
const FAR_PAINTED = new Set([
  ...["hall", "crypt", "cave"].flatMap((t) => ["normal", "large"].flatMap((s) => [1, 2, 3].map((n) => `${t}-${s}-${n}`))),
  "lair-large-1",
]);

// How big things in the room are drawn, against the room's own pixels (a
// large room is further off, so a little smaller).
const STAND_SCALE: Record<ChamberView, Record<ChamberSize, number>> = {
  close: { normal: 1.2, large: 0.95 },
  far: { normal: 1.0, large: 0.85 }, // (painted at the creatures' own pixel size)
};
// …but nothing stands taller than this share of the room (the big creatures
// would tower over the tunnels), and a row of creatures never fills more
// than ROW_FILL of the room's width.
const MAX_TALL: Record<ChamberSize, number> = { normal: 0.3, large: 0.25 };
const BOSS_TALL = 0.4;
const ROW_FILL = 0.8;

// A short stable number from a room id, so each room looks a bit different.
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// A sprite's width in fine pixels (art as drawn, a grid sprite at 2 fine pixels a cell).
const fineWidth = (s: Sprite) => { const a = artFor(s); return a ? (a.size ?? a.w) : spriteWidth(s) * 2; };
const fineHeight = (s: Sprite) => { const a = artFor(s); return a ? a.h * ((a.size ?? a.w) / a.w) : s.length * 2; };

export default function DungeonRoomView({ run, open, onGo, onObject, onFight, onEnemies }: {
  run: DungeonRun; open: boolean; onGo: (nodeId: string) => void; onObject?: () => void; onFight?: () => void; onEnemies?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chamberRef = useRef<Chamber | null>(null);
  const hoverRef = useRef(0);
  const openRef = useRef(open);
  const [hover, setHover] = useState(0);
  openRef.current = open;

  const pos = runPosition(run);
  const node = run.map.nodes[pos];
  const ways = [...waysOn(run.map, pos)].sort((a, b) => a.x - b.x); // west to east
  // Every tunnel looks the same from here. A dead end (the thief's room, a
  // lair) still has a dark way out — it just doesn't lead anywhere you can go.
  const looks: TunnelLook[] = ways.length ? ways.map(() => "unknown") : ["unknown"];
  const room = run.current;
  const pool = node.kind === "pool" ? (room && !room.done ? "glow" : "still") : undefined;
  const size: ChamberSize = room?.boss || (room?.enemies?.length ?? 0) >= 2 ? "large" : "normal";
  // The boss's room is always its lair.
  const theme = (room?.kind === "boss" || node.kind === "boss") && looks.length === 1 ? "lair" : THEMES[seedOf(pos) % THEMES.length];
  // Rooms repainted for the far camera live in rooms/far (see FAR_PAINTED); the
  // rest still have their first painting, made for the close camera.
  const name = `${theme}-${size}-${looks.length}`;
  const view: ChamberView = FAR_PAINTED.has(name) || looks.length > PAINTED_TUNNELS ? "far" : "close";
  const painting = looks.length <= PAINTED_TUNNELS ? `/sprites/rooms/${view === "far" ? "far/" : ""}${name}.png` : null;
  const [painted, setPainted] = useState<string | null>(null); // the painting that's loaded
  const usePainting = !!painting && painted === painting;
  const key = `${pos}|${looks.join(",")}|${pool ?? ""}|${size}|${view}`;

  const chamber = useMemo(() => createChamber({ tunnels: looks, pool, seed: seedOf(pos), size, view }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);

  // Load the painting (if this room has one); until then the chamber draws the room.
  useEffect(() => {
    if (!painting) return;
    const img = new Image();
    img.onload = () => setPainted(painting);
    img.src = painting;
  }, [painting]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    chamberRef.current = chamber;
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      ctx.putImageData(usePainting ? chamber.overlay(t, hoverRef.current, openRef.current) : chamber.render(t, hoverRef.current, openRef.current), 0, 0);
    };
    draw();
    const timer = window.setInterval(draw, 1000 / FPS);
    return () => window.clearInterval(timer);
  }, [chamber, usePainting]);

  function tunnelAt(e: React.PointerEvent | React.MouseEvent): number {
    const c = canvasRef.current, ch = chamberRef.current;
    if (!c || !ch) return 0;
    const r = c.getBoundingClientRect();
    return ch.idAt(((e.clientX - r.left) / r.width) * CW, ((e.clientY - r.top) / r.height) * CH);
  }
  function setHovered(id: number) {
    if (id > 0 && !ways[id - 1]) id = 0; // (a dead end's tunnel goes nowhere)
    hoverRef.current = id;
    setHover(id);
  }
  function go(id: number) {
    if (open && id > 0 && ways[id - 1]) onGo(ways[id - 1].id);
  }

  const title = pos === run.map.start && !room ? "The entrance"
    : room?.quest === "club" ? "A dropped club" : room?.quest === "thief" ? "The thief" : ROOM_INFO[node.kind].name;

  return (
    <div className="room-frame" style={{ position: "relative", width: "100%", maxWidth: 518, margin: "0 auto", aspectRatio: `${CW} / ${CH}`, overflow: "hidden" }}>
      {usePainting && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={painting!} alt="" draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }} />
          <div className="room-light" aria-hidden />
          <div className="room-vignette" aria-hidden />
        </>
      )}
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        onPointerMove={(e) => setHovered(tunnelAt(e))}
        onPointerLeave={() => setHovered(0)}
        onClick={(e) => go(tunnelAt(e))}
        style={{ position: "relative", width: "100%", height: "100%", imageRendering: "pixelated", cursor: open && hover ? "pointer" : "default", display: "block" }}
        aria-label={`${title}: a dark chamber with ${ways.length} tunnel${ways.length === 1 ? "" : "s"} leading on`}
        role="img"
      />

      {/* Where you are. */}
      <div className="pixel-font room-title">{title}</div>

      {/* What's in the room. */}
      <RoomContents run={run} size={size} view={view} onObject={onObject} onEnemies={onEnemies} />

      {onFight && <button className="fight-btn" onClick={onFight}>⚔️ Fight!</button>}
    </div>
  );
}

function RoomContents({ run, size, view, onObject, onEnemies }: { run: DungeonRun; size: ChamberSize; view: ChamberView; onObject?: () => void; onEnemies?: () => void }) {
  const room = run.current;
  if (!room || room.kind === "entrance") return null;
  // A row standing on the floor, across the whole room (so widths below are shares of the room).
  const at: React.CSSProperties = { position: "absolute", left: 0, width: "100%", top: "84%", transform: "translateY(-100%)", display: "flex", justifyContent: "center", gap: "2%", alignItems: "flex-end", pointerEvents: "none" };
  // How wide a sprite stands, as a share of the room: the room's own pixel
  // size, shrunk to fit under MAX_TALL (or `tall`).
  const scale = STAND_SCALE[view][size];
  const fit = (sprite: Sprite, tall = MAX_TALL[size]) => Math.min(scale, (tall * CH) / fineHeight(sprite));
  const share = (sprite: Sprite, tall?: number) => `${(fineWidth(sprite) / CW) * 100 * fit(sprite, tall)}%`;
  const draw = (sprite: Sprite, style: React.CSSProperties = {}) => (
    <PixelSprite sprite={sprite} scale={4}
      style={{ width: "100%", height: "auto", imageRendering: "pixelated", ...(artFor(sprite)?.faces === "right" ? { transform: "scaleX(-1)" } : {}), ...style }} />
  );

  // Something lying on the floor: tappable when there's something to do with it.
  const prop = (sprite: Sprite, label: string, style: React.CSSProperties = {}) => (
    <div style={at}>
      <button onClick={onObject} disabled={!onObject} aria-label={label} title={onObject ? label : undefined}
        className={onObject ? "floor-prop" : undefined}
        style={{ width: share(sprite), background: "none", border: "none", padding: 0, pointerEvents: onObject ? "auto" : "none", cursor: onObject ? "pointer" : "default", filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>
        {draw(sprite, style)}
      </button>
    </div>
  );

  // The healing pool, sunk in the floor off to one side: glowing until it's used, then dim.
  if (room.kind === "pool") {
    return (
      <div style={{ ...at, top: "94%", justifyContent: "flex-start", paddingLeft: "5%" }}>
        <div className={room.done ? undefined : "pool-glow"} style={{ width: share(HEALING_POOL), filter: room.done ? "grayscale(0.7) brightness(0.6)" : undefined }}>{draw(HEALING_POOL)}</div>
      </div>
    );
  }
  // Klutz's club, lying where the thief dropped it.
  if (room.quest === "club") return room.done ? null : prop(WEAPON_SPRITES.klutz_club, "Pick up the club", { transform: "rotate(-60deg)" });
  // The thief's box, once it's beaten.
  if (room.quest === "thief" && room.done) return room.boxTaken ? null : prop(ARMOURY_BOX, "Pick up the box");
  if (room.kind === "chest") return prop(room.done ? TREASURE_CHEST_OPEN : TREASURE_CHEST, room.done ? "An open chest" : "Open the chest");
  if (room.kind === "stash") return prop(room.opened ? BURLAP_SACK_OPEN : BURLAP_SACK, room.opened ? "An open sack" : "Open the sack");

  if (isFight(room.kind)) {
    // Beaten: what it leaves behind — a rickety chest (bosses) or a sack.
    if (room.done) {
      if (room.container === "chest") return prop(room.opened ? RICKETY_CHEST_OPEN : RICKETY_CHEST, room.opened ? "Its chest, opened" : "Loot the chest");
      if (room.container === "sack") return prop(room.opened ? BURLAP_SACK_OPEN : BURLAP_SACK, room.opened ? "Its sack, opened" : "Loot the sack");
      return null;
    }
    if (room.boss) {
      const boss = creatureSprite("cyclops");
      return (
        <div style={at}>
          <div className="boss-breathe" style={{ width: share(boss, BOSS_TALL), filter: "drop-shadow(0 0 10px rgba(255,59,42,0.7)) drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>{draw(boss)}</div>
        </div>
      );
    }
    // A row of creatures: each at the room's pixel size (capped), then all
    // shrunk together if the row would be too wide.
    const sprites = (room.enemies ?? []).map((e) => creatureSprite(e.creatureId));
    const widths = sprites.map((sp) => (fineWidth(sp) / CW) * fit(sp));
    const gaps = 0.02 * Math.max(0, sprites.length - 1);
    const squeeze = Math.min(1, (ROW_FILL - gaps) / Math.max(0.01, widths.reduce((a, b) => a + b, 0)));
    return (
      <div style={at}>
        {sprites.map((sprite, i) => (
          <button key={i} onClick={onEnemies} disabled={!onEnemies} aria-label="See their cards" title={onEnemies ? "See their cards" : undefined}
            style={{ width: `${widths[i] * squeeze * 100}%`, background: "none", border: "none", padding: 0, pointerEvents: onEnemies ? "auto" : "none", cursor: onEnemies ? "pointer" : "default" }}>
            <Standing sprite={sprite} filter="drop-shadow(0 3px 0 rgba(0,0,0,0.7)) brightness(0.92)">{draw(sprite)}</Standing>
          </button>
        ))}
      </div>
    );
  }

  // Someone (or something) waiting in the room.
  if (room.kind === "treasure" && room.done) return null; // (the gold, once taken, is gone)
  const who = WANDERERS[room.kind];
  if (who) {
    return (
      <div style={at}>
        <div style={{ width: share(who), opacity: room.done && room.kind !== "merchant" && room.kind !== "librarian" ? 0.45 : 1, filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>{draw(who)}</div>
      </div>
    );
  }

  return (
    <div style={{ ...at, fontSize: "clamp(28px, 8cqw, 46px)", opacity: room.done ? 0.4 : 1, filter: "drop-shadow(0 4px 0 rgba(0,0,0,0.7))" }}>
      {ROOM_INFO[room.kind].icon}
    </div>
  );
}

// A creature on the floor. One that floats (a wisp, a bat) hangs in the air,
// bobbing, with its shadow on the floor below.
function Standing({ sprite, filter, children }: { sprite: Sprite; filter: string; children: React.ReactNode }) {
  if (!artFor(sprite)?.floats) return <div style={{ filter }}>{children}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="float-bob" style={{ width: "100%", filter }}>{children}</div>
      <div className="float-shadow" aria-hidden style={{ width: "70%", aspectRatio: "5 / 1", marginTop: "55%" }} />
    </div>
  );
}
