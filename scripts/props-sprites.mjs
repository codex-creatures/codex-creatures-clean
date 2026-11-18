// scripts/props-sprites.mjs — the pictures the prop builder can paint with (/lab/propbuilder's picker): every PNG
// under public/sprites, with its size, written to lib/props/sprites.json. (A static or offline copy can't list a
// folder, so the list is made here.) Run it after adding art: npm run props:sprites. A picture not in the list can
// still be typed in by its path.
import { createRequire } from "module";
import fs from "node:fs";
import path from "node:path";
const sharp = createRequire(process.cwd() + "/package.json")("sharp");

const ROOT = "public", out = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".png")) out.push(p);
  }
};
walk(path.join(ROOT, "sprites"));
const list = [];
for (const f of out.sort()) {
  const m = await sharp(f).metadata();
  list.push([`/${path.relative(ROOT, f).split(path.sep).join("/")}`, m.width, m.height]);
}
fs.writeFileSync("lib/props/sprites.json", "[\n" + list.map((x) => "  " + JSON.stringify(x)).join(",\n") + "\n]\n");
console.log(`${list.length} pictures → lib/props/sprites.json`);
