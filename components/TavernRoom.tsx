"use client";
// components/TavernRoom.tsx
// What stands in the tavern's room, through the Den's doorway behind its
// right wall (DenRoom's annex): the tavern in the far right corner, the Cyclops
// wanted poster on its boarded wall, the head over its door once mounted, and
// whoever's visiting out front.

import PixelSprite from "@/components/PixelSprite";
import { RoomSpot } from "@/components/DenRoom";
import { RES } from "@/lib/den/scene";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import { tavernVisitor, type TavernQuest } from "@/lib/tavern";

const FIT = { width: "100%", height: "auto" }; // a sprite filling its spot in the room

// The tavern's art (PixelLab), drawn 1:1 like the Den's props: 1 floor block is
// 64px across, and its door's about 100px tall to Klutz's 85. Its footprint is
// about 7×3 blocks. CORNER: the floor spot its front corner stands on, and where
// that corner is in the picture.
const TAVERN = { src: "/sprites/den/tavern.png", w: 387, h: 308 };
const CORNER = { u: 20, v: 3.8, x: 250, y: 287 };
// Spots on the picture (px): its boarded wall, the top of its door.
const BOARDS = { x: 193, y: 200 };
const DOOR = { x: 111, y: 143 };
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

// firstClearRun: the run you first beat the Cyclops on (marked on the head).
export default function TavernRoom({ tavern: t, firstClearRun }: { tavern: TavernQuest; firstClearRun?: number }) {
  const visitor = tavernVisitor(t);
  const head = CREATURE_SPRITES.cyclops;
  return (
    <>
      <RoomSpot u={CORNER.u} v={CORNER.v} w={TAVERN.w / RES}
        style={{ transform: `translate(-${pct(CORNER.x, TAVERN.w)}, -${pct(CORNER.y, TAVERN.h)})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TAVERN.src} alt={t.repaired ? "The tavern, repaired" : "The tavern, broken"} draggable={false}
          style={{ display: "block", width: "100%", height: "auto", imageRendering: "pixelated", filter: t.repaired ? "none" : "grayscale(0.6) brightness(0.75)" }} />
        {/* Its name over it, like the Den's places, with a ❗ while someone's visiting. */}
        <div className={`pixel-font${visitor ? " news-glow" : ""}`}
          style={{ position: "absolute", left: "45%", bottom: "100%", translate: "-50% 0", width: "max-content", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
          {visitor && <span className="news-pulse" aria-label="Someone's in the tavern">❗ </span>}
          {t.repaired ? "Tavern" : "Broken tavern"}
        </div>
        {/* The wanted poster, pinned to the boarded wall beside the door. */}
        <div style={{ position: "absolute", left: pct(BOARDS.x, TAVERN.w), top: pct(BOARDS.y, TAVERN.h), width: pct(68, TAVERN.w), translate: "-50% -50%", padding: "1% 1% 3%", background: "#e8d6a8", border: "1px solid #8a6a3a", boxShadow: "0 2px 0 rgba(0,0,0,0.6)", textAlign: "center", rotate: "-2deg" }}>
          <div className="pixel-font" style={{ fontSize: "1.3cqw", color: "#7a1e14" }}>WANTED</div>
          {head && <PixelSprite sprite={head} style={FIT} />}
          <div className="pixel-font" style={{ fontSize: "1cqw", color: "#3a2a14" }}>{t.mounted ? "PAID" : "The Cyclops"}</div>
        </div>
        {/* The Cyclops Head, mounted over the door, with the run you first beat it on. */}
        {t.mounted && head && (
          <div style={{ position: "absolute", left: pct(DOOR.x, TAVERN.w), bottom: pct(TAVERN.h - DOOR.y, TAVERN.h), width: pct(44, TAVERN.w), translate: "-50% 0", textAlign: "center", background: "#5a3e22", border: "1px solid #2a1c10", padding: 1 }}>
            <PixelSprite sprite={head} title="The Cyclops Head" style={FIT} />
            <div className="pixel-font" style={{ fontSize: "0.9cqw", color: "#f1d9a0" }}>{firstClearRun ? `Run ${firstClearRun}` : "Cyclops"}</div>
          </div>
        )}
      </RoomSpot>
      {visitor && (
        <RoomSpot u={16.8} v={5.8} w={44}>
          <PixelSprite sprite={visitor === "merchant" ? MERCHANT : LIBRARIAN} title={visitor === "merchant" ? "A travelling merchant" : "A wandering librarian"} style={FIT} />
        </RoomSpot>
      )}
    </>
  );
}
