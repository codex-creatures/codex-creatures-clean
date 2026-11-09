// lib/world/version.ts
// The world version a walkable run is saved by (WalkRun.v; docs/world-spec.md
// §7). Bumped only together with a migration to it (lib/world/migrate.ts).
// Kept apart, with no imports, so the save code (lib/dungeon/run.ts) can ask
// "is this run newer than me?" without pulling in the world's modules.
//
// 0 (or missing): placements worked out from the seed each time (before phase 2a).
// 1: what's generated in the run saved in it (`placed`), placed by today's rules.
// 2: …with each fight room's foes' starts too (phase 2a′, the foe fix).
// 3: placed by phase 2b's rules (lib/world/place.ts): new runs only. Nothing
//    migrates to it: runs saved at 1 or 2 keep what the old rules placed.
// 4: placed at things' own sizes, inside their panels (phase 2b-2 stage A): new
//    runs only; a v3 run keeps what it was made with.
// 5: candles by the room's dark (stage B): mounted on walls and pillars, and
//    floor candles as placed objects: new runs only; a v4 run keeps its own.
// 6: floor candles kept out of mounted candles' light and off the panels by
//    walls and pillars (the user's play-test, 2026-11-09): new runs only.
// 7: the candle density retuned for the smaller rooms guided layouts and the
//    Cyclops's 2-tile blocks make (2026-11-09): new runs only.
// 8: no wall candles: the same budget places wall torches on rooms' walls and
//    pillars instead (the user, 2026-11-09): new runs only.
export const WALK_V = 8;

type Versioned = { walk?: { v?: unknown } } | null | undefined;

// A run this copy of the game can't read safely: a newer world version, or a
// version that isn't one (it's left exactly as it is, never "fixed").
export function unsupportedRun(run: Versioned): boolean {
  const v = run?.walk?.v;
  if (v === undefined) return false;
  return typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > WALK_V;
}
