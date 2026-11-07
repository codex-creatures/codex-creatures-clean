// lib/world/units.ts
// The explorable world's units (docs/world-spec.md §2). Every position, size,
// height and distance in the world is in world units (u); gameplay never
// deals in pixels (that's lib/render/projection.ts).
//
// - x runs east and y south, along the floor; z is up from it (z = 0).
// - A cell is the gameplay grid (floorplan tiles, collision, paths), CELL_U
//   units across. Positions are floats, and a cell's centre is the whole
//   number: cell (3, 4) covers x 2.5–3.5, y 3.5–4.5, as walk.ts has it.
// - Facing is an angle in the floor plane: 0 east, π/2 south (foes.ts).
// - No real-world scale is assumed: "the hero is about 1.1 u tall" is a fact
//   about the hero, not a claim that a cell is a metre.
//
// At CELL_U = 1 every number already in tiles (TORCH_RADIUS, SIGHT_RANGE,
// WALK_SPEED…) is in units too, so no gameplay number changes.

export const CELL_U = 1; // units across a cell

// A point in the world: on the floor (z 0), or up from it.
export type WorldPt = { x: number; y: number; z?: number };
