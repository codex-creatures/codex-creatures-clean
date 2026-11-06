import { describe, expect, it } from "vitest";
import { ROCK, FLOOR, type Floorplan } from "../lib/dungeon/floorplan";
import { rollLayout, layoutFloorplan, campMap, WALK_SPEC } from "../lib/dungeon/layout";
import { lineOfSight, placeFoes, sees, spottedBy, stepFoe, visionCone, chargePath, chargeFoe, fightReady, DOOR_CLEAR, SIGHT_RANGE, SIGHT_NEAR, ALARM_MAX, LATE_GRACE, CHARGE_SPEED, type Foe } from "../lib/dungeon/foes";
import { chestSack, fightSack, rollWalkRooms, roomDepth } from "../lib/dungeon/walkRooms";
import { routeLength } from "../lib/dungeon/map";
import { CHEST_DROPS } from "../lib/dungeon/run";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// A floorplan from rows of text (# rock, anything else floor), one room "r" over all its floor.
function plan(rows: string[]): Floorplan {
  const w = rows[0].length, h = rows.length;
  const tiles = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
  return { w, h, tiles, rooms: { r: [{ x: 1, y: 1, w: w - 2, h: h - 2 }] }, doors: [], tunnels: {} };
}
const foe = (x: number, y: number, facing: number, extra: Partial<Foe> = {}): Foe => ({ room: "r", index: 0, x, y, facing, walks: false, path: [], wait: 3, ...extra });

// An L: open along the top and down the right, rock in the corner's crook.
const dogLeg = plan([
  "############",
  "#..........#",
  "#..........#",
  "#######....#",
  "#######....#",
  "#######....#",
  "############",
]);

describe("being seen", () => {
  const open = plan(["############", "#..........#", "#..........#", "#..........#", "############"]);

  it("sees what's ahead in range, not what's behind or too far", () => {
    const f = foe(1, 2, 0); // facing east
    expect(sees(open, f, { x: 6, y: 2 })).toBe(true);
    expect(sees(open, f, { x: 6, y: 3 })).toBe(true);        // a little off to the side
    expect(sees(open, foe(10, 2, 0), { x: 5, y: 2 })).toBe(false); // behind it
    expect(sees(open, foe(1, 2, Math.PI / 2), { x: 10, y: 2 })).toBe(false); // facing south, you're east
  });

  it("notices you right beside it whichever way it faces", () => {
    expect(sees(open, foe(5, 2, 0), { x: 4, y: 2 })).toBe(true);
    expect(SIGHT_NEAR).toBeLessThan(2);
    expect(sees(open, foe(5, 2, 0), { x: 3, y: 2 })).toBe(false);
  });

  it("can't see past its range", () => {
    const long = plan(["#".repeat(30), "#" + ".".repeat(28) + "#", "#".repeat(30)]);
    expect(sees(long, foe(1, 1, 0), { x: 1 + SIGHT_RANGE, y: 1 })).toBe(true);
    expect(sees(long, foe(1, 1, 0), { x: 2 + SIGHT_RANGE, y: 1 })).toBe(false);
  });

  it("can't see round a dog-leg's corner", () => {
    // At the top left, looking east and down: the foot of the L is hidden by rock.
    expect(lineOfSight(dogLeg, { x: 2, y: 2 }, { x: 8, y: 5 })).toBe(false);
    expect(lineOfSight(dogLeg, { x: 2, y: 1 }, { x: 9, y: 1 })).toBe(true);
    expect(sees(dogLeg, foe(8, 5, -Math.PI / 2), { x: 8, y: 1 })).toBe(true);
  });

  it("names the room whose foes saw you, if it's still awake", () => {
    const foes = [foe(1, 2, 0), { ...foe(10, 2, Math.PI), room: "s" }];
    expect(spottedBy(open, foes, { x: 5, y: 2 }, () => true)).toBe("r");
    expect(spottedBy(open, foes, { x: 5, y: 2 }, (r) => r === "s")).toBe("s");
    expect(spottedBy(open, foes, { x: 5, y: 2 }, () => false)).toBe(null);
  });

  it("draws its cone stopped by walls", () => {
    const cone = visionCone(dogLeg, foe(2, 1, 0));
    expect(cone.every((p) => p.x <= 10.5 && p.y >= 0.5 && p.y <= 5.5)).toBe(true);
    expect(Math.max(...cone.map((p) => p.x))).toBeGreaterThan(7);
  });
});

describe("foes in a room", () => {
  const layout = rollLayout(WALK_SPEC, seeded(5));
  const fp = layoutFloorplan(layout);

  it("start on its floor, clear of its doors, spread out", () => {
    const problems: string[] = [];
    for (const id of Object.keys(layout.rooms)) {
      const foes = placeFoes(fp, id, 3, seeded(9));
      if (foes.length !== 3) problems.push(`${id}: ${foes.length} foes`);
      for (const f of foes) {
        if (!fp.rooms[id].some((r) => f.x >= r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.h)) problems.push(`${id}: off its floor`);
        if (fp.doors.some((d) => d.room === id && Math.hypot(d.x - f.x, d.y - f.y) < DOOR_CLEAR)) problems.push(`${id}: by a door`);
        if (foes.some((g) => g !== f && g.x === f.x && g.y === f.y)) problems.push(`${id}: two on one spot`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("stand still and turn, or walk about inside their room", () => {
    const id = Object.keys(layout.rooms).find((r) => r !== layout.start)!;
    let still = { ...placeFoes(fp, id, 1, seeded(3))[0], walks: false, wait: 0.5 };
    const was = still.facing;
    still = stepFoe(fp, still, 1, seeded(4));
    expect(still.facing).not.toBe(was);
    let walker: Foe = { ...placeFoes(fp, id, 1, seeded(3))[0], walks: true, wait: 0 };
    const start = { x: walker.x, y: walker.y };
    let moved = false;
    const rng = seeded(11);
    for (let i = 0; i < 200; i++) {
      walker = stepFoe(fp, walker, 0.1, rng);
      if (walker.x !== start.x || walker.y !== start.y) moved = true;
      expect(fp.rooms[id].some((r) => Math.round(walker.x) >= r.x && Math.round(walker.x) < r.x + r.w && Math.round(walker.y) >= r.y && Math.round(walker.y) < r.y + r.h)).toBe(true);
    }
    expect(moved).toBe(true);
  });
});

describe("the walkable Encampment's rooms", () => {
  const layout = rollLayout(WALK_SPEC, seeded(2));
  const map = campMap(layout, false, seeded(3));
  const rooms = rollWalkRooms(map, seeded(4));

  it("rolls every room but the entrance, by the live game's room roll", () => {
    for (const n of Object.values(map.nodes)) {
      if (n.kind === "entrance") { expect(rooms[n.id]).toBeUndefined(); continue; }
      expect(rooms[n.id].kind).toBe(n.kind);
      if (n.kind === "easy") expect(rooms[n.id].enemies!.length).toBeGreaterThan(0);
    }
    const camp = rooms[map.boss];
    expect(camp.kind).toBe("encampment");
    expect(camp.enemies).toHaveLength(1);
    expect(camp.cages!.length).toBeGreaterThan(0);
  });

  it("counts depth forward like the live game, sideways-only rooms by any route", () => {
    for (const id of Object.keys(map.nodes)) {
      const d = roomDepth(map, id), fwd = routeLength(map, id);
      expect(d).toBe(fwd === Infinity ? d : fwd);
      expect(d).toBeLessThan(Infinity);
    }
    expect(roomDepth(map, map.start)).toBe(0);
  });

  it("leaves gold (and the chief's extras) when beaten, and a chest's drops", () => {
    const den = Object.values(rooms).find((r) => r.kind === "easy")!;
    expect(fightSack(den, seeded(1))[0]).toEqual({ gold: den.gold });
    expect(fightSack(rooms[map.boss], seeded(1)).length).toBeGreaterThan(1);
    expect(chestSack().length).toBeGreaterThanOrEqual(CHEST_DROPS);
  });
});

describe("seen: they come at you", () => {
  const room: Floorplan = (() => {
    const rows = ["##########", "#........#", "#........#", "##########"];
    const w = rows[0].length, h = rows.length, tiles = new Uint8Array(w * h);
    rows.forEach((r, y) => [...r].forEach((c, x) => { tiles[y * w + x] = c === "#" ? ROCK : FLOOR; }));
    return { w, h, tiles, rooms: {}, doors: [], tunnels: {} };
  })();
  it("walks up to you and stops a tile short", () => {
    const way = chargePath(room, { x: 8, y: 1 }, { x: 1, y: 1 });
    expect(way[way.length - 1]).toEqual({ x: 2, y: 1 });
    expect(chargePath(room, { x: 2, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
  it("comes at CHARGE_SPEED, facing you", () => {
    const foe: Foe = { room: "a", index: 0, x: 8, y: 1, facing: 0, walks: false, path: chargePath(room, { x: 8, y: 1 }, { x: 1, y: 1 }), wait: 0 };
    const later = chargeFoe(foe, 1);
    expect(later.x).toBeCloseTo(8 - CHARGE_SPEED);
    expect(Math.cos(later.facing)).toBeCloseTo(-1);
    expect(chargeFoe(later, 10).x).toBe(2);
  });
  it("fades into the fight when they're all there, a moment after the first, or after a while regardless", () => {
    expect(fightReady([], 2, 0.5)).toBe(false);
    expect(fightReady([1, 1.2], 2, 1.2)).toBe(true);
    expect(fightReady([1], 2, 1 + LATE_GRACE - 0.1)).toBe(false);
    expect(fightReady([1], 2, 1 + LATE_GRACE)).toBe(true);
    expect(fightReady([], 3, ALARM_MAX)).toBe(true);
  });
});
