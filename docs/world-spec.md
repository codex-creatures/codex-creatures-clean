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

#### 2b: the implementation design (📌 proposed 2026-11-08, for the user's sign-off; not built)

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
| 8 decor | lab only (`/lab/newrun`), as now: run on the new map there, so it can't overlap anything, and not saved | `decor.ts` | no (not in real runs) |
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

**Questions for the user:**
1. **A candle near a campfire:** today it's placed, then not drawn, so that room has none. In a
   v3 run, place it elsewhere in the room instead (so a few more rooms have a candle; the sim
   says how many), or keep today's outcome (no candle in that room)?
2. **Pillars:** keep them as rock in the layout in 2b-1 (proposed: they're saved already and play
   right), turning them into objects only when something needs it (one that breaks or moves)?
3. **Decor and banners:** stay lab-only through 2b-1 (proposed), each brought into real runs
   later as its own approved change?
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
