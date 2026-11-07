// lib/world/migrate.ts
// Bringing a walkable run up to this world version (docs/world-spec.md §7 and
// §8 phase 2a). One pure function, migrateWalkRun; the game reaches it only
// through openWalkSave (a saved run opened to be played) and placedRun (a run
// just made), and reads placements only through placementsOfWalk. A test
// (tests/migrate.test.ts) keeps it that way.
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
// - unsupported: a newer world version (version.ts): left exactly as it is;
// - damaged: a v1 run whose placements are missing or unsound (or a v0 run
//   carrying some), or one whose placements couldn't be made: left exactly as
//   stored, never made again on its own (the user, 2026-11-07). The player can
//   ask for it to be mended (recoverWalkRun), only where today's rules made it;
// - repaired: a damaged run mended, at the player's say-so;
// - none: not a walkable run.

import type { DungeonRun, DungeonSave, Room } from "../dungeon/run";
import { walkRoom, type WalkRun } from "../dungeon/walkRun";
import type { DungeonMap } from "../dungeon/map";
import { legacyPlacements } from "./compat/v0";
import { placementsFrom, type Placements } from "./placements";
import { OBJECTS, type Instance } from "./objects";
import { WALK_V, unsupportedRun } from "./version";

export { WALK_V };
export type Outcome = "none" | "migrated" | "unchanged" | "repaired" | "unsupported" | "damaged";
export type Migrated = { run: DungeonRun; outcome: Outcome; problem?: string };

// The world version whose placements today's rules (compat/v0.ts) make: only a
// run saved at it can have them made again (recoverWalkRun). Phase 2b's rules
// make different ones, so its runs can't be mended this way.
const LEGACY_V = 1;

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
  if (v >= 1) {
    const problem = placedProblem(walk.placed);
    return problem ? { run, outcome: "damaged", problem } : { run, outcome: "unchanged" };
  }
  // A legacy run never has placements; one that does isn't a legacy run, so it isn't trusted either way.
  if (walk.placed !== undefined) return { run, outcome: "damaged", problem: "a v0 run with placements in it" };
  return made(run, "migrated");
}

// The run with its placements made by today's rules, or damaged if they can't be.
function made(run: DungeonRun, outcome: "migrated" | "repaired", problem?: string): Migrated {
  const walk = run.walk!;
  let placed: Instance[];
  try {
    placed = placementsFor(walk, run.map, (id) => walkRoom(run, id));
  } catch (e) {
    return { run, outcome: "damaged", problem: `placements couldn't be made: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { run: { ...run, walk: { ...walk, v: WALK_V, placed } }, outcome, ...(problem ? { problem } : {}) };
}

// Whether a damaged run can be mended: its placements are what's broken, and
// today's rules made them, so making them again gives the same ids and spots.
export function canRecover(run: DungeonRun | null | undefined): boolean {
  const walk = run?.walk;
  if (!walk || unsupportedRun(run)) return false;
  const v = walk.v ?? 0;
  return (v === LEGACY_V && placedProblem(walk.placed) !== null) || (v === 0 && walk.placed !== undefined);
}

// Mending a damaged run, only when the player asks (the Labyrinth screen's
// button): its placements made again. What you've done in it is kept.
export function recoverWalkRun(run: DungeonRun): Migrated {
  if (!canRecover(run)) return migrateWalkRun(run);
  const problem = run.walk!.v ? placedProblem(run.walk!.placed)! : "a v0 run with placements in it";
  const m = made(run, "repaired", problem);
  console.warn(`Walkable run ${run.id}: ${m.outcome} at the player's say-so (${m.problem})`);
  return m;
}

// A run as it's opened to be played or made: migrated, and anything other than
// a plain migration or no change said in the console.
function withPlacements(run: DungeonRun): Migrated {
  const m = migrateWalkRun(run);
  if (m.outcome === "unsupported" || m.outcome === "damaged") console.warn(`Walkable run ${run.id}: ${m.outcome} (${m.problem})`);
  return m;
}
// …for a run that's just been made (it can only be migrated).
export const placedRun = (run: DungeonRun): DungeonRun => withPlacements(run).run;

// The Labyrinth's save as it's opened to be played: a run from before phase 2a
// given its placements and written back straight away (write: saveDungeon); a
// damaged one held, exactly as stored; anything else as it is. The one way a
// saved run is opened, so nothing plays an unmigrated run or migrates it itself.
export function openWalkSave(saved: DungeonSave, write: (s: DungeonSave) => void): DungeonSave {
  if (!saved.run?.walk) return saved;
  const m = withPlacements(saved.run);
  if (m.outcome === "damaged") return { ...saved, held: "damaged" };
  if (m.outcome !== "migrated") return saved;
  const next = { ...saved, run: m.run };
  write(next);
  return next;
}
// …and a held, damaged one mended at the player's say-so (recoverWalkRun): written back if it was.
export function recoverWalkSave(saved: DungeonSave, write: (s: DungeonSave) => void): DungeonSave {
  if (!saved.run || !canRecover(saved.run)) return saved;
  const m = recoverWalkRun(saved.run);
  if (m.outcome !== "repaired") return saved;
  const next = { ...saved, run: m.run };
  delete next.held;
  write(next);
  return next;
}

// What the walk screen builds a run's rooms from: the one place placements
// are read. Its saved placements if they're sound; if not (a run that somehow
// reached the screen without being opened through openWalkSave), made again in
// memory for this visit only, never saved, and said so: never an empty room.
export function placementsOfWalk(walk: WalkRun, map: DungeonMap, room: (id: string) => Room | undefined): Placements {
  const problem = (walk.v ?? 0) >= 1 ? placedProblem(walk.placed) : "a v0 run";
  if (!problem) return placementsFrom(walk.placed!, walk);
  console.warn(`Walk screen: ${problem}; placements made again for this visit`);
  return placementsFrom(placementsFor(walk, map, room), walk);
}

