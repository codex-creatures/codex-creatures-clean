# Codex Creatures

Scan barcodes to discover creatures and loot, then take them into the Labyrinth.

The whole game runs **in the browser**. There's no server, account, database,
API or secret key behind it. Your save lives in the browser on your computer.
It works **fully offline** once it's installed.

- **Tech:** Next.js 16 (App Router), React 19, TypeScript, Vitest.
- **Branch:** `main` is the primary branch. Work there, or on a short-lived branch merged back into it.

---

## 1. Install on a Windows PC or laptop (once, while online)

1. Install **Git for Windows**: https://git-scm.com/download/win
   Keep the defaults, especially *"Checkout Windows-style, commit Unix-style line endings"*,
   so both computers treat line endings the same way.
2. Install **Node.js 24 LTS** (the "LTS" button): https://nodejs.org
   Next.js needs at least Node 20.9; both computers should use 24.
3. Install **Cursor**: https://cursor.com (and Claude Code, if you use it).
4. Open **PowerShell** (or Cursor's terminal) and run:

   ```powershell
   cd $HOME\Desktop
   git clone https://github.com/codex-creatures/codex-creatures-clean.git
   cd codex-creatures-clean
   npm ci
   ```

   `npm ci` installs exactly the versions in `package-lock.json`. The first
   `git clone` asks you to sign in to GitHub in a browser window.
5. Check it works:

   ```powershell
   npm test
   npm run dev
   ```

   Open **http://localhost:3000**. Stop the game with **Ctrl+C** in the terminal.

After this, everything works with no internet: `npm run dev`, `npm test`, `npm run build:offline`
and the game itself. You only need the internet again to pull/push code or to reinstall packages.

## 2. Running the game

| What | Command | Address |
|---|---|---|
| Develop and play | `npm run dev` | http://localhost:3000 |
| On your phone (same Wi-Fi) | `npm run dev` | http://&lt;this PC's IP&gt;:3000 (the terminal shows it under "Network") |
| A standalone copy (no Node needed to play) | `npm run build:offline` | http://localhost:8123 |
| Tests | `npm test` | — |

**Port 3000 is fixed on purpose.** The browser keeps your save *per address*, so if the game
moved to port 3001 it would look like an empty save. If 3000 is busy, `npm run dev` stops with a
message saying so: the game is probably already running in another terminal tab. Close that one
(Ctrl+C there) or just use it.

### The standalone offline copy

`npm run build:offline` makes a `codex-offline` folder. Copy it anywhere (USB stick, another
laptop) and double-click **`Play (Windows).bat`**. It uses Windows' own PowerShell, so that computer
needs nothing installed. Keep the window open while you play. Copying a newer build over the old
folder keeps your save.

## 3. Your save

Your progress is saved automatically **in the browser, for the address you play at**:

- http://localhost:3000 (dev server), http://localhost:8123 (offline copy) and your phone each
  have **their own, separate save**;
- so do different browsers (Chrome vs Edge) and different computers;
- **clearing your browsing data deletes it.**

A save has three parts, all included in an export: progress (everything, the Labyrinth too),
the barcode registry (what each barcode you've scanned gives), and battle history.

### Moving your save between computers

1. On the computer you've been playing on: open the game, tap **⚙️** (top right of the Den) →
   **⬇️ Export save**. A file like `codex-creatures-save-2026-10-19-0942.json` lands in Downloads.
2. Move that file across (OneDrive/Google Drive, email it to yourself, USB stick).
3. On the other computer: **⚙️ → ⬆️ Import save**, pick the file, check what it shows, then
   **Replace my save**. The game restarts with it.

Importing is safe:

- the file is checked first; a damaged or wrong file is refused with a message and **nothing changes**;
- a save from a *newer* version of the game is refused (pull the latest code first);
- your current save is **backed up automatically** before it's replaced;
- **↩️ Restore backup** (in ⚙️) brings that backup back, and the save it replaces becomes the backup,
  so a restore can be undone too.

Only the *last* save before an import is kept as the backup. For anything you care about, keep
exported files (one per day is plenty). They're small.

## 4. Working on two computers (PC ↔ laptop)

GitHub is the meeting point. The one rule is: **pull when you sit down, push when you get up.**

**Starting a session** (in the project folder):

```powershell
git status          # should say "nothing to commit, working tree clean"
git pull            # get what you did on the other computer
npm ci              # only if package.json / package-lock.json changed
npm run dev
```

**Finishing a session:**

```powershell
git status                       # see what changed
git add -A
git commit -m "What I changed"
git push
```

And if you want to carry on *playing* where you left off, export your save (section 3).

**Tips**

- Don't leave work uncommitted on one computer and then start editing the same files on the other.
  That's how you end up merging by hand.
- If `git pull` says your local changes would be overwritten, commit them first, then pull again.
- If `git push` is rejected ("fetch first"), run `git pull`, then `git push`.
- Never use `git push --force` here.
- Working offline is fine: commit as usual (commits are stored locally) and `git push` once you're
  back online. Pull on the other computer before working there.

## 5. Offline: what works and what doesn't

Works offline:

- the game, `npm run dev`, `npm test`, `npm run build`, `npm run build:offline`;
- all art and fonts (everything is in this repo: `public/` and `app/fonts/`);
- webcam barcode scanning (localhost counts as a secure page).

Needs the internet:

- `git pull` / `git push` / `git clone`, and `npm ci` / `npm install`;
- **Claude Code**: it runs on Anthropic's servers, so it won't work offline. Cursor's AI features
  are the same. You can still edit code by hand.
- **PixelLab** (new art): an online service. Art already in `public/sprites` keeps working offline.

Per-computer setup that isn't in GitHub:

- Claude Code's memory/notes for this project live in your user folder
  (`%USERPROFILE%\.claude\projects\…`), not in the repo. The laptop starts without them.
- The PixelLab connection (its API key) is set up in Claude Code on each computer. **Never put that
  key, or any other key, in this repo.** (`.gitignore` already ignores `.env*` files.)

## 6. Project layout

- `app/`: the screens (each folder is a page; `app/settings` is the save manager).
- `components/`: shared UI.
- `lib/`: the game rules (combat, Labyrinth, items, saves: `lib/save.ts`, `lib/saveFile.ts`).
- `hooks/useGameState.ts`: the game's state, loaded from and saved to the browser.
- `public/sprites/`: all the art (see `public/sprites/PIXELLAB.md`).
- `app/fonts/`: the fonts (open-licensed; licences next to them).
- `offline/`: the standalone copy's launchers (`npm run build:offline`).
- `scripts/check-port.mjs`: stops `npm run dev` with a clear message if port 3000 is taken.
- `tests/`: `npm test`.
