// play.js — serves the game in ./game at http://localhost:8123 (any OS with Node).
// Your save lives in the browser for this address, so always use this port.
const http = require("http"), fs = require("fs"), path = require("path"), { exec } = require("child_process");
const PORT = 8123, ROOT = path.join(__dirname, "game");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".gif": "image/gif" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file)) { file = path.join(ROOT, "404.html"); res.statusCode = 404; }
  res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`Codex Creatures is running at ${url} — keep this window open while you play.`);
  if (!process.env.NO_OPEN) exec(process.platform === "win32" ? `start "" ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`);
});
