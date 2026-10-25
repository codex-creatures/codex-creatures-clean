# Codex Creatures: notes for Claude Code

Read this first, on either computer. The game design, and what's built vs only planned, is in
**[docs/design.md](docs/design.md)**: read the relevant section before changing game logic.
Setup, running and the two-computer routine for the human are in [README.md](README.md).

## What this is

A creature-collecting game: scan real barcodes for creatures and loot, then take a team of 3 into
the Labyrinth (a roguelike run of rooms) with turn-based battles. Mobile-first, and headed for
iOS/Android one day. Right now it's a single-player **browser game with no backend**.

**It's hosted on Vercel** (since 2026-10-23), as a static site: Vercel builds and deploys `main`
automatically on every push to GitHub. **So a push to `main` is a release:** players get it
straight away. The address: **https://codex-creatures-clean.vercel.app/**. The game itself still has no server: everything still runs in the browser.

- Next.js 16 (App Router), React 19, TypeScript, Vitest 3. **No other runtime dependency** apart
  from `@zxing/browser` (barcode scanning).
- Every page is a client component. All state is in the browser's `localStorage`.
- There's no server, API, database, account, analytics or secret key, and nothing should need one.

## Hard rules

1. **Fully offline.** The game, `npm run dev`, `npm test`, `npm run build` and
   `npm run build:offline` must keep working with no internet. That means no CDN scripts, no
   `next/font/google` (fonts are local in `app/fonts/`), no remote images, and no runtime API
   calls. Art lives in `public/sprites/`. Ask the user before adding anything that needs the internet
   to play: cloud saves, auth, external APIs, remote databases. Dev-time services (GitHub, Claude,
   PixelLab) are fine.
2. **Saves stay compatible.** Saves are the user's progress, kept separately on each computer.
   - Don't rename or reshape the storage keys without code that reads the old data:
     `codex_creatures_save_v2` (lib/save.ts), `codex_creatures_registry_v2`
     (lib/barcodeRegistry.ts), `codex_creatures_battles_v1` (lib/battleHistory.ts),
     `codex_creatures_backup_v1` (lib/saveFile.ts), and the save slots `codex_creatures_slots_v1`
     plus `codex_creatures_slot_<id>` (lib/saveSlots.ts). Per device, not in saves:
     `codex_creatures_ui_scale_v1` (lib/uiScale.ts, Settings → Screen size) and
     `codex_creatures_haptics_v1` (lib/haptics.ts, Settings → Vibration).
   - New save fields must be optional, with a default for old saves. (Recent ones: `storage`, the
    chest boxes built bigger; a creature or card's `soulStone`, where missing means "roll it on
    load" and `null` means none.)
   - Exported save files must stay importable: bump `SAVE_FILE_VERSION` (lib/saveFile.ts) only
     together with a reader for the older version.
   - **Never write saves on the user's real addresses** while testing: http://localhost:3000, the
     offline copy on :8123, the Vercel site (codex-creatures-clean.vercel.app), or their phone. Each address keeps its own saves
     (moving progress between them is Settings → Export / Import). Checks that load the game in a browser use a scratch
     port or a temporary clone.
3. **Don't redesign settled mechanics.** docs/design.md marks each thing as built, decided,
   provisional or open. Change decided numbers (rarity odds, roll budgets, the triangle, XP curves,
   creature stats) only when the user asks, and present balance findings as options. Never present
   brainstorming as decided.
4. **Leave the scanner alone.** Camera/scanner work is parked; it's fragile. Test with manual barcode
   entry.
5. **Kept separate from Vouchee.** This repo has nothing to do with the user's Vouchee business
   (its repos, Vercel, Supabase, credentials). Don't reference, copy or touch any of it from here.
   (This game's own Vercel project is fine to mention; Vouchee's Vercel projects stay off limits.)
6. **No secrets in the repo.** The PixelLab API key is set up per machine in Claude Code's MCP
   config, never in files. `.env*` is gitignored.

## Git and the two computers

The user develops on a **main PC** and a **travel laptop** (both Windows, Node 24, Cursor + Claude
Code), with GitHub (`origin`, https://github.com/codex-creatures/codex-creatures-clean) between
them. **`main` is the working branch.** Other old branches exist; leave them alone.

- **At the start of a session:** run `git status`, then, when online, `git fetch origin`. If
  behind, run `git pull --ff-only origin main` (or the user's `Update.bat`). Don't pull over
  uncommitted changes.
- **If histories have split** (a fast-forward is refused), there are uncommitted changes, or
  anything else looks off: stop and explain. Never merge divergent histories on your own, and
  never `push --force`, `reset --hard`, `checkout -- .`, `clean`, or stash-and-drop.
- **Commit only finished, tested work,** on `main`, with plain-English messages that say what
  changed for the player, like the existing log. Push with `git push origin main`, then confirm it
  arrived: `git status` should say up to date with `origin/main`, or compare
  `git rev-parse HEAD origin/main`. Don't claim a push worked without checking. Ask before
  pushing if the user hasn't asked for it: a push also goes live on Vercel.
- Line endings are set by `.gitattributes`: LF in the repo, CRLF only for `.bat`/`.cmd`. Don't
  mass-convert files.
- Claude's memory folder is per machine. Anything both computers need goes in this file or in
  docs/design.md.

## Commands

| | |
|---|---|
| `npm run dev` | dev server, **always port 3000** (`scripts/check-port.mjs` refuses if busy: saves are per address) |
| `npm test` | Vitest, `tests/*.test.ts` (~320 tests; a few minutes on the main PC, where the slow roll/map tests can hit their time limits under load: rerun those alone before suspecting a bug) |
| `npx tsc --noEmit` | type check |
| `npm run lint` | ESLint |
| `npm run build:offline` | static export into `codex-offline/` with `Play (Windows).bat` (PowerShell server on :8123) |
| `Start Game.bat` / `Update.bat` | the user's double-click launchers (`scripts/game-status.mjs`, `open-when-ready.mjs`, `update.mjs`) |

The user may already have the dev server running on :3000. Check before starting one, and never
kill theirs.

## Layout

- `app/<screen>/page.tsx`: screens. `/` is the Den (home). Others: `dungeon` (the Labyrinth),
  `battle`, `altar` (scanning, the "Soul Altar"), `chest` (Inventory), `bag`, `bookcase`, `cage`,
  `pool`, `pit`, `klutz`, `crate`, `guide`, `settings` (save export/import/backup), `start`
  (the title screen: save slots).
  `lab/*` and `simulator` are dev tools (balance sims, room previews) and sit outside the phone
  frame.
- `hooks/useGameState.ts`: the game state, plus load/save. `hooks/useDropGeneration.ts`: scan
  drops.
- `lib/`: the rules, kept pure where possible and tested.
  - `combat/`: `engine.ts` (damage, triangle, stances), `battle.ts` (actions, statuses),
    `teamBattle.ts` (3v3, swaps), `thinkingAi.ts`, `bossAi.ts`, `loadout.ts`.
  - `creatures/`: `creatureData.ts` (species, moves), `levels.ts`, `creatureRoll.ts`,
    `summon.ts`, `bosses.ts`, `starter.ts`, `soulStones.ts` (soul stones: replaced the old abilities).
  - `dungeon/`: `run.ts` (the run: rooms, mixes, bag, pool, dungeons), `map.ts` (scroll map,
    routes), `chamber.ts` (room drawing), `witch.ts`.
  - `items/`: stat rolling (`rollConfig.ts`, `budgets.ts`, `ceilings.ts`: **the user's most
    carefully balanced system**), armour, `materials.ts`.
  - `barcodeRegistry.ts`, `drops.ts`, `klutz.ts`, `quest.ts`, `save.ts`, `saveFile.ts`, `den/scene.ts`.
  - `sprites/`: art registry (`art.ts` `withArt`, `creatures.ts` `ART_SIZES`, `items.ts`, `props.ts`).
- `components/`: `GameScreen.tsx` (the fixed phone screen and trim), `DenFrame` (header + scroll +
  dock), `BattleScreen`, `BossStage`, `CardGallery` (`CardFace`, the card standard), `LootWindow`,
  `Help.tsx` (the "?" panels), `CreaturePortrait`, and others.
- `public/sprites/`: all art (PixelLab), with IDs recorded in `public/sprites/PIXELLAB.md`.
- `offline/`: the standalone copy's builder and launchers.
- `tests/`: Vitest, one file per system.

## Conventions

- **Match the surrounding code:** short helpers, comments that explain *why* in plain English,
  tuning numbers as named `export const`s at the top of the module (e.g. `ROOM_MIX`, `FREE_RUNS`).
- **Game rules go in `lib/` with a test.** Changes to the rules need a test or a sim result. Run
  `npm test` and `npx tsc --noEmit` before committing.
- **UI follows the user's settled standards** (details in docs/design.md → UI):
  - Everything fits inside the one fixed phone-sized screen (`GameScreen`). Use `cqw`/`cqh`, not
    `vw`/`vh`. Long lists scroll inside a panel; the page never grows. Actions sit in docks, not
    floating buttons.
  - Touch first: tap targets of 44px or more, and no hover-only information.
  - **Few words on screen.** Depth goes behind a "?" (`components/Help.tsx`).
  - The stone card look (`CardFace` / `.inv-panel`, yellow pixel font #f1d9a0, rarity trim).
  - **Fixed structure, text fits it.** Every window is a fixed frame of boxes. Flicking between
    items, creatures or tabs changes only the words and pictures inside them; no box, slot, bar or
    button moves. Give each varying bit of text a fixed number of lines (clamp with "…", full text
    on hover or behind "?"), keep optional parts' space when they're absent (`visibility: hidden`),
    and anchor windows to the top rather than centring content of varying height.
- **Art comes from PixelLab** (the `pixellab` MCP, set up per machine). Don't hand-draw detailed
  sprites in code: that was tried and scrapped. Samples first, and the user's approval before a
  full rollout. When the user supplies their own art, restyle it and keep their design.
- **Reports to the user:** plain English, short, with specific questions. Say what changed, which
  tests passed, and whether it's pushed. The user's on a usage budget: keep sessions to one task,
  and end a finished task with a reminder to `/clear`.
- **No browser checks** unless you can say why tests can't cover it, and the user agrees first.
  They cost about 6x a plain request (69% of all usage, Oct 2026). Rely on tests; the user
  looks in the game and sends a screenshot if something's off.
