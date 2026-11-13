import { describe, expect, it } from "vitest";
import { startWalkRun, walkInto, walkRoom, walkKeep, waitsHere, headHome } from "../lib/dungeon/walkRun";
import { torchReach, FLARE_WALK, FLARE_REACH, TORCH_RADIUS } from "../lib/dungeon/torch";
import { hasFight, atTheTop, endRun, wonAtTop, leaveSack, type Cage, type DungeonRun, type DungeonSave } from "../lib/dungeon/run";
import { isSpawn, parentOf, spawnOf, sees, endOf, WAIT_REACH } from "../lib/dungeon/foes";
import { layoutFloorplan, TWO_DEN_SHAPES, LARGE_SHAPE } from "../lib/dungeon/layout";
import { FLOOR } from "../lib/dungeon/floorplan";
import { placeFoes, placeWaiter, cageSpots } from "../lib/world/compat/v0Placers";

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

describe("the walkable Labyrinth (New: the Cyclops)", () => {
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
  it("beating the Cyclops and heading home is a Labyrinth clear", () => {
    const top = walkInto(lab, lab.map.boss);
    expect(atTheTop(top)).toBe(true);
    const won = { ...top, current: { ...top.current!, done: true } };
    const home = headHome(won);
    expect(home.status).toBe("cleared");
    const meta = { runs: 2, clears: 0, injuries: {}, bag: [] };
    const after = endRun({ meta, run: home }).meta;
    expect(after.clears).toBe(1);
    expect(after.firstClearRun).toBe(2);
    // Left by the Den instead (retreated) once he's beaten: still a clear.
    expect(endRun({ meta, run: { ...won, status: "retreated" } }).meta.clears).toBe(1);
    // Not beaten: no clear, and heading home does nothing.
    expect(headHome(top)).toBe(top);
    expect(endRun({ meta, run: { ...top, status: "retreated" } }).meta.clears).toBe(0);
  });
  it("Klutz's dynamite quest: the large room is the storehouse, with the dynamite, marked", () => {
    const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], false, seeded(12), 1, true);
    const large = Object.values(run.walk!.layout.rooms).find((r) => r.shape === LARGE_SHAPE.name)!;
    expect(run.map.nodes[large.id]).toMatchObject({ kind: "storehouse", dynamite: true, known: true });
    expect(run.walk!.rooms[large.id].dynamite).toBe(true);
  });
  it("a sweep of runs: every room rolled, standing on floor, sound to walk", () => {
    const problems: string[] = [];
    for (let seed = 21; seed < 27; seed++) {
      const run = startWalkRun(["a"], ["a"], { a: 1 }, 2, [], seed % 2 === 0, seeded(seed), 1);
      const fp = layoutFloorplan(run.walk!.layout);
      const floor = (q: { x: number; y: number }) => fp.tiles[q.y * fp.w + q.x] !== 0;
      for (const [id, n] of Object.entries(run.map.nodes)) {
        if (id === run.map.start) continue;
        const room = run.walk!.rooms[id];
        if (!room) { problems.push(`${seed}: ${id} not rolled`); continue; }
        if (room.kind !== n.kind) problems.push(`${seed}: ${id} is ${room.kind}, its map node ${n.kind}`);
        if (hasFight(room) && !room.boss && !(room.enemies?.length)) problems.push(`${seed}: ${id} a fight with no foes`);
        // Its foes find room to stand (two dens keep to an end each).
        if (hasFight(room) && room.enemies && !waitsHere(room, 1)) {
          const two = !!run.map.nodes[spawnOf(parentOf(id))];
          const placed = placeFoes(fp, id, room.enemies.length, seeded(seed), two ? (isSpawn(id) ? 1 : 0) : undefined);
          if (placed.length !== room.enemies.length) problems.push(`${seed}: ${id} has room for ${placed.length} of ${room.enemies.length} foes`);
          for (const f of placed) if (!floor(f)) problems.push(`${seed}: ${id} foe off the floor`);
        }
        if (room.cages?.length) for (const c of cageSpots(fp, parentOf(id), room.cages.length)) if (!floor(c)) problems.push(`${seed}: ${id} cage off the floor`);
      }
      for (const f of run.walk!.fires ?? []) if (!floor(f)) problems.push(`${seed}: fire off the floor`);
      if (!floor(placeWaiter(fp, run.map.boss))) problems.push(`${seed}: the Cyclops off the floor`);
      expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    }
    expect(problems).toEqual([]);
  }, 120_000); // (new Cyclops runs take about 3 s each to roll, since its 60-room climb, 2026-11-11)
});

describe("flares, walking", () => {
  it("light twice as far for a while, then the torch is back to itself", () => {
    expect(torchReach(FLARE_WALK)).toBe(TORCH_RADIUS * FLARE_REACH);
    expect(torchReach(1)).toBe(TORCH_RADIUS * 2);
    expect(torchReach(0)).toBe(TORCH_RADIUS);
    expect(torchReach()).toBe(TORCH_RADIUS);
  });
});

describe("leaving a room with a sack in it", () => {
  const gold = (amount: number) => ({ id: "g", barcode: "", dropType: "reward" as const, rewardKind: "resource" as const, amount, createdAt: "" });
  const sack = [{ potion: "lesser" as const }, { gold: 12 }];
  const withStash = (run: DungeonRun, opened: boolean): DungeonRun => ({ ...run, current: { kind: "stash", sack, done: false, ...(opened ? { opened: true } : {}) } });
  it("walking, an unopened stash keeps what's in it, to open when you come back", () => {
    const run = withStash(begin(), false);
    expect(leaveSack(run, "r1", gold)).toBe(run);
  });
  it("on the scroll, an unopened stash is gone with its room", () => {
    const run = withStash({ ...begin(), walk: undefined }, false);
    expect(leaveSack(run, "r1", gold).current?.sack).toEqual([]);
  });
  it("an opened one's leftovers go on the floor, walking or not", () => {
    const after = leaveSack(withStash(begin(), true), "r1", gold);
    expect(after.current?.sack).toEqual([]);
    expect(after.floor).toEqual([{ room: "r1", potion: "lesser" }, { room: "r1", drop: gold(12) }]);
  });
});
