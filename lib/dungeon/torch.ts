// lib/dungeon/torch.ts
// What your torch shows in the walkable Labyrinth (floorplan.ts), and the
// tunnels that fall in behind you. Pure rules, no drawing (the lab draws:
// app/lab/walk).
//
// - The torch lights what it can reach in a straight line within
//   TORCH_RADIUS: rock blocks it, so you walk round a corner to see past it.
//   A wall is lit where the light hits it. Lit tiles are remembered (the fog
//   of war clears for good); foes show only while they're in the light.
// - The light is brightest at you and fades to the remembered dimness at
//   the edge (torchGlow), with a little flicker in the lab.
// - A tunnel closed off from where you are (layout.ts isOpen: up tunnels cut
//   off what's behind) is solid rock (shutPlan): the corridor's no longer
//   there. If you'd seen it, rubble blocks its mouth in the open room
//   (rubbleOf); if you hadn't, it's just rock.

import { ROCK, type Floorplan, type Pt } from "./floorplan";
import { isOpen, type Layout, type Progress, type Tunnel } from "./layout";

export const TORCH_RADIUS = 5.5; // tiles (🧪: foes see 7, so one can spot you from the dark)
// A flare, lit (the user, 2026-11-06): the scroll on top as ever, and your
// light reaches FLARE_REACH times as far for the next FLARE_WALK tiles you
// walk (about half the walkable Encampment, bottom to top, 🧪).
export const FLARE_REACH = 2;
export const FLARE_WALK = 90;
export const torchReach = (flareLeft = 0) => TORCH_RADIUS * (flareLeft > 0 ? FLARE_REACH : 1);
export const FACE_ROWS = 3;      // rock rows above a floor its wall's face stands in (it's lit with the floor below it)
export const REMEMBERED = 0.8;   // darkness over what you've seen but isn't lit now (1: black)

const solid = (fp: Floorplan, x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;

// Can the light get from `a` to tile `b`? Along the straight line between
// them, nothing solid before b (b itself may be rock: a lit wall).
function reaches(fp: Floorplan, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d * 4);
  for (let i = 0; i < n; i++) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / n), y = Math.round(a.y + ((b.y - a.y) * i) / n);
    if (x === b.x && y === b.y) return true;
    if (solid(fp, x, y)) return false;
  }
  return true;
}

// The tiles your torch lights from where you stand (1 = lit), row by row.
// Rock is lit where the light hits it, and next to lit floor (the wall round
// a lit floor shows, even where a ray glances off a corner first), and up a
// lit floor's wall face (FACE_ROWS).
export function torchLit(fp: Floorplan, you: Pt, radius = TORCH_RADIUS): Uint8Array {
  const out = new Uint8Array(fp.w * fp.h);
  const r = Math.ceil(radius), cx = Math.round(you.x), cy = Math.round(you.y);
  for (let y = Math.max(0, cy - r); y <= Math.min(fp.h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(fp.w - 1, cx + r); x++) {
    if (Math.hypot(x - you.x, y - you.y) > radius) continue;
    if (reaches(fp, you, { x, y })) out[y * fp.w + x] = 1;
  }
  const lit = out.slice();
  for (let y = Math.max(0, cy - r - 1); y <= Math.min(fp.h - 1, cy + r + 1); y++) for (let x = Math.max(0, cx - r - 1); x <= Math.min(fp.w - 1, cx + r + 1); x++) {
    if (!solid(fp, x, y) || out[y * fp.w + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (!solid(fp, nx, ny) && lit[ny * fp.w + nx]) out[y * fp.w + x] = 1;
    }
  }
  // A lit floor's wall face, standing in the rock above it, is lit to its top.
  for (let i = 0; i < lit.length; i++) {
    if (!lit[i] || fp.tiles[i] === ROCK) continue;
    const x = i % fp.w, y = (i / fp.w) | 0;
    for (let k = 1; k <= FACE_ROWS && solid(fp, x, y - k) && y - k >= 0; k++) out[(y - k) * fp.w + x] = 1;
  }
  return out;
}

// How dark a tile is, from 0 (full torchlight) to 1 (black): lit ones by
// their distance from you (flicker: the radius's wobble, about 1), the
// remembered ones REMEMBERED, the rest black.
export function torchGlow(d: number, lit: boolean, known: boolean, radius = TORCH_RADIUS, flicker = 1): number {
  if (lit) return Math.min(REMEMBERED, REMEMBERED * Math.pow(Math.max(0, d) / (radius * flicker), 1.6));
  return known ? REMEMBERED : 1;
}

// Is this tunnel closed off from where you are?
export const tunnelShut = (layout: Layout, p: Progress, t: Tunnel) => !isOpen(layout, p, t.a) || !isOpen(layout, p, t.b);

// The floorplan as it stands: every closed tunnel solid rock, its doors
// too (the open room's wall runs straight across). Tiles an open tunnel
// shares are left alone.
export function shutPlan(fp: Floorplan, layout: Layout, p: Progress): Floorplan {
  const shut = layout.tunnels.filter((t) => tunnelShut(layout, p, t));
  if (shut.length === 0) return fp;
  const tiles = fp.tiles.slice();
  const keep = new Set<number>();
  for (const t of layout.tunnels) if (!shut.includes(t)) for (const q of fp.tunnels[t.key] ?? []) keep.add(q.y * fp.w + q.x);
  for (const t of shut) for (const q of fp.tunnels[t.key] ?? []) if (!keep.has(q.y * fp.w + q.x)) tiles[q.y * fp.w + q.x] = ROCK;
  return { ...fp, tiles };
}

// The rubble at closed tunnels' mouths: for each closed tunnel with one end
// in a room still open, its door tiles in that room's wall, and which wall
// ("top": the room's top wall, so you came up it…).
export type Rubble = { key: string; room: string; tiles: Pt[]; wall: "top" | "bottom" | "left" | "right" };
export function rubbleOf(fp: Floorplan, layout: Layout, p: Progress): Rubble[] {
  const out: Rubble[] = [];
  for (const t of layout.tunnels) {
    if (!tunnelShut(layout, p, t)) continue;
    const aOpen = isOpen(layout, p, t.a), bOpen = isOpen(layout, p, t.b);
    if (aOpen === bOpen) continue; // both closed: nothing you can see
    const room = aOpen ? t.a : t.b;
    const tiles = fp.doors.filter((d) => d.link === t.key && d.room === room).map(({ x, y }) => ({ x, y }));
    // Up tunnels: a (below) is entered by the tunnel's bottom row, in its top wall; b by its top row, in its bottom wall.
    const wall = t.up ? (room === t.a ? "top" : "bottom") : room === t.a ? "right" : "left";
    out.push({ key: t.key, room, tiles, wall });
  }
  return out;
}

// The tunnels that fell in behind you: closed, their mouth still in an open
// room, and you'd seen it (known: the tiles you've seen). The ones you can't
// go back down; the scroll crosses each out (the user, 2026-11-07: only
// these, not every closed tunnel behind you).
export const fallenIn = (fp: Floorplan, layout: Layout, p: Progress, known: ArrayLike<number>): Rubble[] =>
  rubbleOf(fp, layout, p).filter((r) => r.tiles.some((q) => known[q.y * fp.w + q.x]));

// Torches on the walls (the user, 2026-11-06): sconces along rooms' top
// walls, most of them unlit. Walk within half your torch's reach of an unlit
// one (in sight of it) and you light it; a lit one lights its part of the
// room for good, a little dimmer than your own torch. The entrance's are lit.
// Some tunnels have them too (the user, 2026-11-06), always unlit to start:
// on an up tunnel's side walls, a sideways tunnel's top wall.
export const SCONCE_EVERY = 8;        // tiles of top wall per sconce (at least one a room) 🧪
export const TUNNEL_SCONCE_CHANCE = 0.4; // a tunnel has torches (one every SCONCE_EVERY tiles of it, at least one) 🧪
export const SCONCE_LIT_SHARE = 0.2;  // of the rest are already burning 🧪
export const SCONCE_RADIUS = 4;       // tiles a sconce lights 🧪
export const SCONCE_BRIGHT = 0.15;    // its darkness right under it (your torch: 0)
export const IGNITE_REACH = TORCH_RADIUS / 2;
export const SCONCE_SEEN = 12;        // tiles: a burning sconce in sight this close shows you what it lights

// A sconce: on the wall above floor tile (x, y), the top row of a room's floor
// (or a tunnel's: room is then the tunnel's key, and wall which side it's on;
// none: the top).
export type Sconce = { id: string; room: string; x: number; y: number; lit: boolean; wall?: "top" | "left" | "right" };
type Rng = () => number;

// Sconces for every room: spread along its floor's top row (each floor
// rectangle of a dog-leg that has a wall above), never over a tunnel's mouth.
// tunnels: some tunnels get theirs too (after the rooms', so the rooms' stay
// as they were).
export function placeSconces(fp: Floorplan, start: string, rng: Rng = Math.random, tunnels = false): Sconce[] {
  const out: Sconce[] = [];
  for (const [room, rects] of Object.entries(fp.rooms)) {
    let k = 0;
    for (const r of rects) {
      const spots: number[] = [];
      for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (solid(fp, x, r.y - 1) && solid(fp, x - 1, r.y - 1) && solid(fp, x + 1, r.y - 1)) spots.push(x);
      if (spots.length === 0) continue;
      const n = Math.max(1, Math.round(r.w / SCONCE_EVERY));
      for (let i = 0; i < n; i++) {
        const x = spots[Math.min(spots.length - 1, Math.floor(((i + 0.5) / n) * spots.length))];
        if (out.some((s) => s.room === room && Math.abs(s.x - x) < 3 && s.y === r.y)) continue;
        out.push({ id: `${room}:${k++}`, room, x, y: r.y, lit: room === start || rng() < SCONCE_LIT_SHARE });
      }
    }
  }
  if (tunnels) for (const key of Object.keys(fp.tunnels).sort()) if (rng() < TUNNEL_SCONCE_CHANCE) out.push(...tunnelSconces(fp, key));
  return out;
}

// A tunnel's sconces: along its walls, away from its ends (its doors and the
// tile in from each), one every SCONCE_EVERY tiles, taking turns side to side
// up an up tunnel.
function tunnelSconces(fp: Floorplan, key: string): Sconce[] {
  const ts = fp.tunnels[key];
  const x0 = Math.min(...ts.map((q) => q.x)), x1 = Math.max(...ts.map((q) => q.x));
  const y0 = Math.min(...ts.map((q) => q.y)), y1 = Math.max(...ts.map((q) => q.y));
  const up = y1 - y0 > x1 - x0;
  const from = (up ? y0 : x0) + 2, to = (up ? y1 : x1) - 2;
  if (to < from) return [];
  const n = Math.max(1, Math.round((to - from + 1) / SCONCE_EVERY));
  const out: Sconce[] = [];
  for (let i = 0; i < n; i++) {
    const along = from + Math.floor(((i + 0.5) / n) * (to - from + 1));
    const s: Sconce = up
      ? (i % 2 === 0 ? { id: "", room: key, x: x0, y: along, lit: false, wall: "left" } : { id: "", room: key, x: x1, y: along, lit: false, wall: "right" })
      : { id: "", room: key, x: along, y: y0, lit: false, wall: "top" };
    const wx = s.wall === "left" ? s.x - 1 : s.wall === "right" ? s.x + 1 : s.x, wy = s.wall === "top" ? s.y - 1 : s.y;
    if (solid(fp, wx, wy) && !solid(fp, s.x, s.y)) out.push({ ...s, id: `${key}:${out.length}` });
  }
  return out;
}

// Close enough, and in sight, to light it?
export function canIgnite(fp: Floorplan, s: Sconce, you: Pt): boolean {
  return !s.lit && Math.hypot(s.x - you.x, s.y - you.y) <= IGNITE_REACH && reaches(fp, you, { x: s.x, y: s.y });
}

// A burning sconce in your sight (so you see the room it lights)?
export function sconceInSight(fp: Floorplan, s: Sconce, you: Pt): boolean {
  return s.lit && fireInSight(fp, s, you);
}
// …or any fire (a campfire too: campfire.ts).
export const fireInSight = (fp: Floorplan, at: Pt, you: Pt) => Math.hypot(at.x - you.x, at.y - you.y) <= SCONCE_SEEN && reaches(fp, you, { x: at.x, y: at.y });

// How dark a tile a sconce lights is, `d` tiles from it (1 when it doesn't
// reach). radius: a campfire's reach in place of a sconce's.
export function sconceGlow(d: number, flicker = 1, radius = SCONCE_RADIUS): number {
  const r = radius * flicker;
  if (d >= r) return 1;
  return Math.min(REMEMBERED, SCONCE_BRIGHT + (REMEMBERED - SCONCE_BRIGHT) * Math.pow(d / r, 1.6));
}

// Candles (the user, 2026-11-06: "the odd candle in the middle-ish of the
// rooms, unlit"): now and then a room has one standing on its floor near the
// middle (CANDLE_CHANCE; never the entrance or the boss's room), unlit. Walk
// near it (in sight, IGNITE_REACH) and it lights, and keeps a little pool of
// light (CANDLE_RADIUS) round it for good. Where they stand comes from the
// run's seed (like the wall torches), and which are lit is kept with the
// wall torches' (ids "candle:<room>"), so a run needs nothing new saved.
export const CANDLE_CHANCE = 0.35;  // of rooms have one 🧪
export const CANDLE_RADIUS = 2.5;   // tiles a lit candle lights 🧪
export const CANDLE_NEAR = [2, 5];  // tiles from the room's middle (its chest, pool or stash): middle-ish, not on it 🧪
export const CANDLE_CLEAR = 3;      // tiles from its doors, at least
export type Candle = Sconce;        // (no wall: it stands on the floor)
export function placeCandles(fp: Floorplan, centres: Record<string, Pt>, skip: string[], rng: Rng = Math.random): Candle[] {
  const out: Candle[] = [];
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id) || rng() >= CANDLE_CHANCE) continue;
    const mid = centres[id], doors = fp.doors.filter((d) => d.room === id);
    const spots: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 2; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      const d = Math.hypot(x - mid.x, y - mid.y);
      if (d < CANDLE_NEAR[0] || d > CANDLE_NEAR[1] || fp.tiles[y * fp.w + x] === ROCK || spots.some((s) => s.x === x && s.y === y)) continue;
      if (doors.some((q) => Math.hypot(q.x - x, q.y - y) < CANDLE_CLEAR)) continue;
      spots.push({ x, y });
    }
    if (spots.length > 0) out.push({ id: `candle:${id}`, room: id, ...spots[Math.floor(rng() * spots.length)], lit: false });
  }
  return out;
}
