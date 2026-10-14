import { describe, it, expect } from "vitest";
import {
  ROOM_MIX, MYSTERY_MIX, rollRoomKind, isFight, makeRoom, startRun, enterRoom, leaveRoom, setTeam,
  fightingTeam, endRun, enemyFighter, nextRooms, runPosition, atDeadEnd, type DungeonSave, type DungeonRun,
} from "../lib/dungeon/run";
import {
  rollMap, routeLength, inSight, seenRooms, distance, MIN_ROUTE, MAX_ROUTE, SIGHT_RADIUS, MYSTERY_CHANCE, ROOM_COUNT,
} from "../lib/dungeon/map";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { createBattle } from "../lib/combat/battle";

const party = ["a", "b", "c", "d", "e"];

// Walks a run along the shortest route to the lair, finishing every room.
function walkToLair(run: DungeonRun): DungeonRun {
  for (let steps = 0; run.status === "exploring" && steps < 200; steps++) {
    if (run.current) { run = leaveRoom({ ...run, current: { ...run.current, done: true } }); continue; }
    const options = nextRooms(run);
    // Step to the neighbour closest (in rooms) to the lair.
    const dist = (id: string) => routeLength({ ...run.map, start: id });
    run = enterRoom(run, options.reduce((a, b) => (dist(b.id) < dist(a.id) ? b : a)).id);
  }
  return run;
}

describe("dungeon rooms", () => {
  it("room mix adds up to 100% and rolls roughly to it", () => {
    expect(ROOM_MIX.reduce((s, [, p]) => s + p, 0)).toBe(100);
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) { const k = rollRoomKind(); counts[k] = (counts[k] ?? 0) + 1; }
    for (const [kind, pct] of ROOM_MIX) expect(Math.abs((counts[kind] ?? 0) / N * 100 - pct)).toBeLessThan(1.5);
  });

  it("easy fights: 2 Commons + an Uncommon with Common gear (bar the rare upgrade)", () => {
    for (let i = 0; i < 200; i++) {
      const room = makeRoom("easy");
      expect(room.enemies!.map((e) => CREATURE_BY_ID[e.creatureId].rarity)).toEqual(["common", "common", "uncommon"]);
      const gear = room.enemies!.flatMap((e) => e.gear);
      const upgraded = gear.filter((p) => p.rarity !== "common");
      expect(upgraded.length).toBeLessThanOrEqual(1);
      expect(gear.filter((p) => p.drops)).toEqual(upgraded); // the upgraded item is the one that drops
      expect(room.level).toBe("easy");
      expect(room.gold).toBeGreaterThan(0);
      room.enemies!.forEach((e) => expect(enemyFighter(e).maxHp).toBeGreaterThan(0));
    }
  });

  it("the mystery mix adds up to 100%: half mini bosses, 15% good finds", () => {
    expect(MYSTERY_MIX.reduce((s, [, p]) => s + p, 0)).toBe(100);
    const pct = Object.fromEntries(MYSTERY_MIX);
    expect(pct.miniboss).toBe(50);
    expect(pct.librarian + pct.cards + pct.merchant).toBe(15);
    expect(ROOM_MIX.map(([k]) => k)).not.toContain("librarian"); // librarians only in mysteries
    expect(ROOM_MIX.map(([k]) => k)).toContain("merchant");      // merchants anywhere
  });

  it("mini bosses: one Epic with Rare gear, played by the Hard AI", () => {
    const room = makeRoom("miniboss");
    expect(room.enemies).toHaveLength(1);
    expect(CREATURE_BY_ID[room.enemies![0].creatureId].rarity).toBe("epic");
    expect(room.enemies![0].gear.every((p) => p.rarity === "rare")).toBe(true);
    expect(room.level).toBe("hard");
    expect(isFight("miniboss")).toBe(true);
  });

  it("librarians sell 3 different codexes", () => {
    for (let i = 0; i < 100; i++) {
      const room = makeRoom("librarian");
      expect(room.offers).toHaveLength(3);
      expect(new Set(room.offers).size).toBe(3);
      expect(room.bought).toEqual([]);
    }
  });

  it("hard fights: a single Rare with Rare gear", () => {
    const room = makeRoom("hard");
    expect(room.enemies).toHaveLength(1);
    expect(CREATURE_BY_ID[room.enemies![0].creatureId].rarity).toBe("rare");
    expect(room.enemies![0].gear.every((p) => p.rarity === "rare")).toBe(true);
  });
});

describe("the labyrinth map", () => {
  it("about ${ROOM_COUNT} rooms, all joined up, with the lair ${MIN_ROUTE}–${MAX_ROUTE} rooms away", () => {
    for (let i = 0; i < 300; i++) {
      const map = rollMap(i % 4 === 0);
      const ids = Object.keys(map.nodes);
      expect(ids.length).toBeGreaterThanOrEqual(ROOM_COUNT - 2);
      for (const id of ids) expect(routeLength(map, id)).toBeLessThan(Infinity); // every room reachable
      const r = routeLength(map);
      expect(r).toBeGreaterThanOrEqual(MIN_ROUTE);
      expect(r).toBeLessThanOrEqual(MAX_ROUTE);
      // Corridors go both ways; the lair has one or two ways in.
      for (const n of Object.values(map.nodes)) for (const l of n.links) expect(map.nodes[l].links).toContain(n.id);
      expect(map.nodes[map.boss].links.length).toBeGreaterThanOrEqual(1);
      expect(map.nodes[map.boss].links.length).toBeLessThanOrEqual(2);
      expect(map.nodes[map.boss].kind).toBe("boss");
    }
  });

  it("it's a labyrinth: dead ends and loops turn up", () => {
    let deadEnds = 0, loops = 0;
    for (let i = 0; i < 100; i++) {
      const map = rollMap(false);
      const nodes = Object.values(map.nodes);
      deadEnds += nodes.filter((n) => n.links.length === 1 && n.kind !== "boss").length;
      const corridors = nodes.reduce((t, n) => t + n.links.length, 0) / 2;
      if (corridors > nodes.length - 1) loops++;
    }
    expect(deadEnds).toBeGreaterThan(100);
    expect(loops).toBeGreaterThan(80);
  });

  it(`about ${MYSTERY_CHANCE * 100}% of rooms are mysteries — never the entrance or the lair`, () => {
    let rooms = 0, mysteries = 0;
    for (let i = 0; i < 300; i++) {
      const map = rollMap(i % 5 === 0);
      for (const n of Object.values(map.nodes)) {
        if (n.id === map.boss || n.id === map.start) { expect(n.mystery).toBeFalsy(); continue; }
        rooms++;
        if (n.mystery) mysteries++;
      }
    }
    expect(Math.abs(mysteries / rooms - MYSTERY_CHANCE)).toBeLessThan(0.03);
  });

  it("librarians, mini bosses and decks of cards only ever hide behind a '?'", () => {
    for (let i = 0; i < 500; i++) {
      for (const n of Object.values(rollMap(false).nodes)) {
        if (["librarian", "miniboss", "cards"].includes(n.kind)) expect(n.mystery).toBe(true);
      }
    }
  });

  it("fog: you see a circle around you; what you've seen stays, and the lair is always marked", () => {
    for (let i = 0; i < 100; i++) {
      const map = rollMap(false);
      const sight = inSight(map, map.start);
      for (const n of Object.values(map.nodes)) expect(sight.has(n.id)).toBe(distance(n, map.nodes[map.start]) <= SIGHT_RADIUS);
      const far = Object.values(map.nodes).find((n) => !sight.has(n.id) && n.id !== map.boss);
      const seen = seenRooms(map, [map.start]);
      expect(seen.has(map.boss)).toBe(true);
      if (far) expect(seen.has(far.id)).toBe(false);
      // Walking somewhere adds what you saw there, and keeps what you saw before.
      const next = map.nodes[map.start].links[0];
      const later = seenRooms(map, [map.start, next]);
      for (const id of seen) expect(later.has(id)).toBe(true);
      for (const id of inSight(map, next)) expect(later.has(id)).toBe(true);
    }
  });
});

describe("a labyrinth run", () => {
  it("your first ever run opens in the 50-gold treasure room; later runs at an empty entrance", () => {
    const first = startRun(party, party.slice(0, 3), {}, 1);
    expect(first.current?.kind).toBe("treasure");
    expect(first.current?.gold).toBe(50);
    expect(runPosition(first)).toBe(first.map.start);
    const later = startRun(party, party.slice(0, 3), {}, 2);
    expect(later.current).toBeNull();
    expect(later.cleared).toEqual([later.map.start]);
  });

  it("walks corridor by corridor to the lair, and beating the boss clears it", () => {
    for (let i = 0; i < 100; i++) {
      const run = walkToLair(startRun(party, party.slice(0, 3), {}, 1 + (i % 2)));
      expect(run.status).toBe("cleared");
      expect(runPosition(run)).toBe(run.map.boss);
      run.path.slice(1).forEach((id, j) => expect(run.map.nodes[run.path[j]].links).toContain(id));
    }
  });

  it("you can only walk down a corridor from where you stand, and only once the room is finished", () => {
    const run = startRun(party, party.slice(0, 3), {}, 2);
    const far = Object.values(run.map.nodes).find((n) => !run.map.nodes[run.map.start].links.includes(n.id) && n.id !== run.map.start)!;
    expect(enterRoom(run, far.id)).toBe(run);
    const next = run.map.nodes[run.map.start].links[0];
    const inside = enterRoom(run, next);
    expect(runPosition(inside)).toBe(next);
    expect(inside.current).not.toBeNull();
    expect(inside.room).toBe(1);
    expect(nextRooms(inside)).toEqual([]);
  });

  it("there's no going back into a room you've been in — a dead end means heading out", () => {
    for (let i = 0; i < 200; i++) {
      let run = startRun(party, party.slice(0, 3), {}, 2);
      // Wander at random until you're stuck or reach the lair.
      for (let steps = 0; steps < 100 && run.status === "exploring"; steps++) {
        if (run.current) { run = leaveRoom({ ...run, current: { ...run.current, done: true } }); continue; }
        const options = nextRooms(run);
        for (const n of options) expect(run.path).not.toContain(n.id);
        for (const id of run.path) expect(enterRoom(run, id)).toBe(run);
        if (options.length === 0) { expect(atDeadEnd(run)).toBe(true); break; }
        expect(atDeadEnd(run)).toBe(false);
        run = enterRoom(run, options[Math.floor(Math.random() * options.length)].id);
      }
      expect(new Set(run.path).size).toBe(run.path.length); // never the same room twice
    }
  });

  it("knocked-out creatures can't be put in the team, and the team can't change mid-fight", () => {
    let run = startRun(party, party.slice(0, 3), { b: 0 }, 2);
    expect(fightingTeam(run)).toEqual(["a", "c"]);
    run = setTeam(run, ["b", "d", "e", "a"]);
    expect(run.team).toEqual(["d", "e", "a"]);
    const inRoom = enterRoom(run, run.map.nodes[run.map.start].links[0]);
    expect(setTeam(inRoom, ["a", "d"]).team).toEqual(["a", "d"]); // fine before the fight starts
    expect(setTeam({ ...inRoom, battle: {} }, ["e"]).team).toEqual(["d", "e", "a"]); // not mid-fight
  });

  it("ending a run brings the wounds home and records the first clear", () => {
    const run = { ...startRun(party, party.slice(0, 3), {}, 4), hp: { a: 0.5, b: 0, c: 1, d: 1, e: 1 }, status: "cleared" as const };
    const save: DungeonSave = { meta: { runs: 4, clears: 0, injuries: { c: 0.2 }, bag: [] }, run };
    const after = endRun(save);
    expect(after.run).toBeNull();
    expect(after.meta.injuries).toEqual({ a: 0.5, b: 0 });
    expect(after.meta.clears).toBe(1);
    expect(after.meta.firstClearRun).toBe(4);
    expect(endRun({ ...after, run: { ...run, runNumber: 6 } }).meta.firstClearRun).toBe(4);
  });

  it("battles can start with hurt creatures", () => {
    const f = enemyFighter(makeRoom("hard").enemies![0]);
    const s = createBattle([f, f], [f], { A: [10, 0] });
    expect(s.sides.A.team[0].hp).toBe(10);
    expect(s.sides.A.team[1].hp).toBe(1); // never starts a fight on 0
    expect(s.sides.B.team[0].hp).toBe(f.maxHp);
  });
});
