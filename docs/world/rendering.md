# Projection and drawing

Authoritative for the camera, the projection, anchors and drawing order, and (§4.8) for the 3D direction and its prototype. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

## 4. Projection and drawing

### 4.1 The camera (✅ decided: fixed three-quarter, from the south, no rotation)

> ⚠️ This is the live 2D view's camera, still authoritative for the game. The approved direction for
> a 3D renderer (about 60° down, facing north, orthographic) is in §4.8; no move to it is approved.

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

## 4.7 What today's drawing gets wrong (found 2026-11-10; true whichever renderer comes next)

Measured from the code (lib/render/scene.ts, projection.ts, lib/sprites/walk.ts), not yet fixed:

- **The haze is the lighting, not the art.** The dark is one value per panel (`torchGlow`),
  scaled up with smoothing on, so every light's edge is a soft blur a panel wide. Over it, a
  full-screen `multiply` gradient tints everything (going cold blue-grey towards your torch's
  edge), and your torch, burning torches, campfires and alarmed foes each add an orange `lighter`
  wash that lifts the darks. Falloff is a smooth curve (`REMEMBERED · (d/r)^1.6`) with no fully lit
  core, and walls aren't lit by whether they face the light.
- **Pixels aren't one size.** The kit (48 × 36 a tile, from PixelLab's three-quarter building kits)
  is stretched to 4/3 its height into square cells (`DEPTH` 1); the hero is 32 art px a unit, the
  walls 48, props each their own legacy width; and the whole view is scaled by a fractional
  amount (15 units across any screen) with nearest-neighbour pixels, so art pixels come out
  uneven. Fine stone detail turns to mush.
- **Little separation.** Floor, walls and props share a narrow band of dark values; kit F softened
  the wall tops and edges further (the user's choice, 2026-11-09); props have no outline of their
  own and no contact shadow.

What follows from them, for any renderer: one art density with square pixels; light computed
finer than a panel and drawn crisp; no full-screen tints or additive washes; a lit core before
the falloff; surfaces lit by facing; value steps between terrain, props and characters; contact
shadows drawn by the game. **Not decided:** D, sprite sizes and the art pipeline wait for the
rendering architecture (the user, 2026-11-10).

## 4.8 The 3D direction (the user, 2026-11-10)

**Since 2026-11-10 the game draws the walkable dungeons in 3D** (decision 38; "In the game" below),
in Stone with decision 37's picks. The 2D walk view (components/WalkView.tsx), which §4.1–4.6
describe, is kept until the 3D one has been played. The 3D view changes drawing only: world units, subcells, placements, the sim,
sight and light reach stay as they are ([space.md](space.md) §1).

### Approved visual intentions 📌

The goal: **a mostly top-down dungeon crawler that uses real 3D geometry for depth, light and
structure. Not an isometric game.**

- **Camera:** fixed, about **60° down** from the horizon, always facing north (no diagonal or
  isometric turn, no rotation), **orthographic** to start with. The floor and the walkable space
  are what you look at; depth is subtle and serves the crawl.
- **North walls** (the wall on a room's north side) show their face. **South walls show no
  equivalent face.** The dungeon stays easy to read from above.
- **Side walls (east and west):** close to you, a side wall shows as a thin edge; further away
  across the screen, a little more of its face, texture and depth shows. Subtle: no large faces,
  no isometric look. **An artistic rule, not physics.** (The 2D view already does a version of
  this: `sideFace` in lib/dungeon/tileArt.ts.)
- **Solid rock:** to explore treating everything outside rooms and tunnels as solid rock, so the
  dungeon feels carved out, not floors with walls set around them.
- **Lighting:** lights reveal surfaces (texture, colour, shape); no blur or washed-out look; dark
  areas atmospheric but readable; **no light through solid rock**; consistent with the game's
  sight and light reach where possible. "Clear and atmospheric, not just darker." (The 2D faults
  it must avoid are in §4.7.)
- **Art standard, after the camera and geometry are validated:** one rule of thumb for size,
  texel density, proportions, materials and lighting, so new assets aren't re-sized each time.
  The 48-a-unit and ¾-depth work (§4.6, [art-pipeline.md](art-pipeline.md)) is context, not
  automatically carried into 3D. Style unchanged: stylised fantasy pixel art, readable stonework,
  cohesive proportions, deliberate light. The user brings the reference images again.

### Geometry and camera rules 📌 (settled by the user, 2026-11-10, in the grey experiment)

Chosen by eye in `/lab/three`'s grey geometry, phone included, where walking and performance felt
good. They hold for any 3D renderer of the walkable dungeon; the 2D view is still what the game
draws, and no migration is approved.

- **Camera:** orthographic, fixed, facing north, **60°** down from the horizon. No rotation, no
  perspective, no movement besides following you.
- **Side walls (east and west): the lean.** Every point of the rock moves outwards, away from your
  column, by `lean × its height × its distance across from you`, with **lean 0.03** (in the vertex
  shader). Near you a side wall is a thin edge; across the screen a little of its face shows.
  (Candidate A, a narrow perspective camera, was turned down.)
- **Wall height: 2.25 u.**
- **North walls** show their faces. **South walls show none:** their faces turn away from the
  camera and are never drawn.
- **South walls: a low rim.** Rock just south of open floor (`SOUTH_BAND`, 2 rows) shows as a lip
  `SOUTH_LIP` (0.25 u) high, so it marks the room's edge and hides nothing; rock that is also
  another room's north wall keeps its full height and face. (Full-height south rock hid about
  1.3 u of floor, and you standing there.)
- **Solid rock:** the dungeon is carved from one mass of rock at wall height, running on past the
  plan; rock tops are one surface, with floors cut into it.
- **Places you haven't found: black, for now.** Everything is carved, and rock or floor not beside
  floor you've seen is drawn black (as the 2D view does). Hard to judge without art, so the user
  wants it softened later: unexplored places **fading** to black rather than a hard edge, worked
  out with lighting. (The other option, unfound floor shown as solid rock, stays in the lab.)
- **Physical rock and shown rock are separate.** What rock *is* (it blocks walking, sight and
  light) is the floorplan's tiles, read by the sim. What rock *shows* is only the mesh's heights.
  So a wall can be lowered, cut away or hidden on screen (the low rim is one) without changing
  what it blocks. The renderer never feeds back into the rules. The user called this important
  for visibility, lighting and later work: keep it.

### Technical approaches still to validate 🧪 (nothing here is decided)

The camera and geometry candidates were settled in the grey experiment (the rules above). Still open:

- **Light through rock:** Three.js point lights ignore walls unless shadows are on (cube shadow
  maps cost six passes a light). The other candidate, lighting driven by the sim's own light reach
  (`lightNow`) at subcell resolution, can't bleed and matches gameplay by construction. **Stone
  uses it** (below), and the user's picks were made on it (decision 37).
- **Texture density and mapping:** source art drawn flat and square at one density, laid on the
  geometry by the renderer from the camera, so assets carry no foreshortening. Picked in Stone
  (decision 37): square on screen, 48 art pixels a unit.

### The prototype as built (2026-11-10)

`/lab/three`: a made-up run held in memory, drawn by the 2D view or the 3D one from the same
seed. Nothing is saved; the game doesn't use it. **Start from `?view=3d&geo=stone`** (the
materials-and-lighting experiment, on the settled geometry) or `?view=3d&geo=grey` (the same
geometry in flat grey). The older "Kit art" mode doesn't follow the rules above (see its limits below).

| File | What |
|---|---|
| app/lab/three/page.tsx | the lab page. All modes: 2D or 3D, Encampment or Labyrinth, another run, pitch, zoom (11, 15, 19 across); fps, draw calls, triangles, units across as drawn and the pixel scale. Stone: art density (32, 48), stand-in art (kit F or A), texels (square on screen or on the surface), pixels (screen, art, whole-number), light (smooth, stepped, dithered), edge of the unexplored (fade or hard), each with "Flip" where there are two to compare. Grey: side walls A or B (FOV or lean), south rock full or low rim, places not found yet (solid rock, black, shown), wall height, and "Flip" (swaps a pair every second). Kit art: orthographic or perspective, screen or art pixels, torch shadows. Address: `?view=2d\|3d&geo=grey\|stone&density=32\|48&kit=f\|a&texels=screen\|world&pixels=device\|art\|whole&light=smooth\|stepped\|dither&fade=0\|1&pitch=<°>&lean=<n>&fov=<°>&south=full\|low&unseen=rock\|black\|shown&wall=<u>&across=<n>&dungeon=1&seed=<n>&seen=all&room=<kind>&camera=persp&shadows=1` |
| hooks/useWalkPlay.ts | the walk going on, everything but the drawing, set up as WalkView sets it up: placements, the sim, its events to the screen's callbacks, taps, the stick and keys, flares, saving as you leave (tests/walkPlay.test.tsx) |
| components/WalkView3D.tsx | the renderer: a React Three Fiber canvas, played by `useWalkPlay` (fights, loot and the rest, as in the game; the lab only logs them). Grey (`GreyRock`): one carved mesh, with the lean in its vertex shader, flat greys (`GREY`) by vertex colour, and ambient plus one directional light (`GREY_LIGHT`), rebuilt at most 4 times a second as you see more. Kit art: instanced floor tiles and wall cubes with the 2D kit F art, your torch plus a pool of 8 point lights (`LIGHT_POOL`), ambient 0.5. All modes: upright sprites for you, things, foes, the witch, campfires, candles, wall torches and rubble. `GAME_VIEW`: what the game draws |
| lib/render3d/stone.ts | Stone's pure rules: `texelsPerU` (how a flat texture is laid: square on screen or on the surface), `pixelScale` (screen, art or whole-number pixels), `lightField` (the light grid, `SUB` 3 a tile, `WINDOW` 64 tiles round you: lit only where the sim's `lightNow` says and along a clear line through the floorplan; `CORE`, `FALLOFF`), `lightAt`, `seenField` (what shows, and the `FADE` into the unexplored, which never touches a black tile) |
| tests/stone3d.test.ts | its tests, including no light through rock, none where the sim says dark, and the fade never showing a place you haven't found |
| lib/render3d/dungeon3d.ts | pure rules: `rockHeights` (what rock shows: a height per tile, with the low rim), `carvedMesh` (the mesh from the heights: tops, and faces facing the lower side; each quad's `tile`), `SOUTH_BAND`, `SOUTH_LIP`, `ROCK_MARGIN`, `WALL_HEIGHT` 2.25, `shadeOf` (seen or never seen), and the kit-art mode's `dungeonCells`, `DEFAULT_PITCH`, `uprightStretch` |
| tests/dungeon3d.test.ts | its tests, including that heights never change the floorplan |

Dependencies: `three` 0.186.0 and `@react-three/fiber` 9.8.2, pinned, loaded on this page only. A
Labyrinth run in grey is about 18k triangles in one draw call, rebuilt in about 12 ms; the user
found it smooth on their phone.

**Limits:**
- **Grey** has no textures, no torch and no wall lights; unseen places switch to black with a
  hard edge.
- **Kit art** predates the rules above: default pitch 48.6°, no lean, full wall cubes with the 2D
  kit's north face on every side, only the ring of rock touching floor, and lights through rock
  unless torch shadows are on.
- **Both:** sprites are flat cut-outs facing south, stretched by `uprightStretch`.
- In grey, screen or art pixels and torch shadows are hidden (no art or torch to change). In kit
  art at 15 across, an art pixel is only about 1 to 2 screen pixels, so art-sized pixels barely
  show.

### In the game (✅ built 2026-11-10, decision 38; to play-test)

Both walkable dungeons, "New: the Encampment" and "New: the Cyclops", are drawn by WalkView3D in
Stone with `GAME_VIEW` (decision 36's geometry, decision 37's picks), in place of WalkView, with
no switch. app/dungeon/page.tsx hands it the same props and callbacks it handed WalkView, so the run
plays out as before (fights and the boss, loot, cages, pools and people, campfires, the scroll,
flares, saving mid-run). Three.js loads only once you walk. The rules, sim, layouts, placements,
world versions and saves are unchanged, and the classic dungeons untouched.

- **Shared with WalkView:** the stick, the campfire window (`Warmth`) and the scroll (`WalkScroll`).
- **Drawn as the 2D view does, in its own way:** a "!" over foes that have seen you (lit like your
  torch, `ALARM_LIGHT`) and over cages you can open; the fade to black into a fight (`FADE_TIME`);
  rooms cut off behind you dimmed; a used pool dimmed; rubble falling where a tunnel fell in, with
  the shake; the witch walking (her sheet); campfires (full bright while burning) and the kit's
  candles with a flame on each lit wick.
  A fire, candle or wall torch glows (full bright, its flame, a light of the pool) only while it's
  in sight (the sim's `lightNow` where it stands, as the sim counts its light): out of sight, round a
  corner or cut off, it's drawn as dark as what's round it (the user, 2026-11-11).
- **The chest, stashes and bookcases are 3D** (the user, 2026-11-11: "getting the 3d items into the
  dungeon"): the treasure chest, a stash's sack, a beaten room's loot sack and the library's
  bookcases are drawn as the lab's 3D drafts (components/Props3D.tsx, shared with /lab/chest), in
  place of their flat pictures (lib/render3d/props3d.ts `PROPS_3D`): PixelLab faces, the outline, the
  lit edges, and the rock's lean about the camera. Each stands in the middle of its footprint (where
  its thing stands, placements.ts `spotOf`: until 2026-11-11 the view moved it a sixth of a unit
  further back, `propSpot`, now gone), facing south, unlit and tinted by the light where it stands as the sprites are. A chest
  opened swings its lid back and shows the gold inside; a sack opened is untied (no rope, its mouth
  open: `sackOpenOutline`). Drawing only: footprints, sight, taps and saves are unchanged. ⚠️ They're
  the lab's sizes, not the footprints': the chest (1.25 × 0.79 u) is wider and deeper than its 1 ×
  0.67 u footprint, and the bookcase (2 u tall, whole) is taller than its object's 1.4 and isn't the
  broken one the flat picture showed. Every chest is the treasure chest for now (the user, 2026-11-11):
  a storehouse's rickety one and a boss's or mini boss's loot too (`rickety-chest`, `loot-chest`),
  till they get their own faces.
  An open chest's lid reaches about 0.29 u back past where you stand on the panel behind it, so you
  were drawn over its top edge (the user, 2026-11-11: "you are seen on top of the lid"). The chest is
  drawn `CHEST_NUDGE` (0.35 u along the view) nearer the camera than it stands, in depth only
  (`leaned(m, nudge)`: it shows where it was), so the lid is in front of you there; in front of it or
  beside it you're far further off than that (tests/chest3d.test.ts).
- **Tables** (world version 12, the user, 2026-11-11): a rickety table, a slab on four legs (Props3D
  `Table`, props3d.ts `tableArt`): as big as the chest (1.25 × 0.79 u, its top 0.83 u up, `TABLE_TOP`;
  the user: room for a candle and the deck), PixelLab's faces in the dungeon palette, styled on the
  chest's (public/sprites/props/table3d: the front, whose edge band is the slab's front and sides, a
  front leg's column every leg, and what's under the slab a see-through cross brace between the front
  legs and between the back ones; the top). A candle on one stands on its top to the left (`Candle.high`,
  `CANDLE_AT`), the deck to the right (`DECK_AT`). (The first faces, warm brown and smaller, made
  without the art standard, were replaced the same day.) A cards room's
  deck is drawn on a table in runs of every version (`card-deck` → `table`), lying face down till it's
  turned over; while it's in your sight it glows the colour of its rarest card (`deckRarity`,
  `RARITY_COLORS`): a soft disc on the floor out to half a candle's reach and on the deck, half as
  strong (`DECK_GLOW`), added to what's there so it shows in the dark. Drawing only: the glow lights
  nothing in the sim. The 2D view shows a table as its front picture (and a table's candle on the floor).
  To look at it: /lab/chest's **Table** (its candle on or off) and **Deck** (the rarest card's rarity for the
  glow; "Turn them over" takes the deck off), beside the old flat picture and you for scale.
- **🧪 Drafts of the rest, lab only** (the user, 2026-11-11: bring what's found in the dungeon up to the
  tables' level; components/Drafts3D.tsx, /lab/chest's "Drafts" row, each beside its old picture). Painted,
  PixelLab samples in the dungeon palette styled on the old pictures (public/sprites/walk/samples/3d/): the
  storehouse's **rickety chest** (the chest's boxes with its own front, side and lid), the library's
  **broken bookcase** (the bookcase's box with a broken front), the **healing pool** (a low ring of stone,
  its top the pool seen from above, a faint glow) and the **campfire** (a ring of the pool's stones round its
  pit, flames standing up in it, its glow; lit or out). Shape only, plain palette colours, to judge size and
  form before any art: the **cage** (posts, frame, bars; its front swings open), the **lectern** (an open
  book on a sloping top), **candles** (three, a flame each), the **wall torch** (on the lab's wall) and
  **rubble**. Nothing in the game draws them until the user approves each.
- **Tunnels up are shown one-way** (the user, 2026-11-10: one stayed open behind them, though they
  couldn't go down it): a tunnel up's top door shows as rock with a rubble heap, except from inside
  the tunnel or the room below it (lib/render3d/dungeon3d.ts `oneWayDoors`). Drawing only: walking,
  sight and light are unchanged. (The 2D view showed these open too.)
- **Taps:** the floor under the tap (where the ray from the camera meets it), as the 2D view's
  `tapCell`, measured from the box as drawn so Settings → Screen size doesn't throw it off. The
  stick's push up the screen walks 1 / sin(pitch) of floor, so you go the way it points.
- **Not drawn (yet):** the glow of torches, candles and fires over the dark, the pool's faint
  glow, the green crosses round you by a fire (the window's "+" shows it), the campfire's flame
  tongue, the dust of a fall, the lab's decor samples. Limits as Stone's, below.
- **Tests:** tests/walkPlay.test.tsx plays the hook on the saved runs; tests/dungeonPage.test.tsx
  stands the 3D view in as it did the 2D one (its golden unchanged) and checks the page hands it
  every prop.

### Draft: a 3D chest (2026-11-11; in the game since the same day, "In the game" above)

The first 3D object, to see how one looks before any goes in the dungeon (the user, 2026-11-11).
`/lab/chest`: the chest built from boxes (lib/render3d/chest3d.ts `chestParts`: a body open at the
top with gold inside, a lid turning on a hinge along its back top edge, two iron bands, iron corners,
a lock plate and hasp), 0.8 u tall at `CHEST_W` 1.25 u wide (the chest object's height), on kit F's
floor in front of a north wall, under the game's camera with art pixels at 48 a unit. Beside it: the
flat chest as the game draws it now, and you, for scale. Switches: open or shut (the lid swings),
the test torch moving round it or still, the old chest shown or not, game zoom (15 across) or close
(7), and the width (1, 1.25, 1.5, 1.75). The wood, iron and gold are plain stand-ins made in code
(planks and noise, no detail), laid a unit of art to a unit on every face; the real surfaces would
be flat PixelLab art on the same boxes. Lit by Three.js lights (a warm torch and a dim ambient), not
yet the game's own light field. The game doesn't use it. Tests: tests/chest3d.test.ts.

**Second pass (the user, 2026-11-11: "looks 3D but nowhere near as good"):** it now starts on
**PixelLab art**: the chest as two boxes, body and lid, with painted faces
(public/sprites/props/chest3d/: `front.png` 60 × 19, the lid's front edge over the body's, and
`top.png` 60 × 33, the lid top; Pro, styled on the old chest), drawn square on screen at 48 a unit,
so the boxes' sizes come from the pictures (`chestArt`: 1.25 × 0.79 × 0.79 u). The sides reuse the
front's end; the lid's underside is its top darkened; the gold inside is still a stand-in. Two
pixel-art touches, each with a switch: a **one-pixel dark outline** round each box (a black copy a
pixel bigger, drawn inside out) and **lit top edges** (the top row of each front and the lid top's
front row, ×1.4, made beforehand as `front-lit.png` and `top-lit.png`; the underside is `under.png`). Each face is its part of a picture by its UVs (a copy of a texture cut before its picture loaded stayed black: the first try of this pass showed a black box). The stand-in's textures are now laid square on screen too (they were square on the
surface, so its fronts' pixels showed half height).

**The lean (the user, 2026-11-11: "it stands at a height, so you should see some of it from far away,
like the walls"):** the chest and the lab's wall lean as the game's rock does (decision 36, 0.03,
in the vertex shader, worked from where each point is in the world), so a chest across the screen
shows a little of its end, more the further across. Its ends have their own picture (`side.png`,
38 × 19, Pro, styled on the front). Switches: the chest 0, 2, 4 or 6 units across from you (the old
flat one as far the other way), and the lean on or off. The flat sprites (you, the old chest) don't
lean, as in the game.

**A stash and a bookcase too (the user, 2026-11-11):** the lab's buttons pick Chest, Stash or
Bookcase (lib/render3d/props3d.ts), each beside its flat sprite, with the same outline, lit edges and
lean. The **bookcase** is one box with PixelLab faces (public/sprites/props/bookcase3d/), its size
from the pictures: 1.25 × 2 × 0.5 u, brown oak (the user: "more brown wooden, at least our character
high"). ⚠️ You look about 2 u tall: the hero sprite is drawn stretched to stand up (`uprightStretch`),
47 art pixels of 32 a unit, so on screen it's as tall as a 3D thing about 2 u high, against the
objects' heights in lib/world/objects.ts (the hero's 1.1, a bookcase's 1.4). The art standard will
need one scale for both. Open, the **chest** shows its inside (`inside.png`: the rim, gold and gems),
where it showed a stand-in gold box. The **sack** is a bag's outline turned round
(`sackOutline`, 8 sides, flat-shaded so they show as facets: a round thing can't be boxes), 0.6 tall,
in a burlap cloth repeated round it (public/sprites/props/sack3d/), with a rope round its neck.
"Turned" stands any of them end on (a quarter turn), to see a chest the other way round: in the lab
only. In the game every object faces south (`rot` in lib/world/objects.ts is there for turns, but
nothing turns yet); turning chests there would need the 3D chest in the game first (a flat picture
can't turn), then a new world version whose placement picks a turn, swaps the footprint and moves the
clear space in front (`clearFront`) to the side it faces.

### Done: the grey geometry experiment (2026-11-10)

Camera and geometry only, in flat greys, to judge shape. The user compared side walls A (narrow
perspective) and B (orthographic with the lean), full south rock and a low rim, wall heights, and
unfound places as rock or black, and picked the rules above (decision 36). The comparison aids stay
in the lab: the rim's darker top (`GREY.rim`), "Flip", and unfound places "shown".

### Built: the Stone experiment (materials and lighting) (2026-11-10)

**Small and representative, in /lab/three, on the settled geometry** (`?view=3d&geo=stone`): the
grey mode's carved mesh, the lean, the camera and the sim unchanged, with stand-in textures and a
new light. No new art and no art standard yet.

**The user's picks 📌 (2026-11-10, by eye in the comparison; decision 37; lab only, no migration):**
**48 art pixels a unit; texels square on screen; kit F's style; art pixels at 15 units across**
(not whole-number scaling); **smooth light** (not stepped or dithered); **unexplored places fade**
to black (not a hard edge). Stone now starts on these. The other choices stay in the lab to compare.
The art standard itself is still to write, from samples drawn to these picks.

- **Textures: drawn flat, laid by the renderer.** Source art is a flat, square picture of the
  surface at one density (art pixels a unit), with no foreshortening drawn in. The shader lays it
  by world position (floors and rock tops by x and z, faces by across and height), so density is
  the same everywhere and nothing is mapped per tile. "Square on screen" lays floors sin(pitch) and
  faces cos(pitch) tighter, so one art pixel shows as one square on screen at any camera; "square on
  the surface" is the plain 3D way (the camera squashes faces to half at 60°). Either way the art
  needn't be redrawn when the camera changes.
- **Stand-ins:** today's 2D kits, not redrawn: floors are the kit's floor (drawn foreshortened for
  the 2D view), wall faces the rows of its north wall under the cap, rock tops that stone again at
  half brightness, the low rim's top the cap band. Kit F was drawn at 48 a unit, so at 32 it shows
  1.5 times bigger (bigger pixels and bigger stones); kit A is the one set drawn at 32. A fair
  32-against-48 judgement of detail needs art drawn at each.
- **Pixels:** screen (the device's own), art (density × 15 canvas pixels across, blown up sharp by
  an uneven amount, e.g. ×2.4) or whole-number (blown up a whole number of times, every art pixel
  the same size, the units across moving to fit, e.g. 18.3 at 32 on a 1170-pixel phone). With art
  pixels the camera moves in whole canvas pixels, so the stone doesn't crawl as you walk.
- **Light: no Three.js lights.** A grid a subcell apart round you, lit only where the sim lit a tile
  this frame (`lightNow`) and along a clear line through the floorplan, so never through rock and
  never where the game says dark. Each light has a fully lit core (`CORE` 0.4 of its reach), then
  falls off to nothing at the reach the sim uses. Your torch is kept apart so faces take it by how
  squarely they face it; faces also darken towards their tops (the torch is lower than the wall).
  Rock tops get a little light, the low rim nearly the floor's. Light multiplies the art (warm where
  lit, a plain dim, `remember` 0.2, where you only remember); nothing is added over the picture.
  Smooth, stepped (6 bands) or stepped with an ordered dither where bands meet.
- **The unexplored:** what you've seen fades to black over 1.5 tiles towards places you haven't
  found, or ends hard. The fade dims only what already shows; black stays black, so it never
  gives a layout away.
- **Sprites** take the light where they stand (you stay unlit, as in the other modes). The tuning
  numbers are `STONE` in components/WalkView3D.tsx.

**Limits:** stand-in art (above); you and the objects are 32 a unit, so at 48 they're blown up
unevenly; no shadows from objects or creatures, and no contact shadows or darkening where floor
meets wall yet; the light grid covers 64 tiles round you; the curve is not the 2D view's
`torchGlow`. One draw call for the rock, as grey.

⏸ **Paused, not abandoned** (the user, 2026-11-10): gameplay comes first for now
([roadmap.md](../roadmap.md#current-focus-gameplay-the-user-2026-11-10)). Everything here stays.

**Next, on resuming, when the user says so:** a few PixelLab sample textures in kit F's style, drawn flat and
square at 48 a unit (floor, wall face, rock top, rim), with the user's reference images and their
approval before any rollout; then a short art standard written from what works.

The user's priorities:
- **Textures:** sharper, more detailed and cohesive pixel art, closer to the user's reference
  images (they share them again: they're not in the repo).
- **Density:** consistent texture density and asset proportions, built on the world units (1 u a
  panel, 3 × 3 subcells; the densities in use are in [art-pipeline.md](art-pipeline.md)).
- **Surfaces:** floor, north wall faces, rock tops and the low rim each distinct and readable.
- **Light** shows stonework and objects; no coloured haze over the picture.
- **No light through solid rock.** The open candidates are under "Technical approaches still to
  validate" above.
- **Darkness** stays atmospheric without losing readability.
- **Unexplored places fade smoothly** into black, without giving their layout away.
- **Afterwards: a concise art standard**, from what works in this renderer.

Kept from earlier decisions: art from PixelLab, samples first and the user's approval before any
rollout (CLAUDE.md, [art-pipeline.md](art-pipeline.md), decision 33: the reference is a target,
not a source); the geometry and camera rules above; physical rock kept apart from shown rock; the
game, its saves and its 2D view untouched; no migration to 3D.
