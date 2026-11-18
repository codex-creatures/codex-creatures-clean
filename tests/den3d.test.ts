// The new Den's layout (lib/den3d/layout.ts): the plan, where things stand, who strolls where, the
// camera's limits and what a tap lands on.
import { describe, expect, it } from "vitest";
import { FLOOR, ROCK, TUNNEL } from "@/lib/dungeon/floorplan";
import { parseDenOptions, stepAngle, DEN_DEFAULTS, DEN_ANGLES } from "@/lib/den3d/setting";
import {
  denPlan, denShown, stations, strollAt, clampView, denArea, firstView, stationAt, denLights, BRAZIERS, BRAZIERS_2,
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, loopTime, ROOM1, ROOM2, NOOK1, NOOK2, WALL_GAP, DIVIDE_X, PLAN_W, LOOK_PAST, type Station,
} from "@/lib/den3d/layout";

const PITCH = Math.PI / 3;
const ALL = { opened: true, pit: true, trainingPit: false, repaired: true };
const at = (x: number, y: number, opened = false) => denPlan(opened).tiles[Math.round(y) * PLAN_W + Math.round(x)];
// A station's footprint, as a box (u).
const box = (s: Station) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y - s.d / 2, y1: s.y + s.d / 2 });
const inside = (p: { x: number; y: number }, b: ReturnType<typeof box>, pad = 0) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.y > b.y0 - pad && p.y < b.y1 + pad;

describe("the new Den's plan", () => {
  it("is a T: a hall with a nook in the middle of its back, split by rock that partly comes down", () => {
    expect(at(ROOM1.x, ROOM1.y)).toBe(FLOOR);
    expect(at(ROOM2.x + ROOM2.w - 1, ROOM2.y + ROOM2.h - 1)).toBe(FLOOR);
    expect(at(NOOK1.x, NOOK1.y)).toBe(FLOOR);
    expect(at(NOOK2.x + NOOK2.w - 1, NOOK2.y)).toBe(FLOOR);
    expect(at(NOOK1.x - 1, NOOK1.y + 2)).toBe(ROCK);           // beside the nook: rock
    expect(at(NOOK2.x + NOOK2.w, NOOK2.y + 2)).toBe(ROCK);
    for (let y = NOOK1.y; y < ROOM1.y + ROOM1.h; y++) {
      const comes = y >= WALL_GAP.y0 && y < WALL_GAP.y1;
      expect(at(DIVIDE_X, y), `row ${y}`).toBe(ROCK);
      expect(at(DIVIDE_X, y, true), `row ${y}`).toBe(comes ? FLOOR : ROCK); // (the nook stays split)
    }
    expect(at(10, 0)).toBe(TUNNEL); // room 1's tunnel: the Labyrinth
    expect(at(16, 0)).toBe(TUNNEL); // room 2's
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

  it("keeps everything on its own room's floor (or against a north wall), none overlapping", () => {
    const list = [...stations(ALL), ...stations({ ...ALL, opened: false }).filter((s) => s.key === "rubble")];
    for (const s of list) {
      // Its footprint's corners (a wall thing's just in front of its wall) on its own room's floor.
      const b = box(s), y0 = s.wall ? s.y + 0.2 : b.y0 + 0.02, side = (x: number) => (x < DIVIDE_X ? 1 : 2);
      for (const [x, y] of [[b.x0 + 0.02, y0], [b.x1 - 0.02, y0], [b.x0 + 0.02, b.y1 - 0.02], [b.x1 - 0.02, b.y1 - 0.02]]) {
        expect(at(x, y, false) === FLOOR || at(x, y, true) === FLOOR, `${s.key} at ${x.toFixed(2)},${y.toFixed(2)}`).toBe(true);
        expect(side(x), s.key).toBe(s.room);
      }
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
        if ([...BRAZIERS, ...BRAZIERS_2].some((b) => Math.hypot(b.x - pt.x, b.y - pt.y) < 0.35)) bad.push(`leg ${i} through a brazier`);
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

  it("can look past the walls into the dark, as far as LOOK_PAST", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: -50, y: 7 }, 15, 8, a).x).toBeCloseTo(ROOM1.x - 1 - LOOK_PAST.across + 7.5);
    expect(clampView({ x: 7, y: 99 }, 15, 8, a).y).toBeCloseTo(ROOM1.y + ROOM1.h + 0.3 + LOOK_PAST.deep - 4);
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
    expect(stationAt(list, { x: 7, y: 13 }, PITCH)?.key).toBe("altar");
    const shack = list.find((s) => s.key === "shack")!;
    // Up the screen from the shack's footprint, over its roof as the camera sees it.
    expect(stationAt(list, { x: shack.x, y: shack.y - shack.d / 2 - 1 }, PITCH)?.key).toBe("shack");
    expect(stationAt(list, { x: 5, y: 11.5 }, PITCH)).toBeUndefined();
  });
});

describe("the new Den's options (Settings)", () => {
  it("fall back to their defaults when missing or damaged", () => {
    expect(parseDenOptions(null)).toEqual(DEN_DEFAULTS);
    expect(parseDenOptions("not json")).toEqual(DEN_DEFAULTS);
    expect(parseDenOptions(JSON.stringify({ names: false, angle: 33 }))).toEqual({ ...DEN_DEFAULTS, names: false });
    expect(parseDenOptions(JSON.stringify({ rubble: false, angle: 45 }))).toEqual({ ...DEN_DEFAULTS, rubble: false, angle: 45 });
  });
  it("step the angle along its list, stopping at the ends", () => {
    expect(stepAngle(60, 1)).toBe(65);
    expect(stepAngle(DEN_ANGLES[0], -1)).toBe(DEN_ANGLES[0]);
    expect(stepAngle(DEN_ANGLES[DEN_ANGLES.length - 1], 1)).toBe(DEN_ANGLES[DEN_ANGLES.length - 1]);
  });
});
