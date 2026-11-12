// lib/world/place.ts
// Where things go in a new walkable run (docs/world-spec.md §5.3, §8 phases
// 2b-1 and 2b-2): world version 6 (stage B, floor candles fixed), or 5 (stage
// B), 4 (stage A) or 3 (2b-1) for a run made then.
// Each version's rules give exactly what they gave (v3: tests/placeV3.test.ts;
// v4: tests/placeV4Pinned.test.ts). Version 5 (stage B, new runs from
// 2026-11-08) adds the candle budget, candles on walls' and pillars' faces,
// and floor candles as placed objects (version 8, the user, 2026-11-09: no wall
// candles; the same budget places wall torches instead). Version 6 (the user's play-test,
// 2026-11-09) keeps floor candles out of the mounted candles' light and off
// the panels by walls and pillars (candles there are the mounted ones).
//
// Version 3: every floor thing takes its whole panel, at its middle.
// Version 4: things take their own footprints (§3 "Sizes"), sitting in their
// panels where suits them (storage leaning to the nearest wall, things used
// from the front at the back); things whose footprints don't meet may share a
// panel; each thing's clearance is kept; candles keep today's spots, at
// subcell level; a creature's size class checks there's floor round where it
// starts. While walking is on panels the generator also keeps to the temporary
// policies in policy.ts (one solid thing a panel, inside it).
//
// Made once, when the run is made, and saved in it
// (WalkRun.placed); never made again unless the player asks for a damaged run
// to be mended, which gives the same list. Runs from before keep what the old
// rules placed (lib/world/compat/v0.ts).
//
// The passes, in order, every one through the same occupancy rules
// (occupancy.ts), so nothing here keeps its own list of what to avoid:
// 0. what the run already holds: pillars (rock in the layout) and campfires
//    (rolled as the run starts, `fires`), each keeping candles a little away;
// 1. reserve: each room's doors, the spots its things must stand at (its
//    middle, the cages, a waiting boss's stand, a guarded chest's spot), and a
//    path from its doors to each other and to every one of those;
// 2. stamps: none yet (§5.5);
// 3. structure: the pillars, already marked;
// 4. things you use: a room's feature at its middle, a large room's stores,
//    the merchant and the librarian, a camp's cages along its top;
// 5. attachment slots: wall torches, as many and where today's rules put them;
//    (v5) 5b: each room's candle budget, then its mounted candles, in the slots
//    lighting the most of what's still dark;
// 6. floor lights: a candle now and then, kept away from campfires; (v5) floor
//    candles, as many as the room's size and kind give, off the things you use;
// 7. spawns: every fight room's foes (an ambush's too) and the card witch,
//    never on something placed or a kept spot, and only where you can get to.
// (8, decor, is the lab's only for now; 9, worn floor, is worked out from the seed.)
//
// Each room's pass has its own random numbers (run seed, room, pass), so a
// room's foes never depend on another room, or on what's been beaten.
// Optional things (a candle) try every valid spot, in a random order, before
// they're left out; required things (a room's feature, a cage, a boss) go to
// the nearest valid panel if theirs is taken, and are reported if none is.
// Every search is over a finite list, so none can loop.

import { roomCentre, layoutFloorplan } from "../dungeon/layout";
import { ROCK, type Floorplan, type Pt, type Rect } from "../dungeon/floorplan";
import {
  SCONCE_EVERY, TUNNEL_SCONCE_CHANCE, SCONCE_LIT_SHARE, CANDLE_CHANCE, CANDLE_NEAR, CANDLE_CLEAR, SCONCE_RADIUS, CANDLE_RADIUS, torchLit,
  DARK_PER, FLOOR_PER, DARK_PER_V7, FLOOR_PER_V7, MOUNTED_CAP, FLOOR_CANDLE_CAP, CANDLE_MIN_DARK, DARK_KEPT, LIGHT_GAP, FLOOR_KEEP_OFF, FLOOR_BY_STONE,
  CANDLE_GROUP, CANDLE_WEIGHT, MOUNTED_LIT, PILLAR_LIT, type CandleGroup,
} from "../dungeon/torch";
import { CAMPFIRE_LIGHT, EMBER_LIGHT } from "../dungeon/campfire";
import { FOE_GAP, DOOR_CLEAR, WANDER_SHARE, LOOK_TIME, WAIT_FROM_TOP, endOf, spawnOf, parentOf } from "../dungeon/foes";
import { CAGE_GAP, waitsHere, bookcaseOf, bookcasesIn, type WalkRun } from "../dungeon/walkRun";
import { hasFight, fightContainer, type DungeonId, type Room } from "../dungeon/run";
import type { DungeonMap } from "../dungeon/map";
import { seeded, roomIds, fightsLater, guardedChestSpot } from "./walkWorld";
import { subcellOfPanel, panelOfSubcell, footprintPanels, footprintCells, SUBCELLS } from "./grid";
import { creatureSize, sizeClassOf } from "./creatures";
import { objectDef, type Instance, type FoeStart } from "./objects";
import {
  newOccupancy, markStone, reserve, keepClear, canPlace, take, isFloor, slotKey, slotFree, takeSlot, panelKey, roomFor, panelCells,
  attachmentSlots, slotLightCell, occupant, type Occupancy, type Wall, type Slot,
} from "./occupancy";
import { navBlocked, canStand, oneSolidPerPanel, claimedBy, claim, type PanelClaims } from "./policy";

export const FIRST_PLACED_V = 3;    // the first world version placed by these rules (2b-1)
export const PLACED_V = 13;         // the world version a new run is placed at (a deck of cards on some tables; version.ts)
// (v12) Tables (the user, 2026-11-11): the chance a room has one (rooms of these kinds, not the
// entrance or the boss's), and that one has a candle on it. A cards room's deck stands on a table of its own. 🧪
export const TABLE_CHANCE = 0.25;
export const TABLE_CANDLE = 0.7;
// (v13) …and that a deck of cards lies on it (the user, 2026-11-13: no more cards rooms in the walkable Labyrinth).
export const TABLE_DECK = 0.05;
export const TABLE_ROOMS = new Set(["easy", "hard", "miniboss", "chest", "stash", "pool", "campfire", "treasure", "merchant", "librarian", "library", "witch", "storehouse", "encampment"]);
const TABLE_PASS = 61;              // (v12) the tables' own random numbers, so nothing else can move
export const BOOKCASE_DOOR_GAP = 2;  // (v10) panels: no broken bookcase this close to the panel inside a door (either way)
// Spawn clearance by size class (§3): subcells round a big creature's footprint kept free of solid things.
export const SPAWN_CLEARANCE: Partial<Record<string, number>> = { large: 1, huge: 1 };
export const CANDLE_FIRE_GAP = 2;   // panels a candle keeps from a campfire (today's "hidden by the fire" distance)
const MOUNTED_PASS = 51;            // (v5) pass 5b's own random numbers, so the torches (5) can't move

export type PlaceNote = { id: string; room: string; what: string };
export type PlaceReport = {
  moved: PlaceNote[];      // a required thing put on the nearest valid panel, its own being taken
  omitted: PlaceNote[];    // an optional thing with no valid spot, left out
  problems: PlaceNote[];   // a required thing or path with nowhere to go (the tests fail on any)
  rejected: (PlaceNote & { sx: number; sy: number })[]; // spots tried and refused, with why (the debugging view; v4)
};

type Rng = () => number;
type Sub = { sx: number; sy: number };
const anchorOf = (p: Pt): Sub => ({ sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) });
const AROUND: Pt[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
const STEPS: Pt[] = AROUND.slice(0, 4);
const WAYS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const between = (rng: Rng, [lo, hi]: [number, number]) => lo + rng() * (hi - lo);
const inRects = (rs: Rect[], p: Pt) => rs.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);

// A room's pass's random numbers: its own stream from (run seed, room, pass).
export function passRng(seed: number, key: string, pass: number): Rng {
  let h = 2166136261;
  for (const ch of `${seed}|${key}|${pass}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return seeded(((h >>> 0) % 2147483646) + 1);
}

// The feature a room shows at its middle (walkWorld.ts thingsOf shows it), by its kind.
function featureOf(r: Room): { key: string; def: string } | null {
  switch (r.kind) {
    case "chest": case "treasure": return { key: "chest", def: "chest" };
    case "stash": return { key: "sack", def: "sack" };
    case "pool": return { key: "pool", def: "pool" };
    case "cards": return { key: "card-deck", def: "card-deck" };
    case "merchant": return { key: "merchant", def: "merchant" };
    case "librarian": return { key: "librarian", def: "librarian" };
    // (A library has its librarian, or codexes lying about: never both.)
    case "library": return r.lectern ? { key: "lectern", def: "lectern" } : r.librarian ? { key: "librarian", def: "librarian" } : { key: "stores", def: "sack" };
    case "storehouse": return { key: "stores", def: "rickety-chest" };
    default: return null;
  }
}

// Where a camp's cages stand: a row along the top of its room, CAGE_GAP apart.
function cageRow(floors: Rect[], count: number): Pt[] {
  if (count === 0) return [];
  const top = floors.reduce((a, b) => (b.y < a.y ? b : a));
  const mid = top.x + Math.floor(top.w / 2);
  const gap = Math.min(CAGE_GAP, Math.floor((top.w - 2) / Math.max(1, count)));
  return Array.from({ length: count }, (_, i) => ({ x: mid + Math.round((i - (count - 1) / 2) * gap), y: top.y + 1 }));
}
// (v10) A library's broken bookcases: the cages' row, each moved to the nearest panel clear of the
// doorways (BOOKCASE_DOOR_GAP) and of the bookcases before it, so none stands in front of a tunnel.
function bookcaseRow(floors: Rect[], count: number, doors: Pt[]): Pt[] {
  const out: Pt[] = [];
  const near = (a: Pt, b: Pt, gap: number) => Math.abs(a.x - b.x) <= gap && Math.abs(a.y - b.y) <= gap;
  for (const want of cageRow(floors, count)) {
    const at = byDistance(floors, want).find((p) => !doors.some((d) => near(p, d, BOOKCASE_DOOR_GAP)) && !out.some((q) => near(p, q, 1)));
    out.push(at ?? want);
  }
  return out;
}
// A waiting boss's stand: the middle of its room's top floor, WAIT_FROM_TOP down.
function standOf(floors: Rect[]): Pt {
  const top = floors.reduce((a, b) => (b.y < a.y ? b : a));
  return { x: top.x + Math.floor(top.w / 2), y: Math.min(top.y + WAIT_FROM_TOP, top.y + top.h - 1) };
}

// A room's floor panels, nearest `from` first (then north to south, west to
// east): the finite list every "somewhere else" search walks.
function byDistance(floors: Rect[], from: Pt): Pt[] {
  const seen = new Set<string>(), out: Pt[] = [];
  for (const r of floors) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (!seen.has(`${x},${y}`)) { seen.add(`${x},${y}`); out.push({ x, y }); }
  }
  const d = (p: Pt) => Math.hypot(p.x - from.x, p.y - from.y);
  return out.sort((a, b) => d(a) - d(b) || a.y - b.y || a.x - b.x);
}

// The panels just inside a room's doors.
function doorsInside(o: Occupancy, floors: Rect[], room: string): Pt[] {
  const out: Pt[] = [];
  for (const d of o.fp.doors) if (d.room === room) for (const s of STEPS) {
    const p = { x: d.x + s.x, y: d.y + s.y };
    if (inRects(floors, p) && isFloor(o, p) && !out.some((q) => q.x === p.x && q.y === p.y)) out.push(p);
  }
  return out;
}

// The shortest way (four ways, panel to panel) through a room's open floor
// from one panel to the nearest of `to`, avoiding `blocked`; null if none.
function pathIn(o: Occupancy, floors: Rect[], from: Pt, to: Pt[], blocked: Set<string>): Pt[] | null {
  const goal = new Set(to.map(panelKey));
  const prev = new Map<string, string | null>([[panelKey(from), null]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (goal.has(panelKey(at))) {
      const out: Pt[] = [];
      for (let k: string | null = panelKey(at); k; k = prev.get(k)!) { const [x, y] = k.split(",").map(Number); out.push({ x, y }); }
      return out.reverse();
    }
    for (const s of STEPS) {
      const n = { x: at.x + s.x, y: at.y + s.y };
      if (prev.has(panelKey(n)) || !inRects(floors, n) || navBlocked(o, n) || blocked.has(panelKey(n))) continue;
      prev.set(panelKey(n), panelKey(at));
      queue.push(n);
    }
  }
  return null;
}

// Every panel of a room you can walk to from its doors, as things stand.
export function reachableIn(o: Occupancy, floors: Rect[], room: string): Set<string> {
  const seen = new Set<string>();
  const queue = doorsInside(o, floors, room).filter((p) => !navBlocked(o, p));
  for (const p of queue) seen.add(panelKey(p));
  while (queue.length) {
    const at = queue.shift()!;
    for (const s of STEPS) {
      const n = { x: at.x + s.x, y: at.y + s.y };
      if (seen.has(panelKey(n)) || !inRects(floors, n) || navBlocked(o, n)) continue;
      seen.add(panelKey(n));
      queue.push(n);
    }
  }
  return seen;
}

// A room's required spots (pass 1): each with what it's kept for, and whether
// what stands there is solid (so paths go up beside it, not onto it).
type Point = { at: Pt; owner: string; room: string; def?: string; solid: boolean };
function pointsOf(layoutRoom: WalkRun["layout"]["rooms"][string], floors: Rect[], id: string, r: Room, dungeon: DungeonId, walk: WalkRun): Point[] {
  const out: Point[] = [];
  const f = featureOf(r);
  if (f) out.push({ at: roomCentre(layoutRoom), owner: `${id}:${f.key}`, room: id, def: f.def, solid: objectDef(f.def).collision === "solid" });
  cageRow(floors, r.cages?.length ?? 0).forEach((at, i) => out.push({ at, owner: `${id}#${i}`, room: id, def: "cage", solid: true }));
  if (waitsHere(r, dungeon)) out.push({ at: standOf(floors), owner: `${id}:foe:0`, room: id, solid: false });
  // (v11) A guarded storehouse's guard keeps the storehouse's chest (its stores, above): no second spot.
  const ownChest = r.kind === "storehouse" && (walk.v ?? PLACED_V) >= 11;
  if ((hasFight(r) || fightsLater(r)) && fightContainer(r, dungeon) !== "sack" && !ownChest) out.push({ at: guardedChestSpot(walk.layout, id, r, dungeon), owner: `${id}:loot`, room: id, solid: false });
  return out;
}

// How many foes a room starts with (when the run's made, nothing's beaten):
// a waiting boss, or one for each of its enemies (an ambush's too).
const foeCount = (r: Room, dungeon: DungeonId) => (waitsHere(r, dungeon) ? 1 : hasFight(r) || fightsLater(r) ? r.enemies?.length ?? 0 : 0);

// Where a thing may sit inside panel p (v4), best first: inside the panel,
// leaning to the nearest wall (storage favours walls and corners, the user,
// 2026-11-08); a thing used from the front (a front clearance) keeps to the
// back rows. A thing filling the panel has one spot, its middle.
function spotsIn(fp: Floorplan, def: ReturnType<typeof objectDef>, p: Pt): Sub[] {
  const { w, d } = def.footprint, c = anchorOf(p);
  const out: Sub[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const at = { sx: c.sx + dx, sy: c.sy + dy };
    if (footprintPanels(at, { w, d }).length === 1) out.push(at);
  }
  const rockAt = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
  // How near a wall the footprint's middle sits (the nearest rock panel within 3, by its distance).
  const nearWall = (at: Sub) => {
    const cells = footprintCells(at, { w, d });
    const mx = cells.reduce((a, q) => a + q.sx, 0) / cells.length / SUBCELLS, my = cells.reduce((a, q) => a + q.sy, 0) / cells.length / SUBCELLS;
    let best = Infinity;
    for (let y = p.y - 3; y <= p.y + 3; y++) for (let x = p.x - 3; x <= p.x + 3; x++) if (rockAt(x, y)) best = Math.min(best, Math.hypot(x - mx, y - my));
    return best;
  };
  const back = (at: Sub) => (def.clearFront ? at.sy : 0);
  return out.sort((a, b) => back(a) - back(b) || nearWall(a) - nearWall(b) || a.sy - b.sy || a.sx - b.sx);
}

// (v5) A room's candle budget as it was worked out (docs/world-spec.md §8
// stage B): never saved, only what it placed is. For the debugging view and the sim.
export type CandleBudget = {
  room: string; kind: string; group: CandleGroup; large: boolean;
  floor: number;       // its floor panels
  dark: number;        // D: those no torch (all counted lit) or campfire reaches
  weight: number;      // W, by its kind
  expected: number;    // E = W × D ÷ DARK_PER (DARK_PER_V7 from v7)
  wanted: number;      // E rolled (its whole part, and one more by a chance of what's left), capped
  mounted: number;     // placed (the slots may run out first)
  darkLeft: number;    // dark panels left once they're in
  floorExpected: number; floorWanted: number; floorPlaced: number;
};
// (v5) The run's light as the budget saw it: each room's panels left dark by
// its fixed lights, and which panels each mounted candle then lit.
export type Lighting = { budgets: CandleBudget[]; dark: Set<string>; candleLit: Map<string, string> };
export type Placed = { placed: Instance[]; report: PlaceReport; occupancy: Occupancy; lighting?: Lighting };

// (v5) How many candles a room gets from what it expects (E): E's whole part, and one more
// if the roll (0 to 1) is under what's left, capped. E 0.3: a 30% chance of one; E 1.4: one, and a
// 40% chance of a second.
export const candleCount = (expected: number, cap: number, roll: number) =>
  Math.min(cap, Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0));
// Which definition a mounted candle on this face is (how it's seen from the south, §4.1).
export const mountedDef = (wall: Wall) => (wall === "north" ? "candle-wall" : wall === "south" ? "candle-wall-south" : "candle-wall-side");
export const MOUNTED_DEFS = ["candle-wall", "candle-wall-side", "candle-wall-south"];

// Everything placed in a new walkable run, with what had to move or be left
// out, and the occupancy map as it ended (for the tests and a debugging view).
export function placeWalk(walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Placed {
  const layout = walk.layout, fp: Floorplan = layoutFloorplan(layout);
  const v = walk.v ?? PLACED_V, v4 = v >= 4, v5 = v >= 5, v6 = v >= 6;
  // (v7) the density dials for the smaller rooms (torch.ts).
  const darkPer = v >= 7 ? DARK_PER_V7 : DARK_PER, floorPer = v >= 7 ? FLOOR_PER_V7 : FLOOR_PER;
  // (v8) The budget's lights are wall torches, not candles (the user, 2026-11-09: wall candles no
  // longer exist): a torch's reach, a torch's definition and id, never on a south wall (no art
  // for one seen from behind).
  const v8 = v >= 8, mountedReach = v8 ? SCONCE_RADIUS : CANDLE_RADIUS;
  const o = newOccupancy(fp, v4);
  // (v3: every floor thing claims its whole panel, the policy it was placed by.)
  const claims: PanelClaims | null = v4 ? null : new Map();
  const placed: Instance[] = [];
  const report: PlaceReport = { moved: [], omitted: [], problems: [], rejected: [] };
  // Whether a floor thing may go here: the occupancy map, then the policy its version was placed by.
  // (v4) Refusals are kept, with why, for the debugging view.
  const tryAt = (def: ReturnType<typeof objectDef>, at: Sub, id: string, room: string): boolean => {
    const why = canPlace(o, def, at, id) ?? (v4 ? oneSolidPerPanel(o, def, at, def.footprint) : claimedBy(claims, footprintPanels(at, def.footprint)));
    if (why && v4) report.rejected.push({ id, room, what: why, ...at });
    return !why;
  };
  const put = (def: ReturnType<typeof objectDef>, at: Sub, id: string) => { take(o, def, at, id); claim(claims, footprintPanels(at, def.footprint), id); };
  const parents = Object.keys(layout.rooms).sort();
  const floorsOf = (id: string) => fp.rooms[parentOf(id)];

  // 0. What the run holds already: pillars, and campfires (each keeping candles off).
  for (const id of parents) for (const r of fp.rooms[id]) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (fp.tiles[y * fp.w + x] === ROCK) markStone(o, { x, y });
  }
  const fire = objectDef("campfire");
  for (const [n, f] of (walk.fires ?? []).entries()) {
    const at = anchorOf(f);
    if (canPlace(o, fire, at, `fire:${n}`)) report.problems.push({ id: `fire:${n}`, room: f.room, what: `a campfire ${canPlace(o, fire, at, `fire:${n}`)}` });
    put(fire, at, `campfire:${f.room}`);
    keepClear(o, f, CANDLE_FIRE_GAP, ["light"], `campfire:${f.room}`);
  }

  // 1. Reserve: doors, each room's spots, and the paths to them.
  const pointsBy = new Map<string, Point[]>();
  for (const id of parents) {
    const floors = fp.rooms[id];
    const points = roomIds(layout, map).filter((k) => parentOf(k) === id).flatMap((k) => {
      const r = room(k);
      return r ? pointsOf(layout.rooms[id], floors, k, r, dungeon, walk) : [];
    });
    // (v9) A library's broken bookcases, in a row along its top; a campfire's stash beside the fire.
    if (v >= 9) {
      const n = bookcasesIn(map, id).length;
      (v >= 10 ? bookcaseRow(floors, n, doorsInside(o, floors, id)) : cageRow(floors, n)).forEach((at, i) => {
        const bid = bookcaseOf(id, i);
        if (room(bid)) points.push({ at, owner: `${bid}:bookcase`, room: bid, def: "bookcase", solid: true });
      });
      const r = room(id), f = (walk.fires ?? []).find((q) => q.room === id);
      if (r?.kind === "campfire" && r.sack && f) points.push({ at: { x: Math.round(f.x) + 2, y: Math.round(f.y) }, owner: `${id}:sack`, room: id, def: "sack", solid: true });
    }
    pointsBy.set(id, points);
    const doors = doorsInside(o, floors, id);
    for (const d of doors) reserve(o, d, "door");
    for (const p of points) reserve(o, p.at, "point", p.owner);
    const blocked = new Set(points.filter((p) => p.solid).map((p) => panelKey(p.at)));
    const keep = (from: Pt, to: Pt[], what: string) => {
      const way = pathIn(o, floors, from, to, blocked);
      if (!way) report.problems.push({ id, room: id, what: `no way ${what}` });
      else for (const q of way) reserve(o, q, "path");
    };
    for (let a = 0; a < doors.length; a++) for (let b = a + 1; b < doors.length; b++) keep(doors[a], [doors[b]], "between its doors");
    for (const p of points) {
      const beside = p.solid ? AROUND.map((s) => ({ x: p.at.x + s.x, y: p.at.y + s.y })) : [p.at];
      if (doors.length) keep(doors[0], beside, `to ${p.owner}`);
    }
  }

  // 4. Things you use, each at the spot kept for it (or the nearest valid panel).
  const required = (id: string, def: string, want: Pt, floors: Rect[], extra: Partial<Instance> = {}) => {
    const d = objectDef(def), room = extra.room ?? "";
    let at: Sub | null = null, panel: Pt | null = null;
    for (const p of byDistance(floors, want)) {
      at = (v4 ? spotsIn(fp, d, p) : [anchorOf(p)]).find((a) => tryAt(d, a, id, room)) ?? null;
      if (at) { panel = p; break; }
    }
    if (!at || !panel) { report.problems.push({ id, room, what: `nowhere for ${def}: ${canPlace(o, d, anchorOf(want), id)}` }); return; }
    if (panel.x !== want.x || panel.y !== want.y) report.moved.push({ id, room, what: `${canPlace(o, d, anchorOf(want), id)}; to ${panel.x},${panel.y}` });
    put(d, at, id);
    placed.push({ id, def, room: extra.room!, ...at, size: { ...d.footprint }, ...extra });
  };
  for (const id of parents) for (const p of pointsBy.get(id)!) {
    if (!p.def) continue;
    required(p.owner, p.def, p.at, fp.rooms[id], { room: p.room });
  }

  // 5. Wall torches, in the attachment slots: along each room's top wall, one every SCONCE_EVERY panels;
  // some tunnels have theirs too. Which start lit, rolled room by room.
  const wallAt = (p: Pt, wall: Wall) => (wall === "north" ? { x: p.x, y: p.y - 1 } : wall === "west" ? { x: p.x - 1, y: p.y } : wall === "east" ? { x: p.x + 1, y: p.y } : { x: p.x, y: p.y + 1 });
  const rock = (p: Pt) => p.x < 0 || p.y < 0 || p.x >= fp.w || p.y >= fp.h || fp.tiles[p.y * fp.w + p.x] === ROCK;
  const torch = (id: string, room: string, p: Pt, wall: Wall, lit: boolean) => {
    const key = slotKey(p, wall);
    if (!slotFree(o, key) || !rock(wallAt(p, wall)) || rock(p)) return false;
    takeSlot(o, key, id);
    placed.push({ id, def: wall === "north" ? "sconce" : "sconce-side", room, ...anchorOf(p), wall, ...(lit ? { start: "lit" as const } : {}) });
    return true;
  };
  for (const id of parents) {
    const rng = passRng(walk.seed, id, 5);
    let k = 0;
    const mine: Pt[] = [];
    for (const r of fp.rooms[id]) {
      const spots: number[] = [];
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) if ([-1, 0, 1].every((dx) => rock({ x: x + dx, y: r.y - 1 }))) spots.push(x);
      if (spots.length === 0) continue;
      const n = Math.max(1, Math.round(r.w / SCONCE_EVERY));
      for (let i = 0; i < n; i++) {
        const x = spots[Math.min(spots.length - 1, Math.floor(((i + 0.5) / n) * spots.length))];
        if (mine.some((s) => Math.abs(s.x - x) < 3 && s.y === r.y)) continue;
        if (torch(`${id}:${k}`, id, { x, y: r.y }, "north", id === layout.start || rng() < SCONCE_LIT_SHARE)) { k++; mine.push({ x, y: r.y }); }
      }
    }
  }
  for (const key of Object.keys(fp.tunnels).sort()) {
    if (passRng(walk.seed, key, 5)() >= TUNNEL_SCONCE_CHANCE) continue;
    const ts = fp.tunnels[key];
    const x0 = Math.min(...ts.map((q) => q.x)), x1 = Math.max(...ts.map((q) => q.x));
    const y0 = Math.min(...ts.map((q) => q.y)), y1 = Math.max(...ts.map((q) => q.y));
    const up = y1 - y0 > x1 - x0;
    const from = (up ? y0 : x0) + 2, to = (up ? y1 : x1) - 2;
    if (to < from) continue;
    const n = Math.max(1, Math.round((to - from + 1) / SCONCE_EVERY));
    let m = 0;
    for (let i = 0; i < n; i++) {
      const along = from + Math.floor(((i + 0.5) / n) * (to - from + 1));
      const [p, wall]: [Pt, Wall] = up ? (i % 2 === 0 ? [{ x: x0, y: along }, "west"] : [{ x: x1, y: along }, "east"]) : [{ x: along, y: y0 }, "north"];
      if (torch(`${key}:${m}`, key, p, wall, false)) m++;
    }
  }

  // 5b. (v5) Each room's candle budget, then its mounted candles.
  const candlesIn = new Map<string, number>();
  // The room's first candle of either kind is candle:<room>, as today; any more :1, :2….
  const nextCandle = (room: string) => { const n = candlesIn.get(room) ?? 0; return n ? `candle:${room}:${n}` : `candle:${room}`; };
  const countCandle = (room: string) => { candlesIn.set(room, (candlesIn.get(room) ?? 0) + 1); };
  const mountedAt: Pt[] = [];
  // A room's floor panels (not its pillars), north to south, west to east.
  const roomPanels = (rects: Rect[]): Pt[] => {
    const seen = new Set<string>(), out: Pt[] = [];
    for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!seen.has(`${x},${y}`) && !rock({ x, y })) { seen.add(`${x},${y}`); out.push({ x, y }); }
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  };
  // Each pillar in a room (its stone panels, touching), named by its first panel.
  const pillarsIn = (rects: Rect[]): Map<string, string> => {
    const of = new Map<string, string>();
    for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!rock({ x, y }) || of.has(`${x},${y}`)) continue;
      const name = `${x},${y}`, queue = [{ x, y }];
      of.set(name, name);
      while (queue.length) {
        const at = queue.shift()!;
        for (const st of STEPS) {
          const n = { x: at.x + st.x, y: at.y + st.y };
          if (!of.has(panelKey(n)) && inRects(rects, n) && rock(n)) { of.set(panelKey(n), name); queue.push(n); }
        }
      }
    }
    return of;
  };
  // Something solid stands right in front of this slot (a chest, a cart, a cage), so it couldn't be seen or lit.
  const solidInFront = (sl: Slot): boolean => {
    const c = slotLightCell(sl), d = sl.wall === "north" ? [0, 1] : sl.wall === "south" ? [0, -1] : sl.wall === "west" ? [1, 0] : [-1, 0];
    return [0, 1].some((k) => occupant(o, "blocking", { sx: c.sx + d[0] * k, sy: c.sy + d[1] * k }) !== undefined);
  };
  const mountedCandles = (): Lighting => {
    const budgets: CandleBudget[] = [], dark = new Set<string>(), candleLit = new Map<string, string>();
    // The fixed lights: every wall torch counted lit (whether it starts lit is a roll the budget mustn't
    // depend on), and the campfires as they start. Your own torch goes with you, so it isn't counted.
    const lit = new Uint8Array(fp.w * fp.h);
    const shine = (p: Pt, r: number) => { const a = torchLit(fp, p, r); for (let i = 0; i < a.length; i++) if (a[i]) lit[i] = 1; };
    const lights: Pt[] = [];
    for (const i of placed) if (i.def === "sconce" || i.def === "sconce-side") {
      const p = { x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) };
      shine(p, SCONCE_RADIUS); lights.push(p);
    }
    for (const f of walk.fires ?? []) { shine(f, f.left > 0 ? CAMPFIRE_LIGHT : EMBER_LIGHT); lights.push(f); }
    // Each candle's light, worked out once for its floor panel (every slot on a panel lights the same).
    const glow = new Map<string, Uint8Array>();
    const glowOf = (p: Pt) => { let a = glow.get(panelKey(p)); if (!a) { a = torchLit(fp, p, mountedReach); glow.set(panelKey(p), a); } return a; };
    const slots = attachmentSlots(fp);
    for (const id of parents) {
      const r = room(id), kind = r?.kind ?? "", group = CANDLE_GROUP[kind] ?? "none", weight = CANDLE_WEIGHT[group];
      const rects = fp.rooms[id], large = layout.rooms[id].shape === "large";
      const panels = roomPanels(rects), isDark = new Set(panels.filter((p) => !lit[p.y * fp.w + p.x]).map(panelKey));
      for (const k of isDark) dark.add(k);
      const D = isDark.size, expected = (weight * D) / darkPer;
      const rng = passRng(walk.seed, id, MOUNTED_PASS);
      const wanted = candleCount(expected, MOUNTED_CAP[large ? 1 : 0], rng());
      const budget: CandleBudget = { room: id, kind, group, large, floor: panels.length, dark: D, weight, expected, wanted, mounted: 0, darkLeft: D, floorExpected: 0, floorWanted: 0, floorPlaced: 0 };
      budgets.push(budget);
      if (!wanted) continue;
      const rectOf = (p: Pt) => rects.findIndex((q) => inRects([q], p));
      const pillarOf = pillarsIn(rects);
      const usedPillars = new Set<string>(), inRect = rects.map(() => 0);
      const tieOf = (key: string) => passRng(walk.seed, `${id}|${key}`, MOUNTED_PASS)();
      // The room's own faces (walls and pillars; not its tunnels'), clear of doors, with nothing solid in front.
      const mine = slots.filter((sl) => inRects(rects, sl.floor) && o.reserved.get(panelKey(sl.floor))?.why !== "door" && !solidInFront(sl) && !(v8 && sl.wall === "south"));
      // (v8) The room's torches so far, so a new one takes the next id.
      let torchesHere = placed.filter((i) => i.room === id && (i.def === "sconce" || i.def === "sconce-side")).length;
      for (let n = 0; n < wanted; n++) {
        const darkRects = rects.map((_, k) => panels.filter((p) => rectOf(p) === k && isDark.has(panelKey(p))).length >= CANDLE_MIN_DARK);
        const unlitDark = darkRects.some((d, k) => d && inRect[k] === 0);
        let best: { sl: Slot; gain: number } | null = null;
        for (const sl of mine) {
          if (!slotFree(o, sl.key)) continue;
          if (lights.some((q) => Math.hypot(q.x - sl.floor.x, q.y - sl.floor.y) < LIGHT_GAP)) continue;
          if (sl.kind === "pillar" && usedPillars.has(pillarOf.get(panelKey(sl.rock)) ?? "")) continue;
          // (A dog-leg) no second candle in a rectangle till each dark rectangle has one.
          if (rects.length > 1 && unlitDark && inRect[rectOf(sl.floor)] > 0) continue;
          const g = glowOf(sl.floor);
          let gain = 0;
          for (const p of panels) if (g[p.y * fp.w + p.x] && isDark.has(panelKey(p))) gain++;
          if (gain < CANDLE_MIN_DARK || (isDark.size - gain) / panels.length < DARK_KEPT) continue;
          // The most still dark lit; ties: a wall's slot over a pillar's, then by a hash of the slot (fixed for
          // the run, but not always the west or north one, as ordering by its key would be).
          const better = !best || gain > best.gain || (gain === best.gain && (sl.kind !== best.sl.kind ? sl.kind === "wall" : tieOf(sl.key) < tieOf(best.sl.key)));
          if (better) best = { sl, gain };
        }
        if (!best) { report.omitted.push({ id: nextCandle(id), room: id, what: `no slot for mounted candle ${n + 1} of ${wanted}` }); break; }
        const { sl } = best, cid = v8 ? `${id}:${torchesHere++}` : nextCandle(id), g = glowOf(sl.floor);
        const startsLit = rng() < (sl.kind === "pillar" ? PILLAR_LIT : MOUNTED_LIT)[group];
        takeSlot(o, sl.key, cid);
        if (v8) placed.push({ id: cid, def: sl.wall === "north" ? "sconce" : "sconce-side", room: id, ...anchorOf(sl.floor), wall: sl.wall, ...(startsLit ? { start: "lit" as const } : {}) });
        else {
          countCandle(id);
          placed.push({ id: cid, def: mountedDef(sl.wall), room: id, ...slotLightCell(sl), wall: sl.wall, ...(startsLit ? { start: "lit" as const } : {}) });
        }
        for (const p of panels) if (g[p.y * fp.w + p.x] && isDark.delete(panelKey(p))) candleLit.set(panelKey(p), cid);
        lights.push(sl.floor); mountedAt.push(sl.floor);
        if (sl.kind === "pillar") usedPillars.add(pillarOf.get(panelKey(sl.rock)) ?? "");
        inRect[rectOf(sl.floor)]++;
        budget.mounted++;
      }
      budget.darkLeft = isDark.size;
    }
    return { budgets, dark, candleLit };
  };
  const lighting = v5 ? mountedCandles() : undefined;

  // 6. (v5) Floor candles: placed objects, unlit, as many as the room's size and kind give.
  const fc = objectDef("floor-candle");
  for (const id of lighting ? parents : []) {
    const r = room(id), group = CANDLE_GROUP[r?.kind ?? ""] ?? "none", weight = CANDLE_WEIGHT[group];
    const budget = lighting!.budgets.find((b) => b.room === id)!;
    const rects = fp.rooms[id], panels = roomPanels(rects);
    const expected = (weight * panels.length) / floorPer, rng = passRng(walk.seed, id, 6);
    const wanted = candleCount(expected, FLOOR_CANDLE_CAP[budget.large ? 1 : 0], rng());
    Object.assign(budget, { floorExpected: expected, floorWanted: wanted });
    if (!wanted) continue;
    const doors = fp.doors.filter((d) => d.room === id);
    // What you use in the room: its feature, its cages, the merchant's or librarian's cart.
    const used = placed.filter((i) => i.room === id && i.size && objectDef(i.def).attach === "floor" && objectDef(i.def).interact).flatMap((i) => footprintPanels(i, i.size!));
    const fromUsed = (p: Pt) => Math.min(Infinity, ...used.map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
    const byStone = (p: Pt) => STEPS.some((st) => rock({ x: p.x + st.x, y: p.y + st.y }));
    const near = (a: Pt, b: Pt) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;
    // (v6) In a mounted candle's light (no need for another there), or touching stone, diagonals too
    // (a candle by a wall or a pillar is a mounted one).
    const inGlow = (p: Pt) => mountedAt.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= CANDLE_RADIUS);
    const byStone8 = (p: Pt) => AROUND.some((st) => rock({ x: p.x + st.x, y: p.y + st.y }));
    const stoneFirst = rng() < FLOOR_BY_STONE;
    const mineAt: Pt[] = [];
    for (let n = 0; n < wanted; n++) {
      // Clear of doors and required paths; never in a mounted candle's glow, nor beside another floor candle.
      const ok = panels.filter((p) => !doors.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < CANDLE_CLEAR)
        && o.reserved.get(panelKey(p))?.why !== "path" && !mountedAt.some((q) => near(p, q)) && !mineAt.some((q) => near(p, q))
        && !(v6 && (inGlow(p) || byStone8(p))));
      // Off the things you use: FLOOR_KEEP_OFF's first distance where the room allows it, then its second;
      // (v5) at a pillar's foot or along a wall first, half the time (v6: never there, so it changes nothing).
      const tries: Pt[][] = [];
      let left = ok;
      for (const keep of FLOOR_KEEP_OFF) {
        const pool = left.filter((p) => fromUsed(p) >= keep);
        left = left.filter((p) => fromUsed(p) < keep);
        if (stoneFirst) tries.push(pool.filter(byStone), pool.filter((p) => !byStone(p))); else tries.push(pool);
      }
      const cid = nextCandle(id);
      let at: Sub | null = null;
      for (const pool of tries) {
        const list = pool.slice();
        while (list.length && !at) {
          const p = list.splice(Math.floor(rng() * list.length), 1)[0];
          at = spotsIn(fp, fc, p).find((a) => tryAt(fc, a, cid, id)) ?? null;
          if (at) mineAt.push(p);
        }
        if (at) break;
      }
      if (!at) { report.omitted.push({ id: cid, room: id, what: "no valid spot for a floor candle" }); break; }
      countCandle(id);
      put(fc, at, cid);
      placed.push({ id: cid, def: "floor-candle", room: id, ...at, size: { ...fc.footprint } });
      budget.floorPlaced++;
    }
  }

  // 6. Candles: now and then a room has one near its middle; every valid spot
  // tried, in a random order, before it's left out. (v2–v4; v5's are above.)
  const candle = objectDef("candle");
  for (const id of v5 ? [] : parents) {
    if (id === layout.start || id === layout.boss) continue;
    const rng = passRng(walk.seed, id, 6);
    if (rng() >= CANDLE_CHANCE) continue;
    const mid = roomCentre(layout.rooms[id]), doors = fp.doors.filter((d) => d.room === id);
    const spots: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const d = Math.hypot(x - mid.x, y - mid.y);
      if (d < CANDLE_NEAR[0] || d > CANDLE_NEAR[1] || spots.some((s) => s.x === x && s.y === y)) continue;
      if (doors.some((q) => Math.hypot(q.x - x, q.y - y) < CANDLE_CLEAR)) continue;
      spots.push({ x, y });
    }
    const cid = `candle:${id}`;
    let done = false;
    // Today's spots, picked at random as before; (v4) on that panel, its middle
    // subcell first, then the rest, so it may share a panel with what fits beside it.
    while (spots.length && !done) {
      const p = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      const at = (v4 ? panelCells(p).sort((a, b) => Math.abs(a.sx - 3 * p.x) + Math.abs(a.sy - 3 * p.y) - (Math.abs(b.sx - 3 * p.x) + Math.abs(b.sy - 3 * p.y))) : [anchorOf(p)])
        .find((a) => tryAt(candle, a, cid, id));
      if (!at) continue;
      put(candle, at, cid);
      placed.push({ id: cid, def: "candle", room: id, ...at, size: { ...candle.footprint } });
      done = true;
    }
    if (!done) report.omitted.push({ id: cid, room: id, what: "no valid spot" });
  }

  // 6b. (v12) Tables: now and then a room has one, as furniture, mostly with a candle on it (the user,
  // 2026-11-11). Off the doors, the kept paths and spots, and the panels in front of a wall torch; every
  // valid panel tried, in a random order, before it's left out. (A cards room's deck stands on its own table.)
  const table = objectDef("table");
  for (const id of v >= 12 ? parents : []) {
    const r = room(id), rng = passRng(walk.seed, id, TABLE_PASS);
    if (id === layout.start || id === layout.boss || !r || !TABLE_ROOMS.has(r.kind) || rng() >= TABLE_CHANCE) continue;
    const doors = fp.doors.filter((d) => d.room === id);
    const torches = placed.filter((i) => i.room === id && (i.def === "sconce" || i.def === "sconce-side")).map((i) => ({ x: panelOfSubcell(i.sx), y: panelOfSubcell(i.sy) }));
    const list = roomPanels(fp.rooms[id]).filter((p) => !doors.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < CANDLE_CLEAR)
      && !torches.some((q) => q.x === p.x && q.y === p.y));
    const tid = `table:${id}`;
    let at: Sub | null = null;
    while (list.length && !at) {
      const p = list.splice(Math.floor(rng() * list.length), 1)[0];
      at = spotsIn(fp, table, p).find((a) => tryAt(table, a, tid, id)) ?? null;
    }
    if (!at) { report.omitted.push({ id: tid, room: id, what: "no valid spot for a table" }); continue; }
    put(table, at, tid);
    placed.push({ id: tid, def: "table", room: id, ...at, size: { ...table.footprint }, ...(rng() < TABLE_CANDLE ? { holds: "candle" as const } : {}),
      ...(v >= 13 && rng() < TABLE_DECK ? { deck: true as const } : {}) });
  }

  // 7. Spawns: every fight room's foes, and the card witch.
  const reach = new Map(parents.map((id) => [id, reachableIn(o, fp.rooms[id], id)]));
  // (v4) Room for the i-th one's body round a spot: its size class's footprint, and spawn clearance.
  const bodyFits = (p: Pt, species: string | undefined) => {
    if (!v4 || !species) return true;
    const cls = sizeClassOf(species), size = creatureSize(species);
    return !roomFor(o, p, size, cls ? SPAWN_CLEARANCE[cls] ?? 0 : 0);
  };
  const startsFor = (id: string, count: number, rng: Rng, end?: 0 | 1, rule = "foe", speciesOf: (i: number) => string | undefined = () => undefined): (Pt & { facing: number; walks: boolean; wait: number })[] => {
    const floors = floorsOf(id), doors = fp.doors.filter((d) => d.room === parentOf(id)), ok = reach.get(parentOf(id))!;
    const spots: Pt[] = [];
    for (const r of floors) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const p = { x, y };
      if (spots.some((s) => s.x === x && s.y === y) || canStand(o, p, undefined, claims) || !ok.has(panelKey(p))) continue;
      if (end !== undefined && endOf(floors, x, y) !== end) continue;
      if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEAR)) continue;
      spots.push(p);
    }
    const out: (Pt & { facing: number; walks: boolean; wait: number })[] = [];
    for (let gap = FOE_GAP; out.length < count && gap >= 0; gap--) {
      const free = spots.filter((s) => out.every((f) => Math.hypot(f.x - s.x, f.y - s.y) >= Math.max(gap, 1)));
      while (out.length < count && free.length > 0) {
        const s = free.splice(Math.floor(rng() * free.length), 1)[0];
        if (out.some((f) => Math.hypot(f.x - s.x, f.y - s.y) < Math.max(gap, 1))) continue;
        if (!bodyFits(s, speciesOf(out.length))) continue;
        const i = out.length;
        out.push({ ...s, facing: WAYS[Math.floor(rng() * 4)], walks: i > 0 && rng() < WANDER_SHARE, wait: between(rng, LOOK_TIME) });
      }
    }
    if (out.length < count) report.problems.push({ id, room: id, what: `room for ${out.length} of ${count} ${rule}s` });
    return out;
  };
  for (const id of roomIds(layout, map)) {
    const r = room(id);
    if (!r) continue;
    const rng = passRng(walk.seed, id, 7);
    if (r.kind === "witch") {
      for (const f of startsFor(id, 1, rng, undefined, "witch", () => (v4 ? "card_witch" : undefined))) placed.push({ id: `${id}:witch`, def: "witch", room: id, ...anchorOf(f), facing: f.facing });
      continue;
    }
    const count = foeCount(r, dungeon);
    if (!count) continue;
    if (waitsHere(r, dungeon)) {
      const at = standOf(floorsOf(id)), why = canStand(o, at, `${id}:foe:0`, claims);
      if (why) report.problems.push({ id: `${id}:foe:0`, room: id, what: `a waiting boss ${why}` });
      const species = r.boss ?? r.enemies?.[0]?.creatureId;
      if (!bodyFits(at, species)) report.problems.push({ id: `${id}:foe:0`, room: id, what: `no room round its stand for ${species}: ${roomFor(o, at, creatureSize(species!), SPAWN_CLEARANCE[sizeClassOf(species!) ?? ""] ?? 0)}` });
      placed.push({ id: `${id}:foe:0`, def: "foe", room: id, ...anchorOf(at), facing: Math.PI / 2, foe: { waits: true } });
      continue;
    }
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    startsFor(id, count, rng, end, "foe", (i) => r.enemies?.[i]?.creatureId).forEach((f, i) => {
      const foe: FoeStart = { ...(f.walks ? { walks: true as const } : {}), wait: f.wait, ...(end !== undefined ? { end } : {}) };
      placed.push({ id: `${id}:foe:${i}`, def: "foe", room: id, ...anchorOf(f), facing: f.facing, foe });
    });
  }
  return { placed, report, occupancy: o, ...(lighting ? { lighting } : {}) };
}
