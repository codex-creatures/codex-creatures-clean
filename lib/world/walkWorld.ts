// lib/world/walkWorld.ts
// What's in a walkable run's rooms (docs/world-spec.md §5.4), when the walk
// screen opens: the foes where they start, the lab's decor, and the things to
// tap as the rooms stand now, with where you may walk round them. Pure: the
// walk screen (components/WalkView.tsx) and the phase-0 goldens
// (tests/walkBaseline.ts) both call it, so they can't drift apart.
//
// The wall torches, candles, the card witch's start, where each room's things
// stand and where its foes start are saved in the run (phases 2a and 2a′:
// lib/world/placements.ts; made by lib/world/place.ts in a new run, by
// lib/world/compat/v0.ts in one from before phase 2b). Still worked out from
// the run's seed each time: the lab's decor (seed + 707) and banners (808).
// The old rules' saved ones had 303 (foes), 404 (the witch), 505 (wall
// torches) and 606 (candles); the new rules give each room's pass its own.

import { roomCentre, floorsOf, stepRule, type Layout, type Progress } from "../dungeon/layout";
import type { Sconce, Candle } from "../dungeon/torch";
import { placeDecor, placeBanners, type Decor } from "../dungeon/decor";
import { spawnOf, parentOf, WAIT_FROM_TOP, type Foe } from "../dungeon/foes";
import { findPath, walkable, type CanStep } from "../dungeon/walk";
import { hasFight, fightContainer, type DungeonId, type Room } from "../dungeon/run";
import { waitsHere, type WalkRun } from "../dungeon/walkRun";
import type { Campfire } from "../dungeon/campfire";
import type { DungeonMap } from "../dungeon/map";
import type { Floorplan, Pt } from "../dungeon/floorplan";
import { objectDef, REACH_OBJECT, TAP_OBJECT } from "./objects";
import { panelAt } from "./grid";
import type { Placements } from "./placements";

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

export const centresOf = (layout: Layout) => Object.fromEntries(Object.values(layout.rooms).map((r) => [r.id, roomCentre(r)]));

// Every room, and a big room's second den (foes.ts spawnOf) where it has one.
export const roomIds = (layout: Layout, map: DungeonMap) => Object.keys(layout.rooms).sort().flatMap((id) => (map.nodes[spawnOf(id)] ? [id, spawnOf(id)] : [id]));

// 🚧 The lab's decor samples (/lab/newrun): where they lie, and banners on the rooms' top walls clear of the wall torches.
export function placeLabDecor(walk: WalkRun, plan: Floorplan, map: DungeonMap, candles: Candle[], sconces: Sconce[]): { decor: Decor[]; banners: Pt[] } {
  const layout = walk.layout;
  const kinds = Object.fromEntries(Object.keys(layout.rooms).map((id) => [id, map.nodes[id].kind]));
  return {
    decor: placeDecor(plan, kinds, centresOf(layout), [...(walk.fires ?? []), ...candles], [layout.start, layout.boss], seeded(walk.seed + 707)),
    banners: placeBanners(plan, sconces.filter((c) => !c.wall || c.wall === "top"), [layout.start], seeded(walk.seed + 808)),
  };
}

// How many foes a room has saved starts for (lib/world/compat/v0.ts), while
// it's still to beat: a waiting boss, or one for each of its enemies. A room
// that will only fight later (an ambush, once it's sprung) has them already,
// so its foes have somewhere to stand without anyone else's moving.
export const fightsLater = (r: Room) => r.kind === "encampment" && r.variant === "ambush" && !r.sprung;
export function foesToPlace(r: Room, dungeon: DungeonId): number {
  if (r.done || !(hasFight(r) || fightsLater(r))) return 0;
  return waitsHere(r, dungeon) ? 1 : r.enemies?.length ?? 0;
}

// Each fight room's foes, where they start: as saved in the run (lib/world/
// placements.ts), for the rooms still to beat, in the rooms' order. The same
// spots every time the screen opens, whatever's been beaten elsewhere (the foe
// fix, phase 2a′, the user, 2026-11-07); where they wander to is this visit's only.
export function foeStarts(placed: Placements, ids: string[], room: (id: string) => Room | undefined): Foe[] {
  return ids.flatMap((id) => {
    const r = room(id);
    return r && hasFight(r) && !r.done ? placed.foes.filter((f) => f.room === id) : [];
  });
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

// Where a mini boss's or a boss's chest lies, there from the start for it to
// guard (the user, 2026-11-07): behind a boss waiting at the top of its room
// (beside it, a little behind, where a camp's cages stand along the top), else
// the room's middle. Worked out from the layout, the same every time.
export function guardedChestSpot(layout: Layout, id: string, r: Room, dungeon: DungeonId): Pt {
  const lr = layout.rooms[parentOf(id)];
  const centre = roomCentre(lr);
  if (!waitsHere(r, dungeon)) return centre;
  const top = floorsOf(lr).reduce((a, b) => (b.y < a.y ? b : a));
  const x = top.x + Math.floor(top.w / 2), y = Math.min(top.y + WAIT_FROM_TOP, top.y + top.h - 1);
  const at = r.cages ? { x: x + 2, y: y - 1 } : { x, y: y - 2 };
  const inStone = (lr.inner ?? []).some((q) => at.x >= q.x && at.x < q.x + q.w && at.y >= q.y && at.y < q.y + q.h);
  return at.y < top.y || inStone ? centre : at;
}

// The things to tap, as the rooms stand now (`room`): each where it was placed
// (lib/world/placements.ts), the witch where she's got to, a beaten room's sack
// where it was dropped (else the room's middle, from the layout), a mini boss's
// or boss's chest where it guards it (shut, and not to be tapped, till it's beaten).
export function thingsOf(layout: Layout, placed: Placements, ids: string[], room: (id: string) => Room | undefined, npcs: Foe[], spots: WalkRun["spots"], dungeon: DungeonId): Thing[] {
  return ids.flatMap((id): Thing[] => {
    const r = room(id);
    if (!r) return [];
    const out: Thing[] = [];
    // A room's placed thing (`<room>:<key>`): one with no placement isn't there.
    const add = (key: string, t: Omit<Thing, "key" | "room" | "solid" | "npc" | "x" | "y">) => {
      const at = placed.spot(`${id}:${key}`);
      if (at) out.push(thingOf({ key: id, room: id, ...at, ...t }));
    };
    if (r.kind === "chest" || r.kind === "treasure") add("chest", { def: "chest", state: shut(r.done), open: r.done });
    else if (r.kind === "stash") add("sack", { def: "sack", state: shut(r.opened), open: !!r.opened });
    else if (r.kind === "pool") add("pool", { def: "pool", open: r.done, glow: !r.done });
    else if (r.kind === "cards") add("card-deck", { def: "card-deck", open: r.done });
    else if (r.kind === "merchant") add("merchant", { def: "merchant", open: false });
    else if (r.kind === "librarian" || (r.kind === "library" && r.librarian)) add("librarian", { def: "librarian", open: false });
    else if (r.kind === "witch") for (const n of npcs.filter((f) => f.room === id)) {
      // (Her game played out, she wanders on, with nothing more for you: the user, 2026-11-06.)
      const over = r.done || (!!r.witch && r.witch.state !== "playing");
      out.push(thingOf({ key: id, room: id, x: Math.round(n.x), y: Math.round(n.y), def: "witch", open: false, inert: over }));
    }
    // A large room's stores (a library's codexes lying about, a storehouse's crates), till a guard's beaten.
    if ((r.kind === "library" || r.kind === "storehouse") && r.sack && !hasFight(r) && !r.container) {
      add("stores", { def: r.kind === "library" ? "sack" : "rickety-chest", state: shut(r.opened), open: !!r.opened });
    }
    const guards = hasFight(r) || r.done ? fightContainer(r, dungeon) !== "sack" : false;
    if (guards && !r.done) {
      out.push(thingOf({ key: id, room: id, ...guardedChestSpot(layout, id, r, dungeon), def: "loot-chest", state: "shut", open: false, inert: true }));
    } else if (r.container && r.done && (!r.opened || (r.sack?.length ?? 0) > 0)) {
      const at = guards ? guardedChestSpot(layout, id, r, dungeon) : spots?.[id] ?? roomCentre(layout.rooms[parentOf(id)]);
      out.push(thingOf({ key: id, room: id, ...at, def: r.container !== "sack" ? "loot-chest" : "loot-sack", state: shut(r.opened), open: !!r.opened }));
    }
    // A camp's cages, along its top: "!" over each you can open (its guards beaten, or none to see).
    r.cages?.forEach((cage, i) => {
      const q = placed.spot(`${id}#${i}`);
      if (q) out.push(thingOf({ key: `${id}#${i}`, room: id, ...q, def: "cage", state: shut(cage.opened), cage: i, open: !!cage.opened, flag: !cage.opened && (!hasFight(r) || r.done) }));
    });
    return out;
  });
}

// The cells nothing may walk into: solid things, campfires, solid decor. (A
// thing off its panel's middle, from world version 4, blocks the panel it's in:
// the generator keeps each solid thing inside one.)
export const solidCells = (things: Thing[], fires: Campfire[], decor: Decor[]) =>
  new Set([...things.filter((t) => t.solid), ...fires, ...decor.filter((d) => d.solid)].map((t) => `${panelAt(t.x)},${panelAt(t.y)}`));

// Where you may walk: what the forward rule allows (layout.ts stepRule), only
// where you've seen (known: null for the walking rules alone), and never into
// anything solid.
export function walkRule(layout: Layout, plan: Floorplan, p: Progress, known: Uint8Array | null, solid: Set<string>): CanStep {
  const forward = stepRule(layout, plan, p);
  return known
    ? (from, to) => forward(from, to) && known[to.y * plan.w + to.x] === 1 && !solid.has(`${to.x},${to.y}`)
    : (from, to) => forward(from, to) && !solid.has(`${to.x},${to.y}`);
}

// A thing has two positions (world-spec §8, "Using things in v4 runs"):
// - where it stands (t.x, t.y): its footprint's middle, where it's drawn, and
//   so where a tap lands on it. From world version 4 that may be off its
//   panel's middle (a chest at its panel's back, a sack in a corner);
// - the panel it's in (usedFrom): where it's used from while walking is on
//   panels. Walking is blocked there (solidCells), you walk up to a panel round
//   it (approach), you're in reach of it from there (inReach), and you must
//   have seen it to tap it (tappedThing). Never the position itself as a grid
//   cell: off a panel's middle it isn't one.
export const usedFrom = (t: Pt): Pt => ({ x: panelAt(t.x), y: panelAt(t.y) });

// How far a tap is from a thing as drawn (or from someone's body: they stand a
// cell tall), and whether that's close enough to tap it.
function tapDistance(t: Thing, q: Pt): number {
  const base = Math.hypot(t.x - q.x, t.y - q.y);
  return objectDef(t.def).interact?.tapBody ? Math.min(base, Math.hypot(t.x - q.x, t.y - 1 - q.y)) : base;
}
export const tapsThing = (t: Thing, q: Pt): boolean => !t.inert && tapDistance(t, q) <= (objectDef(t.def).interact?.tap ?? TAP_OBJECT);

// The thing a tap at q picks, of those you've seen (known: the seen-map, w
// across): the one drawn nearest the tap, so of two things in or by one panel
// it's the one you tapped (in the list's order on a tie). Undefined: none.
export function tappedThing(things: Thing[], q: Pt, known: Uint8Array, w: number): Thing | undefined {
  let best: Thing | undefined, bestD = Infinity;
  for (const t of things) {
    const p = usedFrom(t);
    if (!tapsThing(t, q) || known[p.y * w + p.x] !== 1) continue;
    const d = tapDistance(t, q);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}
// Close enough to use it: within its reach of the panel it's in.
export const inReach = (t: Thing, you: Pt) => {
  const p = usedFrom(t);
  return Math.hypot(p.x - you.x, p.y - you.y) <= (objectDef(t.def).interact?.reach ?? REACH_OBJECT);
};

// The shortest way from `from` up beside a thing (onto it, if it isn't
// solid), by its interaction points round the panel it's in; null if there's none.
export function approach(plan: Floorplan, t: Thing, from: Pt, can: CanStep): Pt[] | null {
  let best: Pt[] | null = null;
  const p = usedFrom(t);
  for (const { dx, dy } of objectDef(t.def).interact?.points ?? []) {
    const n = { x: p.x + dx, y: p.y + dy };
    if ((dx || dy || !t.solid) && walkable(plan, n.x, n.y)) {
      const way = findPath(plan, from, n, can);
      if (way && (!best || way.length < best.length)) best = way;
    }
  }
  return best;
}
// The joystick's use button: the thing you're in reach of and have seen
// (unopened ones first, then the nearest), or undefined.
export function usableNear(things: Thing[], you: Pt, known: Uint8Array, w: number): Thing | undefined {
  let best: Thing | undefined, bestD = Infinity;
  for (const t of things) {
    const p = usedFrom(t);
    if (t.inert || !inReach(t, you) || known[p.y * w + p.x] !== 1) continue;
    const d = Math.hypot(p.x - you.x, p.y - you.y) + (t.open ? 100 : 0);
    if (d < bestD) { best = t; bestD = d; }
  }
  return best;
}
