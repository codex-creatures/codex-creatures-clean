import { describe, it, expect } from "vitest";
import { dungeonCells, shadeOf, uprightStretch, DEFAULT_PITCH, WALL_HEIGHT } from "../lib/render3d/dungeon3d";
import { ROCK, FLOOR, type Floorplan } from "../lib/dungeon/floorplan";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { newWalkRun } from "../lib/world/migrate";
import { startWalkRun } from "../lib/dungeon/walkRun";

// The 3D prototype's geometry rules (lib/render3d/dungeon3d.ts).
const plan = (rows: string[]): Floorplan => ({
  w: rows[0].length, h: rows.length, rooms: {}, doors: [], tunnels: {},
  tiles: Uint8Array.from(rows.join("").split("").map((c) => (c === "." ? FLOOR : ROCK))),
});

describe("dungeonCells", () => {
  it("floor on every walkable tile, a wall block on rock touching floor (diagonals too), nothing deeper", () => {
    const fp = plan(["#####", "#####", "##.##", "#####", "#####"]);
    const { floor, walls } = dungeonCells(fp);
    expect(floor).toEqual([{ x: 2, y: 2 }]);
    expect(walls).toHaveLength(8);
    expect(walls.every((p) => Math.abs(p.x - 2) <= 1 && Math.abs(p.y - 2) <= 1)).toBe(true);
  });
  it("on a real walkable run: every floor tile's rock neighbours are walls, and no wall is far from floor", () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const run = newWalkRun(startWalkRun(["a"], ["a"], { a: 1 }, 1, [{}, {}], false, rng, 0));
    const fp = layoutFloorplan(run.walk!.layout);
    const { floor, walls } = dungeonCells(fp);
    const isWall = new Set(walls.map((p) => p.y * fp.w + p.x));
    const missing = floor.flatMap((p) => [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: p.x + dx, y: p.y + dy }))))
      .filter((q) => q.x >= 0 && q.y >= 0 && q.x < fp.w && q.y < fp.h && fp.tiles[q.y * fp.w + q.x] === ROCK && !isWall.has(q.y * fp.w + q.x));
    expect(missing).toEqual([]);
    expect(floor.length + walls.length).toBeLessThan(fp.w * fp.h);
  });
});

describe("shadeOf", () => {
  it("seen floor shows, unseen stays black, a wall shows once floor beside it is seen", () => {
    const fp = plan(["####", "#...", "####"]);
    const known = new Uint8Array(12); known[5] = 1; // (1, 1) seen; (2, 1) and (3, 1) not
    const s = shadeOf(fp, known);
    expect(s[5]).toBe(1); expect(s[6]).toBe(0);
    expect(s[0]).toBe(1); // a wall by the seen floor (diagonally)
    expect(s[3]).toBe(0); // (3, 0): only beside unseen floor
  });
});

describe("the default view", () => {
  it("the kit's floor (48 × 36) and north face (72 rows a wall) show square pixels at the default pitch", () => {
    expect(36 / (48 * Math.sin(DEFAULT_PITCH))).toBeCloseTo(1, 6); // floor depth shows sin(pitch)
    expect(72 / (48 * WALL_HEIGHT * Math.cos(DEFAULT_PITCH))).toBeCloseTo(1, 1); // a wall's height shows cos(pitch)
    expect(uprightStretch(DEFAULT_PITCH) * Math.cos(DEFAULT_PITCH)).toBeCloseTo(1, 6);
  });
});
