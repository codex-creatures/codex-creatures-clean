# The explorable world: technical specification

📌 **Approved by the user (2026-11-07), with the refinements below folded in.** Built phase by
phase (§8): each phase tightly scoped, behaviour kept unless the user approves a change, its
regression tests run. The summary and the decisions are in
[design.md §13](design.md#13-the-explorable-world-architecture); this file holds the detail.

Scope: the walkable dungeons (the Encampment's and the Cyclops's "New") and any explorable place
after them. Not the battle screen, the Den, the scroll map's room view (`chamber.ts`) or the menus.

## 1. Principles

1. **Gameplay lives in world space; the renderer only reads it.** Positions, sizes, collision,
   sight, light reach, placement and saves are in world units, with no pixels. A new renderer (a
   different camera, or real 3D one day) must be able to draw the same world without touching
   gameplay code or saves.
2. **Four layers, each depending only on the ones above it:**
   - **World:** data (`lib/world/`). The floorplan, the object definitions, the placed objects
     and their state.
   - **Simulation:** rules (`lib/world/`, `lib/dungeon/`). Walking, sight, light, foes,
     interactions and placement. Pure and tested.
   - **Scene:** what to draw this frame (`lib/render/`). A list of draw commands built from the
     world and the projection. Pure and tested.
   - **Renderer:** React and canvas (`components/WalkView.tsx`). Runs the frame loop, takes
     taps, and paints the draw list. No game rules.
3. **One projection, shared** by the renderer, the scene builder, the art template generator and
   the art checks (`lib/render/projection.ts`). Nothing else turns world sizes into pixels.
4. **Nothing generated is lost when the code changes.** What a run places is saved with the run
   (§7), so changing the placement code never moves things in a run already under way.
5. **Checks report, people decide.** The art checks flag problems; they never recolour or
   "fix" art. An asset is approved only after the user has seen it in the game.

## 2. World space

### Units

- **The world unit (`u`)** is the unit for every position, size, height and distance.
- **The cell** is the gameplay grid: floorplan tiles, collision, paths and occupancy.
  `CELL_U` = how many units a cell is across: **1** now.
- **No real-world scale is assumed.** "The hero is about 1.1 u tall" is a fact about the
  hero, not a claim that a cell is a metre. Other dungeons and later areas can use the same
  unit at a different feel.
- Every existing number in tiles (`TORCH_RADIUS`, `SIGHT_RANGE`, `WALK_SPEED`…) is already
  in cells. At `CELL_U = 1` they're units too, so no gameplay number changes.

### Axes

- **x** runs east and **y** runs south (down the screen today), both along the floor.
  **z** is up, from the floor (z = 0).
- **Positions are floats.** A cell's centre is the whole number, as `walk.ts` already works
  (cell (3, 4) covers x 2.5–3.5, y 3.5–4.5). Kept, so no code or save changes meaning.
- **Facing:** an angle in the floor plane (0 = east, π/2 = south), as `foes.ts` has it. Sprites
  pick the nearest facing they have (4 now: south, east, north, west mirrored from east).

### The four measurements every object has

1. **Footprint:** the cells it physically takes up on the floor (collision and occupancy), as
   a w × d rectangle of cells from its origin cell. A cell or more for things on the floor. None
   for wall-mounted, overhead and walk-over things (§5). A creature's footprint comes from its
   size class.
2. **World height:** how tall it physically is, in u. Used for sight and light (does it block
   them), for drawing order on the same row, and by any future 3D renderer.
3. **Visual bounds:** the box its picture fills, in u, around its anchor (left, right, up, down).
   It may reach well past the footprint: a wolf's tail, a banner's tassels, a boss's arms. The
   renderer uses it for culling and drawing; gameplay never does.
4. **Anchor:** the world point where it touches the floor (or its wall, or the ceiling), and the
   matching pixel in its art. For a floor object, the middle of its footprint's front (south)
   edge, or a creature's feet. The art's anchor pixel is stored with the art (§4.4), not worked
   out from the image.

Wall-mounted objects also have an **attachment surface** (north wall face, east or west side
wall, south wall top) and a height up that wall in u. Objects you can use have **interaction
points** (§3).

### Creature size classes

Each class sets a creature's footprint and its height range. The numbers are 🧪, to be set from
today's sprites in phase 1 so nothing moves:

| Class | Footprint | Height (u) | Today |
|---|---|---|---|
| tiny | 1×1 (shares nothing) | 0.4–0.8 | sprites, wisps |
| small | 1×1 | 0.8–1.2 | most foes (all drawn 1.375 u today: `FOE_PX` 22 at 16px) |
| medium | 1×1 | 1.2–1.8 | |
| large | 2×2 | 1.8–3 | the chief (today ×1.3, `CHIEF_SCALE`) |
| huge | 3×3 | 3+ | the Cyclops (today ×2.6, `BOSS_SCALE`) |

**A creature's world size comes from its intended physical proportions**, not from its sprite
(the user, 2026-11-07): today's sprites are a reference, not the source of truth. A creature that
doesn't fit a class neatly gets its own footprint and height (`size: { w, d, height }` overrides
the class). In phase 1 each creature gets its class or own size, while the renderer keeps
drawing it at today's height (a legacy draw size), so nothing changes on screen. The world sizes
take over the drawing when creature art is redone to the standard.

## 3. Object definitions

One registry (`lib/world/objects.ts`) defines every kind of thing in the world. Placed copies
(**instances**) refer to a definition by id and carry only what varies.

```ts
type Attach = "floor" | "wall-north" | "wall-side" | "wall-south" | "overhead";
type Layer = "floor" | "decal" | "standing" | "overhead"; // drawing bands, §4.5
type ObjectDef = {
  id: string;                         // "chest", "cage", "pillar", "sconce", "skull"…
  kind: "structure" | "prop" | "interactable" | "light" | "creature" | "npc" | "decal";
  attach: Attach;
  footprint: { w: number; d: number }; // cells (0×0: takes no floor)
  height: number;                      // u
  collision: "solid" | "walk-over" | "none";
  blocksSight: boolean;                // foes' sight (foes.ts)
  blocksLight: boolean;                // torch light (torch.ts)
  light?: { radius: number; colour: string; flicker: boolean };
  interact?: { points: { dx: number; dy: number }[]; reach: number; verb: string };
  layer: Layer;
  visual: {
    art: string | Record<string, string>; // one image, or by state ("shut", "open", "lit")
    bounds: { left: number; right: number; up: number; down: number }; // u around the anchor
    anchorPx: { x: number; y: number };   // the anchor's pixel in the art
    artPerU: number;                       // art pixels per u (the standard: §6)
    pixelAspect?: number;                  // legacy art only: art pixel height ÷ width on screen
    facings?: ("south" | "east" | "north" | "west")[];
  };
  sizeClass?: "tiny" | "small" | "medium" | "large" | "huge"; // creatures
};
type Instance = { id: string; def: string; x: number; y: number; facing?: number; state?: string; room: string };
```

- **Instance ids are stable** (`<room>:<def>:<n>`), so saves and future triggers can name them.
- **Gameplay reads** footprint, height, collision, blocksSight, blocksLight, light, interact
  and attach. **The renderer reads** layer and visual. Neither reads the other's half.
- **Placement rules are kept apart from definitions** (§5): where a skull may lie is a rule of
  the room, not a fact about skulls.
- **About 25 definitions cover what exists today:**
  - things you use: chest (and opened), sack, rickety chest, deck of cards, healing pool, cage
    (and opened);
  - campfire, candle, wall torch (sconce), banner, pillar;
  - decor: barrels, crates, skull, nest, pots, fallen pillar;
  - people: the merchant, the librarian, the card witch;
  - the hero, and foes (by size class);
  - rubble (a tunnel mouth that fell in).

## 4. Projection and drawing

### 4.1 The camera (✅ decided: fixed three-quarter, from the south, no rotation)

An oblique, orthographic view: no perspective, nothing smaller with distance. On screen:

```
screenX = (x − camX) · T
screenY = (y − camY) · T · D − z · T · H
```

- **T:** pixels per u across. Today the view width ÷ `WALK_ACROSS` (15).
- **D (depth factor):** how tall a u of floor depth looks, relative to a u across. **1 today**
  (a floor cell is square on screen).
- **H (height factor):** how tall a u of height looks, relative to a u across.

Everything else (the camera following you, the edge clamp `cameraAt`, culling and tap-to-world)
is the inverse of the same two lines, in one module.

### 4.2 Today's numbers (measured from the code, 2026-11-07)

| What | Today | Where |
|---|---|---|
| Cells across the screen | 15 | `WALK_ACROSS` |
| Floor depth factor D | 1 | `sy` in WalkView |
| Kit art | 32 px across a cell, **24** down (`KIT_PX`, `KIT_ROW`); drawn into a square cell, so its pixels show **1⅓× taller than wide** | `lib/sprites/walk.ts` |
| North wall face + top band | 57 kit rows (`KIT_NORTH`), the top 15 the band (`KIT_CAP`): 2.375 cells tall on screen, 0.625 of it band | WalkView |
| Side wall tops | 12 kit px wide (`KIT_SIDE`) | WalkView |
| South walls | the top band only, lifted 0.625 cells over the floor's last row, fading near you (`capFade`) | WalkView, tileArt.ts |
| The hero, the witch | square pixels, 32 art px a cell (`cell × T / KIT_PX`) | WalkView |
| Foes | all 1.375 cells tall (`FOE_PX` 22 at 16px), whatever the species; bosses ×2.6, the chief ×1.3 | WalkView |
| Props and decor | square pixels, each at its own width (`size` at 16px a cell) | `WalkProp`, `WALK_DECOR` |
| Feet point | the cell's centre, plus 0.25 cell down (`footY`: + 4 px at 16px) | WalkView |
| Drawing order | by a sort y, then x (`drawOrder`), with hand-picked nudges: wall torches −0.6, side torches +0.4, south walls −0.5, walk-over decor −0.6 | WalkView |

So today there are **three pixel conventions on one screen**: the kit (non-square pixels),
characters (square, 32 a cell) and props (square, each its own size). That's the root of the
"doesn't fit" problem, and the standard (§6) gets rid of it.

### 4.3 Milestone 1 reproduces today exactly

Phase 1 sets `projection.ts` to today's numbers: D = 1, an H fitted to the walls, the kit's
`pixelAspect` 4⁄3, the 0.25 feet offset, and each prop's current size turned into visual bounds
in u. The sort nudges become each definition's sort rule (§4.5). The screen must not change.

### 4.4 Anchors

- Every piece of art stores its anchor pixel (`anchorPx`) and its art pixels per u (`artPerU`).
- The renderer places the anchor pixel at the anchor's projected world point, scaled
  T ÷ `artPerU` across and T · D ÷ (`artPerU` ÷ `pixelAspect`) down. Legacy art only; new art
  has square pixels.
- The template generator (§6.2) draws each template with its anchor at a known pixel, so new art
  arrives with its anchor already right.

### 4.5 Drawing order

Bands, drawn in this order:
1. **floor:** floor tiles, worn tiles;
2. **decal:** flat things lying on the floor (rubble dust, blood, a rug);
3. **standing:** everything upright, wall faces included, sorted by:
   - its **sort y**: the y of its footprint's front (south) edge, or its anchor's y if it has no
     footprint; a wall-mounted thing sorts at its wall's y plus a small step so it's drawn on the
     wall, not behind it;
   - then by **height** (the taller one first, so a short thing in front isn't hidden);
   - then by **x**;
4. **overhead:** things hanging from above (none yet), and south wall tops;
5. **light:** the torch glow, the dark, flames;
6. **screen:** the "!" marks, the HUD.

Big multi-cell objects sort by their front edge. Where a big object and a small one overlap
awkwardly, the fix is a rule in the scene builder, tested, never a hand-tuned number in
WalkView.

### 4.6 What's left open

**D for new art** ❓. D = 1 (today) shows floors straight down from above. D ≈ 0.75 is the
classic three-quarter look: it's how PixelLab's kits are drawn (their floors are 32 × 24), and
it's closer to the user's reference. It only changes the renderer (you'd see more rows of the
room), never gameplay. **Decided in phase 3** (the user, 2026-11-07) from two proper in-game
comparison renders (D = 1 and D = 0.75) with walls, creatures, props and lighting, judged on
sprite anchors, drawing order and whether taps and interaction points still line up with what's
drawn. The user is interested in ¾ but wants to see it first.

## 5. Occupancy and placement

### 5.1 Occupancy: four separate kinds of space

Each room has an occupancy map with separate kinds of space, each with its own rules:

| Space | Holds | Rule |
|---|---|---|
| **Floor (blocking)** | solid floor objects: pillars, chests, cages, barrels, campfires, NPCs' carts | one thing per cell; may not break a reservation (§5.2) |
| **Floor (walk-over)** | skulls, nests, pots, candles, decals, worn tiles | may sit under foes' and your paths; not on a blocking thing; may overlap other walk-over things only if their definitions allow it |
| **Wall slots** | wall torches, banners, future levers or switches: per wall cell, per face (north face, side walls) | one thing per slot, plus a gap rule (`SCONCE_EVERY`) |
| **Overhead** | hanging things (none yet) | no collision; one per cell |

A pillar, today rock (`interior.ts` writes `ROCK` into the floorplan), becomes a solid floor
object with `blocksSight` and `blocksLight`. Saved layouts keep their `inner` rock and are read
as before (§7).

### 5.2 Reservations: what must stay usable (not "every tile reachable")

Before anything is placed, the room reserves:
1. **Doors:** each door cell and the cells just inside it.
2. **Required paths:** a walkable path between every pair of doors, and from the doors to each
   progression point. Kept as a corridor of free cells (at least 1 wide; 🧪 2 where the room
   allows), worked out once and then protected.
3. **Progression points:** the room's middle feature (chest, pool, stash, the treasure), the
   boss's stand and the way up to it (`WAIT_REACH`), the chief's cages, NPCs, and the spot where
   a beaten room's loot is dropped.
4. **Access:** every interaction point's reach must be reachable from a door.

Any placement that would block a reserved cell, cut a required path or cut off an interaction
is refused. Other floor may be blocked off: a corner behind a pillar is fine. Two rules stop a
blocked-off pocket from causing trouble:
- foes, NPCs and dropped loot never start in a cell that can't be reached;
- the tests flag any blocked-off pocket over 🧪 6 cells, so that's seen, not silent.

### 5.3 The placement passes, in order

1. **Reserve** (§5.2).
2. **Stamp:** a hand-made stamp for the room, if it has one (§5.5): its fixed objects and its own
   reserved cells.
3. **Structure:** pillars (`interior.ts` rules).
4. **Things you use:** the chest, pool, stash, deck, NPCs, cages.
5. **Wall slots:** wall torches, banners.
6. **Lights on the floor:** candles, campfires.
7. **Spawns:** where each foe starts, the NPCs' wander areas, the boss's stand.
8. **Decor:** blocking decor against walls, walk-over decor anywhere left.
9. **Floor variety:** worn floor and wall tiles. Purely visual, so these stay worked out from the
   seed and aren't saved.

**Separate randomness per room and per pass:** each pass in each room gets its own random
numbers from (run seed, room, pass). Changing one pass no longer moves everything after it, as
today's single shared stream does.

### 5.4 Movement, foes and interactions

- **Walking:** the floorplan's walkable cells, less the solid footprints, plus the forward rule
  (`stepRule`). Today this is put together in WalkView (`rule()`); it moves into the simulation
  layer. The pathfinding itself (`findPath`, diagonals that never cut a rock corner) stays.
- **Foes:** start in their spawn cells (pass 7), wander inside their room's walkable cells, and
  see by sight lines that anything with `blocksSight` stops (today only rock).
- **Light:** `torchLit` is blocked by rock and by anything with `blocksLight`.
- **Interactions:** tapping a thing and walking up to it uses its interaction points and reach.
  Later ones (levers, traps, breakable walls) are instances with state in the save, and the
  rules for them come with them. ⏸ Not designed beyond the definition's slot.

### 5.5 Hand-placed stamps (📌 the format now, ⏸ the first one when needed)

A stamp is a small text grid, like the plans our tests already draw:

```
stamp: chief-camp   fits: boss   anchor: top-middle
  . C . C . C .      C  cage (interactable)
  . . . . . . .      B  the boss's stand
  # . . B . . #      #  pillar
  . . . . . . .      =  reserved path
  # . = = = . #      .  free for the passes after
```

A stamp places its fixed objects and reservations; the passes after it fill the rest. Stamps are
chosen by the room's kind and shape and can be flipped left to right. The chief's camp would be
the first.

## 6. Art standard and pipeline

### 6.1 The art spec (one per setting: "the dungeon" first)

Each setting is a pack: its palette, kit, props, light settings and decor themes. The spec says:
- **The camera:** read from `projection.ts`, never retyped.
- **Art density:** 32 art pixels per u (`artPerU`), square pixels (no `pixelAspect`).
- **The palette:** about 24 colours, kept as a file (`art/palettes/dungeon.json`). **The user's
  reference image is the visual target, not a source** (the user, 2026-11-07): no textures or
  colours are copied or sampled from it unless we hold the rights to it. The palette is an
  original one made to capture its atmosphere (warm brick under torchlight, charcoal stone, a
  neutral dark). Generated art is asked to use it; the checks report how far off it is.
- **Light:** evenly lit, mid-tone materials, light from the upper left at most for form. No
  torch glow and no cast shadows in the art: the renderer adds those.
- **Outline and detail:** one outline style and a detail level, the same for every piece of a
  setting.
- **PixelLab settings per kind of asset** (tool, view, size, outline, shading), written down and
  reused, so every chest is asked for the same way.

### 6.2 Templates from the definitions

`scripts/art/template` draws, for an object definition, a blank shape at its exact projected
size:
- its footprint as a floor patch;
- its height as a box with its front and top faces in flat greys;
- its anchor pixel marked.

It uses `lib/render/projection.ts`, the same module as the game. A test checks that a
template's size equals the projected visual bounds, so the generator and the game can't drift
apart. The template goes to PixelLab as the shape to paint over (inpainting or style-matching,
whichever the tool supports for that asset). A style reference goes in only where we hold the rights to
it (our own approved art, once there is some). Which PixelLab tools take which inputs gets checked in phase 3; this
spec assumes nothing about them.

### 6.3 Checks (report only)

`scripts/art/check` runs on a new asset and prints a report. It never changes the image.

| Check | Fails or flags |
|---|---|
| Size | fails if the trimmed art isn't its projected bounds (± 2 px) |
| Anchor | fails if the anchor pixel isn't on the art's base line |
| Background | fails on half-see-through edge pixels (halo) or a coloured background |
| Tiling | (tiles) fails if the edges don't meet when tiled |
| Palette | flags the share of pixels far from the palette, with a picture of where |
| Lighting | flags a strong brightness slope across the art. **A hint only:** it can't reliably tell baked light from real shading, so a person decides |

### 6.4 The test room and approval

1. `scripts/art/testroom` draws a fixed room with every piece of the setting in it, using the
   scene builder and the projection, to a PNG beside the reference. Offline, no browser.
2. The user looks at it.
3. Then the user looks in the game (the lab, a scratch address). Nothing is approved without it.
4. Only approved assets go into the active registry (`lib/sprites/walk.ts`). Samples live in
   `public/sprites/walk/samples/` and are never imported by the game.

## 7. Saves, versions and migration

- **The walkable run gets a version:** `WalkRun.v`. Missing = 0 (every run saved so far).
- **v1 adds** `placed: Instance[]` (everything passes 2–8 placed) and `states` (each instance's
  state: opened, lit, spent). Both optional, so older code still reads a v1 save.
- **Migration: save once; old code kept only as a small, isolated converter** (the user,
  2026-11-07: backward compatibility mustn't become long-term upkeep, but an old run must still
  load months later). `migrateWalkRun` runs on load and on import, chained by version, pure and
  tested.
  - **Saving starts in phase 2, before anything else in it changes** (step 2a, §8). The game
    saves what today's placers place (wall torches, candles, campfires, cages, foe starts, the
    witch, the lab's decor and banners) into the run when it starts or loads (v0 → v1). At that
    point those placers are still the live ones, so no second copy exists yet.
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
  - **Foes keep their starting spots** (the user, 2026-11-07): once a run is made, its contents
    stay put. Beating one room must not move anything in another. Foes still move about
    while you play. (Today, beating one room moved 25 of 27 other foes' starting spots the
    next time the view opened.) Phase 2, with saved placements.

## 8. Phases and acceptance

Each phase is its own commit (or few), tested and reviewed before the next starts.

### Phase 0: the safety net (no change in the game) ✅ 2026-11-07
- **Saved-run fixtures** (`tests/fixtures/walk/`): six runs made once by today's code and kept
  as saved, never remade by the tests. MAKE_WALK_FIXTURES=1 writes only missing ones.
  - **Encampment:** fresh; part-way (5 rooms up, torches and a candle lit, cut-offs crossed,
    loot dropped, a campfire half used); at the top (the chief's camp, cages to open); from
    before pillars (3-tile blocks, no `block`, no insides).
  - **Cyclops:** fresh; part-way.
- **Goldens** (`tests/golden/walk/`, by `tests/walkBaseline.test.ts`). For each fixture,
  everything the walk screen works out from it (`tests/walkBaseline.ts`, a copy of WalkView's
  calls and seeds), live and with the lab's decor on:
  - the floorplan, the forward rule's ways on, the closed plan, the rubble and the fallen tunnels;
  - the wall edges, what you've seen, your torch's light, the wall torches in sight;
  - every wall torch, candle, campfire, foe start, the witch, and every thing you can tap (with its
    path from you);
  - whether you're spotted;
  - the lab's decor, banners and worn tiles.
  Also ten seconds of foes going about (seeded), you walking up to each thing, and paths by the
  walking rules to every room. Plus ten fresh runs of each dungeon (in the full suite).
  UPDATE_GOLDEN=1 rewrites them, only for a change the user has approved.
- **Loading:** each fixture goes through the game's own loader (`loadDungeon`) and comes out the
  same, and you can walk on into the next room.
- **The picture:** 16 screenshots of fixed scenes (`tests/visual-baseline/phase0/`: walls, a
  pillar, foes, the chief and the Cyclops, the witch, torchlight, a see-through south wall, decor,
  the scroll), taken locally from `app/lab/baseline` (the user's one-off OK, 2026-11-07). They're
  references to compare by eye, not pixel tests. Phase 1 also pins the draw list in tests once
  there's a scene builder.
- **Done when:** the goldens pass on today's code and are committed. ✅

### Phase 1: units, projection, definitions, and the logic out of WalkView (**milestone 1**)
- `lib/world/units.ts`, `lib/render/projection.ts` (today's numbers), `lib/world/objects.ts` (the
  ~25 definitions), creature size classes with legacy heights.
- **Out of WalkView into the simulation:**
  - the thing list (`things()`) and the solid set (`rule()`);
  - foe and NPC setup and stepping;
  - entering rooms, cut-offs and falls;
  - putting the lights together;
  - campfire healing.
- **Out of WalkView into the scene builder:** a pure function from world state and camera to a
  draw list. WalkView keeps the frame loop, taps, the canvas, and the React windows (scroll,
  campfire). A targeted move, not a rewrite.
- **Not in phase 1** (the user, 2026-11-07): no saved placements, save versions or migrations
  (phase 2); no visual redesign, new gameplay or art. The instance type is defined, but nothing
  new is saved. Runs, saves and fixtures stay exactly as they are.
- **The brief** (the user, 2026-11-07):
  1. Consistent world units and object definitions.
  2. The projection in one place; the scattered pixel sizes (`FOE_PX`, `NPC_PX`, `OBJECT_PX`,
     `SACK_PX`, each prop's `size`, the kit's numbers) are read from it.
  3. The world and gameplay logic out of WalkView, without rebuilding the component.
  4. All behaviour, placements and visuals kept.
  5. Checked against the phase-0 goldens and the 16 visual references.
  - **Small, reviewable commits**, each passing the goldens, for example: units and projection;
    definitions; then each piece of logic moved, one at a time; then the scene builder.
  - **At the end, report** what changed, what's still tied to the renderer, whether any visual
    differences were found, and anything to fix before phase 2.
  - **Don't start phase 2:** the user reviews phase 1 first.
- **Done when:**
  - every phase-0 golden is unchanged;
  - the draw list for fixed test states is snapshot-tested (taken right after the move, with the
    move's diff reviewed line by line);
  - `npx tsc --noEmit`, lint and `npm run test:all` pass;
  - the scenes in `tests/visual-baseline/` are shot again (`phase1/`) and match `phase0/`: by
    eye, and by the average difference per colour channel (retaking phase 0 with the same build
    gave 0.0–0.2, which is torch flicker; anything well above that is a real difference to
    explain);
  - the user plays a run in each dungeon and confirms it looks and plays exactly as before.

### Phase 2: occupancy, the placement passes, saved placements, versions
- **2a, saved placements:** the save version and migration (§7). What today's placers place is
  saved into every run that starts or loads. Nothing on screen changes, and the goldens stay
  as they are. Released on its own.
- **2b, the new placers:** the occupancy map and passes (§5). Today's placers are rebuilt on them,
  keeping their rules and numbers, and become the only generator. The old ones survive only
  inside the isolated v0 converter (§7).
- **2c, intended changes:** the foe fix (§7, reviewing goldens), each in its own commit.
- **Done when:**
  - migrations are idempotent and keep all run state (§7); a Cyclops run with no `dungeon`
    field migrates as the Cyclops's;
  - invariant tests over 🧪 300 rolled rooms per dungeon (`slowIt`): reservations intact,
    required paths and access kept, nothing blocking overlaps, wall slots exclusive, spawns and
    loot spots reachable, pockets flagged;
  - the v0 fixtures migrate to exactly the phase-0 placements;
  - a v1 run survives save, export and import, and reload unchanged;
  - counts per room (decor, candles, torches, fires) stay within agreed ranges of today's;
  - the same seed always gives the same placements (deterministic), and every required path is
    valid;
  - balance kept: counts per room and room kind, foe spacing and distance from doors, loot and
    torch spread, within agreed ranges of today's (a sim, reported before the switch).

  ✅ The user agrees (2026-11-07): for the same seed, a new run's exact spots may differ from what
  today's code would have placed. Saved runs must stay compatible (§7).

  **Alongside phase 2: the art's geometry** (the user, 2026-11-07). Work out what the templates
  need (projected boxes, anchors, wall pieces, how multi-cell objects split) and try it with grey
  templates, without settling the look or building the full pipeline. The pipeline itself is
  phase 3.

### Phase 3: the art standard and its tools
- The dungeon art spec, palette (from the reference, with the user's OK), template generator,
  checks, test-room render. D for new art decided (§4.6).
- **Done when:**
  - a test pins template sizes to the projection;
  - the checks run over today's assets and give a report (the old kit is expected to be
    flagged);
  - the user approves the spec and a test-room render made with grey templates.

### Phase 4: the first assets to the standard
- One kit and the pillar, then the props, each through templates, checks, the test room, the game
  and the user's approval.
- **Done when:** the user approves each in the game. Only then does it go into the active
  registry.

## 9. Now, later, never

**Now (phases 0–4):** everything above.

**Designed for, built later:**
- **Height levels:** z is in the data and the projection. Steps, ledges and raised floors come
  later.
- **Stamps:** the format is in §5.5; the first is built when a room needs one.
- **Levers, traps, breakable walls:** a definition slot and instance state only.
- **A second setting:** packs are laid out for it; built once the dungeon pack is right.
- **4-way walking art for creatures:** size classes now, art later.
- **8 facings.**
- **A different renderer:** the world/scene split allows it; nothing is built for it.

**Not worth it for this game:**
- real 3D, or a rotating camera;
- a general game-engine object framework, or a physics engine;
- lighting tricks that give flat sprites depth (normal maps, dynamic shadows from sprites);
- smart pattern-matching or constraint-solving generators: passes plus stamps are enough;
- a level editor: stamps are text;
- re-drawing all 40+ creatures at once;
- more than one setting before the first is approved.

## 10. Decisions at sign-off (the user, 2026-11-07)

1. **Floor depth for new art:** decided in phase 3 from two proper in-game comparisons (§4.6).
2. **Creature sizes:** classes set in phase 1 from intended physical proportions, with sprites as
   a reference only; individual sizes where a class doesn't fit (§2).
3. **New placements may differ from the old generator's** for the same seed; saved runs stay
   compatible; the new generator must be deterministic, keep paths valid and keep the balance (§8).
4. **The palette:** the reference is the target, not a source; an original palette (§6.1).
5. **Order:** 0 → 1 → 2 → 3 → 4, with the art's geometry explored alongside phase 2 (§8).
6. **Old runs:** placements saved once from phase 1; legacy placers kept only until a sunset (§7).
