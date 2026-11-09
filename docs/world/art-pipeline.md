# Art standard and pipeline

Authoritative for the walkable world's art spec, templates, checks and approval. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

## 6. Art standard and pipeline

### 6.1 The art spec (one per setting: "the dungeon" first)

> ⚠️ §6.3 records that art density is now **48** art pixels a unit for new art (kit E, the user, 2026-11-09), not the 32 below; you and the older objects stay at 32 till they are redone.

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
