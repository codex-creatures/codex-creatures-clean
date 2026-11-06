import { describe, expect, it } from "vitest";
import { startWalkRun, walkInto, walkRoom, walkKeep } from "../lib/dungeon/walkRun";
import { hasFight, atTheTop, endRun, type Cage, type DungeonSave } from "../lib/dungeon/run";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const cages: Cage[] = [{ creatureId: "moss_wolf", level: 3 }, {}];
const begin = (seed = 3) => startWalkRun(["a", "b"], ["a", "b"], { a: 1, b: 0.5 }, 4, cages, false, seeded(seed));

describe("the walkable Encampment run", () => {
  it("is an Encampment run, its rooms all rolled, standing at the entrance", () => {
    const run = begin();
    expect(run.dungeon).toBe(0);
    expect(run.path).toEqual([run.map.start]);
    expect(run.current).toBeNull();
    expect(run.hp).toEqual({ a: 1, b: 0.5 });
    const ids = Object.keys(run.map.nodes).filter((id) => id !== run.map.start);
    expect(Object.keys(run.walk!.rooms).sort()).toEqual(ids.sort());
    expect(Object.keys(run.walk!.layout.rooms).sort()).toEqual(Object.keys(run.map.nodes).sort());
    expect(run.walk!.rooms[run.map.boss].kind).toBe("encampment");
    expect(run.walk!.rooms[run.map.boss].cages).toEqual(cages);
    expect(run.campCages).toEqual(cages);
  });
  it("survives being saved (plain JSON)", () => {
    const run = begin();
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
  it("walking in makes a room the current one; walking out puts it back as it was", () => {
    const run = begin();
    const fightRoom = Object.keys(run.walk!.rooms).find((id) => hasFight(run.walk!.rooms[id]) && id !== run.map.boss)!;
    const other = Object.keys(run.walk!.rooms).find((id) => id !== fightRoom && id !== run.map.boss)!;
    const inFight = walkInto(run, fightRoom);
    expect(inFight.current).toEqual(run.walk!.rooms[fightRoom]);
    expect(inFight.walk!.rooms[fightRoom]).toBeUndefined();
    expect(inFight.room).toBe(1);
    expect(inFight.cleared).toContain(run.map.start);
    // Slipped past unseen: it's left as it was, not cleared.
    const past = walkInto(inFight, other);
    expect(past.walk!.rooms[fightRoom]).toEqual(run.walk!.rooms[fightRoom]);
    expect(past.cleared).not.toContain(fightRoom);
    expect(walkRoom(past, fightRoom)?.done).toBe(false);
    // Back again: not a new room explored.
    const back = walkInto(past, fightRoom);
    expect(back.room).toBe(2);
    // Beaten, then left: cleared.
    const beaten = walkInto({ ...back, current: { ...back.current!, done: true } }, other);
    expect(beaten.cleared).toContain(fightRoom);
    expect(beaten.walk!.rooms[fightRoom].done).toBe(true);
  });
  it("the chief's camp is the top: beating it ends the run as the Encampment's", () => {
    const run = walkInto(begin(), begin().map.boss);
    expect(atTheTop(run)).toBe(true);
    const save: DungeonSave = { meta: { runs: 0, clears: 0, injuries: {}, bag: [] }, run: { ...run, status: "cleared" } };
    expect(endRun(save).meta.campClears).toBe(1);
  });
  it("does nothing once the run's over, or for a room that isn't there", () => {
    const run = begin();
    expect(walkInto({ ...run, status: "dead" }, run.map.boss).path).toEqual(run.path);
    expect(walkInto(run, "nowhere")).toBe(run);
    expect(walkKeep(run, { at: { x: 1, y: 2 } }).walk!.at).toEqual({ x: 1, y: 2 });
  });
});
