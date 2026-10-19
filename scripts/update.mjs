// scripts/update.mjs — used by "Update.bat".
// Brings this computer up to date with GitHub, safely:
//
//   1. you must be on main, with nothing uncommitted (else it stops);
//   2. checks GitHub can be reached (else it stops: you're probably offline);
//   3. `git pull --ff-only origin main` — only ever moves forward. If this
//      computer has commits GitHub doesn't, it stops and explains;
//   4. `npm ci` if package.json / package-lock.json changed (or nothing's installed).
//
// It never pushes, resets, merges, stashes or discards anything, and it
// doesn't touch your save (that lives in the browser, not in this folder).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import net from "node:net";

const BRANCH = "main";
const say = (s = "") => console.log(s ? `  ${s}` : "");
const stop = (lines) => {
  console.log();
  for (const l of lines) say(l);
  console.log("\n  ✖ Not updated. Your files and commits are untouched.\n");
  process.exit(1);
};
// Run git and return its output (trimmed); throws on failure.
// (GIT_TERMINAL_PROMPT=0: fail rather than sit waiting for a typed password.)
const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }).trim();
const tryGit = (...args) => { try { return { ok: true, out: git(...args) }; } catch (e) { return { ok: false, out: `${e.stderr ?? e.message}`.trim() }; } };

say("Codex Creatures — update from GitHub");
console.log();

// 1. Where are we, and is everything committed?
if (!tryGit("rev-parse", "--is-inside-work-tree").ok) stop(["This folder isn't a Git repository."]);
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== BRANCH) {
  stop([
    `You're on the branch "${branch}", not "${BRANCH}".`,
    `Switch with:  git switch ${BRANCH}   (after committing your work), then run this again.`,
  ]);
}
const dirty = git("status", "--porcelain");
if (dirty) {
  stop([
    "You have changes that aren't committed yet:",
    "",
    ...dirty.split("\n").slice(0, 20).map((l) => `    ${l}`),
    ...(dirty.split("\n").length > 20 ? ["    …"] : []),
    "",
    "Commit them first (or ask Claude to), then run this again.",
    "(?? means a new file Git isn't tracking yet.)",
  ]);
}

// 2. Can we reach GitHub? (ls-remote asks GitHub for main's latest commit
//    without changing anything here.)
say("Checking GitHub…");
const remote = tryGit("ls-remote", "--heads", "origin", BRANCH);
if (!remote.ok) {
  stop([
    "Couldn't reach GitHub. Are you online?",
    "(The game still works offline: you just can't fetch new code right now.)",
    "",
    `Git said: ${remote.out.split("\n")[0]}`,
  ]);
}

// 3. Fetch, then see how this computer and GitHub compare.
const before = git("rev-parse", "HEAD");
const fetched = tryGit("fetch", "origin", BRANCH);
if (!fetched.ok) stop(["Couldn't download from GitHub.", `Git said: ${fetched.out.split("\n")[0]}`]);
const [ahead, behind] = git("rev-list", "--left-right", "--count", `HEAD...origin/${BRANCH}`).split(/\s+/).map(Number);

if (ahead > 0 && behind > 0) {
  stop([
    `This computer and GitHub have each moved on: ${ahead} commit(s) here aren't on GitHub,`,
    `and ${behind} on GitHub aren't here. Their histories have split.`,
    "",
    "Don't force anything. Ask Claude to look at it, or compare with:",
    `    git log --oneline --graph HEAD origin/${BRANCH} -n 20`,
  ]);
}

let pulled = false;
if (behind === 0) {
  say("Already up to date with GitHub.");
  if (ahead > 0) say(`(This computer has ${ahead} commit(s) GitHub doesn't have yet: push them with  git push origin ${BRANCH})`);
} else {
  say(`Getting ${behind} new commit(s)…`);
  const pull = spawnSync("git", ["pull", "--ff-only", "origin", BRANCH], { stdio: "inherit" });
  if (pull.status !== 0) stop(["git pull --ff-only failed (see above). Nothing was merged or overwritten."]);
  pulled = true;
}
const after = git("rev-parse", "HEAD");

// 4. Packages: reinstall only when they changed (or aren't installed).
// PENDING remembers a reinstall that couldn't happen last time (npm ci
// starts by deleting node_modules, so it goes away once one succeeds).
const PENDING = "node_modules/.codex-needs-install";
const depsChanged = pulled && tryGit("diff", "--quiet", before, after, "--", "package.json", "package-lock.json").ok === false;
const missing = !existsSync("node_modules/next/package.json");
if (depsChanged || missing || existsSync(PENDING)) {
  // npm ci deletes node_modules first, which fails on Windows while the
  // game is running from this folder (its files are in use). With nothing
  // installed, it can't be.
  const running = !missing && await new Promise((resolve) => {
    const s = net.connect({ port: 3000, host: "127.0.0.1" });
    const done = (yes) => { s.destroy(); resolve(yes); };
    s.setTimeout(700, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
  if (running) {
    writeFileSync(PENDING, "Update.bat: run npm ci (package.json / package-lock.json changed)\n");
    console.log();
    say("The code is updated, but its packages changed, and the game is running");
    say("(port 3000 is in use), so they can't be reinstalled now.");
    say("Close the game's window (or Ctrl+C in its terminal), then run Update.bat again.");
    console.log("\n  ⚠ Partly updated: run Update.bat again once the game is closed.\n");
    process.exit(1);
  }
  console.log();
  say(missing ? "Installing the game's packages (npm ci)…" : "Packages changed: reinstalling them (npm ci)…");
  const ci = spawnSync("npm ci", { stdio: "inherit", shell: true });
  if (ci.status !== 0) {
    console.log("\n  ⚠ The code is updated, but `npm ci` failed (see above). Run Update.bat again, or `npm ci` yourself.\n");
    process.exit(1);
  }
}

console.log();
if (pulled) {
  say(`Updated ${before.slice(0, 7)} → ${after.slice(0, 7)}:`);
  for (const l of git("log", "--oneline", `${before}..${after}`).split("\n").slice(0, 15)) say(`    ${l}`);
}
say(`On ${BRANCH} at ${git("log", "-1", "--format=%h %s")}`);
console.log("\n  ✔ Done.\n");
