// The new Den's layout (lib/den3d/layout.ts): the plan, where things stand and may be moved to, who strolls
// where (round whatever's been moved), the camera's limits, what a tap lands on; and the Den's options.
import { describe, expect, it } from "vitest";
import { FLOOR, ROCK, TUNNEL, type Pt } from "@/lib/dungeon/floorplan";
import { parseDenOptions, stepAngle, DEN_DEFAULTS, DEN_ANGLES } from "@/lib/den3d/setting";
import {
  denPlan, denShown, stations, strollAt, routeLoop, routeTime, strollBlocked, braziers, clampView, denArea, firstView, stationAt, denLights,
  placed, fitsFloor, fitsWall, placeWall, nearestSlot, toLayout, snap, floorZone, FLOOR_START, WALL_START, SLOTS,
  KLUTZ_LOOP, VISITOR_LOOP, STROLL, ROOM1, ROOM2, NOOK1, NOOK2, WALL_GAP, DIVIDE_X, PLAN_W, LOOK_PAST, type Station, type DenState, type Placed,
} from "@/lib/den3d/layout";

const PITCH = Math.PI / 3;
const ALL: DenState = { opened: true, pit: true, trainingPit: false, repaired: true };
const SHUT: DenState = { opened: false, pit: false, trainingPit: false, repaired: false };
const at = (x: number, y: number, opened = false) => denPlan(opened).tiles[Math.round(y) * PLAN_W + Math.round(x)];
const box = (s: Station) => ({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, y0: s.y - s.d / 2, y1: s.y + s.d / 2 });

describe("the new Den's plan", () => {
  it("is a T: a hall with a nook in the middle of its back, split by a wall that all moves away", () => {
    expect(at(ROOM1.x, ROOM1.y)).toBe(FLOOR);
    expect(at(ROOM2.x + ROOM2.w - 1, ROOM2.y + ROOM2.h - 1)).toBe(FLOOR);
    expect(at(NOOK1.x, NOOK1.y)).toBe(FLOOR);
    expect(at(NOOK2.x + NOOK2.w - 1, NOOK2.y)).toBe(FLOOR);
    expect(at(NOOK1.x - 1, NOOK1.y + 2)).toBe(ROCK); // beside the nook: rock
    for (let y = WALL_GAP.y0; y < WALL_GAP.y1; y++) {
      expect(at(DIVIDE_X, y), `row ${y}`).toBe(ROCK);
      expect(at(DIVIDE_X, y, true), `row ${y}`).toBe(FLOOR); // (the whole wall, nook and hall)
    }
  });

  it("has a tunnel in the middle of each nook, mirrored about the wall", () => {
    expect(at(9, 0)).toBe(TUNNEL); expect(at(10, 0)).toBe(TUNNEL);   // the Labyrinth
    expect(at(16, 0)).toBe(TUNNEL); expect(at(17, 0)).toBe(TUNNEL);  // the PvP portal
    expect((9 + 10) / 2 - (NOOK1.x - 0.5)).toBeCloseTo(NOOK1.x + NOOK1.w - 0.5 - (9 + 10) / 2); // (centred in its nook)
    expect(DIVIDE_X - (9 + 10) / 2).toBeCloseTo((16 + 17) / 2 - DIVIDE_X);
  });

  it("shows room 2 only once the wall's gone", () => {
    const shut = denShown(false), open = denShown(true);
    expect(shut[ROOM2.y * PLAN_W + ROOM2.x + 2]).toBe(0);
    expect(open[ROOM2.y * PLAN_W + ROOM2.x + 2]).toBe(1);
  });
});

describe("what stands in it", () => {
  it("has every place, each going somewhere (the old wall aside), the tavern's only once it's open", () => {
    const shut = stations(SHUT).map((s) => s.key);
    expect(shut).toEqual(expect.arrayContaining(["shack", "storehouse", "bookcase", "altar", "pit", "pool", "board", "lectern", "arch", "cage", "rubble"]));
    expect(shut).not.toContain("tavern");
    const open = stations(ALL);
    expect(open.map((s) => s.key)).toEqual(expect.arrayContaining(["tavern", "portal", "training"]));
    expect(open.map((s) => s.key)).not.toContain("rubble");
    for (const s of open) expect(s.href, s.key).toBeTruthy();
  });

  it("puts the storehouse along the west wall, turned to face the room", () => {
    const s = stations(SHUT).find((q) => q.key === "storehouse")!;
    expect(s.turn).toBe("east");
    expect(s.d).toBeGreaterThan(s.w); // (longer north to south)
    expect(s.x - s.w / 2).toBeCloseTo(ROOM1.x - 0.5, 1);
  });

  it("keeps everything on its own room's floor (or against a north wall), none overlapping", () => {
    for (const state of [SHUT, ALL]) {
      const list = stations(state);
      for (const s of list) {
        const b = box(s), y0 = s.wall ? s.y + 0.2 : b.y0 + 0.02;
        for (const [x, y] of [[b.x0 + 0.02, y0], [b.x1 - 0.02, y0], [b.x0 + 0.02, b.y1 - 0.02], [b.x1 - 0.02, b.y1 - 0.02]]) {
          expect(at(x, y, state.opened) === FLOOR || at(x, y, true) === FLOOR, `${s.key} at ${x.toFixed(2)},${y.toFixed(2)}`).toBe(true);
          if (!state.opened) expect(x < DIVIDE_X, s.key).toBe(true);
        }
      }
      const overlaps: string[] = [];
      list.forEach((a, i) => list.slice(i + 1).forEach((b) => {
        const A = box(a), B = box(b);
        if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1) overlaps.push(`${a.key}/${b.key}`);
      }));
      expect(overlaps).toEqual([]);
    }
  });

  it("lights only what shows", () => {
    for (const l of denLights(SHUT)) expect(l.x).toBeLessThan(DIVIDE_X);
    expect(denLights(ALL).some((l) => l.x > DIVIDE_X)).toBe(true);
  });
});

describe("moving things", () => {
  const start = placed(undefined, true);

  it("starts everything where it fits", () => {
    expect(start.floor).toEqual(FLOOR_START);
    expect(start.wall).toEqual(WALL_START);
    for (const k of ["altar", "pool", "pit", "training"] as const) expect(fitsFloor(k, FLOOR_START[k], start, true), k).toBe(true);
    for (const k of ["altar", "pool", "pit"] as const) expect(fitsFloor(k, FLOOR_START[k], placed(undefined, false), false), k).toBe(true);
  });

  it("lets a floor thing stand in the middle of the hall, clear of the others, snapped to the grid", () => {
    expect(snap(7.3)).toBe(7.5);
    expect(fitsFloor("pool", { x: 8, y: 17 }, start, true)).toBe(false);           // on the Pit
    expect(fitsFloor("altar", { x: 1.5, y: 13 }, start, true)).toBe(false);        // on the storehouse, off the middle
    expect(fitsFloor("altar", { x: 7, y: 9 }, start, true)).toBe(false);           // in front of the shack, off the middle
    expect(fitsFloor("pool", { x: 15.5, y: 12 }, start, true)).toBe(true);         // across in the tavern's room, once it's open
    expect(fitsFloor("pool", { x: 15.5, y: 12 }, placed(undefined, false), false)).toBe(false); // …not before
    expect(fitsFloor("training", { x: 8, y: 12.5 }, start, true)).toBe(false);     // the tavern's pit stays in its room
    expect(floorZone(false).x1).toBeLessThan(DIVIDE_X - 0.5); // (clear of the old wall's socket)
  });

  it("snaps wall things to slots, swapping with whatever's there; the middle slot only once the wall's gone", () => {
    expect(nearestSlot({ x: 12.8, y: 2 }, true).id).toBe("nook-mid");
    expect(nearestSlot({ x: 12.8, y: 2 }, false).id).not.toBe("nook-mid");
    expect(fitsWall("cage", "nook-mid", false)).toBe(false);
    expect(fitsWall("cage", "nook-mid", true)).toBe(true);
    const swapped = placeWall(start, "cage", "hall-1");
    expect(swapped.wall.cage).toBe("hall-1");
    expect(swapped.wall.board).toBe(WALL_START.cage);
    for (const s of SLOTS) for (const k of ["board", "bookcase", "cage"] as const) expect(fitsWall(k, s.id, true), `${k} in ${s.id}`).toBe(true);
  });

  it("saves only what's moved, and puts back anything saved where it can't stand now", () => {
    const moved: Placed = { ...start, floor: { ...start.floor, altar: { x: 8, y: 12.5 } } };
    expect(toLayout(moved)).toEqual({ floor: { altar: { x: 8, y: 12.5 } }, wall: {} });
    expect(placed({ floor: { altar: { x: 8, y: 12.5 } } }, true).floor.altar).toEqual({ x: 8, y: 12.5 });
    expect(placed({ floor: { altar: { x: 1, y: 1 } } }, true).floor.altar).toEqual(FLOOR_START.altar);  // off the floor
    expect(placed({ floor: { pool: { x: 15.5, y: 12 } } }, false).floor.pool).toEqual(FLOOR_START.pool); // in room 2 with the wall up
    expect(placed({ wall: { cage: "nook-mid" } }, false).wall.cage).toEqual(WALL_START.cage);           // the middle slot with the wall up
    const twice = placed({ wall: { board: "nook-2", cage: "nook-2" } }, true).wall;                      // two in one slot: the later goes back
    expect(twice.board).toBe("nook-2");
    expect(twice.cage).toBe(WALL_START.cage);
  });
});

describe("who strolls where", () => {
  // Every leg of a route clear of what it must keep clear of.
  const clearRoute = (spots: Pt[], state: DenState, p?: Placed) => {
    const plan = denPlan(state.opened), shown = denShown(state.opened), pl = p ?? placed(undefined, state.opened);
    const blocked = strollBlocked(plan, shown, stations(state, pl), braziers(pl, state));
    const r = routeLoop(spots, blocked), bad: string[] = [];
    r.pts.forEach((a, i) => {
      const b = r.pts[(i + 1) % r.pts.length], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 10);
      for (let k = 0; k <= n; k++) { const x = a.x + ((b.x - a.x) * k) / n, y = a.y + ((b.y - a.y) * k) / n; if (blocked(x, y)) { bad.push(`${x.toFixed(1)},${y.toFixed(1)}`); break; } }
    });
    return { r, bad };
  };

  it("walks Klutz round room 1 and visitors round the whole Den, clear of everything", () => {
    const k = clearRoute(KLUTZ_LOOP, SHUT), v = clearRoute(VISITOR_LOOP, ALL);
    expect(k.bad).toEqual([]); expect(v.bad).toEqual([]);
    expect(k.r.stop.filter(Boolean).length).toBe(KLUTZ_LOOP.length); // (he stops at every spot)
  });

  it("finds a new way round things that have been moved", () => {
    const start = placed(undefined, false);
    const moved: Placed = { ...start, floor: { ...start.floor, altar: { x: 7.5, y: 16 }, pit: { x: 9.5, y: 12.5 }, pool: { x: 5, y: 12.5 } } };
    expect(clearRoute(KLUTZ_LOOP, SHUT, moved).bad).toEqual([]);
  });

  it("goes round and round, stopping at each spot", () => {
    const { r } = clearRoute(KLUTZ_LOOP, SHUT), T = routeTime(r, STROLL.klutz);
    const a = strollAt(1, r, STROLL.klutz), b = strollAt(1 + T, r, STROLL.klutz);
    expect(b.x).toBeCloseTo(a.x); expect(b.y).toBeCloseTo(a.y);
    expect(strollAt(0, r, STROLL.klutz).moving).toBe(false);
    expect(strollAt(STROLL.pause + 0.5, r, STROLL.klutz).moving).toBe(true);
  });
});

describe("the camera", () => {
  it("can't look past room 1 till the wall's gone (beyond a little dark)", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: 40, y: 7 }, 15, 8, a).x).toBeLessThanOrEqual(DIVIDE_X + 0.5);
    expect(clampView({ x: 40, y: 7 }, 15, 8, denArea(true, PITCH)).x).toBeGreaterThan(DIVIDE_X + 5);
  });

  it("can look past the walls into the dark, as far as LOOK_PAST", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: -50, y: 7 }, 15, 8, a).x).toBeCloseTo(ROOM1.x - 1 - LOOK_PAST.across + 7.5);
    expect(clampView({ x: 7, y: 99 }, 15, 8, a).y).toBeCloseTo(ROOM1.y + ROOM1.h + 0.3 + LOOK_PAST.deep - 4);
  });

  it("centres a view wider than the Den on it, and first looks at the middle of what's open", () => {
    const a = denArea(false, PITCH);
    expect(clampView({ x: 0, y: 0 }, 60, 60, a)).toEqual({ x: (a.x0 + a.x1) / 2, y: (a.y0 + a.y1) / 2 });
    expect(firstView(true, PITCH).x).toBeCloseTo(DIVIDE_X, 0);
    expect(firstView(false, PITCH).x).toBeLessThan(DIVIDE_X);
  });
});

describe("taps", () => {
  const list = stations(ALL);
  it("land on what's there, by its footprint or its height", () => {
    expect(stationAt(list, FLOOR_START.altar, PITCH)?.key).toBe("altar");
    const shack = list.find((s) => s.key === "shack")!;
    expect(stationAt(list, { x: shack.x, y: shack.y - shack.d / 2 - 1 }, PITCH)?.key).toBe("shack");
    expect(stationAt(list, { x: 9.5, y: 6.5 }, PITCH)).toBeUndefined(); // (the nook's open floor)
  });
});

describe("the new Den's options (Settings)", () => {
  it("fall back to their defaults when missing or damaged", () => {
    expect(parseDenOptions(null)).toEqual(DEN_DEFAULTS);
    expect(parseDenOptions("not json")).toEqual(DEN_DEFAULTS);
    expect(parseDenOptions(JSON.stringify({ names: false, angle: 33 }))).toEqual({ ...DEN_DEFAULTS, names: false });
    expect(parseDenOptions(JSON.stringify({ rubble: false, angle: 45 }))).toEqual({ ...DEN_DEFAULTS, angle: 45 });
  });
  it("step the angle along its list, stopping at the ends", () => {
    expect(stepAngle(60, 1)).toBe(65);
    expect(stepAngle(DEN_ANGLES[0], -1)).toBe(DEN_ANGLES[0]);
    expect(stepAngle(DEN_ANGLES[DEN_ANGLES.length - 1], 1)).toBe(DEN_ANGLES[DEN_ANGLES.length - 1]);
  });
});
