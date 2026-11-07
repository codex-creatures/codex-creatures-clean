// lib/dungeon/interior.ts
// What's built inside the walkable Labyrinth's rooms (the user, 2026-11-07:
// rooms felt large and empty, walking them a chore; "fill the big rooms with
// structure, not objects"). Each room may get a layout of solid stone inside
// it: rock tiles in its floor, so it's drawn like the walls (a brick face and
// a mossy cap), blocks the light and foes' sight, and you walk round it. All
// rolled with the layout and kept in it (LayoutRoom.inner), so older runs
// (none) are as they were.
//
// Styles, by the room's shape (STYLES; some rooms have none):
// - pillars: the odd 2×2 pillar or two (PILLARS_MOST), from a grid across the middle;
// - colonnade: two rows of pillars down a long room, a lane between them;
// - alcoves: short stubs of wall out from the long sides, making bays;
// - divider: a wall part way across the middle, from one side, to go round;
// - aisle (the boss's room): pillars down both sides, its middle kept clear.
// The walls (alcoves, divider) and colonnades aren't rolled any more (the
// user, 2026-11-07: "the walls are too obstructing… the odd pillar could
// help"); runs that rolled them keep them (they're in the layout).
// Always kept clear: a margin by the walls (MARGIN: the wall torches, the
// cages, a way round), the doors (DOOR_KEEP), the room's middle (its chest,
// pool or stash: MIDDLE_KEEP), and every floor tile still reachable from
// every door. A style that would break any of that is left out.

import { FLOOR, type Floorplan, type Pt, type Rect } from "./floorplan";
import type { Layout, LayoutRoom } from "./layout";

type Rng = () => number;
export type Style = "pillars" | "colonnade" | "alcoves" | "divider" | "aisle";

export const MARGIN = 2;        // tiles of floor kept clear inside the walls
export const DOOR_KEEP = 3;     // tiles from a door kept clear
export const MIDDLE_KEEP = 2.5; // tiles from the room's middle kept clear
export const PILLAR = 2;        // a pillar's size (tiles)
export const PILLAR_GAP = 4;    // tiles of floor between pillars 🧪
export const PILLARS_MOST = 2;  // lone pillars in a room, at most (1 to this) 🧪
export const AISLE = 4;         // tiles either side of the boss room's middle kept clear 🧪
// How likely each style is, by the room's shape (the rest: none). 🧪
export const STYLES: Record<string, [Style, number][]> = {
  small: [],
  wide: [["pillars", 0.35]],
  tall: [["pillars", 0.35]],
  big: [["pillars", 0.5]],
  "dog-leg": [["pillars", 0.4]],
  large: [["pillars", 0.5]],
  boss: [["aisle", 1]],
  start: [],
};

const pick = (rng: Rng, styles: [Style, number][]): Style | null => {
  let r = rng();
  for (const [s, p] of styles) { if (r < p) return s; r -= p; }
  return null;
};

const shuffle = <T>(rng: Rng, xs: T[]): T[] => {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

// The rock a style puts in one floor rect (before the checks).
function build(style: Style, f: Rect, rng: Rng): Rect[] {
  const x0 = f.x + MARGIN, y0 = f.y + MARGIN, x1 = f.x + f.w - MARGIN, y1 = f.y + f.h - MARGIN; // the inside, walls' margin off
  const out: Rect[] = [];
  const step = PILLAR + PILLAR_GAP;
  const across = f.w >= f.h;
  if (style === "pillars") {
    for (let y = y0 + 1; y + PILLAR <= y1 - 1; y += step) for (let x = x0 + 1; x + PILLAR <= x1 - 1; x += step) out.push({ x, y, w: PILLAR, h: PILLAR });
  } else if (style === "colonnade" || style === "aisle") {
    // Two rows down the long way, a third and two thirds across (the aisle: by the sides).
    const span = across ? y1 - y0 : x1 - x0, lo = across ? y0 : x0;
    const rows = style === "aisle" ? [lo, lo + span - PILLAR] : [lo + Math.floor(span / 3) - 1, lo + Math.ceil((2 * span) / 3) - 1];
    for (const r of rows) {
      if (across) for (let x = x0 + 1; x + PILLAR <= x1 - 1; x += step) out.push({ x, y: r, w: PILLAR, h: PILLAR });
      else for (let y = y0 + 1; y + PILLAR <= y1 - 1; y += step) out.push({ x: r, y, w: PILLAR, h: PILLAR });
    }
  } else if (style === "alcoves") {
    // Stubs a tile thick, 3 long, out from both long walls (from the margin in).
    const len = 3;
    if (across) for (let x = x0 + 2; x + 1 <= x1 - 2; x += step) {
      out.push({ x, y: f.y + 1, w: 1, h: len }, { x, y: f.y + f.h - 1 - len, w: 1, h: len });
    } else for (let y = y0 + 2; y + 1 <= y1 - 2; y += step) {
      out.push({ x: f.x + 1, y, w: len, h: 1 }, { x: f.x + f.w - 1 - len, y, w: len, h: 1 });
    }
  } else if (style === "divider") {
    // Across the middle from one side, leaving a gap at the other (and the middle clear: it bends round it).
    const fromStart = rng() < 0.5;
    if (across) {
      const x = f.x + Math.floor(f.w / 2) + (rng() < 0.5 ? -4 : 3), len = Math.max(0, Math.floor(f.h * 0.6));
      out.push({ x, y: fromStart ? f.y : f.y + f.h - len, w: 1, h: len });
    } else {
      const y = f.y + Math.floor(f.h / 2) + (rng() < 0.5 ? -4 : 3), len = Math.max(0, Math.floor(f.w * 0.6));
      out.push({ x: fromStart ? f.x : f.x + f.w - len, y, w: len, h: 1 });
    }
  }
  return out.filter((r) => r.w > 0 && r.h > 0);
}

// Does this room's rock keep it sound: off its doors and middle (and the
// boss room's aisle), and every floor tile still reachable from a door?
function sound(fp: Floorplan, id: string, rock: Rect[], middle: Pt, boss: boolean): boolean {
  const floors = fp.rooms[id];
  const doors = fp.doors.filter((d) => d.room === id);
  const tiles = new Set<number>();
  for (const r of rock) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (!floors.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h)) return false; // (off its floor: a dog-leg's corner)
    if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_KEEP)) return false;
    if (Math.hypot(x - middle.x, y - middle.y) < MIDDLE_KEEP) return false;
    if (boss && Math.abs(x - middle.x) <= AISLE) return false;
    tiles.add(y * fp.w + x);
  }
  // Every floor tile left reachable from the first door (side by side, not diagonally).
  const inRoom = (x: number, y: number) => floors.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
  const open: number[] = [];
  for (const f of floors) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
    const t = y * fp.w + x;
    if (!tiles.has(t) && fp.tiles[t] === FLOOR && !open.includes(t)) open.push(t);
  }
  const startDoor = doors[0];
  if (!startDoor) return true;
  const seen = new Set<number>();
  const stack: Pt[] = [];
  // In through the door's neighbours on the room's floor.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = startDoor.x + dx, y = startDoor.y + dy, t = y * fp.w + x;
    if (inRoom(x, y) && !tiles.has(t) && fp.tiles[t] === FLOOR && !seen.has(t)) { seen.add(t); stack.push({ x, y }); }
  }
  while (stack.length > 0) {
    const p = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = p.x + dx, y = p.y + dy, t = y * fp.w + x;
      if (!inRoom(x, y) || seen.has(t) || tiles.has(t) || fp.tiles[t] !== FLOOR) continue;
      seen.add(t);
      stack.push({ x, y });
    }
  }
  return open.every((t) => seen.has(t)); // (the doors' own floor included: they're kept clear)
}

// The layout with its rooms' insides built. fp: its floorplan (doors and all).
export function furnish(layout: Layout, fp: Floorplan, middle: (r: LayoutRoom) => Pt, rng: Rng = Math.random): Layout {
  const rooms: Record<string, LayoutRoom> = {};
  for (const r of Object.values(layout.rooms)) {
    const style = pick(rng, STYLES[r.shape] ?? []);
    let inner: Rect[] = [];
    if (style) {
      let rock = fp.rooms[r.id].flatMap((f) => build(style, f, rng));
      // Lone pillars: a few of the grid's spots, at random.
      const most = style === "pillars" ? 1 + Math.floor(rng() * PILLARS_MOST) : Infinity;
      if (style === "pillars") rock = shuffle(rng, rock);
      // Whole if it can; else as much of it as keeps the room sound, piece by piece.
      if (rock.length <= most && sound(fp, r.id, rock, middle(r), r.id === layout.boss)) inner = rock;
      else for (const piece of rock) if (inner.length < most && sound(fp, r.id, [...inner, piece], middle(r), r.id === layout.boss)) inner.push(piece);
    }
    rooms[r.id] = inner.length > 0 ? { ...r, inner } : r;
  }
  return { ...layout, rooms };
}
