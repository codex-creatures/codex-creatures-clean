import { describe, it, expect } from "vitest";
import { createBattle, resolveRound, sendInReplacement, swapTargets, activeOf, isSealed } from "../lib/combat/battle";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage } from "../lib/combat/engine";
import {
  ALL_SKILLS, CREATURE_BY_ID, CREATURE_TEMPLATES, KLUTZ, MOVE_BY_NAME, SPECIAL_MOVES, canLearnFromCodex, defaultMoveNames,
} from "../lib/creatures/creatureData";
import { codexDrop, RACE_CODEX_MOVES } from "../lib/drops";
import { RESTYLED_SPECIES, ARCHETYPE_INFO, SPECIES_ARCHETYPE } from "../lib/creatures/rosterV2";
import { STYLE_SET, upgradeStyle } from "../lib/creatures/instance";
import { makeCreatureDrop } from "../lib/creatures/summon";
import type { CreatureOrItemDrop } from "../lib/types";

const fighter = (id: string, moves: string[]) => buildFighter(CREATURE_BY_ID[id], { melee: 20, ranged: 20 }, { mDef: 5, rDef: 5 }, moves);
const big = <T extends { maxHp: number; hp: number }>(f: T) => ({ ...f, maxHp: 999, hp: 999 });
const attack = (skillName: string) => ({ kind: "attack" as const, skillName });
const swap = (to: number) => ({ kind: "swap" as const, to });

describe("special moves: who can learn them", () => {
  const LISTS: Record<string, string[]> = {
    "Dark Seal":        ["dreadpox", "swamp_witch", "mr_shadows", "flame_imp", "dustwraith", "thunderhead"],
    "Healing Blessing": ["thunderhead", "crystal_golem", "veilstalker", "flicker_wisp", "sylvaran"],
    "Corrosive Soak":   ["bellow_toad", "rotgut_fly", "plague_rat", "glob", "deep_angler", "dreadpox", "void_serpent", "hollow_matriarch"],
    "Impale":           ["deep_angler", "aurelius", "crystal_golem", "storm_phoenix", "sylvaran", "pale_rider"],
    "Pin Down":         ["thicket_archer", "aurelius", "storm_phoenix", "sylvaran", "hollow_matriarch", "rotgut_fly"],
  };
  it("only the creatures on each move's list", () => {
    for (const [move, ids] of Object.entries(LISTS)) {
      for (const id of ids) expect(CREATURE_BY_ID[id], id).toBeTruthy();
      for (const t of CREATURE_TEMPLATES) expect(canLearnFromCodex(t, move), `${move} ${t.id}`).toBe(ids.includes(t.id));
      expect(canLearnFromCodex(KLUTZ, move)).toBe(false);
    }
  });
  it("Meditate: anyone, Klutz too", () => {
    for (const t of [...CREATURE_TEMPLATES, KLUTZ]) expect(canLearnFromCodex(t, "Meditate"), t.id).toBe(true);
  });
  it("codexes have the user's rarities, and turn up at librarians", () => {
    const want = { "Dark Seal": "rare", Meditate: "common", "Healing Blessing": "uncommon", "Corrosive Soak": "rare", Impale: "epic", "Pin Down": "rare" };
    for (const [m, r] of Object.entries(want)) expect((codexDrop(m) as CreatureOrItemDrop).rarity, m).toBe(r);
    for (const m of SPECIAL_MOVES) expect(RACE_CODEX_MOVES).toContain(m);
  });
  it("the old melee Impale is retired: Impale is now the Underkin ranged move", () => {
    expect(ALL_SKILLS.some((m) => m.name === "Impale")).toBe(false);
    expect(MOVE_BY_NAME.Impale).toMatchObject({ type: "ranged", race: "underkin", damage: 25, energyCost: 80 });
    expect(canLearnFromCodex(CREATURE_BY_ID.dire_wolf, "Impale")).toBe(false);
  });
});

describe("seals: the target can't swap out", () => {
  it("Dark Seal: 3 rounds, even if the attacker swaps; then it can", () => {
    const s = createBattle([fighter("dreadpox", ["Dark Seal", "Zap"]), fighter("moss_wolf", ["Strike"])],
      [big(fighter("moss_wolf", ["Strike"])), fighter("rattlebones", ["Strike"])]);
    resolveRound(s, { A: attack("Dark Seal"), B: attack("Strike") });
    expect(isSealed(activeOf(s.sides.B))).toBe(true);
    expect(swapTargets(s.sides.B)).toEqual([]);
    expect(() => resolveRound(s, { A: swap(1), B: swap(1) })).toThrow();
    resolveRound(s, { A: swap(1), B: attack("Strike") }); // round 2: the attacker leaves; still sealed
    expect(swapTargets(s.sides.B)).toEqual([]);
    resolveRound(s, { A: attack("Strike"), B: attack("Strike") }); // round 3
    expect(swapTargets(s.sides.B)).toEqual([]);
    resolveRound(s, { A: attack("Strike"), B: attack("Strike") }); // round 4: free again
    expect(swapTargets(s.sides.B)).toEqual([1]);
  });
  it("Dark Seal has a 5-round cooldown", () => {
    const s = createBattle([big(fighter("dreadpox", ["Dark Seal", "Zap"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Dark Seal"), B: attack("Strike") });
    for (let r = 0; r < 5; r++) {
      expect(() => resolveRound(s, { A: attack("Dark Seal"), B: attack("Strike") })).toThrow();
      resolveRound(s, { A: attack("Zap"), B: attack("Strike") });
    }
    expect(() => resolveRound(s, { A: attack("Dark Seal"), B: attack("Strike") })).not.toThrow();
  });
  it("Pin Down: 2 rounds, a third 30% of the time; Impale seals 60% of the time", () => {
    const sealedFor = (move: string, id: string) => {
      const s = createBattle([big(fighter(id, [move, "Shot"]))], [big(fighter("moss_wolf", ["Strike"])), fighter("rattlebones", ["Strike"])]);
      resolveRound(s, { A: attack(move), B: attack("Strike") });
      return s.sides.B.team[0].statuses.find((x) => x.id === "seal")?.rounds ?? 0;
    };
    const pins = Array.from({ length: 2000 }, () => sealedFor("Pin Down", "thicket_archer"));
    expect(pins.every((r) => r === 2 || r === 3)).toBe(true); // rounds left after this one
    expect(pins.filter((r) => r === 3).length / pins.length).toBeGreaterThan(0.25);
    expect(pins.filter((r) => r === 3).length / pins.length).toBeLessThan(0.35);
    const impales = Array.from({ length: 2000 }, () => sealedFor("Impale", "sylvaran"));
    expect(impales.every((r) => r === 0 || r === 2)).toBe(true);
    const share = impales.filter((r) => r > 0).length / impales.length;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.65);
  });
  it("a sealed creature that's knocked out is still replaced", () => {
    const s = createBattle([big(fighter("dreadpox", ["Dark Seal", "Zap"]))], [fighter("moss_wolf", ["Strike"]), fighter("rattlebones", ["Strike"])], { B: [1] });
    resolveRound(s, { A: attack("Dark Seal"), B: attack("Strike") });
    expect(s.needsReplacement).toEqual(["B"]);
    sendInReplacement(s, "B", 1);
    expect(s.sides.B.active).toBe(1);
  });
});

describe("Meditate and Healing Blessing", () => {
  it("Meditate: 30 extra energy, then a 3-round cooldown", () => {
    const s = createBattle([big(fighter("moss_wolf", ["Meditate", "Strike", "Rush"]))], [big(fighter("moss_wolf", ["Strike"]))]);
    resolveRound(s, { A: attack("Rush"), B: attack("Strike") }); // 100 − 50 + 30 = 80
    expect(s.sides.A.team[0].energy).toBe(80);
    resolveRound(s, { A: attack("Rush"), B: attack("Strike") }); // 60
    resolveRound(s, { A: attack("Meditate"), B: attack("Strike") }); // 60 + 30 + 30 = 100 (capped)
    expect(s.sides.A.team[0].energy).toBe(100);
    expect(() => resolveRound(s, { A: attack("Meditate"), B: attack("Strike") })).toThrow();
  });
  it("Healing Blessing heals whoever is on the field next round, before attacks", () => {
    const blesser = big(fighter("flicker_wisp", ["Healing Blessing", "Zap"]));
    const hurt = big(fighter("moss_wolf", ["Strike"]));
    const s = createBattle([blesser, hurt], [big(fighter("moss_wolf", ["Strike"]))], { A: [999, 100] });
    resolveRound(s, { A: attack("Healing Blessing"), B: attack("Strike") });
    expect(s.sides.A.team[1].hp).toBe(100); // not yet
    const start = s.log.length;
    resolveRound(s, { A: swap(1), B: attack("Strike") });
    const events = s.log.slice(start);
    const heal = events.findIndex((e) => e.type === "effect" && e.kind === "heal");
    const hit = events.findIndex((e) => e.type === "attack");
    expect(heal).toBeGreaterThan(-1);
    expect(heal).toBeLessThan(hit);
    expect(events[heal]).toMatchObject({ damage: Math.round(999 * 0.6), index: 1 });
    // One round only.
    const hp = s.sides.A.team[1].hp;
    resolveRound(s, { A: attack("Strike"), B: attack("Strike") });
    expect(s.sides.A.team[1].hp).toBeLessThan(hp);
  });
});

describe("Corrosive Soak", () => {
  it("cuts defences by 30% until the target swaps out; no damage; doesn't stack", () => {
    const soaker = big(fighter("glob", ["Corrosive Soak", "Strike"]));
    const s = createBattle([soaker], [big(buildFighter(CREATURE_BY_ID.rust_beetle, undefined, { mDef: 80, rDef: 80 }, ["Strike"])), fighter("rattlebones", ["Strike"])]);
    const target = s.sides.B.team[0];
    const before = calcDamage(MOVE_BY_NAME.Strike, soaker, target, false).damage;
    resolveRound(s, { A: attack("Corrosive Soak"), B: attack("Strike") });
    expect(target.hp).toBe(999);
    expect(target.defenceCut).toBe(0.3);
    const soaked = calcDamage(MOVE_BY_NAME.Strike, soaker, target, false).damage;
    expect(soaked).toBeGreaterThan(before);
    const { armor } = target;
    expect(soaked).toBe(calcDamage(MOVE_BY_NAME.Strike, soaker, { ...target, defenceCut: undefined, armor: { ...armor, mdef: armor.mdef * 0.7 }, proficiency: target.proficiency }, false).damage);
    resolveRound(s, { A: attack("Corrosive Soak"), B: attack("Strike") });
    expect(target.defenceCut).toBe(0.3); // not 0.6
    expect(target.statuses.filter((x) => x.id === "soak")).toHaveLength(1);
    resolveRound(s, { A: attack("Strike"), B: swap(1) });
    expect(target.defenceCut).toBeUndefined();
    expect(target.statuses.some((x) => x.id === "soak")).toBe(false);
  });
});

describe("restyled creatures (2026-10-27)", () => {
  it("the six have their new styles; the Amber Wasp is Beast / Toxic", () => {
    const want: Record<string, string[]> = {
      cave_bat: ["melee"], dust_sprite: ["magic"], amber_wasp: ["melee"], crystal_golem: ["melee", "magic"],
      tunnel_wyrm: ["melee"], thunderhead: ["magic", "melee"],
    };
    for (const [id, styles] of Object.entries(want)) {
      const t = CREATURE_BY_ID[id];
      expect(t.cls, id).toBe(styles[0]);
      expect(new Set(ARCHETYPE_INFO[SPECIES_ARCHETYPE[id]].styles), id).toEqual(new Set(styles));
      expect(new Set(t.skills.map((m) => m.type)), id).toEqual(new Set(styles));
    }
    expect(CREATURE_BY_ID.amber_wasp.races).toEqual(["beast", "toxic"]);
    expect(RESTYLED_SPECIES.sort()).toEqual(Object.keys(want).sort());
  });
  it("one you already own moves over once: attack gain kept on its new main style, new starting moves", () => {
    const t = CREATURE_BY_ID.cave_bat;
    // An old ranged roll: atk 3, rng 17 (old base 4 / 14: +2 on attack), agility +1.
    const old = { id: "x", dropType: "creature", creatureId: "cave_bat", moves: ["Shot", "Grit Sling", "Quickshot"],
      proficiency: { atk: 3, rng: 17, mag: 0, agil: 17, mdef: 2, rdef: 6, magdef: 4 } } as unknown as CreatureOrItemDrop;
    expect(upgradeStyle(old, t)).toBe(true);
    expect(old.proficiency).toEqual({ atk: 20, rng: 0, mag: 0, agil: 17, mdef: 2, rdef: 6, magdef: 4 });
    expect(old.moves).toEqual(defaultMoveNames(t));
    expect(old.styleSet).toBe(STYLE_SET);
    expect(upgradeStyle(old, t)).toBe(false); // once
    // New creatures are already on the new style; other species are left alone.
    const fresh = makeCreatureDrop(t, "creature", "");
    expect(upgradeStyle(fresh, t)).toBe(false);
    const wolf = { id: "y", dropType: "creature", creatureId: "moss_wolf", moves: ["Strike"], proficiency: { ...CREATURE_BY_ID.moss_wolf.proficiency } } as unknown as CreatureOrItemDrop;
    expect(upgradeStyle(wolf, CREATURE_BY_ID.moss_wolf)).toBe(false);
    expect(wolf.moves).toEqual(["Strike"]);
  });
});

