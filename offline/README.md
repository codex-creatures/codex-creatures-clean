# Codex Creatures — offline

Everything in the game runs in the browser, so this folder is the whole game.
No internet needed.

## Play

- **Windows:** double-click `Play (Windows).bat`. A window opens (keep it open
  while you play) and the game opens in your browser at http://localhost:8123.
- **Mac / Linux (or Windows with Node):** `node play.js`.

Your save is kept by the browser for `http://localhost:8123`, so always play
through the launcher, in the same browser. Scanning with a webcam works here too
(localhost counts as a secure page).

## Making a fresh copy (on the dev machine)

    npm run build:offline

That rebuilds `codex-offline/`. Copy the whole folder to the laptop (USB stick,
zip, cloud drive…). Copying a new version over the old one keeps your save.
