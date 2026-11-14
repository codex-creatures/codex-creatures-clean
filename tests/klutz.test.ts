import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KLUTZ, CREATURE_BY_ID, MOVE_BY_NAME, canLearnFromCodex, defaultMoveNames, resolveMoves } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, triangleFor, NEUTRAL_COUNTER, setCombatRules, LIVE_RULES, TRIANGLE_RULES, type Fighter } from "../lib/combat/engine";
import { planExpedition, klutzStatus, collectKlutz, sendKlutz, currentHp, HEAL_MS_PER_HP, FIND_XP, gearCount, recallKlutz, type KlutzState, type Expedition,
  pointsEarned, pointsFree, spendPoints, respecKlutz, klutzProficiency, POINTS_PER_LEVEL, RESPEC_COST,
  FIND_EVERY_MS, FIND_MIX, HOME_AT, SEND_AT, XP_SHARE, CATCH_CHANCE, catchChance, TRAP_STEP, SKILL_STEP, SKILL_MAX, PACK_START, PACK_TRAIT, packSize, chestSize, CHEST_START,
  destCost, destOpen, capRarity, sendBlock, readyAt, sendHp, spendSkill, skillPointsFree, MAX_WINDOWS, type TripPlan,
  TRAIT_LEVELS, traitPicks, traitsPicked, canPickTrait, pickTrait, nextTraitLevel, selectiveOpen } from "../lib/klutz";
import { ENTRY_FEES } from "../lib/dungeon/run";
import { xpToReach } from "../lib/creatures/levels";
import type { Rarity } from "../lib/items/budgets";

// A small seeded random number generator, so expeditions are repeatable.
function seeded(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const t0 = Date.parse("2026-10-15T12:00:00Z");
const plain = () => buildFighter(KLUTZ);
const mighty = () => ({ ...buildFighter(KLUTZ, { melee: 400, agility: 300 }, { mDef: 300, rDef: 300, magDef: 300, hp: 2000 }) });
const R: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
const ri = (r: Rarity) => R.indexOf(r);
const rarityOf = (d: { rarity?: Rarity }) => d.rarity ?? "common";
const top: TripPlan = { dest: 3, explorer: 30, level: 30 };

describe("Klutz's expeditions (v2, the user, 2026-11-14)", () => {
  it("he finds something every 20 minutes, and comes home when his pack is full, he's down to 10% HP, or something beats him", () => {
    for (let s = 1; s < 60; s++) {
      const f = s % 2 ? plain() : mighty();
      const ex = planExpedition(f, t0, seeded(s), { ...top, level: 10 });
      expect(ex.v).toBe(2);
      const times = [...ex.encounters.map((e) => e.at), ...ex.finds!.map((x) => x.at)];
      for (const at of times) expect((at - t0) % FIND_EVERY_MS).toBe(0);
      let hp = ex.startHp!;
      for (const e of ex.encounters) { expect(e.hpAfter).toBeLessThanOrEqual(hp); hp = e.hpAfter; } // he never heals on the way
      const last = ex.encounters.at(-1);
      if (ex.home === "ko") expect(last?.won).toBe(false);
      if (ex.home === "pack") expect(ex.finds!.length).toBe(PACK_START);
      if (ex.home === "hurt") expect(last!.hpAfter).toBeLessThanOrEqual(HOME_AT * ex.maxHp);
      expect(ex.encounters.filter((e) => !e.won).length).toBeLessThanOrEqual(1);
      expect(ex.finds!.length).toBeLessThanOrEqual(PACK_START);
    }
  });

  it("a find is a creature 30%, a codex 10%, a material or consumable 20%, a weapon or armour 40%", () => {
    const n = { creature: 0, codex: 0, goods: 0, gear: 0 };
    for (let s = 1; s < 300; s++) {
      const ex = planExpedition(mighty(), t0, seeded(s), { ...top, pack: 20 });
      n.creature += ex.encounters.length;
      for (const { drop: d, skill } of ex.finds!) {
        if (skill) continue;
        if (d.dropType !== "item") continue;
        if (d.codexMove) n.codex++;
        else if (d.material || d.potion) n.goods++;
        else if (d.itemCategory === "weapon" || d.itemCategory === "armor") n.gear++;
      }
    }
    // (A beaten creature's dropped gear counts as gear: GEAR_DROP_CHANCE of the creature share.)
    const all = n.creature + n.codex + n.goods + n.gear;
    expect(n.creature / all).toBeCloseTo(FIND_MIX.creature / (1 + FIND_MIX.creature * 0.2), 1);
    expect(n.codex / all).toBeCloseTo(FIND_MIX.codex, 1);
    expect(n.goods / all).toBeCloseTo(FIND_MIX.goods, 1);
  });

  it("rarities are capped by the dungeon, by his level and by your explorer level", () => {
    expect(capRarity("legendary", 0, 30, 30)).toBe("rare");     // the Encampment
    expect(capRarity("legendary", 1, 30, 30)).toBe("epic");     // the Cyclops
    expect(capRarity("legendary", 2, 30, 30)).toBe("legendary"); // the Hydra
    expect(capRarity("legendary", 2, 8, 30)).toBe("epic");      // his level opens Legendary at 12
    expect(capRarity("legendary", 2, 30, 5)).toBe("rare");      // your explorer level opens Epic at 6
    for (let s = 1; s < 80; s++) {
      const ex = planExpedition(mighty(), t0, seeded(s), { dest: 0, explorer: 30, level: 30, pack: 20 });
      for (const e of ex.encounters) expect(ri(e.rarity)).toBeLessThanOrEqual(ri("rare"));
      for (const { drop } of ex.finds!) expect(ri(rarityOf(drop as never))).toBeLessThanOrEqual(ri("rare"));
    }
  });

  it("a beaten creature is caught at its rarity's chance (Trapping adds to it); the cage filter lets lesser ones go", () => {
    expect(catchChance("legendary")).toBe(CATCH_CHANCE.legendary);
    expect(catchChance("epic", 5)).toBeCloseTo(CATCH_CHANCE.epic + 5 * TRAP_STEP);
    expect(catchChance("common", SKILL_MAX)).toBe(1);
    let won = 0, caught = 0, filtered = true;
    for (let s = 1; s < 200; s++) {
      const ex = planExpedition(mighty(), t0, seeded(s), { ...top, dest: 0, pack: 20, traits: { cageFilter: "uncommon" } });
      for (const e of ex.encounters.filter((x) => x.won)) {
        won++;
        if (e.caught) caught++;
        if (e.caught && e.rarity === "common") filtered = false;
        expect(e.loot.some((d) => d.dropType === "creature")).toBe(!!e.caught);
      }
    }
    expect(filtered).toBe(true);
    expect(caught / won).toBeLessThan(0.75); // Commons let go by the filter, the rest at their chances
  });

  it("Selective leaves things below its rarity behind; his skills bring extra finds", () => {
    for (let s = 1; s < 40; s++) {
      const ex = planExpedition(mighty(), t0, seeded(s), { ...top, traits: { selective: "rare" } });
      for (const { drop } of ex.finds!) expect(ri(rarityOf(drop as never))).toBeGreaterThanOrEqual(ri("rare"));
    }
    let extra = 0;
    for (let s = 1; s < 100; s++) extra += planExpedition(mighty(), t0, seeded(s), { ...top, skills: { armourer: SKILL_MAX, scavenger: SKILL_MAX, scholar: SKILL_MAX } }).finds!.filter((x) => x.skill).length;
    expect(extra).toBeGreaterThan(0);
    expect(SKILL_STEP * SKILL_MAX).toBeCloseTo(0.3);
  });

  it("while he's away you can see his HP, and call him back with what he's found so far", () => {
    const ex = planExpedition(mighty(), t0, seeded(9), { ...top, pack: 20 });
    const k: KlutzState = { expedition: ex };
    expect(klutzStatus(k, ex.maxHp, t0 + 1)).toMatchObject({ kind: "away", hp: ex.maxHp });
    const mid = t0 + 4 * FIND_EVERY_MS;
    const back = recallKlutz(k, mid + 1);
    expect(back.expedition).toMatchObject({ endsAt: mid + 1, recalled: true });
    expect(back.expedition!.finds!.every((x) => x.at <= mid)).toBe(true);
    const { loot } = collectKlutz(back, mid + 1);
    expect(loot.length).toBe(back.expedition!.finds!.length + back.expedition!.encounters.flatMap((e) => e.loot).length);
    expect(recallKlutz(back, mid + 2)).toBe(back); // already home
  });

  it("hands over the loot once, with half the old XP", () => {
    const ex = planExpedition(mighty(), t0, seeded(7), top);
    const k: KlutzState = { expedition: ex };
    expect(collectKlutz(k, t0 + 1000).loot).toEqual([]); // still away
    const first = collectKlutz(k, ex.endsAt);
    expect(first.loot.length).toBeGreaterThan(0);
    const fights = ex.encounters.reduce((n, e) => n + (e.xp ?? 0), 0);
    expect(xpToReach(first.state.level ?? 1) + (first.state.xp ?? 0)).toBe(fights + Math.round(FIND_XP * XP_SHARE) * gearCount(first.loot));
    expect(collectKlutz(first.state, ex.endsAt + 1).loot).toEqual([]);
  });

  it("an older trip (planned before v2) still hands over what it held", () => {
    const find = { id: "f", barcode: "", dropType: "item", itemCategory: "weapon", rarity: "common", roll: 0, createdAt: "" } as never;
    const old: Expedition = { startedAt: t0, endsAt: t0 + 1000, maxHp: 80, collected: false, find,
      encounters: [{ at: t0 + 1000, creatureId: "moss_wolf", rarity: "common", gearRarity: "common", won: false, rounds: 3, hpAfter: 0, loot: [] }] };
    const { loot, state } = collectKlutz({ expedition: old }, t0 + 1000);
    expect(loot).toContain(find);
    expect(state.hp).toBe(0);
  });
});

describe("sending Klutz (v2)", () => {
  const clears = { cyclops: 1, hydra: 0, abyss: 0 };
  it("each dungeon opens when you've beaten its boss, and costs half your entry fee (the Encampment is free)", () => {
    expect(destCost(0)).toBe(0);
    expect(destCost(1)).toBe(ENTRY_FEES[1] / 2);
    expect(destCost(2)).toBe(ENTRY_FEES[2] / 2);
    expect(destOpen(0, { cyclops: 0, hydra: 0, abyss: 0 })).toBe(true);
    expect(destOpen(1, clears)).toBe(true);
    expect(destOpen(2, clears)).toBe(false);
  });

  it("he can go from 40% HP, not while away, not with his chest full, nor without the gold", () => {
    const max = 100;
    expect(sendHp(max)).toBe(SEND_AT * max);
    const hurt: KlutzState = { hp: 30, hpAt: t0 };
    expect(sendBlock(hurt, max, 0, 0, clears, 0, t0)).toBe("hurt");
    expect(readyAt(hurt, max, t0)).toBe(t0 + 10 * HEAL_MS_PER_HP);
    expect(sendBlock(hurt, max, 0, 0, clears, 0, t0 + 10 * HEAL_MS_PER_HP)).toBeNull();
    expect(sendBlock({}, max, CHEST_START, 0, clears, 0, t0)).toBe("chest");
    expect(sendBlock({ chestUps: 1 }, max, CHEST_START, 0, clears, 0, t0)).toBeNull();
    expect(sendBlock({}, max, 0, 2, clears, 999, t0)).toBe("closed");
    expect(sendBlock({}, max, 0, 1, clears, destCost(1) - 1, t0)).toBe("gold");
  });

  it("sets off on the HP he has, and keeps everything about him", () => {
    const k: KlutzState = { level: 3, points: { atk: 3 }, learned: ["Cripple"], soulStone: "toxic_skin", skills: { armourer: 1 }, hp: 50, hpAt: t0 };
    const sent = sendKlutz(k, plain(), t0, seeded(1), 0, 30);
    expect(sent).toMatchObject({ points: k.points, learned: k.learned, soulStone: k.soulStone, skills: k.skills, dest: 0 });
    expect(sent.expedition!.startHp).toBe(50);
    expect(sent.hp).toBeUndefined();
  });

  it("his pack starts at 8; the Bigger Pack trait and pack upgrades add to it; his chest grows with upgrades", () => {
    expect(packSize({})).toBe(PACK_START);
    expect(packSize({ traits: { pack: true }, packs: 2 })).toBe(PACK_START + PACK_TRAIT.slots + 2);
    expect(PACK_TRAIT).toMatchObject({ cost: 0, slots: 4 }); // (free: the trait pick is its price, the user 2026-11-14)
    expect(chestSize({ chestUps: 2 })).toBe(CHEST_START + 20);
  });

  it("skill points: one a level over 1, each skill up to SKILL_MAX; a re-spec hands them back", () => {
    let k: KlutzState = { level: 3 };
    expect(skillPointsFree(k)).toBe(2);
    k = spendSkill(spendSkill(k, "trapping"), "trapping");
    expect(skillPointsFree(k)).toBe(0);
    expect(spendSkill(k, "scholar")).toBe(k);
    expect(skillPointsFree(respecKlutz(k))).toBe(2);
  });

  it("traits: a pick at Lv 5, 10 and 15, any trait he hasn't got, in any order", () => {
    expect(TRAIT_LEVELS).toEqual([5, 10, 15]);
    expect(traitPicks({ level: 4 })).toBe(0);
    expect(canPickTrait({ level: 4 }, "selective")).toBe(false);
    let k: KlutzState = { level: 5 };
    expect(nextTraitLevel(k)).toBe(10);
    k = pickTrait(k, "cageFilter"); // any one first
    expect(traitsPicked(k)).toEqual(["cageFilter"]);
    expect(pickTrait(k, "selective")).toBe(k); // one pick at Lv 5
    k = pickTrait({ ...k, level: 12 }, "selective");
    expect(selectiveOpen(k)).toBe(true);
    expect(pickTrait(k, "selective")).toBe(k); // never twice
    k = pickTrait({ ...k, level: 15 }, "pack");
    expect(k.traits).toMatchObject({ pack: true });
    expect(packSize(k)).toBe(PACK_START + PACK_TRAIT.slots);
    expect(traitsPicked(k)).toHaveLength(3);
    expect(nextTraitLevel(k)).toBeUndefined();
  });

  it("a trip that never ends on its own stops after MAX_WINDOWS", () => {
    const ex = planExpedition(mighty(), t0, seeded(3), { ...top, pack: 999 });
    expect(ex.endsAt - t0).toBeLessThanOrEqual(MAX_WINDOWS * FIND_EVERY_MS);
  });
});

import { klutzGainXp, CAPTURE_XP, CATCH_MAX_LEVEL } from "../lib/klutz";
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

});

// The old rules only: Combat V2 has no triangle to be outside of.
describe("Klutz is neutral (the old triangle rules)", () => {
  beforeEach(() => setCombatRules(TRIANGLE_RULES));
  afterEach(() => setCombatRules(LIVE_RULES));
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

  it("he's a Rare whose %s start at 0, knows every style's core moves (starting with 3 melee and Shot), and can learn any codex", () => {
    expect(KLUTZ.rarity).toBe("rare");
    expect(Object.values(KLUTZ.proficiency).every((v) => v === 0)).toBe(true);
    expect(defaultMoveNames(KLUTZ)).toEqual(["Strike", "Smash", "Rush", "Shot"]);
    // The older plain moves are retired: no codexes of them for anyone.
    for (const m of ["Firebolt", "Starfall", "Bolt", "Devastator"]) expect(canLearnFromCodex(KLUTZ, m)).toBe(false);
    for (const m of ["Pounce", "Barrage", "Mirage", "Rabid Bite"]) expect(canLearnFromCodex(KLUTZ, m)).toBe(true); // (any codex there is: the user, 2026-11-14)
    expect(canLearnFromCodex(KLUTZ, "Cripple")).toBe(true);
    // Any style's core moves, with no race (he lands neutral).
    const picked = resolveMoves(KLUTZ, ["Blast", "Zap"]);
    expect(picked.map((m) => m.name)).toEqual(["Blast", "Zap"]);
    expect(picked.every((m) => !m.asRace)).toBe(true);
    // A save from before: his old moves become their closest core ones, keeping 4.
    expect(resolveMoves(KLUTZ, ["Slash", "Heavy Blow", "Jab", "Stone Throw"]).map((m) => m.name)).toEqual(["Strike", "Smash", "Rush", "Shot"]);
  });
});
