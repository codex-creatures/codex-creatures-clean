// components/PixelSprite.tsx
// Draws a text-grid sprite (lib/sprites) as crisp SVG pixels, outline included.

import { useMemo } from "react";
import { outlined, runs, type Sprite } from "@/lib/sprites/pixels";
import { WEAPON_SPRITES, ARMOR_SPRITES } from "@/lib/sprites/items";
import { CREATURE_SPRITES, EGG } from "@/lib/sprites/creatures";
import type { CreatureOrItemDrop } from "@/lib/types";

export default function PixelSprite({ sprite, scale = 4, title, style }: {
  sprite: Sprite; scale?: number; title?: string; style?: React.CSSProperties;
}) {
  const { w, h, rects } = useMemo(() => {
    const g = outlined(sprite);
    return { w: g[0].length, h: g.length, rects: runs(g) };
  }, [sprite]);
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges"
      role="img" aria-label={title} style={{ display: "block", flexShrink: 0, ...style }}>
      {title && <title>{title}</title>}
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
}

// The sprite for a weapon or armour drop (undefined for other items).
export function itemSprite(item: CreatureOrItemDrop): Sprite | undefined {
  if (item.itemKey) return WEAPON_SPRITES[item.itemKey];
  if (item.armorKey) return ARMOR_SPRITES[item.armorKey];
  return undefined;
}

// A creature's sprite, or a rune egg if it hasn't been drawn yet.
export const creatureSprite = (creatureId?: string): Sprite => (creatureId && CREATURE_SPRITES[creatureId]) || EGG;
