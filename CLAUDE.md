# Codex Creatures: notes for Claude Code

Read this first, on either computer. It holds the working rules. The design and technical specs are
split by subsystem: **[docs/README.md](docs/README.md)** says which file covers what and which one
wins. Setup, running and the two-computer routine for the human are in [README.md](README.md).

## What this is

A creature-collecting game: scan real barcodes for creatures and loot, then take a team of 3 into
the Labyrinth (a roguelike run of rooms) with turn-based battles. Mobile-first, and headed for
iOS/Android one day. A **browser game** whose online features (sign-in, cloud saves, the global
registry, leaderboards, PvP) run on its own Supabase project ([docs/design/online.md](docs/design/online.md)).

**It's hosted on Vercel** (since 2026-10-23) as a static site: Vercel builds and deploys `main`
on every push to GitHub. **So a push to `main` is a release:** players get it straight away.
The address: **https://codex-creatures-clean.vercel.app/**. The game itself has no server of its
own: everything else runs in the browser.

- Next.js 16 (App Router), React 19, TypeScript, Vitest 3. **No other runtime dependency** apart
  from `@zxing/browser` (barcode scanning), `@supabase/supabase-js`, and `three` with
  `@react-three/fiber` (approved 2026-11-10 for the 3D prototype; approved for the game's walkable
  dungeons the same day, decision 38; versions pinned exactly).
- Every page is a client component. Game state is in the browser's `localStorage`.
- Server logic lives only in the game's own Supabase project (e.g. the registry roll), kept in the
  repo (`supabase/migrations`) so it can be rebuilt. No analytics. Supabase's public (anon) key may
  go in the client build; its service key never goes in the repo or the client.

## Hard rules

1. **Plays offline; online features are extra.** (Going online was decided 2026-10-31.) The rest of
   the game must still work in offline mode: offline scans wait as sealed caches, and trading and
   PvP are off. `npm run dev`, `npm test`, `npm run build` and `npm run build:offline` must keep
   working with no internet, so keep all Supabase calls behind one module that tests can do
   without. No CDN scripts, no `next/font/google` (fonts are local in `app/fonts/`) and no remote
   images. Art lives in `public/sprites/`. Ask the user before adding any online service beyond the
   game's own Supabase project, Google sign-in (in use, 2026-10-31) and Resend (approved 2026-10-31
   for sign-in emails once the game has a domain; set up in Supabase's SMTP settings, not in code).
   Dev-time services (GitHub, Claude, PixelLab) are fine.
2. **Saves stay compatible.** Saves are the user's progress, kept separately on each computer.
   - Don't rename or reshape the storage keys without code that reads the old data:
     `codex_creatures_save_v3` (lib/save.ts), `codex_creatures_registry_v3`
     (lib/barcodeRegistry.ts), `codex_creatures_battles_v2` (lib/battleHistory.ts),
     `codex_creatures_backup_v1` (lib/saveFile.ts), and the save slots `codex_creatures_slots_v2`
     plus `codex_creatures_slot2_<id>` (lib/saveSlots.ts). (These moved on 2026-10-26, when the
     user chose a fresh start for Combat V2: saves from before it are left in the browser, unread,
     and pre-V2 save files are refused. That was the user's call; don't do it again unasked.)
     Per device, not in saves: `codex_creatures_ui_scale_v1` (lib/uiScale.ts),
     `codex_creatures_haptics_v1` (lib/haptics.ts), `codex_creatures_camera_v1` (lib/scanner.ts),
     `codex_creatures_auth_v1` (lib/online/client.ts), `codex_creatures_cloud_v1` and
     `codex_creatures_cloud_last_v1` (lib/online/cloudSave.ts).
   - New save fields must be optional, with a default for old saves (e.g. `storage`; a creature or
     card's `soulStone`, where missing means "roll it on load" and `null` means none).
   - Exported save files must stay importable: bump `SAVE_FILE_VERSION` (lib/saveFile.ts) only
     together with a reader for the older version.
   - **Walkable runs carry a world version** (`WALK_V`, now 9). A run keeps the placement rules it
     was made with for good: pin the current version before changing placement rules, and make new
     rules a new world version ([docs/world/persistence.md](docs/world/persistence.md)).
   - **Never write saves on the user's real addresses** while testing: http://localhost:3000, the
     offline copy on :8123, the Vercel site, or their phone. Each address keeps its own saves
     (moving progress between them is Settings → Export / Import). Checks that load the game in a
     browser use a scratch port or a temporary clone.
3. **Don't redesign settled mechanics.** The docs mark each thing as built, decided, provisional or
   open. Change decided numbers (rarity odds, roll budgets, the races and the old triangle, XP
   curves, creature stats) only
   when the user asks, and present balance findings as options. Never present brainstorming as
   decided, and never treat a historical or archived proposal as a requirement.
4. **Leave the scanner alone unless asked.** The camera (components/BarcodeScanner.tsx, rules in
   lib/scanner.ts) is fragile and only testable on real phones. Test with manual barcode entry.
5. **Kept separate from Vouchee.** This repo has nothing to do with the user's Vouchee business
   (its repos, Vercel, Supabase, credentials). Don't reference, copy or touch any of it from here.
   (This game's own Vercel project is fine to mention; Vouchee's Vercel projects stay off limits.)
6. **No secrets in the repo.** The PixelLab API key is set up per machine in Claude Code's MCP
   config, never in files. `.env*` is gitignored.

## How to work: read only what the task needs

1. **Name the subsystem** the task touches, find its file in [docs/README.md](docs/README.md), then
   the section (`grep -n "^#" <file>`, or grep a constant across `docs/`). Never read whole large
   docs by default.
2. **Read that section and the code it names;** widen only when they point further. Read broadly
   (the whole file, linked specs, [docs/decisions.md](docs/decisions.md)) only for architecture,
   core rules, saves or cross-system behaviour.
3. **What counts:**
   - **Code determines what is currently implemented** (numbers included).
   - **Approved design specs determine intended behaviour** (the subsystem files; ⚠️ notes say
     which passage wins).
   - **If code and an approved spec conflict, flag the discrepancy** rather than silently choosing
     one, and add it to [docs/decisions.md](docs/decisions.md#conflicts-to-resolve).
   - **Historical docs are reference, not active requirements:** [docs/history.md](docs/history.md),
     `docs/archive/` and `docs/ideas/`. Open them only when asked how something came about, or
     before reopening something tried.
4. **Keep established decisions** unless told otherwise. Never resolve a conflict between docs, or
   docs and code, silently: say so, and add it to [docs/decisions.md](docs/decisions.md#conflicts-to-resolve).
5. **Change behaviour, update its doc in the same commit:** the subsystem file in place (no dated
   rounds), [docs/roadmap.md](docs/roadmap.md) when planned work is built,
   [docs/decisions.md](docs/decisions.md) for lasting decisions; for the walkable world, the "as
   built" sections (proposals and approval gates go in the commit message).
6. **Stay small:** targeted changes and focused tests while working; no re-reading, no exploring
   past the task, short summaries.

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
  `docs/`.

## Commands

| | |
|---|---|
| `npm run dev` | dev server, **always port 3000** (`scripts/check-port.mjs` refuses if busy: saves are per address) |
| `npm test` | Vitest, `tests/*.test.ts`, quick (~15s): skips the slow map sweeps (`slowIt`, tests/slow.ts). Use it while working |
| `npm run test:all` | every test, 2–5 min. Run once before each commit or push |
| `npm run test:stress` | the layout bench (tests/layoutBench.test.ts) |
| `npx tsc --noEmit` | type check |
| `npm run lint` | ESLint |
| `npm run registry:rules` | after changing scan odds, rarity weights, species, weapon/armour kinds or soul stones: writes a migration with the global registry's new rules (then apply it to Supabase). A test fails until it's done |
| `npm run setup:google` | one-off: sets up Google sign-in (the user runs it in their own terminal: it asks for secrets) |
| `npm run build:offline` | static export into `codex-offline/` with `Play (Windows).bat` (PowerShell server on :8123) |
| `Start Game.bat` / `Update.bat` | the user's double-click launchers (`scripts/game-status.mjs`, `open-when-ready.mjs`, `update.mjs`) |

The user may already have the dev server running on :3000. Check before starting one, and never
kill theirs.

## Code map

- `app/<screen>/page.tsx`: screens. `/` is the Den (home); `dungeon` (the Labyrinth), `battle`,
  `altar` (scanning), `chest` (Inventory), `bag`, `bookcase`, `cage`, `pool`, `pit`, `training`,
  `klutz`, `crate`, `guide`, `board` (quests, leaderboards, friends), `duel`, `pvp`, `settings`,
  `start` (title screen: components/OnlineStart.tsx online, components/LocalStart.tsx without),
  `privacy` (update it whenever online features change what's stored). `lab/*` are dev tools
  outside the phone frame (`/lab/placement`, `/lab/newrun`, `/lab/walk`, `/lab/three` the 3D prototype…).
- `hooks/useGameState.ts`: the game state, plus load/save. `hooks/useDropGeneration.ts`: scan drops.
- `lib/`: the rules, kept pure where possible and tested.
  - `combat/` (engine, battle, teamBattle, AIs, loadout); `creatures/` (species and moves, levels,
    rolls, summoning, bosses, starter, soul stones); `items/` (stat rolling: `rollConfig.ts`,
    `budgets.ts`, `ceilings.ts`, **the user's most carefully balanced system**; armour, materials).
  - `dungeon/`: runs (`run.ts`), the scroll map (`map.ts`), walkable layouts (`layout.ts`,
    `interior.ts`), walking, foes, torches and candles (`torch.ts`), campfires, `chamber.ts`, `witch.ts`,
    `people.ts` (the people who wander, and the locators).
  - `world/`: the walkable world (units, grid, objects, occupancy, policy, place, placements,
    migrate, version, walkWorld, walkSim, compat). `render/`: projection and the scene builder.
    `render3d/`: the 3D prototype's geometry and its Stone mode's texture and light rules (components/WalkView3D.tsx; world/rendering.md §4.8).
  - `barcodeRegistry.ts`, `scanning.ts`, `drops.ts`, `pvp/`, `online/` (the one Supabase module
    family: client, registry, cloud saves, friends, duel channel), `klutz.ts`, `quest.ts`,
    `tavern.ts`, `save.ts`, `saveFile.ts`, `den/scene.ts`, `sprites/` (art registry).
- `components/`: `GameScreen.tsx` (the fixed phone screen), `DenFrame`, `BattleScreen`,
  `BossStage`, `WalkView3D` (the walkable dungeons' renderer, 3D; its play logic in `hooks/useWalkPlay.ts`), `WalkView` (the 2D one, kept until the 3D one has been played; its stick, campfire window and scroll are shared), `CardGallery` (`CardFace`, the card standard),
  `LootWindow`, `Help.tsx` (the "?" panels), and others.
- `public/sprites/`: all art (PixelLab), with IDs in `public/sprites/PIXELLAB.md`.
- `offline/`: the standalone copy's builder and launchers. `tests/`: Vitest, one file per system.

## Conventions

- **Match the surrounding code:** short helpers, comments that explain *why* in plain English,
  tuning numbers as named `export const`s at the top of the module (e.g. `ROOM_MIX`, `FREE_RUNS`).
- **The Labyrinth screen is played end to end** in tests/dungeonPage.test.tsx (happy-dom, with the
  canvases and the battle stood in for): what's on screen and saved after each step is pinned in
  tests/golden/page/dungeon.json. A difference there is a regression unless the user approved the
  change; then re-record with `UPDATE_PAGE_GOLDEN=1`, in its own "Intended change:" commit.
- **Game rules go in `lib/` with a test.** Changes to the rules need a test or a sim result. Run
  `npm run test:all` and `npx tsc --noEmit` before committing. Mark a new test `slowIt` only if it
  takes seconds (and check it isn't just thousands of `expect` calls: collect failures, expect once).
- **UI follows the user's settled standards** ([docs/design/ui.md](docs/design/ui.md)):
  - Everything fits inside the one fixed phone-sized screen (`GameScreen`). Use `cqw`/`cqh`, not
    `vw`/`vh`. Long lists scroll inside a panel; the page never grows. Actions sit in docks.
  - Touch first: tap targets of 44px or more, and no hover-only information.
  - **Few words on screen.** Depth goes behind a "?" (`components/Help.tsx`).
  - The stone card look (`CardFace` / `.inv-panel`, yellow pixel font #f1d9a0, rarity trim).
  - **Fixed structure, text fits it.** Every window is a fixed frame of boxes; flicking between
    items, creatures or tabs changes only the words and pictures inside. Give varying text a fixed
    number of lines (clamp with "…", full text on hover or behind "?"), keep optional parts' space
    when absent (`visibility: hidden`), and anchor windows to the top rather than centring content
    of varying height.
- **Art comes from PixelLab** (the `pixellab` MCP, set up per machine). Don't hand-draw detailed
  sprites in code: that was tried and scrapped. Samples first, and the user's approval before a
  full rollout. When the user supplies their own art, restyle it and keep their design.
- **Reports to the user:** plain English, short, with specific questions. Say what changed, which
  tests passed, and whether it's pushed. The user's on a usage budget: keep sessions to one task,
  and end a finished task with a reminder to `/clear`. A long list of changes is fine when the user
  is stepping away: work through it unattended (quick tests as you go, `test:all` once at the end),
  then report each change for them to review.
- **No browser checks** unless you can say why tests can't cover it, and the user agrees first.
  They cost about 6x a plain request (69% of all usage, Oct 2026). Rely on tests; the user
  looks in the game and sends a screenshot if something's off.
