import { describe, it, expect } from "vitest";
import { dungeonCells, shadeOf, uprightStretch, rockHeights, carvedMesh, DEFAULT_PITCH, WALL_HEIGHT, SOUTH_LIP } from "../lib/render3d/dungeon3d";
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

describe("the grey experiment: rock carved by heights", () => {
  // A 3 × 2 room in solid rock.
  const fp = plan(["#####", "#...#", "#...#", "#####", "#####", "#####"]);
  const all = (i: number) => fp.tiles[i] !== ROCK;
  const H = WALL_HEIGHT;

  it("open floor at 0, rock at the wall's height; with the low rim, the two rows south of floor drop to the lip", () => {
    const full = rockHeights(fp, all, H, false);
    expect(full[1 * 5 + 2]).toBe(0);
    expect(full[0]).toBe(H);
    const low = rockHeights(fp, all, H, true);
    expect([low[3 * 5 + 2], low[4 * 5 + 2], low[5 * 5 + 2]]).toEqual([SOUTH_LIP, SOUTH_LIP, H]);
    expect(low[3 * 5 + 0]).toBe(H); // (the side wall's column runs on at full height)
  });
  it("rock between two rooms keeps the lower room's north wall at full height", () => {
    const two = plan(["#.#", "###", "#.#"]);
    expect(rockHeights(two, (i) => two.tiles[i] !== ROCK, H, true)[1 * 3 + 1]).toBe(H);
  });
  it("unseen floor counts as rock: nothing gives away a place you haven't found", () => {
    const h = rockHeights(fp, (i) => i === 1 * 5 + 1, H, false);
    expect(h[1 * 5 + 2]).toBe(H);
  });
  it("one face per wall edge, facing the floor: north walls face south, side walls face in, south walls face north", () => {
    const m = carvedMesh(rockHeights(fp, all, H, false), fp.w, fp.h, H, 2);
    expect(m.quads).toMatchObject({ south: 3, north: 3, east: 2, west: 2 });
    expect(m.position.length).toBe(Object.values(m.quads).reduce((a, b) => a + b, 0) * 18);
  });
  it("a floor quad a tile; the rock's tops merged along each row", () => {
    const m = carvedMesh(rockHeights(fp, all, H, false), fp.w, fp.h, H, 0);
    // Rows 0, 3, 4, 5: one top each; rows 1 and 2: rock, 3 floors, rock.
    expect(m.quads.up).toBe(4 + 2 * 5);
  });
  it("every quad faces the way its normal says (wound counter-clockwise from the front)", () => {
    const m = carvedMesh(rockHeights(fp, all, H, true), fp.w, fp.h, H, 1);
    const bad: number[] = [];
    for (let t = 0; t < m.position.length / 9; t++) {
      const p = m.position.subarray(t * 9, t * 9 + 9), n = m.normal.subarray(t * 9, t * 9 + 3);
      const u = [p[3] - p[0], p[4] - p[1], p[5] - p[2]], v = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
      const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) bad.push(t);
    }
    expect(bad).toEqual([]);
  });
  it("each quad names its tile: a top its first tile, a face its rocky side, -1 past the plan", () => {
    const m = carvedMesh(rockHeights(fp, all, H, false), fp.w, fp.h, H, 1);
    expect(m.tile).toHaveLength(m.position.length / 18);
    const floors = [...m.tile].filter((t, q) => m.normal[q * 18 + 1] > 0.5 && m.position[q * 18 + 1] === 0);
    expect(floors.sort((a, b) => a - b)).toEqual([6, 7, 8, 11, 12, 13]);
    const faces = [...m.tile].filter((t, q) => m.normal[q * 18 + 1] < 0.5);
    expect(faces.every((t) => t >= 0 && fp.tiles[t] === ROCK)).toBe(true);
    expect([...m.tile].some((t) => t === -1)).toBe(true);
  });
  it("tops aren't merged across a change in split (so seen and unseen rock can be coloured apart)", () => {
    const h = rockHeights(fp, all, H, false);
    const split = new Uint8Array(fp.w * fp.h); split[0 * 5 + 2] = 1;
    expect(carvedMesh(h, fp.w, fp.h, H, 0, split).quads.up).toBe(carvedMesh(h, fp.w, fp.h, H, 0).quads.up + 2);
  });
  it("heights are presentation only: lowering the rim leaves the floorplan (walking, sight, light) as it was", () => {
    const before = Uint8Array.from(fp.tiles);
    rockHeights(fp, all, H, true);
    expect(fp.tiles).toEqual(before);
  });
});
