# Object definitions and sizes

Authoritative for the object registry (`lib/world/objects.ts`), instances, and the reviewed sizes. Part of the [world specification](../world-spec.md) (the walkable world's technical rules). Status tags are explained in [docs/README.md](../README.md#status-tags).

Moved here word for word from world-spec.md on 2026-11-09 (the original is in [archive/2026-11-09](../archive/2026-11-09/world-spec.md)); section numbers are kept, so references like "world-spec.md §5.4" still find their place.

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
