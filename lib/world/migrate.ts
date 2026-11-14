// lib/world/migrate.ts
// Bringing a walkable run up to this world version (docs/world-spec.md §7 and
// §8 phases 2a and 2a′). One pure function, migrateWalkRun; the game reaches it
// only through openWalkSave (a saved run opened to be played) and placedRun (a
// run just made), and reads placements only through placementsOfWalk. A test
// (tests/migrate.test.ts) keeps it that way.
//
// It only ever fills in what's missing: a run that already has sound
// placements comes back as the same object; run state (where you stand, what
// you've seen, lit, opened, beaten) is never touched. So loading, saving and
// loading again, any number of times, changes nothing more.
//
// What it did, said every time (never silent, and never "no placements" read
// as an empty list):
// - migrated: a v0 run, given its placements and its foes' starts; a v1 run,
//   given its foes' starts (2a′: they depend on which rooms are beaten, so
//   they're what the game showed at the moment it was migrated);
// - unchanged: a v2 or v3 run whose placements are sound (a v3 run is a new
//   one, placed by phase 2b's rules, place.ts: newWalkRun; nothing migrates to it);
// - unsupported: a newer world version (version.ts): left exactly as it is;
// - damaged: a v1 or v2 run whose placements are missing or unsound (or a v0
//   run carrying some, or a v2 run missing a room's foes), or one whose
//   placements couldn't be made: left exactly as stored, never made again on
//   its own (the user, 2026-11-07). The player can ask for it to be mended
//   (recoverWalkRun): the rules that made it make it again (the old ones for
//   v0 to v2, place.ts for v3);
// - repaired: a damaged run mended, at the player's say-so;
// - none: not a walkable run.

import { dungeonOf, rollDeck, type DungeonId, type DungeonRun, type DungeonSave, type Room } from "../dungeon/run";
import { walkRoom, type WalkRun } from "../dungeon/walkRun";
import type { DungeonMap } from "../dungeon/map";
import { legacyPlacements, legacyFoePlacements } from "./compat/v0";
import { placeWalk, PLACED_V, FIRST_PLACED_V, MOUNTED_DEFS } from "./place";
import { layoutFloorplan } from "../dungeon/layout";
import { ROCK } from "../dungeon/floorplan";
import { panelOfSubcell } from "./grid";
import { placementsFrom, type Placements } from "./placements";
import { roomIds, foesToPlace } from "./walkWorld";
import { OBJECTS, type Instance } from "./objects";
import { WALK_V, unsupportedRun } from "./version";

export { WALK_V };
export type Outcome = "none" | "migrated" | "unchanged" | "repaired" | "unsupported" | "damaged";
export type Migrated = { run: DungeonRun; outcome: Outcome; problem?: string };

// The world versions whose placements the old rules (compat/v0.ts) make, and
// the newest of them: a run from before phase 2b is brought up to it, never
// to v3 (its rooms keep what it showed).
const LEGACY_V = [1, 2];
export const LEGACY_WALK_V = 2;

const WALLS = new Set(["north", "east", "west"]);
const WALLS_V3 = new Set([...WALLS, "south"]);
const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n);
// Stage B's candles, only ever placed from world version 5: a v3 or v4 run holding one is damaged, not read.
const CANDLES_V = 5, MOUNTED = new Set(MOUNTED_DEFS);
const NO_WALL_CANDLES_V = 8; // (wall torches instead: place.ts)
const TABLES_V = 12;         // (tables, and a candle standing on one)
const DECKS_V = 13;          // (a deck of cards on a table)
const SHELVES_V = 14;        // (bookcases against walls, and a storehouse's finds on its floor)
const FINDS = new Set(["dynamite", "backpack"]);

// What's wrong with a saved `placed`, or null if it's sound: a non-empty list
// of instances, each with a string id (no two the same), a known definition, a
// room, whole-number subcells, and only known values in its optional fields
// (a south wall and a placed size only from world version 3; stage B's
// candles only from 5, a mounted one on a wall, a floor one never lit to start).
export function placedProblem(placed: unknown, v = LEGACY_WALK_V): string | null {
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
    if ((MOUNTED.has(p.def) || p.def === "floor-candle") && v < CANDLES_V) return `${p.id}: a ${p.def} in a world version ${v} run`;
    if (MOUNTED.has(p.def) && v >= NO_WALL_CANDLES_V) return `${p.id}: a wall candle in a world version ${v} run (there are none from ${NO_WALL_CANDLES_V})`;
    if (MOUNTED.has(p.def) && p.wall === undefined) return `${p.id}: a mounted candle on no wall`;
    if (p.def === "floor-candle" && p.start !== undefined) return `${p.id}: a floor candle that starts lit`;
    if (p.def === "table" && v < TABLES_V) return `${p.id}: a table in a world version ${v} run`;
    if (p.holds !== undefined && (p.def !== "table" || p.holds !== "candle")) return `${p.id}: unknown thing on it`;
    if (p.deck !== undefined && (p.def !== "table" || p.deck !== true || v < DECKS_V)) return `${p.id}: a deck of cards it can't have`;
    if (((p.def === "bookcase" && p.id.startsWith("shelf:")) || FINDS.has(p.def)) && v < SHELVES_V) return `${p.id}: a ${p.def} in a world version ${v} run`;
    if (p.codex !== undefined && (p.def !== "bookcase" || p.codex !== true || v < SHELVES_V)) return `${p.id}: a codex it can't have`;
    if (!whole(p.sx) || !whole(p.sy)) return `${p.id}: subcells aren't whole numbers`;
    if (p.rot !== undefined && ![0, 1, 2, 3].includes(p.rot as number)) return `${p.id}: unknown turn`;
    if (p.wall !== undefined && !(v >= FIRST_PLACED_V ? WALLS_V3 : WALLS).has(p.wall as string)) return `${p.id}: unknown wall`;
    if (p.size !== undefined && (v < FIRST_PLACED_V || !sizeOk(p.size))) return `${p.id}: unknown size`;
    if (p.start !== undefined && p.start !== "lit") return `${p.id}: unknown starting state`;
    if (p.facing !== undefined && (typeof p.facing !== "number" || !Number.isFinite(p.facing))) return `${p.id}: unknown facing`;
    if (p.legacy !== undefined && p.legacy !== "panel") return `${p.id}: unknown legacy rule`;
    const foe = foeProblem(p);
    if (foe) return `${p.id}: ${foe}`;
  }
  return null;
}

const sizeOk = (s: unknown) => {
  const z = s as Record<string, unknown> | null;
  return !!z && typeof z === "object" && whole(z.w) && whole(z.d) && (z.w as number) >= 0 && (z.d as number) >= 0;
};

// What's wrong with a foe's saved start (or with a start on something else), or null.
function foeProblem(p: Record<string, unknown>): string | null {
  if (p.def !== "foe") return p.foe === undefined ? null : "a foe's start on something that isn't a foe";
  const f = p.foe as Record<string, unknown> | undefined;
  if (!f || typeof f !== "object") return "a foe with no start";
  const n = (p.id as string).slice(`${p.room}:foe:`.length);
  if (!(p.id as string).startsWith(`${p.room}:foe:`) || !/^\d+$/.test(n)) return "a foe's id isn't <room>:foe:<n>";
  if (f.walks !== undefined && f.walks !== true) return "unknown walks";
  if (f.waits !== undefined && f.waits !== true) return "unknown waits";
  if (f.end !== undefined && f.end !== 0 && f.end !== 1) return "unknown end";
  if (f.waits ? f.wait !== undefined : typeof f.wait !== "number" || !Number.isFinite(f.wait) || f.wait < 0) return "unknown wait";
  return null;
}

// A room still to beat whose foes' starts aren't all saved, or null. A v2 run
// must have them (a room beaten before 2a′ has none, and needs none), else its
// foes would quietly be missing.
function missingFoes(walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): string | null {
  const have = new Map<string, number>();
  for (const i of walk.placed ?? []) if (i.def === "foe") have.set(i.room, (have.get(i.room) ?? 0) + 1);
  for (const id of roomIds(walk.layout, map)) {
    const r = room(id), need = r ? foesToPlace(r, dungeon) : 0;
    if (need && have.get(id) !== need) return `${id} has ${have.get(id) ?? 0} foes saved, ${need} to beat`;
  }
  return null;
}
// (v5) A mounted candle whose subcell isn't floor, or with no stone on its wall's side, or null.
function mountedProblem(walk: WalkRun): string | null {
  const mounted = (walk.placed ?? []).filter((i) => MOUNTED.has(i.def));
  if (!mounted.length) return null;
  const fp = layoutFloorplan(walk.layout);
  const rockAt = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
  const STEP = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] } as const;
  for (const i of mounted) {
    const x = panelOfSubcell(i.sx), y = panelOfSubcell(i.sy), [dx, dy] = STEP[i.wall!];
    if (rockAt(x, y)) return `${i.id}: a mounted candle off the floor`;
    if (!rockAt(x + dx, y + dy)) return `${i.id}: a mounted candle with no stone on its ${i.wall} side`;
  }
  return null;
}
// What's wrong with a v2 or later run's placements, or null.
const v2Problem = (walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined) =>
  placedProblem(walk.placed, walk.v ?? 0) ?? mountedProblem(walk) ?? missingFoes(walk, map, dungeon, room);

// Placements for a walk, by the rules of its version: phase 2b's for a v3
// run, else the old rules as the game showed them.
const placementsFor = (walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Instance[] =>
  (walk.v ?? 0) >= FIRST_PLACED_V ? placeWalk(walk, map, dungeon, room).placed
    : [...legacyPlacements(walk, map, room), ...legacyFoePlacements(walk, map, dungeon, room)];
const roomsOf = (run: DungeonRun) => (id: string) => walkRoom(run, id);

// What's wrong with a run's placements at its version, or null.
function problemOf(run: DungeonRun): string | null {
  const walk = run.walk!, v = walk.v ?? 0;
  if (v === 0) return walk.placed !== undefined ? "a v0 run with placements in it" : null;
  return v >= 2 ? v2Problem(walk, run.map, dungeonOf(run), roomsOf(run)) : placedProblem(walk.placed, v);
}

export function migrateWalkRun(run: DungeonRun): Migrated {
  const walk = run.walk;
  if (!walk) return { run, outcome: "none" };
  if (unsupportedRun(run)) return { run, outcome: "unsupported", problem: `world version ${String(walk.v)}; this game reads up to ${WALK_V}` };
  const v = walk.v ?? 0;
  // (A legacy run never has placements; one that does isn't a legacy run, so it isn't trusted either way.)
  const problem = problemOf(run);
  if (problem) return { run, outcome: "damaged", problem };
  if (v >= 2) return { run, outcome: "unchanged" };
  return v === 1 ? withFoes(run) : made(run, "migrated");
}

const unmade = (run: DungeonRun, e: unknown): Migrated =>
  ({ run, outcome: "damaged", problem: `placements couldn't be made: ${e instanceof Error ? e.message : String(e)}` });

// The run with its placements made by the rules of its version (a v0 or v1
// run: the old ones, so it becomes LEGACY_WALK_V), or damaged if they can't be.
function made(run: DungeonRun, outcome: "migrated" | "repaired", problem?: string): Migrated {
  const walk = run.walk!;
  let placed: Instance[];
  try {
    placed = placementsFor(walk, run.map, dungeonOf(run), roomsOf(run));
  } catch (e) {
    return unmade(run, e);
  }
  const v = (walk.v ?? 0) >= FIRST_PLACED_V ? walk.v! : LEGACY_WALK_V;
  return { run: { ...run, walk: { ...walk, v, placed } }, outcome, ...(problem ? { problem } : {}) };
}

// A sound v1 run (2a) with its foes' starts added (2a′): the rest of its
// placements kept exactly as they are.
function withFoes(run: DungeonRun): Migrated {
  const walk = run.walk!;
  let foes: Instance[];
  try {
    foes = legacyFoePlacements(walk, run.map, dungeonOf(run), roomsOf(run));
  } catch (e) {
    return unmade(run, e);
  }
  return { run: { ...run, walk: { ...walk, v: LEGACY_WALK_V, placed: [...walk.placed!, ...foes] } }, outcome: "migrated" };
}

// Whether a damaged run can be mended: its placements are what's broken, and
// the rules that made them (the old ones, or phase 2b's for v3) make them
// again with the same ids and spots.
export function canRecover(run: DungeonRun | null | undefined): boolean {
  const walk = run?.walk;
  if (!run || !walk || unsupportedRun(run)) return false;
  const v = walk.v ?? 0;
  return (v === 0 || LEGACY_V.includes(v as number) || (v as number) >= FIRST_PLACED_V && (v as number) <= PLACED_V) && problemOf(run) !== null;
}

// Mending a damaged run, only when the player asks (the Labyrinth screen's
// button): its placements made again. What you've done in it is kept. (Its
// foes' starts come out as first made if no room's been beaten since; else
// as the game would have shown them now, for the rooms still to beat.)
export function recoverWalkRun(run: DungeonRun): Migrated {
  if (!canRecover(run)) return migrateWalkRun(run);
  const m = made(run, "repaired", problemOf(run)!);
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
// …for a saved run as it's played in the lab's baseline (made or migrated by the old rules).
export const placedRun = (run: DungeonRun): DungeonRun => withPlacements(run).run;

// A new walkable run, as it's made: placed by phase 2b's rules (place.ts) and
// saved at PLACED_V (world version 5). Placed once, here; a run that already has its
// placements (or a version) is left to migrateWalkRun.
export function newWalkRun(run: DungeonRun): DungeonRun {
  const walk = run.walk;
  if (!walk || walk.v !== undefined || walk.placed !== undefined) return placedRun(run);
  const m = made({ ...run, walk: { ...walk, v: PLACED_V } }, "migrated");
  if (m.outcome === "damaged") console.warn(`Walkable run ${run.id}: ${m.problem}`);
  return withFloorFinds(withDecks(m.run));
}

// (World version 14) A storehouse's rugged backpack lying on its floor: out of its stores, and on the
// room (Room.packOnFloor) till you pick it up.
function withFloorFinds(run: DungeonRun): DungeonRun {
  const walk = run.walk;
  const packs = (walk?.placed ?? []).filter((i) => i.def === "backpack" && walk!.rooms[i.room]);
  if (!walk || packs.length === 0) return run;
  const rooms = { ...walk.rooms };
  for (const p of packs) rooms[p.room] = { ...rooms[p.room], sack: (rooms[p.room].sack ?? []).filter((x) => !("backpack" in x)), packOnFloor: true };
  return { ...run, walk: { ...walk, rooms } };
}

// (World version 13) Each deck of cards lying on a table: its cards rolled now, with the run, so its
// glow shows the rarest (as a cards room's are), and kept on its room (Room.deck).
function withDecks(run: DungeonRun): DungeonRun {
  const walk = run.walk;
  const tables = (walk?.placed ?? []).filter((i) => i.def === "table" && i.deck && walk!.rooms[i.room]);
  if (!walk || tables.length === 0) return run;
  const rooms = { ...walk.rooms };
  for (const t of tables) rooms[t.room] = { ...rooms[t.room], deck: rollDeck() };
  return { ...run, walk: { ...walk, rooms } };
}

// The Labyrinth's save as it's opened to be played: a run from before phase 2a
// or 2a′ brought up to date and written back straight away (write:
// saveDungeon); a damaged one held, exactly as stored; anything else as it is.
// The one way a saved run is opened, so nothing plays an unmigrated run or
// migrates it itself.
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
export function placementsOfWalk(walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Placements {
  const v = walk.v ?? 0;
  const problem = v >= 2 ? v2Problem(walk, map, dungeon, room) : `a v${v} run`;
  if (!problem) return placementsFrom(walk.placed!, walk);
  console.warn(`Walk screen: ${problem}; placements made again for this visit`);
  return placementsFrom(placementsFor(walk, map, dungeon, room), walk);
}
