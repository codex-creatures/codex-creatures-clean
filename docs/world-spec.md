# The explorable world: technical specification (index)

The technical rules for the walkable dungeons (the Encampment's and the Cyclops's "New" runs) and
any explorable place after them. Not the battle screen, the Den, the scroll map's room view
(`chamber.ts`) or the menus. What the player experiences in a walkable run is in
[design/walkable-play.md](design/walkable-play.md) and
[design/walkable-layout.md](design/walkable-layout.md); this specification is how the world is
built underneath. Split into files on 2026-11-09; the whole file as it was, phases and approval
gates included, is in [archive/2026-11-09/world-spec.md](archive/2026-11-09/world-spec.md).

## Why it exists (approved by the user, 2026-11-07)

Generated art kept coming out inconsistent, and each new thing in the walkable rooms was patched
into several placers. Three art conventions shared one screen (the kit's pixels showed 1⅓× taller
than wide, characters 32 px a cell, props each their own size), and room contents were worked out
again from the run's seed, so code changes could move things in runs already under way. The user
wants foundations that take hundreds of assets, creatures and settings without rebuilding.

## The architecture in brief

- **Gameplay lives in world space; the renderer only reads it.** Four layers: world data
  (`lib/world/`), simulation rules (`lib/world/`, `lib/dungeon/`), a pure scene builder and the one
  shared projection (`lib/render/`), and the renderer (`components/WalkView.tsx`: frame loop, taps,
  canvas, no game rules). ✅ Built in phase 1.
- **The camera** is fixed three-quarter from the south, with no rotation, but gameplay never
  depends on it. ✅
- **World units:** 1 u = one **panel** (the floor tile, `CELL_U` 1), which is exactly 3 × 3
  **subcells**. Rooms and corridors are laid out in panels; physical sizes, placement and
  occupancy use subcells. **Walking stays on panels until the user decides otherwise.** ✅
- **Every object** has a separate footprint, clearance, world height, visual bounds, art anchor
  and interaction access, from one registry of definitions (`lib/world/objects.ts`). ✅
- **Placement:** separate kinds of space, reservations instead of "every tile reachable", fixed
  passes each on their own random numbers. ✅ (Stamps: format only.)
- **Saves:** what's placed is saved in the run, with a world version (now **8**). Old runs never
  change: they keep the rules they were made with. Migrations are idempotent; an older client never
  overwrites newer world state. ✅
- **Art:** a standard per setting, templates from the same projection, report-only checks,
  approval always in the game. 🚧 Partly built (palette and checker); see
  [world/art-pipeline.md](world/art-pipeline.md).
- **The reskin samples** (2026-11-07: three kits and two pillars, judged off-brief) are kept
  only to compare against (`public/sprites/walk/samples/`, `docs/ideas/reskin-samples-2026-11-07.png`).
  Nothing uses them.

## Files (authoritative for their subject)

Section numbers are kept inside the files, so "world-spec.md §N" in code comments still finds its
place.

| § | Subject | File |
|---|---|---|
| 1–2 | Principles; world space: units, panels and subcells, coordinates, axes, measurements, creature size classes | [world/space.md](world/space.md) |
| 3 | Object definitions, instances, the reviewed sizes | [world/objects.md](world/objects.md) |
| 4 | Projection and drawing: the camera, today's numbers, anchors, drawing order, D for new art (open) | [world/rendering.md](world/rendering.md) |
| 5 | Occupancy and placement, stamps, candles, wandering NPCs, and **placement as built, by world version** | [world/placement.md](world/placement.md) |
| 6 | Art standard and pipeline | [world/art-pipeline.md](world/art-pipeline.md) |
| 7 | Saves, migration, forward compatibility, fixtures, reviewing goldens, and **the world versions table** | [world/persistence.md](world/persistence.md) |
| 8 | Phases and acceptance (history): see below | archive, plus the files above |
| 9 | Now, later, never | [roadmap.md](roadmap.md#the-walkable-world) |
| 10 | Decisions at sign-off | [decisions.md](decisions.md#the-walkable-world) |

## §8, phases and acceptance

§8 held each phase's implementation design, acceptance tests, approval gates and play-test
investigations. It's history now, kept word for word in
[archive/2026-11-09/world-spec.md](archive/2026-11-09/world-spec.md) §8. Code comments cite its
parts ("§8 phase 2a′", "§8 2b-2 stage B"); find them there. **What they produced, as current
rules, is in [world/placement.md](world/placement.md#as-built-placement-by-world-version) and
[world/persistence.md](world/persistence.md#world-versions).** What's still to do is in
[roadmap.md](roadmap.md#the-walkable-world).

| Phase | Status |
|---|---|
| 0: the safety net (fixtures in `tests/fixtures/walk/`, goldens in `tests/golden/walk/`, 16 visual references in `tests/visual-baseline/phase0/`) | ✅ 2026-11-07 |
| 1: units, projection, definitions, the logic out of WalkView, the scene builder (milestone 1) | ✅ built 2026-11-07 (commits 44bebac … 4f2cd52) |
| 2a: saved placements (world version 1) | ✅ 2026-11-07 |
| 2a′: the foe fix, foes keep their starting spots (v2) | ✅ 2026-11-07 |
| 2b-1: the new placers (v3) | ✅ 2026-11-08 |
| 2b-2 stage A: subcell occupancy, `/lab/placement` (v4) | ✅ released 009886d, approved |
| Using things in v4 runs (the chest and stash fix) | ✅ 832891c |
| 2b-2 stage B: candles by darkness (v5), then v6, v7 and v8 | ✅ function released early (the user skipped gates 1–4); drawing, sprites and density comparison (B2–B4) not done |
| 2b-2 stage C: decor and banners in real runs | 📌 not started |
| 2c: later approved behaviour corrections | as they come |
| 3: the art standard and tools | 🚧 palette and checker built; the rest not |
| 4: the first assets to the standard | not started (kit E/F walls, the torch and candle art came ahead of it) |

**How phases are run** (from §8, still the process): each phase or stage is its own commit (or
few), tested and reviewed before the next starts; a change in play is an intended change, approved
first, in its own commit; behaviour is kept unless the user approves a change; old runs are pinned
before placement rules change.
