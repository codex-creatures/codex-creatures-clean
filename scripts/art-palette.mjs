// scripts/art-palette.mjs: writes art/palettes/dungeon.json, the dungeon's palette (docs/world-spec.md
// §6.1), from the walls' kit (kit E): every colour its pieces use, near-duplicates merged, as the
// "stone" base; then a few short ramps for what stone can't give (wax, iron, wood, flame), each
// made by lifting or tinting the stone's own colours, so every asset shares the stone's hues.
// Generated art is asked to use it (PixelLab's palette setting); scripts/art-check.mjs scores
// against it. Run: node scripts/art-palette.mjs
import fs from "node:fs";
import path from "node:path";

let sharp;
try { sharp = (await import("sharp")).default; } catch { console.error("art-palette needs sharp (it comes with Next.js: npm install)"); process.exit(1); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const KIT = path.join(ROOT, "public", "sprites", "walk", "kit-e-");
const PIECES = ["north", "floor", "cap", "east", "west", "nw", "ne", "sw", "se"];
const MERGE = 10;   // colours closer than this (RGB distance) count as one

const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// The stone: the kit's colours, most used first, near-duplicates merged.
const count = new Map();
for (const p of PIECES) {
  const { data } = await sharp(`${KIT}${p}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) { const k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; count.set(k, (count.get(k) ?? 0) + 1); }
}
const stone = [];
for (const [k] of [...count.entries()].sort((a, b) => b[1] - a[1])) {
  const c = [k >> 16, (k >> 8) & 255, k & 255];
  if (!stone.some((s) => dist(s, c) < MERGE)) stone.push(c);
}
stone.sort((a, b) => lum(a) - lum(b));
const dark = stone[0], mid = stone[Math.floor(stone.length / 2)], light = stone[stone.length - 1];
// The ramps, dark to light, each from the stone's own colours.
const ramps = {
  wax: [0.25, 0.45, 0.62, 0.78, 0.9].map((t) => mix(mix(light, [236, 222, 186], 0.7), [250, 242, 214], t - 0.25)).map((c, i) => mix(c, mid, (4 - i) * 0.08)),
  iron: [0.0, 0.2, 0.4, 0.6].map((t) => mix(mix(dark, [70, 62, 58], 0.5), [128, 110, 96], t)),
  rust: [0.3, 0.55, 0.8].map((t) => mix(mid, [150, 82, 44], t)),
  wood: [0.35, 0.55, 0.75].map((t) => mix(dark, [120, 84, 52], t)),
  flame: [[150, 40, 20], [214, 92, 32], [244, 160, 52], [252, 214, 120], [255, 244, 210]],   // the flame sprite only
};
const out = {
  about: "The dungeon's palette (docs/world-spec.md §6.1), written by scripts/art-palette.mjs from kit E's walls. stone is the base every asset shares; the ramps are lifted or tinted from it. Flame colours are for the animated flame only.",
  from: "public/sprites/walk/kit-e-*.png",
  stone: stone.map(hex),
  ...Object.fromEntries(Object.entries(ramps).map(([k, v]) => [k, v.map(hex)])),
};
fs.mkdirSync(path.join(ROOT, "art", "palettes"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "art", "palettes", "dungeon.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`stone ${stone.length}, ${Object.entries(ramps).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
