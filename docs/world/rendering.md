# Projection and drawing

Authoritative for the camera, the projection, anchors and drawing order. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

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
