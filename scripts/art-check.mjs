// scripts/art-check.mjs: scores new art against the dungeon's standard (docs/world-spec.md §6.3),
// so "does it match the walls?" is a number, not a feeling. Report only: nothing is changed.
//   node scripts/art-check.mjs <png> [<png> …]
// For each picture (its opaque pixels):
// - colours: how far its colours are from the palette (art/palettes/dungeon.json), on average;
// - black: the share drawn darker than the palette's darkest stone (hard black outlines, the
//   "sticker" look: kit E has none);
// - texture: how often its shade changes from one pixel to the next, against kit E's walls and
//   floor (1.0 = as grainy as the stone; well under it reads smooth and flat beside it, a sticker);
// - contrast: by how much it changes where it does, against the stone (high: hard edges, bright
//   against dark);
// - used: how many colours it uses.
import fs from "node:fs";
import path from "node:path";

let sharp;
try { sharp = (await import("sharp")).default; } catch { console.error("art-check needs sharp (it comes with Next.js: npm install)"); process.exit(1); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
// What counts as on the standard (🧪, first guesses from kit E itself).
export const LIMITS = { colours: 12, black: 0.02, texture: [0.75, 1.4], contrast: [0.6, 1.8] };
const GRAIN = 3; // a shade change smaller than this is the same shade

const pal = JSON.parse(fs.readFileSync(path.join(ROOT, "art", "palettes", "dungeon.json"), "utf8"));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const colours = ["stone", "wax", "iron", "rust", "wood", "flame"].flatMap((k) => pal[k].map(rgb));
const darkest = rgb(pal.stone[0]);
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function measure(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 4;
  let n = 0, far = 0, black = 0, change = 0, pairs = 0, changed = 0;
  const used = new Set();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    if (data[i + 3] < 128) continue;
    const c = [data[i], data[i + 1], data[i + 2]];
    n++; used.add(c.join());
    far += Math.min(...colours.map((p) => dist(p, c)));
    if (lum(c) < lum(darkest) - 2) black++;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (x + dx >= w || y + dy >= h) continue;
      const j = at(x + dx, y + dy);
      if (data[j + 3] < 128) continue;
      const d = Math.abs(lum(c) - lum([data[j], data[j + 1], data[j + 2]]));
      pairs++;
      if (d > GRAIN) { changed++; change += d; }
    }
  }
  return { n, colours: far / n, black: black / n, texture: changed / Math.max(1, pairs), contrast: change / Math.max(1, changed), used: used.size };
}

// Kit E's own busyness: the standard every asset is held to.
const kit = await Promise.all(["north", "floor"].map((p) => measure(path.join(ROOT, "public", "sprites", "walk", `kit-e-${p}.png`))));
const stone = { texture: kit.reduce((a, k) => a + k.texture, 0) / kit.length, contrast: kit.reduce((a, k) => a + k.contrast, 0) / kit.length };
const files = process.argv.slice(2);
if (!files.length) { console.log("usage: node scripts/art-check.mjs <png> [<png> …]"); process.exit(0); }
const mark = (ok) => (ok ? "ok " : "OFF");
for (const f of files) {
  const m = await measure(f), texture = m.texture / stone.texture, contrast = m.contrast / stone.contrast;
  console.log(`${path.basename(f)}  (${m.n} px)`);
  console.log(`  ${mark(m.colours <= LIMITS.colours)} colours  ${m.colours.toFixed(1)} from the palette on average (≤ ${LIMITS.colours})`);
  console.log(`  ${mark(m.black <= LIMITS.black)} black    ${(m.black * 100).toFixed(1)}% darker than the darkest stone (≤ ${LIMITS.black * 100}%)`);
  console.log(`  ${mark(texture >= LIMITS.texture[0] && texture <= LIMITS.texture[1])} texture  ${texture.toFixed(2)} × the stone's (${LIMITS.texture[0]}–${LIMITS.texture[1]})`);
  console.log(`  ${mark(contrast >= LIMITS.contrast[0] && contrast <= LIMITS.contrast[1])} contrast ${contrast.toFixed(2)} × the stone's (${LIMITS.contrast[0]}–${LIMITS.contrast[1]})`);
  console.log(`      used     ${m.used} colours`);
}
