// lib/world/migrate.ts
// Bringing a walkable run up to this world version (docs/world-spec.md §7 and
// §8 phase 2a). One pure function, run where a run is made and where it's
// opened to be played (the Labyrinth screen), and nowhere else.
//
// It only ever fills in what's missing: a run that already has sound
// placements comes back as the same object; run state (where you stand, what
// you've seen, lit, opened, beaten) is never touched. So loading, saving and
// loading again, any number of times, changes nothing more.
//
// What it did, said every time (never silent, and never "no placements" read
// as an empty list):
// - migrated: a v0 run, given its placements;
// - unchanged: a v1 run whose placements are sound;
// - repaired: a v1 run whose placements are missing or unsound, made again
//   from scratch. Safe only while generation is today's (they come out the
//   same); from phase 2b such a run is damaged instead;
// - unsupported: a newer world version (version.ts): left exactly as it is;
// - damaged: its placements couldn't be made (a broken layout): left as it is;
// - none: not a walkable run.

import type { DungeonRun, Room } from "../dungeon/run";
import { walkRoom, type WalkRun } from "../dungeon/walkRun";
import type { DungeonMap } from "../dungeon/map";
import { legacyPlacements } from "./compat/v0";
import { placementsFrom, type Placements } from "./placements";
import { OBJECTS, type Instance } from "./objects";
import { WALK_V, unsupportedRun } from "./version";

export { WALK_V };
export type Outcome = "none" | "migrated" | "unchanged" | "repaired" | "unsupported" | "damaged";
export type Migrated = { run: DungeonRun; outcome: Outcome; problem?: string };

const WALLS = new Set(["north", "east", "west"]);
const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n);

// What's wrong with a saved `placed`, or null if it's sound: a non-empty list
// of instances, each with a string id (no two the same), a known definition, a
// room, whole-number subcells, and only known values in its optional fields.
export function placedProblem(placed: unknown): string | null {
  if (placed === undefined) return "no placements";
  if (!Array.isArray(placed)) return "placements aren't a list";
  if (placed.length === 0) return "the placement list is empty";
  const ids = new Set<string>();
  for (const [n, i] of placed.entries()) {
    const at = `placement ${n}`;
    if (!i || typeof i !== "object") return `${at} isn't an object`;
    const p = i as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id) return `${at} has no id`;
    if (ids.has(p.id)) return `${at}: id ${p.id} twice`;
    ids.add(p.id);
    if (typeof p.def !== "string" || !OBJECTS[p.def]) return `${p.id}: unknown definition ${String(p.def)}`;
    if (typeof p.room !== "string" || !p.room) return `${p.id}: no room`;
    if (!whole(p.sx) || !whole(p.sy)) return `${p.id}: subcells aren't whole numbers`;
    if (p.rot !== undefined && ![0, 1, 2, 3].includes(p.rot as number)) return `${p.id}: unknown turn`;
    if (p.wall !== undefined && !WALLS.has(p.wall as string)) return `${p.id}: unknown wall`;
    if (p.start !== undefined && p.start !== "lit") return `${p.id}: unknown starting state`;
    if (p.facing !== undefined && (typeof p.facing !== "number" || !Number.isFinite(p.facing))) return `${p.id}: unknown facing`;
    if (p.legacy !== undefined && p.legacy !== "panel") return `${p.id}: unknown legacy rule`;
  }
  return null;
}

// Placements for a walk, from what's generated in it as today's game does.
const placementsFor = (walk: WalkRun, map: DungeonMap, room: (id: string) => Room | undefined): Instance[] => legacyPlacements(walk, map, room);

export function migrateWalkRun(run: DungeonRun): Migrated {
  const walk = run.walk;
  if (!walk) return { run, outcome: "none" };
  if (unsupportedRun(run)) return { run, outcome: "unsupported", problem: `world version ${String(walk.v)}; this game reads up to ${WALK_V}` };
  const v = walk.v ?? 0;
  const problem = v >= 1 ? placedProblem(walk.placed) : null;
  if (v >= 1 && !problem) return { run, outcome: "unchanged" };
  let placed: Instance[];
  try {
    placed = placementsFor(walk, run.map, (id) => walkRoom(run, id));
  } catch (e) {
    return { run, outcome: "damaged", problem: `placements couldn't be made: ${e instanceof Error ? e.message : String(e)}` };
  }
  const outcome: Outcome = v >= 1 || walk.placed !== undefined ? "repaired" : "migrated";
  return { run: { ...run, walk: { ...walk, v: WALK_V, placed } }, outcome, ...(outcome === "repaired" ? { problem: problem ?? "a v0 run with placements in it" } : {}) };
}

// A run as it's opened to be played or made: migrated, and anything other than
// a plain migration or no change said in the console.
export function withPlacements(run: DungeonRun): Migrated {
  const m = migrateWalkRun(run);
  if (m.outcome === "repaired" || m.outcome === "unsupported" || m.outcome === "damaged") console.warn(`Walkable run ${run.id}: ${m.outcome} (${m.problem})`);
  return m;
}
// …for a run that's just been made (it can only be migrated).
export const placedRun = (run: DungeonRun): DungeonRun => withPlacements(run).run;

// What the walk screen builds a run's rooms from. Its saved placements if
// they're sound; if not (a run that somehow reached the screen without being
// opened through withPlacements), made again in memory, and said so: never an
// empty room.
export function placementsOfWalk(walk: WalkRun, map: DungeonMap, room: (id: string) => Room | undefined): Placements {
  const problem = (walk.v ?? 0) >= 1 ? placedProblem(walk.placed) : "a v0 run";
  if (!problem) return placementsFrom(walk.placed!, walk);
  console.warn(`Walk screen: ${problem}; placements made again for this visit`);
  return placementsFrom(placementsFor(walk, map, room), walk);
}

