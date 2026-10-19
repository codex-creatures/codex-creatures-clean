// scripts/game-status.mjs — used by "Start Game.bat".
// Is Codex Creatures already running on this port?
//
//   node scripts/game-status.mjs [port]      (default 3000)
//
// Exit code 0: yes, the game answers there.
//           1: nothing is on the port, so it's free to start the game.
//           2: something else is using the port.
// Only looks at localhost; needs no internet.
// (Plain node:http, not fetch, and exitCode, not process.exit(): on Windows,
// exiting straight after a fetch can crash Node with exit code 127.)
import http from "node:http";
import net from "node:net";

const PORT = Number(process.argv[2] ?? 3000);

// Does anything answer on this address?
const answers = (host) => new Promise((resolve) => {
  const socket = net.connect({ port: PORT, host });
  const done = (yes) => { socket.destroy(); resolve(yes); };
  socket.setTimeout(700, () => done(false));
  socket.once("connect", () => done(true));
  socket.once("error", () => done(false));
});

// The home page's HTML, or null. A dev server that's still compiling can
// take a while to answer the first request, hence the long wait.
const page = () => new Promise((resolve) => {
  const req = http.get({ host: "localhost", port: PORT, path: "/", agent: false, timeout: 60_000 }, (res) => {
    let body = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve(body));
    res.on("error", () => resolve(null));
  });
  req.on("timeout", () => req.destroy());
  req.on("error", () => resolve(null));
});

if (!(await answers("127.0.0.1")) && !(await answers("::1"))) {
  process.exitCode = 1;
} else {
  process.exitCode = (await page())?.includes("Codex Creatures") ? 0 : 2;
}
