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

### Technical approaches still to validate 🧪 (nothing here is decided)

- **Side walls:** an orthographic camera facing north sees east and west faces exactly edge-on, so
  the side-wall rule needs something. Candidates: (a) a perspective camera with a narrow field of
  view (faces open with distance from the centre of the screen, which is you, but the floor
  foreshortens slightly); (b) orthographic, with the side faces leaned in the wall's vertex shader
  by their distance across from you; (c) side faces as separate, flat-shaded quads sized per
  frame. Pick the one with no camera movement and the fewest special cases.
- **South walls:** a full-height block on a room's south side hides the floor behind it (about
  1.3 u at 60° for today's 2.25 u wall). Candidates: lower south rock, a cap with no face, or
  fading it near you as the 2D `capFade` does.
- **Solid rock:** rock tops as one merged surface at wall height over all rock (not only the ring
  touching floor), floors carved into it. Check: draw calls and triangles on a 30-room Cyclops
  run, the unexplored (`known`) blackout, culling, and that layouts need no change (they don't
  read the renderer).
- **Light through rock:** today's point lights ignore walls unless shadows are on. Candidates:
  shadow maps (cube shadows cost six passes a light); or lighting driven by the sim's own light
  reach (`lightNow`, `torchGlow`) at subcell resolution, which can't bleed and matches gameplay
  by construction. The second is the likelier fit; it needs a test.

### The prototype as built (2026-11-10)

`/lab/three`: a made-up run held in memory, drawn by the 2D view or the 3D one from the same
seed. Nothing is saved; the game doesn't use it.

| File | What |
|---|---|
| app/lab/three/page.tsx | the lab page; switches for pitch (35°, ¾ 48.6°, 60°, 75°), orthographic or perspective, art-sized pixels, torch shadows, zoom; settings in the address (`?view=3d&pitch=60&camera=persp&pixels=art&shadows=1&across=15&dungeon=1&seed=…`); fps, draw calls, triangles |
| components/WalkView3D.tsx | the renderer: React Three Fiber canvas, `walkSim` for walking, sight, foes and taps (no fights or loot); instanced floor and wall meshes; your torch plus a pool of 8 point lights (`LIGHT_POOL`) for the nearest lit torches, candles and campfires; ambient 0.5; upright sprites. Its setup copies WalkView's |
| lib/render3d/dungeon3d.ts | pure rules: `dungeonCells` (a floor on every walkable tile, a wall block on rock touching floor, diagonals included), `shadeOf` (seen or never seen), `WALL_HEIGHT` 2.25, `DEFAULT_PITCH` asin 0.75, `uprightStretch` |
| tests/dungeon3d.test.ts | its tests |

Dependencies: `three` 0.186.0 and `@react-three/fiber` 9.8.2, pinned, loaded on this page only.

**Limitations, against the direction above:** default pitch 48.6°, not 60°; walls are 2.25 u
cubes with the 2D kit F north face on every side and its cap on top (art drawn for the 2D
three-quarter view, 48 × 36 floors); south walls are full blocks with faces; side walls show no
face orthographically; only rock touching floor is built (deeper rock is empty black); lights pass
through rock unless the torch's shadows are on; sprites are flat cut-outs facing south, stretched
by `uprightStretch`.

### Next experiment

**Camera and geometry only, grey, in /lab/three:** one seeded room-and-tunnel stretch, orthographic
at 60° facing north, solid rock tops, north faces only, no south faces, and the side-wall
candidates (a) and (b) switchable side by side. Flat grey materials and one plain light, so only
shape is judged. *Done when* the user picks a side-wall approach and a south-wall treatment by eye.
Then lighting from light reach (no bleed through rock), then the art standard.

**Built (2026-11-10), awaiting the user's pick:** the "Grey geometry" switch in /lab/three
(`?view=3d&geo=grey`), on the same made-up runs (not a single stretch). The dungeon is one mesh carved
from a height per tile (`rockHeights`, `carvedMesh` in lib/render3d/dungeon3d.ts): open floor at 0,
rock at the wall's height out to `ROCK_MARGIN` (24 u) past the plan, a face wherever neighbours
differ, facing the lower. Floor you haven't seen counts as rock, so nothing gives away an unfound
place. South walls' faces look away from the camera, so they're never drawn. Flat greys (a faint
floor checker, to show foreshortening), ambient plus one directional light, no torch or wall lights,
no wall torches. Switches: **A** perspective (FOV 10°, 20°, 30°) or **B** orthographic with the lean
(`transformed.x += lean × (x − your x) × height` in the vertex shader; 0, 0.015, 0.03, 0.05);
south rock **full** or a **low rim** (`SOUTH_LIP` 0.25 u for `SOUTH_BAND` 2 rows, except rock that is
also a north wall); wall height 1.5 or 2.25 u. A Labyrinth run is about 18k triangles in one draw
call, rebuilt in about 12 ms as you see more (at most 4 times a second).
