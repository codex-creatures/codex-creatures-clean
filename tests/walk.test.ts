import { describe, expect, it } from "vitest";
import { ROCK, FLOOR, type Floorplan, type Pt } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, layoutMap, WALK_SPEC } from "../lib/dungeon/layout";
import { advance, cameraAt, closestReachable, entranceSpot, findPath, nearestWalkable, roomAt, stickNext, walkable, walkStick, walkTo, walkToward, WALK_SPEED, type Walker } from "../lib/dungeon/walk";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const encampment = (seed: number) => {
  const layout = rollLayout(WALK_SPEC, seeded(seed));
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
        const there = { x: map.nodes[id].x, y: map.nodes[id].y }; // (the middle of its floor)
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
    const r = plan.rooms[map.start][0];
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

describe("walking toward a tap you can't reach", () => {
  // A room with a wall across it, a gap at the left: tapping beyond the wall's right end goes round.
  const rows = ["#########", "#.......#", "#.......#", "#.#######", "#.......#", "#########"];
  const fp: Floorplan = (() => {
    const w = rows[0].length, h = rows.length, tiles = new Uint8Array(w * h);
    rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
    return { w, h, tiles, rooms: {}, doors: [], tunnels: {} };
  })();
  it("walks to the spot itself when it can", () => {
    expect(closestReachable(fp, { x: 7, y: 1 }, { x: 7, y: 4 })).toEqual({ x: 7, y: 4 });
  });
  it("walks as close as it can get to rock or the dark beyond", () => {
    expect(closestReachable(fp, { x: 1, y: 1 }, { x: 20, y: 1 })).toEqual({ x: 7, y: 1 });
    expect(closestReachable(fp, { x: 1, y: 1 }, { x: 4, y: 3 })).toEqual({ x: 4, y: 2 });
    const me = walkToward(fp, { x: 1, y: 1, path: [] }, { x: 20, y: 1 });
    expect(me.path[me.path.length - 1]).toEqual({ x: 7, y: 1 });
  });
  it("only where it may step (somewhere unseen, say), and stays put if it's already closest", () => {
    const seen = (_: { x: number; y: number }, to: { x: number; y: number }) => to.y <= 2;
    expect(closestReachable(fp, { x: 1, y: 1 }, { x: 7, y: 4 }, seen)).toEqual({ x: 7, y: 2 });
    const me = { x: 7, y: 1, path: [] };
    expect(walkToward(fp, me, { x: 20, y: 1 })).toEqual(me);
  });
});

describe("the joystick", () => {
  // A room with a wall along its top and a pillar in the middle.
  const rows = ["#######", "#.....#", "#..#..#", "#.....#", "#######"];
  const fp: Floorplan = (() => {
    const w = rows[0].length, h = rows.length, tiles = new Uint8Array(w * h);
    rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
    return { w, h, tiles, rooms: {}, doors: [], tunnels: {} };
  })();

  it("steps the nearest of the eight ways it's pushed, and not at all barely pushed", () => {
    expect(stickNext(fp, { x: 1, y: 1 }, 1, 0.1)).toEqual({ x: 2, y: 1 });
    expect(stickNext(fp, { x: 1, y: 1 }, 0.7, 0.7)).toEqual({ x: 2, y: 2 });
    expect(stickNext(fp, { x: 1, y: 1 }, 0.1, 0.1)).toBeNull();
  });
  it("slides along a wall pushed diagonally into it, the way it leans; stops pushed straight in", () => {
    expect(stickNext(fp, { x: 2, y: 1 }, 0.8, -0.6)).toEqual({ x: 3, y: 1 });
    expect(stickNext(fp, { x: 2, y: 1 }, 0, -1)).toBeNull();
  });
  it("never cuts a pillar's corner, and keeps to the step rule", () => {
    expect(stickNext(fp, { x: 2, y: 1 }, 0.6, 0.8)).toEqual({ x: 2, y: 2 }); // (leaning down: down, not through the pillar at 3,2)
    expect(stickNext(fp, { x: 1, y: 1 }, 1, 0, (_, to) => to.x !== 2)).toBeNull();
  });
  it("walks on smoothly while held and finishes the step it's on when let go", () => {
    let me: Walker = { x: 1, y: 3, path: [] };
    for (let i = 0; i < 30; i++) me = advance(walkStick(fp, me, 1, 0), 1 / 60);
    expect(me.y).toBe(3);
    expect(me.x).toBeCloseTo(1 + (30 / 60) * WALK_SPEED, 5); // (no stop at each tile)
    for (let i = 0; i < 60; i++) me = advance(walkStick(fp, me, 0, 0), 1 / 60);
    expect(me).toEqual({ x: 5, y: 3, path: [] });
  });
});
