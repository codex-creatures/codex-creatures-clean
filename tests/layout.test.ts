import { describe, expect, it } from "vitest";
import { DUNGEONS } from "../lib/dungeon/run";
import { checkFloorplan, ROCK, TUNNEL, type Floorplan } from "../lib/dungeon/floorplan";
import {
  rollLayout, layoutFloorplan, layoutMap, routeProblems, waysOn, enter, startProgress, isOpen, stepRule, floorOf,
  SHAPES, START_SHAPE, BOSS_SHAPE, LAYOUT_W, EDGE, TUNNEL_W, type Layout, type Tunnel,
} from "../lib/dungeon/layout";
import { findPath } from "../lib/dungeon/walk";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const encampment = (seed: number) => rollLayout(DUNGEONS[0].spec, seeded(seed));
const middle = (l: Layout, id: string) => { const f = floorOf(l.rooms[id]); return { x: f.x + Math.floor(f.w / 2), y: f.y + Math.floor(f.h / 2) }; };

// A made-up layout (blocks): the entrance, a room above it, a room beside
// that, and the boss on top. Tunnel rects don't matter to the route rules.
function tiny(tunnels: [string, string, boolean][]): Layout {
  const room = (id: string, x: number, y: number, w: number, h: number) => ({ id, shape: id, x, y, w, h });
  const t = ([a, b, up]: [string, string, boolean]): Tunnel => ({ key: `${a}|${b}`, a, b, up, rect: { x: 0, y: 0, w: 1, h: 1 } });
  return {
    w: 20, h: 20, start: "start", boss: "boss",
    rooms: { start: room("start", 0, 15, 12, 3), a: room("a", 0, 9, 5, 5), b: room("b", 7, 9, 5, 5), boss: room("boss", 0, 2, 10, 5) },
    tunnels: tunnels.map(t),
  };
}

describe("labyrinth layout (gen 1 and 2)", () => {
  it("rolls sound Encampments: the rooms fit, the tunnels join the right rooms, no traps, a long enough route", () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const l = encampment(seed);
      const tag = (p: string) => `seed ${seed}: ${p}`;
      problems.push(...routeProblems(l, DUNGEONS[0].spec.minRoute).map(tag));
      problems.push(...checkFloorplan(layoutFloorplan(l), layoutMap(l)).map(tag));
      if (Object.keys(l.rooms).length !== DUNGEONS[0].spec.rooms + 2) problems.push(tag(`${Object.keys(l.rooms).length} rooms`));
      const sizes = [...SHAPES, START_SHAPE, BOSS_SHAPE];
      for (const r of Object.values(l.rooms)) {
        if (!sizes.some((s) => s.name === r.shape && s.w === r.w && s.h === r.h)) problems.push(tag(`${r.id} is ${r.w}×${r.h}`));
        if (r.x < EDGE || r.x + r.w > EDGE + LAYOUT_W) problems.push(tag(`${r.id} sticks out`));
      }
      for (const t of l.tunnels) if ((t.up ? t.rect.w : t.rect.h) !== TUNNEL_W) problems.push(tag(`${t.key} isn't ${TUNNEL_W} wide`));
    }
    expect(problems).toEqual([]);
  });

  // The tile check itself must catch a broken plan.
  it("the tile check catches a hole in a wall and a blocked tunnel", () => {
    const l = encampment(2);
    const sound = layoutFloorplan(l), map = layoutMap(l);
    const copy = (): Floorplan => ({ ...sound, tiles: sound.tiles.slice() });
    // A hole in the rock beside a tunnel's door: the tunnel opens into the room off its door.
    const holed = copy();
    const t = l.tunnels.find((t) => t.up)!;
    holed.tiles[(t.rect.y + 1) * holed.w + t.rect.x - 1] = TUNNEL; // just outside the tunnel, below the top door
    holed.tiles[t.rect.y * holed.w + t.rect.x - 1] = TUNNEL;       // …and through the upper room's wall
    expect(checkFloorplan(holed, map)).not.toEqual([]);
    // A rockfall across the middle of a tunnel: it no longer joins its two rooms.
    const blocked = copy();
    const midY = t.rect.y + Math.floor(t.rect.h / 2);
    for (let x = t.rect.x; x < t.rect.x + t.rect.w; x++) blocked.tiles[midY * blocked.w + x] = ROCK;
    expect(checkFloorplan(blocked, map)).not.toEqual([]);
    expect(checkFloorplan(sound, map)).toEqual([]);
  });

  it("is the same layout for the same roll", () => {
    expect(encampment(5)).toEqual(encampment(5));
  });

  it("only goes up an up tunnel, and closes what's behind", () => {
    const l = tiny([["start", "a", true], ["a", "b", false], ["b", "boss", true]]);
    // (Sound but for its single ways out and in: a real layout needs 2.)
    expect(routeProblems(l, 3).filter((p) => !p.includes(" ways "))).toEqual([]);
    const p = startProgress(l);
    expect(waysOn(l, p).map((w) => w.to.room)).toEqual(["a"]);
    const inA = enter(l, p, "a");
    expect(inA.line).toBe(14); // a's bottom
    expect(isOpen(l, inA, "start")).toBe(false);
    // Sideways both ways, but never back down.
    expect(waysOn(l, inA).map((w) => w.to.room)).toEqual(["b"]);
    const inB = enter(l, inA, "b");
    expect(inB.line).toBe(14); // sideways doesn't move the line
    expect(waysOn(l, inB).map((w) => w.to.room).sort()).toEqual(["a", "boss"]);
    expect(enter(l, inB, "start")).toEqual(inB); // no way back
  });

  it("the check catches a trap and a room you can't reach", () => {
    // Up into a with nowhere on from it.
    const trap = tiny([["start", "a", true], ["start", "b", true], ["b", "boss", true]]);
    expect(routeProblems(trap, 0).some((p) => p.startsWith("stuck in a"))).toBe(true);
    // b only joins the boss: you never get into it.
    const lost = tiny([["start", "a", true], ["a", "boss", true], ["b", "boss", false]]);
    expect(routeProblems(lost, 0)).toContain("b can't be reached");
  });

  it("walking: through an up tunnel, then no way back down", () => {
    const l = encampment(3);
    const fp = layoutFloorplan(l);
    const up = l.tunnels.find((t) => t.up && t.a === l.start)!;
    const there = middle(l, up.b);
    const start = middle(l, l.start);
    const path = findPath(fp, start, there, stepRule(l, fp, startProgress(l)));
    expect(path).not.toBeNull();
    const after = enter(l, startProgress(l), up.b);
    expect(findPath(fp, there, start, stepRule(l, fp, after))).toBeNull();
    // Not even into the tunnel's top door from the room above.
    const door = { x: up.rect.x + 1, y: up.rect.y };
    expect(stepRule(l, fp, after)({ x: door.x, y: door.y - 1 }, door)).toBe(false);
  });
});
