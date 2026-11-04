"use client";
// components/TavernRoom.tsx
// What stands in the tavern's room, through the Den's doorway behind its
// right wall (DenRoom's annex): the tavern in the far right corner, with a ❗
// over it while someone's visiting (tap it for the tavern's window), the Cyclops Head over its door once mounted, and whoever's visiting, strolling round the room.
// In its back corner, the Sparring Pit (the Training Pit once built over it; tap
// it for its own window), with a ❗ while a level's ready. Left of it, flat
// against the back-left wall, the PvP portal (app/pvp: duels, teams, ranked).

import { useEffect, useState } from "react";
import PixelSprite from "@/components/PixelSprite";
import { RoomSpot } from "@/components/DenRoom";
import { RES, strollAt, VISITOR_PATH, VISITOR_SPEED, VISITOR_PAUSE } from "@/lib/den/scene";
import { artFor } from "@/lib/sprites/art";
import type { Sprite } from "@/lib/sprites/pixels";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { COLLECTOR, LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import { tavernVisitor, type TavernQuest } from "@/lib/tavern";

const FIT = { width: "100%", height: "auto" }; // a sprite filling its spot in the room

// The tavern's art (PixelLab), drawn 1:1 like the Den's props and at the room's
// angle: 1 floor block is 64px across, its footprint is 10×5 blocks, and its door's
// about 130px tall to Klutz's 85. CORNER: the floor spot its front corner stands
// on, and where that corner is in the picture.
const TAVERN = { src: "/sprites/den/tavern.png", w: 510, h: 486 };
const CORNER = { u: 20.5, v: 5.1, x: 336, y: 478 };
// The top of its door on the picture (px).
const DOOR = { x: 121, y: 233 };
// Lamp-light from the open door and the windows (px, radius px).
const LIGHTS = [{ x: 121, y: 345, r: 80 }, { x: 60, y: 242, r: 30 }, { x: 400, y: 347, r: 34 }];
const pct = (n: number, of: number) => `${(n / of) * 100}%`;
// The pit (lib/trainingPit.ts): the Sparring Pit, then the Training Pit built
// over it. Both pictures share one grid (PixelLab; the sand on the room's 2:1
// floor grid), drawn PIT_SCALE times 1:1 (the user, 2026-11-03), in the room's
// back corner against the right-hand wall, clear of the tavern. PIT_CORNER:
// the floor spot its front corner stands on, and where that corner is in the picture.
const PIT = { sparring: "/sprites/den/sparring-pit-3.png", training: "/sprites/den/training-pit.png", w: 224, h: 144 };
const PIT_SCALE = 1.9;
const PIT_CORNER = { u: 6.2, v: 5.6, x: 111, y: 134 };
// The PvP portal (PixelLab): a flat archway set into the room's back-left
// wall (u = 0), left of the pit (the user, 2026-11-04), drawn front-on and
// slanted here onto the wall (rising 1px every 2 across). BASE: the floor spot
// under the middle of its foot, on the wall, and where that is in the picture.
// GLOW: the swirl's middle (px), where its light pulses.
const PORTAL = { src: "/sprites/den/pvp-portal-2.png", w: 96, h: 176 };
const PORTAL_SCALE = 1.4;
const PORTAL_BASE = { u: 0.05, v: 8.6, x: 48, y: 132 };
const PORTAL_GLOW = { x: 48, y: 86 };

// firstClearRun: the run you first beat the Cyclops on (marked on the head).
// pit: the Sparring or Training Pit, once the room's open (ready: a level waits to be taken).
export default function TavernRoom({ tavern: t, firstClearRun, pit }: { tavern: TavernQuest; firstClearRun?: number; pit?: { ready: boolean } }) {
  const visitor = tavernVisitor(t);
  const news = !!visitor;
  const head = CREATURE_SPRITES.cyclops;
  return (
    <>
      {/* The PvP portal, on the back wall. */}
      {pit && (
        <RoomSpot u={PORTAL_BASE.u} v={PORTAL_BASE.v} w={(PORTAL.w * PORTAL_SCALE) / RES}
          style={{ transform: `translate(-${pct(PORTAL_BASE.x, PORTAL.w)}, -${pct(PORTAL_BASE.y, PORTAL.h)})` }}>
          <div data-href="/pvp" style={{ position: "relative", pointerEvents: "auto" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PORTAL.src} alt="The PvP portal" draggable={false}
              style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated", filter: "drop-shadow(0 0 4px rgba(200, 90, 255, 0.55))" }} />
            <div aria-hidden className="portal-glow"
              style={{ left: pct(PORTAL_GLOW.x, PORTAL.w), top: pct(PORTAL_GLOW.y, PORTAL.h), width: "90%", aspectRatio: "1", background: "radial-gradient(circle, rgba(220, 110, 255, 0.45), rgba(150, 70, 255, 0.15) 45%, transparent 70%)" }} />
            <div className="pixel-font"
              style={{ position: "absolute", left: "50%", bottom: "100%", translate: "-50% 0", width: "max-content", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
              PvP Portal
            </div>
          </div>
        </RoomSpot>
      )}
      {/* The pit, drawn first: it stands behind the tavern. */}
      {pit && (
        <RoomSpot u={PIT_CORNER.u} v={PIT_CORNER.v} w={(PIT.w * PIT_SCALE) / RES}
          style={{ transform: `translate(-${pct(PIT_CORNER.x, PIT.w)}, -${pct(PIT_CORNER.y, PIT.h)})` }}>
          <div data-href="/training" style={{ position: "relative", pointerEvents: "auto" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.pit ? PIT.training : PIT.sparring} alt={t.pit ? "The Training Pit" : "The Sparring Pit"} draggable={false}
              style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated" }} />
            <div className={`pixel-font${pit.ready ? " news-glow" : ""}`}
              style={{ position: "absolute", left: "50%", bottom: "100%", translate: "-50% 0", width: "max-content", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
              {pit.ready && <span className="news-pulse" aria-label="A level's ready">❗ </span>}
              {t.pit ? "Training Pit" : "Sparring Pit"}
            </div>
          </div>
        </RoomSpot>
      )}
      <RoomSpot u={CORNER.u} v={CORNER.v} w={TAVERN.w / RES}
        style={{ transform: `translate(-${pct(CORNER.x, TAVERN.w)}, -${pct(CORNER.y, TAVERN.h)})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TAVERN.src} alt={t.repaired ? "The tavern, repaired" : "The tavern, broken"} draggable={false}
          style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated", filter: t.repaired ? "none" : "grayscale(0.6) brightness(0.75)" }} />
        {LIGHTS.map((g, i) => (
          <div key={i} aria-hidden className="den-glow"
            style={{ left: pct(g.x, TAVERN.w), top: pct(g.y, TAVERN.h), width: pct(g.r * 2, TAVERN.w), aspectRatio: "1", opacity: t.repaired ? 1 : 0.5, background: "radial-gradient(circle, rgba(255, 176, 84, 0.42), rgba(255, 150, 60, 0.14) 45%, transparent 70%)", animationDelay: `${-i * 0.7}s` }} />
        ))}
        {/* Its name over it, like the Den's places, with a ❗ while someone's visiting. */}
        <div className={`pixel-font${news ? " news-glow" : ""}`}
          style={{ position: "absolute", left: "45%", bottom: "100%", translate: "-50% 0", width: "max-content", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
          {news && <span className="news-pulse" aria-label="Someone's in the tavern">❗ </span>}
          {t.repaired ? "Tavern" : "Broken tavern"}
        </div>
        {/* The Cyclops Head, mounted over the door, with the run you first beat it on. */}
        {t.mounted && head && (
          <div style={{ position: "absolute", left: pct(DOOR.x, TAVERN.w), bottom: pct(TAVERN.h - DOOR.y, TAVERN.h), width: pct(44, TAVERN.w), translate: "-50% 0", textAlign: "center", background: "#5a3e22", border: "1px solid #2a1c10", padding: 1 }}>
            <PixelSprite sprite={head} title="The Cyclops Head" style={FIT} />
            <div className="pixel-font" style={{ fontSize: "0.9cqw", color: "#f1d9a0" }}>{firstClearRun ? `Run ${firstClearRun}` : "Cyclops"}</div>
          </div>
        )}
      </RoomSpot>
      {visitor && <Visitor sprite={VISITOR_SPRITE[visitor]} title={VISITOR_TITLE[visitor]} />}
    </>
  );
}

const VISITOR_SPRITE = { merchant: MERCHANT, librarian: LIBRARIAN, collector: COLLECTOR };
const VISITOR_TITLE = { merchant: "A travelling merchant", librarian: "A wandering librarian", collector: "A creature collector" };
const VISITOR_FPS = 12; // how often they're moved along
const STEP_FPS = 9;     // their walk's frames a second (as Klutz's)

// A visitor strolling round the room (VISITOR_PATH), at the same scale as
// everything else (1:1): their walk while they move, their still while they
// pause, mirrored when heading right (the art faces left). Drawn in a box the
// size of a walk frame, with the still where it sits in that frame.
function Visitor({ sprite, title }: { sprite: Sprite; title: string }) {
  const [t, setT] = useState(0); // (set on the first tick: the clock differs between server and browser)
  useEffect(() => {
    const timer = window.setInterval(() => setT(performance.now() / 1000), 1000 / VISITOR_FPS);
    return () => window.clearInterval(timer);
  }, []);
  const art = artFor(sprite);
  const walk = art?.walk;
  const at = strollAt(t, VISITOR_PATH, VISITOR_SPEED, VISITOR_PAUSE);
  if (!art || !walk) return null;
  const frame = Math.floor(t * STEP_FPS) % walk.frames;
  return (
    <RoomSpot u={at.u} v={at.v} w={walk.w / RES}
      style={{ transform: `translate(-50%, -${pct(walk.y + art.h, walk.h)})` }}>
      <div title={title} style={{ position: "relative", aspectRatio: `${walk.w} / ${walk.h}`, transform: at.left ? undefined : "scaleX(-1)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.src} alt={title} draggable={false}
          style={{ position: "absolute", left: pct(walk.x, walk.w), top: pct(walk.y, walk.h), width: pct(art.w, walk.w), height: "auto", imageRendering: "pixelated", visibility: at.walking ? "hidden" : "visible" }} />
        {/* The walk strip, kept loaded while they pause so their first step doesn't flicker. */}
        <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url(${walk.src})`, backgroundSize: `${walk.frames * 100}% 100%`, backgroundPosition: `${(frame / (walk.frames - 1)) * 100}% 0`, imageRendering: "pixelated", visibility: at.walking ? "visible" : "hidden" }} />
      </div>
    </RoomSpot>
  );
}
