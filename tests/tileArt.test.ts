import { describe, expect, it } from "vitest";
import { ROCK, FLOOR, TUNNEL, type Floorplan } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, WALK_SPEC } from "../lib/dungeon/layout";
import { cellArt, cornerTerrain, drawOrder, facingOf, pickTile, walkFrame, smoothHeading, turnTo, type Facing, WANG_TILES, UPPER, LOWER, CLIFF, ANY_TILE } from "../lib/dungeon/tileArt";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// A floorplan from rows of text: # rock, . floor, = tunnel.
function plan(rows: string[]): Floorplan {
  const w = rows[0].length, h = rows.length;
  const tiles = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : c === "=" ? TUNNEL : FLOOR; }));
  return { w, h, tiles, rooms: {}, doors: [], tunnels: {} };
}
const tileAt = (fp: Floorplan, x: number, y: number) => {
  const art = cellArt(fp);
  return WANG_TILES[art.tile[(y + 1) * art.w + x + 1]];
};
const sheet = (t: { col: number; row: number } | undefined) => t && `${t.col},${t.row}`;

describe("tile art", () => {
  const room = plan([
    "##########",
    "##########",
    "##......##",
    "##......##",
    "##......##",
    "##......##",
    "##########",
    "##########",
  ]);

  it("marks a floor's top row as a wall's foot", () => {
    const c = cornerTerrain(room);
    expect(c[2 * 10 + 4]).toBe(CLIFF);
    expect(c[3 * 10 + 4]).toBe(LOWER);
    expect(c[0]).toBe(UPPER);
  });

  it("draws a wall face above a floor, plain floor inside, the wall's foot under the face", () => {
    // The cell between rock row 1 and floor row 2: the face (upper above, cliff below).
    expect(sheet(tileAt(room, 4, 1))).toBe("3,0");
    // Between floor rows 2 and 3: the face's foot.
    expect(sheet(tileAt(room, 4, 2))).toBe("3,1");
    // Deep in the floor: plain floor.
    expect(sheet(tileAt(room, 4, 3))).toBe("2,2");
    // The bottom wall, seen from above (lower above, upper below): no face.
    expect(sheet(tileAt(room, 4, 5))).toBe("1,4");
  });

  it("leaves deep rock undrawn", () => {
    const big = plan(["#########", "#########", "#########", "#########", "#########", "####.####", "#########"]);
    const art = cellArt(big);
    expect(art.tile[1 * art.w + 1]).toBe(-1);
    expect(art.tile[(4 + 1) * art.w + 4 + 1]).toBeGreaterThanOrEqual(0);
  });

  it("uses the tunnel sheet only between tunnel tiles", () => {
    const fp = plan(["#####", "#####", "..===", "..===", "..===", "#####", "#####"]);
    const art = cellArt(fp);
    expect(art.tunnel[(3 + 1) * art.w + 3 + 1]).toBe(1);
    expect(art.tunnel[(3 + 1) * art.w + 1 + 1]).toBe(0); // floor and tunnel: the room's
  });

  it("finds an exact tile for nearly every cell of real layouts", () => {
    // (A few inner corners, where a wall steps down beside a tunnel, have no
    // tile of their own in the sheet: the closest is drawn.)
    const misses: string[] = [];
    let cells = 0;
    for (const seed of [1, 2, 3]) {
      // (The old sample sheets, /lab/walk only, predate rooms' insides: interior.ts. They're left out.)
      const l = rollLayout(WALK_SPEC, seeded(seed));
      const fp = layoutFloorplan({ ...l, rooms: Object.fromEntries(Object.entries(l.rooms).map(([id, r]) => [id, { ...r, inner: undefined }])) });
      const c = cornerTerrain(fp);
      const at = (x: number, y: number) => (x < 0 || y < 0 || x >= fp.w || y >= fp.h ? UPPER : c[y * fp.w + x]);
      const art = cellArt(fp);
      for (let cy = -1; cy < fp.h; cy++) for (let cx = -1; cx < fp.w; cx++) {
        const t = art.tile[(cy + 1) * art.w + cx + 1];
        if (t < 0) continue;
        cells++;
        const around: number[] = [];
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) around.push(at(cx - 1 + k, cy - 1 + r));
        const p = WANG_TILES[t].pattern;
        if (p.some((v, k) => v !== ANY_TILE && v !== around[k])) misses.push(`seed ${seed} cell ${cx},${cy}: ${around.join("")}`);
      }
    }
    expect(misses.length, misses.slice(0, 5).join("; ")).toBeLessThan(cells / 500);
  });

  it("picks the most particular of several matches", () => {
    // Two tiles fit wall-left, floor-right; the one wanting rock above wins when there is.
    const around = [ANY_TILE, 1, 1, ANY_TILE, ANY_TILE, 1, 0, ANY_TILE, ANY_TILE, 1, 0, ANY_TILE, ANY_TILE, ANY_TILE, ANY_TILE, ANY_TILE];
    expect(sheet(WANG_TILES[pickTile(around)])).toBe("1,0");
    around[1] = 0;
    around[2] = 0;
    expect(sheet(WANG_TILES[pickTile(around)])).toBe("1,1");
  });
});

describe("walking pictures", () => {
  it("faces the way you mostly go", () => {
    expect(facingOf(1, 0)).toBe("east");
    expect(facingOf(-1, 0.2)).toBe("west");
    expect(facingOf(1, 1)).toBe("south");
    expect(facingOf(0, -1)).toBe("north");
    expect(facingOf(0, 0, "west")).toBe("west");
  });

  it("steps through the walk cycle, and stands still when stopped", () => {
    expect(walkFrame(0, true, 6)).toBe(0);
    expect(walkFrame(0.75, true, 6)).toBe(3);
    expect(walkFrame(1.5, true, 6)).toBe(0);
    expect(walkFrame(3, false, 6)).toBe(-1);
  });

  it("draws what's lower on screen over what's above", () => {
    const order = drawOrder([{ id: "a", x: 0, y: 5 }, { id: "b", x: 3, y: 2 }, { id: "c", x: 1, y: 5 }]);
    expect(order.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});

describe("turning as you walk", () => {
  // A diagonal walked in little steps that lean one way, then the other (as the frames' steps do).
  const walk = (steps: [number, number][], start: Facing = "south") => {
    let h = { x: 0, y: 1 }, f = start;
    const seen: Facing[] = [];
    for (const [dx, dy] of steps) { h = smoothHeading(h, dx, dy); f = turnTo(h.x, h.y, f); seen.push(f); }
    return seen;
  };
  it("walking diagonally settles on one view, instead of flickering between two", () => {
    const steps = Array.from({ length: 60 }, (_, i): [number, number] => (i % 2 ? [0.06, 0.05] : [0.05, 0.06]));
    const seen = walk(steps);
    const swaps = seen.filter((f, i) => i > 0 && f !== seen[i - 1]).length;
    expect(swaps).toBeLessThanOrEqual(1);
    // Even on a staircase of straight steps (across, then down, ...).
    const stairs = Array.from({ length: 60 }, (_, i): [number, number] => (i % 2 ? [0.06, 0] : [0, 0.06]));
    const s2 = walk(stairs);
    expect(s2.filter((f, i) => i > 0 && f !== s2[i - 1]).length).toBeLessThanOrEqual(1);
  });
  it("still turns to a side view once you're clearly walking that way, and right round at once", () => {
    expect(walk(Array.from({ length: 20 }, (): [number, number] => [0.06, 0])).at(-1)).toBe("east");
    expect(turnTo(0, -1, "south")).toBe("north");
    expect(turnTo(1, 0.9, "south")).toBe("south"); // (near the diagonal: stays)
    expect(turnTo(1, 0.5, "south")).toBe("east");
  });
});
