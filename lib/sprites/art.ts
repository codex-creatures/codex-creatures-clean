// lib/sprites/art.ts
// Drawn art (PNG sprites made in PixelLab, in public/sprites), linked to the
// text-grid sprite it replaces. The grid stays as the fallback until the
// image loads, or if it fails. Art pixels count as fine-grid pixels, so a
// sprite's size on screen follows the same scale rules as the grids.

import { spriteWidth, type Sprite } from "./pixels";

// An animation: a strip of equal frames side by side (w×h each), with the
// still sprite's top-left at (x, y) in every frame, so the two line up.
export type Anim = { src: string; frames: number; w: number; h: number; x: number; y: number };
// size: how wide it's shown, in fine pixels, when that isn't its own width
// (item icons are drawn at 64px but take the 32px space the grids did).
// faces: which way the drawing faces. Creature art faces left (towards the
// player's side of a fight) unless it says "right" (Klutz, drawn walking right).
// flipToFace says whether to mirror a sprite so it faces the way you want.
// floats: it hangs in the air (a wisp, a bat): drawn off the floor, bobbing.
export type Art = { src: string; w: number; h: number; size?: number; walk?: Anim; faces?: "right"; floats?: boolean };

const ART = new WeakMap<Sprite, Art>();

// Give a grid sprite drawn art (returns the same sprite).
export function withArt(sprite: Sprite, art: Art): Sprite {
  ART.set(sprite, art);
  return sprite;
}

export const artFor = (sprite: Sprite): Art | undefined => ART.get(sprite);

// An enchanted item's picture: the same sprite (and art) under its own identity,
// so PixelSprite knows to lay the enchantment's moving shine over it.
const SHINING = new WeakSet<Sprite>();
const TWINS = new WeakMap<Sprite, Sprite>();
export function shining(sprite: Sprite): Sprite {
  let twin = TWINS.get(sprite);
  if (!twin) {
    twin = [...sprite];
    const art = ART.get(sprite);
    if (art) ART.set(twin, art);
    SHINING.add(twin);
    TWINS.set(sprite, twin);
  }
  return twin;
}
export const isShining = (sprite: Sprite) => SHINING.has(sprite);

// A sprite's size in fine pixels (art as drawn, a grid sprite at 2 fine pixels a cell).
export const fineWidth = (s: Sprite) => { const a = artFor(s); return a ? (a.size ?? a.w) : spriteWidth(s) * 2; };
export const fineHeight = (s: Sprite) => { const a = artFor(s); return a ? a.h * ((a.size ?? a.w) / a.w) : s.length * 2; };

// Mirror this sprite (scaleX(-1)) so it faces right (true) or left (false)?
export const flipToFace = (s: Sprite, right: boolean) => (artFor(s)?.faces === "right") !== right;
