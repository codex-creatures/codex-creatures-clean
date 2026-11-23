import { describe, expect, it } from "vitest";
import { placeFloorLife, DOOR_CLEAR, PUDDLE_CLEAR, RAT_LANE, RAT_RUN_MOST } from "../lib/dungeon/decor";
import { ratAt, ratLoop, ratBolt, ratHidesFrom, RAT_SPEED, RAT_BOLT, RAT_DIVE } from "../lib/render3d/puddle";
import { CANDLE_NEAR } from "../lib/dungeon/torch";
import { startWalkRun } from "../lib/dungeon/walkRun";
import { layoutFloorplan, roomCentre } from "../lib/dungeon/layout";
import { FLOOR, ROCK } from "../lib/dungeon/floorplan";
import { placeCandles } from "../lib/world/compat/v0Placers";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], false, seeded(31), 1);
const layout = run.walk!.layout;
const fp = layoutFloorplan(layout);
const centres = Object.fromEntries(Object.values(layout.rooms).map((r) => [r.id, roomCentre(r)]));
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

describe("floor life (puddles, mouse holes)", () => {
  const taken = [...(run.walk!.fires ?? []), ...Object.values(centres)];
  const torches = [{ x: 0, y: 0 }];
  const life = placeFloorLife(fp, taken, torches, skip, seeded(11));
  const floor = (x: number, y: number) => fp.tiles[y * fp.w + x] === FLOOR, rock = (x: number, y: number) => fp.tiles[y * fp.w + x] === ROCK;
  const roomOf = (p: { x: number; y: number }) => Object.keys(fp.rooms).find((id) => fp.rooms[id].some((r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h));
  it("puddles lie wholly on the floor, one a room at most, clear of doors and what's taken; the same each time", () => {
    expect(life.puddles.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const p of life.puddles) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!floor(p.x + dx, p.y + dy)) problems.push(`${p.x},${p.y}: off the floor`);
      if (taken.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < PUDDLE_CLEAR)) problems.push(`${p.x},${p.y}: on something`);
      const id = roomOf(p);
      if (!id || skip.includes(id)) problems.push(`${p.x},${p.y}: in no room, or a skipped one`);
      if (fp.doors.some((d) => d.room === id && Math.hypot(d.x - p.x, d.y - p.y) < DOOR_CLEAR)) problems.push(`${p.x},${p.y}: by a door`);
    }
    expect(problems).toEqual([]);
    expect(new Set(life.puddles.map(roomOf)).size).toBe(life.puddles.length);
    expect(placeFloorLife(fp, taken, torches, skip, seeded(11))).toEqual(life);
  });
  it("a mouse hole sits at the foot of a top wall, with a clear run of wall foot to it", () => {
    expect(life.holes.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const h of life.holes) {
      const run = Math.abs(h.x - h.from);
      if (run + 1 < RAT_LANE || run > RAT_RUN_MOST) problems.push(`${h.x},${h.y}: a run of ${run}`);
      for (let x = Math.min(h.x, h.from); x <= Math.max(h.x, h.from); x++) if (!floor(x, h.y) || !rock(x, h.y - 1)) problems.push(`${x},${h.y}: not the wall's foot`);
      if (fp.doors.some((d) => Math.hypot(d.x - h.x, d.y - h.y) < 2)) problems.push(`${h.x},${h.y}: by a door`);
    }
    expect(problems).toEqual([]);
  });
  it("the rat runs to its hole, goes in, and hides a while before coming round again", () => {
    const run = 4, there = run / RAT_SPEED;
    expect(ratAt(0, run)).toEqual({ along: 0, into: 0 });
    expect(ratAt(there / 2, run)!.along).toBeCloseTo(run / 2);
    expect(ratAt(there + 0.15, run)!.into).toBeGreaterThan(0);
    expect(ratAt(there + 2, run)).toBeNull();
    expect(ratAt(ratLoop(run) + 0.1, run)).toEqual(ratAt(0.1, run));
  });
  it("come near and the rat bolts for its hole, faster, then hides as after any run", () => {
    const run = 6, from = 2, time = (run - from) / (RAT_SPEED * RAT_BOLT);
    expect(ratBolt(from, 0, run)).toEqual({ along: from, into: 0 });
    expect(ratBolt(from, time / 2, run)!.along).toBeCloseTo(from + (run - from) / 2);
    expect(ratBolt(from, time + RAT_DIVE / 2, run)!.into).toBeCloseTo(0.5);
    expect(ratBolt(from, time + RAT_DIVE + 0.01, run)).toBeNull();
    expect(ratAt(ratHidesFrom(run) + 0.01, run)).toBeNull();
  });
});
