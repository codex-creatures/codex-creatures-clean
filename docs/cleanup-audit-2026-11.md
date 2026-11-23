# Cleanup audit, 2026-11-24

A dated report, like [polish-audit-2026-11.md](polish-audit-2026-11.md): what's old, unused or out
of date in the repo, ahead of an early alpha. Each group says what it is, how sure the finding is, and what removing
it would take. Not a spec. **What's been done since** is in "Done" at the end.

How it was found: an import map of all 477 code files from the game's 27 screens, the 18 lab
pages, the 129 test files and the scripts (what nothing reaches); every exported name counted
across the code (what nothing names); every picture's path looked for in the code; every file
named in the docs and in code comments checked to exist; lint's own list.

## The user's replies (2026-11-24)

1. **Group A: remove it.** (Done: see "Done".)
2. **Labs:** only two are needed on the live site: the 3D viewer that turns a model freely on a
   plain background (`/lab/models`) and the in-game view you walk round with lighting
   (`/lab/propreview`). The rest are dev-only, `/lab/props` and `/lab/art` included (narrowed by
   the user later the same day).
3. **"Testing: heal now": remove it. "VS AI": moves to PvP**, as a queue against five simulated
   players with a rating behind it (a feature of its own: [roadmap.md](roadmap.md)). It stays in
   the Pit until that's built. **Healing stays instant** (`HEAL_AT_HOME`): the Healing Pool's own
   "Heal everyone now" goes too. The Abyss is meant to be the first dungeon whose wounds come
   home with you (the user, 2026-11-24).
4. **Saves:** older saves keep loading for now; everyone starts over when the game goes live as a
   mobile app. So group D stays until then.
5. **The laptop is the only computer** the game is developed on now.

> **A correction (2026-11-24):** the first survey skipped the art lab's folder, and so called
> components/RewardReveal.tsx and RewardScene3D.tsx dead. They weren't: `/lab/art` uses them. The
> user has since settled that the 3D reveal isn't wanted, so they're in group A after all, with
> the lab's use of them (group A, last item).

## A. Certainly dead: safe to remove, no decision in it

Nothing in the game, the labs or the tests uses these.

**Files**

| File | Lines | What it was |
|---|---|---|
| lib/world/units.ts | 20 | `CELL_U` and `WorldPt`: neither is imported anywhere. Its comment (what a unit is) is worth keeping, in lib/render/projection.ts or world/space.md. |
| app/crate/page.tsx | 17 | Klutz's crate on its own page, "the old way in". Nothing links to `/crate`; the crate is a tab of Klutz's Den. |

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

About 100 lines in all. One commit, tests and type check after. **Check each with a search before
deleting it:** the survey has been wrong once.

**The campaign's 3D reward reveal: settled, so it joins this group** (the user, 2026-11-24: "we
moved from 3D to 2D, which is better"). The quest board has shown crate rewards as 2D pictures
since 2026-11-17; den.md now says so. What's left of the 3D reveal can go, as one more commit:

- components/RewardReveal.tsx and components/RewardScene3D.tsx;
- their one user, the reveal buttons in app/lab/art/page.tsx (take those out; the page stays);
- `rewardModel`, `RewardModel` and the `MODELS` table in lib/campaign.ts, with their test in
  tests/campaign.test.ts (line 235 on), once nothing else names them;
- the comment at lib/campaign.ts:188 that points at the component.

Check app/lab/chest/ChestScene.tsx first: the art lab's page borrows types from it, and it may
use the same model names for its own lab view.

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

1. **The 19 lab pages are in the live build.** `/lab/art`, `/lab/three`, `/lab/props`,
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
   tests"), scripts/shot-diff.mjs (named only by its README) and the lab page that takes them
   (`/lab/baseline`). They compare the 2D walk view, so
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
- **Scripts:** all but shot-diff.mjs (E3) are named by package.json, a launcher or a doc.
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

## Done

- **Group A** (e67c2f7, 6aad4b4), with two corrections to the list: lib/dungeon/run.ts:1147 wasn't
  dead (it sets a foe's own-race codex move: rewritten as an if/else, doing the same), and the
  pictures pool-top.png, sparring-top.png and money_sack.png stay (the prop builder's list and
  scripts/den-parts.mjs use them; only their unused names in code went). `inRect` (people.ts) and
  an import in quest.ts went with what used them. Lint's warnings are down to none.
- **A second sweep** (an import map from every screen, lab, test and script) found nothing else
  unreachable and no export named nowhere. Every game screen has a way in. What it added:
  comments calling the walked dungeons "not used by the game yet" or "/lab/newrun only" (fixed),
  the pool's own heal button (with C3), and E7's list of exports only tests call.
- **C1** (0a5808c): 16 labs are `page.dev.tsx`; `npm run build` and the offline export have only
  `/lab/models` and `/lab/propreview` (decision 58). The labs' pictures still ship in
  public/sprites (about 250 KB, walk/samples): a build can't tell they're unused.
- **C3** (3f3c356): "Testing: heal now" and the pool's "Heal everyone now" are gone; healing stays
  instant (decision 15). **C2** ("VS AI") stays until the PvP queue.
- **The stale comments** (dc09e4f).
- **E4** (ff3115f): one computer in CLAUDE.md and README.md, and decision 59 (older saves load
  until the app's launch).
- **E7's old ways in**, each checked against what the game does now: `startQuestRun` and its
  `questMap` (the first quest is walked: tutorialRun.ts; `map.quest` stays, the tutorial sets it),
  `cyclopsChest` and `cyclopsTeam` (one-line copies of `bossChest(1)` and `bossTeam("cyclops")`,
  which their tests use now), `scanBarcode` / `resolveBarcode` (wrappers of `lookupLocal`, which
  the game calls), `backupSave` (a new game is backed up by `startNewGame`, already tested),
  `hoursToLevel`, and `entranceSpot` (a walk starts at `roomCentre`; the walking tests keep it as
  their own helper). The tests that only checked them went with them.
- **B1, the old Den** (the user, 2026-11-24: "it's all been replaced now"): components/DenRoom.tsx and
  TavernRoom.tsx, lib/den/scene.ts (its place ids moved to lib/den3d/objects.ts, its noise into
  chamber.ts), the Settings switch (its key left unread), the bag rule's old branch (the bag always
  empties after a run, as it already did for everyone), the Den page's old-Den state, six classes
  in the stylesheet, `loadArt` and the pixel loaders only it used, three of its tests, and 8 of
  its pictures in public/sprites/den/ (about 90 KB; the ones other screens use stay). Found on the
  way: the new Den doesn't draw the Cyclops Head (`headUp` is kept for when it does).
- **B3, the old three-part Inventory** (the user, 2026-11-24: "everything should be running to the
  new one that is found by clicking the storehouse"): `/chest` is the Storehouse only (weapons,
  armour, consumables, and the box schematics), so every link that opened the old screen opens it.
  Its Creatures part is the Pit's, its Klutz button his own page's. Klutz's tour and his crate's
  link say Storehouse. **B4, `/bag`, stays** (the user: intended).
- **B2 and E3, the 2D walk view** (the user, 2026-11-24: "3D is in, it's now the actual game"):
  WalkView.tsx's 2D view (the file is components/WalkParts.tsx now, with the stick, campfire
  window, scroll and maps the 3D view uses), lib/render/scene.ts and paint.ts (the three tunnel
  timings moved to lib/dungeon/torch.ts), /lab/baseline, /lab/newrun and /lab/walk, /lab/three's 2D
  option, tests/scene.test.ts and sceneBefore.ts, tests/visual-baseline (3.5 MB) and
  scripts/shot-diff.mjs. Left for a pass of its own: the 2D drawing helpers now only their tests
  call (lib/dungeon/tileArt.ts `cellArt`, `FACE_TILE`, `TOP_TILE` and the tile-sheet code under
  them; torch.ts `sconceGlow`; projection.ts `artPxAcross` / `artPxDown`; foes.ts `visionCone`;
  walkRooms.ts `fightSack` / `chestSack`). What the world goldens read (`depthEdges`,
  `placeLabDecor`) stays with them.
- **B5, the local barcode roll:** not dead. A copy with no online settings (the tests, an offline
  build without .env.local, the no-account title screen) still rolls scans locally; the user's
  "local barcodes are no more" holds wherever the game is online-capable. Asked.
- **Still open:** B5, D, E1, E2, E5, and the 2D helpers above.
  README.md's opening still says the game has no server or accounts (untrue since the Supabase
  work): a line to fix with E5.
