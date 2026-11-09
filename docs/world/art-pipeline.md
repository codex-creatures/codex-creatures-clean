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
