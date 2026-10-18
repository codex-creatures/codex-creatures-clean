// offline/build.js — `npm run build:offline`
// Builds a static copy of the game and packs it with tiny launchers into
// codex-offline/, a folder you can copy to any laptop and play with no
// internet (see offline/README.md).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dest = path.join(root, "codex-offline");

execSync("npx next build", { cwd: root, stdio: "inherit", env: { ...process.env, OFFLINE_BUILD: "1" } });

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest);
fs.cpSync(path.join(root, "out"), path.join(dest, "game"), { recursive: true });
for (const f of ["play.ps1", "play.js", "Play (Windows).bat", "README.md"]) fs.copyFileSync(path.join(__dirname, f), path.join(dest, f));
console.log(`\nDone: ${dest}\nCopy that folder to the laptop and open "Play (Windows).bat" (or run: node play.js).`);
