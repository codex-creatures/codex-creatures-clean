"use client";
// components/GoldCount.tsx
// Your gold, as the coin icon and the amount (for headers and price tags).

import PixelSprite from "./PixelSprite";
import { GOLD_SPRITE } from "@/lib/sprites/items";

export default function GoldCount({ gold, size = 16 }: { gold: number; size?: number }) {
  return (
    <span className="pixel-font" title="Gold" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: size, color: "#f5c542", whiteSpace: "nowrap" }}>
      <PixelSprite sprite={GOLD_SPRITE} scale={size / 16} style={{ filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.6))" }} />
      {gold.toLocaleString()}
    </span>
  );
}
