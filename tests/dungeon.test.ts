import { describe, it, expect } from "vitest";
import {
  ROOM_MIX, MYSTERY_MIX, rollRoomKind, isFight, makeRoom, startRun, enterRoom, leaveRoom, setTeam,
  fightingTeam, endRun, enemyFighter, nextRooms, runPosition, type DungeonSave, type DungeonRun, stepInside, canMoveOn, moveOn,
} from "../lib/dungeon/run";
import {
  rollMap, routeLength, LAIR_DOORS, waysOn, isAhead, inSight, knownRooms, KNOWN_AT_START, KNOWN_CORRIDORS, KNOWN_CORRIDOR_DEPTH, depths, MIN_ROUTE, MAX_ROUTE, MYSTERY_CHANCE, ROOM_COUNT,
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

  it("easy fights: 1 creature in the first 2 rooms, 1–2 up to depth 4, then 2–3", () => {
    const sizes = (depth: number) => new Set(Array.from({ length: 300 }, () => makeRoom("easy", Math.random, depth).enemies!.length));
    expect([...sizes(1)].sort()).toEqual([1]);
    expect([...sizes(3)].sort()).toEqual([1, 2]);
    expect([...sizes(4)].sort()).toEqual([1, 2]);
    expect([...sizes(5)].sort()).toEqual([2, 3]);
    expect(makeRoom("easy", Math.random, 1).enemies!.length).toBeLessThanOrEqual(2);
    const rar = (n: number) => { for (;;) { const r = makeRoom("easy", Math.random, n <= 2 ? 3 : 9); if (r.enemies!.length === n) return r.enemies!.map((e) => CREATURE_BY_ID[e.creatureId].rarity); } };
    expect(rar(1)).toEqual(["uncommon"]);
    expect(rar(2)).toEqual(["common", "uncommon"]);
    expect(rar(3)).toEqual(["common", "common", "uncommon"]);
  });

  it("easy fights: Common gear (bar the rare upgrade)", () => {
    for (let i = 0; i < 200; i++) {
      const room = makeRoom("easy");
      const gear = room.enemies!.flatMap((e) => e.gear);
      const upgraded = gear.filter((p) => p.rarity !== "common");
      expect(upgraded.length).toBeLessThanOrEqual(1);
      expect(gear.filter((p) => p.drops)).toEqual(upgraded); // the upgraded item is the one that drops
      expect(room.level).toBe("easy");
      expect(room.gold).toBeGreaterThan(0);
      room.enemies!.forEach((e) => expect(enemyFighter(e).maxHp).toBeGreaterThan(0));
    }
  });

  it("the mystery mix adds up to 100%: mostly mini bosses, 15% good finds, and the witch", () => {
    expect(MYSTERY_MIX.reduce((s, [, p]) => s + p, 0)).toBe(100);
    const pct = Object.fromEntries(MYSTERY_MIX);
    expect(pct.miniboss).toBe(45);
    expect(pct.witch).toBe(8);
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
      // Corridors are drawn both ways round.
      for (const n of Object.values(map.nodes)) for (const l of n.links) expect(map.nodes[l].links).toContain(n.id);
      expect(map.nodes[map.boss].links.length).toBe(LAIR_DOORS);       // always two ways into the lair
      expect(waysOn(map, map.start).length).toBeGreaterThanOrEqual(2); // and 2–3 ways out of the entrance
      expect(waysOn(map, map.start).length).toBeLessThanOrEqual(3);
      expect(map.nodes[map.boss].kind).toBe("boss");
    }
  });

  it("never a dead end: every room has a way on, and corridors only lead onward", () => {
    let choices = 0, rooms = 0;
    for (let i = 0; i < 300; i++) {
      const map = rollMap(false);
      for (const n of Object.values(map.nodes)) {
        if (n.id === map.boss) continue;
        const on = waysOn(map, n.id);
        expect(on.length).toBeGreaterThanOrEqual(1);
        for (const m of on) expect(isAhead(n, m)).toBe(true);
        rooms++;
        if (on.length > 1) choices++;
      }
      expect(waysOn(map, map.start).length).toBeGreaterThanOrEqual(2); // a choice from the off
    }
    expect(choices / rooms).toBeGreaterThan(0.3); // plenty of branches
  });

  it("the scroll marks real corridors from the start, both rooms past the 2nd", () => {
    for (let i = 0; i < 200; i++) {
      const map = rollMap(false);
      const depth = depths(map);
      expect(map.knownLinks).toHaveLength(KNOWN_CORRIDORS);
      for (const key of map.knownLinks!) {
        const [a, b] = key.split("|");
        expect(map.nodes[a].links).toContain(b);
        expect(depth.get(a)!).toBeGreaterThanOrEqual(KNOWN_CORRIDOR_DEPTH);
        expect(depth.get(b)!).toBeGreaterThanOrEqual(KNOWN_CORRIDOR_DEPTH);
      }
    }
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

  it("the scroll: a few rooms marked from the start; nearby rooms revealed, but never a mystery until you walk in", () => {
    for (let i = 0; i < 100; i++) {
      const map = rollMap(false);
      const nodes = Object.values(map.nodes);
      const marked = nodes.filter((n) => n.known);
      expect(marked.length).toBe(KNOWN_AT_START);
      for (const n of marked) expect(n.mystery).toBeFalsy();
      const known = knownRooms(map, [map.start]);
      expect(known.has(map.boss)).toBe(true);
      const sight = inSight(map, map.start);
      const first = new Set(waysOn(map, map.start).map((n) => n.id)); // the first step is blind
      for (const n of nodes) {
        if (n.id === map.start || n.id === map.boss) continue;
        expect(known.has(n.id)).toBe(!first.has(n.id) && (!!n.known || (sight.has(n.id) && !n.mystery)));
      }
      // Walking somewhere keeps what you knew, and adds what's near it (and the room itself).
      const next = waysOn(map, map.start)[0].id;
      const later = knownRooms(map, [map.start, next]);
      for (const id of known) expect(later.has(id)).toBe(true);
      expect(later.has(next)).toBe(true);
      for (const id of inSight(map, next)) if (!map.nodes[id].mystery) expect(later.has(id)).toBe(true);
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

  it("no going back, and no dead ends: any wander ends at the lair", () => {
    const lengths = new Set<number>();
    for (let i = 0; i < 300; i++) {
      let run = startRun(party, party.slice(0, 3), {}, 2);
      for (let steps = 0; steps < 100 && run.status === "exploring"; steps++) {
        if (run.current) { run = leaveRoom({ ...run, current: { ...run.current, done: true } }); continue; }
        const options = nextRooms(run);
        expect(options.length).toBeGreaterThan(0);
        for (const id of run.path) expect(enterRoom(run, id)).toBe(run);
        run = enterRoom(run, options[Math.floor(Math.random() * options.length)].id);
      }
      expect(run.status).toBe("cleared");
      expect(new Set(run.path).size).toBe(run.path.length); // never the same room twice
      lengths.add(run.path.length);
    }
    expect(lengths.size).toBeGreaterThan(3); // short and long ways through
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

  it("only the team steps inside: the rest of the party waits in the Den, so nobody can be swapped in", () => {
    let run = startRun(party, party.slice(0, 3), { b: 0.4 }, 2);
    run = setTeam(run, ["d", "b", "e"]);
    run = stepInside(run);
    expect(run.party).toEqual(["d", "b", "e"]);
    expect(run.hp).toEqual({ d: 1, b: 0.4, e: 1 });
    expect(setTeam(run, ["a", "d"]).team).toEqual(["d"]);    // a stayed home
    expect(setTeam(run, ["e", "d", "b"]).team).toEqual(["e", "d", "b"]); // who leads can still change
  });

  it("until the first Cyclops kill, a run ends with everyone healed; after it, wounds come home", () => {
    const run = { ...startRun(party, party.slice(0, 3), {}, 4), hp: { a: 0.5, b: 0, c: 1, d: 1, e: 1 }, status: "dead" as const };
    expect(endRun({ meta: { runs: 4, clears: 0, injuries: { a: 0.3, z: 0.4 }, bag: [] }, run }).meta.injuries).toEqual({ z: 0.4 });
    expect(endRun({ meta: { runs: 4, clears: 1, injuries: {}, bag: [] }, run }).meta.injuries).toEqual({ a: 0.5, b: 0 });
  });

  it("ending a run brings the wounds home and records the first clear", () => {
    const run = { ...startRun(party, party.slice(0, 3), {}, 4), hp: { a: 0.5, b: 0, c: 1, d: 1, e: 1 }, status: "cleared" as const };
    const save: DungeonSave = { meta: { runs: 4, clears: 0, injuries: { c: 0.2 }, bag: [] }, run };
    const after = endRun(save);
    expect(after.run).toBeNull();
    expect(after.meta.injuries).toEqual({}); // (healed: the first clear still counts as before it)
    expect(after.meta.clears).toBe(1);
    const later = endRun({ meta: after.meta, run: { ...run, runNumber: 5 } });
    expect(later.meta.injuries).toEqual({ a: 0.5, b: 0 });
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

  it("the map comes first; then you move room to room through the tunnels", () => {
    for (let i = 0; i < 50; i++) {
      let run = startRun(["a"], ["a"], {}, 2);
      expect(run.inside).toBe(false);
      run = stepInside(run);
      expect(run.inside).toBe(true);
      // At the entrance, any way on.
      expect(canMoveOn(run)).toBe(true);
      const ways = waysOn(run.map, run.map.start);
      const to = ways[ways.length - 1].id;
      // Nowhere that isn't a way on.
      expect(moveOn(run, run.map.boss).path).toEqual(run.path);
      run = moveOn(run, to);
      expect(run.path).toEqual([run.map.start, to]);
      expect(run.cleared).toContain(run.map.start);
      expect(run.current?.kind).toBe(run.map.nodes[to].kind);
      // A fight (or loot) has to be dealt with first; pools and shops can be walked past.
      const skippable = ["pool", "stash", "merchant", "librarian", "witch"].includes(run.current!.kind);
      expect(canMoveOn(run)).toBe(skippable);
      run = { ...run, current: { ...run.current!, done: true } };
      expect(canMoveOn(run)).toBe(true);
      const next = waysOn(run.map, to)[0];
      const after = moveOn(run, next.id);
      expect(after.path).toEqual([run.map.start, to, next.id]);
      expect(after.cleared).toContain(to);
      expect(after.room).toBe(run.room + 1);
    }
  });
});
