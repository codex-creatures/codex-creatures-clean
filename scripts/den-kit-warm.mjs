// The new Den's walls (the user, 2026-11-18: "warmer feeling, so there's good contrast from the
// Labyrinth"): the Labyrinth's approved kit F, every pixel kept, its cold grey-green stone turned to
// warm sandstone and its floor to warm packed earth and flags. Same tiling, same pixels, new colours.
// node scripts/den-kit-warm.mjs  →  public/sprites/den3d/kit-*.png
import { createRequire } from "module";
const sharp = createRequire(process.cwd() + "/package.json")("sharp");
const toHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = (h, s, l) => {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
};
// Each piece: its hue, how saturated, and how much lighter (walls a warm sandstone, the floor warm earth).
const WALL = { hue: 30, sat: 0.34, lift: 1.18, var: 8 }, FLOOR = { hue: 31, sat: 0.22, lift: 1.1, var: 6 };
const pieces = { north: WALL, cap: WALL, east: WALL, west: WALL, nw: WALL, ne: WALL, sw: WALL, se: WALL, floor: FLOOR };
for (const [name, p] of Object.entries(pieces)) {
  const { data, info } = await sharp(`public/sprites/walk/kit-f-${name}.png`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const [h, s, l] = toHsl(data[i], data[i + 1], data[i + 2]);
    // (The stone's own small hue swings kept, a few degrees either way, so it isn't one flat brown.)
    data.set(fromHsl(p.hue + ((h % 60) / 60 - 0.5) * p.var, Math.min(0.5, p.sat + s * 0.3), Math.min(0.62, l * p.lift)), i);
  }
  await sharp(data, { raw: info }).png().toFile(`public/sprites/den3d/kit-${name}.png`);
}
console.log("done");
