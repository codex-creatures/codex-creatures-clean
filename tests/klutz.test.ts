import { describe, it, expect } from "vitest";
import { KLUTZ, CREATURE_BY_ID, MOVE_BY_NAME, canLearnFromCodex, defaultMoveNames, resolveMoves } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, triangleFor, NEUTRAL_COUNTER, type Fighter } from "../lib/combat/engine";
import { planExpedition, klutzStatus, collectKlutz, sendKlutz, currentHp, rollFind, WALK_MIN_MS, WALK_MAX_MS, HEAL_MS_PER_HP, FIND_CHANCE, FIND_XP, SAME_RARITY_CHANCE, findRarity, gearCount, recallKlutz, toughening, MAX_ENCOUNTERS, TOUGHER_AFTER_MS, type KlutzState,
  pointsEarned, pointsFree, spendPoints, respecKlutz, klutzProficiency, POINTS_PER_LEVEL, RESPEC_COST } from "../lib/klutz";
import { xpToReach } from "../lib/creatures/levels";

// A small seeded random number generator, so expeditions are repeatable.
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const t0 = Date.parse("2026-10-15T12:00:00Z");
const plain = () => buildFighter(KLUTZ);
const mighty = () => ({ ...buildFighter(KLUTZ, { melee: 400, agility: 300 }, { mDef: 300, rDef: 300, magDef: 300, hp: 2000 }) });

describe("Klutz's expeditions", () => {
  it("he meets a creature every 20–60 minutes, and hunts on until one beats him, without healing", () => {
    for (let s = 1; s < 40; s++) {
      const ex = planExpedition(plain(), t0, seeded(s));
      let from = t0, hp = ex.maxHp;
      ex.encounters.forEach((e, i) => {
        expect(e.at - from).toBeGreaterThanOrEqual(WALK_MIN_MS);
        expect(e.at - from).toBeLessThanOrEqual(WALK_MAX_MS);
        expect(e.hpAfter).toBeLessThanOrEqual(hp); // he never heals on the way
        expect(e.won).toBe(i < ex.encounters.length - 1); // every fight a win, bar the last
        from = e.at; hp = e.hpAfter;
        // The loot: the creature, then its weapon and an armour piece one tier below it.
        if (e.won) {
          expect(e.loot[0]).toMatchObject({ dropType: "creature", creatureId: e.creatureId });
          expect(e.loot.slice(1).every((d) => d.dropType === "item" && (d as { rarity: string }).rarity === e.gearRarity)).toBe(true);
        }
      });
      expect(ex.endsAt).toBe(from);
    }
  });

  it("a Klutz nothing can beat comes home after MAX_ENCOUNTERS fights", () => {
    const ex = planExpedition(mighty(), t0, seeded(5));
    expect(ex.encounters).toHaveLength(MAX_ENCOUNTERS);
    expect(ex.encounters.every((e) => e.won)).toBe(true);
  });

  it("past TOUGHER_AFTER_MS what he meets gets a level tougher every hour", () => {
    expect(toughening(TOUGHER_AFTER_MS)).toBe(0);
    expect(toughening(TOUGHER_AFTER_MS + 1)).toBe(1);
    expect(toughening(TOUGHER_AFTER_MS + 2.5 * 3_600_000)).toBe(3);
  });

  it("while he's away you can see his HP, and call him back with what he's won so far", () => {
    const ex = planExpedition(mighty(), t0, seeded(9));
    const k: KlutzState = { expedition: ex };
    expect(klutzStatus(k, ex.maxHp, t0 + 1).kind === "away" && klutzStatus(k, ex.maxHp, t0 + 1)).toMatchObject({ hp: ex.maxHp });
    const third = ex.encounters[2];
    expect(klutzStatus(k, ex.maxHp, third.at)).toMatchObject({ kind: "away", hp: third.hpAfter });
    const back = recallKlutz(k, third.at + 1);
    expect(back.expedition).toMatchObject({ endsAt: third.at + 1, recalled: true });
    expect(back.expedition!.encounters).toHaveLength(3);
    const { loot } = collectKlutz(back, third.at + 1);
    expect(loot.filter((d) => d.dropType === "creature")).toHaveLength(3);
    expect(recallKlutz(back, third.at + 2)).toBe(back); // already home
  });

  it("a loss ends the trip early, and he heals 1 HP every 10 seconds in the pool", () => {
    // Find a seed where an ungeared Klutz loses.
    let ex = null;
    for (let s = 1; s < 200 && !ex; s++) {
      const e = planExpedition(plain(), t0, seeded(s));
      if (e.encounters.some((x) => !x.won)) ex = e;
    }
    expect(ex).not.toBeNull();
    const lost = ex!.encounters[ex!.encounters.length - 1];
    expect(lost.won).toBe(false);
    expect(ex!.endsAt).toBe(lost.at);

    const k: KlutzState = { expedition: ex! };
    expect(klutzStatus(k, ex!.maxHp, lost.at - 1).kind).toBe("away");
    const { state } = collectKlutz(k, lost.at);
    expect(state.hp).toBe(0);
    expect(currentHp(state, ex!.maxHp, lost.at + 5 * HEAL_MS_PER_HP)).toBe(5);
    expect(klutzStatus(state, ex!.maxHp, lost.at + 5 * HEAL_MS_PER_HP).kind).toBe("healing");
    expect(klutzStatus(state, ex!.maxHp, lost.at + ex!.maxHp * HEAL_MS_PER_HP).kind).toBe("home");
    // He can't be sent off while healing.
    expect(sendKlutz(state, plain(), lost.at + 1000)).toBe(state);
  });

  it("hands over the loot once", () => {
    const ex = planExpedition(mighty(), t0, seeded(7));
    const k: KlutzState = { expedition: ex };
    expect(collectKlutz(k, t0 + 1000).loot).toEqual([]); // still away
    const first = collectKlutz(k, ex.endsAt);
    expect(first.loot.length).toBe(3 * MAX_ENCOUNTERS);
    expect(collectKlutz(first.state, ex.endsAt + 1).loot).toEqual([]);
  });

  it("gives FIND_XP for every piece of gear he brings home, on top of the fight's XP", () => {
    for (let s = 1; s <= 60; s++) {
      const ex = planExpedition(plain(), t0, seeded(s), [{ slot: "weapon", rarity: "common" }]);
      const { state, loot } = collectKlutz({ expedition: ex }, ex.endsAt);
      const fights = ex.encounters.reduce((n, e) => n + (e.xp ?? 0), 0);
      expect(gearCount(loot)).toBe(loot.filter((d) => d.dropType !== "creature").length);
      expect(xpToReach(state.level ?? 1) + (state.xp ?? 0)).toBe(fights + FIND_XP * gearCount(loot));
    }
  });
});

describe("Klutz's finds", () => {
  it("are for a slot he's wearing, and never rarer than his piece there", () => {
    expect(rollFind([])).toBeUndefined();
    for (let i = 0; i < 300; i++) {
      const d = rollFind([{ slot: "helmet", rarity: "rare" }]) as { itemCategory: string; armorSlot: string; rarity: string };
      expect(d).toMatchObject({ itemCategory: "armor", armorSlot: "helmet" });
      expect(["common", "uncommon", "rare"]).toContain(d.rarity);
    }
    expect(rollFind([{ slot: "weapon", rarity: "epic" }])).toMatchObject({ itemCategory: "weapon" });
  });

  it("rarity: 5% the same as his piece, otherwise lower and evenly spread; in Common gear, Common or Uncommon 50/50", () => {
    const N = 6000;
    const count = (worn: "common" | "rare" | "legendary") => {
      const c: Record<string, number> = {};
      for (let i = 0; i < N; i++) { const r = findRarity(worn); c[r] = (c[r] ?? 0) + 1; }
      return c;
    };
    const rare = count("rare");
    expect(Math.abs(rare.rare / N - SAME_RARITY_CHANCE)).toBeLessThan(0.015);
    expect(rare.epic ?? 0).toBe(0);
    expect(Math.abs(rare.common / N - 0.475)).toBeLessThan(0.03);
    expect(Math.abs(rare.uncommon / N - 0.475)).toBeLessThan(0.03);
    const legendary = count("legendary");
    expect(Math.abs(legendary.legendary / N - SAME_RARITY_CHANCE)).toBeLessThan(0.015);
    const common = count("common");
    expect(Math.abs(common.uncommon / N - 0.5)).toBeLessThan(0.03);
    expect(Object.keys(common).sort()).toEqual(["common", "uncommon"]);
  });

  it("turn up on about 35% of walks (win or lose) and come home with the loot", () => {
    let found = 0, walks = 0;
    for (let s = 1; s <= 400; s++) {
      const ex = planExpedition(plain(), t0, seeded(s), [{ slot: "weapon", rarity: "common" }]);
      const loot = collectKlutz({ expedition: ex }, ex.endsAt).loot;
      for (const e of ex.encounters) {
        walks++;
        if (e.find) { found++; expect(loot).toContain(e.find); }
      }
    }
    expect(Math.abs(found / walks - FIND_CHANCE)).toBeLessThan(0.05);
    expect(planExpedition(plain(), t0, seeded(3)).encounters.some((e) => e.find)).toBe(false); // wearing nothing: nothing to find
  });

  it("an older save's trip (one find for the whole trip) still hands it over", () => {
    const ex = planExpedition(plain(), t0, seeded(4));
    const find = rollFind([{ slot: "weapon", rarity: "common" }])!;
    expect(collectKlutz({ expedition: { ...ex, find } }, ex.endsAt).loot).toContain(find);
  });
});

import { klutzGainXp, CAPTURE_XP } from "../lib/klutz";
import { xpForEnemy, xpToNext } from "../lib/creatures/levels";
describe("Klutz's levels", () => {
  it("his first catch (the weakest there is) takes him to level 2", () => {
    expect(xpForEnemy(1, "common") + CAPTURE_XP).toBeGreaterThanOrEqual(xpToNext(1));
    expect(klutzGainXp({}, xpForEnemy(1, "common") + CAPTURE_XP).state.level).toBe(2);
  });
});

describe("Klutz's skill points", () => {
  it("he earns POINTS_PER_LEVEL a level over 1 (84 at level 15, about a Rare's total)", () => {
    expect(pointsEarned(1)).toBe(0);
    expect(pointsEarned(2)).toBe(POINTS_PER_LEVEL);
    expect(pointsEarned(15)).toBe(84);
    expect(pointsFree({ level: 3, points: { atk: 5 } })).toBe(2 * POINTS_PER_LEVEL - 5);
  });

  it("spending puts them on his %s; you can't overspend, or spend negative or part points", () => {
    const k: KlutzState = { level: 3 };
    const spent = spendPoints(k, { atk: 4, agil: 2 });
    expect(klutzProficiency(spent.points)).toMatchObject({ atk: 4, agil: 2, rng: 0, mag: 0 });
    expect(pointsFree(spent)).toBe(2 * POINTS_PER_LEVEL - 6);
    expect(spendPoints(spent, { mag: 99 })).toBe(spent);
    expect(spendPoints(spent, { mag: -1, atk: 2 })).toBe(spent);
    expect(spendPoints(spent, { mag: 0.5 })).toBe(spent);
    expect(klutzProficiency(spendPoints(spent, { atk: 1 }).points).atk).toBe(5);
  });

  it("the points are his %s in a fight, and a re-spec hands them all back", () => {
    const k = spendPoints({ level: 5 }, { atk: 20 });
    const f = buildFighter(KLUTZ, undefined, undefined, undefined, klutzProficiency(k.points), undefined, undefined, 5);
    expect(f.proficiency.atk).toBe(20);
    expect(f.proficiency.rng).toBe(0);
    expect(pointsFree(respecKlutz(k))).toBe(pointsEarned(5));
    expect(RESPEC_COST).toBe(1000);
  });

  it("sending him off keeps his points", () => {
    const k = spendPoints({ level: 3 }, { atk: 3 });
    expect(sendKlutz(k, plain(), t0, seeded(1)).points).toEqual(k.points);
  });
});

describe("Klutz is neutral", () => {
  const foe = (cls: "melee" | "ranged" | "magic") => ({ ...buildFighter(CREATURE_BY_ID.moss_wolf), cls });
  const hit = (move: string, a: Fighter, d: Fighter) => calcDamage(MOVE_BY_NAME[move], a, d, false).damage;

  it("nothing counters him, and his moves never do less", () => {
    const k = plain();
    expect(triangleFor("magic", foe("magic"), k)).toBe(1);
    expect(triangleFor("melee", k, foe("magic"))).toBe(1);
    expect(triangleFor("ranged", k, foe("ranged"))).toBe(1);
  });

  it("a move of his that counters the target does NEUTRAL_COUNTER", () => {
    const k = plain();
    expect(triangleFor("ranged", k, foe("magic"))).toBe(NEUTRAL_COUNTER);
    expect(triangleFor("melee", k, foe("ranged"))).toBe(NEUTRAL_COUNTER);
    expect(hit("Stone Throw", k, foe("magic"))).toBeGreaterThan(hit("Stone Throw", k, foe("melee")));
  });

  it("other creatures keep the full triangle", () => {
    expect(triangleFor("magic", foe("magic"), foe("melee"))).toBe(1.5);
    expect(triangleFor("melee", foe("melee"), foe("magic"))).toBe(0.5);
  });

  it("he's a Rare whose %s start at 0, starts with 3 melee moves and Stone Throw, and can learn any class's codex but not other races' moves", () => {
    expect(KLUTZ.rarity).toBe("rare");
    expect(Object.values(KLUTZ.proficiency).every((v) => v === 0)).toBe(true);
    expect(defaultMoveNames(KLUTZ)).toEqual(["Slash", "Heavy Blow", "Jab", "Stone Throw"]);
    for (const m of ["Firebolt", "Starfall", "Bolt", "Devastator"]) expect(canLearnFromCodex(KLUTZ, m)).toBe(true);
    for (const m of ["Pounce", "Barrage", "Mirage", "Rabid Bite"]) expect(canLearnFromCodex(KLUTZ, m)).toBe(false);
    expect(canLearnFromCodex(CREATURE_BY_ID.moss_wolf, "Firebolt")).toBe(false);
    expect(resolveMoves(KLUTZ, ["Firebolt", "Bolt"]).map((m) => m.name)).toEqual(["Firebolt", "Bolt"]);
  });
});
