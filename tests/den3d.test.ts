// The new Den's layout (lib/den3d/layout.ts): the plan, where things stand, who strolls where, the
// camera's limits and what a tap lands on.
import { describe, expect, it } from "vitest";
import { FLOOR, ROCK, TUNNEL } from "@/lib/dungeon/floorplan";
import {
  denPlan, denShown, stations, strollAt, clampView, denArea, firstView, stationAt, denLights, BRAZIERS,
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, loopTime, ROOM1, ROOM2, DIVIDE_X, PLAN_W, type Station,
} from "@/lib/den3d/layout";

const PITCH = Math.PI / 3;
const ALL = { opened: true, pit: true, trainingPit: false, repaired: true };
const at = (x: number, y: number, opened = false) => denPlan(opened).tiles[Math.round(y) * PLAN_W + Math.round(x)];
// A station's footprint, as a box (u).
const box = (s: Station) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y - s.d / 2, y1: s.y + s.d / 2 });
const inside = (p: { x: number; y: number }, b: ReturnType<typeof box>, pad = 0) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.y > b.y0 - pad && p.y < b.y1 + pad;

describe("the new Den's plan", () => {
  it("is two square rooms with rock between them, till the wall comes down", () => {
    expect(at(ROOM1.x, ROOM1.y)).toBe(FLOOR);
    expect(at(ROOM2.x + ROOM2.w - 1, ROOM2.y + ROOM2.h - 1)).toBe(FLOOR);
    for (let y = ROOM1.y; y < ROOM1.y + ROOM1.h; y++) {
      expect(at(DIVIDE_X, y)).toBe(ROCK);
      expect(at(DIVIDE_X, y, true)).toBe(FLOOR);
    }
    expect(at(6, 0)).toBe(TUNNEL); // the Labyrinth's passage, north through the wall
  });

  it("shows room 2 only once it's open", () => {
    const shut = denShown(false), open = denShown(true);
    expect(shut[ROOM2.y * PLAN_W + ROOM2.x + 2]).toBe(0);
    expect(open[ROOM2.y * PLAN_W + ROOM2.x + 2]).toBe(1);
    expect(shut[ROOM1.y * PLAN_W + ROOM1.x]).toBe(1);
  });
});

describe("what stands in it", () => {
  it("has every place, each going somewhere (the rubble aside), the tavern's only once it's open", () => {
    const shut = stations({ opened: false, pit: false, trainingPit: false, repaired: false }).map((s) => s.key);
    expect(shut).toEqual(expect.arrayContaining(["shack", "storehouse", "bookcase", "altar", "pit", "pool", "board", "lectern", "arch", "cage", "rubble"]));
    expect(shut).not.toContain("tavern");
    const open = stations(ALL);
    expect(open.map((s) => s.key)).toEqual(expect.arrayContaining(["tavern", "portal", "training"]));
    expect(open.map((s) => s.key)).not.toContain("rubble");
    for (const s of open) expect(s.href, s.key).toBeTruthy();
  });

  it("keeps everything on its own room's floor (or against its north wall), none overlapping", () => {
    const list = [...stations(ALL), ...stations({ ...ALL, opened: false }).filter((s) => s.key === "rubble")];
    for (const s of list) {
      const b = box(s), r = s.room === 1 ? ROOM1 : ROOM2;
      expect(b.x0, s.key).toBeGreaterThanOrEqual(r.x - 0.5);
      expect(b.x1, s.key).toBeLessThanOrEqual(r.x + r.w - 0.5);
      expect(b.y1, s.key).toBeLessThanOrEqual(r.y + r.h - 0.5);
      expect(b.y0, s.key).toBeGreaterThanOrEqual(r.y - 1.5); // (the cage stands in its alcove)
    }
    const overlaps: string[] = [];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => {
      const A = box(a), B = box(b);
      if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1) overlaps.push(`${a.key}/${b.key}`);
    }));
    expect(overlaps).toEqual([]);
  });

  it("lights only what shows", () => {
    for (const l of denLights(false, false)) expect(l.x).toBeLessThan(DIVIDE_X);
    expect(denLights(true, true).some((l) => l.x > DIVIDE_X)).toBe(true);
  });
});

describe("who strolls where", () => {
  // Every leg on floor, clear of every footprint (and the braziers).
  const blocked = (loop: [number, number][], list: Station[], opened: boolean) => {
    const bad: string[] = [];
    loop.forEach((p, i) => {
      const q = loop[(i + 1) % loop.length], n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 10);
      for (let k = 0; k <= n; k++) {
        const pt = { x: p[0] + ((q[0] - p[0]) * k) / n, y: p[1] + ((q[1] - p[1]) * k) / n };
        if (at(pt.x, pt.y, opened) !== FLOOR) bad.push(`leg ${i} off the floor at ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
        const s = list.find((s) => inside(pt, box(s), 0.25));
        if (s) bad.push(`leg ${i} through ${s.key}`);
        if (BRAZIERS.some((b) => Math.hypot(b.x - pt.x, b.y - pt.y) < 0.35)) bad.push(`leg ${i} through a brazier`);
      }
    });
    return [...new Set(bad)];
  };

  it("walks Klutz round room 1, clear of everything", () => {
    expect(blocked(KLUTZ_LOOP, stations({ ...ALL, opened: false }), false)).toEqual([]);
  });

  it("walks visitors round the whole Den, clear of everything", () => {
    expect(blocked(VISITOR_LOOP, stations(ALL), true)).toEqual([]);
  });

  it("goes round and round, stopping at each spot", () => {
    const T = loopTime(KLUTZ_LOOP, STROLL.klutz);
    const a = strollAt(1, KLUTZ_LOOP, STROLL.klutz), b = strollAt(1 + T, KLUTZ_LOOP, STROLL.klutz);
    expect(b.x).toBeCloseTo(a.x); expect(b.y).toBeCloseTo(a.y);
    expect(strollAt(0, KLUTZ_LOOP, STROLL.klutz)).toMatchObject({ x: KLUTZ_LOOP[0][0], y: KLUTZ_LOOP[0][1], moving: false });
    expect(strollAt(STROLL.pause + 0.5, KLUTZ_LOOP, STROLL.klutz).moving).toBe(true);
  });
});

describe("the camera", () => {
  it("can't look past room 1 till the wall's down", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: 40, y: 7 }, 15, 8, a).x).toBeLessThanOrEqual(DIVIDE_X + 0.5);
    const b = denArea(true, PITCH);
    expect(clampView({ x: 40, y: 7 }, 15, 8, b).x).toBeGreaterThan(DIVIDE_X + 5);
  });

  it("centres a view wider than the Den on it", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: 0, y: 0 }, 30, 30, a)).toEqual({ x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 });
  });

  it("first looks at the middle of what's open", () => {
    expect(firstView(true, PITCH).x).toBeCloseTo(DIVIDE_X, 0);
    expect(firstView(false, PITCH).x).toBeLessThan(DIVIDE_X);
  });
});

describe("taps", () => {
  const list = stations(ALL);
  it("land on what's there, by its footprint or its height", () => {
    expect(stationAt(list, { x: 6.5, y: 7 }, PITCH)?.key).toBe("altar");
    const shack = list.find((s) => s.key === "shack")!;
    // Up the screen from the shack's footprint, over its roof as the camera sees it.
    expect(stationAt(list, { x: shack.x, y: shack.y - shack.d / 2 - 1 }, PITCH)?.key).toBe("shack");
    expect(stationAt(list, { x: 6.5, y: 4.5 }, PITCH)).toBeUndefined();
  });
});
