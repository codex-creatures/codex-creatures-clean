# Art standard and pipeline

Authoritative for the walkable world's art spec, templates, checks and approval. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

## 6. Art standard and pipeline

### 6.1 The art spec (one per setting: "the dungeon" first)

Each setting is a pack: its palette, kit, props, light settings and decor themes. The spec says:
- **The camera:** read from `projection.ts`, never retyped.
- **Art density:** **48** art pixels per u (`artPerU`) for new walkable assets (the user, 2026-11-09;
  it was 32), square pixels (no `pixelAspect`). Existing assets keep theirs: see
  [Densities in use](#densities-in-use-checked-against-the-code-2026-11-09). ⚠️ The walls (kits E and F)
  are 48 × 36 a tile, so not square: see [Still undefined](#still-undefined).
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

**Built so far (2026-11-09):** `scripts/art-check.mjs` scores a picture against kit E and the palette: colours (distance from the palette), black (hard outlines darker than the darkest stone: the "sticker" look), texture and contrast (each against the stone's own), colours used. `scripts/art-palette.mjs` writes the palette, `art/palettes/dungeon.json`, from kit E's walls: the stone base, and short ramps (wax, iron, rust, wood, flame) lifted or tinted from it. **Art density is now 48 art pixels a unit** (kit E, the user, 2026-11-09), not the 32 below: new art is made at 48; you and the older objects stay at 32 till they're redone. New objects are generated with the palette and a crop of kit E as the style image (PixelLab Pro Flash objects, exact canvas). The game draws grounding (contact shadows) and flames; the art never paints them. 🧪 The contrast limit needs an allowance for light materials (wax).

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

### 6.6 🧪 Props built from recipes (`/lab/propbuilder`; the user, 2026-11-19, plan approved the same day)

A 3D prop as a small JSON **recipe** of simple parts painted with crops of PixelLab drawings, built in the lab
against its drawing; no baked meshes. ✅ Built (all five stages, 2026-11-19): the format, the loader, the renderer
and the altar; editing parts; painting faces; the drawing over the view, torch light, the palette check, new props
and saving. Lab only: nothing in the game draws a recipe yet.

**Using it** (`/lab/propbuilder`; Save needs `npm run dev`):
1. **Start a prop:** pick a recipe, or "+ New prop" (a file name like `healing-pool`, a name, den or dungeon).
2. **Lay the drawing over it:** under Drawing, type the drawing's path (`/sprites/…`); it shows over the middle
   copy at the game's size. Set its foot (the pixel that stands on the floor at the prop's middle: "Bottom
   middle", then − and + a pixel at a time) till it stands where the prop does; "Faint" sets how see-through.
3. **Block it out:** add boxes, cylinders, panels and sprites; tap one in the middle copy (or its name) and set
   where it stands, its size and turn till it covers its part of the drawing. Sizes show in art pixels too, so a
   part can be made exactly as wide as its part of the drawing. Snap to 1 px for that; coarser steps for blocking out.
4. **Paint it:** pick a face (or "* (rest)"), "Picture", find the picture, drag out the crop. Faces that stand or
   lie flat on the prop: "Tile" (48 a unit, the standard). A single picture on one face (a skull, a sign): "Fill",
   with the face sized so the readout says 48 × 48. Things that must face the camera (flames, lanterns): sprites.
5. **Check it:** the left and right copies show its sides as the game's lean will; "Torch" lights it as the
   Labyrinth does, you beside it; the palette check shows what's off-palette; "Game's own behind" shows what the
   game draws there now.
6. **Save:** writes `lib/props/recipes/<id>.json` and lists it. Commit it like any other file. (Elsewhere, Save
   downloads the file: put it in that folder, then run the dev server and save it once more to list it, or add it
   to `index.ts` by hand.)

Until it's saved, a recipe's changes are a draft in that browser only: on another computer, save first.

- **The format** (`lib/props/recipe.ts`, format 1; recipes in `lib/props/recipes/<id>.json`, listed in its
  `index.ts`): `{ format, id, name, setting: den|dungeon, ref?: { src, foot }, parts }`. A part: `id`, `kind`
  (`box`; `cylinder` with `sides` 3–32 and `taper`, its top's size to its foot's; `panel`, a flat board; `sprite`,
  standing facing the camera stretched as the game's flat things are, never turned), `at` (the middle of its
  foot, u), `size` ([w, h, d], or [w, h] for panels and sprites), `turn` (degrees about x, y, z), `light`
  (`unlit` or `toon`: a fixed upper-left light in three bands, `TOON_LIGHT`, needing no scene lights), `glow`
  (full bright, never tinted), and `faces` (box: front back left right top bottom; cylinder: side top bottom;
  panel: front back; sprite: front; `*` for every face not listed; one not covered isn't drawn). A face is a
  crop of a picture under `/sprites/` (`src`, `crop` [x, y, w, h] from its top left, `fit` `tile` or `fill`), a
  flat `colour`, or the `same` as another face; `tint` multiplies either. `readRecipe` checks everything and
  turns down a later format.
- **Density** (decision 37, generalised): along each of a face's two directions, 48 texels a unit as it
  shows on screen (`texelsAlong`): 48 across, 48·cos(pitch) up a standing face, 48·sin(pitch) along a top, and
  whatever keeps a turned face square. A cylinder's sides run on round it at 48 a unit, the seam at the back.
- **Snapping:** one art pixel (1/48 u) or 1/8, 1/4, 1/2 u, or off; turns to 15° (`snapPart`).
- **Editing** (`lib/props/edit.ts`; the lab's Builder and Editor): tap a part in the middle copy (it pulses gold)
  or in the list; its name, where it stands, size and turn (typed, or − and + a snap step, with sizes also shown
  in art pixels), a cylinder's sides and taper, unlit or toon, glow; add a box, cylinder, panel or sprite (in
  front of the prop, a plain colour till it's painted), duplicate, delete (never the last part), move up or down
  the list; undo and redo, 100 edits. Keys: arrows move it a snap step (Shift: up and down), Ctrl+Z / Ctrl+Y,
  Ctrl+D, Delete. Every edit makes a new recipe sharing every untouched part, and `readRecipe`'s `cache` keeps
  their drawing as it was. An unsaved draft of each recipe stays in the browser (`codex_creatures_propbuilder_draft_v1`)
  till it's reset to the file; till Save (stage 4), Copy JSON gives the recipe to paste over its file (`formatRecipe`).
- **Drawing** (`components/PropRecipe3D.tsx`): each face a flat polygon with its own material (the crop read in
  the shader, the lean as Props3D's `leaned`), unlit and tinted by the light where it stands as the game's 3D
  things are; each part memoised on its own recipe object, so changing one part rebuilds only it.
- **Outline** (a box's or cylinder's `outline`): a shell an art pixel bigger all round, drawn inside out in the
  darkest stone (#0e0f0c), so a dark pixel edges the part, as the Labyrinth's 3D things have (Props3D's hull).
- **The altar** (`altar.json`; rebuilt 2026-11-19 from its drawing, den3d/altar.png, where the first recipe copied
  the Den's hand-built one): three stepped tiers of cool blue-grey stone (the Labyrinth's stone, tinted, their tops
  lighter so each step reads), four corner pillars with the drawing's teal windows (glowing), iron caps and bone
  spikes, the cauldron (a foot, a belly and a rim: tapered cylinders), the horned skull on its front, the chains at
  its sides (cut from the drawing: den3d/parts/altar-chain*.png) and the soul fire; toon light and outlines on the
  solid parts. The drawing is corner-on, the camera square-on, so it follows the drawing's design, not its outline.
  Its fire's flicker and floor glow stay the game's to draw (as flames are). Not in the game yet: the Den still
  draws Den3DPlaces' `Altar`.
- **How the game will load them (planned, not wired in; each step the user's to approve):**
  1. A recipe is used by its id: `RECIPE_FILES[id]`, read once with `readRecipe` (bundled JSON: no fetching, and
     offline as well). A module beside the index would keep the read recipes, so each is read once a visit.
  2. One prop at a time, a hand-coded drawing becomes `<PropRecipe3D recipe={…} pitch stretch tint />`: in the Den,
     `Den3DPlaces` `Place`'s case for it (the altar first, its `Glow` and the fire's flicker kept in code); in the
     Labyrinth, `Props3D`'s, by `PROPS_3D`'s kind. It takes the same `tint` the old drawing took, and the lean from
     `PROP_LEAN` as the rest do.
  3. Drawing only: footprints, placements, taps, saves and world versions stay as they are. A prop's recipe should
     fit its footprint; the builder can show the footprint as a floor patch when the first one goes in.
  4. A recipe that won't read (a bad edit committed) falls back to the old drawing, so a room can't break; a test
     reads every recipe and checks every picture it uses is in public/ (tests/propRecipe.test.ts, already).
  5. Taps go through a recipe as they do the old drawings (its `onPick` is the builder's only).
- **Painting faces** (the lab's FacePicker; `changeFace`): the picked part's faces, and "* (rest)" for every face
  not given its own; each a picture, a flat colour, the same as another face, or the rest's. A picture is found in
  the list of everything under public/sprites (`lib/props/sprites.json`, written by `npm run props:sprites`: a static
  or offline copy can't list folders; rerun it after adding art) or typed by its path; its crop dragged out on it
  (whole pixels) or typed; "Tile" lays it at 48 a unit, "Fill" stretches it over the face once and says how many
  pixels a unit that comes to on screen (`faceDensity`), warning when it's off 48 by more than 5%. A tint over
  either. A face is rebuilt only when what it draws changes.
- **The drawing** (a recipe's `ref`: `src`, and `foot`, the drawing's pixel that stands on the prop's origin):
  laid over the view, see-through (how faint is a slider), at its true size (an art pixel the game's), its foot on
  the middle copy's origin; `foot` nudged a pixel at a time, or "Bottom middle".
- **Light:** even, the Den's warm light, or the Labyrinth's torch: the game's own `lightField` and `shadeAt` (Stone's
  settings) over open floor, you standing beside each copy holding it, each copy tinted by the light where it
  stands as the game tints its things, the floor lit to match.
- **The palette check:** the whole view snapped to the dungeon palette, the Den's, or the dungeon's with the altar's
  teal (`lib/props/palette.ts`), so what's off-palette shows (the lab's PalettePass).
- **New props and saving:** "+ New prop" (a file name, a name, den or dungeon) starts one from a plain box, kept as a
  draft till saved. **Save**, under `npm run dev`, writes `lib/props/recipes/<id>.json` (`formatRecipe`; one that
  won't read isn't written) and rewrites the index (`recipeIndex`), through a dev-only route
  (`app/lab/propbuilder/save/route.dev.ts`: `.dev.ts` files exist under `next dev` alone, next.config.ts `pageExtensions`,
  so no build has it). Anywhere else (the offline copy, the site) it downloads the file to put there.
- Tests: tests/propRecipe.test.ts, tests/propEdit.test.ts, tests/propSave.test.ts (the index and each file as Save
  writes them, the picture list, the palettes).

## Density and open standards

### Densities in use (checked against the code, 2026-11-09)

- **Density is per asset, not global.** The projection scales each picture by T ÷ its own
  `artPerU` (§4.4), so assets at 48 and at 32 share a screen with no change to gameplay, placement
  or saves. **Moving to 48 for new assets needs no change to existing ones,** and none are changed
  until each is redone and approved.
- **Walls and floor:** per kit, in `KitArt.size` (lib/sprites/walk.ts), read by the scene builder
  (`KIT_DENSITY`, lib/render/scene.ts). Kits E and F (F is the default, `WALK_TILES[0]`; E is
  `WALK_TILES[1]`) are **48 across and 36 down a tile**; the older kits 32 × 24. Both are the old
  4:3 shape (`pixelAspect`), drawn into a square cell, so their pixels show 1⅓× taller than wide.
- **The hero:** 32 art pixels a unit (`KIT_PX`, `WALK_HERO`). **Foes:** drawn at a fixed height
  (`FOE_U`) whatever their art's size; bosses and the chief scaled from it.
- **Props and decor** (chests, sacks, cages, pools, campfires, candles, decor): legacy pictures,
  each drawn at its own width (`size` at 16 px a cell, turned into u by `legacyU` in
  lib/world/objects.ts), so their density is their art's width ÷ that width, not a set number.
- **Wall torch:** 24 × 48 art pixels (`KIT_LIGHTS`), its flame drawn in code.

### Still undefined

Flag these when a task needs them; don't invent an answer.

1. **Square pixels for walls.** §6.1 says new art has square pixels, but the live walls (kits E/F)
   are 48 × 36 a tile, the old 4:3 shape. Is 4:3 accepted for wall kits, or must the next kit be
   square (48 × 48 a tile)? (A code/spec discrepancy.)
2. **D, the floor depth, for new art** (§4.6): open until phase 3's two in-game comparisons.
3. **When the hero, foes and today's props move to 48**, and creatures' drawn sizes from their size
   classes: "when redone", with no plan or order.
4. **The outline style and detail level** for the dungeon setting (§6.1 asks for one, written
   down): not recorded.
5. **PixelLab settings per kind of asset** (§6.1): recorded for objects (Pro Flash, the palette, a
   crop of kit E as the style image, §6.3); not for characters, creatures, tiles or decals.
6. **Art for a 3D renderer** ([rendering.md](rendering.md) §4.8): size, texel density, proportions,
   materials and lighting rules wait for the camera and geometry to be validated; 1–4 above may be
   answered differently there. Until then, this file's standards are for the 2D view.
7. **The template generator and the test room** (§6.2, §6.4): not built, so a template's size is
   worked out by hand from the projected bounds for now.
8. **The checker's contrast limit** needs an allowance for light materials (wax): not set.
