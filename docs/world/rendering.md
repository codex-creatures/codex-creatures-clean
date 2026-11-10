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

**The 2D walk view (components/WalkView.tsx) is what the game draws, and stays authoritative for
live play. No move to 3D is approved;** §4.1–4.6 describe it. This section is where a 3D renderer
is headed if it's adopted. It changes drawing only: world units, subcells, placements, the sim,
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
| components/WalkView3D.tsx | the renderer: a React Three Fiber canvas, with `walkSim` for walking, sight, foes and taps (no fights or loot). Grey (`GreyRock`): one carved mesh, with the lean in its vertex shader, flat greys (`GREY`) by vertex colour, and ambient plus one directional light (`GREY_LIGHT`), rebuilt at most 4 times a second as you see more. Kit art: instanced floor tiles and wall cubes with the 2D kit F art, your torch plus a pool of 8 point lights (`LIGHT_POOL`), ambient 0.5. Both: upright sprites for you, things and foes. Its setup copies WalkView's |
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
