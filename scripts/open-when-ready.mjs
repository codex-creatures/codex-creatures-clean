// scripts/open-when-ready.mjs — used by "Start Game.bat".
// Waits for the game to answer, then opens it in the default browser.
//
//   node scripts/open-when-ready.mjs [port]      (default 3000)
//
// The dev server's first page can take a little while to compile, so this
// keeps asking for up to 3 minutes. Only looks at localhost.
// (Plain node:http, not fetch: see game-status.mjs.)
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.argv[2] ?? 3000);
const URL = `http://localhost:${PORT}`;
const GIVE_UP = Date.now() + 3 * 60_000;

const ready = () => new Promise((resolve) => {
  const req = http.get({ host: "localhost", port: PORT, path: "/", agent: false, timeout: 30_000 }, (res) => {
    res.resume();
    resolve(res.statusCode < 500);
  });
  req.on("timeout", () => req.destroy());
  req.on("error", () => resolve(false));
});

let up = false;
while (!(up = await ready()) && Date.now() < GIVE_UP) {
  await new Promise((r) => setTimeout(r, 1000));
}
if (up) {
  // "start" is the Windows way to open a link in the default browser.
  spawn("cmd", ["/c", "start", "", URL], { detached: true, stdio: "ignore" }).unref();
} else {
  console.error(`\n  The game didn't answer at ${URL}. Check the messages above.\n`);
  process.exitCode = 1;
}
