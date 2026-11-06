// lib/dungeon/campfire.ts
// Campfires in the walkable Labyrinth (the Labyrinth's "New"; the user,
// 2026-11-06): now and then a room has one burning in it. Stand by it and
// your team heals: it holds CAMPFIRE_HEAL (half a creature's health) to give
// out, CAMPFIRE_RATE (5% of a creature's max HP) a second, shared evenly
// between the team's creatures still standing that aren't full. So with
// three hurt, each gets a third of 5% a second; with only one left that
// needs it (the rest full or knocked out), it gets the whole 5%. Nothing's
// lost: what a nearly-full creature can't take goes to the others. Given
// out, the fire burns down to embers, with half its light.
// Pure rules, no drawing (components/WalkView.tsx draws).
//
// One fire a room at most, never in the entrance or the chief's camp, and
// (once the walkable run has healing pools) never in a room with a pool:
// they're two kinds of the same thing, the fires taking some of the pools'
// share of rooms.

import { FLOOR, type Floorplan, type Pt } from "./floorplan";
import { lineOfSight } from "./foes";
import type { DungeonMap } from "./map";

type Rng = () => number;

export const CAMPFIRE_CHANCE = 0.15; // of rooms (not the entrance or the camp) have one 🧪
export const CAMPFIRE_HEAL = 0.5;    // shares of a creature's max HP it gives out, in all (the user's)
export const CAMPFIRE_RATE = 0.05;   // …this much a second, shared (the user's)
export const CAMPFIRE_REACH = 2.5;   // tiles: this close (in sight of it), you're by it 🧪
export const CAMPFIRE_LIGHT = 5;     // tiles it lights 🧪
export const EMBER_LIGHT = CAMPFIRE_LIGHT / 2; // …burnt down (the user's: half its light)
export const FIRE_CLEAR = 2;         // tiles from the room's middle (its chest or stash) and its doors, at least

// left: how much it still has to give (CAMPFIRE_HEAL to start; 0: embers).
export type Campfire = { room: string; x: number; y: number; left: number };

// The rooms' fires, rolled as the run starts: a spot on the floor away from
// the room's middle and its doors, off its top and bottom rows (under the
// walls).
export function placeCampfires(fp: Floorplan, map: DungeonMap, centre: (room: string) => Pt, rng: Rng = Math.random): Campfire[] {
  const out: Campfire[] = [];
  for (const id of Object.keys(map.nodes).sort()) {
    if (id === map.start || id === map.boss || !fp.rooms[id] || rng() >= CAMPFIRE_CHANCE) continue;
    const mid = centre(id), doors = fp.doors.filter((d) => d.room === id);
    const spots: Pt[] = [];
    for (const r of fp.rooms[id]) for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (fp.tiles[y * fp.w + x] !== FLOOR || spots.some((s) => s.x === x && s.y === y)) continue;
      if (Math.hypot(x - mid.x, y - mid.y) < FIRE_CLEAR || doors.some((d) => Math.hypot(d.x - x, d.y - y) < FIRE_CLEAR + 1)) continue;
      spots.push({ x, y });
    }
    if (spots.length > 0) out.push({ room: id, ...spots[Math.floor(rng() * spots.length)], left: CAMPFIRE_HEAL });
  }
  return out;
}

// Are you by this fire (close, and in sight of it)? Burnt down, it gives nothing.
export const byFire = (fp: Floorplan, f: Campfire, you: Pt) =>
  f.left > 0 && Math.hypot(f.x - you.x, f.y - you.y) <= CAMPFIRE_REACH && lineOfSight(fp, you, f);

// `seconds` by the fire: what each of the team gets (shares of its max HP),
// and what the fire has left. hp: shares of max HP, 0–1 (0: knocked out, and
// it doesn't heal). The second's share goes evenly to those still short,
// and what a creature can't take goes round the rest.
export function warmBy(hp: Record<string, number>, team: string[], left: number, seconds: number): { gains: Record<string, number>; left: number } {
  const gains: Record<string, number> = {};
  let give = Math.min(left, CAMPFIRE_RATE * seconds);
  const short = () => team.filter((id) => (hp[id] ?? 1) > 0 && (hp[id] ?? 1) + (gains[id] ?? 0) < 1);
  for (let need = short(); give > 1e-9 && need.length > 0; need = short()) {
    const each = give / need.length;
    for (const id of need) {
      const g = Math.min(each, 1 - (hp[id] ?? 1) - (gains[id] ?? 0));
      gains[id] = (gains[id] ?? 0) + g;
      give -= g;
    }
  }
  const given = Object.values(gains).reduce((a, b) => a + b, 0);
  return { gains, left: left - given < 1e-6 ? 0 : left - given };
}
