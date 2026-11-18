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
