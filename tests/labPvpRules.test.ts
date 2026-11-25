// tests/labPvpRules.test.ts: the PvP balance lab's two-style transform (app/lab/pvp/rules.ts) stays whole: no magic
// left anywhere under a two-style package, both styles' core moves on every creature, gear rolled under the swapped
// ceilings still spends its whole budget, and the game's own ceilings are put back after each roll.
import { describe, expect, it } from "vitest";
import { CREATURE_TEMPLATES } from "../lib/creatures/creatureData";
import { ITEM_CEILINGS, ITEM_KEYS } from "../lib/items/ceilings";
import { ARMOR_KEYS } from "../lib/items/armor";
import { RARITY_BUDGETS } from "../lib/items/budgets";
import { RULES, SHARP3, swingUnits, templateUnder, fighterUnder, rollWeaponUnder, rollPieceUnder, type RulesKey } from "../app/lab/pvp/rules";

const TWO = (Object.keys(RULES) as RulesKey[]).filter((k) => RULES[k].two);

describe("the PvP lab's rules", () => {
  it("today's rules hand back the species untouched", () => {
    for (const c of CREATURE_TEMPLATES) expect(templateUnder(c.id, "today")).toBe(c);
  });

  it("a two-style package leaves no magic and gives every creature both styles' core moves", () => {
    for (const rules of TWO) for (const c of CREATURE_TEMPLATES) {
      const t = templateUnder(c.id, rules), p = t.proficiency, q = c.proficiency;
      expect(p.mag).toBe(0);
      expect(p.magdef).toBe(0);
      expect(p.atk + p.rng, `${c.id} attack total`).toBe(q.atk + q.rng + q.mag);
      expect(p.atk, `${c.id} melee`).toBeGreaterThan(0);
      expect(p.rng, `${c.id} ranged`).toBeGreaterThan(0);
      expect(p.mdef + p.rdef, `${c.id} defence total`).toBe(q.mdef + q.rdef + q.magdef);
      expect(t.skills.map((s) => s.name).sort()).toEqual(["Power Shot", "Quickshot", "Rush", "Shot", "Smash", "Strike"]);
      const f = fighterUnder(c.id, rules, 16, { melee: 40, ranged: 40 }, { mDef: 60, rDef: 60, hp: 30 }, undefined);
      expect(f.skills.every((s) => s.type !== "magic"), `${c.id} fights without magic`).toBe(true);
      expect(f.maxHp).toBeGreaterThan(0);
      expect(f.weapon.mag).toBe(0);
    }
  });

  it("a three-style package keeps every attack % and agility, takes its defences from the user's table, and leaves magic in", () => {
    for (const rules of ["M1", "T1", "T2", "T3"] as RulesKey[]) for (const c of CREATURE_TEMPLATES) {
      const t = templateUnder(c.id, rules), p = t.proficiency, q = c.proficiency;
      expect([p.atk, p.rng, p.mag, p.agil]).toEqual([q.atk, q.rng, q.mag, q.agil]);
      expect([p.mdef, p.rdef, p.magdef], `${c.id} defences`).toEqual(SHARP3[c.id]);
      expect(Math.min(p.mdef, p.rdef, p.magdef), `${c.id} has a weak side`).toBeLessThan(Math.max(p.mdef, p.rdef, p.magdef));
      expect(t.skills).toBe(c.skills);
      const f = fighterUnder(c.id, rules, 16, { melee: 40, magic: 40 }, { mDef: 60, rDef: 60, magDef: 60, hp: 30 }, undefined);
      expect(f.armor.mdef).toBe(60 * 3 * RULES[rules].W);
      expect(f.armor.magdef).toBe(60 * 3 * RULES[rules].W);
      // The refresh package: every move in swing units (a heavy is 15, a light 10).
      if (RULES[rules].multiply) for (const s of f.skills) expect(s.damage, `${c.id} ${s.name}`).toBe(swingUnits(c.skills.find((m) => m.name === s.name)!.damage));
    }
    expect(swingUnits(25)).toBe(15);
    expect(swingUnits(62.5)).toBe(38);
  });

  it("gear rolled under a two-style package spends its budget with no magic, and the game's ceilings are restored", () => {
    const before = JSON.stringify(ITEM_CEILINGS);
    for (const key of ITEM_KEYS) for (const rarity of ["rare", "epic", "legendary"] as const) {
      const w = rollWeaponUnder(key, rarity, "K9");
      expect(w.magic ?? 0).toBe(0);
      expect(Object.values(w).reduce((a, b) => a + b, 0), `${key} ${rarity}`).toBe(RARITY_BUDGETS[rarity]);
    }
    for (const key of ARMOR_KEYS) {
      const a = rollPieceUnder(key, "rare", "K9");
      expect(a.magDef ?? 0).toBe(0);
      expect(Object.values(a).reduce((x, y) => x + y, 0), key).toBe(RARITY_BUDGETS.rare);
    }
    expect(JSON.stringify(ITEM_CEILINGS)).toBe(before);
  });
});
