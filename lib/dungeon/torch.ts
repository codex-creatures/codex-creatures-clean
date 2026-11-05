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
// a lit floor shows, even where a ray glances off a corner first).
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
