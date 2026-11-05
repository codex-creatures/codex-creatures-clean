import { describe, expect, it } from "vitest";
import { slowIt } from "./slow";
import { rollMap, questMap, crossings, routeLength } from "../lib/dungeon/map";
import { DUNGEONS, type DungeonId } from "../lib/dungeon/run";
import { buildFloorplan, checkFloorplan, rollLabyrinth, FLOOR, ROCK, TUNNEL, DOOR, type Floorplan } from "../lib/dungeon/floorplan";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// (The walkable Labyrinth needs a planar scroll: no corridors crossing.)
const mapFor = (dungeon: DungeonId, seed: number) => rollMap(false, seeded(seed), { ...DUNGEONS[dungeon].spec, planar: true }, dungeon);

// Every problem across a batch of maps (collected, then checked once): the
// planar scroll (no crossings, its usual route to the lair) and its floorplan.
function sweep(dungeon: DungeonId, seeds: number[]) {
  const spec = DUNGEONS[dungeon].spec;
  return seeds.flatMap((seed) => {
    const map = mapFor(dungeon, seed);
    const route = routeLength(map);
    return [
      ...(crossings(map) > 0 ? [`${crossings(map)} corridors cross`] : []),
      ...(route < spec.minRoute || route > spec.maxRoute ? [`the route to the lair is ${route} rooms`] : []),
      ...checkFloorplan(buildFloorplan(map, seeded(seed + 1)), map),
    ].map((p) => `dungeon ${dungeon} seed ${seed}: ${p}`);
  });
}

describe("labyrinth floorplan", () => {
  it("joins exactly the scroll's linked rooms, in every dungeon (a planar scroll)", () => {
    const problems = ([0, 1, 2, 3] as DungeonId[]).flatMap((d) => sweep(d, [11, 12]));
    expect(problems).toEqual([]);
  });

  it("joins the first quest's three rooms", () => {
    const map = questMap();
    expect(checkFloorplan(buildFloorplan(map, seeded(3)), map)).toEqual([]);
  });

  it("is the same plan for the same roll", () => {
    const map = mapFor(1, 5);
    const a = buildFloorplan(map, seeded(9)), b = buildFloorplan(map, seeded(9));
    expect(a.tiles).toEqual(b.tiles);
  });

  it("gives each room a door per corridor, on its wall", () => {
    const map = mapFor(1, 7);
    const fp = buildFloorplan(map, seeded(8));
    const doorsOf = (id: string) => fp.doors.filter((d) => d.room === id);
    const wrong = Object.values(map.nodes).filter((n) => doorsOf(n.id).length !== n.links.length).map((n) => n.id);
    expect(wrong).toEqual([]);
    const onWall = (d: Floorplan["doors"][number]) => {
      const r = fp.rooms[d.room];
      const inX = d.x >= r.x && d.x < r.x + r.w, inY = d.y >= r.y && d.y < r.y + r.h;
      return (inX && (d.y === r.y - 1 || d.y === r.y + r.h)) || (inY && (d.x === r.x - 1 || d.x === r.x + r.w));
    };
    expect(fp.doors.filter((d) => !onWall(d))).toEqual([]);
  });

  // The check itself must catch a broken plan.
  it("the check catches a hole in a wall and a blocked tunnel", () => {
    const map = mapFor(1, 5);
    const sound = buildFloorplan(map, seeded(6));
    const copy = (): Floorplan => ({ ...sound, tiles: sound.tiles.slice() });
    // A hole in the wall beside a door: the tunnel opens into the room off its door.
    const holed = copy();
    const d = sound.doors[0];
    const side = holed.tiles[d.y * holed.w + d.x + 1] === ROCK ? d.y * holed.w + d.x + 1 : (d.y + 1) * holed.w + d.x;
    holed.tiles[side] = TUNNEL;
    expect(checkFloorplan(holed, map)).not.toEqual([]);
    // A rockfall in the middle of a tunnel: it no longer joins its two rooms.
    const blocked = copy();
    const [, tiles] = Object.entries(sound.tunnels)[0];
    const mid = tiles[Math.floor(tiles.length / 2)];
    blocked.tiles[mid.y * blocked.w + mid.x] = ROCK;
    expect(checkFloorplan(blocked, map)).not.toEqual([]);
  });

  it("only uses the four kinds of tile", () => {
    const fp = buildFloorplan(mapFor(2, 4), seeded(4));
    expect([...new Set(fp.tiles)].every((t) => [ROCK, FLOOR, TUNNEL, DOOR].includes(t))).toBe(true);
  });

  it("a rolled labyrinth is always sound, even from a map whose first plan isn't", () => {
    // (The Hydra's seed 119 is one of the rare maps whose plan gets stuck.)
    const stuck = mapFor(2, 119);
    expect(buildFloorplan(stuck, seeded(120)).failed).not.toEqual([]);
    const { map, plan } = rollLabyrinth(false, seeded(119), DUNGEONS[2].spec, 2);
    expect(crossings(map)).toBe(0);
    expect(checkFloorplan(plan, map)).toEqual([]);
  });

  // Nearly every plan comes out sound first time (rollLabyrinth rerolls the rest).
  slowIt("joins up across many maps of every dungeon", () => {
    const seeds = Array.from({ length: 25 }, (_, i) => 100 + i);
    const problems = ([0, 1, 2, 3] as DungeonId[]).flatMap((d) => sweep(d, seeds));
    expect(problems.length).toBeLessThanOrEqual(seeds.length * 4 * 0.03 * 4); // under 3% of maps, ~4 lines each
  }, 300_000);
});
