// components/PixelSprite.tsx
// Draws a text-grid sprite (lib/sprites) as crisp SVG pixels, outline included,
// on the fine grid (each drawn pixel is 2×2, smoothed; see lib/sprites/pixels.ts).
// A sprite with drawn art (lib/sprites/art.ts) shows that image instead.
// scale: screen pixels per drawn pixel, as before (so sizes don’t change).

import { useMemo, useState } from "react";
import { fineGrid, outlined, runs, type Sprite } from "@/lib/sprites/pixels";
import { artFor, isShining, shining } from "@/lib/sprites/art";
import { enchantOf } from "@/lib/items/enchantments";
import { WEAPON_SPRITES, ARMOR_SPRITES, HELMET_SPRITES, LEGS_SPRITES, POTION_SPRITES, MATERIAL_SPRITES, TOOL_SPRITES, STONE_SPRITES, CODEX_SPRITE, SCROLL_SPRITE, SCHEMATIC_SPRITE } from "@/lib/sprites/items";
import { MATERIALS, type MaterialKey } from "@/lib/items/materials";
import { CREATURE_SPRITES, EGG } from "@/lib/sprites/creatures";
import type { CreatureOrItemDrop } from "@/lib/types";
import type { SoulStoneKey } from "@/lib/creatures/soulStones";

export default function PixelSprite({ sprite, scale = 4, title, style }: {
  sprite: Sprite; scale?: number; title?: string; style?: React.CSSProperties;
}) {
  // Drawn art, if the sprite has some (the grid below is its fallback).
  const art = artFor(sprite);
  const [broken, setBroken] = useState<string | null>(null);
  const { w, h, rects } = useMemo(() => {
    const g = outlined(fineGrid(sprite));
    return { w: g[0].length, h: g.length, rects: runs(g) };
  }, [sprite]);
  // An enchanted item (lib/sprites/art.ts shining): a moving shine over it, in
  // the picture's own shape when it's drawn art (CSS only: .enchant-shine).
  const shine = isShining(sprite);
  if (art && broken !== art.src) {
    const width = ((art.size ?? art.w) * scale) / 2, height = (width * art.h) / art.w;
    // Crisp pixels when shown at its own size or bigger; shrunk, smooth (crisp
    // shrinking drops pixels unevenly).
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={art.src} alt={title ?? ""} title={title} width={width} height={height}
        onError={() => setBroken(art.src)} draggable={false}
        style={{ display: "block", flexShrink: 0, imageRendering: width * dpr >= art.w ? "pixelated" : "auto", ...(shine ? FILL : style) }} />
    );
    if (!shine) return img;
    const mask = `url("${art.src}") center / 100% 100% no-repeat`;
    return (
      <span style={shineBox(width, height, style)}>
        {img}
        <span aria-hidden className="enchant-shine" style={{ WebkitMask: mask, mask }} />
      </span>
    );
  }
  const svg = (
    <svg width={(w * scale) / 2} height={(h * scale) / 2} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges"
      role="img" aria-label={title} style={{ display: "block", flexShrink: 0, ...(shine ? FILL : style) }}>
      {title && <title>{title}</title>}
      {rects.map(([x, y, n, c], i) => <rect key={i} x={x} y={y} width={n} height={1} fill={c} />)}
    </svg>
  );
  if (!shine) return svg;
  return (
    <span style={shineBox((w * scale) / 2, (h * scale) / 2, style)}>
      {svg}
      <span aria-hidden className="enchant-shine" />
    </span>
  );
}

// A shining sprite's box takes the caller's style (its size, shadow, flip), and
// the picture fills it, so the picture and its shine always line up (a style
// like width 84% would otherwise stretch the box but not the picture).
const FILL: React.CSSProperties = { width: "100%", height: "100%" };
const shineBox = (width: number, height: number, style?: React.CSSProperties): React.CSSProperties => ({
  display: "block", flexShrink: 0, position: "relative", width, height, aspectRatio: `${width} / ${height}`, ...style,
});

// The sprite for an item drop: gear, a potion, a material, a tool, a codex,
// an XP scroll or a schematic (undefined for anything without art). An
// enchanted piece's carries the shine.
export function itemSprite(item: CreatureOrItemDrop): Sprite | undefined {
  const sp = plainItemSprite(item);
  return sp && enchantOf(item) ? shining(sp) : sp;
}
function plainItemSprite(item: CreatureOrItemDrop): Sprite | undefined {
  if (item.potion) return POTION_SPRITES[item.potion];
  if (item.material && MATERIAL_SPRITES[item.material]) return MATERIAL_SPRITES[item.material];
  if (item.tool) return TOOL_SPRITES[item.tool];
  if (item.stone) return STONE_SPRITES[item.stone];
  if (item.codexMove) return CODEX_SPRITE;
  if (item.scroll) return SCROLL_SPRITE;
  if (item.schematic) return SCHEMATIC_SPRITE;
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

// A potion's picture, small enough to sit in a line of text (the red bottle
// is a Healing Potion, the little vial a Lesser one).
export function PotionIcon({ kind }: { kind: "potion" | "lesser" }) {
  return <PixelSprite sprite={POTION_SPRITES[kind]} scale={1.25} style={{ verticalAlign: "middle", marginRight: 4 }} />;
}

// A soul stone's picture, for a line of text or a tile.
export function StoneIcon({ k, scale = 1.25 }: { k: SoulStoneKey; scale?: number }) {
  return <PixelSprite sprite={STONE_SPRITES[k]} scale={scale} style={{ verticalAlign: "middle", marginRight: 2, display: "inline-block" }} />;
}

// A schematic's picture (the rolled blueprint), for a line of text.
export function SchematicIcon({ scale = 1.25 }: { scale?: number }) {
  return <PixelSprite sprite={SCHEMATIC_SPRITE} scale={scale} style={{ verticalAlign: "middle", marginRight: 2, display: "inline-block" }} />;
}

// A material's picture for a line of text (its emoji if it has no art).
export function MaterialIcon({ k }: { k: MaterialKey }) {
  const sp = MATERIAL_SPRITES[k];
  return sp ? <PixelSprite sprite={sp} scale={1.25} style={{ verticalAlign: "middle", marginRight: 2 }} /> : <>{MATERIALS[k].icon}</>;
}
