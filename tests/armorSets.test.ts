import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ARMOR_KEYS, ARMOR_SLOTS, ARMOR_STAT_KEYS, PIECE_SHARE, PIECE_VALUE, NULLIFY_REFLECT, wornArmor, pieceStats, type ArmorKey,
} from "../lib/items/armor";
import { rollArmorStats } from "../lib/items/rollArmorStats";
import { RARITIES } from "../lib/balance/simulate";
import { armorDrop } from "../lib/drops";
import { computeSellGold } from "../lib/items/economy/sell";
import { getStatCapForDrop } from "../lib/items/gameHelpers";
import { buildFighter } from "../lib/combat/loadout";
import { calcDamage, rollDamage, PRECISE_IGNORE, type Fighter } from "../lib/combat/engine";
import { createBattle, resolveRound, type BattleEvent } from "../lib/combat/battle";
import { CREATURE_BY_ID, MOVE_BY_NAME } from "../lib/creatures/creatureData";
import type { CreatureOrItemDrop } from "../lib/types";

afterEach(() => vi.restoreAllMocks());

describe("armour pieces", () => {
  it("each stat's share adds up to a whole set across helmet, chest and legs", () => {
    for (const k of ARMOR_STAT_KEYS) {
      expect(ARMOR_SLOTS.reduce((s, slot) => s + PIECE_SHARE[slot][k], 0)).toBeCloseTo(1);
    }
    expect(ARMOR_SLOTS.reduce((s, slot) => s + PIECE_VALUE[slot], 0)).toBeCloseTo(1);
  });

  it("three pieces of a roll are worth about the whole roll", () => {
    for (const key of ARMOR_KEYS) for (const r of RARITIES) {
      const full = rollArmorStats(key, r).stats as Record<string, number>;
      const pieces = ARMOR_SLOTS.map((slot) => pieceStats(full, slot));
      for (const st of ARMOR_STAT_KEYS) {
        expect(Math.abs(pieces.reduce((s, p) => s + p[st], 0) - full[st])).toBeLessThanOrEqual(2);
      }
    }
  });

  it("a dropped piece knows its slot, is named after it, and its caps are its share", () => {
    for (const slot of ARMOR_SLOTS) {
      const d = armorDrop("colossal_shellarmor", "rare", "", undefined, slot) as CreatureOrItemDrop;
      expect(d.armorSlot).toBe(slot);
      expect(d.name).toMatch(/^Colossal Shellarmor /);
      for (const st of ARMOR_STAT_KEYS) expect(d.stats![st]!).toBeLessThanOrEqual(getStatCapForDrop(d, st)!);
    }
    expect(["helmet", "chest", "legs"]).toContain((armorDrop("frontiers_mail", "common") as CreatureOrItemDrop).armorSlot);
  });

  it("a piece sells for its share of what a whole set would", () => {
    const full = rollArmorStats("frontiers_mail", "epic").stats as Record<string, number>;
    const sell = (d: object) => computeSellGold({ drop: d as never, getStatCapForDrop: (x, k) => getStatCapForDrop(x as never, k) ?? 0 });
    const whole = sell({ dropType: "item", itemCategory: "armor", armorKey: "frontiers_mail", rarity: "epic", stats: full });
    const chest = sell({ dropType: "item", itemCategory: "armor", armorKey: "frontiers_mail", armorSlot: "chest", rarity: "epic", stats: pieceStats(full, "chest") });
    expect(chest).toBeLessThan(whole * 0.7);
    expect(chest).toBeGreaterThan(whole * 0.3);
  });
});

describe("set bonuses", () => {
  const piece = (armorKey: ArmorKey, armorSlot: (typeof ARMOR_SLOTS)[number], hp = 10) => ({ armorKey, armorSlot, stats: { hp } });

  it("only a full helmet + chest + legs of one armour (any rarities) counts", () => {
    const full = wornArmor(ARMOR_SLOTS.map((s) => piece("arcane_nullifier", s)));
    expect(full.set).toBe("arcane_nullifier");
    expect(full.stats.hp).toBe(30);
    expect(wornArmor([piece("arcane_nullifier", "helmet"), piece("arcane_nullifier", "chest"), undefined]).set).toBeUndefined();
    expect(wornArmor([piece("arcane_nullifier", "helmet"), piece("arcane_nullifier", "chest"), piece("frontiers_mail", "legs")]).set).toBeUndefined();
  });

  // A one-on-one fight between two Klutzes; B wears `set`.
  function duel(set: ArmorKey, moveA: string, opts: { hpB?: number; agilA?: number; agilB?: number } = {}) {
    const t = CREATURE_BY_ID.klutz;
    const make = (agil: number): Fighter => ({ ...buildFighter(t, { melee: 40, ranged: 40, agility: agil }, { mDef: 10, rDef: 10 }), skills: [MOVE_BY_NAME[moveA]] });
    const A = make(opts.agilA ?? 100);
    const B = { ...make(opts.agilB ?? 0), armorSet: set };
    const state = createBattle([A], [B], opts.hpB ? { B: [opts.hpB] } : {});
    const act = { kind: "attack", skillName: moveA } as const;
    return { A, B, state, round: () => resolveRound(state, { A: act, B: act }) };
  }
  const attacksOn = (log: BattleEvent[], side: "A" | "B") =>
    log.filter((e): e is Extract<BattleEvent, { type: "attack" }> => e.type === "attack" && e.side === side);

  it("Hard Shell halves the first hit only", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // no precise hits
    const { A, B, state, round } = duel("colossal_shellarmor", "Slash");
    const full = calcDamage(MOVE_BY_NAME.Slash, A, B, false, PRECISE_IGNORE, rollDamage(() => 0.99)).damage;
    round(); round();
    const hits = attacksOn(state.log, "A");
    expect(hits[0].damage).toBe(Math.ceil(full / 2));
    expect(hits[0].armorFx).toMatch(/Hard Shell/);
    expect(hits[1].damage).toBe(full);
  });

  it("Unstoppable survives one knockout blow on 1 HP", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { state, round } = duel("juggernaut_platemail", "Slash", { hpB: 2 });
    round();
    expect(state.sides.B.team[0].hp).toBe(1);
    expect(attacksOn(state.log, "A")[0].armorFx).toMatch(/Unstoppable/);
    round();
    expect(state.sides.B.team[0].hp).toBe(0);
  });

  it("Steadfast can't be crippled", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // every cripple would land
    const { state, round } = duel("polished_chainbolster", "Cripple");
    round();
    const hit = attacksOn(state.log, "A")[0];
    expect(hit.crippled).toBe(false);
    expect(hit.armorFx).toMatch(/Steadfast/);
    expect(state.sides.B.team[0].statuses.some((s) => s.id === "cripple")).toBe(false);
  });

  it("Deflect turns ranged attacks aside (but not melee)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const ranged = duel("arrowward_mantle", "Bolt");
    ranged.round();
    expect(attacksOn(ranged.state.log, "A")[0].missed).toBe(true);
    const melee = duel("arrowward_mantle", "Slash");
    melee.round();
    expect(attacksOn(melee.state.log, "A")[0].missed).toBe(false);
  });

  it("Nullify reflects part of a ranged hit back at the attacker", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { A, state, round } = duel("arcane_nullifier", "Bolt", { agilA: 100, agilB: 0 });
    round();
    const hit = attacksOn(state.log, "A")[0];
    const back = Math.max(1, Math.round(hit.damage * NULLIFY_REFLECT));
    const reflect = state.log.find((e) => e.type === "effect" && e.kind === "set");
    expect(reflect).toBeTruthy();
    // A took the reflection (plus B's own attack).
    const fromB = attacksOn(state.log, "B")[0]?.damage ?? 0;
    expect(state.sides.A.team[0].hp).toBe(A.maxHp - back - fromB);
  });

  it("Quickscale's first attack goes before a faster creature — once", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const { state, round } = duel("dragonscale_tunic", "Slash", { agilA: 100, agilB: 0 });
    round(); round();
    const attacks = state.log.filter((e) => e.type === "attack");
    expect(attacks[0].side).toBe("B"); // round 1: Quickscale first
    expect(attacks[2].side).toBe("A"); // round 2: back to agility order
  });
});
