"use client";
// components/TavernRoom.tsx
// What stands in the tavern's room, the Den's neighbour in the room strip
// (DenRoom's annex): the tavern against the far wall, the Cyclops wanted
// poster beside it, the head over its door once mounted, and whoever's
// visiting out front. Placeholders until their PixelLab art.

import PixelSprite from "@/components/PixelSprite";
import { RoomSpot } from "@/components/DenRoom";
import { CREATURE_SPRITES } from "@/lib/sprites/creatures";
import { LIBRARIAN, MERCHANT } from "@/lib/sprites/props";
import { tavernVisitor, type TavernQuest } from "@/lib/tavern";

const FIT = { width: "100%", height: "auto" }; // a sprite filling its spot in the room

// firstClearRun: the run you first beat the Cyclops on (marked on the head).
export default function TavernRoom({ tavern: t, firstClearRun }: { tavern: TavernQuest; firstClearRun?: number }) {
  const visitor = tavernVisitor(t);
  const head = CREATURE_SPRITES.cyclops;
  return (
    <>
      <RoomSpot u={10} v={0.6} w={150}>
        {/* Its name over it, like the Den's places, with a ❗ while someone's visiting. */}
        <div className={`pixel-font${visitor ? " news-glow" : ""}`}
          style={{ width: "max-content", margin: "0 auto 2%", padding: "2px 6px", fontSize: "clamp(11px, 2.6cqw, 14px)", lineHeight: 1.3, background: "rgba(12, 12, 18, 0.78)", border: "2px solid #8a6a3a", color: "#f1d9a0", transform: "scale(var(--inv, 1))", transformOrigin: "50% 100%" }}>
          {visitor && <span className="news-pulse" aria-label="Someone's in the tavern">❗ </span>}
          {t.repaired ? "Tavern" : "Broken tavern"}
        </div>
        {/* The Cyclops Head, mounted over the door, with the run you first beat it on. */}
        {t.mounted && head && (
          <div style={{ width: "34%", margin: "0 auto", textAlign: "center", background: "#5a3e22", border: "2px solid #2a1c10", padding: 2 }}>
            <PixelSprite sprite={head} title="The Cyclops Head" style={FIT} />
            <div className="pixel-font" style={{ fontSize: "2cqw", color: "#f1d9a0" }}>{firstClearRun ? `Run ${firstClearRun}` : "Cyclops"}</div>
          </div>
        )}
        <svg viewBox="0 0 100 100" role="img" aria-label={t.repaired ? "The tavern, repaired" : "The tavern, broken"}
          style={{ display: "block", width: "100%", filter: t.repaired ? "none" : "grayscale(0.6) brightness(0.75)" }}>
          <text x="50" y="88" fontSize="92" textAnchor="middle">{t.repaired ? "🏠" : "🏚️"}</text>
        </svg>
      </RoomSpot>
      <RoomSpot u={15.5} v={0.05} z={40} w={64} style={{ padding: "1% 1% 2%", background: "#e8d6a8", border: "2px solid #8a6a3a", boxShadow: "0 3px 0 rgba(0,0,0,0.6)", textAlign: "center" }}>
        <div className="pixel-font" style={{ fontSize: "2.4cqw", color: "#7a1e14", letterSpacing: 1 }}>WANTED</div>
        {head && <PixelSprite sprite={head} style={FIT} />}
        <div className="pixel-font" style={{ fontSize: "2cqw", color: "#3a2a14" }}>{t.mounted ? "PAID" : "The Cyclops"}</div>
      </RoomSpot>
      {visitor && (
        <RoomSpot u={13.5} v={3} w={44}>
          <PixelSprite sprite={visitor === "merchant" ? MERCHANT : LIBRARIAN} title={visitor === "merchant" ? "A travelling merchant" : "A wandering librarian"} style={FIT} />
        </RoomSpot>
      )}
    </>
  );
}
