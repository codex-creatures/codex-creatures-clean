// tests/walkBaseline.ts
// Phase 0 of the world architecture (docs/world-spec.md §8): what the walk
// screen (components/WalkView.tsx) works out from a saved run, captured as
// plain data so later phases can prove nothing changed. Every call, seed and
// filter here copies WalkView as it stood on 2026-11-07; phase 1 moves this
// logic into lib/, and then these tests call it there instead.
//
// Nothing here draws. "Scene inputs" are the facts the drawing reads (where
// each thing stands, what's lit, what's solid, what can be walked); the
// picture itself is pinned in phase 1, once there's a scene builder to test.

import { layoutFloorplan, roomCentre, startProgress, waysOn, stepRule, cutOffY, type Layout, type Progress } from "../lib/dungeon/layout";
import { torchLit, shutPlan, rubbleOf, fallenSoFar, placeSconces, placeCandles, sconceInSight, TORCH_RADIUS, type Sconce, type Candle } from "../lib/dungeon/torch";
import { placeDecor, placeBanners, floorVariant, wallVariant, type Decor } from "../lib/dungeon/decor";
import { placeFoes, placeWaiter, spottedBy, spawnOf, parentOf, type Foe } from "../lib/dungeon/foes";
import { byFire, type Campfire } from "../lib/dungeon/campfire";
import { findPath, roomAt, walkable } from "../lib/dungeon/walk";
import { waitsHere, walkRoom, walkInto, cageSpots } from "../lib/dungeon/walkRun";
import { hasFight, type DungeonId, type DungeonRun, type Room } from "../lib/dungeon/run";
import { depthEdges } from "../lib/dungeon/tileArt";
import { FLOOR, ROCK, type Floorplan, type Pt } from "../lib/dungeon/floorplan";
import { WALK_FLOOR_WORN, WALK_WALL_WORN } from "../lib/sprites/walk";

// WalkView's own helpers, copied (they aren't exported).
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
export const toRuns = (a: Uint8Array) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] && !a[i - 1]) { let j = i; while (a[j]) j++; out.push(i, j - i); }
  return out;
};
export const fromRuns = (runs: number[] | undefined, size: number) => {
  const a = new Uint8Array(size);
  for (let k = 0; runs && k + 1 < runs.length; k += 2) a.fill(1, runs[k], Math.min(size, runs[k] + runs[k + 1]));
  return a;
};

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

// What a thing to tap is, by name (WalkView keeps the art itself).
type ThingFact = { key: string; room: string; x: number; y: number; what: string; open: boolean; solid: boolean; npc?: boolean; inert?: boolean; flag?: boolean };

// Everything WalkView works out when it opens on this run. decor: the lab's
// decor switch (/lab/newrun); the live game has it off.
export function walkSetup(run: DungeonRun, decor = false) {
  const walk = run.walk!;
  const layout = walk.layout, map = run.map, dungeon = dungeonOf(run);
  const plan = layoutFloorplan(layout);
  const progress = progressOf(run);
  const live = shutPlan(plan, layout, progress);
  const known = fromRuns(walk.known, plan.w * plan.h);
  const room = (id: string): Room | undefined => walkRoom(run, id);
  // Wall torches (lit as saved), candles (never by a campfire), decor and banners.
  const litIds = new Set(walk.lit ?? []);
  const sconces: Sconce[] = placeSconces(plan, layout.start, seeded(walk.seed + 505), true).map((c) => (litIds.has(c.id) ? { ...c, lit: true } : c));
  const fires: Campfire[] = (walk.fires ?? []).map((f) => ({ ...f }));
  const centres = Object.fromEntries(Object.values(layout.rooms).map((r) => [r.id, roomCentre(r)]));
  const candles: Candle[] = placeCandles(plan, centres, [layout.start, layout.boss], seeded(walk.seed + 606))
    .filter((c) => !(walk.fires ?? []).some((f) => Math.hypot(f.x - c.x, f.y - c.y) < 2))
    .map((c) => (litIds.has(c.id) ? { ...c, lit: true } : c));
  const kinds = Object.fromEntries(Object.keys(layout.rooms).map((id) => [id, map.nodes[id].kind]));
  const decorItems: Decor[] = decor ? placeDecor(plan, kinds, centres, [...(walk.fires ?? []), ...candles], [layout.start, layout.boss], seeded(walk.seed + 707)) : [];
  const banners: Pt[] = decor ? placeBanners(plan, sconces.filter((c) => !c.wall || c.wall === "top"), [layout.start], seeded(walk.seed + 808)) : [];
  // Every room, and a big room's second den; each fight room's foes where they start; the witch.
  const ids = Object.keys(layout.rooms).sort().flatMap((id) => (map.nodes[spawnOf(id)] ? [id, spawnOf(id)] : [id]));
  const foeRng = seeded(walk.seed + 303);
  const foes: Foe[] = ids.flatMap((id) => {
    const r = room(id);
    if (!r || !hasFight(r) || r.done) return [];
    if (waitsHere(r, dungeon)) return [placeWaiter(plan, id)];
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    return r.enemies ? placeFoes(plan, id, r.enemies.length, foeRng, end) : [];
  });
  const npcRng = seeded(walk.seed + 404);
  const npcs: Foe[] = ids.flatMap((id) => (room(id)?.kind === "witch" ? placeFoes(plan, id, 1, npcRng).map((f) => ({ ...f, walks: true, wait: 1 })) : []));
  // The things to tap, as WalkView's things() makes them.
  const things: ThingFact[] = ids.flatMap((id): ThingFact[] => {
    const r = room(id);
    if (!r) return [];
    const c = roomCentre(layout.rooms[parentOf(id)]);
    const out: ThingFact[] = [];
    const add = (t: Omit<ThingFact, "key" | "room">) => out.push({ key: id, room: id, ...t });
    if (r.kind === "chest" || r.kind === "treasure") add({ ...c, what: r.done ? "chest-open" : "chest", open: r.done, solid: true });
    else if (r.kind === "stash") add({ ...c, what: r.opened ? "sack-open" : "sack", open: !!r.opened, solid: true });
    else if (r.kind === "pool") add({ ...c, what: "pool", open: r.done, solid: true });
    else if (r.kind === "cards") add({ ...c, what: "cards", open: r.done, solid: true });
    else if (r.kind === "merchant") add({ ...c, what: "merchant", open: false, solid: true, npc: true });
    else if (r.kind === "librarian" || (r.kind === "library" && r.librarian)) add({ ...c, what: "librarian", open: false, solid: true, npc: true });
    else if (r.kind === "witch") for (const n of npcs.filter((f) => f.room === id)) {
      const over = r.done || (!!r.witch && r.witch.state !== "playing");
      add({ x: Math.round(n.x), y: Math.round(n.y), what: "witch", open: false, solid: false, npc: true, inert: over });
    }
    if ((r.kind === "library" || r.kind === "storehouse") && r.sack && !hasFight(r) && !r.container) {
      add({ ...c, what: r.kind === "library" ? (r.opened ? "sack-open" : "sack") : r.opened ? "rickety-open" : "rickety", open: !!r.opened, solid: true });
    }
    if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = walk.spots?.[id] ?? c;
      const chest = r.container !== "sack";
      add({ ...at, what: chest ? (r.opened ? "rickety-open" : "rickety") : r.opened ? "sack-open" : "sack", open: !!r.opened, solid: false });
    }
    if (r.cages?.length) cageSpots(plan, parentOf(id), r.cages.length).forEach((q, i) => {
      const cage = r.cages![i];
      out.push({ key: `${id}#${i}`, room: id, ...q, what: cage.opened ? "cage-open" : "cage", open: !!cage.opened, solid: true, flag: !cage.opened && (!hasFight(r) || r.done) });
    });
    return out;
  });
  // Where you may walk (WalkView's rule()): forward, seen, and not into anything solid.
  const forward = stepRule(layout, plan, progress);
  const solid = new Set([...things.filter((t) => t.solid), ...fires, ...decorItems.filter((d) => d.solid)].map((t) => `${t.x},${t.y}`));
  const canStep = (from: Pt, to: Pt) => forward(from, to) && known[to.y * plan.w + to.x] === 1 && !solid.has(`${to.x},${to.y}`);
  // (The same without what you've seen: the walking rules alone, for the baselines.)
  const canWalk = (from: Pt, to: Pt) => forward(from, to) && !solid.has(`${to.x},${to.y}`);
  return { canWalk, layout, map, dungeon, plan, live, progress, known, sconces, candles, fires, decorItems, banners, ids, foes, npcs, things, canStep, room };
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
