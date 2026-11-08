// lib/world/placements.ts
// A walkable run's contents, built from what was generated in it (its saved
// `placed`, lib/world/compat/v0.ts) with what you've done laid over it (docs/
// world-spec.md §3: where a thing was put never changes; what's become of it
// is run state). The walk screen reads this, never the placers.
//
// Run state laid over: a wall torch or candle burns if it started lit or you
// lit it (`lit`); a candle the old rules put by a campfire isn't there
// (`fires`: new runs' placer keeps candles away from fires instead). Whether each
// room's thing is shown, and how, is decided where it's drawn (walkWorld.ts
// thingsOf), from the rooms as they stand.

import type { Sconce, Candle } from "../dungeon/torch";
import type { Foe } from "../dungeon/foes";
import type { WalkRun } from "../dungeon/walkRun";
import type { Pt } from "../dungeon/floorplan";
import { anchorPoint } from "./grid";
import type { Instance } from "./objects";

export type Placements = {
  sconces: Sconce[];
  candles: Candle[];
  witches: Foe[];                        // where each card witch starts (she walks about from there, this visit only)
  foes: Foe[];                           // where each foe starts, beaten or not (walkWorld.ts foeStarts picks the rooms still to beat)
  spot: (id: string) => Pt | undefined;  // where an instance stands (a room's feature, a cage), by id
};

// (Nothing is put on a south wall yet: §5.6's wall candles come with their art.)
const WALLS: Partial<Record<NonNullable<Instance["wall"]>, NonNullable<Sconce["wall"]>>> = { north: "top", west: "left", east: "right" };

// A candle this close to a campfire isn't lit or drawn (the fire's taken its place).
const BY_FIRE = 2;

export function placementsFrom(placed: Instance[], walk: Pick<WalkRun, "lit" | "fires" | "layout">): Placements {
  const lit = new Set(walk.lit ?? []), fires = walk.fires ?? [];
  const sconces: Sconce[] = [], candles: Candle[] = [], witches: Foe[] = [], foes: Foe[] = [];
  const spots = new Map<string, Pt>();
  for (const i of placed) {
    const p = anchorPoint(i);
    spots.set(i.id, p);
    if (i.def === "sconce" || i.def === "sconce-side") {
      const s: Sconce = { id: i.id, room: i.room, ...p, lit: i.start === "lit" || lit.has(i.id) };
      // (As torch.ts gives them: a room's torches are all on its top wall and carry no `wall`; a tunnel's say which.)
      sconces.push(i.wall && !walk.layout.rooms[i.room] ? { ...s, wall: WALLS[i.wall] } : s);
    } else if (i.def === "candle") {
      if (i.legacy && fires.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < BY_FIRE)) continue;
      candles.push({ id: i.id, room: i.room, ...p, lit: lit.has(i.id) });
    } else if (i.def === "witch") {
      witches.push({ room: i.room, index: 0, ...p, facing: i.facing ?? 0, walks: true, path: [], wait: 1 });
    } else if (i.def === "foe" && i.foe) {
      const f = i.foe, index = Number(i.id.slice(i.id.lastIndexOf(":") + 1));
      foes.push({ room: i.room, index, ...p, facing: i.facing ?? 0, walks: !!f.walks, path: [], wait: f.waits ? Infinity : f.wait ?? 0,
        ...(f.waits ? { waits: true } : {}), ...(f.end !== undefined ? { end: f.end } : {}) });
    }
  }
  return { sconces, candles, witches, foes, spot: (id) => spots.get(id) };
}
