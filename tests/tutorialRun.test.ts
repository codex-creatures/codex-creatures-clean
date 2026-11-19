import { describe, it, expect } from "vitest";
import { startTutorialRun, TUTORIAL_LAYOUT, TUTORIAL_PLACED, TUTORIAL_LIFE, CLUB_SPOT, START_SPOT, THIEF_SPOT } from "../lib/dungeon/tutorialRun";
import { layoutFloorplan, layoutMap, stepRule, startProgress } from "../lib/dungeon/layout";
import { checkFloorplan, ROCK } from "../lib/dungeon/floorplan";
import { findPath } from "../lib/dungeon/walk";
import { migrateWalkRun } from "../lib/world/migrate";
import { placementsFrom } from "../lib/world/placements";
import { thingsOf, placeFloorLifeOf, foesToPlace } from "../lib/world/walkWorld";
import { walkRoom, walkInto, waitsHere } from "../lib/dungeon/walkRun";
import { wonAtTop, type DungeonRun } from "../lib/dungeon/run";
import { THIEF_HP_MULT } from "../lib/quest";

const run = () => startTutorialRun(["a"], ["a"], {}, 1, "beast");

describe("the first quest's run, walked (lib/dungeon/tutorialRun.ts)", () => {
  it("is a sound place: the entrance, one corridor up, the thief's room", () => {
    const fp = layoutFloorplan(TUTORIAL_LAYOUT);
    expect(checkFloorplan(fp, layoutMap(TUTORIAL_LAYOUT))).toEqual([]);
    expect(TUTORIAL_LAYOUT.tunnels).toHaveLength(1);
  });

  it("its saved placements pass the save checks, as made", () => {
    const m = migrateWalkRun(run());
    expect(m.problem).toBeUndefined();
    expect(m.outcome).toBe("unchanged");
  });

  it("everything stands on floor, and you can walk from the start to the club and up to the thief", () => {
    const fp = layoutFloorplan(TUTORIAL_LAYOUT), r = run();
    const placements = placementsFrom(TUTORIAL_PLACED, r.walk!);
    const off: string[] = [];
    for (const i of TUTORIAL_PLACED) {
      const p = placements.spot(i.id)!;
      if (fp.tiles[Math.round(p.y) * fp.w + Math.round(p.x)] === ROCK) off.push(i.id);
    }
    expect(off).toEqual([]);
    const p = startProgress(TUTORIAL_LAYOUT);
    expect(findPath(fp, START_SPOT, CLUB_SPOT, stepRule(TUTORIAL_LAYOUT, fp, p))).not.toBeNull();
    expect(findPath(fp, CLUB_SPOT, { x: THIEF_SPOT.x, y: THIEF_SPOT.y + 3 }, stepRule(TUTORIAL_LAYOUT, fp, p))).not.toBeNull();
  });

  it("the club lies in the corridor with a \"!\" over it till you pick it up; the bookcase is there to search, with nothing in it", () => {
    const r = run(), placements = placementsFrom(TUTORIAL_PLACED, r.walk!);
    const things = () => thingsOf(TUTORIAL_LAYOUT, placements, ["start", "thief"], (id) => walkRoom(r, id), [], undefined, 1);
    const club = things().find((t) => t.pickup === "club")!;
    expect(club).toMatchObject({ room: "start", flag: true });
    expect(things().find((t) => t.shelf)).toBeTruthy();
    expect(TUTORIAL_PLACED.some((i) => i.codex)).toBe(false);
    r.current = { ...r.current!, done: true };
    expect(things().some((t) => t.pickup === "club")).toBe(false);
  });

  it("the thief waits at the top of his room, one foe, armed with nothing but double HP, and can't knock you out", () => {
    const thief = run().walk!.rooms.thief;
    expect(waitsHere(thief, 1)).toBe(true);
    expect(foesToPlace(thief, 1)).toBe(1);
    expect(thief.enemies![0]).toMatchObject({ creatureId: "baby_cyclops", races: ["beast"], hpMult: THIEF_HP_MULT, gentle: true });
  });

  it("its cobwebs, puddle and rat are its own, the same every time", () => {
    const r = run();
    expect(placeFloorLifeOf(r.walk!, layoutFloorplan(TUTORIAL_LAYOUT), [], [], [])).toBe(TUTORIAL_LIFE);
    expect(TUTORIAL_LIFE.webs.length).toBeGreaterThan(0);
    expect(TUTORIAL_LIFE.holes.length).toBeGreaterThan(0);
  });

  it("beating the thief isn't a Labyrinth clear", () => {
    let r: DungeonRun = walkInto(run(), "thief");
    r = { ...r, current: { ...r.current!, done: true } };
    expect(wonAtTop(r)).toBe(false);
  });

  it("starts in the entrance, nothing explored yet", () => {
    const r = run();
    expect(r.current).toMatchObject({ quest: "club", done: false });
    expect(r.walk).toMatchObject({ at: START_SPOT, room: "start", tutorial: true });
  });
});
