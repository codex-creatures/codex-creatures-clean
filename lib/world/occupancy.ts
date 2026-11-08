// lib/world/occupancy.ts
// What's where in a walkable run's floor, for placing things (docs/world-spec.md
// §5.1, §5.2; phase 2b). One map for the run, at subcell resolution, with its
// kinds of space kept apart:
// - blocking floor: solid things' footprints (and pillars, which are rock in
//   the layout: their panels' subcells are marked so the same rules see them);
// - walk-over floor: candles and the like, which may sit on a path;
// - panels taken: while things still each fill a panel (FULL_PANEL, 2b-1), a
//   floor thing claims its whole panel, so nothing else goes there;
// - wall slots: three a panel's wall, on each wall (north, east, west, south);
// - reservations (whole panels, as walking is on panels): doors, required
//   paths, and the points things must stand at (a room's middle, the cages, a
//   waiting boss's stand), each with the one thing allowed on it;
// - keep-clear zones round a thing (a campfire keeps candles off).
// Every placement asks `canPlace` (or `canStand` for someone standing), and
// nothing else decides; navigation is worked out from it (`navBlocked`).

import { FLOOR, type Floorplan, type Pt } from "../dungeon/floorplan";
import { footprintCells, footprintPanels, subcellOfPanel, SUBCELLS, type Size } from "./grid";
import type { ObjectDef } from "./objects";

// 2b-1 (the user, 2026-11-08): every floor thing still takes its own whole
// panel. Things sharing a panel at their real sizes is a later, approved change.
export const FULL_PANEL = true;

export type Reserve = "door" | "path" | "point";
export type Wall = "north" | "east" | "west" | "south";
type Zone = { at: Pt; r: number; against: ObjectDef["kind"][]; who: string };

export type Occupancy = {
  fp: Floorplan;
  solid: Map<string, string>;     // subcell → what blocks it
  over: Map<string, string>;      // subcell → what lies on it, walked over
  panels: Map<string, string>;    // panel → the floor thing that has it (FULL_PANEL)
  reserved: Map<string, { why: Reserve; owner?: string }>; // panel → why it's kept
  slots: Map<string, string>;     // wall slot → what's on it
  zones: Zone[];
};

const sub = (sx: number, sy: number) => `${sx},${sy}`;
export const panelKey = (p: Pt) => `${p.x},${p.y}`;
export const slotKey = (p: Pt, wall: Wall, k: -1 | 0 | 1 = 0) => `${p.x},${p.y},${wall},${k}`;

export const newOccupancy = (fp: Floorplan): Occupancy =>
  ({ fp, solid: new Map(), over: new Map(), panels: new Map(), reserved: new Map(), slots: new Map(), zones: [] });

// A room's floor panel (not rock, a tunnel or a door).
export const isFloor = (o: Occupancy, p: Pt) => p.x >= 0 && p.y >= 0 && p.x < o.fp.w && p.y < o.fp.h && o.fp.tiles[p.y * o.fp.w + p.x] === FLOOR;

const panelCells = (p: Pt) => footprintCells({ sx: subcellOfPanel(p.x), sy: subcellOfPanel(p.y) }, { w: SUBCELLS, d: SUBCELLS });

// Solid stone standing in a panel (a pillar: rock inside a room, interior.ts).
export function markStone(o: Occupancy, p: Pt, who = "pillar") {
  for (const c of panelCells(p)) o.solid.set(sub(c.sx, c.sy), who);
}

// Something blocks walking through this panel (today's rule while walking is
// on panels: any solid subcell in it, or rock).
export function navBlocked(o: Occupancy, p: Pt): boolean {
  const t = p.x < 0 || p.y < 0 || p.x >= o.fp.w || p.y >= o.fp.h ? 0 : o.fp.tiles[p.y * o.fp.w + p.x];
  return t === 0 || panelCells(p).some((c) => o.solid.has(sub(c.sx, c.sy)));
}

export function reserve(o: Occupancy, p: Pt, why: Reserve, owner?: string) {
  const had = o.reserved.get(panelKey(p));
  // A door or a point outranks a path through it; the first point keeps its owner.
  if (had && (had.why !== "path" || why === "path")) return;
  o.reserved.set(panelKey(p), { why, ...(owner ? { owner } : {}) });
}

export const keepClear = (o: Occupancy, at: Pt, r: number, against: ObjectDef["kind"][], who: string) => { o.zones.push({ at, r, against, who }); };

// Why a floor thing can't go here (its anchor subcell), or null if it can.
// owner: the id it's placed as, for the point kept for it.
export function canPlace(o: Occupancy, def: ObjectDef, at: { sx: number; sy: number }, owner: string, size: Size = def.footprint): string | null {
  if (def.attach !== "floor") return `${def.id} isn't a floor thing`;
  const cells = footprintCells(at, size);
  const panels = footprintPanels(at, size);
  for (const p of panels) if (!isFloor(o, p)) return `off the floor at ${p.x},${p.y}`;
  for (const c of cells) if (o.solid.has(sub(c.sx, c.sy))) return `on ${o.solid.get(sub(c.sx, c.sy))}`;
  if (def.collision === "solid") for (const c of cells) if (o.over.has(sub(c.sx, c.sy))) return `on ${o.over.get(sub(c.sx, c.sy))}`;
  for (const p of panels) {
    if (FULL_PANEL && o.panels.has(panelKey(p))) return `on ${o.panels.get(panelKey(p))}'s panel`;
    const r = o.reserved.get(panelKey(p));
    if (!r || r.owner === owner) continue;
    if (r.why === "door") return "in a doorway";
    if (r.why === "point") return `on the spot kept for ${r.owner}`;
    if (r.why === "path" && def.collision === "solid") return "across a required path";
  }
  for (const z of o.zones) if (z.against.includes(def.kind) && panels.some((p) => Math.hypot(p.x - z.at.x, p.y - z.at.y) < z.r)) return `too near ${z.who}`;
  return null;
}

// Puts it there (after canPlace said it may go).
export function take(o: Occupancy, def: ObjectDef, at: { sx: number; sy: number }, owner: string, size: Size = def.footprint) {
  const layer = def.collision === "solid" ? o.solid : o.over;
  for (const c of footprintCells(at, size)) layer.set(sub(c.sx, c.sy), owner);
  if (FULL_PANEL) for (const p of footprintPanels(at, size)) o.panels.set(panelKey(p), owner);
}

// Why someone (a foe, the witch) can't start on this panel, or null if they
// can: on the floor, nothing solid or placed there, not in a doorway or on a
// spot kept for something else (owner: the spot kept for them, a boss's stand).
export function canStand(o: Occupancy, p: Pt, owner?: string): string | null {
  if (!isFloor(o, p)) return "off the floor";
  if (navBlocked(o, p)) return "on something solid";
  if (o.panels.has(panelKey(p))) return `on ${o.panels.get(panelKey(p))}'s panel`;
  const r = o.reserved.get(panelKey(p));
  if (r && r.owner !== owner && r.why !== "path") return r.why === "door" ? "in a doorway" : `on the spot kept for ${r.owner}`;
  return null;
}

// Wall slots: one thing each.
export const slotFree = (o: Occupancy, key: string) => !o.slots.has(key);
export const takeSlot = (o: Occupancy, key: string, owner: string) => { o.slots.set(key, owner); };
