// lib/world/walkWorld.ts
// What's in a walkable run's rooms (docs/world-spec.md §5.4), worked out from
// the saved run when the walk screen opens: the wall torches, candles, foes
// and the card witch where they start, the lab's decor, and the things to tap
// as the rooms stand now, with where you may walk round them. Pure: the walk
// screen (components/WalkView.tsx) and the phase-0 goldens
// (tests/walkBaseline.ts) both call it, so they can't drift apart.
//
// Placements are worked out from the run's seed, each kind with its own
// stream (seed + 303 foes, 404 the witch, 505 wall torches, 606 candles, 707
// decor, 808 banners), exactly as the walk screen always has. Phase 2 saves
// them into the run instead (§7).

import { roomCentre, stepRule, type Layout, type Progress } from "../dungeon/layout";
import { placeSconces, placeCandles, type Sconce, type Candle } from "../dungeon/torch";
import { placeDecor, placeBanners, type Decor } from "../dungeon/decor";
import { placeFoes, placeWaiter, spawnOf, parentOf, type Foe } from "../dungeon/foes";
import { findPath, walkable, type CanStep } from "../dungeon/walk";
import { hasFight, type DungeonId, type Room } from "../dungeon/run";
import { waitsHere, cageSpots, type WalkRun } from "../dungeon/walkRun";
import type { Campfire } from "../dungeon/campfire";
import type { DungeonMap } from "../dungeon/map";
import type { Floorplan, Pt } from "../dungeon/floorplan";
import { objectDef, REACH_OBJECT, TAP_OBJECT } from "./objects";

// The walk screen's random numbers: a seeded stream (Park–Miller).
export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
// What you've seen, saved as runs of [start, length] (WalkRun.known).
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

const centresOf = (layout: Layout) => Object.fromEntries(Object.values(layout.rooms).map((r) => [r.id, roomCentre(r)]));

// Every room, and a big room's second den (foes.ts spawnOf) where it has one.
export const roomIds = (layout: Layout, map: DungeonMap) => Object.keys(layout.rooms).sort().flatMap((id) => (map.nodes[spawnOf(id)] ? [id, spawnOf(id)] : [id]));

// The wall torches (lit as saved), and the odd candle near a room's middle, never on a campfire.
export function placeLights(walk: WalkRun, plan: Floorplan): { sconces: Sconce[]; candles: Candle[] } {
  const layout = walk.layout, lit = new Set(walk.lit ?? []);
  const sconces = placeSconces(plan, layout.start, seeded(walk.seed + 505), true).map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  const candles = placeCandles(plan, centresOf(layout), [layout.start, layout.boss], seeded(walk.seed + 606))
    .filter((c) => !(walk.fires ?? []).some((f) => Math.hypot(f.x - c.x, f.y - c.y) < 2))
    .map((c) => (lit.has(c.id) ? { ...c, lit: true } : c));
  return { sconces, candles };
}

// 🚧 The lab's decor samples (/lab/newrun): where they lie, and banners on the rooms' top walls clear of the wall torches.
export function placeLabDecor(walk: WalkRun, plan: Floorplan, map: DungeonMap, candles: Candle[], sconces: Sconce[]): { decor: Decor[]; banners: Pt[] } {
  const layout = walk.layout;
  const kinds = Object.fromEntries(Object.keys(layout.rooms).map((id) => [id, map.nodes[id].kind]));
  return {
    decor: placeDecor(plan, kinds, centresOf(layout), [...(walk.fires ?? []), ...candles], [layout.start, layout.boss], seeded(walk.seed + 707)),
    banners: placeBanners(plan, sconces.filter((c) => !c.wall || c.wall === "top"), [layout.start], seeded(walk.seed + 808)),
  };
}

// Each fight room's foes, where they start (the same places every time the
// screen opens): two dens in a room keep to an end each; a boss waits at the
// top. And the card witch, who walks about her room.
export function placePeople(walk: WalkRun, plan: Floorplan, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): { foes: Foe[]; npcs: Foe[] } {
  const ids = roomIds(walk.layout, map);
  const rng = seeded(walk.seed + 303);
  const foes = ids.flatMap((id) => {
    const r = room(id);
    if (!r || !hasFight(r) || r.done) return [];
    if (waitsHere(r, dungeon)) return [placeWaiter(plan, id)];
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    return r.enemies ? placeFoes(plan, id, r.enemies.length, rng, end) : [];
  });
  const npcRng = seeded(walk.seed + 404);
  const npcs = ids.flatMap((id) => (room(id)?.kind === "witch" ? placeFoes(plan, id, 1, npcRng).map((f) => ({ ...f, walks: true, wait: 1 })) : []));
  return { foes, npcs };
}

// Something to tap, drawn where it lies: a room's chest, stash or treasure
// (at its middle), a beaten room's sack or chest, a pool, a large room's
// stores, a camp's cages (along its top; flag: "!" over one you can open), or
// someone in the room (the merchant, the librarian, the witch walking about).
// key: the room, or "<room>#<cage>". def: what it is (objects.ts), state:
// which of its pictures; solid and npc come from the definition.
export type Thing = { key: string; room: string; x: number; y: number; def: string; state?: string; open: boolean; solid: boolean;
  cage?: number; flag?: boolean; npc?: boolean; glow?: boolean; inert?: boolean }; // inert: drawn, not tapped
const thingOf = (t: Omit<Thing, "solid" | "npc">): Thing => {
  const d = objectDef(t.def);
  return { ...t, solid: d.collision === "solid", ...(d.kind === "npc" ? { npc: true } : {}) };
};
const shut = (opened: boolean | undefined) => (opened ? "open" : "shut");

// The things to tap, as the rooms stand now (`room`), the witch where she's got to, a beaten room's loot where it was dropped.
export function thingsOf(layout: Layout, plan: Floorplan, ids: string[], room: (id: string) => Room | undefined, npcs: Foe[], spots: WalkRun["spots"]): Thing[] {
  return ids.flatMap((id): Thing[] => {
    const r = room(id);
    if (!r) return [];
    const c = roomCentre(layout.rooms[parentOf(id)]);
    const out: Thing[] = [];
    const add = (t: Omit<Thing, "key" | "room" | "solid" | "npc">) => out.push(thingOf({ key: id, room: id, ...t }));
    if (r.kind === "chest" || r.kind === "treasure") add({ ...c, def: "chest", state: shut(r.done), open: r.done });
    else if (r.kind === "stash") add({ ...c, def: "sack", state: shut(r.opened), open: !!r.opened });
    else if (r.kind === "pool") add({ ...c, def: "pool", open: r.done, glow: !r.done });
    else if (r.kind === "cards") add({ ...c, def: "card-deck", open: r.done });
    else if (r.kind === "merchant") add({ ...c, def: "merchant", open: false });
    else if (r.kind === "librarian" || (r.kind === "library" && r.librarian)) add({ ...c, def: "librarian", open: false });
    else if (r.kind === "witch") for (const n of npcs.filter((f) => f.room === id)) {
      // (Her game played out, she wanders on, with nothing more for you: the user, 2026-11-06.)
      const over = r.done || (!!r.witch && r.witch.state !== "playing");
      add({ x: Math.round(n.x), y: Math.round(n.y), def: "witch", open: false, inert: over });
    }
    // A large room's stores (a library's codexes lying about, a storehouse's crates), till a guard's beaten.
    if ((r.kind === "library" || r.kind === "storehouse") && r.sack && !hasFight(r) && !r.container) {
      add({ ...c, def: r.kind === "library" ? "sack" : "rickety-chest", state: shut(r.opened), open: !!r.opened });
    }
    if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = spots?.[id] ?? c;
      add({ ...at, def: r.container !== "sack" ? "loot-chest" : "loot-sack", state: shut(r.opened), open: !!r.opened });
    }
    // A camp's cages, along its top: "!" over each you can open (its guards beaten, or none to see).
    if (r.cages?.length) cageSpots(plan, parentOf(id), r.cages.length).forEach((q, i) => {
      const cage = r.cages![i];
      out.push(thingOf({ key: `${id}#${i}`, room: id, ...q, def: "cage", state: shut(cage.opened), cage: i, open: !!cage.opened, flag: !cage.opened && (!hasFight(r) || r.done) }));
    });
    return out;
  });
}

// The cells nothing may walk into: solid things, campfires, solid decor.
export const solidCells = (things: Thing[], fires: Campfire[], decor: Decor[]) =>
  new Set([...things.filter((t) => t.solid), ...fires, ...decor.filter((d) => d.solid)].map((t) => `${t.x},${t.y}`));

// Where you may walk: what the forward rule allows (layout.ts stepRule), only
// where you've seen (known: null for the walking rules alone), and never into
// anything solid.
export function walkRule(layout: Layout, plan: Floorplan, p: Progress, known: Uint8Array | null, solid: Set<string>): CanStep {
  const forward = stepRule(layout, plan, p);
  return known
    ? (from, to) => forward(from, to) && known[to.y * plan.w + to.x] === 1 && !solid.has(`${to.x},${to.y}`)
    : (from, to) => forward(from, to) && !solid.has(`${to.x},${to.y}`);
}

// A tap on (or by) a thing: within its definition's tap reach of it, or of
// someone's body (they stand a cell tall).
export function tapsThing(t: Thing, q: Pt): boolean {
  const how = objectDef(t.def).interact, tap = how?.tap ?? TAP_OBJECT;
  return !t.inert && (Math.hypot(t.x - q.x, t.y - q.y) <= tap || (!!how?.tapBody && Math.hypot(t.x - q.x, t.y - 1 - q.y) <= tap));
}
// Close enough to use it.
export const inReach = (t: Thing, you: Pt) => Math.hypot(t.x - you.x, t.y - you.y) <= (objectDef(t.def).interact?.reach ?? REACH_OBJECT);

// The shortest way from `from` up beside a thing (onto it, if it isn't
// solid), by its interaction points; null if there's none.
export function approach(plan: Floorplan, t: Thing, from: Pt, can: CanStep): Pt[] | null {
  let best: Pt[] | null = null;
  for (const { dx, dy } of objectDef(t.def).interact?.points ?? []) {
    const n = { x: t.x + dx, y: t.y + dy };
    if ((dx || dy || !t.solid) && walkable(plan, n.x, n.y)) {
      const way = findPath(plan, from, n, can);
      if (way && (!best || way.length < best.length)) best = way;
    }
  }
  return best;
}
