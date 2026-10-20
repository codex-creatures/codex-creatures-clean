"use client";
// components/TavernRoom.tsx
// What stands in the tavern's room, through the Den's doorway behind its
// right wall (DenRoom's annex): the tavern in the far right corner, with a ❗
// over it when it has a quest step for you (tap it for the tavern's window),
// the Cyclops Head over its door once mounted, and whoever's visiting out front.

import PixelSprite from "@/components/PixelSprite";
import { RoomSpot } from "@/components/DenRoom";
import { RES } from "@/lib/den/scene";
import { fineWidth } from "@/lib/sprites/art";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
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
// Where a visitor stands: out front, just left of the door.
const VISITOR_SPOT = { u: 12.4, v: 6.2 };
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

// quest: the tavern has a quest step waiting (lib/tavern.ts tavernHasQuest).
// firstClearRun: the run you first beat the Cyclops on (marked on the head).
export default function TavernRoom({ tavern: t, quest = false, firstClearRun }: { tavern: TavernQuest; quest?: boolean; firstClearRun?: number }) {
  const visitor = tavernVisitor(t);
  const news = quest || !!visitor;
  const head = CREATURE_SPRITES.cyclops;
  return (
    <>
      <RoomSpot u={CORNER.u} v={CORNER.v} w={TAVERN.w / RES}
        style={{ transform: `translate(-${pct(CORNER.x, TAVERN.w)}, -${pct(CORNER.y, TAVERN.h)})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TAVERN.src} alt={t.repaired ? "The tavern, repaired" : "The tavern, broken"} draggable={false}
          style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated", filter: t.repaired ? "none" : "grayscale(0.6) brightness(0.75)" }} />
        {LIGHTS.map((g, i) => (
          <div key={i} aria-hidden className="den-glow"
            style={{ left: pct(g.x, TAVERN.w), top: pct(g.y, TAVERN.h), width: pct(g.r * 2, TAVERN.w), aspectRatio: "1", opacity: t.repaired ? 1 : 0.5, background: "radial-gradient(circle, rgba(255, 176, 84, 0.42), rgba(255, 150, 60, 0.14) 45%, transparent 70%)", animationDelay: `${-i * 0.7}s` }} />
        ))}
        {/* Its name over it, like the Den's places, with a ❗ while there's a quest
            step or someone's visiting. */}
        <div className={`pixel-font${news ? " news-glow" : ""}`}
          style={{ position: "absolute", left: "45%", bottom: "100%", translate: "-50% 0", width: "max-content", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
          {news && <span className="news-pulse" aria-label={quest ? "The tavern has a quest for you" : "Someone's in the tavern"}>❗ </span>}
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
      {/* A visitor, standing by the door at the same scale as everything else (1:1). */}
      {visitor && (
        <RoomSpot u={VISITOR_SPOT.u} v={VISITOR_SPOT.v} w={fineWidth(visitor === "merchant" ? MERCHANT : LIBRARIAN) / RES}>
          <PixelSprite sprite={visitor === "merchant" ? MERCHANT : LIBRARIAN} title={visitor === "merchant" ? "A travelling merchant" : "A wandering librarian"} style={FIT} />
        </RoomSpot>
      )}
    </>
  );
}
