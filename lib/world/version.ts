// lib/world/version.ts
// The world version a walkable run is saved by (WalkRun.v; docs/world-spec.md
// §7). Bumped only together with a migration to it (lib/world/migrate.ts).
// Kept apart, with no imports, so the save code (lib/dungeon/run.ts) can ask
// "is this run newer than me?" without pulling in the world's modules.
//
// 0 (or missing): placements worked out from the seed each time (before phase 2a).
// 1: what's generated in the run saved in it (`placed`), placed by today's rules.
export const WALK_V = 1;

type Versioned = { walk?: { v?: unknown } } | null | undefined;

// A run this copy of the game can't read safely: a newer world version, or a
// version that isn't one (it's left exactly as it is, never "fixed").
export function unsupportedRun(run: Versioned): boolean {
  const v = run?.walk?.v;
  if (v === undefined) return false;
  return typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > WALK_V;
}
