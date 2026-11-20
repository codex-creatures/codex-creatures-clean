import { describe, it, expect } from "vitest";
import { rollMap, routeLength, isAhead, waysOn, knownRooms, CAMP_STASH_MARKS } from "../lib/dungeon/map";
import {
  DUNGEONS, CAMP_ROUTE, CAMP_CHIEF_LEVEL, CAMP_CHIEF_HP, CAMP_CHIEF_HP_FIRST, firstCamp, CAMP_CHIEF_CLUB, CAMP_CAGES, CAMP_CAGE_LEVELS, CAMP_REPEAT_CHANCE, LABYRINTH_SCANS,
  makeRoom, campCages, campRoomKind, labyrinthOpen, startRun, enterRoom, leaveRoom, endRun,
  type DungeonMeta, type DungeonRun,
} from "../lib/dungeon/run";
import { startWalkRun } from "../lib/dungeon/walkRun";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { SPECIES_RACES } from "../lib/creatures/racesV2";

const META: DungeonMeta = { runs: 0, clears: 0, injuries: {}, bag: [] };

describe("the Encampment (the first labyrinth)", () => {
  it("is CAMP_ROUTE rooms to the top: dens, stashes and a chest, no two stashes in a row, the camp at the top", () => {
    const wrong: string[] = [];
    for (let n = 0; n < 40; n++) {
      const map = rollMap(false, Math.random, DUNGEONS[0].spec, 0);
      if (routeLength(map) !== CAMP_ROUTE) wrong.push(`route ${routeLength(map)}`);
      if (map.nodes[map.boss].kind !== "encampment") wrong.push(`top ${map.nodes[map.boss].kind}`);
      for (const node of Object.values(map.nodes)) {
        if (node.id === map.start || node.id === map.boss) continue;
        if (node.kind !== "easy" && node.kind !== "stash" && node.kind !== "chest") wrong.push(node.kind);
        if (node.mystery) wrong.push("a mystery");
        if (node.kind === "stash" && node.links.some((l) => isAhead(node, map.nodes[l]) && map.nodes[l].kind === "stash")) wrong.push("stash after stash");
      }
    }
    expect(wrong).toEqual([]);
  });

  it("always has one chest (never on the scroll) and a stash, with up to CAMP_STASH_MARKS stashes on the scroll from the first (blind) step", () => {
    const wrong: string[] = [];
    for (let n = 0; n < 60; n++) {
      const map = rollMap(false, Math.random, DUNGEONS[0].spec, 0);
      const stashes = Object.values(map.nodes).filter((x) => x.kind === "stash");
      const chests = Object.values(map.nodes).filter((x) => x.kind === "chest");
      if (stashes.length === 0) wrong.push("no stash");
      if (chests.length !== 1) wrong.push(`${chests.length} chests`);
      const known = knownRooms(map, [map.start]);
      for (const x of chests) if (known.has(x.id) || x.known) wrong.push(`marked chest ${x.id}`);
      const marked = stashes.filter((x) => known.has(x.id));
      for (const x of stashes) if (!x.pinned && known.has(x.id)) wrong.push(`unmarked stash shown ${x.id}`);
      if (marked.length !== Math.min(stashes.length, CAMP_STASH_MARKS)) wrong.push(`${marked.length} of ${stashes.length} stashes marked`);
    }
    expect(wrong).toEqual([]);
  });

  it("its dens never hold more than 2 creatures, however deep", () => {
    const sizes = new Set<number>();
    for (let n = 0; n < 60; n++) sizes.add(makeRoom("easy", Math.random, 3 + (n % 6), 0).enemies!.length);
    expect([...sizes].sort()).toEqual([1, 2]);
  });

  it("a stash is never next after a stash", () => {
    expect(Array.from({ length: 200 }, () => campRoomKind(true))).not.toContain("stash");
    expect(campRoomKind(false, () => 0)).toBe("stash");
    expect(campRoomKind(false, () => 0.99)).toBe("easy");
  });

  it("the chief: the Baby Cyclops with a Common club, no armour and CAMP_CHIEF_HP times its HP, Lv CAMP_CHIEF_LEVEL, played by the Hard AI", () => {
    for (let n = 0; n < 20; n++) {
      const room = makeRoom("encampment", Math.random, CAMP_ROUTE, 0);
      expect(room.enemies).toHaveLength(1);
      const chief = room.enemies![0];
      expect(chief).toMatchObject({ creatureId: "baby_cyclops", level: CAMP_CHIEF_LEVEL, hpMult: CAMP_CHIEF_HP, moves: ["Club Smash", "Backhand"] });
      expect(chief.gear).toMatchObject([{ slot: "weapon", key: "temporal_maul", rarity: "common", stats: CAMP_CHIEF_CLUB }]);
      expect(chief.gentle).toBeUndefined(); // (the first quest's thief can't knock you out; the chief can)
      expect(room.level).toBe("hard");
      expect(room.variant).toBe("plain");
    }
  });

  it("its first dens are as gentle as the Labyrinth's: one creature, no weapon", () => {
    for (let n = 0; n < 20; n++) {
      const room = makeRoom("easy", Math.random, 1, 0);
      expect(room.enemies).toHaveLength(1);
      expect(room.enemies![0].gear.some((g) => g.slot === "weapon")).toBe(false);
      expect(room.enemies![0].level).toBeLessThanOrEqual(3);
      expect(room.level).toBe("easy");
    }
  });

  it("first time: two cages, Common or Uncommon, Lv 2–4, different, of no race your party has", () => {
    const avoid = ["beast", "geo"];
    const wrong: string[] = [];
    for (let n = 0; n < 100; n++) {
      const cages = campCages(true, avoid);
      if (cages.length !== CAMP_CAGES) wrong.push(`${cages.length} cages`);
      if (cages[0].creatureId === cages[1].creatureId) wrong.push("the same twice");
      for (const c of cages) {
        const t = CREATURE_BY_ID[c.creatureId!];
        if (!["common", "uncommon"].includes(t.rarity)) wrong.push(t.rarity);
        if (c.level! < CAMP_CAGE_LEVELS[0] || c.level! > CAMP_CAGE_LEVELS[1]) wrong.push(`Lv ${c.level}`);
        if ((SPECIES_RACES[t.id] ?? []).some((r) => avoid.includes(r))) wrong.push(`${t.id} shares a race`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("after that: one cage, with a creature in it CAMP_REPEAT_CHANCE of the time", () => {
    expect(campCages(false, [], () => CAMP_REPEAT_CHANCE - 0.01)[0].creatureId).toBeDefined();
    expect(campCages(false, [], () => CAMP_REPEAT_CHANCE + 0.01)).toEqual([{}]);
  });

  it("the top room holds the run's cages, and finishing it clears the run", () => {
    const cages = campCages(true, []);
    let run: DungeonRun = startRun(["a"], ["a"], {}, 1, Math.random, 0, false, false, cages);
    // Walk straight up, finishing each room as you go.
    while (run.path[run.path.length - 1] !== run.map.boss) {
      const at = run.path[run.path.length - 1];
      const next = waysOn(run.map, at)[0];
      run = enterRoom(leaveRoom(run), next.id);
    }
    expect(run.current?.kind).toBe("encampment");
    expect(run.current?.cages).toEqual(cages);
    expect(run.current?.enemies?.[0].hpMult).toBe(CAMP_CHIEF_HP);
    run = leaveRoom({ ...run, current: { ...run.current!, done: true } });
    expect(run.status).toBe("cleared");
    const after = endRun({ meta: META, run });
    expect(after.meta.campClears).toBe(1);
    expect(after.meta.clears).toBe(0);
  });

  // The user, 2026-11-20: till he's first beaten, the chief's at half HP.
  it("before its first win, the chief's at half HP", () => {
    expect(CAMP_CHIEF_HP_FIRST).toBe(CAMP_CHIEF_HP / 2);
    let run: DungeonRun = firstCamp(startRun(["a"], ["a"], {}, 1, Math.random, 0, false, false, campCages(true, [])));
    while (run.path[run.path.length - 1] !== run.map.boss) run = enterRoom(leaveRoom(run), waysOn(run.map, run.path[run.path.length - 1])[0].id);
    expect(run.current?.enemies?.[0]).toMatchObject({ creatureId: "baby_cyclops", hpMult: CAMP_CHIEF_HP_FIRST });
    // …and walked round: its chief's room is made as the run starts.
    const walked = firstCamp(startWalkRun(["a"], ["a"], {}, 1, campCages(true, [])));
    expect(walked.walk!.rooms[walked.map.boss].enemies?.[0]).toMatchObject({ creatureId: "baby_cyclops", hpMult: CAMP_CHIEF_HP_FIRST });
  });

  it("the Labyrinth opens once you've beaten it, scanned LABYRINTH_SCANS barcodes, or beaten the Cyclops before", () => {
    expect(labyrinthOpen(META, 0)).toBe(false);
    expect(labyrinthOpen(META, LABYRINTH_SCANS - 1)).toBe(false);
    expect(labyrinthOpen(META, LABYRINTH_SCANS)).toBe(true);
    expect(labyrinthOpen({ ...META, campClears: 1 }, 0)).toBe(true);
    expect(labyrinthOpen({ ...META, clears: 1 }, 0)).toBe(true);
  });
});
