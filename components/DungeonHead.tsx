"use client";
// components/DungeonHead.tsx
// A dungeon as its boss's head in a medallion (the Labyrinth entrance's picker), wherever a dungeon is
// named: Klutz's trips too (the user, 2026-11-27: "use the heads of each boss" in place of the emoji).
// The Encampment's is the Baby Cyclops (the user, 2026-11-27: not the wolf); the Abyss's Warden is
// different every time, so a shadow.

import type { DungeonId } from "@/lib/dungeon/run";
import { MINOTAUR_ART } from "@/lib/sprites/creatures";

// art: the boss's picture; crop: where the medallion's square sits on it (object-position); shadow: a dark shape.
export const DUNGEON_HEAD: Record<DungeonId, { art: string; crop: string; shadow?: boolean }> = {
  0: { art: "/sprites/creatures/baby_cyclops.png?v=2", crop: "50% 12%" },
  1: { art: "/sprites/creatures/cyclops.png", crop: "50% 10%" },
  2: { art: "/sprites/creatures/hydra/hydra-000.png", crop: "50% 15%" },
  3: { art: "/sprites/creatures/aurelius.png", crop: "50% 15%", shadow: true },
  4: { art: MINOTAUR_ART, crop: "50% 15%" },
};

// The head alone, filling its box (the medallion's inside, or any square).
export function HeadPicture({ d }: { d: DungeonId }) {
  const h = DUNGEON_HEAD[d];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={h.art} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: h.crop, imageRendering: "pixelated", filter: h.shadow ? "brightness(0.25) sepia(1) hue-rotate(-20deg)" : undefined }} />
  );
}

// In its medallion, `size` px across, inline (Klutz's trips).
export default function DungeonHead({ d, size = 30 }: { d: DungeonId; size?: number }) {
  return (
    <span className="medallion" style={{ display: "inline-block", width: size, maxWidth: size, flex: "none", verticalAlign: "middle" }}>
      <span className="medallion-in"><HeadPicture d={d} /></span>
    </span>
  );
}
