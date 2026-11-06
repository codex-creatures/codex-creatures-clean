import { describe, expect, it } from "vitest";
import { startWalkRun, walkInto, walkRoom, walkKeep, cageSpots, waitsHere } from "../lib/dungeon/walkRun";
import { hasFight, atTheTop, endRun, wonAtTop, type Cage, type DungeonRun, type DungeonSave } from "../lib/dungeon/run";
import { isSpawn, parentOf, placeFoes, placeWaiter, sees, endOf, WAIT_REACH } from "../lib/dungeon/foes";
import { layoutFloorplan, TWO_DEN_SHAPES, LARGE_SHAPE } from "../lib/dungeon/layout";
import { FLOOR } from "../lib/dungeon/floorplan";

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
    expect(Object.keys(run.walk!.layout.rooms).sort()).toEqual(Object.keys(run.map.nodes).filter((id) => !isSpawn(id)).sort());
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
  it("staying at the top after beating the chief still counts the clear, however you leave", () => {
    const top = walkInto(begin(), begin().map.boss);
    const won = { ...top, current: { ...top.current!, done: true } };
    expect(wonAtTop(won)).toBe(true);
    expect(wonAtTop(top)).toBe(false);
    const save = (run: DungeonRun): DungeonSave => ({ meta: { runs: 0, clears: 0, injuries: {}, bag: [] }, run });
    expect(endRun(save({ ...won, status: "retreated" })).meta.campClears).toBe(1);
    expect(endRun(save({ ...won, status: "dead" })).meta.campClears).toBe(0);
    expect(endRun(save({ ...top, status: "retreated" })).meta.campClears).toBe(0);
    // Walked out sideways since: still won.
    const side = Object.keys(won.walk!.rooms).find((id) => won.walk!.layout.tunnels.some((t) => !t.up && (t.a === id ? t.b : t.b === id ? t.a : "") === won.map.boss));
    if (side) expect(wonAtTop(walkInto(won, side))).toBe(true);
  });
  it("the chief waits for you, and his cages stand in a row behind him", () => {
    const run = begin();
    expect(waitsHere(run.walk!.rooms[run.map.boss], 0)).toBe(true);
    const fp = layoutFloorplan(run.walk!.layout);
    const chief = placeWaiter(fp, run.map.boss);
    const spots = cageSpots(fp, run.map.boss, 2);
    expect(spots).toHaveLength(2);
    for (const c of spots) {
      expect(fp.tiles[c.y * fp.w + c.x]).toBe(FLOOR);
      expect(c.y).toBeLessThan(chief.y);
    }
    // Not as you step in: only once you have walked up to him.
    expect(sees(fp, chief, { x: chief.x, y: chief.y + WAIT_REACH + 2 })).toBe(false);
    expect(sees(fp, chief, { x: chief.x, y: chief.y + 2 })).toBe(true);
  });
  it("some big rooms hold a second den, a room of its own at the far end", () => {
    let found = 0;
    for (let seed = 1; seed <= 8 && found === 0; seed++) {
      const run = begin(seed);
      for (const id of Object.keys(run.map.nodes).filter(isSpawn)) {
        found++;
        const parent = run.walk!.layout.rooms[parentOf(id)];
        expect(TWO_DEN_SHAPES).toContain(parent.shape);
        expect(run.map.nodes[parentOf(id)].kind).toBe("easy");
        expect(run.walk!.rooms[id].kind).toBe("easy");
        // The two dens' foes stand at opposite ends.
        const fp = layoutFloorplan(run.walk!.layout);
        const floors = fp.rooms[parentOf(id)];
        for (const f of placeFoes(fp, id, 3, seeded(5), 1)) expect(endOf(floors, f.x, f.y)).toBe(1);
        for (const f of placeFoes(fp, parentOf(id), 3, seeded(5), 0)) expect(endOf(floors, f.x, f.y)).toBe(0);
        // Walking into it is not another room explored.
        expect(walkInto(run, id).room).toBe(0);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe("the walkable Labyrinth (the lab)", () => {
  const lab = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], false, seeded(11), 1);
  it("is a Labyrinth run: its own mix, a large room, the Cyclops waiting at the top", () => {
    expect(lab.dungeon).toBeUndefined();
    expect(lab.campCages).toBeUndefined();
    const boss = lab.walk!.rooms[lab.map.boss];
    expect(boss.boss).toBe("cyclops");
    expect(waitsHere(boss, 1)).toBe(true);
    const large = Object.values(lab.walk!.layout.rooms).filter((r) => r.shape === LARGE_SHAPE.name);
    expect(large).toHaveLength(1);
    expect(["encampment", "library", "storehouse"]).toContain(lab.map.nodes[large[0].id].kind);
  });
  it("campfires are their own rooms (half the pools), never with a pool", () => {
    const fires = lab.walk!.fires ?? [];
    for (const f of fires) expect(lab.map.nodes[f.room].kind).toBe("campfire");
    for (const n of Object.values(lab.map.nodes)) if (n.kind === "campfire") expect(fires.some((f) => f.room === n.id)).toBe(true);
  });
});
