// components/PixelSprite.tsx
// Draws a text-grid sprite (lib/sprites) as crisp SVG pixels, outline included,
// on the fine grid (each drawn pixel is 2×2, smoothed; see lib/sprites/pixels.ts).
// scale: screen pixels per drawn pixel, as before (so sizes don’t change).

import { useMemo } from "react";
import { fineGrid, outlined, runs, type Sprite } from "@/lib/sprites/pixels";
import { WEAPON_SPRITES, ARMOR_SPRITES, HELMET_SPRITES, LEGS_SPRITES } from "@/lib/sprites/items";
import { CREATURE_SPRITES, EGG } from "@/lib/sprites/creatures";
import type { CreatureOrItemDrop } from "@/lib/types";

export default function PixelSprite({ sprite, scale = 4, title, style }: {
  sprite: Sprite; scale?: number; title?: string; style?: React.CSSProperties;
}) {
  const { w, h, rects } = useMemo(() => {
    const g = outlined(fineGrid(sprite));
    return { w: g[0].length, h: g.length, rects: runs(g) };
  }, [sprite]);
  return (
    <svg width={(w * scale) / 2} height={(h * scale) / 2} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges"
      role="img" aria-label={title} style={{ display: "block", flexShrink: 0, ...style }}>
      {title && <title>{title}</title>}
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
}

// The sprite for a weapon or armour drop (undefined for other items).
export function itemSprite(item: CreatureOrItemDrop): Sprite | undefined {
  if (item.itemKey) return WEAPON_SPRITES[item.itemKey];
  if (item.armorKey) {
    // Each piece has its own look: a helmet, a chestpiece, leg armour.
    if (item.armorSlot === "helmet") return HELMET_SPRITES[item.armorKey];
    if (item.armorSlot === "legs") return LEGS_SPRITES[item.armorKey];
    return ARMOR_SPRITES[item.armorKey];
  }
  return undefined;
}

// A creature's sprite, or a rune egg if it hasn't been drawn yet.
export const creatureSprite = (creatureId?: string): Sprite => (creatureId && CREATURE_SPRITES[creatureId]) || EGG;
