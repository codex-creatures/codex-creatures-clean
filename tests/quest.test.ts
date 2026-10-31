import { describe, it, expect } from "vitest";
import { enemyFighter } from "../lib/dungeon/run";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage } from "../lib/combat/engine";
import { CREATURES_BY_RARITY, defaultMoveNames } from "../lib/creatures/creatureData";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { createBattle, resolveRound, sendInReplacement } from "../lib/combat/battle";
import { chooseAiAction, chooseAiReplacement } from "../lib/combat/thinkingAi";
import { STARTER_LEVEL, withQuickAttack } from "../lib/creatures/starter";
import { THIEF_HP_MULT, thiefRace, effectiveOn } from "../lib/quest";
import { stonesFor } from "../lib/creatures/soulStones";
import { rollBox, thiefRoom, klutzClub, clubRoom, isClub, wantsClub, wantsThief, klutzHasNews, klutzHelping, needsFirstCreature, needsGearUp, skipTutorial, BOX_ROLLS, BOX_UNCOMMON } from "../lib/quest";
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

  it("the club lies on the floor, picked up like any other loot, on its own", () => {
    const room = clubRoom();
    expect(room).toMatchObject({ quest: "club", done: false });
    expect(room.container).toBeUndefined();
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
    // No weapon or armour, but double HP, and it can't knock you out.
    expect(room.enemies![0]).toMatchObject({ gear: [], hpMult: THIEF_HP_MULT, gentle: true });
  });

  // Your starter (a Lv 3 Rare with Klutz's club and its own starting moves), on its own.
  const starter = (t = CREATURES_BY_RARITY.rare[0]) =>
    buildFighter(t, { ...KLUTZ_CLUB_STATS }, undefined, withQuickAttack(t, defaultMoveNames(t)), rollCreature(t).proficiency, undefined, "klutz_club", STARTER_LEVEL);
  const thiefFor = (me: ReturnType<typeof starter>) => enemyFighter(thiefRoom(thiefRace(me.skills)).enemies![0]);

  it("the thief's race is one your starter's moves are effective against, and they hit it harder", () => {
    const wrong: string[] = [];
    for (const t of CREATURES_BY_RARITY.rare) for (let k = 0; k < 10; k++) {
      const me = starter(t);
      const thief = thiefFor(me);
      const good = me.skills.find((s) => effectiveOn(s, thief.races ?? []));
      if (!good) { wrong.push(`${t.id}: nothing effective on ${thief.races}`); continue; }
      // (the same hit on a thief with no race)
      const plain = calcDamage(good, me, { ...thief, races: [] }, false).damage;
      if (calcDamage(good, me, thief, false).damage <= plain) wrong.push(`${t.id}: ${good.name} not stronger`);
    }
    expect(wrong).toEqual([]);
  });
  it("with no race moves at all, the thief is Humanoid", () => {
    expect(thiefRace([{ name: "Strike" }])).toBe("humanoid");
    expect(enemyFighter(thiefRoom().enemies![0]).races).toEqual(["humanoid"]);
  });
  it("your starter wins the guided fight on its own, after Klutz's lesson (an effective move)", () => {
    for (const t of CREATURES_BY_RARITY.rare) for (let k = 0; k < 10; k++) {
      // (with each of the soul stones it could be born with: a starter always has one)
      const stones = stonesFor(t.id);
      const me = { ...starter(t), soulStone: stones[k % stones.length] };
      const thief = thiefFor(me);
      const s = createBattle([me], [thief]);
      const lesson = me.skills.find((m) => effectiveOn(m, thief.races ?? []))!.name;
      while (!s.winner && s.round < 100) {
        resolveRound(s, { A: s.round === 0 ? { kind: "attack", skillName: lesson } : chooseAiAction(s, "A", "normal"), B: chooseAiAction(s, "B", "easy") });
        for (const side of [...s.needsReplacement]) sendInReplacement(s, side, chooseAiReplacement(s, side, "easy"));
      }
      expect(s.winner, t.id).toBe("A");
      expect(s.round).toBeGreaterThan(2); // (time for both of Klutz's tips: the lesson, then the race chart)
    }
  });

  it("the thief's slap never knocks your creature out: it always leaves 1 HP", () => {
    const me = { ...starter(), hp: 1 };
    const s = createBattle([me], [enemyFighter(thiefRoom().enemies![0])]);
    for (let i = 0; i < 20; i++) {
      s.sides.A.team[0].energy = 0; // too tired to attack: it rests
      resolveRound(s, { A: { kind: "pass" }, B: { kind: "attack", skillName: "Backhand" } });
    }
    expect(s.winner).toBeFalsy();
    expect(s.sides.A.team[0].hp).toBe(1);
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

  it("a new game starts with Klutz sending you to the cage, then the box", () => {
    expect(needsFirstCreature({ stage: "start" }, false)).toBe(true);
    expect(needsFirstCreature({ stage: "start" }, true)).toBe(false);
    expect(needsFirstCreature({ stage: "hunt" }, false)).toBe(false);
  });

  it("Klutz won't borrow gear until your creature wears some armour (the club alone doesn't count)", () => {
    expect(needsGearUp({ stage: "lend" }, [undefined])).toBe(true);
    expect(needsGearUp({ stage: "lend" }, [{ weaponId: "club" } as { chestId?: string }])).toBe(true);
    expect(needsGearUp({ stage: "lend" }, [{}, { legsId: "x" }])).toBe(false);
    expect(needsGearUp({ stage: "stash" }, [])).toBe(false);
  });

  it("the walk-through after the box can be skipped, but nothing before it", () => {
    expect(skipTutorial({ stage: "stash", clubFound: true })).toEqual({ stage: "done", clubFound: true });
    expect(skipTutorial({ stage: "lend" }).stage).toBe("done");
    for (const stage of ["start", "hunt", "boxFound", "done"] as const) expect(skipTutorial({ stage }).stage).toBe(stage);
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
