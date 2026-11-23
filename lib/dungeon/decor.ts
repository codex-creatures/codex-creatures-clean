// lib/dungeon/decor.ts
// What lies about the walked Labyrinth's rooms. The decor kinds (DecorKind: barrels, crates, bones,
// nests, pots, a fallen pillar) are drawn by the world's objects (lib/world/objects.ts), placed by
// the world's placement rules (lib/world/place.ts); here, which are solid, and the floor life the
// 3D view draws: puddles, mouse holes and cobwebs (placeFloorLife), from the run's seed, never saved.
// (The lab's decor samples, their themes, banners and worn floor and wall tiles were here too: they
// went with the 2D view, 2026-11-24.)

import { FLOOR, ROCK, type Floorplan, type Pt } from "./floorplan";

type Rng = () => number;

export type DecorKind = "barrels" | "crates" | "skull" | "nest" | "pots" | "pillar";
export const SOLID_DECOR: DecorKind[] = ["barrels", "crates", "pillar"];
export const DOOR_CLEAR = 3;       // tiles from a door, at least

// Floor life (the user, 2026-11-14: the /lab/chest samples, into the game): now and then a room
// has a puddle on its floor (PUDDLE_CHANCE), and now and then a mouse hole at the foot of its top
// wall (RAT_CHANCE), with a rat that runs along the wall to it. Purely visual, so worked out from
// the seed and never saved, like the worn tiles. A puddle lies where it and the tiles round it are
// all floor, clear of the doors and of what's taken (things, fires, candles, the room's middle);
// a hole away from the doors and the wall torches, where the wall's foot runs on clear of things
// for RAT_LANE tiles at least (the rat's run to it, which may pass under a wall torch: it used to
// have to keep clear of them too, and so few rooms had room for one that the rats were hardly ever seen).
export const PUDDLE_CHANCE = 0.35; // of rooms 🧪
export const RAT_CHANCE = 0.25;    // of rooms 🧪
export const RAT_LANE = 4;         // tiles of clear wall foot a hole needs (the rat runs up to RAT_RUN_MOST of them) 🧪
export const RAT_RUN_MOST = 7;
export const PUDDLE_CLEAR = 2.5;   // tiles from anything taken, at least
export type RatHole = { x: number; y: number; from: number }; // the hole at (x, y) on the top wall's foot; the rat starts at x = from
// (The user, 2026-11-15) Cobwebs: WEB_CHANCE of rooms' top corners (each side on its own), where the top wall
// meets a side wall, not by a wall torch or a door. x, y: the corner's floor tile. Drawn as the wall's own
// tile with a web in it (lib/render3d/tiles.ts). 🧪
export const WEB_CHANCE = 0.3;
export type CobWeb = { x: number; y: number; side: "left" | "right" };
export function placeFloorLife(fp: Floorplan, taken: Pt[], walled: Pt[], skip: string[], rng: Rng = Math.random): { puddles: Pt[]; holes: RatHole[]; webs: CobWeb[] } {
  const puddles: Pt[] = [], holes: RatHole[] = [], webs: CobWeb[] = [];
  const rock = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
  const floor = (x: number, y: number) => !rock(x, y) && fp.tiles[y * fp.w + x] === FLOOR;
  const near = (q: Pt, ps: Pt[], d: number) => ps.some((p) => Math.hypot(p.x - q.x, p.y - q.y) < d);
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id)) continue;
    const doors = fp.doors.filter((d) => d.room === id);
    const wantPuddle = rng() < PUDDLE_CHANCE, wantHole = rng() < RAT_CHANCE;
    if (wantPuddle) {
      const spots: Pt[] = [];
      for (const r of fp.rooms[id]) for (let y = r.y + 1; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const q = { x, y };
        let open = true;
        for (let dy = -1; dy <= 1 && open; dy++) for (let dx = -1; dx <= 1; dx++) if (!floor(x + dx, y + dy)) { open = false; break; }
        if (open && !near(q, taken, PUDDLE_CLEAR) && !near(q, doors, DOOR_CLEAR) && !spots.some((s) => s.x === x && s.y === y)) spots.push(q);
      }
      if (spots.length > 0) puddles.push(spots[Math.floor(rng() * spots.length)]);
    }
    if (wantHole) {
      const top = fp.rooms[id].reduce((a, b) => (b.y < a.y ? b : a)), y = top.y;
      // The wall's foot, tile by tile: open where it's floor under rock with nothing on it; the hole
      // itself away from doors and wall torches too.
      const foot = (x: number) => floor(x, y) && rock(x, y - 1) && !near({ x, y }, taken, 1.5);
      const clear = (x: number) => foot(x) && !near({ x, y }, doors, 2) && !near({ x, y }, walled, 1.5);
      const spots: RatHole[] = [];
      for (let x = top.x; x < top.x + top.w; x++) {
        if (!clear(x)) continue;
        // The rat comes from the longer side, as far as the open foot goes.
        let l = x, r = x;
        while (l - 1 >= top.x && foot(l - 1) && x - (l - 1) <= RAT_RUN_MOST) l--;
        while (r + 1 < top.x + top.w && foot(r + 1) && r + 1 - x <= RAT_RUN_MOST) r++;
        const from = x - l >= r - x ? l : r;
        if (Math.abs(x - from) + 1 >= RAT_LANE) spots.push({ x, y, from });
      }
      if (spots.length > 0) holes.push(spots[Math.floor(rng() * spots.length)]);
    }
  }
  // (After the rest, on the same stream, so the puddles and holes stay where they were.)
  for (const id of Object.keys(fp.rooms).sort()) {
    if (skip.includes(id)) continue;
    const top = fp.rooms[id].reduce((a, b) => (b.y < a.y ? b : a)), y = top.y, doors = fp.doors.filter((d) => d.room === id);
    for (const [side, x, out] of [["left", top.x, top.x - 1], ["right", top.x + top.w - 1, top.x + top.w]] as const) {
      if (rng() >= WEB_CHANCE) continue;
      if (!floor(x, y) || !rock(x, y - 1) || !rock(out, y) || near({ x, y }, walled, 1.5) || near({ x, y }, doors, 2)) continue;
      webs.push({ x, y, side });
    }
  }
  return { puddles, holes, webs };
}
