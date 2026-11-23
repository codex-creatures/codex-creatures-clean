# Cleanup audit, 2026-11-24

A dated report, like [polish-audit-2026-11.md](polish-audit-2026-11.md): what's old, unused or out
of date in the repo, ahead of an early alpha. **Nothing has been removed.** Each group says what it
is, how sure the finding is, and what removing it would take. Not a spec.

How it was found: an import map of all 477 code files from the game's 27 screens, the 18 lab
pages, the 129 test files and the scripts (what nothing reaches); every exported name counted
across the code (what nothing names); every picture's path looked for in the code; every file
named in the docs and in code comments checked to exist; lint's own list.

## A. Certainly dead: safe to remove, no decision in it

Nothing in the game, the labs or the tests uses these.

**Files**

| File | Lines | What it was |
|---|---|---|
| components/RewardReveal.tsx | 34 | A campaign reward's container shown in 3D before its loot (2026-11-16). Nothing draws it now. |
| components/RewardScene3D.tsx | 64 | Its 3D scene. Only RewardReveal used it. |
| lib/world/units.ts | 20 | `CELL_U` and `WorldPt`: neither is imported anywhere. Its comment (what a unit is) is worth keeping, in lib/render/projection.ts or world/space.md. |
| app/crate/page.tsx | 17 | Klutz's crate on its own page, "the old way in". Nothing links to `/crate`; the crate is a tab of Klutz's Den. |
| scripts/shot-diff.mjs | 25 | Compares two folders of screenshots. Named only by tests/visual-baseline/README.md (see E). |

**Exports nothing names** (not even their own file)

- lib/klutz.ts: `WALK_MIN_MS`, `WALK_MAX_MS`, `TOUGHER_AFTER_MS`, `TOUGHER_LEVELS_PER_HOUR`,
  `MAX_ENCOUNTERS` (under "Older constants (trips planned before v2 still read with them)": nothing
  reads them), `canBuyPackTrait`, `packUpgradePrice`, `huntRarity`, type `WornPiece`.
- lib/den3d/art.ts: `POOL_TOP`, `PIT_TOP`, `SPARRING_TOP` (the Den's old flat pictures of the
  pool and pits; the recipes replaced them). Their PNGs in public/sprites/den3d/ go with them if
  nothing else uses them (the recipes use `pit-top.png` as a texture: check each before deleting).
- lib/den3d/setting.ts: `readDenOptions`.
- lib/creatures/raceKitsV2.ts: `NEUTRAL_QUICK_NUMBERS` ("by their older name").
- lib/dungeon/people.ts: `inRoomFloor` ("for tests": no test uses it).
- lib/quest.ts: `effectiveOn`.
- lib/sprites/props.ts: `MONEY_SACK` (the shut money sack: only the open one is used).
- lib/render/projection.ts: `HEIGHT`.

**Unused imports and variables** (lint already lists them)

- app/klutz/page.tsx: `MaterialIcon`. hooks/useGameState.ts: `CREATURE_TEMPLATES`.
- Tests: `GOLDEN_CHEST_ROOM` (dungeon.test.ts), `CATCH_MAX_LEVEL` (klutz.test.ts), `found`
  (largeRooms.test.ts), `SCHEMATICS` (materialsBag.test.ts), and four in merchant.test.ts
  (`toolDrop`, `dropTakenBack`, `codexDrop`, `CreatureOrItemDrop`).
- lib/dungeon/run.ts:1147: a line that does nothing (lint: "expected an assignment or function
  call").

**Comments that point at things that are gone**

- lib/creatures/bosses.ts:36 names `scripts/sim-hydra.ts`; lib/dungeon/run.ts:191 names
  `scripts/sim-encampment.ts`. Neither file exists.
- components/CodexShelf.tsx's header says it's "shown in the Bookcase and the Inventory's Codex
  tab". Only the Bookcase shows it; the Inventory's Codexes tab is a grid of tiles.
- components/klutz/KlutzCrate.tsx:7 says "and on its own (app/crate)": goes with that page.

About 200 lines in all. One commit, tests and type check after.

## B. Old versions kept beside the new one: your call on each

Each of these still works and is still shipped. Removing one is a decision about the game, not
tidying.

1. **The old Den.** components/DenRoom.tsx (557 lines), components/TavernRoom.tsx (174),
   lib/den/scene.ts (1,211), its art in public/sprites/den/, the "New Den" switch in Settings, and
   `backpack` / `firstClearRun` on the Den's page, which only the old Den reads. The new Den has
   been on for everyone since 2026-11-20. **Not all of it can go:** lib/den/scene.ts also holds
   the `OBJ` ids the new Den and Klutz's tour use, and other screens (the board, training,
   summoning) use some of the old Den's pictures. Removing it also means deciding what happens to
   a player who had switched back (`codex_creatures_den3d_v2` = "0").
2. **The 2D walk view.** The game draws walked dungeons in 3D only (app/dungeon/page.tsx). The 2D
   one (components/WalkView.tsx's main component, lib/render/scene.ts's `buildScene`, 578 lines,
   lib/render/paint.ts) is now drawn only by three lab pages (baseline, newrun, three) and its
   tests (scene.test.ts, sceneBefore.ts 431 lines, walkBaseline). CLAUDE.md says it's "kept until
   the 3D one has been played". **Not all of it can go:** the stick, the campfire window, the
   scroll and the maps live in the same file and the 3D view uses them; so do three timing
   numbers from lib/render/scene.ts.
3. **The old three-part Inventory** (`/chest` without `?store=1`: Items, Creatures, Klutz) beside
   the Den's Storehouse (`/chest?store=1`). Six links still open the old one (the scan screen,
   the entrance's "box is full", Klutz's crate, five campaign quests, Klutz's tour). Option F in
   the polish audit.
4. **The bag's own page** (`/bag`). With the new Den there's no bag in the Den and packing is at
   the Labyrinth's entrance. Three things still lead to `/bag`: the old Den, the campaign's "Get a
   bigger bag" quest, and a line of Klutz's tour.
5. **The local barcode roll.** lib/barcodeRegistry.ts's `scanBarcode` and `resolveBarcode` are
   named only by their tests now that scans go through the global registry (or wait as sealed
   caches offline). Worth a look at how much of that file the game still needs.

## C. Dev and testing things a player can reach

For an alpha these are the ones I'd settle first.

1. **The 18 lab pages are in the live build.** `/lab/art`, `/lab/three`, `/lab/props`,
   `/lab/propreview` and the rest (about 4,300 lines, with components/Drafts3D.tsx,
   lib/render3d/hero3d.ts, lib/world/placementView.ts and 120 sample pictures, 625 KB, that only
   they use) are ordinary pages, so anyone who types the address gets them. The repo already has
   the way out: a page named `page.dev.tsx` is only seen by `npm run dev` (the prop builder's
   Save works like that). Renaming the labs' pages that way keeps them for you and takes them,
   and everything only they use, out of what players download. **But** you check lab samples on
   the Vercel site from your phone (the art drafts in `/lab/art`), so some may need to stay
   public for now: say which.
2. **"VS AI"** in the Pit's header, and its screen `/battle` ("VS AI (testing)").
3. **"Testing: heal now"** at the Labyrinth's entrance (option G in the polish audit).
4. The scan screen's testing tools are already shown only to the owner's account online. Fine.

## D. Code that only exists for old saves and old runs: must stay, unless you start afresh

This is the biggest pile of "old" code and none of it is dead: it's what hard rule 2 (saves stay
compatible) costs.

- **Old runs:** a walked run keeps the placement rules of the world version it was made with, so
  versions 3 to 18 are all still in the code: about 35 version-gated branches in
  lib/world/place.ts and migrate.ts, and 2,588 lines of tests
  (placeV3 to V8, worldV14 to V17, the "Before" files, pinnedRuns) with 2.5 MB of golden files.
- **Old saves:** a dozen kinds of upgrade as a save loads (old armour, old tool names, retired and
  renamed moves, soul stones rolled on load, the Gold Keys taken back, old storage and bookcase
  stages, the tavern before its clock), and the retired-move tables in creatureData.ts.

A run only lasts until it's finished or left, so old *runs* matter for days, not for ever: the
versions before, say, 13 could be retired once nobody can still be mid-run on one. Old *saves* are
for ever unless the alpha starts everyone afresh, as Combat V2 did. Either is your decision; I've
touched none of it.

## E. Housekeeping

1. **Lint's 32 parked errors**: 14 `any` (InventoryList, ItemDetailModal, SellConfirmModal,
   useGameState, gameHelpers), 9 "set state in an effect" (bag, home, pool, settings,
   AccountPanel, GameScreen), 7 `require` in offline/build.js and play.js, 2 unescaped
   apostrophes (lab/cards, privacy). The last two groups are minutes; the first two need care.
2. **Branches.** Merged into main, nothing of their own left: `audit-fixes`, `moves-core`,
   `propbuilder` (local only). Holding work main doesn't have: `backup/stage-b-docs` (4 commits),
   `models-pixel-test` (1 commit: the 3D model trial), and `origin/klutz-and-cards` on GitHub
   (2026-10-19). CLAUDE.md says to leave old branches alone, so I have.
3. **tests/visual-baseline/** (3.5 MB of screenshots from 2026-11-07, "references, not automated
   tests") and the lab page that takes them (`/lab/baseline`). They compare the 2D walk view, so
   they go with B2 if that goes.
4. **CLAUDE.md and README.md still describe two computers** (a main PC and a travel laptop: a
   whole section in each). If the laptop is the only one now, those sections can shrink to a
   line.
5. **CLAUDE.md's "No browser checks" rule** is older than how you've had me work since
   2026-11-13 (checks on a scratch copy and port). Worth rewording so the file says what's true.
6. **418 exports are only used inside their own file** (the word `export` is spare). Harmless;
   not worth a pass of its own.
7. **28 exports are named only by tests.** Some are test handles on purpose (`saveWalks`,
   `DEN_RECIPES`, `setCombatRules`); others look like old ways in that only their tests still
   call: `backupSave` (lib/saveFile.ts), `startQuestRun` and `cyclopsChest` (lib/dungeon/run.ts),
   `cyclopsTeam` (lib/creatures/bosses.ts), `hoursToLevel` (lib/trainingPit.ts), `tabletName`,
   `fitsLines` and `MOVE_NAME_LINE` (lib/uiText.ts), `placeInPanel` and `subcellAt`
   (lib/world/grid.ts), `legacyPx` (lib/render/projection.ts), `entranceSpot`
   (lib/dungeon/walk.ts). Each needs a look before it and its test go.

## F. Checked and clean

- **Dependencies:** every package in package.json is used (`@zxing/library` by the scanner,
  `happy-dom` by the page tests).
- **The docs:** all 198 code files named in CLAUDE.md, README.md and the design and world docs
  exist.
- **Scripts:** all but shot-diff.mjs are named by package.json, a launcher or a doc.
- **Art:** public/sprites is 3.5 MB in all, so there's little to win there beyond the labs'
  samples (C1). Most paths are built from ids at run time, so "unused" can't be read off the
  code; nothing was flagged.
- **The stylesheet:** no class or animation that nothing names.
- **Markers:** no TODO, FIXME or HACK in the code; no skipped tests.

## Suggested order

1. **A**, now: certain, small, one commit.
2. **C1 to C3**, once you've said which labs stay public and whether the two testing shortcuts go.
3. **E1's easy half, E4, E5**: minutes each.
4. **B**, one at a time, each its own session: the old Den first (the biggest, and the new one
   has been everyone's for days), then the 2D walk view with its labs and baselines.
5. **D** only on your say, and only after deciding whether the alpha starts afresh.
