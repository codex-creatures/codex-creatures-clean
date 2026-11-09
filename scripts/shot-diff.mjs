// scripts/shot-diff.mjs: compares two folders of screenshots (tests/visual-baseline/README.md):
// for each picture in both, the average difference per colour channel (0–255) and the share of
// pixels more than 24 levels off. Report only.
//   node scripts/shot-diff.mjs <folder-a> <folder-b>
import fs from "node:fs";
import path from "node:path";

let sharp;
try { sharp = (await import("sharp")).default; } catch { console.error("shot-diff needs sharp (it comes with Next.js: npm install)"); process.exit(1); }

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error("usage: node scripts/shot-diff.mjs <folder-a> <folder-b>"); process.exit(1); }
const raw = async (f) => (await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
for (const name of fs.readdirSync(a).filter((f) => f.endsWith(".png") && fs.existsSync(path.join(b, f))).sort()) {
  const [x, y] = await Promise.all([raw(path.join(a, name)), raw(path.join(b, name))]);
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) { console.log(`${name}: sizes differ`); continue; }
  let sum = 0, far = 0;
  for (let i = 0; i < x.data.length; i += 3) {
    const d = [0, 1, 2].map((k) => Math.abs(x.data[i + k] - y.data[i + k]));
    sum += d[0] + d[1] + d[2];
    if (Math.max(...d) > 24) far++;
  }
  const px = x.data.length / 3;
  console.log(`${name.padEnd(24)} ${(sum / x.data.length).toFixed(2).padStart(6)}   ${((100 * far) / px).toFixed(2).padStart(6)}% far`);
}
