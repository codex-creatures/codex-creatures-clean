import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, CREATURES_BY_RARITY, type CreatureProficiency } from "../lib/creatures/creatureData";
import { rollCreature } from "../lib/creatures/creatureRoll";
import { makeCreatureDrop } from "../lib/creatures/summon";
import { hpAt, proficiencyAt, rollsOf, withHpPct, REF_LEVEL } from "../lib/creatures/levels";
import { ascendBonus, ascendHp, maxSteps, rarityAfter, stepsOf, ASCEND_STATS, RARITY_ORDER } from "../lib/creatures/ascendStats";
import { ascend, giveProblem, keepProblem, lossesOf, othersNeeded, ritualProblem, ASCEND_MIN_LEVEL } from "../lib/creatures/ascend";
import { fighterFor } from "../lib/creatures/instance";
import { teamRarity } from "../lib/pvp/teams";
import { PVP_FORMATS as FORMATS, ineligibleReason } from "../lib/pvp/formats";
import type { CreatureOrItemDrop } from "../lib/types";
import { codexesOfRarity } from "../lib/drops";

const ALL = Object.values(CREATURES_BY_RARITY).flat();
// (The %s' total leaves out its HP %, which grows outside the budget.)
const sum = (p: CreatureProficiency) => Object.entries(p).reduce((a, [k, v]) => a + (k === "hp" ? 0 : v), 0);
const creature = (id: string, level = ASCEND_MIN_LEVEL, ascended?: number): CreatureOrItemDrop => {
  const t = CREATURE_BY_ID[id];
  return { ...makeCreatureDrop(t, "creature", "x"), level, ...(ascended ? { ascended, rarity: rarityAfter(t, ascended) } : {}) };
};

describe("ascension stats", () => {
  it("each step adds its rarity's budget, shared along the species' shape, exactly", () => {
    const fails: string[] = [];
    for (const t of ALL) {
      for (let s = 0; s <= maxSteps(t); s++) {
        const b = ascendBonus(t, s);
        const want = RARITY_ORDER.slice(RARITY_ORDER.indexOf(t.rarity) + 1, RARITY_ORDER.indexOf(t.rarity) + 1 + s).reduce((n, r) => n + ASCEND_STATS[r], 0);
        if (sum(b) !== want) fails.push(`${t.id} ${s}: ${sum(b)} ≠ ${want}`);
        for (const k of Object.keys(b) as (keyof CreatureProficiency)[]) {
          if (t.proficiency[k] === 0 && b[k] !== 0) fails.push(`${t.id} ${s}: ${k} was 0`);
          if (b[k] < 0) fails.push(`${t.id} ${s}: ${k} < 0`);
        }
      }
    }
    expect(fails).toEqual([]);
  });

  it("steps stop at Legendary, and bad or missing steps count as none", () => {
    expect(maxSteps(CREATURE_BY_ID.moss_wolf)).toBe(4);
    expect(maxSteps(CREATURE_BY_ID.bellow_toad)).toBe(2);
    expect(maxSteps(CREATURE_BY_ID.ironhide)).toBe(0);
    expect(stepsOf(CREATURE_BY_ID.bellow_toad, 9)).toBe(2);
    expect(stepsOf(CREATURE_BY_ID.bellow_toad, undefined)).toBe(0);
    expect(stepsOf(CREATURE_BY_ID.bellow_toad, NaN)).toBe(0);
    expect(stepsOf(CREATURE_BY_ID.bellow_toad, -1)).toBe(0);
    expect(rarityAfter(CREATURE_BY_ID.moss_wolf, 2)).toBe("rare");
    expect(rarityAfter(CREATURE_BY_ID.bellow_toad, 5)).toBe("legendary");
  });

  // The plan the user approved (2026-11-18): HP / %s total at each level and rarity (no roll).
  it("matches the approved plan", () => {
    const table = (id: string) => {
      const t = CREATURE_BY_ID[id];
      return Array.from({ length: maxSteps(t) + 1 }, (_, s) => [5, 10, 15, 20, 25, 30].map((L) => `${hpAt(t, L, s)}/${sum(proficiencyAt(t, undefined, L, s))}`).join(" "));
    };
    expect(table("moss_wolf")).toMatchInlineSnapshot(`
      [
        "70/12 84/27 98/42 111/57 125/72 139/86",
        "86/16 103/39 120/58 137/78 154/100 171/120",
        "106/25 127/53 149/82 170/111 191/139 212/169",
        "131/31 157/67 183/107 209/147 235/183 261/222",
        "155/46 186/108 218/166 249/225 280/286 311/344",
      ]
    `);
    expect(table("bellow_toad")).toMatchInlineSnapshot(`
      [
        "109/22 131/49 153/77 175/105 197/132 219/160",
        "134/29 161/67 188/102 214/137 241/175 268/210",
        "159/46 190/104 222/161 254/218 285/276 317/333",
      ]
    `);
  });

  it("no steps: stats exactly as before ascension existed", () => {
    for (const t of ALL) {
      const roll = rollCreature(t).proficiency;
      expect(proficiencyAt(t, roll, REF_LEVEL, 0)).toEqual(roll);
      expect(hpAt(t, REF_LEVEL, 0)).toBe(Math.round(t.baseHp * 1.5));
      expect(ascendHp(t, 0)).toBe(0);
    }
  });

  it("its birth roll is untouched: the bonus sits beside it", () => {
    for (const t of ALL) {
      const roll = rollCreature(t).proficiency;
      for (let s = 0; s <= maxSteps(t); s++) for (const L of [1, 5, 15, 30]) {
        const mine = proficiencyAt(t, roll, L, s), plain = proficiencyAt(t, undefined, L, s), rolls = rollsOf(t, roll);
        for (const k of Object.keys(rolls) as (keyof CreatureProficiency)[]) expect(mine[k] - plain[k]).toBe(rolls[k]);
      }
    }
  });

  it("what it fights as: the same whether it ascended then levelled or levelled then ascended", () => {
    const a = creature("moss_wolf", 5);
    const raisedThenLevelled = { ...ascend(a, [1, 2, 3, 4].map(() => creature("moss_wolf", 5))), level: 12 };
    const levelledThenRaised = ascend({ ...a, level: 12 }, [1, 2, 3, 4].map(() => creature("moss_wolf", 5)));
    const t = CREATURE_BY_ID.moss_wolf;
    expect(fighterFor(raisedThenLevelled, t)).toEqual(fighterFor(levelledThenRaised, t));
    const f = fighterFor(raisedThenLevelled, t), before = fighterFor({ ...a, level: 12 }, t);
    expect(f.maxHp).toBe(withHpPct(hpAt(t, 12, 1), f.proficiency.hp));
    expect(f.maxHp).toBeGreaterThan(before.maxHp);
    expect(sum(f.proficiency)).toBeGreaterThan(sum(before.proficiency));
  });
});

describe("the ascension ritual", () => {
  it("5 of a kind for the first step, then 3, all the same species, rarity and Lv 5+", () => {
    const kept = creature("moss_wolf");
    expect(othersNeeded(kept)).toBe(4);
    const four = [1, 2, 3, 4].map(() => creature("moss_wolf"));
    expect(ritualProblem(kept, four)).toBeNull();
    const up = ascend(kept, four);
    expect(up).toMatchObject({ id: kept.id, ascended: 1, rarity: "uncommon", level: kept.level, proficiency: kept.proficiency, moves: kept.moves });
    expect(othersNeeded(up)).toBe(2);
    // Common Moss Wolves won't do for an Uncommon one; Uncommon ones will.
    expect(ritualProblem(up, [creature("moss_wolf"), creature("moss_wolf")])).toMatch(/uncommon/);
    expect(ascend(up, [creature("moss_wolf", 5, 1), creature("moss_wolf", 5, 1)])).toMatchObject({ ascended: 2, rarity: "rare" });
  });

  it("refuses the wrong creatures", () => {
    const kept = creature("moss_wolf");
    const ok = () => [1, 2, 3].map(() => creature("moss_wolf"));
    expect(ritualProblem(kept, ok())).toMatch(/Needs 4 more/);
    expect(ritualProblem(kept, [...ok(), creature("cave_bat")])).toMatch(/species/);
    expect(ritualProblem(kept, [...ok(), creature("moss_wolf", 4)])).toMatch(/Lv 5/);
    expect(ritualProblem({ ...kept, level: 4 }, [...ok(), creature("moss_wolf")])).toMatch(/Lv 5/);
    const twice = creature("moss_wolf");
    expect(ritualProblem(kept, [...ok().slice(0, 2), twice, twice])).toMatch(/twice/);
    expect(ritualProblem(kept, [...ok(), kept])).toBeTruthy();
    const card = { ...creature("moss_wolf"), dropType: "card" as const };
    expect(giveProblem(kept, card)).toBeTruthy();
    expect(keepProblem(card)).toBeTruthy();
    expect(keepProblem(creature("ironhide"))).toMatch(/Legendary/);
    expect(keepProblem(creature("bellow_toad", 5, 2))).toMatch(/Legendary/);
    // Away (a run, the pit) or in a team.
    const busy = creature("moss_wolf");
    expect(ritualProblem(kept, [...ok(), busy], new Set(), new Set([busy.id]))).toMatch(/team/);
    expect(keepProblem(kept, new Set([kept.id]))).toMatch(/Away/);
    expect(() => ascend(kept, ok())).toThrow();
  });

  it("warns about soul stones and Epic or Legendary codex moves given up", () => {
    const plain = { ...creature("moss_wolf"), soulStone: null, learned: [] };
    expect(lossesOf([plain])).toEqual([]);
    expect(lossesOf([{ ...plain, soulStone: "trickster" }])[0]).toMatchObject({ soulStone: "trickster", codexes: [] });
    const epic = codexesOfRarity("epic")[0], common = codexesOfRarity("common")[0];
    expect(lossesOf([{ ...plain, learned: [common] }])).toEqual([]);
    expect(lossesOf([{ ...plain, learned: [common, epic] }])[0].codexes).toEqual([epic]);
  });
});

describe("its rarity counts where rarity counts", () => {
  it("an ascended creature is held to its new rarity in PvP", () => {
    const epicToad = creature("bellow_toad", 15, 1);
    expect(epicToad.rarity).toBe("epic");
    expect(teamRarity([{ rarity: epicToad.rarity, gear: [] }])).toBe("epic");
    expect(ineligibleReason({ rarity: epicToad.rarity, gear: [] }, FORMATS["3v3-rare"])).toMatch(/Too rare/);
    const rareWolf = creature("moss_wolf", 15, 2);
    expect(ineligibleReason({ rarity: rareWolf.rarity, gear: [] }, FORMATS["3v3-rare"])).toBeFalsy();
  });
});

describe("saves", () => {
  it("loading keeps an ascended creature's rarity, mends a wrong one, and leaves older creatures as they were", async () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } },
    };
    const { loadSave } = await import("../hooks/useGameState");
    const { SAVE_KEY } = await import("../lib/save");
    const old = creature("moss_wolf");
    const up = { ...creature("moss_wolf"), ascended: 2, rarity: "common" as const };      // its rarity out of step
    const over = { ...creature("bellow_toad"), ascended: 7 };                              // more steps than it can climb
    const card = { ...creature("moss_wolf"), dropType: "card" as const, ascended: 1 };     // cards never climb
    store[SAVE_KEY] = JSON.stringify({ inventory: [old, up, over, card], gold: 0 });
    const inv = loadSave()!.inventory as CreatureOrItemDrop[];
    const byId = (id: string) => inv.find((d) => d.id === id)!;
    expect(byId(old.id).ascended).toBeUndefined();
    expect(byId(old.id).rarity).toBe("common");
    expect(byId(up.id)).toMatchObject({ ascended: 2, rarity: "rare" });
    expect(byId(over.id)).toMatchObject({ ascended: 2, rarity: "legendary" });
    expect(byId(card.id).ascended).toBeUndefined();
    expect(byId(card.id).rarity).toBe("common");
  });
});
