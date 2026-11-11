# Saves, world versions and migration

Authoritative for how walkable runs are saved, versioned, migrated, checked and mended, and for reviewing goldens. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

## 7. Saves, versions and migration

- **The walkable run gets a version:** `WalkRun.v`. Missing = 0 (every run saved so far).
- **v1 adds** `placed: Instance[]` (everything passes 2–8 placed) and `states` (each instance's
  state: opened, lit, spent). Both optional, so older code still reads a v1 save. (As built,
  `states` was left out: see [World versions](#world-versions).)
  - **v1 is in subcells from the start** (§3's `Instance`), so phase 2b needs no second
    migration. Each thing today's game places is saved with its stable id, its definition, its
    anchor subcell (its panel's centre, `(3x, 3y)`: today everything stands there), its turn
    (0: nothing turns today), its wall for wall things, its starting state where generation
    gives one (a wall torch that starts lit), and `legacy: "panel"`. **No physical size is
    invented for it:** a wall torch takes no floor, a candle stays walk-over, a chest stays solid
    on its panel, exactly as today (§3). Its real footprint comes with the definitions in 2b.
  - **What 2a saves:** wall torches, candles, the things you use (chests, sacks, decks, pools,
    cages, the merchant and the librarian), and the card witch's start. Not the lab's decor
    and banners (✅ the user, 2026-11-07: experimental, shown only in `/lab/newrun` and worked
    out there as now; 2b brings them into placement and saving properly). Already saved today, and left as they are: campfires (`fires`), a beaten room's
    loot spot (`spots`).
  - **Foes' starting spots are saved from v2** (the foe fix, 2a′, §8). Before it they were
    worked out again each time the walk screen opened, from the rooms still to beat, which is
    what moved them when you beat a room.
  - **Run state stays where it is and keeps its meaning:** `lit` (torches and candles you lit),
    the rooms' own state (opened, beaten, looted, the witch's game), `spots`, `fires`, `known`,
    `trail`, `cuts`, `flare`. The room is built from the instances with that state laid over
    them. A torch is lit if it started lit or is in `lit`, as now; a candle near a campfire you
    made is hidden, as now.
- **Migration: save once; old code kept only as a small, isolated converter** (the user,
  2026-11-07: backward compatibility mustn't become long-term upkeep, but an old run must still
  load months later). `migrateWalkRun` runs on load and on import, chained by version, pure and
  tested.
  - **Saving starts in phase 2, before anything else in it changes** (step 2a, §8). The game
    saves what today's placers place (the list is under "v1 adds" above; foes' starts from v2,
    the foe fix) into the run when it starts or loads (v0 → v1 → v2). At that point those placers are
    still the live ones, so no second copy exists yet.
  - **Then phase 2 replaces the placers** (step 2b). From then on the new placers are the only
    generator in normal play. The old ones are deleted from the generation code.
  - **What's kept for old runs: one isolated converter,** `lib/world/compat/v0.ts`. It holds only
    what's needed to turn a v0 run into v1: the placements the live game actually showed (wall
    torches and which were lit, candles, foe starting spots, the witch, cage spots). The lab-only
    decor and banners aren't in it: a converted run gets those from the new placers, as nobody
    ever saw them in a real run.
    - It's a frozen copy, with frozen copies of the few helpers it needs, so later changes to
      floorplans, sight or light can't change what it gives.
    - It's called only by `migrateWalkRun`. Nothing in generation or gameplay imports it, and a
      test checks that.
    - It's pinned for as long as it exists by the phase-0 fixtures and goldens: each v0 fixture
      must convert to exactly what today's game shows.
  - **No time limit.** A run or exported save that's months old converts the same as one from
    yesterday. Exported save files go through the same migration when they're imported.
  - **Removing the converter** needs either:
    - evidence that no supported save still needs it. The cloud saves can be checked (no v0 runs
      left), but saves kept only in a browser or an exported file can't be seen, so in practice
      that means
    - or the user explicitly deciding to end v0 support, recorded in design.md with the date.
    Either way, a test then pins what a v0 run gets: placements from the new placers, from its
    saved layout and rooms. Its rooms, foes, loot and progress are saved data and don't change;
    only where torches, candles and foes stand may move, and lit wall torches may go out. It
    stays playable.
- **Migrations are idempotent** (the user, 2026-11-07). Loading a run any number of times gives the
  same run: a migration only fills in what's missing, never regenerates or duplicates what's
  there, and never touches run state (where you stand, what you've seen, lit, opened, beaten,
  looted, the trail, cut-offs, campfires, flares). Tests load each fixture repeatedly, and
  load → save → load, and require the second pass to change nothing.
- **Which dungeon a run is in is handled explicitly** (the user, 2026-11-07). A missing
  `run.dungeon` means the Labyrinth (the Cyclops's dungeon, 1) as it always has (`dungeonOf`),
  never the Encampment. Migrations read it through `dungeonOf` only, and a test pins a Cyclops
  run with no `dungeon` field through every migration.
- **What today's saves already carry is read as now:** `layout.block` (missing = 3),
  `layout.rooms[].inner` (pillar rock), `known`, `lit`, `spots`, `trail`, `cuts`, `fires`,
  `flare`. `lit` keeps its wall-torch ids.
- **Save file and cloud:** the run is a nested, optional part of the save, so
  `SAVE_FILE_VERSION` doesn't change and cloud saves need nothing. A test exports and re-imports
  a save with a v1 run.
- **Forward compatibility: an older client never overwrites newer world state** (the user,
  2026-11-07). Offline play, exported files, save slots, cloud saves and two computers mean a
  save written by newer code will meet older code. The policy:
  - **The run says its world version** (`walk.v`), and each client knows the newest it
    understands (`WALK_V`, in `lib/world/migrate.ts`). Bumped only with a migration to it.
  - **A client that meets a newer run leaves it alone:** `loadDungeon` hands it back exactly as
    stored, marked unsupported; the game won't play it or start another run over it, and says to
    update the game. Anything else in the save (your chest, the Den, the Labyrinth's meta) still
    loads, plays and saves as normal.
  - **Writing can't overwrite it either:** `saveDungeon` checks what's stored first. If the
    stored run is newer than this client understands, it keeps that run exactly and writes only
    the rest. This guard sits in the one function every save of the Labyrinth goes through, so
    no screen can get round it.
  - **Built in 2a, before it's needed** (the user asked for the policy now, implemented when
    needed): only clients that have the guard can obey it, so it has to be in the game well
    before the first v2 run exists. It does nothing until then.
  - **Clients from before 2a can't obey it.** What softens that: every place today's code
    changes a run copies it whole (`{ ...walk, … }`), so an old client keeps `v` and `placed`
    rather than dropping them; it just shows its own working-out of the placements. In 2a that's
    the same. After 2b it could differ, so before 2b is released both computers are updated
    (`Update.bat`), and 2a will have been live long enough that no other copy is still running it.
  - **Exported files** go through the same `loadDungeon` when imported, so an old client
    importing a newer file gets the same protection. `SAVE_FILE_VERSION` isn't used for this:
    the world version travels inside the run.
- **Two computers:** a v1 run opened on a computer with older code still plays. The older code
  ignores `placed` and works placements out from the seed, as today, so things may sit in
  slightly different spots. Update both computers before playing a run across them.
- **Fixtures:** saved runs captured from today's game before the work starts (phase 0: six made
  by today's code), kept in `tests/fixtures/walk/`; they must load and play in every phase.
  **Plus at least one real exported save** from an actual game (Settings → Export, from the
  user), added when the user supplies one, **cleaned first** (the user, 2026-11-07). Kept:
  only what's needed to test the save's behaviour, which is the file's version, the Labyrinth
  part (its meta and the run in progress), and the party creatures the run refers to. Dropped:
  account and cloud ids, names and emails, the barcode registry and scan history, battle
  history, everything else in the chest, Den and tavern, and any other run. A test checks that
  the fixture holds no such fields.

### Reviewing goldens: intended changes vs regressions

- A golden is only ever re-recorded (`UPDATE_GOLDEN=1`) for a change the user has approved.
  That's in **its own commit**, starting "Intended change:", which names the decision (who
  approved it and when) and lists which goldens changed and why.
- Any other golden difference is a **regression**: the code is fixed, never the golden.
- Behaviour corrections the user has approved so far (each lands as its own intended change):
  - **Foes keep their starting spots** (the user, 2026-11-07; ✅ built as 2a′): once a run is
    made, its contents stay put. Beating one room must not move anything in another. Foes still
    move about while you play. (Before, beating one room moved 25 of 27 other foes' starting
    spots the next time the view opened.)

## World versions

Distilled on 2026-11-09 from world-spec §8 (kept word for word in
[archive/2026-11-09/world-spec.md](../archive/2026-11-09/world-spec.md), §8). A walkable run's
version is `walk.v`; the newest this client understands is `WALK_V` (lib/world/version.ts, now
**11**), and new runs are placed at `PLACED_V` (lib/world/place.ts, 11). **v3 onward, each version
is a new generator for new runs only: nothing migrates to it, so a run's rooms never change.** Only
v0 → v1 → v2 are migrations.

| v | Came with | What it means |
|---|---|---|
| 0 | before saved placements | placements worked out from the seed each time; converted on open by `compat/v0.ts` to exactly what the game showed |
| 1 | phase 2a (2026-11-07) | `placed: Instance[]` saved, from the old placers, every instance `legacy: "panel"` with its anchor `(3x, 3y)`. Ids as the game already used: `<room>:<n>` / `<tunnel>:<n>` torches, `candle:<room>`, `<room>:witch`, `<room>:<def>` features, `<room>:stores`, `<room>#<i>` cages |
| 2 | 2a′, the foe fix (2026-11-07) | foes' generated starts saved (`<room>:foe:<i>`, with `facing` and `foe: { walks?, wait, end? }` or `{ waits: true }`), the unsprung ambush's included. v1 → v2 adds the foes today's game would show (rooms not yet beaten), written back at once |
| 3 | 2b-1, the new placers (2026-11-08) | placed by the passes ([placement.md](placement.md#as-built-placement-by-world-version)); no `legacy` mark; each instance carries `size` (its footprint when placed); `wall: "south"` allowed (refused below v3) |
| 4 | stage A, subcell occupancy (released 009886d, 2026-11-08) | things at their footprints, panels shared |
| 5 | stage B, candles by darkness (2026-11-08) | mounted wall candles and `floor-candle` (refused below v5) |
| 6 | the user's play-test (2026-11-09) | floor candles off stone and out of mounted light |
| 7 | guided layouts, 2-tile Cyclops blocks (2026-11-09) | candle dials retuned |
| 8 | the user (2026-11-09) | no wall candles: the budget places wall torches (a v8 run holding a wall candle is damaged) |
| 9 | decision 39 (the user, 2026-11-10) | people who wander (`walk.people`, `walk.tracking`; the Cyclops's witches, merchant and librarian are rooms `person~…` with no place in the layout); a library's broken bookcases (`<library>~b<i>`: `bookcase`) and its `lectern`; a `sack` beside half the campfires. The Encampment's runs are placed as at v8 |
| 10 | the user's play-test (2026-11-11) | a library's broken bookcases kept clear of its doorways (`BOOKCASE_DOOR_GAP`); nothing else differs |
| 11 | the user (2026-11-11) | a guarded storehouse's guard keeps the storehouse's own chest (`guardedSpot`): no second chest spot in the room's middle, which could stand on the first with no way kept to it. Made with the Cyclops's 60-room, 15-to-the-lair layouts (`WALK_LABYRINTH`; versions up to 10 were made at 30 rooms, `WALK_LABYRINTH_30`, which their tests roll) |

**Pinned, so old versions can't drift:** v3 (tests/placeV3.test.ts), v4–v10 (tests/placeV4Pinned.test.ts,
saved runs in tests/fixtures/pins/), each fixture's `tests/golden/walk/<fixture>.placed.json`, and the
phase-0/1 goldens. **Before changing placement rules, pin the current version; new rules mean a new
world version.**

As built there is no `states` field (§7's "v1 adds … `states`" was dropped in 2a's design:
everything the player changes already has a home in the run; a `states` map comes with the first
thing that needs one, such as levers or traps).

### One way in

- The game reaches `migrateWalkRun` only through `openWalkSave(save, write)` (a saved run opened to
  be played: your save, a slot, a cloud save and an imported file all land in the same save first;
  a migrated run is written back straight away) and `placedRun` (a new run as it's made, and the
  lab pages' made-up runs). Placements are read only through `placementsOfWalk`.
- tests/migrate.test.ts fails if anything else imports `migrateWalkRun` or reads a run's `placed`
  outside `lib/world/`. A new feature calls `openWalkSave`.
- The forward-compatibility guard needs no world modules, so it sits in `loadDungeon` and
  `saveDungeon` (lib/dungeon), which the world modules import.

### What a load says (never "no placements")

- **migrated:** a v0 run (or v1), given its placements;
- **unchanged:** a run whose `placed` is sound (a non-empty list; unique string ids; known
  definitions for its version; a room; whole-number subcells; known wall, turn and legacy values;
  for v2+, every room still to beat has exactly its foes saved);
- **damaged:** `placed` missing or unsound, a v0 run carrying a `placed`, a definition too new for
  its version, or placements that can't be made. Kept exactly as stored, never played or written
  over, said in the console; the Labyrinth says the run can't be opened;
- **repaired:** only when the player taps **"Mend its rooms"** (`recoverWalkRun`,
  `recoverWalkSave`): made again by that run's own version's rules, so the same ids and spots
  (for a v1 or v2 run, its foes come out as first made if no room's been beaten since, otherwise as
  the game would show them now); what you've done in it is kept;
- **unsupported:** a run from a newer world version: left exactly as stored (§7, forward
  compatibility).

## The test safety net

From phase 0 and later phases (archive §8), still how the walkable world is protected:

- **Saved-run fixtures** (`tests/fixtures/walk/`): six runs made once by the old code and kept as
  saved, never remade by the tests (Encampment: fresh, part-way, at the chief's camp, from before
  pillars; Cyclops: fresh, part-way). `MAKE_WALK_FIXTURES=1` writes only missing ones. Pins of
  later versions' runs are in `tests/fixtures/pins/`.
- **Goldens** (`tests/golden/walk/`, by tests/walkBaseline.test.ts): for each fixture, everything
  the walk works out from it (floorplan, forward rule, closed plan, rubble, what you've seen, light,
  torches, candles, campfires, foe starts, the witch, every thing to tap and its path, being
  spotted, the lab's decor), ten seconds of foes moving, walking up to each thing, paths to every
  room; each fixture's `*.placed.json`; and draw lists for fixed states (`*.draw.json`).
  `UPDATE_GOLDEN=1` rewrites them, only for a change the user approved (see "Reviewing goldens").
- **Side-by-side checks**: the walk sim and the scene builder are each run beside the code they
  replaced, frame for frame, on every fixture.
- **Visual references** (`tests/visual-baseline/phase0/`, `phase1/`): screenshots to compare by eye
  (average difference per colour channel 0.0–0.2 is torch flicker), not pixel tests.
- **Invariants** over rolled runs (`slowIt`): reservations intact, required paths walkable, no two
  blocking things on a subcell, one thing per wall slot, every foe, NPC and loot spot reachable,
  pockets over 6 panels flagged.
