// lib/world/placements.ts
// A walkable run's contents, built from what was generated in it (its saved
// `placed`, lib/world/compat/v0.ts) with what you've done laid over it (docs/
// world-spec.md §3: where a thing was put never changes; what's become of it
// is run state). The walk screen reads this, never the placers.
//
// Run state laid over: a wall torch or candle burns if it started lit or you
// lit it (`lit`); (world version 5) a candle on a wall or pillar is a candle
// standing at the floor in front of it, its light from that floor panel; a
// floor candle is a candle like any other (walk near and it lights); a candle
// the old rules put by a campfire isn't there (`fires`: new runs' placer keeps
// candles away from fires instead). Whether each
// room's thing is shown, and how, is decided where it's drawn (walkWorld.ts
// thingsOf), from the rooms as they stand.

import type { Sconce, Candle } from "../dungeon/torch";
import type { Foe } from "../dungeon/foes";
import type { WalkRun } from "../dungeon/walkRun";
import type { Pt } from "../dungeon/floorplan";
import { anchorPoint, footprintCells, SUBCELLS } from "./grid";
import { TABLE_TOP, type Instance } from "./objects";

export type Placements = {
  sconces: Sconce[];
  candles: Candle[];
  witches: Foe[];                        // where each card witch starts (she walks about from there, this visit only)
  foes: Foe[];                           // where each foe starts, beaten or not (walkWorld.ts foeStarts picks the rooms still to beat)
  spot: (id: string) => Pt | undefined;  // where an instance stands (a room's feature, a cage), by id
  decks?: Set<string>;                   // (world version 13) the tables a deck of cards lies on, by id
  codexes?: Set<string>;                 // (world version 14) the bookcases against walls with a codex in, by id
  v?: number;                            // the world version they were placed by
};

// (Torches are never on a south wall; v5's candles there are read as candles, below.)
const WALLS: Partial<Record<NonNullable<Instance["wall"]>, NonNullable<Sconce["wall"]>>> = { north: "top", west: "left", east: "right" };

// (v5) Candles on a wall or a pillar's face (place.ts MOUNTED_DEFS: not imported, to keep this light).
const MOUNTED = new Set(["candle-wall", "candle-wall-side", "candle-wall-south"]);

// A candle this close to a campfire isn't lit or drawn (the fire's taken its place).
const BY_FIRE = 2;

// Where a thing stands, in u: its anchor's centre; from world version 4, a floor
// thing's footprint's middle (an even size's anchor is off its middle, §3).
function spotOf(i: Instance, v: number): Pt {
  if (v < 4 || !i.size || (!i.size.w && !i.size.d)) return anchorPoint(i);
  const cells = footprintCells(i, i.size, i.rot ?? 0);
  const xs = cells.map((c) => c.sx), ys = cells.map((c) => c.sy);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2 / SUBCELLS, y: (Math.min(...ys) + Math.max(...ys)) / 2 / SUBCELLS };
}

export function placementsFrom(placed: Instance[], walk: Pick<WalkRun, "lit" | "fires" | "layout" | "v">): Placements {
  const lit = new Set(walk.lit ?? []), fires = walk.fires ?? [];
  const sconces: Sconce[] = [], candles: Candle[] = [], witches: Foe[] = [], foes: Foe[] = [];
  const spots = new Map<string, Pt>();
  for (const i of placed) {
    const p = spotOf(i, walk.v ?? 0);
    spots.set(i.id, p);
    if (i.def === "sconce" || i.def === "sconce-side") {
      const s: Sconce = { id: i.id, room: i.room, ...p, lit: i.start === "lit" || lit.has(i.id) };
      // (As torch.ts gives them: a room's top-wall torches carry no `wall`; a tunnel's say which, and so
      // do a room's on its side walls or a pillar's sides, from world version 8.)
      const side = i.wall === "west" || i.wall === "east";
      sconces.push(i.wall && (!walk.layout.rooms[i.room] || side) ? { ...s, wall: WALLS[i.wall] } : s);
    } else if (i.def === "candle") {
      if (i.legacy && fires.some((f) => Math.hypot(f.x - p.x, f.y - p.y) < BY_FIRE)) continue;
      candles.push({ id: i.id, room: i.room, ...p, lit: lit.has(i.id) });
    } else if (MOUNTED.has(i.def)) {
      candles.push({ id: i.id, room: i.room, ...p, lit: i.start === "lit" || lit.has(i.id) });
    } else if (i.def === "floor-candle") {
      candles.push({ id: i.id, room: i.room, ...p, lit: lit.has(i.id) });
    } else if (i.def === "table" && i.holds === "candle") {
      // (v12) A candle on a table: a candle like a floor one (walk near and it lights), up on the table.
      candles.push({ id: `${i.id}:candle`, room: i.room, ...p, lit: lit.has(`${i.id}:candle`), high: TABLE_TOP });
    } else if (i.def === "witch") {
      witches.push({ room: i.room, index: 0, ...p, facing: i.facing ?? 0, walks: true, path: [], wait: 1 });
    } else if (i.def === "foe" && i.foe) {
      const f = i.foe, index = Number(i.id.slice(i.id.lastIndexOf(":") + 1));
      foes.push({ room: i.room, index, ...p, facing: i.facing ?? 0, walks: !!f.walks, path: [], wait: f.waits ? Infinity : f.wait ?? 0,
        ...(f.waits ? { waits: true } : {}), ...(f.end !== undefined ? { end: f.end } : {}) });
    }
  }
  const decks = new Set(placed.filter((i) => i.def === "table" && i.deck).map((i) => i.id));
  const codexes = new Set(placed.filter((i) => i.def === "bookcase" && i.codex).map((i) => i.id));
  return { sconces, candles, witches, foes, spot: (id) => spots.get(id), decks, codexes, v: walk.v ?? 0 };
}
