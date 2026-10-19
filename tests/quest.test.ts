import { describe, it, expect } from "vitest";
import { enemyFighter } from "../lib/dungeon/run";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage } from "../lib/combat/engine";
import { CREATURES_BY_RARITY, MOVE_BY_NAME } from "../lib/creatures/creatureData";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { createBattle, resolveRound, sendInReplacement } from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement } from "../lib/combat/thinkingAi";
import { TUTORIAL_MOVES } from "../lib/quest";
import { STARTER_LEVEL } from "../lib/creatures/starter";
import { rollBox, thiefRoom, klutzClub, clubRoom, isClub, wantsClub, wantsThief, klutzHasNews, klutzHelping, BOX_ROLLS, BOX_UNCOMMON } from "../lib/quest";
import { questMap, waysOn, knownRooms } from "../lib/dungeon/map";
import { startQuestRun, nextRooms } from "../lib/dungeon/run";
import { ITEM_KEYS, KLUTZ_CLUB_STATS } from "../lib/items/ceilings";

describe("the first quest: Klutz's box", () => {
  it("Klutz's Club doesn't roll: an even split of the Common budget, and it never turns up from scans", () => {
    const club = klutzClub() as { itemKey: string; rarity: string; stats: Record<string, number> };
    expect(club).toMatchObject({ itemKey: "klutz_club", rarity: "common" });
    expect(club.stats).toEqual(KLUTZ_CLUB_STATS);
    expect(Object.values(club.stats).reduce((a, b) => a + b, 0)).toBe(60);
    expect(ITEM_KEYS).not.toContain("klutz_club");
  });

  it("the club lies in a rickety chest, looted like any other, with only the club inside", () => {
    const room = clubRoom();
    expect(room).toMatchObject({ quest: "club", container: "chest", done: false });
    expect(room.opened).toBeFalsy();
    expect(room.sack).toHaveLength(1);
    const item = room.sack![0];
    expect("gear" in item && isClub(item.gear as { itemKey?: string })).toBe(true);
    expect(isClub({ itemKey: "void_scythe" })).toBe(false);
  });

  it("the thief is a lone Baby Cyclops in a thick hide, and no gold (the box is the prize)", () => {
    const room = thiefRoom();
    expect(room.quest).toBe("thief");
    expect(room.gold).toBe(0);
    expect(room.enemies).toHaveLength(1);
    expect(room.enemies![0]).toMatchObject({ creatureId: "baby_cyclops" });
    expect(room.enemies![0].gear).toEqual([expect.objectContaining({ slot: "armor", drops: false })]);
  });

  // Your starter (a Lv 3 Rare with Klutz's club and the lesson moves), on its own.
  const starter = (t = CREATURES_BY_RARITY.rare[0]) => ({
    ...buildFighter(t, { ...KLUTZ_CLUB_STATS }, undefined, undefined, rollCreature(t).proficiency, undefined, "klutz_club", STARTER_LEVEL),
    skills: TUTORIAL_MOVES.map((n) => MOVE_BY_NAME[n]),
  });
  it("the guided fight teaches: ranged does least, Force bounces off, Pierce goes through", () => {
    const thief = enemyFighter(thiefRoom().enemies![0]);
    for (const t of CREATURES_BY_RARITY.rare) {
      const me = starter(t);
      const hit = (name: string) => calcDamage(MOVE_BY_NAME[name], me, thief, false).damage;
      expect(hit("Stone Throw")).toBeLessThan(hit("Heavy Blow"));
      expect(hit("Heavy Blow")).toBeLessThan(hit("Impale"));
    }
  });
  it("your starter wins the guided fight on its own, after Klutz's three lessons", () => {
    for (const t of CREATURES_BY_RARITY.rare) for (let k = 0; k < 10; k++) {
      const s = createBattle([starter(t)], [enemyFighter(thiefRoom().enemies![0])]);
      const lessons = ["Stone Throw", "Heavy Blow", "Impale"];
      while (!s.winner && s.round < 100) {
        resolveRound(s, { A: s.round < 3 ? { kind: "attack", skillName: lessons[s.round] } : chooseAiAction(s, "A", "normal"), B: chooseAiAction(s, "B", "easy") });
        for (const side of [...s.needsReplacement]) sendInReplacement(s, side, chooseAiReplacement(s, side, "easy"));
      }
      expect(s.winner).toBe("A");
      expect(s.round).toBeGreaterThan(3);
    }
  });

  it("the box holds 10 pieces of Common or Uncommon gear, about 20% Uncommon", () => {
    let uncommon = 0, total = 0;
    for (let i = 0; i < 400; i++) {
      const box = rollBox();
      expect(box).toHaveLength(BOX_ROLLS);
      for (const d of box) {
        expect(d.dropType).toBe("item");
        const it = d as { rarity: string; itemCategory: string };
        expect(["common", "uncommon"]).toContain(it.rarity);
        expect(["weapon", "armor"]).toContain(it.itemCategory);
        total++; if (it.rarity === "uncommon") uncommon++;
      }
    }
    expect(Math.abs(uncommon / total - BOX_UNCOMMON)).toBeLessThan(0.03);
  });

  it("the quest's run is one tunnel to a ? room, one on to another, and no lair on the map", () => {
    const map = questMap();
    expect(waysOn(map, map.start).map((n) => n.id)).toEqual(["club"]);
    expect(waysOn(map, "club").map((n) => n.id)).toEqual(["thief"]);
    expect(waysOn(map, "thief")).toEqual([]);
    expect(Object.values(map.nodes).some((n) => n.kind === "boss")).toBe(false);
    // Both rooms stay "?" until you walk in.
    const known = knownRooms(map, [map.start]);
    expect(known.has("club")).toBe(false);
    expect(known.has("thief")).toBe(false);
    const run = startQuestRun(["a"], ["a"], {}, 1);
    expect(run.current).toBeNull();
    expect(nextRooms(run).map((n) => n.id)).toEqual(["club"]);
  });

  it("after the box: storage, then Klutz asks to borrow gear, then he hunts", () => {
    expect(klutzHasNews({ stage: "stash" })).toBe(false);
    expect(klutzHasNews({ stage: "lend" })).toBe(true);
    expect(klutzHelping({ stage: "lend" })).toBe(false);
    expect(klutzHelping({ stage: "done" })).toBe(true);
  });

  it("goes club → thief → back to Klutz", () => {
    expect(wantsClub({ stage: "start" })).toBe(true);
    expect(klutzHasNews({ stage: "start" })).toBe(true);
    expect(wantsThief({ stage: "hunt", clubFound: true })).toBe(true);
    expect(wantsClub({ stage: "hunt", clubFound: true })).toBe(false);
    expect(klutzHasNews({ stage: "boxFound" })).toBe(true);
    expect(wantsThief({ stage: "done", clubFound: true })).toBe(false);
  });
});
