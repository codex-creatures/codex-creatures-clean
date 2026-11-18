// lib/props/palette.ts
// 🧪 The palettes a prop can be checked against in /lab/propbuilder's preview (its "Palette" pass: every pixel
// snapped to the nearest colour, so what's off-palette shows). The art palettes (art/palettes/), and the dungeon's
// with the Soul Altar's teal ramp (neither palette has teal: without it the soul fire snaps to bone-white).

import DUNGEON from "../../art/palettes/dungeon.json";
import DEN from "../../art/palettes/den.json";

export const MAX_PALETTE = 64; // colours the shader holds
// The altar's teal, from its picture (public/sprites/den3d/altar.png: its most-used teal colours, dark to light).
export const TEAL = ["#125658", "#0e7f75", "#119a89", "#17b69c", "#1bd0ae", "#6ca8a1", "#35e8c1", "#6bf1d4", "#b3ece1"];
export type PaletteKey = "dungeon" | "den" | "dungeon+teal";
export const PALETTE_KEYS: PaletteKey[] = ["dungeon", "den", "dungeon+teal"];

// Every colour in a palette file (its ramps; "about" and "from" are words).
export function paletteColours(file: Record<string, unknown>): string[] {
  return Object.values(file).filter(Array.isArray).flat().filter((s): s is string => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s));
}
export function palette(key: PaletteKey): string[] {
  const base = paletteColours(key === "den" ? DEN : DUNGEON);
  return (key === "dungeon+teal" ? [...base, ...TEAL] : base).slice(0, MAX_PALETTE);
}
