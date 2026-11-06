import { describe, expect, it } from "vitest";
import { placeDecor, floorVariant, wallVariant, placeBanners, THEMES, DECOR_MOST, FLOOR_WORN, SOLID_DECOR } from "../lib/dungeon/decor";
import { placeCandles, CANDLE_NEAR } from "../lib/dungeon/torch";
import { startWalkRun } from "../lib/dungeon/walkRun";
import { layoutFloorplan, roomCentre } from "../lib/dungeon/layout";
import { FLOOR, ROCK } from "../lib/dungeon/floorplan";
import { findPath } from "../lib/dungeon/walk";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], false, seeded(31), 1);
const layout = run.walk!.layout;
const fp = layoutFloorplan(layout);
const centres = Object.fromEntries(Object.values(layout.rooms).map((r) => [r.id, roomCentre(r)]));
const kinds = Object.fromEntries(Object.keys(layout.rooms).map((id) => [id, run.map.nodes[id].kind]));
const skip = [layout.start, layout.boss];

describe("candles", () => {
  const candles = placeCandles(fp, centres, skip, seeded(5));
  it("stand unlit on the floor near a room's middle, never in the entrance or the boss's room", () => {
    expect(candles.length).toBeGreaterThan(0);
    for (const c of candles) {
      expect(c.lit).toBe(false);
      expect(fp.tiles[c.y * fp.w + c.x]).toBe(FLOOR);
      const d = Math.hypot(c.x - centres[c.room].x, c.y - centres[c.room].y);
      expect(d).toBeGreaterThanOrEqual(CANDLE_NEAR[0]);
      expect(d).toBeLessThanOrEqual(CANDLE_NEAR[1]);
      expect(skip).not.toContain(c.room);
      expect(c.id).toBe(`candle:${c.room}`);
    }
    // One a room at most, and the same every time for the same seed.
    expect(new Set(candles.map((c) => c.room)).size).toBe(candles.length);
    expect(placeCandles(fp, centres, skip, seeded(5))).toEqual(candles);
  });
});

describe("decor (samples)", () => {
  const decor = placeDecor(fp, kinds, centres, run.walk!.fires ?? [], skip, seeded(7));
  it("suits each room, a few at most, clear of its middle, doors and fire", () => {
    expect(decor.length).toBeGreaterThan(0);
    const per = new Map<string, number>();
    for (const d of decor) {
      per.set(d.room, (per.get(d.room) ?? 0) + 1);
      expect(fp.tiles[d.y * fp.w + d.x]).toBe(FLOOR);
      expect(skip).not.toContain(d.room);
      expect(Math.hypot(d.x - centres[d.room].x, d.y - centres[d.room].y)).toBeGreaterThanOrEqual(2.5);
      for (const door of fp.doors.filter((q) => q.room === d.room)) expect(Math.hypot(door.x - d.x, door.y - d.y)).toBeGreaterThanOrEqual(3);
      for (const f of run.walk!.fires ?? []) expect(Math.hypot(f.x - d.x, f.y - d.y)).toBeGreaterThanOrEqual(1.5);
      const theme = THEMES[kinds[d.room]];
      if (theme && d.kind !== "pillar") expect(theme).toContain(d.kind);
      expect(d.solid).toBe(SOLID_DECOR.includes(d.kind));
    }
    for (const n of per.values()) expect(n).toBeLessThanOrEqual(DECOR_MOST + 1); // (+ a pillar)
    for (const id of per.keys()) expect(decor.filter((d) => d.room === id && d.kind === "nest").length).toBeLessThanOrEqual(1);
  });
  it("solid things stand against a wall, and never cut a room off: every door still reaches every other", () => {
    const rock = (x: number, y: number) => fp.tiles[y * fp.w + x] === ROCK;
    for (const d of decor.filter((x) => x.solid && x.kind !== "pillar")) {
      expect(rock(d.x - 1, d.y) || rock(d.x + 1, d.y) || rock(d.x, d.y + 1)).toBe(true);
    }
    const blocked = new Set(decor.filter((d) => d.solid).map((d) => `${d.x},${d.y}`));
    const can = (_: unknown, q: { x: number; y: number }) => !blocked.has(`${q.x},${q.y}`);
    const problems: string[] = [];
    for (const id of Object.keys(fp.rooms)) {
      const doors = fp.doors.filter((q) => q.room === id);
      for (let i = 1; i < doors.length; i++) if (!findPath(fp, doors[0], doors[i], can)) problems.push(`${id}: door ${i} cut off`);
      if (doors[0] && !findPath(fp, doors[0], centres[id], can)) problems.push(`${id}: its middle cut off`);
    }
    expect(problems).toEqual([]);
  });
  it("banners hang on a room's top wall, two tiles wide, never over a wall torch or a door", () => {
    const torches = [{ x: 0, y: 0 }];
    const all = placeBanners(fp, [], skip, seeded(9));
    expect(all.length).toBeGreaterThan(0);
    for (const b of all) for (const x of [b.x, b.x + 1]) {
      expect(fp.tiles[b.y * fp.w + x]).toBe(FLOOR);
      expect(fp.tiles[(b.y - 1) * fp.w + x]).toBe(ROCK);
    }
    // Kept clear of a torch where one was.
    const taken = all.map((b) => ({ x: b.x, y: b.y }));
    for (const b of placeBanners(fp, [...torches, ...taken], skip, seeded(9))) expect(taken.some((t) => t.y === b.y && Math.abs(t.x - b.x - 0.5) < 2)).toBe(false);
    expect(wallVariant(3, 4, 1, 3)).toBe(wallVariant(3, 4, 1, 3));
    expect(wallVariant(3, 4, 1, 0)).toBe(0);
  });
  it("worn floor tiles: about a quarter, spread among the kinds, the same each time", () => {
    let worn = 0;
    const used = new Set<number>();
    for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
      const v = floorVariant(x, y, 42, 12);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(12);
      if (v > 0) { worn++; used.add(v); }
    }
    expect(worn / 10000).toBeGreaterThan(FLOOR_WORN - 0.05);
    expect(worn / 10000).toBeLessThan(FLOOR_WORN + 0.05);
    expect(used.size).toBe(12);
    expect(floorVariant(3, 4, 42, 12)).toBe(floorVariant(3, 4, 42, 12));
    expect(floorVariant(3, 4, 42, 0)).toBe(0);
  });
});
