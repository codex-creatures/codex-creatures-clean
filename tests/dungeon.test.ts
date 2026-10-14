import { describe, it, expect } from "vitest";
import {
  DUNGEON_ROOMS, ROOM_MIX, MYSTERY_MIX, rollRoomKind, isFight, isSpecial, MAX_QUIET_ROOMS, WANDERERS, makeRoom, startRun, enterRoom, leaveRoom, setTeam,
  fightingTeam, endRun, enemyFighter, nextRooms, type DungeonSave, type DungeonRun,
} from "../lib/dungeon/run";
import { rollMap, passagesFrom, visibleFrom, MAP_COLS, MAX_PASSAGES, SIGHT, MYSTERY_CHANCE, type DungeonMap, type MapNode } from "../lib/dungeon/map";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { createBattle } from "../lib/combat/battle";

const party = ["a", "b", "c", "d", "e"];

// Every path from the archway to the boss, as lists of room kinds.
function allPaths(map: DungeonMap): string[][] {
  const out: string[][] = [];
  const walk = (id: string, so: string[]) => {
    const n = map.nodes[id];
    const path = [...so, n.kind];
    if (n.next.length === 0) out.push(path);
    else n.next.forEach((m) => walk(m, path));
  };
  map.entrance.forEach((id) => walk(id, []));
  return out;
}

// Walks a run to the end, picking passageways at random.
function walkRun(run: DungeonRun): DungeonRun {
  while (run.status === "exploring") {
    if (!run.current) {
      const options = nextRooms(run);
      run = enterRoom(run, options[Math.floor(Math.random() * options.length)].id);
    }
    run = leaveRoom({ ...run, current: { ...run.current!, done: true } });
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

describe("the dungeon map", () => {
  it("every room has 1–3 passageways up to a neighbouring column, and they never cross", () => {
    for (let i = 0; i < 2000; i++) {
      const map = rollMap(i % 4 === 0);
      expect(map.entrance.length).toBeGreaterThanOrEqual(1);
      expect(map.entrance.length).toBeLessThanOrEqual(MAX_PASSAGES);
      const rows: Record<number, MapNode[]> = {};
      for (const n of Object.values(map.nodes)) (rows[n.row] ??= []).push(n);
      for (const [row, nodes] of Object.entries(rows)) {
        const r = Number(row);
        nodes.sort((a, b) => a.col - b.col);
        let maxSoFar = -1;
        for (const n of nodes) {
          expect(n.col).toBeGreaterThanOrEqual(0);
          expect(n.col).toBeLessThan(MAP_COLS);
          if (r === DUNGEON_ROOMS) { expect(n.next).toEqual([]); continue; }
          expect(n.next.length).toBeGreaterThanOrEqual(1);
          expect(n.next.length).toBeLessThanOrEqual(MAX_PASSAGES);
          const targets = n.next.map((id) => map.nodes[id]);
          for (const m of targets) {
            expect(m.row).toBe(r + 1);
            if (m.kind !== "boss") expect(Math.abs(m.col - n.col)).toBeLessThanOrEqual(1);
          }
          // Left to right, a room's passageways start where the last one's ended (no crossing).
          expect(Math.min(...targets.map((m) => m.col))).toBeGreaterThanOrEqual(maxSoFar);
          maxSoFar = Math.max(...targets.map((m) => m.col));
        }
      }
      expect(rows[DUNGEON_ROOMS]).toHaveLength(1);
      expect(rows[DUNGEON_ROOMS][0].kind).toBe("boss");
    }
  });

  it("every path is 9 rooms ending at the boss, and follows the quiet-room rules", () => {
    for (let i = 0; i < 150; i++) {
      const first = i % 3 === 0;
      const map = rollMap(first);
      for (const path of allPaths(map)) {
        expect(path).toHaveLength(DUNGEON_ROOMS);
        expect(path[DUNGEON_ROOMS - 1]).toBe("boss");
        expect(path.slice(0, -1)).not.toContain("boss");
        if (first) expect(path[0]).toBe("treasure");
        let quiet = 0;
        path.forEach((k, j) => {
          quiet = isFight(k as never) ? 0 : quiet + 1;
          expect(quiet).toBeLessThanOrEqual(MAX_QUIET_ROOMS + 1);
          if (quiet > MAX_QUIET_ROOMS) expect(WANDERERS).toContain(k);
          if (j > 0 && isSpecial(k as never)) expect(path[j - 1]).not.toBe(k);
        });
      }
    }
  });

  it(`about ${MYSTERY_CHANCE * 100}% of rooms are mysteries — never the boss or your first treasure`, () => {
    let rooms = 0, mysteries = 0;
    for (let i = 0; i < 500; i++) {
      const map = rollMap(i % 5 === 0);
      for (const n of Object.values(map.nodes)) {
        if (n.kind === "boss" || (i % 5 === 0 && n.row === 1)) { expect(n.mystery).toBeFalsy(); continue; }
        rooms++;
        if (n.mystery) mysteries++;
      }
    }
    expect(Math.abs(mysteries / rooms - MYSTERY_CHANCE)).toBeLessThan(0.03);
  });

  it("librarians, mini bosses and decks of cards only ever hide behind a '?'", () => {
    let minibosses = 0, mysteries = 0;
    for (let i = 0; i < 1000; i++) {
      for (const n of Object.values(rollMap(false).nodes)) {
        if (["librarian", "miniboss", "cards"].includes(n.kind)) expect(n.mystery).toBe(true);
        if (n.mystery) { mysteries++; if (n.kind === "miniboss") minibosses++; }
      }
    }
    // The quiet-room rules nudge it up a little from 50%.
    expect(minibosses / mysteries).toBeGreaterThan(0.45);
    expect(minibosses / mysteries).toBeLessThan(0.65);
  });

  it("two passageways out of one room never lead to the same kind of quiet room", () => {
    for (let i = 0; i < 1000; i++) {
      const map = rollMap(false);
      const outs = [map.entrance, ...Object.values(map.nodes).map((n) => n.next)];
      for (const ids of outs) {
        const specials = ids.map((id) => map.nodes[id].kind).filter(isSpecial);
        expect(new Set(specials).size).toBe(specials.length);
      }
    }
  });

  it(`you see ${SIGHT} rooms ahead along the passageways (and the boss); the rest is fog`, () => {
    for (let i = 0; i < 300; i++) {
      const map = rollMap(false);
      const seen = visibleFrom(map, null);
      for (const n of Object.values(map.nodes)) {
        if (n.kind === "boss") expect(seen.has(n.id)).toBe(true);
        else if (n.row > SIGHT) expect(seen.has(n.id)).toBe(false);
      }
      for (const id of map.entrance) expect(seen.has(id)).toBe(true);
      // From a room in row 1, rows 2–4 open up, but only what it can reach.
      const at = map.entrance[0];
      const fromThere = visibleFrom(map, at);
      for (const n of passagesFrom(map, at)) expect(fromThere.has(n.id)).toBe(true);
      for (const id of fromThere) {
        const n = map.nodes[id];
        if (n.kind !== "boss") expect(n.row).toBeLessThanOrEqual(1 + SIGHT);
      }
    }
  });
});

describe("a dungeon run", () => {
  it("your first ever run opens in the 50-gold treasure room; later runs at the archway", () => {
    const first = startRun(party, party.slice(0, 3), {}, 1);
    expect(first.current?.kind).toBe("treasure");
    expect(first.current?.gold).toBe(50);
    expect(first.path).toHaveLength(1);
    const later = startRun(party, party.slice(0, 3), {}, 2);
    expect(later.current).toBeNull();
    expect(later.path).toEqual([]);
  });

  it("walks room to room along the passageways, and beating the boss clears it", () => {
    for (let i = 0; i < 200; i++) {
      const run = walkRun(startRun(party, party.slice(0, 3), {}, 1 + (i % 2)));
      expect(run.status).toBe("cleared");
      expect(run.path).toHaveLength(DUNGEON_ROOMS);
      expect(run.room).toBe(DUNGEON_ROOMS);
      run.path.slice(1).forEach((id, j) => expect(run.map.nodes[run.path[j]].next).toContain(id));
    }
  });

  it("you can only walk into a room the passageways lead to, and not while in a room", () => {
    const run = startRun(party, party.slice(0, 3), {}, 2);
    const far = Object.values(run.map.nodes).find((n) => n.row === 3)!;
    expect(enterRoom(run, far.id)).toBe(run);
    const inside = enterRoom(run, run.map.entrance[0]);
    expect(inside.path).toEqual([run.map.entrance[0]]);
    expect(nextRooms(inside)).toEqual([]);
    expect(enterRoom(inside, inside.map.nodes[inside.path[0]].next[0])).toBe(inside);
  });

  it("knocked-out creatures can't be put in the team, and the team can't change mid-fight", () => {
    let run = startRun(party, party.slice(0, 3), { b: 0 }, 2);
    expect(fightingTeam(run)).toEqual(["a", "c"]);
    run = setTeam(run, ["b", "d", "e", "a"]);
    expect(run.team).toEqual(["d", "e", "a"]);
    const inRoom = enterRoom(run, run.map.entrance[0]);
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
