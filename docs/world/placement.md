# Occupancy and placement

Authoritative for occupancy, reservations, the placement passes, movement, stamps, candles and wandering NPCs. The rules as built, version by version, are in the last section. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

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
9. **Floor variety:** worn floor and wall tiles, and floor life (puddles, mouse holes: in the game
   since 2026-11-14). Purely visual, so these stay worked out from the seed and aren't saved.

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

> ⚠️ The requirements as set on 2026-11-07. Since built and then changed: v5 placed candles by darkness, and **v8 (current) has no wall candles**: the budget places wall torches, never on south faces. See [As built](#candles-and-extra-torches-world-versions-58). Floor candles now light by walking near.

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

> ⚠️ Decision 39 (the user, 2026-11-10; built as world version 9) wins where it differs:
> [design/walkable-play.md §8](../design/walkable-play.md). They wander the whole dungeon, not just
> near their room, and have no home room (their shop or game goes with them); where they've got to
> is saved; they start where people.ts puts them (not a placed instance); the merchant walks without
> his cart for now; their light is a candle's.

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

## As built: placement by world version

Distilled on 2026-11-09 from the phase designs in world-spec §8 (kept word for word in
[archive/2026-11-09/world-spec.md](../archive/2026-11-09/world-spec.md), §8). This is what the code
does now; the archive holds why, the options weighed and the approval gates. Each world version is
for new runs only: **a run keeps the rules it was made with for good** (see
[persistence.md](persistence.md#world-versions)). New runs are made at `PLACED_V` 12
(lib/world/place.ts). (v9, decision 39: a library's broken bookcases in a row along its top, its
lectern at its middle, a campfire's stash two tiles east of the fire; the people who wander aren't
placed: lib/dungeon/people.ts starts them. v10, the user's play-test, 2026-11-11, after one stood in
front of a tunnel: each bookcase moves to the nearest panel more than `BOOKCASE_DOOR_GAP` 2 panels
from every door's inside panel, and not touching another bookcase. v11, the user, 2026-11-11: a
guarded storehouse has no `<room>:loot` spot; its guard keeps the storehouse's chest, `<room>:stores`.
v12, the user, 2026-11-11: pass 6b, tables: in a room of the kinds in `TABLE_ROOMS` (not the entrance
or the boss's; a cards room's deck has its feature's own table), `TABLE_CHANCE` 25% a room on its own
stream (pass 61), one table, `table:<room>`, on a random valid panel off the doors (`CANDLE_CLEAR`), the
kept paths and spots and the panels in front of a wall torch, left out if none is; `TABLE_CANDLE` 70% of
them hold a candle (`holds: "candle"`). About 4.7 a 21-room Encampment run, two thirds with a candle.)
v13, the user, 2026-11-13: the same tables, and then, on the same stream, `TABLE_DECK` 5% of them have a
deck of cards on (`deck: true`): the walkable Labyrinth's "?" rooms no longer hold a cards room.
v14, the user, 2026-11-14: pass 6c, bookcases against a wall: in a room of `SHELF_ROOMS` (`TABLE_ROOMS`
but a library; not the entrance or the boss's), `SHELF_CHANCE` 25% on its own stream (pass 62), one
bookcase, `shelf:<room>`, on a random top-row panel (rock behind it) more than `BOOKCASE_DOOR_GAP` from
every door's inside panel and not under a wall torch (that panel or the ones above and below), at its
wall-most spot (spotsIn); `SHELF_CODEX` 10% hold a codex (`codex: true`); `SHELF_CANDLE` 40% get a floor
candle (the room's next candle id) on the panel to one side, else the other, else in front. Pass 6d, a
storehouse's finds (pass 63): its dynamite (`dynamite:<room>`) and, when its stores hold the rugged
backpack, `backpack:<room>` (taken out of the stores as the run's made: migrate.ts `withFloorFinds`),
walk-over, on a random valid panel off the doors (`CANDLE_CLEAR`). Both passes come before the spawns.

### Modules

- `lib/world/grid.ts`: the coordinate and footprint sums (§2 "Coordinates", in
  [space.md](space.md)): a footprint's subcells from its anchor, quarter turns, the panels it
  touches, edges and negative coordinates.
- `lib/world/occupancy.ts`: one map per room in subcells, in named layers, each with its own
  overlap rule (`OVERLAPS`): *structure* (rock panels: walls and pillars, from the layout),
  *blocking* (solid footprints), *walk-over*, *trigger* (pressure plates, trap zones: may lie
  under anything on the floor; empty so far), *overhead* (empty so far), plus reservations,
  clearances and zones. **Attachment slots** are found on every stone face that looks onto floor,
  walls and pillars alike, three to a face (`attachmentSlots`; `slotPoint` on the face,
  `slotLightCell` the floor subcell in front, `takeSlot`, one owner a slot).
- `lib/world/policy.ts`: the **temporary panel policies** while walking is on panels, kept apart
  so finer movement later changes only them: `navBlocked` (a panel is blocked if any subcell in it
  is solid), `canStand`, `oneSolidPerPanel`, and v3's whole-panel claims. Nothing in the occupancy
  map assumes them.
- `lib/world/place.ts`: the passes (§5.3), room by room, each pass on its own random stream from
  (run seed, room, pass). Every version's rules stay in it, so old runs mend to what they were
  made with. `newWalkRun` (lib/world/migrate.ts) places a new run.
- `lib/world/compat/v0.ts` and `compat/v0Placers.ts`: frozen copies of the old placers
  (`placeSconces` and the tunnels', `placeCandles`, `placeFoes`, `placeWaiter`, `cageSpots`),
  used only to convert v0 runs and mend v1–v2 runs. Nothing in generation or play imports them
  (a test checks).
- `lib/world/placements.ts`: builds a room's contents from `placed` plus run state.
- `lib/world/placementView.ts` and **`/lab/placement`** (live on the site too): the debugging view.
  It shows panels and subcells, footprints and anchors, solid and walk-over occupancy,
  clearances, where each thing is used from, panels blocked to walking, wall slots, the darkness
  map (dark blue: no torch or campfire reaches; yellow: lit by a candle), each mounted light's slot
  and light point (filled: starts lit), floor candles, the room's budget, and refusals with
  reasons.

### The passes (v3 onward, keeping the old rules and numbers)

| Pass | What | Rule |
|---|---|---|
| 1 reserve | doors and the panel inside each; a 1-panel path between every pair of doors and from the doors to each progression point; the room's middle; a waiting boss's stand and the way up to it; cages; a guarded chest's spot | worked out from the layout; nothing may block them |
| 2 stamp | empty (§5.5) | |
| 3 structure | pillars stay rock in the layout (`inner`), read into the map as structure, not objects | `interior.ts` |
| 4 things you use | each room's feature and a large room's stores at its middle; cages along the top; the merchant and librarian at the middle, saved as starts with their home room | fixed spots |
| 5 wall slots | wall torches: one in `SCONCE_EVERY` along a room's top wall (middle slot of a north face), the same spots as before; which start lit, and which tunnels get them, rolled per room | `SCONCE_LIT_SHARE`, `TUNNEL_SCONCE_CHANCE` |
| 5b budget (v5+) | mounted lights by each room's darkness (below) | its own random stream, so torches can't move |
| 6 floor lights | campfires (rolled with the run, `fires`) marked first with their clearance; then floor candles | below |
| 7 spawns | every fight room's foes (the ambush's included) and the card witch | `FOE_GAP`, `DOOR_CLEAR`, not the top row, one end each in a two-den room, the boss's stand; never on a solid thing or a reserved point, never in a pocket you can't reach |
| 8 decor | lab only (`/lab/newrun`), from the seed, not saved | `decor.ts` |
| 9 floor variety | worn tiles, puddles and mouse holes from the seed, not saved | `placeFloorLife`: a puddle where it and the 8 tiles round it are floor, `PUDDLE_CLEAR` from things, fires and candles, `DOOR_CLEAR` from doors; a hole on a top wall's foot with a clear run of `RAT_LANE`+ tiles |

- **Optional things try again before they're dropped** (the user, 2026-11-08): a candle (or any
  optional thing) whose spot is taken tries every other valid spot in its room, in a
  deterministic random order, and is left out only if none is valid. A required thing whose spot is
  taken goes to the nearest valid panel, and that's reported.
- Because every fight room's foes are placed when the run is made, on their own room's stream,
  beating a room can't move anyone, and nothing can start on a chest, pool or cage.

### Footprints in use (v4 onward)

- Things take their reviewed footprints ([objects.md](objects.md) "Sizes") and may share a panel
  where their footprints don't meet. **One solid thing a panel, inside its panel**: a generator
  rule while walking is on panels (policy.ts), not a limit of the occupancy map. Walk-over things
  may cross panel edges and share with each other and with a solid thing's free subcells, never
  inside its clearance.
- Where things sit in their panel: chests, rickety chests, decks and the carts take the back two
  rows (`clearFront`: the front row is their clearance); a sack takes a back corner, favouring the
  side nearest a wall; pools and cages fill the panel; campfires 2 × 2 with 1 all round. Storage
  leans to walls and corners where it suits (the user, 2026-11-08). Pictures are drawn at today's
  size, centred on the footprint.
- **Using things** (the fix released as 832891c, 2026-11-08): a thing has three separate places:
  where it stands (its footprint's middle, `t.x`, `t.y`), where it's drawn (the same), and the
  panel it's used from (`usedFrom`). A tap picks the thing drawn nearest it among those whose
  panel you've seen (`tappedThing`, walkWorld.ts); walking up to it is `walkUpTo` (walkSim.ts);
  reach (1.5 u) is measured from `usedFrom`. Every thing is usable from every panel round it.
  Tests: tests/thingAccess.test.ts. Not taken: reach to the footprint's nearest edge (it would
  lengthen reach); it waits for walking on subcells.
- Big creatures stand on their panel's centre as before; their size class only checks there's
  free floor round the spot.

### Candles and extra torches (world versions 5–8)

**Roles** (✅ the user, 2026-11-08): mounted lights give a room its ambient light; **floor
candles** are small placed objects that start unlit and light when you walk near (the user
changed this after release; lighting them by tapping, "B6", was dropped). A lit light shows what
it lights only while it's in your sight.

**The budget, room by room** (numbers 🧪):
1. **Darkness D:** the room's floor panels that none of its fixed lights reach, worked out at
   placement through `torchLit`: every wall torch counted as lit, and burning campfires.
2. **Room kind W:** entrance, boss and encampment 0; fights (easy, hard, mini boss) 0.75; quiet
   rooms (chest, stash, pool, campfire, cards, treasure) 1; lived-in rooms (merchant, librarian,
   library, witch, storehouse) 1.25.
3. **How many:** E = W × D ÷ `DARK_PER`; the count is E's whole part plus one more at a chance of
   what's left. Capped at 2 a room, 3 in a large room. A light is placed only in a slot that lights
   at least 3 still-dark panels, and placing stops once only `DARK_KEPT` (40%) of the room would be
   left dark.
4. **Where:** one at a time, each takes the free slot (on a room's wall or a pillar's face) that
   lights the most panels still dark after the lights already chosen. At most one a pillar; in a
   dog-leg, no second in a rectangle until each dark rectangle has one; at least 3 panels from any
   other light; not on a door's face; not behind a solid thing on the floor in front. Ties: a wall
   over a pillar, then a hash of the slot fixed for the run.
5. **Lit at the start:** each rolls for itself (fights 10%, quiet 25%, lived-in 60%), saved as
   `start: "lit"`; an unlit one lights when you walk near.
6. **Floor candles** (separate, decorative): F = W × floor panels ÷ `FLOOR_PER`, whole part plus a
   chance, capped at 1 (2 in a large room). On free walk-over subcells, 3+ panels from doors
   (`CANDLE_CLEAR`), not on a required path's panel, not in a campfire's or solid thing's
   clearance; 3+ panels from the room's feature and cages where the room allows, else 2; never in
   front of a mounted light's slot, nor round another floor candle.

**By version** (the dials are in lib/dungeon/torch.ts):

| Version | Mounted lights | Floor candles | Dials |
|---|---|---|---|
| v5 | wall candles (`candle-wall` north, `candle-wall-side` west/east, `candle-wall-south`), on walls and pillars | `floor-candle` | `DARK_PER` 350, `FLOOR_PER` 900: 0.52 mounted and 0.28 floor a room |
| v6 | as v5 | also never within `CANDLE_RADIUS` of a mounted candle's light point, and never on a panel touching a wall or pillar (diagonals included) | as v5 |
| v7 | as v6 | as v6 | `DARK_PER_V7` 120, `FLOOR_PER_V7` 300 (rooms got smaller with the guided layouts and 2-tile Cyclops blocks): 0.53 mounted, 0.30 floor |
| **v8** (now) | **wall torches**, not candles (the user, 2026-11-09: "make the wall candles all wall torches. Wall candles should no longer exist"): `sconce` on a north face, `sconce-side` on a west or east one, **never a south face** (there's no torch art seen from behind); judged at a torch's reach (`SCONCE_RADIUS`); same lit chances; ids carry on the room's torches (`<room>:<n>`). About 0.52 extra torches a room. | as v7; the first is `candle:<room>` | as v7 |

- A mounted light's **light point** is its floor panel (as a wall torch's), never the face point
  (which on a south or east face rounds into rock); its fine glow is measured from `slotLightCell`.
  A test checks every light point is floor.
- Drawn with the current art where they stand. The walk reads a room's side-wall torch with its
  side, so it's drawn on that wall, as a tunnel's is.
- **Stage B's unfinished steps** (B2 drawing, B3 sprites, B4 density; the user, 2026-11-09):
  - ✗ **Superseded by v8** (no wall candles in new runs): the wall-candle sprites (face-on,
    side-on, the south face reusing face-on), the south-face fade (`capFade` on a candle behind the
    south wall's band: torches never take a south face), and the wall-candle bracket drawn in code.
    v5–v7 runs keep their wall candles, drawn with today's candle art, as now.
  - 🚧 **Kept, now for the extra torches** on rooms' side walls and pillars' faces: each drawn from
    its mount point (where the holder meets the wall), at the wall torches' bracket height, sorted
    with its face (a north face on its wall, behind what stands in front; a west or east face at
    its own y, like a tunnel's side torch), its flame and halo over the dark, its light from its
    floor panel. Pin these in the scene builder's draw-list tests if they aren't already.
  - 🚧 **Kept: the density comparison** (B4): sparse, ambient and rich settings of the dial
    (`DARK_PER_V7`) compared side by side for the user to set the number; still 🧪 (the user
    skipped this gate to play-test). A change after that is a new world version.
