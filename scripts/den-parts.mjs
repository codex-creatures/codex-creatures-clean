// The new Den's 3D models' parts (the user, 2026-11-19: "the Soul Altar, the healing pool and the sparring
// pits need 3D models"), cut from their approved pictures so the models keep those designs: the altar's
// soul fire, horned skull, lantern and plinth stone (den3d/altar.png), the pool's water (den3d/pool-top.png),
// the sand (den3d/sparring-top.png) and the dummy (den/training-pit.png); the pits' low walls take the
// Labyrinth's own grey stone (walk/kit-f-north.png). No generation: every pixel is the approved art's.
// node scripts/den-parts.mjs  →  public/sprites/den3d/parts/*.png
import { createRequire } from "module";
const sharp = createRequire(process.cwd() + "/package.json")("sharp");
const S = "public/sprites/", O = "public/sprites/den3d/parts/";
const cut = (src, name, left, top, width, height) => sharp(S + src).extract({ left, top, width, height }).png().toFile(O + name + ".png");
await cut("den3d/altar.png", "altar-fire", 18, 0, 72, 50);
await cut("den3d/altar.png", "altar-skull", 38, 52, 34, 26);
await cut("den3d/altar.png", "altar-lantern", 3, 72, 13, 28);
await cut("den3d/pool-top.png", "pool-water", 24, 14, 48, 34);
await cut("den3d/sparring-top.png", "sand", 18, 68, 40, 40);
await cut("walk/kit-f-north.png", "pit-stone", 0, 24, 48, 24);
console.log("done");

// The PvP portal's arch (the user, 2026-11-19: "the left tunnel mirrored to the right one, then recoloured with
// green in it"): the Labyrinth's arch, mirrored, its warm sandstone turned to a mossy green-grey.
{
  const { data, info } = await sharp(S + "den3d/arch.png").flop().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const l = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    data[i] = Math.round(l * 150); data[i + 1] = Math.round(l * 205); data[i + 2] = Math.round(l * 160);
  }
  await sharp(data, { raw: info }).png().toFile(S + "den3d/portal-arch.png");
}
// The dummy (PixelLab, styled on den/training-pit.png's): trimmed to its own pixels.
{
  const b = await sharp(O + "dummy.png").trim({ threshold: 0 }).toBuffer();
  await sharp(b).toFile(O + "dummy-trim.png");
}

// The ways out's holes (the user, 2026-11-18: "make it look like the hole is actually a hole in the wall"): the
// arch's open middle, filled from its foot up to the arch's inner edge, black, with the floor running a little
// way in at its foot (warm dark, fading). Laid behind each arch on the rock face; the portal's is its mirror.
{
  const { data, info } = await sharp(S + "den3d/arch.png").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, out = Buffer.alloc(w * h * 4), seen = new Uint8Array(w * h);
  const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] < 128;
  const todo = [[w >> 1, h - 1]];
  while (todo.length) {
    const [x, y] = todo.pop(), i = y * w + x;
    if (!open(x, y) || seen[i]) continue;
    seen[i] = 1;
    todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const FLOOR_ROWS = 7;
  for (let i = 0; i < w * h; i++) {
    if (!seen[i]) continue;
    const y = Math.floor(i / w), k = Math.max(0, (y - (h - FLOOR_ROWS)) / FLOOR_ROWS); // 0 above the floor, up to 1 at the foot
    out[i * 4] = Math.round(6 + 34 * k); out[i * 4 + 1] = Math.round(4 + 24 * k); out[i * 4 + 2] = Math.round(3 + 14 * k); out[i * 4 + 3] = 255;
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(S + "den3d/arch-hole.png");
  await sharp(S + "den3d/arch-hole.png").flop().png().toFile(S + "den3d/portal-hole.png");
}
