# World space and units

Authoritative for the principles, world units, panels and subcells, coordinates, axes, each object's separate measurements, and creature size classes. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

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
