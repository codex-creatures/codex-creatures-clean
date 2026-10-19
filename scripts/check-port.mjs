// scripts/check-port.mjs — runs before `npm run dev` (the "predev" script).
// The game must always run on port 3000: the browser keeps your save per
// address, so on another port (3001…) you'd find an empty game. Next is told
// to use 3000 only (-p 3000); this just explains clearly if it's taken.
//
// "Taken" is checked two ways, because on Windows a server on 0.0.0.0 (IPv4)
// doesn't stop another from opening the same port on :: (IPv6): can we
// connect to it (something's answering), and can we open it on IPv4 ourselves?
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

// Can we open it ourselves?
const free = (host) => new Promise((resolve) => {
  const server = net.createServer();
  server.once("error", (err) => resolve(err.code !== "EADDRINUSE"));
  server.once("listening", () => server.close(() => resolve(true)));
  server.listen(PORT, host);
});

const busy = (await answers("127.0.0.1")) || (await answers("::1")) || !(await free("0.0.0.0"));
if (busy) {
  console.error(`
  ✖ Port ${PORT} is already in use, so Codex Creatures can't start.

    Most likely the game is already running in another terminal (in Cursor,
    check the other terminal tabs and press Ctrl+C there), or a dev server
    was left running. To find it: Task Manager → Details → "node.exe".
    If it's already running, just open http://localhost:${PORT}.

    The game only runs on port ${PORT} on purpose: your save lives in the
    browser for http://localhost:${PORT}, and another port would look like an
    empty save.
`);
  process.exit(1);
}
