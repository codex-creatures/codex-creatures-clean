import { describe, expect, it } from "vitest";
import { ROCK, FLOOR, type Floorplan } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, campMap, roomCentre, WALK_SPEC } from "../lib/dungeon/layout";
import { placeCampfires, warmBy, byFire, CAMPFIRE_HEAL, CAMPFIRE_RATE, CAMPFIRE_REACH, FIRE_CLEAR } from "../lib/dungeon/campfire";
import { placeSconces } from "../lib/dungeon/torch";
import { startWalkRun } from "../lib/dungeon/walkRun";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("a campfire's healing", () => {
  it("shares 5% a second evenly between the hurt", () => {
    const { gains, left } = warmBy({ a: 0.2, b: 0.4, c: 0.6 }, ["a", "b", "c"], CAMPFIRE_HEAL, 1);
    for (const id of ["a", "b", "c"]) expect(close(gains[id], CAMPFIRE_RATE / 3)).toBe(true);
    expect(close(left, CAMPFIRE_HEAL - CAMPFIRE_RATE)).toBe(true);
  });
  it("gives the whole 5% to the only one that needs it (the rest full or knocked out)", () => {
    const { gains } = warmBy({ a: 1, b: 0, c: 0.5 }, ["a", "b", "c"], CAMPFIRE_HEAL, 1);
    expect(close(gains.c, CAMPFIRE_RATE)).toBe(true);
    expect(gains.a ?? 0).toBe(0);
    expect(gains.b ?? 0).toBe(0);
  });
  it("passes on what a nearly full one can't take", () => {
    const { gains } = warmBy({ a: 0.99, b: 0.5 }, ["a", "b"], CAMPFIRE_HEAL, 1);
    expect(close(gains.a, 0.01)).toBe(true);
    expect(close(gains.b, CAMPFIRE_RATE - 0.01)).toBe(true);
  });
  it("gives half a creature's health in all, over 10 seconds, then it's embers", () => {
    let hp: Record<string, number> = { a: 0.1, b: 0.1, c: 0.1 }, left = CAMPFIRE_HEAL, t = 0;
    while (left > 0 && t < 100) {
      const w = warmBy(hp, ["a", "b", "c"], left, 0.1);
      hp = Object.fromEntries(Object.entries(hp).map(([id, v]) => [id, v + (w.gains[id] ?? 0)]));
      left = w.left;
      t++;
    }
    expect(left).toBe(0);
    expect(t).toBe(Math.round(CAMPFIRE_HEAL / CAMPFIRE_RATE / 0.1));
    expect(close(hp.a + hp.b + hp.c, 0.3 + CAMPFIRE_HEAL)).toBe(true);
  });
  it("keeps what it has when nobody needs it", () => {
    expect(warmBy({ a: 1, b: 0 }, ["a", "b"], CAMPFIRE_HEAL, 1)).toEqual({ gains: {}, left: CAMPFIRE_HEAL });
  });
  it("warms you only close by and in sight, and not as embers", () => {
    const rows = ["#########", "#...#...#", "#...#...#", "#########"];
    const w = rows[0].length, tiles = new Uint8Array(w * rows.length);
    rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
    const fp: Floorplan = { w, h: rows.length, tiles, rooms: {}, doors: [], tunnels: {} };
    const f = { room: "a", x: 2, y: 1, left: CAMPFIRE_HEAL };
    expect(byFire(fp, f, { x: 3, y: 2 })).toBe(true);
    expect(byFire(fp, f, { x: 5, y: 1 })).toBe(false); // (through the wall)
    expect(byFire(fp, { ...f, left: 0 }, { x: 3, y: 2 })).toBe(false);
    expect(CAMPFIRE_REACH).toBeGreaterThan(1.5);
  });
});

describe("where campfires burn", () => {
  it("one a room at most, never in the entrance or the camp, on the floor away from its middle and doors", () => {
    const fails: string[] = [];
    let count = 0;
    for (let s = 1; s <= 8; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout), map = campMap(layout, false, seeded(s + 1));
      const fires = placeCampfires(fp, map, (id) => roomCentre(layout.rooms[id]), seeded(s + 2));
      count += fires.length;
      if (new Set(fires.map((f) => f.room)).size !== fires.length) fails.push(`${s}: two in a room`);
      for (const f of fires) {
        if (f.room === map.start || f.room === map.boss) fails.push(`${s}: one in ${f.room}`);
        if (fp.tiles[f.y * fp.w + f.x] !== FLOOR || !fp.rooms[f.room].some((r) => f.x >= r.x && f.x < r.x + r.w && f.y >= r.y && f.y < r.y + r.h)) fails.push(`${s}: off ${f.room}'s floor`);
        const c = roomCentre(layout.rooms[f.room]);
        if (Math.hypot(f.x - c.x, f.y - c.y) < FIRE_CLEAR) fails.push(`${s}: on ${f.room}'s middle`);
        if (fp.doors.some((d) => d.room === f.room && Math.hypot(d.x - f.x, d.y - f.y) < FIRE_CLEAR + 1)) fails.push(`${s}: by a door`);
        if (f.left !== CAMPFIRE_HEAL) fails.push(`${s}: not full`);
      }
    }
    expect(fails).toEqual([]);
    expect(count).toBeGreaterThan(0);
  });
  it("are rolled with the run, and saved with it", () => {
    let any = false;
    for (let s = 1; s <= 6; s++) {
      const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [{}, {}], false, seeded(s));
      expect(Array.isArray(run.walk!.fires)).toBe(true);
      expect(JSON.parse(JSON.stringify(run))).toEqual(run);
      any ||= run.walk!.fires!.length > 0;
    }
    expect(any).toBe(true);
  });
});

describe("torches in tunnels", () => {
  it("some tunnels have them, unlit, on a wall of the tunnel, and the rooms' stay as they were", () => {
    const fails: string[] = [];
    let found = 0;
    for (let s = 1; s <= 6; s++) {
      const layout = rollLayout(WALK_SPEC, seeded(s)), fp = layoutFloorplan(layout);
      const rooms = placeSconces(fp, layout.start, seeded(s + 5));
      const all = placeSconces(fp, layout.start, seeded(s + 5), true);
      expect(all.slice(0, rooms.length)).toEqual(rooms);
      const tunnel = all.slice(rooms.length);
      found += tunnel.length;
      if (new Set(all.map((c) => c.id)).size !== all.length) fails.push(`${s}: ids repeat`);
      for (const c of tunnel) {
        if (c.lit) fails.push(`${s}: ${c.id} lit`);
        if (!fp.tunnels[c.room]?.some((q) => q.x === c.x && q.y === c.y)) fails.push(`${s}: ${c.id} not in its tunnel`);
        const wx = c.wall === "left" ? c.x - 1 : c.wall === "right" ? c.x + 1 : c.x, wy = c.wall === "top" ? c.y - 1 : c.y;
        if (fp.tiles[wy * fp.w + wx] !== ROCK) fails.push(`${s}: ${c.id} not on a wall`);
      }
    }
    expect(fails).toEqual([]);
    expect(found).toBeGreaterThan(0);
  });
});
