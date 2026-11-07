// tests/walkBaseline.ts
// Phase 0 of the world architecture (docs/world-spec.md §8): what the walk
// screen (components/WalkView.tsx) works out from a saved run, captured as
// plain data so later phases can prove nothing changed. On 2026-11-07 every
// call, seed and filter here was a copy of WalkView's; phase 1 moved that
// logic into lib/world/walkWorld.ts, and walkSetup now calls it there (the
// walk screen's own code), so the goldens pin what the game runs.
//
// Nothing here draws. "Scene inputs" are the facts the drawing reads (where
// each thing stands, what's lit, what's solid, what can be walked); the
// picture itself is pinned in phase 1, once there's a scene builder to test.

import { layoutFloorplan, roomCentre, startProgress, waysOn, cutOffY, type Layout, type Progress } from "../lib/dungeon/layout";
import { torchLit, shutPlan, rubbleOf, fallenSoFar, placeSconces, placeCandles, sconceInSight, TORCH_RADIUS } from "../lib/dungeon/torch";
import { floorVariant, wallVariant, type Decor } from "../lib/dungeon/decor";
import { spottedBy } from "../lib/dungeon/foes";
import { placeLabDecor, foeStarts, roomIds, thingsOf, solidCells, walkRule, seeded, toRuns, fromRuns } from "../lib/world/walkWorld";
import { byFire, type Campfire } from "../lib/dungeon/campfire";
import { findPath, roomAt, walkable } from "../lib/dungeon/walk";
import { walkRoom, walkInto } from "../lib/dungeon/walkRun";
import { hasFight, type DungeonId, type DungeonRun, type Room } from "../lib/dungeon/run";
import { depthEdges } from "../lib/dungeon/tileArt";
import { FLOOR, ROCK, type Floorplan, type Pt } from "../lib/dungeon/floorplan";
import { WALK_FLOOR_WORN, WALK_WALL_WORN } from "../lib/sprites/walk";
import { migrateWalkRun, placementsOfWalk } from "../lib/world/migrate";

// The walk screen's own helpers (lib/world/walkWorld.ts).
export { seeded, toRuns, fromRuns };

// A short, stable fingerprint of a big array (FNV-1a), so goldens stay small.
export function digest(data: ArrayLike<number> | string): string {
  let h = 0x811c9dc5;
  const n = typeof data === "string" ? data.length : data.length;
  for (let i = 0; i < n; i++) {
    h ^= typeof data === "string" ? data.charCodeAt(i) : data[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
const count = (a: ArrayLike<number>) => { let c = 0; for (let i = 0; i < a.length; i++) if (a[i]) c++; return c; };

const dungeonOf = (run: DungeonRun): DungeonId => run.dungeon ?? 1;
const progressOf = (run: DungeonRun): Progress => ({ room: run.walk!.room, line: run.walk!.line ?? Infinity });

// What a thing to tap is, by name (WalkView keeps the art itself), from its definition.
const WHAT: Record<string, string> = { chest: "chest", sack: "sack", "loot-sack": "sack", "rickety-chest": "rickety", "loot-chest": "rickety", "card-deck": "cards", pool: "pool", merchant: "merchant", librarian: "librarian", witch: "witch", cage: "cage" };
type ThingFact = { key: string; room: string; x: number; y: number; what: string; open: boolean; solid: boolean; npc?: boolean; inert?: boolean; flag?: boolean };

// Everything WalkView works out when it opens on this run. decor: the lab's
// decor switch (/lab/newrun); the live game has it off.
export function walkSetup(run0: DungeonRun, decor = false) {
  // The run as the Labyrinth screen opens it: given its placements (phase 2a) if it has none yet.
  const run = migrateWalkRun(run0).run;
  const walk = run.walk!;
  const layout = walk.layout, map = run.map, dungeon = dungeonOf(run);
  const plan = layoutFloorplan(layout);
  const progress = progressOf(run);
  const live = shutPlan(plan, layout, progress);
  const known = fromRuns(walk.known, plan.w * plan.h);
  const room = (id: string): Room | undefined => walkRoom(run, id);
  // Wall torches (lit as saved), candles (never by a campfire), decor and banners.
  const placed = placementsOfWalk(walk, map, dungeon, room);
  const { sconces, candles } = placed;
  const fires: Campfire[] = (walk.fires ?? []).map((f) => ({ ...f }));
  const lab = decor ? placeLabDecor(walk, plan, map, candles, sconces) : { decor: [] as Decor[], banners: [] as Pt[] };
  const decorItems: Decor[] = lab.decor, banners: Pt[] = lab.banners;
  // Every room, and a big room's second den; each fight room's foes where they start; the witch.
  const ids = roomIds(layout, map);
  const foes = foeStarts(placed, ids, room), npcs = placed.witches;
  // The things to tap, as the walk screen makes them (named as the phase-0 goldens name them).
  const things: ThingFact[] = thingsOf(layout, placed, ids, room, npcs, walk.spots, dungeon).map(({ key, room, x, y, def, state, open, solid, npc, inert, flag }) => ({
    key, room, x, y, what: WHAT[def] + (state === "open" && def !== "card-deck" ? "-open" : ""), open, solid,
    ...(npc ? { npc } : {}), ...(inert !== undefined ? { inert } : {}), ...(flag !== undefined ? { flag } : {}),
  }));
  // Where you may walk (WalkView's rule()): forward, seen, and not into anything solid.
  const solid = solidCells(thingsOf(layout, placed, ids, room, npcs, walk.spots, dungeon), fires, decorItems);
  const canStep = walkRule(layout, plan, progress, known, solid);
  // (The same without what you've seen: the walking rules alone, for the baselines.)
  const canWalk = walkRule(layout, plan, progress, null, solid);
  return { canWalk, placed, layout, map, dungeon, plan, live, progress, known, sconces, candles, fires, decorItems, banners, ids, foes, npcs, things, canStep, room };
}

// The facts to pin for one saved run.
export function sceneInputs(run: DungeonRun, decor = false) {
  const s = walkSetup(run, decor);
  const walk = run.walk!;
  const { plan, live, layout } = s;
  const at = walk.at;
  const edges = depthEdges(live);
  // Worn floor and wall tiles (decor only): which variant each floor tile gets.
  const worn = decor ? Array.from(plan.tiles, (t, i) => (t === ROCK ? 0 : floorVariant(i % plan.w, Math.floor(i / plan.w), walk.seed, WALK_FLOOR_WORN.length))) : [];
  const wornWalls = decor ? Array.from(plan.tiles, (_, i) => wallVariant(Math.floor((i % plan.w) / 2), Math.floor(i / plan.w), walk.seed, WALK_WALL_WORN.length)) : [];
  // Paths from where you stand to each thing (as WalkView walks you up to one): steps, or null.
  const pathTo = (q: Pt) => {
    const p = findPath(live, at, q, s.canStep);
    return p ? p.length : null;
  };
  const awake = (id: string) => { const r = s.room(id); return !!r && hasFight(r) && !r.done; };
  return {
    floorplan: {
      w: plan.w, h: plan.h, tiles: digest(plan.tiles), floors: count(plan.tiles.map((t) => (t === FLOOR ? 1 : 0))),
      rooms: Object.keys(plan.rooms).length, doors: digest(JSON.stringify(plan.doors)), tunnels: Object.keys(plan.tunnels).sort(),
      inner: Object.values(layout.rooms).filter((r) => r.inner).map((r) => [r.id, r.inner!.length]),
      block: layout.block ?? null,
    },
    progress: { room: s.progress.room, line: walk.line ?? null, ways: waysOn(layout, s.progress).map((w) => `${w.tunnel.key}>${w.to.room}`) },
    live: { tiles: digest(live.tiles), rubble: rubbleOf(plan, layout, s.progress).map((r) => `${r.key}@${r.room}:${r.wall}:${r.tiles.length}`), fallen: fallenSoFar(plan, layout, s.progress, walk.cuts ?? [], s.known).sort() },
    edges: { left: edges.left.length, right: edges.right.length, south: edges.south.length, digest: digest(JSON.stringify(edges)) },
    known: { cells: count(s.known), digest: digest(s.known) },
    you: { at, room: roomAt(plan, at), walkable: walkable(live, at.x, at.y) },
    torch: digest(torchLit(live, at, TORCH_RADIUS)),
    sconces: s.sconces.map((c) => `${c.id}@${c.x},${c.y}${c.wall ? ":" + c.wall : ""}${c.lit ? "*" : ""}`),
    sconcesInSight: s.sconces.filter((c) => sconceInSight(live, c, at)).map((c) => c.id),
    candles: s.candles.map((c) => `${c.id}@${c.x},${c.y}${c.lit ? "*" : ""}`),
    fires: s.fires.map((f) => `${f.room}@${f.x},${f.y}:${f.left}${byFire(live, f, at) ? " by" : ""}`),
    foes: s.foes.map((f) => `${f.room}#${f.index}@${f.x},${f.y} face ${f.facing.toFixed(3)}${f.walks ? " walks" : ""}${f.waits ? " waits" : ""}${f.end !== undefined ? " end " + f.end : ""}`),
    npcs: s.npcs.map((f) => `${f.room}@${f.x},${f.y}`),
    things: s.things.map((t) => `${t.key} ${t.what}@${t.x},${t.y}${t.solid ? " solid" : ""}${t.open ? " open" : ""}${t.npc ? " npc" : ""}${t.inert ? " inert" : ""}${t.flag ? " !" : ""} path ${pathTo(t)}`),
    spotted: spottedBy(live, s.foes, at, awake),
    decor: s.decorItems.map((d) => `${d.room} ${d.kind}@${d.x},${d.y}${d.solid ? " solid" : ""}`),
    banners: s.banners.map((b) => `${b.x},${b.y}`),
    worn: decor ? { floor: digest(worn), walls: digest(wornWalls) } : null,
  };
}

// A run part-way through, made with today's rules (for the fixtures): up the
// first ways on, `steps` times, each fight room beaten as you go, torches lit
// in the rooms you pass, what your torch showed you kept, a campfire half used.
export function playForward(run: DungeonRun, steps: number): DungeonRun {
  const walk = run.walk!;
  const layout: Layout = walk.layout, plan = layoutFloorplan(layout);
  let p = startProgress(layout);
  let r = run;
  const known = new Uint8Array(plan.w * plan.h);
  const see = (q: Pt) => { const lit = torchLit(shutPlan(plan, layout, p), q, TORCH_RADIUS); for (let i = 0; i < lit.length; i++) if (lit[i]) known[i] = 1; };
  const trail: Pt[] = [walk.at];
  const cuts: number[] = [];
  see(walk.at);
  const visited = [layout.start];
  for (let k = 0; k < steps; k++) {
    const ways = waysOn(layout, p);
    const way = ways.find((w) => w.tunnel.up) ?? ways[0];
    if (!way) break;
    if (way.to.line !== p.line) cuts.push(cutOffY(way.to, layout));
    p = way.to;
    // Walk in, and beat what's there (a fight, or a chest opened).
    const from = r.current;
    r = { ...r, current: from ? { ...from, done: true } : from };
    r = walkInto(r, p.room);
    const c = roomCentre(layout.rooms[p.room]);
    trail.push(c);
    visited.push(p.room);
    see(c);
  }
  // Beat the room you're in too, its loot dropped beside the middle.
  const here = p.room;
  const cur = r.current;
  const spots: Record<string, Pt> = {};
  if (cur) {
    const c = roomCentre(layout.rooms[here]);
    r = { ...r, current: { ...cur, done: true } };
    if (hasFight(cur)) spots[here] = { x: c.x + 1, y: c.y };
  }
  const sconces = placeSconces(plan, layout.start, seeded(walk.seed + 505), true);
  const lit = sconces.filter((c) => visited.includes(c.room)).map((c) => c.id);
  const centres = Object.fromEntries(Object.values(layout.rooms).map((q) => [q.id, roomCentre(q)]));
  const candle = placeCandles(plan, centres, [layout.start, layout.boss], seeded(walk.seed + 606)).find((c) => visited.includes(c.room));
  const fires = (walk.fires ?? []).map((f, i) => (i === 0 ? { ...f, left: f.left / 2 } : f));
  return {
    ...r,
    walk: {
      ...r.walk!, at: roomCentre(layout.rooms[here]), room: p.room, line: p.line === Infinity ? null : p.line,
      known: toRuns(known), lit: [...lit, ...(candle ? [candle.id] : [])], trail, cuts, fires, spots, flare: 0,
    },
  };
}

export type { Floorplan };
