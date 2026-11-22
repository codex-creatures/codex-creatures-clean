import { describe, it, expect } from "vitest";
import { makeRoom, enemyFighter, FOE_CODEX, NOT_ON_FOES, ONE_A_ROOM, type DungeonId } from "../lib/dungeon/run";
import { CORE_MOVE_NAMES } from "../lib/creatures/raceKitsV2";
import { MOVE_BY_NAME, isSteadyMove } from "../lib/creatures/creatureData";
import { SPECIES_RACES } from "../lib/creatures/racesV2";
import { raceOfMove } from "../lib/combat/raceChart";
import { codexRarityOf } from "../lib/drops";
import { CREATURE_BY_ID } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { createBattle, resolveRound } from "../lib/combat/battle";
import { chooseAiAction } from "../lib/combat/thinkingAi";
import { aiChooseAction } from "../lib/combat/teamBattle";

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const rooms = (dungeon: DungeonId, n = 120) => Array.from({ length: n }, (_, i) => makeRoom(i % 3 === 0 ? "hard" : "easy", seeded(i * 7919 + dungeon + 1), 10, dungeon));

describe("foes carry codex moves (the user, 2026-11-13)", () => {
  it("none in the Encampment", () => {
    for (const r of rooms(0)) for (const e of r.enemies ?? []) expect(e.moves.every((n) => CORE_MOVE_NAMES.has(n) || MOVE_BY_NAME[n]?.effect?.kind === "cripple")).toBe(true);
  });
  for (const dungeon of [1, 2, 3] as DungeonId[]) it(`dungeon ${dungeon}: codexes up to ${FOE_CODEX[dungeon]!.upTo}, mostly their own race; never the left-out ones; at most one Choking Smog a room; always a steady move`, () => {
    let foes = 0, own = 0, off = 0;
    for (const r of rooms(dungeon)) {
      let smog = 0;
      for (const e of r.enemies ?? []) {
        foes++;
        const codex = e.moves.filter((n) => !CORE_MOVE_NAMES.has(n));
        for (const n of codex) {
          expect(ORDER.indexOf(codexRarityOf(n)), n).toBeLessThanOrEqual(ORDER.indexOf(FOE_CODEX[dungeon]!.upTo));
          expect(NOT_ON_FOES).not.toContain(n);
          if (ONE_A_ROOM.includes(n)) smog++;
          const race = raceOfMove(MOVE_BY_NAME[n]);
          if (race && SPECIES_RACES[e.creatureId].includes(race)) own++;
        }
        if (e.offRace) { off++; expect(e.moves).toContain(e.offRace); }
        expect(e.moves.length).toBeLessThanOrEqual(4);
        expect(enemyFighter(e).skills.some(isSteadyMove)).toBe(true);
      }
      expect(smog).toBeLessThanOrEqual(1);
    }
    expect(own / foes).toBeGreaterThan(0.3);
    expect(off / foes).toBeGreaterThan(FOE_CODEX[dungeon]!.offRace * 0.5);
  });
  it("the same room rolls the same foes and codexes (seeded by the foes' own rolls)", () => {
    const a = makeRoom("easy", seeded(42), 10, 3), b = makeRoom("easy", seeded(42), 10, 3);
    expect(a.enemies!.map((e) => e.moves)).toEqual(b.enemies!.map((e) => e.moves));
  });
  // (2026-11-23: wound up, Mega Smash is the only move it may use; the simple AI left its off-race move out half the
  // time, passed, and a pass with a move affordable threw, in the thinking AI's look-ahead too: the player's tap was lost.)
  it("a foe whose off-race move is Mega Smash never throws: wound up, it strikes", () => {
    const stats = { melee: 20, agility: 10 }, armour = { mDef: 20, rDef: 20, magDef: 20, hp: 30 };
    const foe = { ...buildFighter(CREATURE_BY_ID.rust_beetle, stats, armour, ["Strike", "Smash", "Mega Smash"], undefined, undefined, undefined, 12), offRace: "Mega Smash" };
    const me = buildFighter(CREATURE_BY_ID.glob, stats, armour, undefined, undefined, undefined, undefined, 14);
    for (let i = 0; i < 25; i++) expect(() => chooseAiAction(createBattle([me], [foe]), "B", "normal")).not.toThrow();
    const s = createBattle([me], [foe]);
    resolveRound(s, { A: { kind: "attack", skillName: "Strike" }, B: { kind: "attack", skillName: "Mega Smash" } });
    for (let i = 0; i < 40; i++) expect(aiChooseAction(s, "B", { canSwap: true })).toEqual({ kind: "attack", skillName: "Mega Smash", target: undefined });
  });
});
