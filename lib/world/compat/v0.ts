// lib/world/compat/v0.ts
// The one place the old placers are run (frozen copies: v0Placers.ts) to give
// a walkable run its saved placements (docs/world-spec.md §7, §8 phase 2a): a
// run saved before them (v0), brought up to world version 2, and a v1 or v2
// run mended at the player's say-so. New runs are placed by lib/world/place.ts
// (version 3). Nothing in play or drawing calls the placers: they read the
// run's `placed` (lib/world/placements.ts). A test checks that.
//
// What it gives, each with a stable id, an anchor subcell (its panel's centre:
// everything here stands on one) and `legacy: "panel"`:
// - wall torches (`<room>:<n>`, as torch.ts names them, which `lit` already
//   uses), with the wall they're on and whether they start lit;
// - candles (`candle:<room>`), all of them: one by a campfire is hidden from
//   run state when the room is built, as before;
// - each room's feature at its middle (`<room>:<def>`), a large room's stores
//   (`<room>:stores`), and a camp's cages (`<room>#<i>`, as the taps name them);
// - the card witch where she starts (`<room>:witch`), and her starting look;
// - each fight room's foes where they start (`<room>:foe:<i>`: legacyFoePlacements).
// Not the lab's decor (phase 2b).
//
// All but the foes depend only on the run's seed, layout and rooms' kinds,
// never on what you've done, so making them twice gives the same list. The
// foes depend on which rooms are beaten, so they're made once and saved.

import { roomCentre, layoutFloorplan } from "../../dungeon/layout";
import { type Sconce } from "../../dungeon/torch";
import { spawnOf, parentOf, type Foe } from "../../dungeon/foes";
import { waitsHere, type WalkRun } from "../../dungeon/walkRun";
import { hasFight, type DungeonId, type Room } from "../../dungeon/run";
import type { DungeonMap } from "../../dungeon/map";
import type { Pt } from "../../dungeon/floorplan";
import { seeded, roomIds, centresOf, fightsLater } from "../walkWorld";
import { panelAnchor } from "../grid";
import type { Instance } from "../objects";
import { placeSconces, placeCandles, placeFoes, placeWaiter, cageSpots } from "./v0Placers";

const WALLS: Record<NonNullable<Sconce["wall"]>, NonNullable<Instance["wall"]>> = { top: "north", left: "west", right: "east" };

// An instance standing at the centre of the panel `at`. Every placer here puts
// things on whole panels; one that didn't would be a bug, so it throws rather
// than round.
function at(id: string, def: string, room: string, p: Pt, extra: Partial<Instance> = {}): Instance {
  const a = panelAnchor(p);
  if (!a) throw new Error(`placement ${id} is off a panel's centre (${p.x}, ${p.y})`);
  return { id, def, room, ...a, ...extra, legacy: "panel" };
}

// The features a room can show at its middle (lib/world/walkWorld.ts thingsOf
// decides from run state which, and how). Made for everything a room's kind
// can show, so one not shown yet is already there.
function featuresOf(r: Room): { key: string; def: string }[] {
  switch (r.kind) {
    case "chest": case "treasure": return [{ key: "chest", def: "chest" }];
    case "stash": return [{ key: "sack", def: "sack" }];
    case "pool": return [{ key: "pool", def: "pool" }];
    case "cards": return [{ key: "card-deck", def: "card-deck" }];
    case "merchant": return [{ key: "merchant", def: "merchant" }];
    case "librarian": return [{ key: "librarian", def: "librarian" }];
    case "library": return [{ key: "librarian", def: "librarian" }, { key: "stores", def: "sack" }];
    case "storehouse": return [{ key: "stores", def: "rickety-chest" }];
    default: return [];
  }
}

// Everything today's placers place in a walkable run, as instances.
export function legacyPlacements(walk: WalkRun, map: DungeonMap, room: (id: string) => Room | undefined): Instance[] {
  const layout = walk.layout, plan = layoutFloorplan(layout);
  const out: Instance[] = [];
  // Wall torches and candles, each kind on its own stream from the run's seed (as the walk screen always had them).
  for (const c of placeSconces(plan, layout.start, seeded(walk.seed + 505), true)) {
    out.push(at(c.id, c.wall && c.wall !== "top" ? "sconce-side" : "sconce", c.room, c, { wall: WALLS[c.wall ?? "top"], ...(c.lit ? { start: "lit" as const } : {}) }));
  }
  for (const c of placeCandles(plan, centresOf(layout), [layout.start, layout.boss], seeded(walk.seed + 606))) out.push(at(c.id, "candle", c.room, c));
  // Each room's things at its middle, and a camp's cages along its top.
  const ids = roomIds(layout, map);
  for (const id of ids) {
    const r = room(id);
    if (!r) continue;
    const c = roomCentre(layout.rooms[parentOf(id)]);
    for (const f of featuresOf(r)) out.push(at(`${id}:${f.key}`, f.def, id, c));
    if (r.cages?.length) cageSpots(plan, parentOf(id), r.cages.length).forEach((q, i) => out.push(at(`${id}#${i}`, "cage", id, q)));
  }
  // The card witch, on her own stream: where she starts, and which way she looks.
  const npcRng = seeded(walk.seed + 404);
  for (const id of ids) {
    if (room(id)?.kind !== "witch") continue;
    for (const f of placeFoes(plan, id, 1, npcRng)) out.push(at(`${id}:witch`, "witch", id, f, { facing: f.facing }));
  }
  return out;
}

// Each fight room's foes where they start, exactly as the walk screen worked
// them out before the foe fix (phase 2a′): on one stream from the run's seed,
// room by room, for the rooms still to beat; two dens in a room keep to an end
// each; a boss waits at the top. That stream skipped the rooms beaten so far,
// so beating one moved everyone else: made once instead, when a run is made or
// first opened since, and saved. At that moment they're what the game showed.
// An ambush not yet sprung showed none: its foes come after the rest, on the
// same stream, so they're saved too and nobody else's start moves.
export function legacyFoePlacements(walk: WalkRun, map: DungeonMap, dungeon: DungeonId, room: (id: string) => Room | undefined): Instance[] {
  const plan = layoutFloorplan(walk.layout), ids = roomIds(walk.layout, map);
  const rng = seeded(walk.seed + 303);
  const startsIn = (id: string): Foe[] => {
    const r = room(id)!;
    if (waitsHere(r, dungeon)) return [placeWaiter(plan, id)];
    const end = map.nodes[spawnOf(parentOf(id))] ? (id === parentOf(id) ? 0 : 1) : undefined;
    return r.enemies ? placeFoes(plan, id, r.enemies.length, rng, end) : [];
  };
  const toBeat = (id: string, later: boolean) => { const r = room(id); return !!r && !r.done && (later ? fightsLater(r) : hasFight(r)); };
  const order = [...ids.filter((id) => toBeat(id, false)), ...ids.filter((id) => toBeat(id, true))];
  return order.flatMap(startsIn).map((f) => at(`${f.room}:foe:${f.index}`, "foe", f.room, f, {
    facing: f.facing,
    foe: f.waits ? { waits: true } : { ...(f.walks ? { walks: true as const } : {}), wait: f.wait, ...(f.end !== undefined ? { end: f.end } : {}) },
  }));
}
