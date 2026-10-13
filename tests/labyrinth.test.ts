import { describe, it, expect } from "vitest";
import {
  LAB_ROOMS, ROOM_MIX, rollRoomKind, isFight, isSpecial, makeRoom, startRun, enterDoor, leaveRoom, setTeam,
  fightingTeam, endRun, enemyFighter, type LabSave,
} from "../lib/labyrinth/run";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { createBattle } from "../lib/combat/battle";

const party = ["a", "b", "c", "d", "e"];

describe("labyrinth rooms", () => {
  it("room mix adds up to 100% and rolls roughly to it", () => {
    expect(ROOM_MIX.reduce((s, [, p]) => s + p, 0)).toBe(100);
    const counts: Record<string, number> = {};
    const N = 20000;
    for (let i = 0; i < N; i++) { const k = rollRoomKind(); counts[k] = (counts[k] ?? 0) + 1; }
    for (const [kind, pct] of ROOM_MIX) expect(Math.abs((counts[kind] ?? 0) / N * 100 - pct)).toBeLessThan(1.5);
  });

  it("special rooms come up at most once a run, so every run has a fight before the boss", () => {
    for (let i = 0; i < 3000; i++) {
      let run = startRun(party, party.slice(0, 3), {}, 1 + (i % 3)); // first runs (treasure) and later ones
      const walked: string[] = run.current ? [run.current.kind] : [];
      while (run.status === "exploring") {
        if (!run.current) {
          const pair = run.doors[run.room - 1];
          expect(pair).toHaveLength(2);
          if (isSpecial(pair[0])) expect(pair[1]).not.toBe(pair[0]); // two doors never hide the same special
          run = enterDoor(run, Math.random() < 0.5 ? 0 : 1);
          walked.push(run.current!.kind);
        }
        run = leaveRoom({ ...run, current: { ...run.current!, done: true } });
      }
      expect(walked).toHaveLength(LAB_ROOMS);
      expect(walked[LAB_ROOMS - 1]).toBe("boss");
      expect(walked.slice(0, -1)).not.toContain("boss");
      const specials = walked.filter((k) => isSpecial(k as never));
      expect(new Set(specials).size).toBe(specials.length);
      expect(walked.slice(0, -1).some((k) => isFight(k as never))).toBe(true);
    }
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

  it("hard fights: a single Rare with Rare gear", () => {
    const room = makeRoom("hard");
    expect(room.enemies).toHaveLength(1);
    expect(CREATURE_BY_ID[room.enemies![0].creatureId].rarity).toBe("rare");
    expect(room.enemies![0].gear.every((p) => p.rarity === "rare")).toBe(true);
  });
});

describe("a labyrinth run", () => {
  it("your first ever run opens in the 50-gold treasure room; later runs at the doors", () => {
    const first = startRun(party, party.slice(0, 3), {}, 1);
    expect(first.current?.kind).toBe("treasure");
    expect(first.current?.gold).toBe(50);
    expect(startRun(party, party.slice(0, 3), {}, 2).current).toBeNull();
  });

  it("walks room to room, and beating room 8 clears it", () => {
    let run = startRun(party, party.slice(0, 3), {}, 2);
    for (let room = 1; room <= LAB_ROOMS; room++) {
      expect(run.room).toBe(room);
      run = enterDoor(run, 1);
      expect(run.current?.kind).toBe(run.doors[room - 1][1]);
      run = leaveRoom({ ...run, current: { ...run.current!, done: true } });
    }
    expect(run.status).toBe("cleared");
  });

  it("knocked-out creatures can't be put in the team, and the team is changed only between rooms", () => {
    let run = startRun(party, party.slice(0, 3), { b: 0 }, 2);
    expect(fightingTeam(run)).toEqual(["a", "c"]);
    run = setTeam(run, ["b", "d", "e", "a"]);
    expect(run.team).toEqual(["d", "e", "a"]);
    const inRoom = enterDoor(run, 0);
    expect(setTeam(inRoom, ["a"]).team).toEqual(["d", "e", "a"]);
  });

  it("ending a run brings the wounds home and records the first clear", () => {
    const run = { ...startRun(party, party.slice(0, 3), {}, 4), hp: { a: 0.5, b: 0, c: 1, d: 1, e: 1 }, status: "cleared" as const };
    const save: LabSave = { meta: { runs: 4, clears: 0, injuries: { c: 0.2 } }, run };
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
