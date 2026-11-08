// lib/world/occupancy.ts
// What's where in a walkable run, physically, for placing things (docs/world-
// spec.md §5.1, §5.2, §8 2b-2 stage A). One map for the run, in subcells, made
// of named layers, each with its own rule for what may share a subcell with it
// (OVERLAPS):
// - structure: stone standing in a room (a pillar: rock in the layout). Walls
//   and tunnels are structure too, and simply aren't floor;
// - blocking: solid things' footprints;
// - walk-over: things on the floor you walk over (candles, skulls);
// - trigger: areas that may lie under anything on the floor (pressure plates,
//   trap zones, hidden catches: none yet);
// - overhead: things hanging over the floor (none yet);
// - attachment: slots on structure's faces, keyed by the stone panel and the
//   face looking onto the floor: walls' and pillars' (attachmentSlots).
// Kept alongside: each thing's clearance (the subcells round it others keep
// off), reservations (doors, required paths, the spots things must stand at;
// whole panels for now), and keep-clear zones (a campfire keeps candles off).
//
// The map holds any footprints: several small solid things in a panel, one
// thing across several panels, triggers under anything. What the generator
// chooses to make, and how walking reads the map, are temporary policies kept
// in lib/world/policy.ts (while movement is on panels), never assumed here.

import { FLOOR, ROCK, type Floorplan, type Pt } from "../dungeon/floorplan";
import { footprintCells, footprintPanels, subcellOfPanel, subcellCentre, SUBCELLS, type Size } from "./grid";
import type { ObjectDef } from "./objects";

export type Layer = "structure" | "blocking" | "walk-over" | "trigger" | "overhead";
export const LAYERS: Layer[] = ["structure", "blocking", "walk-over", "trigger", "overhead"];
// Which layers may share a subcell with which (symmetric; a layer never shares
// with itself, unless that's added here for a kind that stacks).
export const OVERLAPS: Record<Layer, Layer[]> = {
  structure: [],
  blocking: ["trigger", "overhead"],
  "walk-over": ["trigger", "overhead"],
  trigger: ["blocking", "walk-over", "overhead"],
  overhead: ["blocking", "walk-over", "trigger"],
};

export type Reserve = "door" | "path" | "point";
export type Wall = "north" | "east" | "west" | "south";
type Zone = { at: Pt; r: number; against: ObjectDef["kind"][]; who: string };

export type Occupancy = {
  fp: Floorplan;
  layers: Record<Layer, Map<string, string>>;  // subcell → whose it is, layer by layer
  attached: Map<string, string>;               // attachment slot → what's on it
  clear: Map<string, string>;                  // subcell → whose clearance it's in
  clearances: boolean;                         // kept? (a world version 3 run was placed before they were)
  reserved: Map<string, { why: Reserve; owner?: string }>; // panel → why it's kept
  zones: Zone[];
};

export const subKey = (sx: number, sy: number) => `${sx},${sy}`;
export const panelKey = (p: Pt) => `${p.x},${p.y}`;
type Sub = { sx: number; sy: number };

export const newOccupancy = (fp: Floorplan, clearances = true): Occupancy => ({
  fp, clearances, attached: new Map(), clear: new Map(), reserved: new Map(), zones: [],
  layers: { structure: new Map(), blocking: new Map(), "walk-over": new Map(), trigger: new Map(), overhead: new Map() },
});

// Which layer a definition's footprint goes in (null: none, as a creature's).
export function layerOf(def: ObjectDef): Layer | null {
  if (def.occupies) return def.occupies;
  if (def.attach === "overhead") return "overhead";
  if (def.attach !== "floor") return null; // (wall things take an attachment slot instead)
  return def.collision === "solid" ? "blocking" : def.collision === "walk-over" ? "walk-over" : null;
}

export const isFloor = (o: Occupancy, p: Pt) => p.x >= 0 && p.y >= 0 && p.x < o.fp.w && p.y < o.fp.h && o.fp.tiles[p.y * o.fp.w + p.x] === FLOOR;
const isRock = (fp: Floorplan, p: Pt) => p.x < 0 || p.y < 0 || p.x >= fp.w || p.y >= fp.h || fp.tiles[p.y * fp.w + p.x] === ROCK;
export const panelCells = (p: Pt) => footprintCells({ sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) }, { w: SUBCELLS, d: SUBCELLS });

// Whose subcell this is in a layer, or anyone's in any layer that won't share with `mine`.
export const occupant = (o: Occupancy, layer: Layer, c: Sub) => o.layers[layer].get(subKey(c.sx, c.sy));
function clash(o: Occupancy, mine: Layer, c: Sub): string | null {
  for (const l of LAYERS) {
    if (OVERLAPS[mine].includes(l)) continue;
    const who = o.layers[l].get(subKey(c.sx, c.sy));
    if (who) return who;
  }
  return null;
}

// Stone standing in a panel (a pillar).
export function markStone(o: Occupancy, p: Pt, who = "pillar") {
  for (const c of panelCells(p)) o.layers.structure.set(subKey(c.sx, c.sy), who);
}

export function reserve(o: Occupancy, p: Pt, why: Reserve, owner?: string) {
  const had = o.reserved.get(panelKey(p));
  // A door or a point outranks a path through it; the first point keeps its owner.
  if (had && (had.why !== "path" || why === "path")) return;
  o.reserved.set(panelKey(p), { why, ...(owner ? { owner } : {}) });
}

export const keepClear = (o: Occupancy, at: Pt, r: number, against: ObjectDef["kind"][], who: string) => { o.zones.push({ at, r, against, who }); };

// The subcells a thing keeps others off (its definition's clearance): all
// round it, or only the row in front (south) of it.
export function clearanceCells(def: ObjectDef, at: Sub, size: Size = def.footprint): Sub[] {
  const n = def.clearance ?? 0;
  if (!n) return [];
  const cells = footprintCells(at, size);
  const x0 = Math.min(...cells.map((c) => c.sx)), x1 = Math.max(...cells.map((c) => c.sx));
  const y0 = Math.min(...cells.map((c) => c.sy)), y1 = Math.max(...cells.map((c) => c.sy));
  const out: Sub[] = [];
  if (def.clearFront) { for (let y = y1 + 1; y <= y1 + n; y++) for (let x = x0; x <= x1; x++) out.push({ sx: x, sy: y }); return out; }
  for (let y = y0 - n; y <= y1 + n; y++) for (let x = x0 - n; x <= x1 + n; x++) if (x < x0 || x > x1 || y < y0 || y > y1) out.push({ sx: x, sy: y });
  return out;
}

// Why a thing can't go here (its anchor subcell), or null if it can: every
// subcell on the floor, sharing only with layers its own layer allows, out of
// others' clearances and with its own clear (stone may border it), off doors
// and spots kept for others (and, if solid, off required paths), out of zones.
// owner: the id it's placed as (the spot kept for it, its own clearance).
export function canPlace(o: Occupancy, def: ObjectDef, at: Sub, owner: string, size: Size = def.footprint): string | null {
  const mine = layerOf(def);
  if (!mine) return `${def.id} takes no floor`;
  const cells = footprintCells(at, size), panels = footprintPanels(at, size);
  for (const p of panels) if (!isFloor(o, p)) return `off the floor at ${p.x},${p.y}`;
  for (const c of cells) { const who = clash(o, mine, c); if (who) return `on ${who}`; }
  if (o.clearances && mine !== "trigger" && mine !== "overhead") {
    for (const c of cells) { const who = o.clear.get(subKey(c.sx, c.sy)); if (who && who !== owner) return `in ${who}'s clearance`; }
    for (const c of clearanceCells(def, at, size)) {
      const who = o.layers.blocking.get(subKey(c.sx, c.sy)) ?? o.layers["walk-over"].get(subKey(c.sx, c.sy));
      if (who) return `${who} in its clearance`;
    }
  }
  for (const p of panels) {
    const r = o.reserved.get(panelKey(p));
    if (!r || r.owner === owner || mine === "trigger" || mine === "overhead") continue;
    if (r.why === "door") return "in a doorway";
    if (r.why === "point") return `on the spot kept for ${r.owner}`;
    if (r.why === "path" && mine === "blocking") return "across a required path";
  }
  for (const z of o.zones) if (z.against.includes(def.kind) && panels.some((p) => Math.hypot(p.x - z.at.x, p.y - z.at.y) < z.r)) return `too near ${z.who}`;
  return null;
}

// Puts it there (after canPlace said it may go).
export function take(o: Occupancy, def: ObjectDef, at: Sub, owner: string, size: Size = def.footprint) {
  const mine = layerOf(def);
  if (!mine) return;
  for (const c of footprintCells(at, size)) o.layers[mine].set(subKey(c.sx, c.sy), owner);
  if (o.clearances) for (const c of clearanceCells(def, at, size)) if (!o.clear.has(subKey(c.sx, c.sy))) o.clear.set(subKey(c.sx, c.sy), owner);
}

// Room for a body of this footprint round a panel's centre (a creature's size
// class, its feet on the centre): every subcell on the floor, nothing blocking
// or stone in it, or within `clearance` of it. Why not, or null.
export function roomFor(o: Occupancy, p: Pt, size: Size, clearance = 0): string | null {
  const at = { sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) };
  const grown = { w: size.w + 2 * clearance, d: size.d + 2 * clearance };
  for (const q of footprintPanels(at, grown)) if (!isFloor(o, q)) return `no floor for its size at ${q.x},${q.y}`;
  for (const c of footprintCells(at, grown)) {
    const who = occupant(o, "structure", c) ?? occupant(o, "blocking", c);
    if (who) return `${who} in its way`;
  }
  return null;
}

// --- Attachment: slots on structure's faces -----------------------------------

// A slot: on stone panel `rock`, its face looking onto the floor panel `floor`
// (the wall that floor has on that side: "north" = the wall north of it), one
// of three along the face (k: −1, 0, +1, west to east or north to south). kind:
// a room's or tunnel's wall, or a pillar standing in a room.
export type Slot = { key: string; rock: Pt; floor: Pt; wall: Wall; k: -1 | 0 | 1; kind: "wall" | "pillar" };
const STEP: Record<Wall, Pt> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 }, east: { x: 1, y: 0 } };

// The key of the slot on `floor`'s `wall` (the stone beside it on that side).
export const slotKey = (floor: Pt, wall: Wall, k: -1 | 0 | 1 = 0) => {
  const s = STEP[wall];
  return `${floor.x + s.x},${floor.y + s.y},${wall},${k}`;
};

// Every slot in the run: each face of a stone panel that looks onto a walkable one.
export function attachmentSlots(fp: Floorplan): Slot[] {
  const inRoom = (p: Pt) => Object.values(fp.rooms).some((rs) => rs.some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h));
  const out: Slot[] = [];
  for (let y = 0; y < fp.h; y++) for (let x = 0; x < fp.w; x++) {
    const floor = { x, y };
    if (isRock(fp, floor)) continue;
    for (const wall of ["north", "east", "west", "south"] as Wall[]) {
      const rock = { x: x + STEP[wall].x, y: y + STEP[wall].y };
      if (!isRock(fp, rock)) continue;
      const kind = inRoom(rock) ? "pillar" : "wall";
      for (const k of [-1, 0, 1] as const) out.push({ key: slotKey(floor, wall, k), rock, floor, wall, k, kind });
    }
  }
  return out;
}

// Where a slot is in the world (u): on its face, between the stone and the
// floor, a third of a panel along it per k. Things mounted there are drawn there.
export function slotPoint(s: Slot): Pt {
  const d = STEP[s.wall], along = s.k / SUBCELLS;
  return { x: s.floor.x + d.x / 2 + (d.x ? 0 : along), y: s.floor.y + d.y / 2 + (d.y ? 0 : along) };
}
// …and the floor subcell in front of it, where grid lighting starts for a light
// mounted there (the light itself conceptually comes from slotPoint).
export function slotLightCell(s: Slot): Sub {
  const d = STEP[s.wall], c = { sx: subcellOfPanel(s.floor.x), sy: subcellOfPanel(s.floor.y) };
  return { sx: c.sx + d.x + (d.x ? 0 : s.k), sy: c.sy + d.y + (d.y ? 0 : s.k) };
}
export const subcellPoint = (c: Sub): Pt => ({ x: subcellCentre(c.sx), y: subcellCentre(c.sy) });

export const slotFree = (o: Occupancy, key: string) => !o.attached.has(key);
export const takeSlot = (o: Occupancy, key: string, owner: string) => { o.attached.set(key, owner); };
