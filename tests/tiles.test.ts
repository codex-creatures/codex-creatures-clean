// Tile variants (lib/render3d/tiles.ts): moss in the floor's own tiles, a mouse hole and cobwebs in the
// walls' own tiles, picked by the art's repeats, from the floor life (decor.ts placeFloorLife).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { seeded } from "./walkBaseline";
import { startWalkRun } from "../lib/dungeon/walkRun";
import { layoutFloorplan } from "../lib/dungeon/layout";
import { FLOOR, ROCK } from "../lib/dungeon/floorplan";
import { placeFloorLife, WEB_CHANCE } from "../lib/dungeon/decor";
import { tileVariants, floorCell, mossRows, FACE, TILE_ART, FLOOR_ROWS, FLOOR_UP, MOSS_ANY } from "../lib/render3d/tiles";

const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], false, seeded(31), 1);
const layout = run.walk!.layout, fp = layoutFloorplan(layout), skip = [layout.start, layout.boss];
const life = placeFloorLife(fp, [], [], skip, seeded(11));

describe("cobwebs in rooms' top corners", () => {
  it("only where a room's top wall meets a side wall, about as often as WEB_CHANCE; puddles and holes where they were", () => {
    expect(life.webs.length).toBeGreaterThan(0);
    const rock = (x: number, y: number) => x < 0 || y < 0 || x >= fp.w || y >= fp.h || fp.tiles[y * fp.w + x] === ROCK;
    for (const w of life.webs) {
      expect(fp.tiles[w.y * fp.w + w.x]).toBe(FLOOR);
      expect(rock(w.x, w.y - 1)).toBe(true);
      expect(rock(w.side === "left" ? w.x - 1 : w.x + 1, w.y)).toBe(true);
    }
    const corners = (Object.keys(fp.rooms).length - skip.length) * 2;
    expect(life.webs.length / corners).toBeLessThan(WEB_CHANCE * 1.5);
  });
});

describe("tile variants", () => {
  const v = tileVariants(fp, life, seeded(5));
  it("a hole's cell and a web's two cells are marked on its wall's floor row; nothing else on the walls", () => {
    const at = (x: number, y: number) => v.face[y * fp.w + x];
    for (const h of life.holes) expect(at(h.x, h.y)).toBe(FACE.hole);
    for (const w of life.webs) {
      if (w.side === "left") expect([at(w.x - 1, w.y), at(w.x, w.y)]).toEqual([FACE.webA, FACE.webB]);
      else expect([at(w.x, w.y), at(w.x - 1, w.y)]).toEqual([FACE.webC, FACE.webD]);
    }
    expect([...v.face].filter((c) => c).length).toBeLessThanOrEqual(life.holes.length + life.webs.length * 2);
  });
  it("moss: mostly round puddles, now and then elsewhere", () => {
    expect(v.mossRows).toBe(mossRows(fp));
    let near = 0, nearMoss = 0, far = 0, farMoss = 0;
    for (let r = 0; r < v.mossRows; r++) for (let x = 0; x < fp.w; x++) {
      const m = { x: x + 0.5, y: ((r - 0.5) * FLOOR_ROWS) / FLOOR_UP };
      const by = life.puddles.some((p) => Math.hypot(p.x - m.x, p.y - m.y) < 1.6), moss = v.moss[r * fp.w + x] === 1;
      if (by) { near++; if (moss) nearMoss++; } else { far++; if (moss) farMoss++; }
    }
    expect(nearMoss / near).toBeGreaterThan(0.25);
    expect(farMoss / far).toBeLessThan(MOSS_ANY * 2);
    // A puddle's own spot is in a cell round it.
    const c = floorCell(life.puddles[0].x, life.puddles[0].y);
    expect(c.y).toBeGreaterThan(0);
  });
  it("the variants' pictures are there, each the size of the tile it varies", () => {
    for (const src of Object.values(TILE_ART)) {
      const b = fs.readFileSync(path.join(__dirname, "..", "public", src));
      const size = [b.readUInt32BE(16), b.readUInt32BE(20)];
      expect(size, src).toEqual(src.includes("floor") ? [48, 36] : [48, 87]);
    }
  });
});
