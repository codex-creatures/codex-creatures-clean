import { describe, expect, it } from "vitest";
import { DUNGEONS } from "../lib/dungeon/run";
import { ROCK, type Pt } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, layoutMap } from "../lib/dungeon/layout";
import { advance, cameraAt, entranceSpot, findPath, nearestWalkable, roomAt, walkable, walkTo, WALK_SPEED, type Walker } from "../lib/dungeon/walk";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const encampment = (seed: number) => {
  const layout = rollLayout(DUNGEONS[0].spec, seeded(seed));
  return { map: layoutMap(layout), plan: layoutFloorplan(layout) };
};

// Everything wrong with a path, in words: every step onto a walkable tile, one
// tile at a time, and a diagonal only where both straight ways round are open.
function pathProblems(fp: ReturnType<typeof encampment>["plan"], from: Pt, path: Pt[]): string[] {
  const out: string[] = [];
  let at = from;
  for (const p of path) {
    const dx = p.x - at.x, dy = p.y - at.y;
    if (!walkable(fp, p.x, p.y)) out.push(`onto rock at ${p.x},${p.y}`);
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) out.push(`a jump to ${p.x},${p.y}`);
    if (dx !== 0 && dy !== 0 && (!walkable(fp, at.x + dx, at.y) || !walkable(fp, at.x, at.y + dy))) out.push(`a cut corner at ${p.x},${p.y}`);
    at = p;
  }
  return out;
}

describe("walking the Labyrinth", () => {
  it("walks from the entrance to every room of an Encampment, through walkable tiles only", () => {
    const problems: string[] = [];
    for (const seed of [1, 2, 3]) {
      const { map, plan } = encampment(seed);
      const start = entranceSpot(plan, map);
      expect(roomAt(plan, start)).toBe(map.start);
      for (const id of Object.keys(map.nodes)) {
        const r = plan.rooms[id];
        const there = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };
        const path = findPath(plan, start, there);
        if (!path) { problems.push(`seed ${seed}: no way to ${id}`); continue; }
        problems.push(...pathProblems(plan, start, path).map((p) => `seed ${seed} to ${id}: ${p}`));
        if (roomAt(plan, path[path.length - 1] ?? start) !== id) problems.push(`seed ${seed}: ended outside ${id}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("finds no way onto rock, and an empty one to where you stand", () => {
    const { map, plan } = encampment(4);
    const start = entranceSpot(plan, map);
    expect(findPath(plan, start, start)).toEqual([]);
    expect(findPath(plan, start, { x: 0, y: 0 })).toBeNull();
  });

  it("a tap on rock beside a room walks to the room's edge; one deep in rock goes nowhere", () => {
    const { map, plan } = encampment(5);
    const r = plan.rooms[map.start];
    // Two tiles above the entrance's top-left floor (its wall, then rock).
    const near = nearestWalkable(plan, { x: r.x + 1, y: r.y - 2 });
    expect(near && walkable(plan, near.x, near.y)).toBe(true);
    expect(nearestWalkable(plan, { x: 0, y: 0 })).toBeNull();
    const me: Walker = { ...entranceSpot(plan, map), path: [] };
    expect(walkTo(plan, me, { x: 0, y: 0 })).toEqual(me);
  });

  it("walks at WALK_SPEED, stops at the end, and finishes its step before turning", () => {
    const { map, plan } = encampment(6);
    const start = entranceSpot(plan, map);
    let me: Walker = walkTo(plan, { ...start, path: [] }, { x: start.x + 3, y: start.y });
    expect(me.path).toEqual([1, 2, 3].map((d) => ({ x: start.x + d, y: start.y })));
    me = advance(me, 0.5 / WALK_SPEED); // half a tile along
    expect(me.x).toBeCloseTo(start.x + 0.5);
    // Turn back: it reaches the tile it was stepping onto first.
    me = walkTo(plan, me, start);
    expect(me.path[0]).toEqual({ x: start.x + 1, y: start.y });
    expect(me.path[me.path.length - 1]).toEqual(start);
    me = advance(me, 10);
    expect(me).toEqual({ ...start, path: [] });
  });

  it("the camera keeps you in the middle, but never shows past the edge", () => {
    const { map, plan } = encampment(7);
    const view = { w: 20, h: 30 };
    const start = entranceSpot(plan, map);
    const mid = { x: Math.floor(plan.w / 2), y: Math.floor(plan.h / 2) };
    expect(cameraAt(plan, mid, view)).toEqual({ x: mid.x + 0.5 - 10, y: mid.y + 0.5 - 15 });
    const corner = cameraAt(plan, { x: 0, y: plan.h - 1 }, view);
    expect(corner).toEqual({ x: 0, y: plan.h - 30 });
    // A view wider than the whole plan centres it.
    expect(cameraAt(plan, start, { w: plan.w + 10, h: 30 }).x).toBe(-5);
    expect(plan.tiles[start.y * plan.w + start.x]).not.toBe(ROCK);
  });
});
