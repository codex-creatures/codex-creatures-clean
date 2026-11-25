// tests/hpPct.test.ts: the HP % (the user, 2026-11-25, decision 65) and the species' %s with no zeros.
import { describe, it, expect } from "vitest";
import { CREATURE_BY_ID, CREATURE_TEMPLATES, type CreatureProficiency } from "../lib/creatures/creatureData";
import { buildFighter } from "../lib/combat/loadout";
import { hpAt, proficiencyAt, withHpPct, REF_LEVEL } from "../lib/creatures/levels";
import { rollProficiency } from "../lib/creatures/creatureRoll";
import { ascendBonus } from "../lib/creatures/ascendStats";
import { makeCreatureDrop } from "../lib/creatures/summon";
import { fighterFor, upgradePcts, PCT_SET, PCT_SHIFT_2026_11_25 } from "../lib/creatures/instance";
import type { CreatureOrItemDrop } from "../lib/types";

const KEYS: (keyof CreatureProficiency)[] = ["atk", "rng", "mag", "agil", "mdef", "rdef", "magdef", "hp"];

describe("the HP %", () => {
  it("multiplies the whole HP, gear included, at its level's share", () => {
    const t = CREATURE_BY_ID.tunnel_wyrm;
    const f = buildFighter(t, { hp: 20 }, { hp: 30 }, undefined, undefined, undefined, undefined, REF_LEVEL);
    expect(f.proficiency.hp).toBe(t.proficiency.hp);
    expect(f.maxHp).toBe(withHpPct(hpAt(t, REF_LEVEL, 0) + 50, t.proficiency.hp));
    expect(f.hp).toBe(f.maxHp);
  });

  it("levels like the other %s: none at level 1, as listed at 15, about double at 29", () => {
    const t = CREATURE_BY_ID.glob;
    expect(proficiencyAt(t, undefined, 1, 0).hp).toBe(0);
    expect(proficiencyAt(t, undefined, REF_LEVEL, 0).hp).toBe(t.proficiency.hp);
    expect(proficiencyAt(t, undefined, 29, 0).hp).toBe(2 * t.proficiency.hp);
  });

  it("a creature saved before it takes its species' value (no roll on it)", () => {
    const t = CREATURE_BY_ID.dreadpox;
    const old: Partial<CreatureProficiency> = { ...t.proficiency };
    delete old.hp;
    const drop = { ...makeCreatureDrop(t, "creature", ""), proficiency: old as CreatureProficiency, level: REF_LEVEL };
    expect(fighterFor(drop, t).proficiency.hp).toBe(t.proficiency.hp);
  });

  it("a birth roll can move points onto or off it, the total kept", () => {
    const t = CREATURE_BY_ID.crystalback;
    const total = (p: CreatureProficiency) => KEYS.reduce((s, k) => s + p[k], 0);
    let moved = false;
    for (let i = 0; i < 400; i++) {
      const p = rollProficiency(t.proficiency);
      expect(total(p)).toBe(total(t.proficiency));
      if (p.hp !== t.proficiency.hp) moved = true;
    }
    expect(moved).toBe(true);
  });

  it("grows with ascension by the same share as the other %s, outside the step's budget", () => {
    const t = CREATURE_BY_ID.glob, b = ascendBonus(t, 1);
    const others = KEYS.filter((k) => k !== "hp");
    const share = others.reduce((s, k) => s + b[k], 0) / others.reduce((s, k) => s + t.proficiency[k], 0);
    expect(b.hp).toBe(Math.round(t.proficiency.hp * share));
  });
});

describe("the species' %s (2026-11-25)", () => {
  it("have no zeros", () => {
    const zeros = CREATURE_TEMPLATES.flatMap((t) => KEYS.filter((k) => !t.proficiency[k]).map((k) => `${t.id} ${k}`));
    expect(zeros).toEqual([]);
  });

  it("move a creature you already own over once, keeping its roll; a new one is left alone", () => {
    const t = CREATURE_BY_ID.glob;
    const now = makeCreatureDrop(t, "creature", "");
    expect(now.pctSet).toBe(PCT_SET);
    const before = { ...now.proficiency! };
    upgradePcts(now, t);
    expect(now.proficiency).toEqual(before);

    // One saved before: its %s the old species' plus a roll of +2 melee def.
    const shift = PCT_SHIFT_2026_11_25.glob;
    const old = Object.fromEntries(KEYS.filter((k) => k !== "hp").map((k) => [k, t.proficiency[k] - (shift[k] ?? 0)])) as CreatureProficiency;
    old.mdef += 2;
    const saved: CreatureOrItemDrop = { ...now, proficiency: old, pctSet: undefined };
    upgradePcts(saved, t);
    expect(saved.pctSet).toBe(PCT_SET);
    expect(saved.proficiency!.mdef).toBe(t.proficiency.mdef + 2);
    expect(saved.proficiency!.magdef).toBe(t.proficiency.magdef);
    expect(saved.proficiency!.rng).toBe(t.proficiency.rng);
    const once = { ...saved.proficiency! };
    upgradePcts(saved, t);
    expect(saved.proficiency).toEqual(once);
  });
});
