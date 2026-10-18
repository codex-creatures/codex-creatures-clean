// lib/sprites/art.ts
// Drawn art (PNG sprites made in PixelLab, in public/sprites), linked to the
// text-grid sprite it replaces. The grid stays as the fallback until the
// image loads, or if it fails. Art pixels count as fine-grid pixels, so a
// sprite's size on screen follows the same scale rules as the grids.

import type { Sprite } from "./pixels";

// An animation: a strip of equal frames side by side (w×h each), with the
// still sprite's top-left at (x, y) in every frame, so the two line up.
export type Anim = { src: string; frames: number; w: number; h: number; x: number; y: number };
// size: how wide it's shown, in fine pixels, when that isn't its own width
// (item icons are drawn at 64px but take the 32px space the grids did).
// faces: which way the drawing faces. Creature art faces left (towards the
// player's side of a fight) unless it says "right" (Klutz, drawn walking right).
// floats: it hangs in the air (a wisp, a bat): drawn off the floor, bobbing.
export type Art = { src: string; w: number; h: number; size?: number; walk?: Anim; faces?: "right"; floats?: boolean };

const ART = new WeakMap<Sprite, Art>();

// Give a grid sprite drawn art (returns the same sprite).
export function withArt(sprite: Sprite, art: Art): Sprite {
  ART.set(sprite, art);
  return sprite;
}

export const artFor = (sprite: Sprite): Art | undefined => ART.get(sprite);

// Decoded RGBA pixels, for scenes drawn pixel by pixel (the Den).
export type Pixels = { w: number; h: number; data: Uint8ClampedArray };

const loaded = new Map<string, Promise<Pixels>>();
export function loadPixels(src: string): Promise<Pixels> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<Pixels>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.drawImage(img, 0, 0);
        resolve({ w: c.width, h: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data });
      };
      img.onerror = () => reject(new Error(`couldn't load ${src}`));
      img.src = src;
    });
    loaded.set(src, p);
    p.catch(() => loaded.delete(src));
  }
  return p;
}

// An animation's frames, cut from its strip.
export async function loadFrames(anim: Anim): Promise<Pixels[]> {
  const strip = await loadPixels(anim.src);
  return Array.from({ length: anim.frames }, (_, f) => {
    const data = new Uint8ClampedArray(anim.w * anim.h * 4);
    for (let y = 0; y < anim.h; y++) {
      const from = (y * strip.w + f * anim.w) * 4;
      data.set(strip.data.subarray(from, from + anim.w * 4), y * anim.w * 4);
    }
    return { w: anim.w, h: anim.h, data };
  });
}

// What the Den needs to draw a creature with art: its still, and its walk if it has one.
export type LoadedArt = { still: Pixels; walk?: { frames: Pixels[]; x: number; y: number } };
export async function loadArt(art: Art): Promise<LoadedArt> {
  const [still, frames] = await Promise.all([loadPixels(art.src), art.walk ? loadFrames(art.walk).catch(() => null) : null]);
  return { still, walk: frames && art.walk ? { frames, x: art.walk.x, y: art.walk.y } : undefined };
}
