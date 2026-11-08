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
- **Two grids, one inside the other** (the user, 2026-11-07):
  - **The panel** is the full-sized dungeon floor tile: room and corridor layouts, walls, doors,
    tunnels, the floorplan, and major structures. It's what the code and the rest of this file
    have called a "cell" (`CELL_U`, "cells" in tile numbers); the names in code stay as they are
    until phase 2b touches them. **One panel is 1 u across** (`CELL_U = 1`), unchanged.
  - **The subcell** is a third of a panel each way: **one panel is exactly 3 × 3 subcells**
    (`SUBCELLS = 3`, phase 2b). Subcells are for physical sizes, object placement and occupancy,
    and one day for fine movement and collision.
  - Generation stays at panel resolution: rooms, corridors, doors and tunnels are laid out in
    panels, as now. Only what's put in the rooms uses subcells.
- **Subcell coordinates are integers.** How they relate to panels and to positions in u is
  defined once, in "Coordinates" below, and nowhere else.
- **Why u stays a panel, not a subcell:** every number from phase 1 (torch reach, sight, walk
  speed, the projection's `T`, the goldens) is in panels. Making u a subcell would rescale all of
  them for nothing.

### Coordinates: panels, subcells and u (the one definition)

This is the only place these sums are defined. In code they live in one module
(`lib/world/grid.ts`, from phase 2a) that everything else calls; nothing else writes `3`,
`/ 3` or `round(3x)`, and the renderer never sees subcells (it gets positions in u and the one
projection, §4, turns them into pixels; no pixel number changes).

- **Positions in u** are floats: `(x, y)`, x east, y south (below).
- **A panel** `(px, py)` is integers. Its centre is `(px, py)` u, and it covers
  `px − ½ ≤ x < px + ½` (and the same in y), as panels already do.
- **A subcell** `(sx, sy)` is integers, `SUBCELLS = 3` to a panel each way. Its centre is
  `(sx / 3, sy / 3)` u, and it covers `(sx − ½) / 3 ≤ x < (sx + ½) / 3`.
- **Panel → its subcells:** panel `px` holds subcells `3px − 1`, `3px`, `3px + 1`. The middle
  one, `3px`, is the panel's centre, so every place today's game puts a thing (a panel's centre)
  is a whole subcell.
- **Subcell → its panel:** `px = floor((sx + 1) / 3)`, and its place in the panel is
  `sx − 3px`, one of −1, 0, +1 (west, middle, east; north, middle, south in y).
- **u → subcell:** `sx = floor(3x + ½)`; **u → panel:** `px = floor(x + ½)`.
- **Boundaries:** every cover runs from its west (north) edge, included, to its east (south)
  edge, not included, so a point exactly on an edge belongs to the subcell or panel east (south)
  of it, and every point belongs to exactly one.
- **Negative coordinates** work the same, as all of the above uses `floor`, never truncation
  or `%`: subcell −1 is in panel 0, subcell −2 in panel −1 (`floor(−1 / 3) = −1`), and its place
  is `−2 − (−3) = +1`. Floorplans start at 0 today, but nothing assumes it.
- **Objects crossing panels:** a footprint is a rectangle of subcells (below). The panels it
  touches are the panels of its subcells, found one subcell at a time with the rule above, so a
  rectangle across a panel edge (or across several panels) needs no special case.
- **A footprint from its anchor subcell:** a definition's footprint is `w × d` subcells facing
  south, with an **anchor subcell** `(ax, ay)` inside it (default `(floor(w / 2), floor(d / 2))`:
  the middle, or just east and south of it for even sizes). An instance gives its anchor's subcell
  `(sx, sy)` and its turn `rot` (0–3 quarter turns, clockwise from above: a south-facing thing
  turned once faces west). Each footprint subcell `(i, j)` is at offset `(i − ax, j − ay)` from
  the anchor; a turn takes offset `(dx, dy)` to `(−dy, dx)`, applied `rot` times; the subcell is
  the anchor plus the turned offset. Integers throughout. A turned `w × d` covers `d × w`.
- **To u, for drawing and distances:** a subcell's centre is `(sx / 3, sy / 3)`; a footprint's
  edges are its subcells' outer edges. Its art anchor point (§2, measurement 5) is worked out
  from those in u.
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

### The measurements every object has (each separate)

The user (2026-11-07): collision occupancy, visual bounds, height, placement clearance and
interaction access are **separate properties**. None is worked out from another, and gameplay
never reads the visual one.

1. **Footprint:** the subcells it physically takes up on the floor (collision and occupancy), as
   a w × d rectangle of subcells when it faces south, placed by its anchor subcell (the sums are
   in "Coordinates" above). Examples (🧪 illustrations, not approved sizes): a candle 1 × 1, a chest 3 × 2, a
   campfire 2 × 2 or 3 × 3, a pillar 3 × 3 (a whole panel). A footprint may cross panel edges,
   and big creatures and structures span several panels. Walk-over things have a footprint too,
   in their own layer (§5.1); wall-mounted and overhead things have none. A creature's comes from
   its size class.
   - **Orientation:** an instance can be turned a quarter turn at a time (`rot` 0–3). A turned
     3 × 2 takes 2 × 3. A definition lists the turns it allows: only those it has art for, as a
     sprite can't be rotated in a three-quarter view (a chest seen from the side is other art).
     Most props allow only 0 (and left-right flips where the art allows, which don't change a
     symmetrical footprint).
2. **Clearance:** subcells round the footprint that must stay free of other solid things when
   it's placed (room to get round it, room for a wide picture not to sit over its neighbour).
   Kept apart from the footprint: it's a placement rule, not collision, and an object never
   blocks walking with its clearance.
3. **World height:** how tall it physically is, in u. Used for sight and light (does it block
   them), for drawing order on the same row, and by any future 3D renderer.
4. **Visual bounds:** the box its picture fills, in u, around its anchor (left, right, up, down).
   It may reach well past the footprint: a wolf's tail, a banner's tassels, a boss's arms. The
   renderer uses it for culling and drawing; gameplay never does.
5. **Art anchor** (not the anchor subcell, which places the footprint): the world point where it touches the floor (or its wall, or the ceiling), and the
   matching pixel in its art. For a floor object, the middle of its footprint's front (south)
   edge, or a creature's feet. The art's anchor pixel is stored with the art (§4.4), not worked
   out from the image. Worked out from the footprint in u, so it can fall on a subcell edge (a
   2 × 2's middle); that's fine, as the projection takes any position.
6. **Interaction access:** where you stand to use it and how near counts (§3), kept apart from
   the footprint: a chest's footprint can grow without moving where you open it from.

Wall-mounted objects also have an **attachment surface** (north wall face, east or west side
wall, south wall top), a **slot** along that wall in subcells (three to a panel's face; today's
wall torches are all in the middle one) and a height up the wall in u.

### Creature size classes

Each class sets a creature's footprint and its height range. The numbers are 🧪, to be set from
today's sprites in phase 1 so nothing moves:

| Class | Footprint (panels; code today) | Footprint (subcells; 🧪 phase 2b proposal) | Height (u) | Today |
|---|---|---|---|---|
| tiny | 1×1 | 1×1 | 0.4–0.8 | sprites, wisps |
| small | 1×1 | 2×2 | 0.8–1.2 | most foes (all drawn 1.375 u today: `FOE_PX` 22 at 16px) |
| medium | 1×1 | 3×3 | 1.2–1.8 | |
| large | 2×2 | 4×4 to 6×6 | 1.8–3 | the chief (today ×1.3, `CHIEF_SCALE`) |
| huge | 3×3 | 7×7 to 9×9 | 3+ | the Cyclops (today ×2.6, `BOSS_SCALE`) |

The subcell sizes are examples (the user, 2026-11-07), set in the dimensions review before phase
2b (they replace the panel ones in `lib/world/creatures.ts`, which nothing reads yet). A class
gives a default; **any species can have its own dimensions** instead.

A creature has four separate size properties, none worked out from another:
- **physical collision:** its body's footprint in subcells (from its class or its own size);
- **spawn clearance:** the free floor it needs round it to be placed (a boss's stand, a den);
- **visual bounds:** its picture (renderer only, as for any object);
- **movement capability:** how it moves: today every creature walks panel to panel or waits
  where it stands. One day: the narrowest corridor it fits through, which is why large creatures
  may need special rooms or wider corridors.

**Phase 2b has no multi-panel creature movement** (the user, 2026-11-07): every creature still
walks on panels as today, or waits at its stand, whatever its footprint; the footprint and
clearance are used only to check that its starting spot has room for it.

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
  footprint: { w: number; d: number }; // subcells, facing south (0×0: takes no floor). Phase 1's code has panels.
  rotations?: (0 | 1 | 2 | 3)[];       // quarter turns it has art for (missing: [0])
  clearance?: number;                  // subcells round the footprint other solid things keep off (placement only)
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
type Instance = {
  id: string; def: string; room: string;  // stable identity, and its type
  sx: number; sy: number;              // its anchor subcell, integers ("Coordinates", §2)
  rot?: 0 | 1 | 2 | 3;                 // quarter turns, where the definition allows them (missing: 0)
  wall?: "north" | "east" | "west";    // wall things: which wall it's on, beside the floor subcell sx, sy (today's `wall`: top, right, left)
  start?: string;                      // the state generation gave it (a wall torch that starts lit), never changed after
  facing?: number;                     // creatures: the way generation set them looking (§2), not a footprint turn
  size?: { w: number; d: number };     // phase 2b: the footprint it was placed with, unturned (missing: its definition's)
  legacy?: "panel";                    // placed by the old panel rules: see below
};
```

- **Instance ids are stable,** so saves and future triggers can name them: `<room>:<def>:<n>`,
  except that things that already have ids keep them (wall torches `<room>:<n>`, candles
  `candle:<room>`), because run state already saved (`lit`) names them.
- **Where it was put, and what's become of it, are kept apart** (the user, 2026-11-07): an
  instance is what generation made (its place, turn and starting state), and it never changes.
  What the player changes (lit, opened, beaten, looted, moved, a candle hidden by a campfire you
  made) is run state, saved separately (§7) and laid over the instances when the room is built.
  Loading never puts back something the player changed, and never changes an instance.
- **Physical size and legacy reservation are kept apart** (the user, 2026-11-07). An instance
  takes its physical footprint from its definition (or its `size`); it is never redefined as a
  3 × 3 to stand for "a whole panel". Where an existing run needs the old panel behaviour, the
  instance says so with `legacy: "panel"`, which means exactly what today's code does with it,
  and nothing more:
  - **for placement:** it reserves its whole panel against other placements (as today's placers
    keep things off each other's panels), in the occupancy map's reservation layer, not as a
    footprint;
  - **for navigation:** its panel is blocked only if its definition is solid (a chest, a cage,
    barrels). A walk-over thing (a candle, a skull, a dropped sack) stays walk-over, and a
    wall-mounted thing (a wall torch, a banner) takes no floor at all;
  - **for drawing, taps and reach:** from its anchor subcell, the panel's centre, as now.
- **Phase 2b instances** record the footprint they were placed with (`size`), so revising a
  definition's 🧪 size later never makes a saved room's things overlap or move.
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

### Sizes: the dimensions review (✅ the user, 2026-11-08)

Every definition's measurements (§2) proposed in subcells, from today's art and draw sizes
(`lib/world/objects.ts`) and what each thing is meant to be. Nothing reads them till 2b's placer
uses them. "Today" is what the game does now:
every floor thing takes one whole panel (3 × 3), and wall things take none.

Two facts shape the numbers:
- **Walking stays on panels** (§5.4), and a panel is blocked if any subcell in it is solid
  (§5.1). So a solid thing smaller than a panel still blocks its whole panel, and one that
  crosses into a second panel blocks both. Everything here fits in one panel,
  so it plays exactly as today.
- **Tunnels are a panel (3 subcells) wide,** so nothing that must pass through one can be wider
  than 3.

Turns: everything is 0 only (no side-view art), so each footprint is listed facing south. The
art anchor is the footprint's front (south) middle, or a creature's feet. Access: where you stand
to use it, kept as today (any panel round it, reach 1.5 u, tap 1 u; people tappable on the body
too) unless said.

| Thing | Footprint (w × d) | Collision | Clearance | Height (u) | Picture today (u wide × tall) | Notes |
|---|---|---|---|---|---|---|
| chest (and a boss's loot chest) | 3 × 2 | solid (loot: walk-over, as now) | 1 in front | 0.8 | 1.75 × 1.75 | the user's own example; fits its panel |
| sack (stash, a fight's loot sack) | 2 × 2 | solid (loot: walk-over) | 0 | 0.6 | 1.0 × 1.04 | |
| rickety chest (storehouse stores) | 3 × 2 | solid | 1 in front | 0.8 | 1.75 × 1.66 | |
| deck of cards (on its table) | 3 × 2 | solid | 1 in front | 0.8 | 1.75 × 1.85 | |
| healing pool | 3 × 3 | solid | 1 all round | 0.3 | 2.5 × 1.88 | one panel, as today (the user); its picture stays wider than it |
| cage | 3 × 3 | solid | 0 | 1.2 | 1.38 × 1.38 | a whole panel, as today |
| campfire | 2 × 2 | solid | 1 all round, kept clear of candles too (§5.6) | 0.6 | 1.5 × 1.49 | fits its panel |
| candle (floor) | 1 × 1 | walk-over | 0 | 0.4 | 0.44 × 0.82 | |
| candle (wall, new: §5.6) | none; 1 wall slot | none | a gap from other lights 🧪 | 0.4 | as the floor one | north, west, east and south walls |
| wall torch (north, side) | none; 1 wall slot (of 3 a panel) | none | `SCONCE_EVERY` gap, as now | 0.5 | 0.32 × 0.45 | |
| banner | none; 3 wall slots (a panel's face) | none | 0 | 1.2 | 0.88 × 1.18 | |
| pillar | 3 × 3 | solid; blocks sight and light | 0 | 2.375 | a wall block | a whole panel, as today |
| rubble (fallen-in tunnel) | 3 × 3 | rock, as now | 0 | 0.5 | | a whole panel |
| barrels | 3 × 2 | solid | 0 | 0.9 | 1.25 × 0.93 | against a wall |
| crates | 3 × 3 | solid | 0 | 1.1 | 1.0 × 1.24 | |
| fallen pillar | 3 × 2 | solid | 0 | 0.7 | 1.5 × 1.34 | one panel (the user) |
| skull | 1 × 1 | walk-over | 0 | 0.3 | 0.69 × 1.03 | |
| nest | 2 × 2 | walk-over | 0 | 0.3 | 0.94 × 0.9 | |
| pots | 2 × 2 | walk-over | 0 | 0.5 | 0.75 × 0.74 | |
| merchant (with his cart) | 3 × 2 | solid when stopped, none while he walks (§5.7) | 1 in front | 1.4 | 1.38 × 1.63 | the cart's in his picture; 3 wide, so he fits a tunnel |
| librarian | 3 × 2 | solid when stopped, none while walking | 1 in front | 1.4 | 1.64 × 1.63 | |
| card witch | 2 × 2 | none (as now) | 0 | 1.3 | 1.38 × 1.63 | |
| you (the hero) | 2 × 2 (small) | none against foes, as now | 0 | 1.1 | 2.5 × 2.5 (frame) | |

**Creatures, by size class** (§2; the species list is in `lib/world/creatures.ts`):

| Class | Footprint | Height (u) | Spawn clearance | Who (examples) |
|---|---|---|---|---|
| tiny | 1 × 1 | 0.4–0.8 | 0 | wisps, sprites, rats, flies |
| small | 2 × 2 | 0.8–1.2 | 0 | wolves, toads, bats, beetles, imps |
| medium | 3 × 3 | 1.2–1.8 | 0 | the dire wolf, the veilstalker, the swamp witch, Rattlebones, the baby cyclops |
| large | 5 × 5 | 1.8–3 | 1 | the crystal golem, the void serpent, the tunnel wyrm, the storm phoenix |
| huge | 8 × 8 | 3–5 | 1 | the Cyclops, the Hydra's heads |

- Medium is the largest that fits a tunnel. Large and huge creatures never leave their rooms
  (none does today), and in 2b nothing walks bigger than a panel (§2), so these sizes only check
  that a starting spot has room. The smallest rooms are 4 panels (12 subcells) across and the
  boss's room 12 × 8 panels, so a large foe fits any room and a huge boss its stand.
- Today every foe's picture is 1.375 u tall whatever its species (bosses ×2.6, the chief ×1.3).
  These heights take over only when creature art is redone to the standard (§2).
- Even sizes (2 × 2) have no middle subcell: their anchor is the subcell just south-east of the
  middle (§2), so the placer puts the footprint inside one panel.

**Set by the user (2026-11-08):** the pool and the fallen pillar each keep to one panel; the
size classes' footprints and heights as above; every species' class in `lib/world/creatures.ts`
as it is. So in 2b no thing blocks more floor than it does today.

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

Each room has an occupancy map **at subcell resolution** (phase 2b), over the room's floor
panels (each is 3 × 3 subcells; walls and rock are never floor), with separate kinds of space,
each with its own rules:

| Space | Holds | Rule |
|---|---|---|
| **Floor (blocking)** | solid floor objects: pillars, chests, cages, barrels, campfires, NPCs' carts | one thing per subcell, so several small things can share a panel; every subcell of a footprint must be on floor; clearance kept; may not break a reservation (§5.2) |
| **Floor (walk-over)** | skulls, nests, pots, candles, decals, worn tiles | may sit under foes' and your paths; not on a blocking thing; may overlap other walk-over things only if their definitions allow it |
| **Wall slots** | wall torches, banners, wall candles, future levers or switches: three per wall panel, per face (north face, side walls; the south wall from 2b, §5.6) | one thing per slot, plus a gap rule (`SCONCE_EVERY`, in panels) |
| **Overhead** | hanging things (none yet) | no collision; one per subcell |

A footprint that crosses a panel edge is fine, as long as every subcell under it is floor; a
3 × 2 turned a quarter takes 2 × 3 and is checked as that.

**Physical occupancy and navigation occupancy are separate maps** (the user, 2026-11-07):
- **Physical occupancy** is what is where, in subcells: each thing's real footprint, plus the
  legacy panel reservations (§3). It's the truth, and it never changes to suit how walkers move.
  Placement reads it.
- **Navigation occupancy** is worked out from it, for the way things move at the time, and only
  walking reads it. **Today's movement is on panels, so: a panel is blocked if any subcell in it
  is solid**, or a `legacy: "panel"` instance with a solid definition is on it (✅ the user,
  2026-11-07). That's exactly today's rule for everything today's game places.
- The whole-panel rule is an **interim compatibility measure** while movement stays on panels.
  A small solid thing in a panel's corner is a corner in the physical map, so finer movement
  later (§5.4) can walk round it with no change to placements or saves; only the navigation map
  is worked out differently.

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

While walking is on panels, reservations are whole panels (a reserved panel has no solid
subcell), and "at least 1 wide" means 1 panel. Any placement that would block a reserved cell, cut a required path or cut off an interaction
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
5. **Wall slots:** wall torches, banners, wall candles (§5.6).
6. **Lights on the floor:** campfires, then candles, by a wall or near the middle (§5.6).
7. **Spawns:** where each foe starts, where each NPC starts (§5.7), the boss's stand.
8. **Decor:** blocking decor against walls, walk-over decor anywhere left.
9. **Floor variety:** worn floor and wall tiles. Purely visual, so these stay worked out from the
   seed and aren't saved.

**Separate randomness per room and per pass:** each pass in each room gets its own random
numbers from (run seed, room, pass). Changing one pass no longer moves everything after it, as
today's single shared stream does.

### 5.4 Movement, foes and interactions

- **Walking:** the floorplan's walkable cells, less the solid footprints, plus the forward rule
  (`stepRule`). Since phase 1 this is put together in `lib/world/walkWorld.ts` (`walkRule`).
  The pathfinding itself (`findPath`, diagonals that never cut a rock corner) stays.
- **Walking stays on panels until the user decides to change it** (the user, 2026-11-07: subcells
  don't mean changing movement now). You, foes, the witch and the merchants path panel to panel,
  over the panels the occupancy map calls free (§5.1). ⏸ **Designed for, later: walking on
  subcells.** What it would take, so nothing built now stands in its way:
  - the walk graph's nodes become subcells (9× as many: fine for rooms this size, but it gets its
    own speed test), with the same rules (no cutting a rock corner);
  - each walker gets a body footprint from its size class, and a path is found for that body
    (solid things grown by its size), so a big creature can't squeeze where a small one can;
  - corridors and tunnels are 1 panel (3 subcells) wide, so anything over 3 × 3 couldn't use
    them: big creatures stay in their rooms, as bosses already do;
  - taps, reach, sight range and torch reach are in u already and don't change; positions are
    floats already, so saves don't change either;
  - it changes how the game plays, so it comes in as an intended change, with its own goldens
    (§7).
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

### 5.6 Candles by any wall (📌 requirements, the user 2026-11-07; built on 2b's placement)

Today a candle is a floor thing near a room's middle (`placeCandles`: 🧪 35% of rooms, 2–5 panels
from the middle, clear of doors; unlit till you walk near). The user wants candles along the
south, west and east walls too, as well as the north one.

- **Two kinds of definition:** a **floor candle** (walk-over, attach `floor`) that may stand
  against any wall, in the floor subcells next to it; and a **wall candle** (attach `wall-*`,
  takes no floor) in a wall slot, like a wall torch. Each wall gets its own art and anchor:
  - **north:** on the wall's face, seen face on; sorts on its wall (as a wall torch, −0.6);
  - **west and east:** seen edge on, a side variant (as `sconce-side`, +0.4);
  - **south:** wall-mounted candles too (✅ the user, 2026-11-07), on the wall's inside face, as
    well as floor candles by it. The camera looks over the south wall from behind, and the wall
    is drawn as its top band only, fading near you (`capFade`), so a south-mounted candle may be
    hidden behind the band, or show only while it fades: that's fine (the user). Its light still
    shines into the room from the floor subcell beside the wall, seen or not.
- **Wall slots gain the south wall** (§5.1: today the north face and the side walls). The
  instance's `wall` gains `"south"`. An older copy of the game would read that as an unknown
  wall and hold the run as damaged, so it comes with 2b's world version, never on its own.
- **Light starts where the candle is:** at its anchor subcell, not its panel's middle. A wall
  candle's light starts in the floor subcell beside its wall (as a wall torch's does today), so
  it never starts inside rock. It goes through `torchLit`, so walls and anything with
  `blocksLight` stop it; and as now it counts for what you've seen only while the candle's in
  your sight.
- **Never in a campfire's space:** campfires are rolled as the run starts (`fires`), so pass 6
  places them first and a candle can't take a subcell in a fire's footprint or its clearance
  (🧪 a panel). Today's rule (a candle within 2 panels of a fire isn't drawn) stays only for
  runs placed by the old rules.
- **Placement rules** (pass 5 for wall candles, pass 6 for floor ones): not in a door's
  reservation, not on a required path if it blocks (a floor candle is walk-over, so it may sit on
  one), not in a slot a wall torch or banner has, and a gap from other lights (🧪). How many per
  room, and what share by the walls, are 🧪 numbers for the user; counts stay within agreed
  ranges of today's unless the user changes them (§8 2b, done when).
- **Ids:** today's `candle:<room>` stays for the candle a run already has (`lit` names it); more
  than one a room become `candle:<room>:<n>`.

### 5.7 Wandering NPCs and the lights they carry (📌 requirements, the user 2026-11-07; a feature after 2b)

The merchant, the librarian and the card witch may walk out of their rooms and round the
dungeon, each carrying a light, so the world feels lived in. Simple, not clever: no elaborate AI.

- **Friendly, not foes.** NPCs and foes are different walkers with different rules: NPCs never
  see you, raise an alarm or start a fight; foes keep to their rooms (§5.4) as now. An NPC
  doesn't block foes' sight or your path (`collision: "none"`, as the witch is today), and foes
  ignore them.
- **Where they start:** a saved start (an instance, as the witch has today), placed in pass 7 at
  a reachable spot in their home room. Stable: the same every time the run opens. Where they've
  wandered to is for this visit only, not saved, as for foes (2a′); saving it is a later
  feature.
- **Where they may go:** the panels the run's live floorplan calls walkable (`shutPlan`: a
  tunnel that's fallen in or closed is rock), less solid things, and only through open
  passages. 🧪 They keep to rooms and tunnels you could walk to now (the up tunnels' one-way
  rule, `stepRule`, applied to them too, so nobody walks through what's closed behind you).
  **Never into a hostile room; free to roam any other** (✅ the user, 2026-11-07): a hostile room
  is one with foes still to beat (a fight room not yet beaten, or an ambush not yet sprung);
  once it's beaten it's open to them like any other.
- **How they wander:** pick a reachable spot (often in their own room, now and then in a room
  next to it), walk there at a walking pace, pause a while (🧪 a few seconds), pick again;
  deterministic per visit from the run's seed, like the foes' wandering. Never on top of you.
- **A light each:** a lantern, a torch or a glow, by who they are (a definition field: radius,
  colour, flicker, held a little above their feet), worked out each frame from where they are
  through `torchLit`, so walls and occlusion stop it. As with candles, it counts towards what
  you've seen only while they're in your sight (so a merchant down the corridor doesn't map it
  for you). A moving light like this already exists: an alarmed foe's (`ALARM_LIGHT`).
- **Using them where they've got to:** tapping and reach follow them (`tapBody`, as the witch's
  now); the shop, the library's books and the witch's game stay their home room's state.
- **The merchant walks with his cart** (✅ the user, 2026-11-07): you buy from him wherever he's
  got to. Tunnels are a panel wide, so the moving cart mustn't trap you: 🧪 neither blocks you
  while they walk (only once they stop), and they never stop in a tunnel or a doorway.
- **What 2b must give it:** the NPCs' start spots as saved instances from the new placer (pass
  7), their home room on each, their light as a definition field, and the walk rule for NPCs
  kept apart from the foes' and yours. Nothing in 2b moves them.

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
  saved into every run that starts or loads, generated exactly as today. Nothing on screen
  changes, and the goldens stay as they are. Released on its own.
  - **Subcells in 2a:** only the save format and the coordinate module (§2 "Coordinates", §7:
    anchors in integer subcells, `legacy: "panel"`). No subcell occupancy, no new sizes, no
    change to placement, walking or drawing.
  - **Not gated on the dimensions review:** 2a gives nothing a new size.
  - **2a is done when:**
    - nothing on screen or in play changes: the phase-0 and phase-1 goldens, the walk-sim and
      draw-list comparisons pass as they are, frame for frame, on every fixture;
    - a new run is saved with exactly what today's placers place for it, and a v0 fixture
      migrates to exactly what today's game shows for it;
    - built from its saved instances, a room has the same solid cells, walk rule, things to tap,
      reach, lights and drawing as built by today's placers;
    - no wall thing has a floor footprint, no walk-over thing blocks a panel, and only solid
      definitions block navigation;
    - run state is kept apart: lit torches stay lit, opened things stay open, beaten rooms stay
      beaten, and a migration never changes run state or an instance once saved;
    - migrating is idempotent: once, twice or after load → save → load gives the same run, with
      no instance duplicated and every id unique;
    - a Cyclops run with no `dungeon` field migrates as the Cyclops's; a v1 run survives export
      and import; older code still plays a v1 run (it ignores `placed`);
    - the coordinate sums have their own tests: panels ↔ subcells ↔ u both ways, edges and
      negative coordinates (turned footprints across panel edges: in 2b, with their first use).
  - **Foes' starts and the order** (✅ the user, 2026-11-07): 2a doesn't save them (§7). The foe
    fix comes straight after 2a and before 2b ("2a′" below), as its own approved behaviour
    change with its own tests and commit, so foes are saved before 2b replaces their placer.

#### 2a: the implementation design (✅ signed off by the user, 2026-11-07; built)

**The data.** `WalkRun` gains two optional fields: `v?: 1` and `placed?: Instance[]` (§3). No
`states` field: everything the player changes already has a home in the run (`lit`, the rooms,
`spots`, `fires`, `known`…), so 2a adds none; a `states` map comes with the first thing that
needs one (levers, traps).

**What gets an instance in 2a, and its id** (ids come from generation, never random, so making
them twice gives the same ones):

| What | id | def | anchor | also saved |
|---|---|---|---|---|
| wall torch (room or tunnel) | today's (`<room>:<n>`, `<tunnel>:<n>`) | `sconce` / `sconce-side` | the floor panel beside its wall | `wall` (top → north, left → west, right → east); `start: "lit"` if it starts lit |
| candle | today's (`candle:<room>`) | `candle` | its panel | |
| the card witch | `<room>:witch` | `witch` | where she starts | `facing` (her starting look, rolled today) |
| a room's feature | `<room>:<def>` | `chest`, `sack`, `pool`, `card-deck`, `merchant`, `librarian` | the room's middle | |
| a large room's stores | `<room>:stores` | `sack` (library) / `rickety-chest` (storehouse) | the room's middle | |
| a camp's cage | `<room>#<i>` (today's tap key) | `cage` | its spot along the top | |

Every one has `legacy: "panel"` and an anchor `(3x, 3y)` from today's whole-panel position. What
a thing looks like (shut or open, lit, the witch's game over) and whether it's shown at all (a
library's stores till its guard's beaten) stay decided from run state, by today's rules, as now.
An instance is made for everything a room can show, so one that isn't shown yet is already
there. Not instances in 2a: foes (2a′), a beaten room's loot (`spots`, run state: it's where the
fight was), campfires (already saved, `fires`), worn floor (from the seed, never saved, §5.3).

**Reading them.** One new module, `lib/world/placements.ts`, builds a room's contents from
`placed` plus run state: the wall torches (lit if `start` or in `lit`), the candles (hidden near
a campfire, as now), the witch's start, and each feature's and cage's spot for `thingsOf`. The
walk screen and the test baseline call it instead of the placers. Foes still come from today's
placer, live, as now.

**Making them: one function, isolated.** `lib/world/compat/v0.ts` holds `legacyPlacements(run)`,
the only code that calls today's placers for this (`placeSconces`, `placeCandles`, the witch's
`placeFoes` on its own seed, `cageSpots`, the room middle). In 2a it's also how a new run gets
its placements (today's placers are still the live ones, so there's one copy, §7). A test checks
that nothing but it, and tests, imports those placers; in 2b the new placers take over new runs
and frozen copies move into `compat/`.

**Migrating: one pure function.** `migrateWalkRun(run)` in `lib/world/migrate.ts`:
- no `walk`: returned as it is. `placed` present: returned as it is (the same object), never
  merged, topped up or regenerated. Otherwise (v0): `placed` from `legacyPlacements`, `v: 1`,
  and nothing else touched.
- **One way in** (the user, 2026-11-07): the game reaches it only through `openWalkSave(save,
  write)` (a saved run **opened to be played**, as the Labyrinth screen loads the save: your own
  save, a save slot, a cloud save and an imported file all land in the same save first; a
  migrated run is written back straight away) and `placedRun` (a **new run** as it's made, and
  the lab pages' made-up runs). Placements are read only through `placementsOfWalk`. A test
  (tests/migrate.test.ts) fails if anything else imports `migrateWalkRun` or reads a run's
  `placed` outside `lib/world/`, so a new feature can't read an unmigrated run or migrate one
  its own way: it calls `openWalkSave`. Not inside `loadDungeon` itself: the world's modules import
  the dungeon's, so the save code calling them would make a circle of imports (as built,
  2026-11-07). Nothing outside the Labyrinth screen reads placements, so a v0 run elsewhere in
  the save is harmless till it's opened; and 2a's placements depend only on the run's seed and
  layout, never on what you've done, so when it's migrated changes nothing. The forward-
  compatibility guard needs no world modules, so it does sit in `loadDungeon` and `saveDungeon`.
- **Exported files** are unchanged: a v0 run in a file is migrated when it's imported and opened.
  `SAVE_FILE_VERSION` and cloud saves are untouched.
- **Older code** (the other computer, not yet updated) ignores `v` and `placed` and plays as
  today; it keeps them when it saves the run (it copies runs whole). Were they lost, the new code
  would find the run damaged, and the player could mend it (below). Newer runs meeting older clients:
  §7, forward compatibility.

**Idempotent and deterministic.** Ids and placements come only from the run's seed and layout;
migrating a migrated run returns it unchanged; `placed` is never added to, so nothing can be
duplicated.

**Malformed or unsupported placements are handled explicitly** (the user, 2026-11-07), never
read as an empty list. `migrateWalkRun` checks `placed` and says what it did:
- **migrated:** a v0 run, given its placements;
- **unchanged:** a v1 run whose `placed` is sound: a non-empty list, every entry with a string
  id (no two the same), a known definition, a room, whole-number subcells, and known values for
  its wall, turn and legacy mark;
- **damaged:** a v1 run whose `placed` is missing or unsound, a v0 run carrying a `placed`
  (a legacy run never has one), or one whose placements can't be made (a broken layout). Never
  made again on its own (the user, 2026-11-07): kept exactly as stored, never played or written
  over, said in the console, and the Labyrinth says the run can't be opened;
- **repaired:** a damaged run mended **only when the player taps "Mend its rooms"** there
  (`recoverWalkRun`, `recoverWalkSave`). Offered only where today's rules made its placements
  (a v1 run, or a v0 run carrying some), so making them again gives the same ids and spots;
  what you've done in it is kept. A run from 2b's rules can't be mended this way;
- **unsupported:** a run from a newer world version: left exactly as stored (§7, forward
  compatibility).

**Verifying "looks and plays the same":**
1. **Equivalence (the main test):** for the six fixtures and 50 rolled runs per dungeon (as
   built: 300 took 8 minutes, rolling a run being most of a second)
   (`slowIt`), at several points in a run (fresh, rooms beaten, torches lit, campfires used),
   the contents built from `placed` match today's placers exactly: torch ids, spots, walls and
   lit; candles; the witch's start and look; every thing to tap (key, spot, def, state, solid);
   solid cells; the walk rule; the lights.
2. **The phase-0 and phase-1 goldens** (scenes, motion, draw lists, sweeps) and the walk-sim and
   draw-list comparisons all pass untouched, now built from `placed` (the baseline switches to
   the new reading path, as phase 1 step 3 did).
3. **Migration:** migrating twice equals once; load → save → load equals load; a JSON round trip
   changes nothing; apart from `v` and `placed`, the run is deep-equal to before; every id is
   unique; a Cyclops run with no `dungeon` field migrates as the Cyclops's; a save exported and
   imported keeps its v1 run.
4. **New goldens, not changed ones:** each fixture's `placed` pinned as
   `tests/golden/walk/<fixture>.placed.json`, so a later change to the converter shows up.
5. **Rules:** no wall thing or walk-over thing makes a panel solid; only solid definitions do.
6. **Coordinates:** `lib/world/grid.ts` with its own tests (panels ↔ subcells ↔ u, edges,
   negatives). The footprint and turn sums come in 2b with their first user.
7. `npm run test:all`, `tsc`, lint, `build`, `build:offline`; then the user plays a run in each
   dungeon, including one already under way from before the update.

#### 2a′: the foe fix (✅ approved 2026-11-07, its own change; built 2026-11-07, world version 2)

- **Generated starts:** each fight room's foes saved as instances (def `foe`), `<room>:foe:<i>`
  (i: the foe's place in the room's enemy list; a waiting boss or chief is `:foe:0`), with what
  today's placer rolls for them: spot, `facing`, and `foe: { walks?, wait, end? }` (whether it
  wanders, its first wait, its end of a two-den room), or `foe: { waits: true }` for a waiting
  boss (its endless wait isn't a number JSON can hold, so it's made again on load). Saved once,
  never changed. Made by `legacyFoePlacements` (lib/world/compat/v0.ts), the old placer's one
  stream (seed + 303), room by room, for the rooms still to beat.
- **An ambush not yet sprung** showed no foes, so the old stream skipped it. Its foes are placed
  after everyone else's, on the same stream, so they're saved too (somewhere to stand once it
  springs) and nobody else's start moves.
- **Current positions:** where a foe has wandered to stays as now: for this visit only. Each time
  the walk screen opens, foes start again from their saved starts (✅ the user, 2026-11-07; the
  same for the witch). Three things kept apart: the **generated start** (saved, never changed),
  the **current position** (this visit only), and **gameplay state** (beaten, removed: saved, in
  the run). Saving where creatures have wandered is its own feature, later, with richer
  exploration.
- **Beaten foes:** a beaten room's foes aren't built (its `done`, as before: walkWorld.ts
  `foeStarts`). Their instances stay in `placed`, so no id is ever reused and no other room's
  foes are worked out again.
- **Migration v1 → v2:** adds the foes today's game would show at that moment (only rooms not yet
  beaten have any), keeping the rest of `placed` and all run state as they are, and is written
  back straight away (`openWalkSave`), as this one depends on what you've done. A v0 run goes
  straight to v2. A copy of the game from before this (it reads up to v1) meets a v2 run as
  newer and leaves it alone (§7, forward compatibility): update both computers.
- **Checked:** a v2 run's foe instances must be sound (the id's form, known values) and every
  room still to beat must have exactly its foes saved (`foesToPlace`), else the run is damaged
  and held, never read as "no foes". "Mend its rooms" works for v1 and v2 runs: its foes come out
  as first made if no room's been beaten since, otherwise as the game would show them now.
- **Tests** (tests/foeStarts.test.ts): on the six fixtures and twelve rolled runs, as saved and
  with half their fights beaten, from v0 and from v1, the saved starts equal the old placer's
  (tests/foeStartsBefore.ts) at conversion, and beating any one room changes nothing saved and
  moves nobody else; a test shows the old placer did move them; the ambush; v1 → v2; broken foe
  starts held and mended. The only golden change: each fixture's `*.placed.json` gains its foes
  at the end (everything before them unchanged). The scene, motion and draw goldens pass
  untouched, as each fixture is converted at the state it's in.

- **Before 2b: the dimensions review, in subcells** (✅ set by the user, 2026-11-08: §3,
  "Sizes"). Every definition's footprint, turns, clearance, height, visual bounds and interaction
  access, and each creature's size.
- **2b, the new placers:** the occupancy map at subcell resolution and the passes (§5), with
  room and corridor generation still in panels. Today's placers are rebuilt on them, keeping
  their rules and numbers, and become the only generator. The old ones survive only inside the
  isolated v0 converter (§7). Walking stays on panels (§5.4).
  - Rebuilt with each thing still filling its panel, nothing in play changes but what the user
    already agreed may (§10.3: new runs' exact spots). Giving things their reviewed subcell sizes
    (two small things sharing a panel, a chest that's 3 × 2) changes what new rooms look like and
    where you can walk, so it's an intended change, in its own commit, approved first.
  - **The foundations for candles by any wall and for wandering NPCs** (the user, 2026-11-07;
    §5.6, §5.7): south wall slots and `wall: "south"`, wall and floor candle definitions with an
    anchor and art slot per wall, a light's origin at its anchor subcell, campfires placed before
    candles with their space kept clear, and NPCs' starts as saved instances with a home room and
    a light field. All of that is the placement system's own work, with no change in play. The
    extra candles themselves (along the walls, perhaps more per room) change what rooms look like,
    so they come in as an intended change, approved first, with their wall and side art made and
    approved the usual way (PixelLab samples first). Nothing in 2b makes NPCs move.

#### 2b: the implementation design (✅ 2b-1 signed off by the user, 2026-11-08; built, not yet released)

**Two steps, each its own commit and release:**
- **2b-1, the new placers** (this design): new runs are placed by the passes (§5.3) on the
  occupancy map (§5.1), as world version 3. Every floor thing still takes its own panel, so rooms
  look and play as now; only spots rolled at random today come out differently (§10.3, agreed).
- **2b-2 and after, intended changes, each approved first:** things sharing a panel at their
  reviewed sizes; the extra candles by every wall (with their art); decor and banners in real
  runs. None of these is in 2b-1.

**Versions.** v3 means "placed by 2b's rules". Runs saved at v1 and v2 keep their placements for
good: nothing migrates to v3, so their rooms never change (a v0 run still converts to v2 through
`compat/v0.ts`, as it showed). This is the one version bump that comes with a new generator, not
a migration. `WALK_V` becomes 3. A copy of the game reading up to 2 meets a v3 run as newer and
leaves it alone (§7), so the laptop is updated before a v3 run is played anywhere else (Vercel and
the phone update themselves).

**The data.** A v3 instance has no `legacy` mark and carries `size` (its definition's footprint
when placed, §3), so changing a definition's size later never moves a saved thing. `wall` gains
`"south"`, accepted only in a v3 run (a v1 or v2 run with it is damaged, as now). The definitions'
footprints change from panels to the reviewed subcells (§3 "Sizes"); only placement reads them.
Ids as today (`<room>:<n>` torches, `candle:<room>`, `<room>:<def>`, `<room>#<i>` cages,
`<room>:witch`, `<room>:foe:<i>`), so `lit` and the taps keep working.

**New modules:**
- `lib/world/grid.ts` gains the footprint sums: the subcells a footprint covers from its anchor
  (centred on it; an even size's anchor is the subcell just south-east of the middle, §3), with
  quarter turns swapping w and d, the panels it touches, edges and negative coordinates.
- `lib/world/occupancy.ts`: one map per room in subcells, with the layers of §5.1 (blocking,
  walk-over, wall slots on all four walls, overhead), the reservations, and `navBlocked`: a panel
  is blocked if any subcell in it is solid (today's rule, worked out, never stored).
- `lib/world/place.ts`: the passes in order, room by room, each on its own random stream from
  (run seed, room, pass), so a change to one pass never moves anything another placed.
- `lib/world/compat/v0.ts` takes frozen copies of today's placers (`placeSconces` and the
  tunnels', `placeCandles`, `placeFoes`, `placeWaiter`, `cageSpots`) and the helpers they need;
  the live ones go from the generation code. `placements.ts` reads v3 instances too (today's
  "candle by a campfire isn't drawn" rule kept only for legacy instances).

**The passes, keeping today's rules and numbers:**

| Pass | What | Rule (as today unless said) | Differs from today's game? |
|---|---|---|---|
| 1 reserve | doors and the panel inside each, a path between every pair of doors and from the doors to each progression point (1 panel wide), the room's middle, the waiting boss's stand and the way up to it, the cages, the guarded chest's spot | worked out from the layout | no (new: nothing may now block them) |
| 2 stamp | none yet: the pass is there, empty (§5.5) | | no |
| 3 structure | pillars stay rock in the layout (`inner`, already saved): read into the map as blocked, not made into objects | `interior.ts` as now | no |
| 4 things you use | each room's feature and a large room's stores at its middle; cages along the top; the merchant and librarian at the middle, saved as starts with their home room | fixed spots, nothing random | no: the same spots |
| 5 wall slots | wall torches: same spots (fixed by the rule), one in `SCONCE_EVERY`; which start lit, and which tunnels get them, rolled per room | `SCONCE_LIT_SHARE`, `TUNNEL_SCONCE_CHANCE` | which are lit at the start |
| 6 floor lights | campfires (already rolled, `fires`) marked first with their clearance; then candles | `CANDLE_CHANCE`, 2–5 panels from the middle, 3 from doors; new: never within 2 panels of a fire | candles' spots (question 1) |
| 7 spawns | every fight room's foes, the ambush's included, and the card witch | `FOE_GAP`, `DOOR_CLEAR`, not the top row, one end each in a two-den room, the boss's stand; new: never on a solid thing or a reserved point, never in a pocket you can't reach | foes' and the witch's starts |
| 8 decor | lab only (`/lab/newrun`), as now, by its own rule from the seed, not saved; it moves onto the new map when it comes into real runs | `decor.ts` | no (not in real runs) |
| 9 floor variety | worn tiles from the seed, not saved | | no |

What that fixes as a side effect: nothing in today's foe rule keeps a foe from starting on a
room's chest, pool or cage; in a v3 run it can't. And as every fight room's foes are placed when
the run is made, on their own room's stream, beating a room can't move anyone, and a damaged v3
run can be mended by the same placers giving the same ids and spots.

**The foundations (no change in play):** wall candle definitions for each wall (`candle-wall`,
`candle-wall-side`, `candle-wall-south`), each with its anchor and an art slot holding today's
candle until its own art is made; a light's origin at its anchor subcell; the south wall's slots
in the map; a `light` field on the merchant, librarian and witch (🧪 numbers, read by nothing
yet); and the NPCs' walk rule as its own function, giving today's rule for the witch. Nothing
places a wall candle or moves an NPC.

**Tests:**
1. **Old runs untouched:** every phase-0 and phase-1 golden, each fixture's `*.placed.json`, the
   foe-start tests and the walk-sim and draw comparisons pass as they are (the fixtures are v0
   to v2, read through the converter).
2. **Invariants** (`slowIt`, 🧪 300 rolled rooms per dungeon): reservations intact, every
   required path walkable, no two blocking things on one subcell, one thing per wall slot, every
   foe, NPC and loot spot reachable from a door, pockets over 🧪 6 panels flagged.
3. **Kept the same:** on rolled runs, a v3 run's torch spots, features, stores and cages are
   exactly today's placers'; its solid panels are those things' panels, as now.
4. **Deterministic and stable:** the same seed gives the same placements; beating any room, or
   springing the ambush, changes nothing saved; save, export, import and reload change nothing;
   a mended v3 run equals the run as made.
5. **Versions:** a v3 run is held by a client reading up to 2; `wall: "south"` is refused below v3.
6. **The sim, reported before the switch** (§8 "Done when"): candles, lit torches and foes per
   room and per room kind, foes' spacing and distance from doors, on 🧪 200 runs per dungeon,
   v3 against today's placers.
7. `npm run test:all`, `tsc`, lint, `build`, `build:offline` (in a temporary clone); then the
   user plays a fresh run in each dungeon, and one already under way from before.

**The user's decisions (2026-11-08):**
1. **Optional things try again before they're dropped:** a candle (and any optional thing after
   it) whose spot is taken or too near a campfire tries every other valid spot in its room, in a
   deterministic random order, and is left out only if none is valid; never forced somewhere
   invalid. The rise in candles this gives is an approved, intended change (measured by the sim).
2. **Pillars stay rock in the layout,** but the placer sees their space through the same
   occupancy rules as everything else (no special case for them). A breakable pillar would later
   get its own identity and state.
3. **Decor and banners stay in the lab;** each comes into real runs later as its own approved
   change, once placement has proved reliable.
4. **Release:** the design's docs commit stays separate and unpushed, released with 2b-1 after
   testing and the user's approval.
5. **Scope of 2b-1:** full-panel placement only. No subcell-sized placements, extra wall candles,
   decor in real runs, new creature collision or art changes. A required thing whose spot is taken
   goes to the nearest valid panel, and that's reported (the sim expects none).

**As built:** `lib/world/place.ts` (the passes), `lib/world/occupancy.ts` (the shared rules),
`lib/world/grid.ts` (footprint sums), `lib/world/compat/v0Placers.ts` (the frozen old placers);
`newWalkRun` (lib/world/migrate.ts) places a new run. Tests: tests/place.test.ts.
#### 2b-2: the dimensions in use, and its stages (✅ approved by the user, 2026-11-08, with the decisions below; stage A released and approved; stage B's design proposed below)

2b-1 saves each thing's reviewed footprint (`size`) but still gives it a whole panel. 2b-2 is where
those footprints start to decide what goes where. Nothing here changes v2 or v3 runs: each stage
is a new world version, for new runs only.

**What a footprint means while walking stays on panels** (§5.1, §5.4). A panel is blocked if any
subcell in it is solid, so the sizes change placement, not where you can walk, as long as:
- **🧪 a solid thing never crosses a panel's edge** (proposed). A 2 × 2 sack straddling a corner
  would block four panels; kept inside one, it blocks one, as today. Walk-over things (candles,
  skulls, nests, pots) may cross edges freely. This rule is dropped only if walking moves to
  subcells.
- **🧪 at most one solid thing a panel** (proposed). Two solid things in one panel save nothing
  (the panel's blocked either way) and crowd the picture.
- **Walk-over things may share:** with each other, and with a solid thing's free subcells, but
  never inside its clearance.

**Where each thing sits in its panel, and what's left free** (footprints, heights and pictures as
set in §3 "Sizes"; nothing new is asked of those). "Free" is the subcells a walk-over thing may
take beside it:

| Thing | Footprint | Sits | Clearance | Free in its panel | Used from |
|---|---|---|---|---|---|
| chest, rickety chest, deck of cards | 3 × 2 | the back two rows | 1 in front: its panel's front row | none (the front row is its clearance) | any panel round it, as today |
| sack (a stash, a large room's codexes) | 2 × 2 | 🧪 a back corner, by the wall if it's against one | 0 | the other 5 | as today |
| healing pool | 3 × 3 | the whole panel | 1 all round: the ring of subcells in the 8 panels round it (still walkable) | none | as today |
| cage | 3 × 3 | the whole panel | 0 | none | as today |
| campfire (rolled with the run) | 2 × 2 | 🧪 middle-ish: as the anchor rule gives (§3) | 1 all round, and candles 2 panels off (as 2b-1) | none (its clearance) | as today |
| merchant, librarian (with cart) | 3 × 2 | the back two rows | 1 in front | none | as today, body taps too |
| card witch | 2 × 2 | where she starts | 0 (not solid) | n/a | as today |
| floor candle | 1 × 1 | any free subcell; 🧪 by a wall: the subcell against it | 0 | n/a | lit by walking near, as today |
| skull / nest / pots (stage C) | 1 × 1 / 2 × 2 / 2 × 2 | anywhere free | 0 | n/a | not used |
| barrels / fallen pillar (stage C) | 3 × 2 | 🧪 against a wall, back to it | 0 | its free row (walk-over only) | not used |
| crates (stage C) | 3 × 3 | against a wall | 0 | none | not used |
| foes, you | size class (§3) | 🧪 still a panel's centre (walking is on panels); the class only checks there's free floor for its footprint round that spot | spawn clearance (§3) | n/a | n/a |

- **Interaction access stays as today:** standing on any panel round a thing, within its reach
  (1.5 u), with taps within 1 u (and on people's bodies). 🧪 Proposed: at least one panel round
  each thing you use must stay walkable and joined to a door (the required path, as 2b-1 checks).
- **Pictures don't change:** each thing is drawn at today's size, centred on its footprint. A
  picture wider than its footprint (the pool, 2.5 u) overlaps its neighbours' floor in the
  picture only.
- **Pillars stay rock in the layout** (✅ the user): whole panels, as now.

**The user's decisions (2026-11-08):**
1. **One solid thing a panel, inside its panel: a generator rule for now, not a limit of the
   occupancy map.** The map already holds any footprints, several small solid things in a panel
   or one thing across several panels; it's the placer that won't make them while walking is on
   panels. Walk-over things share a panel wherever their footprints don't meet.
2. **Storage leans to walls:** sacks, chests, barrels and other storage favour walls and corners
   where it suits, keeping access and avoiding collisions, with other spots tried when the wall
   ones aren't valid. (As built in A: a thing's own spot in its panel favours the side nearest a
   wall. The room's feature still stands on its middle panel, which the room keeps for it.)
3. **Candles** (corrected by the user, 2026-11-08, below): floor candles light the middle of rooms
   and wherever else is dark, never kept to the walls. Wall-mounted candles are their own kind of
   placement, and the south wall gets **wall-mounted** ones, in wall slots and drawn as wall things
   even where the camera hides them, never floor candles standing in for them (stage B).
4. **Big creatures:** feet on their panel's centre as now; their size class checks there's free
   floor round the spot for them. No multi-panel movement or new collision.
5. **The stages** A (v4), B (v5) and C (v6) as below, each tested and approved on its own.
6. **The debugging view shows:** the panel grid and its 3 × 3 subcells; each thing's footprint and
   anchor; solid and walk-over occupancy; clearances; where each thing is used from; panels
   blocked to walking; wall slots; and rejected placements with the reason, where practical.
7. **Compatibility:** v2 and v3 runs unchanged; v4 for new runs only, deterministic, with stable
   ids and the usual protections. No art changes and no new kinds of object in stage A.

**Aligned with the user's intentions (2026-11-08), before stage A is finished:**

1. (Revised by the user for stage B, 2026-11-08: from v5, floor candles are unlit placed objects
   and mounted candles light the room; see "Stage B: the candle design". What follows is v4's
   rule.) **Floor candles are small light sources for the room's middle and its dark places,** not
   wall decoration. Each one goes where the room needs light, on free floor (any subcell its occupancy
   allows), never pushed to the edges.
   - 🧪 For stage A: today's spots kept (2–5 panels from the middle, clear of doors), now at
     subcell level, so a candle may sit beside a chest in a shared panel.
   - 🧪 Later, its own approved change: candles placed by where the room is darkest (farthest from
     its torches, fires and other candles).
   - Undone from the first draft of A: candles kept against the walls.
2. **Candles on pillars** (stage B, with the south wall's): a pillar's faces that look onto floor
   get attachment slots, as walls do.
   - Each candle on one has its own id (🧪 `<room>:pillar-candle:<n>`) and its world position on
     the face.
   - Its light starts in the floor subcell in front of the face.
   - It's drawn in order with its face: the north face as a wall's, the side faces as a side
     wall's, the south face hidden by the pillar's top as the south wall's may be.
   - Pillars stay structure (rock panels in the layout); only their faces gain slots.
3. **Panels are structure; subcells are for everything placed in it.**
   - Panels (3 × 3 subcells each) are walls, tunnels, rooms and pillars.
   - Subcells place objects, creatures, furniture, decorations, environmental features and future
     interactables. A thing may take part of a panel, share one, or span several.
   - Movement on panels is a navigation policy for now, not a physical rule, and placement isn't
     cut down to suit it beyond what the policy needs.

**What that means for stage A's design:**
- **The occupancy map becomes a set of named layers,** each with its own rule for what may overlap
  it (a table, not one rule per kind of thing):
  - *structure:* rock panels: walls and pillars, from the layout;
  - *blocking:* solid footprints;
  - *walk-over:* things on the floor you walk over;
  - *trigger:* areas that may lie under anything on the floor (pressure plates, trap zones, hidden
    interactions, a secret room's catch); they may overlap the floor, walk-over and blocking
    layers, but not one another unless their kinds allow it;
  - *attachment:* slots on structure's faces: a wall's (north, east, west, south) and, from stage
    B, a pillar's, keyed by the structure panel and the face;
  - *overhead*, and the reservations and clearances as now.
  Stage A fills structure, blocking, walk-over and attachment (walls only). Trigger and overhead
  are there, empty, with a test that they accept overlapping floor space.
- **Attachment slots are found from structure, not from room walls alone:** every face of a rock
  panel that looks onto floor, tagged wall or pillar. Torches keep their spots (only room walls
  and tunnels get them), so nothing moves.
- **The panel policies are kept apart, as policies:** `navBlocked` (a panel is blocked if any of
  it is solid) and the generator's "one solid thing a panel, inside it" sit in one module
  (🧪 `lib/world/policy.ts`), each marked as temporary while movement is on panels, so finer
  movement later changes them alone. Nothing in the occupancy map assumes them.
- **Destructible structure later:** a pillar that can break would leave the structure layer and
  become an instance with its own id and state. The layer split allows that without moving
  anything else.
- **Stage A's scope otherwise as approved:** existing objects at their footprints, the debugging
  view (showing every layer, triggers included once something uses them), no new art or objects.

**The stages** (each its own world version, commit, release and approval; v2 and v3 runs never
change, and an older copy of the game holds a newer run, §7):

- **A, subcell occupancy and placement, with the debugging view** (world version 4; ✅ design
  approved 2026-11-08; released 2026-11-08 as 009886d and approved by the user; `/lab/placement`
  stays available on the live site):
  - Things take their footprints, placed by the rules above; things whose footprints don't meet
    may share panels (no whole-panel claims in v4).
  - Walking, taps and reach read each thing's footprint, not its anchor's panel. A solid thing's
    panel is the one its footprint is in, and a thing's spot in u is its footprint's middle.
  - The placer gains a version: v3's rules stay exactly as they are (pinned by new goldens of a
    few v3 runs' placements, recorded before A starts), so a v3 run is still mended to what it
    was made with.
  - **The placement debugging view** (`/lab/placement`): a room's subcells, each footprint and
    clearance, the blocked, reserved and path panels, the wall slots, interaction points and
    reach, from `placeWalk`'s occupancy, for any seed. Built first, so A's changes can be looked
    at.
  - Done when: the 2b-1 invariants hold at subcell level (no two things on a subcell, nothing
    solid across a panel edge or in a clearance, every thing used from a reachable panel, foes
    reachable and clear of doors); blocked panels per room no more than v3's (a sim); the same
    seed gives the same run; v2 and v3 goldens untouched.
  - What you'd see: chests and carts at the back of their panels, sacks in a corner by the nearest
    wall. Candles stand where they did. (A chest fills its panel's back rows and keeps its front
    row clear, so no candle can share a chest's panel; one can share a sack's.)
  - **As built:**
    - `lib/world/occupancy.ts`: the layers (structure, blocking, walk-over, trigger, overhead,
      with `OVERLAPS`), the attachment slots on every stone face (walls and pillars:
      `attachmentSlots`, `slotPoint` on the face, `slotLightCell` where grid light starts),
      clearances, reservations and zones.
    - `lib/world/policy.ts`: the temporary panel policies (`navBlocked`, `canStand`,
      `oneSolidPerPanel`, and v3's whole-panel claims), which nothing in the occupancy map uses.
    - `lib/world/place.ts`: v3's rules unchanged, v4's added.
    - Definitions: `clearFront` (a chest's, a deck's, the carts' clearance is the row in front)
      and `occupies` (a trigger's layer).
    - `lib/world/placementView.ts` and `/lab/placement`: the debugging view.
    - Tests: tests/placeV4.test.ts. Version 3's tests (place.test.ts, placeV3.test.ts) keep their
      checks; only their run maker now asks for v3.
  - **The sim (40 runs a dungeon, v4 against v3's rules on the same runs):**
    - floor things, candles, wall torches, foes and panels blocked to walking all exactly v3's;
    - nothing moved and no problems;
    - no panel shared in real runs: candles stand 2 to 5 panels from a room's middle, where its
      one shareable thing (a stash's sack) is. Sharing comes with later content (decor, stage C;
      candles placed by where it's dark).
- **B, expanded attachments: south-wall and pillar candles** (world version 5): the design is
  below ("Stage B: the candle design"), proposed for the user's review.
- **C, decor and banners in real runs** (world version 6):
  - The lab's decor and banners placed by passes 8 and 5 on the occupancy map, saved as
    instances.
  - Solid decor against walls, never across a required path or a clearance; walk-over decor
    anywhere free. Banners take a wall panel's three slots, after torches and candles.
  - The lab's numbers as the starting point (`DECOR_PER`, `DECOR_MOST`, `BANNER_CHANCE`), for
    you to tune.
  - Done when: the invariants hold with decor in, pockets flagged, required paths kept, blocked
    panels per room within agreed ranges, and the lab and the game show the same thing for a
    seed.

**Order:** A, then B, then C. B and C don't depend on each other, so they could swap if you'd
rather see decor first. Each is tested and played before the next starts.

#### Using things in v4 runs (the user's play-test, 2026-11-08: ✅ fixed and released as 832891c)

The user couldn't open chests or stashes in the dungeon, and saw candles standing beside chests
and stashes often. These are two separate things with separate causes.

**1. Chests and stashes won't open: a stage A regression, v4 runs only.** From v4 a thing stands
at its footprint's middle (`placements.ts` `spotOf`). For a chest, a deck or a cart that's 1/6 of
a panel north of its panel's middle (the back two rows); for a sack it's 1/6 off both ways (a
corner). Two pieces of code still assumed every thing stands on a panel's middle:
- **The tap** (`components/WalkView.tsx`): it checks you've seen the thing with
  `known[t.y * w + t.x]`, using the thing's position as a grid index.
  - For a sack the index has a fraction, so it reads nothing, and the tap never picks the sack.
  - For a chest it's sometimes a whole number (when the map's width is a multiple of 6), but then
    it reads a different cell, so whether the tap works depends on that other cell.
- **The reach** (`walkWorld.ts` `inReach`, 1.5 u): it's measured from the thing's off-centre
  middle. `approach` walks you to any panel round the thing's panel, and from the two far
  diagonals you arrive 1.54 u from a chest (1.65 u from a sack in the opposite corner), out of
  reach, so nothing opens.
- **Affected:** chests, stashes' sacks, a library's codexes, card decks, the merchant and the
  librarian.
- **Not affected:** pools and cages (they fill their panel), a beaten room's loot (dropped on a
  panel's middle) and the witch (her position is rounded). v2 and v3 runs aren't affected,
  since everything there stands on a panel's middle.
- **Why the tests missed it:** they checked a way up to each thing exists, never that you're in
  reach at the end of it, and the tap's lookup lives in the component, where no test reaches.
- **The fix** (✅ approved by the user, built and released 2026-11-08), with no special offsets:
  - A thing has three things to tell apart: where it stands (`t.x`, `t.y`: its footprint's
    middle), where it's drawn (the same, so taps land on it), and the panel it's used from
    (`usedFrom`).
  - (a) Choosing what a tap picks moved into `lib/world/walkWorld.ts` (`tappedThing`). It checks
    the seen-map at the thing's panel and picks the thing drawn nearest the tap, so of two things
    in one panel it's the one you tapped. Walking up to it moved into `walkSim.ts` (`walkUpTo`).
  - (b) Reach is measured from the thing's panel (`usedFrom`), the same panel walking is blocked
    on and `approach` walks round.
  - For v2 and v3 runs both are exactly today's behaviour, since there the panel's middle is the
    thing's middle.
  - For v4 runs every thing is usable from every panel round it, as stage A meant.
  - No save changes, so v4 runs already made are fixed by the update.
  - Tests (`tests/thingAccess.test.ts`): every kind of thing tapped, walked up to from every panel
    round it, used, opened, saved and reloaded, in v2, v3 and v4 runs, and two things in one
    panel. With the old code put back, all of the v4 tests fail.
  - Not taken, for (b): reach measured to the nearest edge of the footprint. That's truer to
    the object, but it lengthens reach (a chest's side would open from two panels off), so it
    waits for walking on subcells.

**2. Candles beside chests and stashes: the placement rule itself, every version, not a bug.**
- Candles go 2 to 5 panels from the room's middle (`CANDLE_NEAR`, the user's "middle-ish"
  candle of 2026-11-06), and the room's feature stands on its middle. So both are measured from
  the same anchor, and a candle is never closer than 2 panels, but often just that far.
- Measured over 24 runs, in rooms with a feature:
  - 32% of candles stand 2–2.9 panels from it (one empty panel between, which with a chest's
    picture 1.75 u wide reads as "beside");
  - 39% stand 3–3.9 panels away, and 29% 4–5.
- The figures are identical for v3 and v4, since stage A left candles where v3 put them. Older
  runs use the same rule.
- **Not caused by** placement order, a shared spawn point, or a clearance rule wrongly applied:
  the clearances hold, as A's tests check.
- **🧪 The proposed fix:** stage B's floor candles keep 3 panels from the things you use and
  don't measure from the middle (§1 below). Changing v4's rule would mean a new world version
  anyway, so it's done in B's.

#### Stage B: the candle design (✅ released 2026-11-08 at world version 5, placement and function only, with today's candle art; the user skipped gates 1–4 to play-test it live. Art and drawing come later: see "Released early" below)

**Three separate changes, judged separately.** Each has its own constants, tests and approval,
so any one can be kept, changed or dropped without the others:

| Change | What it decides | Where it lives | Can be judged |
|---|---|---|---|
| **Placement** | where candles go: mounted candles in slots on walls and pillars, where the room is dark; floor candles as placed objects | `lib/world/place.ts` (v5's rules) | in `/lab/placement` and the placement sim, with today's art |
| **Artwork** | what a mounted candle looks like from each side, and how it's drawn | `lib/sprites/walk.ts`, `lib/render/scene.ts`, `public/sprites/walk/` | in the lab's rooms, with placement fixed |
| **Density** | how many candles a room gets, and what share are mounted | named constants in `lib/dungeon/torch.ts` | in the sim's counts, with placement fixed |

✅ already set by the user: mounted candles light the room, floor candles are unlit objects (the
roles below, which replace the earlier "floor candles light the middle"); the south wall gets **wall-mounted** candles, drawn even where the camera hides them;
pillars' faces get slots; v2, v3 and v4 runs never change.

**Today, measured from the code (v4):**
- One candle in 🧪 35% of rooms (`CANDLE_CHANCE`; never the entrance or the boss's room), on a
  panel 2 to 5 from the room's middle (`CANDLE_NEAR`) and 3 or more from its doors
  (`CANDLE_CLEAR`), picked at random. Id `candle:<room>`; lit or not is in the run's `lit` list.
- Wall torches take the **middle** slot (k = 0) of a north face, one every `SCONCE_EVERY` (8)
  panels of a room's top wall, at least 3 panels apart; some tunnels have them on their sides.
- `attachmentSlots` already finds every stone face that looks onto floor, three slots a face,
  tagged `wall` or `pillar`; `slotPoint` is the point on the face, `slotLightCell` the floor
  subcell in front. Nothing uses the pillars' slots or the south faces yet.
- Definitions `candle-wall`, `candle-wall-side` and `candle-wall-south` exist (stage A), with
  today's candle as their art; nothing places them.
- **The lighting grid is in panels.** `torchLit(floorplan, point, radius)` rounds the point to
  its panel and casts rays that rock stops (walls and pillars, which are rock). A wall torch's
  point is the **floor panel** under its wall, so its light never starts in rock.

##### Candle roles (✅ the user, 2026-11-08)

| | Mounted candle (wall or pillar) | Floor candle |
|---|---|---|
| **What it's for** | ambient room light and the architecture's atmosphere | a small placed object: variety, atmosphere, and later interactions |
| **Starts lit** | by a chance per candle (below) | never (✅ the user) |
| **Walk near it** | lights it, as a wall torch | lights it, as any candle (✅ the user, 2026-11-08, changed after release) |
| **Lit by** | walking near | walking near (the tap below is no longer needed) |
| **Placed by** | where the room is dark (the budget below) | where it suits as an object (§1) |
| **Its light** | `CANDLE_RADIUS`, through `torchLit`, counts for what you've seen while in sight | none while unlit; once lit, the same as a mounted candle's |

Today's floor candle (`candle`) already starts unlit, but lights when you walk within half your
torch's reach, and from then on shows its patch of the room whenever it's in sight. That is what
can give away a room's middle. v5's floor candle is a **new definition** (🧪 `floor-candle`): a
real light source (it has the candle's light) that walking near never lights. Old runs' `candle`
instances keep today's behaviour, because behaviour comes from the definition and the old runs
never hold the new one.

**Lighting a floor candle on purpose** (~~wanted by the user, 2026-11-08, as "B6"~~: dropped after release, when the user chose to have floor candles light by walking near; kept for the record):
- **The interaction:** tap a floor candle in reach and it lights. The usual `TAP_OBJECT` and
  `REACH_OBJECT` apply, measured from its panel as for everything else you use. The definition
  gains `interact: usable("light")`. No cost or item (🧪 open for later).
- **Saved as every light already is:** its id goes in the run's `lit` list, so no new save field
  is needed and B's saves already have room for it. Until B6, nothing writes it.
- **Once lit,** it's a light like a mounted candle: `CANDLE_RADIUS` through `torchLit`, counting
  for what you've seen only while it's in your sight.
- **Why it's separate:** it's a new kind of tap (on a walk-over thing, not a solid one), with its
  own tests (in reach, lit once, kept after a reload, never lit by walking). It changes how rooms
  play, so it gets its own play-test.

##### The candle budget: room by room (✅ asked for by the user, 2026-11-08; the numbers 🧪)

No flat share of rooms. Each room's budget comes from **how much of it is dark**, which takes in
most of what makes rooms differ, with a few rules for the rest.

**Step 1: how dark the room is (D).**
- D is the room's floor panels that none of its fixed lights reach, worked out once at placement
  on the layout through `torchLit`, so walls and pillars shade as in play.
- The fixed lights: every wall torch **counted as lit** (whether it starts lit is a roll, and the
  budget mustn't depend on it) and campfires burning. Your own torch goes with you, so it isn't
  counted.
- **What D already covers:**
  - *Size:* a bigger room has more dark.
  - *Shape:* the far leg of a dog-leg and an alcove are out of the top wall's torches' sight, so
    they count as dark.
  - *Pillars:* the shadows behind them count.
  - *Existing light:* a room's torches and campfire light their part and take it out of D.

Measured over 30 new runs (795 rooms, v4's layouts):

| Rooms | How many | Floor panels (avg) | Dark, D (avg) |
|---|---|---|---|
| plain rectangles | 511 | 237 | 175 |
| with pillars | 209 | 363 | 285 |
| dog-legs (two rectangles) | 75 | 339 | 241 |
| large rooms (library) | 9 | 997 | 866 |
| a small room with a campfire | (e.g. 10 × 8) | 80 | 7–16 |

**Step 2: the room's kind (W).**

| Kind | W | Why |
|---|---|---|
| entrance, boss, encampment | 0 | the entrance is lit already; boss rooms get their own lighting design later |
| fights: easy, hard, mini boss | 🧪 0.75 | foes are meant to lurk in the dark |
| quiet rooms: chest, stash, pool, campfire, cards, treasure | 🧪 1 | |
| lived-in rooms: merchant, librarian, library, witch, storehouse | 🧪 1.25 | someone keeps candles burning |

**Step 3: how many mounted candles.**
- **Expected E = W × D ÷ `DARK_PER`** (🧪 300, the density dial; options at gate 4).
- **Count = E's whole part, plus one more by a chance equal to what's left:**
  - E 0.3: a 30% chance of one;
  - E 1.4: one, and a 40% chance of a second.
- This one rule answers both *whether* a room gets candles and *how many*.
- **Capped** at 🧪 2 a room, or 🧪 3 in a **large** room (the library and the storehouse; the
  encampment is a boss room, W 0). That's why the library example below has 3.
- **Also limited by the room itself:** a candle is only placed in a slot that lights at least
  🧪 3 still-dark panels, and placing stops once only 🧪 40% of the room would be left dark
  (`DARK_KEPT`), so some meaningful dark always remains. A room with no real dark gets none,
  whatever the roll.

**Step 4: wall or pillar, and which slot.** One at a time, each candle takes the free slot that
lights the most panels **still dark after the lights already chosen**: the torches, the campfires
and the candles placed before it in this room (✅ the user, 2026-11-08). So the dark decides:
- **Dog-legs:** the first candle goes on the leg's side walls, out of reach of the top wall's
  torches.
- **Pillar rooms:** a pillar's face is often best, since the pillar's shadow is the room's
  darkest part.
- **Plain rooms:** the side walls usually win, because the top wall already has its torches.
- **Spread rules:**
  - 🧪 at most one candle per pillar;
  - 🧪 in a dog-leg, no second candle in a rectangle until each dark rectangle has one;
  - the gaps and keep-clear rules (§2): 🧪 3 panels from any other light, so candles never
    cluster.
- **Ties:** a wall slot over a pillar's, then by the slot's key, so it's deterministic.

In the measure at `DARK_PER` 300 (30 runs), the faces chosen were: west 161, pillar 135, east 101,
south 17, north 8. North faces are rarely chosen because that's where the torches already are.

**Step 5: floor candles (separate, decorative).**
- **Expected F = W × floor panels ÷ `FLOOR_PER`** (🧪 900), counted the same way as the mounted
  ones (whole part plus a chance), capped at 🧪 1 (2 in a large room).
- They light nothing, so their count is about variety, not light, and is judged separately.

**Example outcomes** (real rooms from the measure, at `DARK_PER` 300 and `FLOOR_PER` 900):

| Room | Shape | Lights already | D | Mounted (E → outcome) | Where | Floor (F) |
|---|---|---|---|---|---|---|
| fight, 10 × 8 | plain, small | a torch, a campfire | 16 | 0.04 → almost never | — | 0.07 |
| fight, 8 × 18 | plain, tall | 1 torch | 123 | 0.31 → 31% one | a side wall low down, far from the torch | 0.12 |
| fight, 18 × 10 | plain, wide | 2 torches | 124 | 0.31 → 31% one | a side or south wall | 0.15 |
| fight, 20 × 6 + 6 × 16 | dog-leg | 3 torches on the top bar | 110 | 0.28 → 28% one | the leg's side walls | 0.15 |
| stash, 20 × 6 + 6 × 16 | dog-leg | 3 torches, a campfire | 67 | 0.22 → 22% one | the leg (one rolled: on its south wall) | 0.2 |
| fight, 18 × 10, 4 pillar panels | pillars | 2 torches | 131 | 0.33 → 33% one | a pillar's face (as rolled) | 0.15 |
| merchant (avg) | varies | torches | 271 | 1.13 → one, 13% two | the dark side walls | 0.48 |
| library (large, avg) | large | torches | 866 | 3.6 → 3 (the cap) | spread round it | 1.4 → 1, 40% two |
| entrance, boss | — | — | — | none | — | none |

Averages at this setting: 0.53 **mounted** candles a room (0.49 plain, 0.58 with pillars, 0.65
dog-legs), the user's target of about 0.5 (✅ 2026-11-08). On top of those come about 0.25
**floor** candles a room (estimated from the rooms' sizes), against today's 0.29 candles a room
(all floor). This was measured without the spread rules, the 3-panel gap and `DARK_KEPT`, which
can only leave candles out, so B1's sim measures it again and sets `DARK_PER` to give 0.5.

##### Lit at the start: mounted candles

- **Each mounted candle rolls for itself,** as wall torches do (`SCONCE_LIT_SHARE`, 20%), from
  the placement's own random numbers. It's saved on the instance as `start: "lit"` (the field
  torches already use), so it never changes for that run.
- **Chances by room kind** (✅ the user, 2026-11-08, as starting values):

| Kind | Starts lit | Why |
|---|---|---|
| fights (easy, hard, mini boss) | 10% | dark rooms to walk into carefully |
| quiet rooms | 25% | about a wall torch's 20% |
| lived-in rooms | 60% | someone lives there |

- **Pillar candles use the same table** (the user: unless decided otherwise later); one constant
  can split them off.
- **An unlit mounted candle lights when you walk near,** as a torch does.
- **A lit one shows what it lights only while it's in your sight,** as for torches, so a burning
  candle across the dungeon doesn't map a room for you.
- **Floor candles never roll:** they start unlit.

##### 1. Floor candles: where they stand (placement)

- **Candidates:** any free walk-over subcell on the room's floor, at least 3 panels from its
  doors (`CANDLE_CLEAR`), not on a required path's panel, and not in a campfire's or a solid
  thing's clearance.
- **🧪 Kept off the things you use, by preference:** 3 panels or more from a room's feature (its
  chest, sack, pool, deck or cart) and from cages where the room allows it, then 2, so a small or
  irregular room still gets its candle (✅ the user, 2026-11-08: a preference with fallbacks, not
  an absolute rule). Never closer than today's 2. Today's rule measures 2 to 5 panels from the room's middle,
  which is exactly where the feature stands, so many candles end up two panels from it (the
  investigation, 2026-11-08). v5 doesn't measure from the middle.
- **🧪 Where they're picked from:** ~~the foot of a pillar or along a wall half the time, anywhere
  free otherwise, so they read as placed objects.~~ From v6 (the user, 2026-11-09): never on a panel touching a wall or pillar, and never in a mounted candle's light. Never in front of a mounted candle's slot, where
  they would sit in its glow.
- **Ids:** `candle:<room>` for the room's first candle of either kind, and `:1`, `:2`… for any
  more.

##### 2. Wall-mounted candles, all four walls (placement)

- **Which slots:** a room's own wall faces (north, west, east and south). 🧪 Not tunnels yet
  (they keep their torches only).
- **One thing a slot.** A torch keeps its middle slot; a candle may take either side slot of a
  torch's face, or any slot of a face with no torch.
- **Gaps:** 🧪 at least 3 panels from any other light's point (torch, candle, campfire), so
  lights spread out instead of bunching.
- **Kept clear:** not on a face whose floor panel is a door's or just inside one, so doorways
  stay plain. Not behind a solid thing standing on the floor panel in front of it (a chest, a
  cart, a cage), so it can be seen and lit.
- **The light cell is not occupied.** A mounted candle takes its slot only (attachment layer);
  things may stand on the floor in front of it.

##### 3. Pillar-mounted candles (placement)

- The same slots, rules and gaps, on any pillar face that looks onto floor (`kind: "pillar"`).
- **Pillars stay rock** in the layout (✅ the user); only their faces' slots are used.
- A pillar can carry candles on more than one face, gaps permitting.

**Order of the passes in v5:**
1. 5: wall torches, exactly as v4.
2. **5b: the budget and the mounted candles,** with their own random numbers so torches can't
   move. The budget is read from the room before any candle goes in.
3. 6: campfires, then floor candles.
4. 7: spawns, as v4.

##### 4. Where they're drawn: attachment points, anchors and drawing order (artwork)

Every mounted candle has three points, each for one job:
- **World point** (`slotPoint`): on the face, where it's fixed, a third of a panel along per slot.
- **Mount height:** 🧪 the wall torches' bracket height, so torches and candles on one wall line
  up.
- **Light point:** its floor panel (lighting, lighting it by walking near, being in sight), as a
  wall torch's is. The fine glow round it is measured from the subcell in front
  (`slotLightCell`), so a side-slot candle's pool sits under it, not under the panel's middle.

How each face is drawn (seen from the south, §4.1). "North wall" is the wall north of the floor
it looks onto:

| Face | Examples | Seen | Art | Sorts at |
|---|---|---|---|---|
| north | a room's top wall; a pillar's south face | face on | face-on candle | its face's y plus a small step: on the wall, behind anything on the floor in front |
| west / east | a room's side walls; a pillar's sides | edge on | side-on candle (east is the west mirrored), at the wall's edge as tunnel side torches are drawn | its own y, so things in front of or behind it along the wall cover it properly |
| south | a room's bottom wall (inside face); a pillar's north face | from behind, through the wall | 🧪 face-on art reused (question 2) | just before the wall's top band, so the band covers it |

- **The flame and halo** of a north, west or east candle go over the dark, like a wall torch's.
- A **south-face** candle's flame is faded by the wall in front of it: shown at
  1 − the band's opacity (`capFade`). It's hidden behind a solid wall and shows faintly when you
  stand close and the wall fades, as the user said is fine.
- **Its light on the floor always shows**, seen or not: the floor isn't behind the wall.
- **The anchor in the art** is the mount point (where the holder meets the wall), not the
  sprite's bottom.

##### 5. Light, occlusion and the see-through south wall

- **No change to how light works.** A mounted candle is one more light, using `torchLit` from
  its floor panel with `CANDLE_RADIUS`. Walls and pillars stop it as rock. Lit by walking near
  (`canIgnite`), in sight for what you've seen (`fireInSight`), kept lit in `lit`.
- **Never give lighting the face point.** On a south or east face, the point on the face rounds
  to the rock panel, which would start the light inside rock and never light it. The sim takes
  the floor panel only; a test checks every light point is floor.
- **Its wall face glows,** as a torch's does (`torchLit` lights the face above a lit floor).
- **The see-through south wall changes only the candle's picture,** never its light or what you
  see by it.
- **Pillars:** a candle on one face lights only that side; the pillar shades the rest, as now.

##### 6. Attachment slots and subcells, without conflicts

- **Layers:**
  - mounted candles use the attachment layer only (`takeSlot`, one owner a slot);
  - floor candles use the walk-over layer (one subcell), clear of blocking things' clearances and
    campfires' zones;
  - neither touches the blocking layer, so where you can walk can't change. The sim checks blocked
    panels per room equal v4's.
- **Stage C's banners** take a whole wall panel's three slots. They come after B, so they skip any
  face with a candle on it (slots taken first win; C's rule to check, nothing reserved now).
- **The placement view** shows mounted candles in their slots, each one's light point and
  whether it starts lit, the room's darkness map (a new layer) and its budget (D, W, E, the
  roll), with refusals and their reasons.

##### 7. The candle sprites (artwork)

- **The art standard (phase 3) isn't built yet:** no palette file, no template generator, no
  checks. So:
  - **Placement and drawing are built and approved first with today's candle art** on the walls,
    plus a bracket drawn in code (as wall torches have);
  - **the new sprites come after, held to the parts of the planned standard already settled**
    (§6.1).
- **What the standard already settles:**
  - square pixels, 🧪 32 art pixels a u;
  - no glow, flame or shadow painted in (the renderer draws flames and light, as it does for
    torches), so one unlit picture per view;
  - a clean transparent background;
  - the mount point at a known pixel;
  - style-matched to the approved kit's north wall (our own art), never sampled from the reference
    image.
- **Views needed:**
  - face-on;
  - side-on (east mirrored from it);
  - 🧪 the south face reuses face-on (question 2).
  Floor candles keep today's art unless you ask for new.
- **How they'd be made:**
  - a grey template per view, drawn at its projected size with the mount point marked (a small
    first piece of §6.2's generator);
  - PixelLab with one recorded set of settings per view (tool, view, size, outline, shading),
    written in `public/sprites/PIXELLAB.md`;
  - 3 or 4 samples per view in `public/sprites/walk/samples/`, never imported by the game;
  - your pick, then the rollout.
- **A small checker** (size, mount pixel, halo-free background) is written for these and kept as
  the start of §6.3's checks.

##### 8. Saves: v2, v3 and v4 runs keep their candles

- **v5 is for new runs only.** v2's, v3's and v4's placers stay exactly as they are, so each old
  run keeps its candles, its torches and its `lit` list. Mending a damaged run uses its own
  version's rules, as now.
- **Pinned first:** goldens of four v4 runs' placements (both dungeons, two seeds), recorded
  before any v5 work, as was done for v3 before A.
- **How a mounted candle is saved,** with no new fields:
  - an instance of `candle-wall`, `candle-wall-side` or `candle-wall-south`;
  - its subcell is the light cell in front of its slot (that gives the slot's place along the face);
  - its `wall` is the face's side ("south" used for the first time);
  - `start: "lit"` if it rolled lit, the field wall torches already use;
  - wall or pillar is worked out from the layout.
- **A v5 floor candle** is an instance of the new `floor-candle` definition, never lit by walking.
  The old `candle` definition and its behaviour stay exactly as they are for v2–v4 runs.
- **The budget isn't saved.** It only decides what's placed, and what's placed is saved. Mending
  a damaged v5 run works it out again from the layout, identically.
- **Ids:** the room's first candle, of whichever kind, is `candle:<room>` (as today); any more are
  `candle:<room>:1`, `:2`…. Lit candles go in `lit` by id, as now.
- **The check on saved placements** gains:
  - the three mounted-candle definitions and `floor-candle` only from v5, so a v3 or v4 run
    carrying one is damaged, not read;
  - a mounted candle's subcell must be floor, with stone on its `wall` side;
  - `start: "lit"` never on a `floor-candle`.
- **What keeps v2, v3 and v4 runs as they are,** each with a test:
  - their placers, and the old `candle` definition, are not touched;
  - their goldens (the older ones, v3's four, and v4's four from B0) must match exactly;
  - an old run's candle still lights when you walk near, as today;
  - an old run's `lit` list still lights the same torches and candles after a reload.
- **An older copy of the game** (an old offline copy, a stale tab) holds a v5 run untouched as
  "newer than me", as it does for v4. The save file's version doesn't change: the run carries its
  own.
- **Density is fixed before release.** A v5 run is mended by v5's numbers, so changing the
  density after release needs a new world version (v6, merged into stage C's if they come
  together).

##### Implementation sequence, with tests and approval gates

| Step | What | Tests | Gate |
|---|---|---|---|
| **first** | The chest and stash fix ("Using things in v4 runs", above), released on its own: ✅ 832891c. | tests/thingAccess.test.ts | your play-test |
| **B0** | Pin four v4 runs' placements as goldens. Nothing in the game changes. ✅ 2026-11-08: tests/placeV4Pinned.test.ts pins each run's placements and its lights (every torch, candle and campfire: where, lit at the start or not, and the cells it lights) as `v4-d<dungeon>-s<seed>.placed.json` / `.lights.json`. On these seeds v4 places candles and torches exactly as v3 does (stage A changed only how things share panels). | the goldens; full suite | none |
| **B1** | v5's placement in `place.ts`: the budget, mounted candles with their lit rolls, and floor candles as objects, at the proposed numbers; **new runs still v4**. The placement view gains the budget, slots in use, light points and the darkness map. 🔨 2026-11-08: built; released with B5 (gate 1 skipped by the user). | the budget's arithmetic on made-up rooms (a room with no dark gets none; W 0 gets none; the caps); one thing a slot; gaps; at most one a pillar; spread across a dog-leg; no light point in rock; light cells floor; door faces clear; nothing behind a solid thing; floor candles never lit; lit shares by kind within range (sim); deterministic; torches identical to v4; blocked panels equal v4; v2/v3/v4 goldens untouched; the sim's counts per kind and shape | **Gate 1 (placement):** you look at example pictures (written to a folder, as for A), including dog-leg and pillar rooms, and `/lab/placement` |
| **B2** | Drawing in the scene builder, with today's art and a code bracket: mount points, sort order, the south fade, flame and halo per face. Lab only. | the scene builder's draw list (no browser): north candle before a thing in front of it; south candle before its wall's band and its flame faded by `capFade`; east mirrored; light from the floor panel | **Gate 2 (drawing):** you look in the lab's rooms |
| **B3** | Sprites: grey templates, the checker, 3–4 PixelLab samples per view. Not imported by the game. | the checker's report on each sample | **Gate 3 (artwork):** you pick, or ask again; only then into `lib/sprites/walk.ts` |
| **B4** | Density: the three settings below, each measured in the sim and drawn for the same rooms (lab pictures, side by side). | counts per room, kind and shape at each setting | **Gate 4 (density):** you compare them visually and set the numbers |
| **B5** | Release, only with the approved artwork (✅ the user): new runs at v5 (`WALK_V`, `PLACED_V`); the saved-placement check; save, export, reload; mending. | v5 survives save/export/reload unchanged; mended to as made; a v4 game holds a v5 run; v4 run with a mounted candle is damaged; full suite, type check, both builds | **Gate 5:** your play-test on the live site, both dungeons |

**B1 as built (2026-11-08).** Measured over 20 runs (530 rooms, tests/placeV5.test.ts):
- `DARK_PER` set to **350** (300 gave 0.58 once the gap, spread and `DARK_KEPT` rules were in): 0.52 mounted candles a room (fights 0.42, quiet 0.59, lived-in 1.27; plain 0.42, pillars 0.52, dog-legs 0.80, large 2.4) and 0.28 floor candles a room.
- Started lit: fights 10%, quiet 25%, lived-in 56–60%, as set.
- Faces chosen (30 runs): south walls 139, west 76, east 73, pillars 105, north 1. South walls are the most common because the top wall's torches already light the top of a room; they're drawn faded behind the wall (§4), to judge at gate 2.
- **Ties** between slots lighting the same dark go to a wall over a pillar, then by a hash of the slot fixed for the run, not by its key: ordering by key put nearly every candle on west walls (173 west to 23 east).
- **A torch's side slots** are allowed, but the 3-panel gap from every light means a candle never takes one in practice (they share the torch's floor panel).
- **Floor candles** also keep off a mounted candle's floor panel and the panels round it (its glow), and off the panels round another floor candle. 🧪
- The placement view (`/lab/placement`, v5 switch) shows the darkness map (dark blue: no torch or campfire reaches; yellow: lit by a candle), each mounted candle's slot and light point (filled: starts lit), floor candles, and the budget under the picture.

**Released early (the user, 2026-11-08: "release to everyone… for now lets focus on the functional side").** Gates 1–4 skipped; B2 and B5 done for function only:
- **New runs are world version 5** (`WALK_V`, `PLACED_V`). v2–v4 runs keep what they were made with (B0's pins).
- **The walk reads stage B's candles** (`placements.ts`): a mounted candle is a candle at the floor subcell in front of its slot, lit if it rolled lit or you lit it, lit by walking near, its light from that floor panel; a floor candle is a candle like any other: unlit to start, lit by walking near (the user, after release). Both are drawn with today's candle art where they stand: no bracket, no south-wall fade, no side-on view yet (B2's drawing and B3's art are still to do).
- **The saved-placement check** (`migrate.ts`): the three mounted definitions and `floor-candle` only from v5 (a v3 or v4 run carrying one is damaged); a mounted candle needs a wall, floor under it and stone on that side; a floor candle never starts lit. Mending a v5 run gives it as made.
- **Density is now fixed for v5 runs** (`DARK_PER` 350). Changing it, or the placement rules, after the play-test means world version 6.
- **World version 6** (the user's play-test, 2026-11-09; new runs from then): floor candles are never in a mounted candle's light (within `CANDLE_RADIUS` of its light point: no need for another there) and never on a panel touching a wall or pillar, diagonals included (a candle by stone is a mounted one). Nothing else changes: mounted candles, torches and density are v5's, and floor candles stay at 0.28 a room. v5 runs keep theirs (pinned: tests/placeV4Pinned.test.ts, `v5-*.json`).
- Still to come, when the user's back: B2's drawing (mount points, sort order, the south fade), B3's sprites, B4's density comparison. (B6, lighting floor candles by tapping, was dropped: they light by walking near.)

B3 can run alongside B1–B2 (it doesn't touch the game). Each step is its own commit; nothing
reaches players before B5. **B6**, lighting floor candles on purpose, comes after B5 as its own
change and play-test.

**Density settings for gate 4** (✅ the user: start at about 0.5 mounted candles a room, then
compare all three visually before approving). Only the dial `DARK_PER` moves. **Mounted**
candles are the light; floor candles are counted apart (about 0.25 a room at every setting, set
by `FLOOR_PER`). Sparse and rich are scaled from the measure at 300; B4 measures all three:

| Setting | `DARK_PER` | Mounted a room (avg) | A typical fight room (D ≈ 165) | Plus floor candles |
|---|---|---|---|---|
| **Sparse** | 🧪 1000 | about 0.16 | 12% chance of one | about 0.25 |
| **Ambient** (the target) | 🧪 300 | 0.53 | 41% chance of one | about 0.25 |
| **Rich** | 🧪 150 | about 1 | 83% chance of one | about 0.25 |

(An earlier draft gave ambient as "about 0.8": that was mounted and floor candles added together,
0.53 + 0.25. The target of 0.5 is mounted candles alone.)

The kind weights, the caps and the lit chances are separate constants, so they can be tuned
without moving the dial.

**The user's decisions (2026-11-08):**
1. Floor candles always start unlit. ~~They never light when you walk near (lit later by tapping, B6).~~
   Changed by the user after release, 2026-11-08: walk near one and it lights, as any candle.
2. Mounted candles (wall and pillar) may start lit: 10% in fights, 25% in quiet rooms, 60% in
   lived-in rooms, as starting values.
3. Every wall torch counts as lit when working out the budget.
4. Placement by darkness, room kind, shape, pillars and existing light. Each candle is judged by
   what it adds after the lights already chosen, with no clustering, and meaningful dark is kept.
5. Density: about 0.5 mounted candles a room to start; sparse, ambient and rich compared visually
   at gate 4.
6. South faces reuse the face-on art, provisionally, if it looks right in the actual renderer
   (judged at gates 2 and 3).
7. Mounted candles in rooms only, for now.
8. ~~Release with approved artwork, never temporary sprites.~~ Changed by the user, 2026-11-08: released now for its function, with today's candle art, to play-test live; art designs later.
9. B0–B5 and their gates kept; the chest and stash fix comes first, on its own.

- **2c, intended changes:** any later behaviour corrections the user approves (§7, reviewing
  goldens), each in its own commit. (The foe fix came early, as 2a′.)
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

  **After phase 2: wandering NPCs and the lights they carry** (the user, 2026-11-07; §5.7). Its
  own gameplay feature, designed and approved before it's built, once 2b's placement is
  reliable: the NPCs' walk rule and wandering, their lights in `stepWalk`'s lighting, tapping
  them where they are, and the merchant's cart going with him. It doesn't need the art phases
  (3 and 4) and may come before them; its lantern and glow art follows phase 3's standard if
  that's in place by then.

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
- **Stamps:** the format is in §5.5; the first is built when a room needs one. (A stamp's grid is
  in panels; a stamp may give a thing an exact subcell spot.)
- **Walking on subcells:** designed for in §5.4, changed only when the user decides.
- **Wandering NPCs with their own lights** (§5.7): after phase 2, its own feature.
- **Candles by any wall** (§5.6): on 2b's placement.
- **A placement debugging view** (the user, 2026-11-08): a lab page drawing a room's subcells,
  each thing's footprint, the blocked and reserved panels, the paths kept, and the interaction
  points, from `placeWalk`'s occupancy map, to inspect placement by eye.
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
7. **Panels and subcells** (the user, 2026-11-07): a panel (the floor tile, 1 u) is exactly 3 × 3
   subcells. Rooms and corridors are generated in panels; physical sizes, placement and
   occupancy use subcells (from phase 2b; the save format from 2a); walking stays on panels
   until the user decides otherwise (§2, §5). Physical and navigation occupancy are separate,
   the whole-panel blocking rule is interim, legacy panel reservations are kept apart from
   physical size, and creature sizes are examples, with no multi-panel creature movement in 2b.
